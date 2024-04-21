import logging
from typing import Dict

import requests

from opengate.config import CameraConfig

logger = logging.getLogger(__name__)


class SidecarCameraController:
    def __init__(self, config: CameraConfig) -> None:
        self.config = config

    def _get_capabilties(self, camera_name: str) -> Dict:
        p = self._get_query_url(camera_name=camera_name)
        p = p + f"/ptz/capabilities?name={camera_name}"
        resp = requests.get(
            url=p, headers={"Content-Type": "application/json"}, timeout=2
        )
        resp.raise_for_status()
        return resp.json()

    def _move_relative_onvif(
        self,
        req: Dict,
        height: int,
        width: int,
        camera_name: str,
    ):
        return self.move_relative(
            camera_name=camera_name,
            pan=req["Translation"]["PanTilt"]["x"],
            tilt=req["Translation"]["PanTilt"]["y"],
            zoom=req["Translation"]["Zoom"]["x"],
            height=height,
            width=width,
        )

    def move_continous(
        self,
        camera_name: str,
        pan: int,
        tilt: int,
        duration: int = 1,
    ):
        req = {
            "pan": pan,
            "tilt": tilt,
            "duration": duration,
        }
        p = self._get_query_url(camera_name="camera")
        p = p + f"/ptz/continuous?name={camera_name}"
        logging.info(f"Sending request to {p}")
        resp = requests.post(
            url=p, json=req, headers={"Content-Type": "application/json"}, timeout=2
        )
        resp.raise_for_status()
        return

    def move_relative(
        self,
        camera_name: str,
        pan: float,
        tilt: float,
        zoom: float,
        height: float,
        width: float,
    ):
        req = {
            "relative": {
                "positionX": pan,
                "positionY": tilt,
                "relativeZoom": zoom,
            },
            "frame": {
                "height": height,
                "width": width,
            },
        }
        p = self._get_query_url(camera_name=camera_name)
        p = p + f"/ptz/relative?name={camera_name}"
        logging.info(f"Sending request to {p}")
        resp = requests.post(
            url=p, json=req, headers={"Content-Type": "application/json"}, timeout=2
        )
        resp.raise_for_status()
        return

    def get_status(self, camera_name: str) -> Dict:
        p = self._get_query_url(camera_name=camera_name)
        p = p + f"/ptz/status?name={camera_name}"
        resp = requests.get(
            url=p, headers={"Content-Type": "application/json"}, timeout=2
        )
        resp.raise_for_status()
        return resp.json()

    def _get_sidecar_configs(self, camera_name: str):
        return self.config.cameras[camera_name].onvif.isapi_sidecar

    def _get_query_url(self, camera_name: str) -> str:
        c = self._get_sidecar_configs(camera_name=camera_name)
        return f"http://{c.host}:{c.port}"
