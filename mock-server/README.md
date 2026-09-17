# ELO Mock Backend Server

A lightweight, zero-dependency Node.js server simulating the FastAPI backend of the ELO companion robot.

## Starting the Mock Server

From the project root:
```bash
npm run mock
```
Or directly:
```bash
node mock-server/server.js
```
The server starts on port `8090` by default (or the port specified in `PORT` / command-line arg, listening on `0.0.0.0` so other devices on your local WiFi can connect).

## Pi Core Endpoints Implemented

- `GET /health` - Health check status
- `GET /status` - Complete robot state, current target, obstacle status, AI engine & audio ready flags
- `GET /targets` - Vision-tracked persons detected by robot camera
- `POST /target` - Parent selects tracking target (`{ target_id: string }`)
- `POST /mode` - Set operating mode (`{ mode: "FOLLOW" | "INTERACT" | "STOP" }`)
- `POST /stop` - Emergency stop motors
- `GET /audio/status` - Audio subsystem ready status
- `POST /audio/start` - Start audio
- `POST /audio/stop` - Stop audio
- `POST /interaction/start` - Start interaction
- `POST /interaction/end` - End interaction

## Legacy / AI Backend Endpoints (for backward compatibility)

- `GET /api/session/current` - Active session progress vs daily limit
- `GET /api/reports?limit=10` - List recent session summaries
- `GET /api/reports/:id` - Full report detail including interactive dialog transcript
- `GET /api/restrictions` - Current daily interaction limit (minutes)
- `POST /api/restrictions` - Set daily interaction limit (`{ dailyLimitMinutes: number }`)
- `POST /api/privacy/visibility` - Exclude current session from reporting (`{ enabled: boolean }`)
- `POST /api/privacy/mute` - Mute robot microphone (`{ enabled: boolean }`)
