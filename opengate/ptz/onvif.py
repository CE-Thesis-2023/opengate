"""Configure and control camera via onvif."""

import logging
from enum import Enum

import numpy
from onvif import ONVIFCamera, ONVIFError

from opengate.config import OpenGateConfig, ZoomingModeEnum
from opengate.ptz.sidecar import SidecarCameraController
from opengate.types import PTZMetricsTypes

logger = logging.getLogger(__name__)


class OnvifCommandEnum(str, Enum):
    """Holds all possible move commands"""

    init = "init"
    move_down = "move_down"
    move_left = "move_left"
    move_right = "move_right"
    move_up = "move_up"
    preset = "preset"
    stop = "stop"
    zoom_in = "zoom_in"
    zoom_out = "zoom_out"


class OnvifController:
    def __init__(
        self,
        config: OpenGateConfig,
        ptz_metrics: dict[str, PTZMetricsTypes],
        sidecar: SidecarCameraController = None,
    ) -> None:
        self.cams: dict[str, ONVIFCamera] = {}
        self.config = config
        self.ptz_metrics = ptz_metrics
        self.sidecar = sidecar
        if sidecar:
            self.sidecar = sidecar
        else:
            self.sidecar = SidecarCameraController(config=config)
        for cam_name, cam in config.cameras.items():
            if not cam.enabled:
                continue

            if cam.onvif.host:
                try:
                    self.cams[cam_name] = {
                        "onvif": None,
                        "init": False,
                        "active": False,
                        "features": [],
                        "presets": {},
                    }
                except ONVIFError as e:
                    logger.error(f"Onvif connection to {cam.name} failed: {e}")

    def _is_sidecar(self, camera_name: str) -> bool:
        return (
            self.config.cameras[camera_name].onvif.isapi_fallback
            or self.config.cameras[camera_name].onvif.isapi_sidecar != None
        )

    def _init_onvif(self, camera_name: str) -> bool:
        # get list of supported features
        supported_features = []
        supported_features.append("pt")
        supported_features.append("zoom")
        supported_features.append("pt-r")
        supported_features.append("zoom-r")
        if (
            self.config.cameras[camera_name].onvif.autotracking.zooming
            == ZoomingModeEnum.relative
        ):
            self.config.cameras[
                camera_name
            ].onvif.autotracking.zooming = ZoomingModeEnum.disabled
            logger.warning(
                f"Disabling autotracking zooming for {camera_name}: Relative zoom not supported"
            )

        supported_features.append("zoom-a")
        if (
            self.config.cameras[camera_name].onvif.autotracking.enabled_in_config
            and self.config.cameras[camera_name].onvif.autotracking.enabled
        ):
            if self.config.cameras[camera_name].onvif.autotracking.zooming:
                self.config.cameras[
                    camera_name
                ].onvif.autotracking.zooming = ZoomingModeEnum.disabled
                logger.warning(
                    f"Disabling autotracking zooming for {camera_name}: Absolute zoom not supported"
                )

        # set relative pan/tilt space for autotracker
        if (
            self.config.cameras[camera_name].onvif.autotracking.enabled_in_config
            and self.config.cameras[camera_name].onvif.autotracking.enabled
        ):
            supported_features.append("pt-r-fov")

        self.cams[camera_name]["features"] = supported_features
        self.cams[camera_name]["init"] = True
        return True

    def _stop(self, camera_name: str) -> None:
        self.cams[camera_name]["active"] = False

    def _move(self, camera_name: str, command: OnvifCommandEnum) -> None:
        if self.cams[camera_name]["active"]:
            logger.warning(
                f"{camera_name} is already performing an action, stopping..."
            )
            self._stop(camera_name)

        move_request = None
        self.cams[camera_name]["active"] = True
        if command == OnvifCommandEnum.move_left:
            move_request = {"pan": -5, "tilt": 0, "duration": 1}
        elif command == OnvifCommandEnum.move_right:
            move_request = {"pan": 5, "tilt": 0, "duration": 1}
        elif command == OnvifCommandEnum.move_up:
            move_request = {"pan": 0, "tilt": 5, "duration": 1}
        elif command == OnvifCommandEnum.move_down:
            move_request = {"pan": 0, "tilt": -5, "duration": 1}
        if move_request is not None:
            self.sidecar.move_continous(camera_name=camera_name, **move_request)

    def _move_relative(
        self,
        camera_name: str,
        pan: float,
        tilt: float,
        zoom: float,
        speed: float,
    ) -> None:
        logger.debug(
            f"{camera_name} called RelativeMove: pan: {pan} tilt: {tilt} zoom: {zoom}"
        )

        if self.cams[camera_name]["active"]:
            logger.warning(
                f"{camera_name} is already performing an action, not moving..."
            )
            return

        self.cams[camera_name]["active"] = True
        self.ptz_metrics[camera_name]["ptz_motor_stopped"].clear()
        logger.debug(
            f"{camera_name}: PTZ start time: {self.ptz_metrics[camera_name]['ptz_frame_time'].value}"
        )
        self.ptz_metrics[camera_name]["ptz_start_time"].value = self.ptz_metrics[
            camera_name
        ]["ptz_frame_time"].value
        self.ptz_metrics[camera_name]["ptz_stop_time"].value = 0

        sidecar = self.sidecar

        # function takes in -1 to 1 for pan and tilt, interpolate to the values of the camera.
        # The onvif spec says this can report as +INF and -INF, so this may need to be modified
        pan = numpy.interp(
            pan,
            [-1, 1],
            [-1, 1],
        )
        tilt = numpy.interp(
            tilt,
            [-1, 1],
            [-1, 1],
        )

        sidecar.move_relative(
            pan=pan,
            tilt=tilt,
            zoom=0,
            height=self.config.cameras[camera_name].detect.height,
            width=self.config.cameras[camera_name].detect.width,
            camera_name=camera_name,
        )

        self.cams[camera_name]["active"] = False

    def _move_to_preset(self, camera_name: str, preset: str) -> None:
        if preset not in self.cams[camera_name]["presets"]:
            logger.error(f"{preset} is not a valid preset for {camera_name}")
            return

        self.cams[camera_name]["active"] = True
        self.ptz_metrics[camera_name]["ptz_motor_stopped"].clear()
        self.ptz_metrics[camera_name]["ptz_start_time"].value = 0
        self.ptz_metrics[camera_name]["ptz_stop_time"].value = 0

        self.cams[camera_name]["active"] = False

    def _zoom(self, camera_name: str, command: OnvifCommandEnum) -> None:
        if self.cams[camera_name]["active"]:
            logger.warning(
                f"{camera_name} is already performing an action, stopping..."
            )
            self._stop(camera_name)

        self.cams[camera_name]["active"] = True
        onvif: ONVIFCamera = self.cams[camera_name]["onvif"]
        move_request = self.cams[camera_name]["move_request"]

        if command == OnvifCommandEnum.zoom_in:
            move_request.Velocity = {"Zoom": {"x": 0.5}}
        elif command == OnvifCommandEnum.zoom_out:
            move_request.Velocity = {"Zoom": {"x": -0.5}}

        onvif.get_service("ptz").ContinuousMove(move_request)

    def _zoom_absolute(self, camera_name: str, zoom, speed) -> None:
        if "zoom-a" not in self.cams[camera_name]["features"]:
            logger.error(f"{camera_name} does not support ONVIF AbsoluteMove zooming.")
            return

        logger.debug(f"{camera_name} called AbsoluteMove: zoom: {zoom}")

        if self.cams[camera_name]["active"]:
            logger.warning(
                f"{camera_name} is already performing an action, not moving..."
            )
            return

        self.cams[camera_name]["active"] = True
        self.ptz_metrics[camera_name]["ptz_motor_stopped"].clear()
        logger.debug(
            f"{camera_name}: PTZ start time: {self.ptz_metrics[camera_name]['ptz_frame_time'].value}"
        )
        self.ptz_metrics[camera_name]["ptz_start_time"].value = self.ptz_metrics[
            camera_name
        ]["ptz_frame_time"].value
        self.ptz_metrics[camera_name]["ptz_stop_time"].value = 0
        onvif: ONVIFCamera = self.cams[camera_name]["onvif"]
        move_request = self.cams[camera_name]["absolute_move_request"]

        # function takes in 0 to 1 for zoom, interpolate to the values of the camera.
        zoom = numpy.interp(
            zoom,
            [0, 1],
            [
                self.cams[camera_name]["absolute_zoom_range"]["XRange"]["Min"],
                self.cams[camera_name]["absolute_zoom_range"]["XRange"]["Max"],
            ],
        )

        move_request.Speed = {"Zoom": speed}
        move_request.Position = {"Zoom": zoom}

        logger.debug(f"{camera_name}: Absolute zoom: {zoom}")

        onvif.get_service("ptz").AbsoluteMove(move_request)

        self.cams[camera_name]["active"] = False

    def handle_command(
        self, camera_name: str, command: OnvifCommandEnum, param: str = ""
    ) -> None:
        if camera_name not in self.cams.keys():
            logger.error(f"Onvif is not setup for {camera_name}")
            return

        if not self.cams[camera_name]["init"]:
            if not self._init_onvif(camera_name):
                return

        if command == OnvifCommandEnum.init:
            # already init
            return
        elif command == OnvifCommandEnum.stop:
            self._stop(camera_name)
        elif command == OnvifCommandEnum.preset:
            self._move_to_preset(camera_name, param)
        elif (
            command == OnvifCommandEnum.zoom_in or command == OnvifCommandEnum.zoom_out
        ):
            logger.warning("Zooming is not supported for these cameras.")
        else:
            self._move(camera_name, command)

    def get_camera_info(self, camera_name: str) -> dict[str, any]:
        if camera_name not in self.cams.keys():
            logger.error(f"Onvif is not setup for {camera_name}")
            return {}

        if not self.cams[camera_name]["init"]:
            self._init_onvif(camera_name)

        return {
            "name": camera_name,
            "features": self.cams[camera_name]["features"],
            "presets": list(self.cams[camera_name]["presets"].keys()),
        }

    def get_service_capabilities(self, camera_name: str) -> None:
        # sidecar already implements this functionality
        if self._is_sidecar(camera_name):
            return "true"
        return "false"

    def get_camera_status(self, camera_name: str) -> None:
        if camera_name not in self.cams.keys():
            logger.error(f"Onvif is not setup for {camera_name}")
            return {}

        if not self.cams[camera_name]["init"]:
            self._init_onvif(camera_name)

        resp = self.sidecar.get_status(camera_name=camera_name)

        # there doesn't seem to be an onvif standard with this optional parameter
        # some cameras can report MoveStatus with or without PanTilt or Zoom attributes
        pan_tilt_status = "idle" if resp["moving"] is False else "moving"
        zoom_status = "idle"

        if pan_tilt_status.lower() == "idle" and (
            zoom_status is None or zoom_status.lower() == "idle"
        ):
            self.cams[camera_name]["active"] = False
            if not self.ptz_metrics[camera_name]["ptz_motor_stopped"].is_set():
                self.ptz_metrics[camera_name]["ptz_motor_stopped"].set()

                logger.debug(
                    f"{camera_name}: PTZ stop time: {self.ptz_metrics[camera_name]['ptz_frame_time'].value}"
                )

                self.ptz_metrics[camera_name]["ptz_stop_time"].value = self.ptz_metrics[
                    camera_name
                ]["ptz_frame_time"].value
        else:
            self.cams[camera_name]["active"] = True
            if self.ptz_metrics[camera_name]["ptz_motor_stopped"].is_set():
                self.ptz_metrics[camera_name]["ptz_motor_stopped"].clear()

                logger.debug(
                    f"{camera_name}: PTZ start time: {self.ptz_metrics[camera_name]['ptz_frame_time'].value}"
                )

                self.ptz_metrics[camera_name][
                    "ptz_start_time"
                ].value = self.ptz_metrics[camera_name]["ptz_frame_time"].value
                self.ptz_metrics[camera_name]["ptz_stop_time"].value = 0

        # some hikvision cams won't update MoveStatus, so warn if it hasn't changed
        if (
            not self.ptz_metrics[camera_name]["ptz_motor_stopped"].is_set()
            and not self.ptz_metrics[camera_name]["ptz_reset"].is_set()
            and self.ptz_metrics[camera_name]["ptz_start_time"].value != 0
            and self.ptz_metrics[camera_name]["ptz_frame_time"].value
            > (self.ptz_metrics[camera_name]["ptz_start_time"].value + 10)
            and self.ptz_metrics[camera_name]["ptz_stop_time"].value == 0
        ):
            logger.debug(
                f'Start time: {self.ptz_metrics[camera_name]["ptz_start_time"].value}, Stop time: {self.ptz_metrics[camera_name]["ptz_stop_time"].value}, Frame time: {self.ptz_metrics[camera_name]["ptz_frame_time"].value}'
            )
            # set the stop time so we don't come back into this again and spam the logs
            self.ptz_metrics[camera_name]["ptz_stop_time"].value = self.ptz_metrics[
                camera_name
            ]["ptz_frame_time"].value
            logger.warning(f"Camera {camera_name} is still in ONVIF 'MOVING' status.")
