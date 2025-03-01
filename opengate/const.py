CONFIG_DIR = "/config"
DEFAULT_DB_PATH = f"{CONFIG_DIR}/opengate.db"
MODEL_CACHE_DIR = f"{CONFIG_DIR}/model_cache"
BASE_DIR = "/media/opengate"
CLIPS_DIR = f"{BASE_DIR}/clips"
RECORD_DIR = f"{BASE_DIR}/recordings"
EXPORT_DIR = f"{BASE_DIR}/exports"
BIRDSEYE_PIPE = "/tmp/cache/birdseye"
CACHE_DIR = "/tmp/cache"
YAML_EXT = (".yaml", ".yml")
OPENGATE_LOCALHOST = "http://127.0.0.1:5000"

# Attribute & Object Consts

ATTRIBUTE_LABEL_MAP = {
    "person": ["face", "amazon"],
    "car": ["ups", "fedex", "amazon", "license_plate"],
}
ALL_ATTRIBUTE_LABELS = [
    item for sublist in ATTRIBUTE_LABEL_MAP.values() for item in sublist
]
LABEL_CONSOLIDATION_MAP = {
    "car": 0.8,
    "face": 0.5,
}
LABEL_CONSOLIDATION_DEFAULT = 0.9
LABEL_NMS_MAP = {
    "car": 0.6,
}
LABEL_NMS_DEFAULT = 0.4

# Audio Consts

AUDIO_DURATION = 0.975
AUDIO_FORMAT = "s16le"
AUDIO_MAX_BIT_RANGE = 32768.0
AUDIO_SAMPLE_RATE = 16000
AUDIO_MIN_CONFIDENCE = 0.5

# Regex Consts

REGEX_CAMERA_NAME = r"^[a-zA-Z0-9_-]+$"
REGEX_RTSP_CAMERA_USER_PASS = r":\/\/[a-zA-Z0-9_-]+:[\S]+@"
REGEX_HTTP_CAMERA_USER_PASS = r"user=[a-zA-Z0-9_-]+&password=[\S]+"

# Known Driver Names

DRIVER_ENV_VAR = "LIBVA_DRIVER_NAME"
DRIVER_AMD = "radeonsi"
DRIVER_INTEL_i965 = "i965"
DRIVER_INTEL_iHD = "iHD"

# Record Values

CACHE_SEGMENT_FORMAT = "%Y%m%d%H%M%S%z"
MAX_PRE_CAPTURE = 60
MAX_SEGMENT_DURATION = 600
MAX_SEGMENTS_IN_CACHE = 6
MAX_PLAYLIST_SECONDS = 7200  # support 2 hour segments for a single playlist to account for cameras with inconsistent segment times

# Internal Comms Topics

INSERT_MANY_RECORDINGS = "insert_many_recordings"
REQUEST_REGION_GRID = "request_region_grid"

# Autotracking

AUTOTRACKING_MAX_AREA_RATIO = 0.6
AUTOTRACKING_MOTION_MIN_DISTANCE = 20
AUTOTRACKING_MOTION_MAX_POINTS = 500
AUTOTRACKING_MAX_MOVE_METRICS = 500
AUTOTRACKING_ZOOM_OUT_HYSTERESIS = 1.2
AUTOTRACKING_ZOOM_IN_HYSTERESIS = 0.9
AUTOTRACKING_ZOOM_EDGE_THRESHOLD = 0.05

OPENGATE_EMBLEM = """
   ____  _____  ______ _   _  _____       _______ ______
  / __ \|  __ \|  ____| \ | |/ ____|   /\|__   __|  ____|
 | |  | | |__) | |__  |  \| | |  __   /  \  | |  | |__
 | |  | |  ___/|  __| | . ` | | |_ | / /\ \ | |  |  __|
 | |__| | |    | |____| |\  | |__| |/ ____ \| |  | |____
  \____/|_|    |______|_| \_|\_____/_/    \_|_|  |______|
"""
