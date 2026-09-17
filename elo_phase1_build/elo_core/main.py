from __future__ import annotations
import signal
import time
from .core import ELOCore


def main():
    app = ELOCore()
    def stop(*_):
        app.stop()
    signal.signal(signal.SIGINT, stop)
    signal.signal(signal.SIGTERM, stop)
    try:
        app.start()
        while not app.stop_evt.is_set():
            time.sleep(1)
    finally:
        app.stop()


if __name__ == "__main__":
    main()
