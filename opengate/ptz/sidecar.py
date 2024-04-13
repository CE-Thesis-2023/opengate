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

    def move_relative(self, camera_name: str, pan: float, tilt: float, zoom: float):
        req = {
            "pan": pan,
            "tilt": tilt,
            "zoom": zoom,
        }
        p = self._get_query_url(camera_name=camera_name)
        p = p + f"/ptz/relative?name={camera_name}"
        logging.info(f"Sending request to {p}")
        resp = requests.post(
            url=p, json=req, headers={"Content-Type": "application/json"}, timeout=2
        )
        resp.raise_for_status()
        return resp.json()

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
