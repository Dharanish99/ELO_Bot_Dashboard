#!/usr/bin/env python3
import time
from elo_follow.config import load_config
from elo_follow.motor import MotorController
m=MotorController(load_config())
def run(l,r,secs):
 print('L/R',l,r); m.set(l,r); time.sleep(secs); m.stop(); time.sleep(.4)
try:
 print('WARNING: lift robot wheels off floor before running. Ctrl-C stops.')
 run(20,20,1.0); run(-20,-20,1.0); run(-20,20,.8); run(20,-20,.8)
finally: m.stop(); m.close()
