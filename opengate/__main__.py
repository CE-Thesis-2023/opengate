import faulthandler
import threading

from flask import cli

from opengate.app import OpenGateApp

faulthandler.enable()

threading.current_thread().name = "opengate"

cli.show_server_banner = lambda *x: None

if __name__ == "__main__":
    opengate_app = OpenGateApp()

    opengate_app.start()
