#!/usr/bin/env python3
import time
from elo_follow.config import load_config
from elo_follow.ultrasonic import UltrasonicArray
cfg=load_config(); u=UltrasonicArray(cfg); u.start()
print('Ultrasonic test: Ctrl-C to stop')
try:
 while True:
  print(u.snapshot())
  time.sleep(0.2)
except KeyboardInterrupt: pass
finally: u.stop()
