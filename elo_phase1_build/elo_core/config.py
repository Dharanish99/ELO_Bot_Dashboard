from __future__ import annotations
from dataclasses import dataclass
import os


def env(name: str, default: str) -> str:
    return os.getenv(name, default)


def env_bool(name: str, default: bool) -> bool:
    v = os.getenv(name)
    if v is None:
        return default
    return v.strip().lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class CoreConfig:
    api_host: str = env("ELO_CORE_HOST", "0.0.0.0")
    api_port: int = int(env("ELO_CORE_PORT", "8090"))
    backend_ws_url: str = env("BACKEND_WS_URL", "ws://127.0.0.1:8000/ws/robot")
    robot_device_token: str = env("ROBOT_DEVICE_TOKEN", "")
    audio_capture_device: str = env("AUDIO_CAPTURE_DEVICE", "plughw:ELOAUDIO,0")
    audio_playback_device: str = env("AUDIO_PLAYBACK_DEVICE", "plughw:ELOAUDIO,1")
    audio_sample_rate: int = int(env("AUDIO_SAMPLE_RATE", "16000"))
    audio_channels: int = int(env("AUDIO_CHANNELS", "1"))
    max_record_seconds: int = int(env("AUDIO_MAX_SECONDS", "20"))
    esp32_serial_port: str = env("ESP32_SERIAL_PORT", "/dev/ttyAMA0")
    esp32_baudrate: int = int(env("ESP32_BAUDRATE", "460800"))
    display_fps: float = float(env("ESP32_DISPLAY_FPS", "25"))
    backend_timeout_s: float = float(env("BACKEND_TIMEOUT_S", "30"))
    cors_origin: str = env("ELO_CORE_CORS_ORIGIN", "*")


CORE_CONFIG = CoreConfig()
