import logging
from typing import Dict

import requests

from opengate.config import CameraConfig

logger = logging.getLogger(__name__)


class SidecarCameraController:
    def __init__(self, config: CameraConfig) -> None:
        self.config = config

    def _get_capabilties(self, camera_name: str) -> Dict:
        p = self._get_query_url()
        p = f"{p}/ptz/capabilities?name={camera_name}"
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
        p = self._get_query_url()
        p = f"{p}/ptz/relative?name={camera_name}"
        resp = requests.post(
            url=p, json=req, headers={"Content-Type": "application/json"}, timeout=2
        )
        resp.raise_for_status()
        return resp.json()

    def get_status(self, camera_name: str) -> Dict:
        p = self._get_query_url()
        p = f"{p}/ptz/status?name={camera_name}"
        resp = requests.get(
            url=p, headers={"Content-Type": "application/json"}, timeout=2
        )
        resp.raise_for_status()
        return resp.json()

    def _get_sidecar_configs(self):
        return self.config.onvif.isapi_sidecar

    def _get_query_url(self) -> str:
        c = self._get_sidecar_configs()
        return f"http://{c.host}:{c.port}"
