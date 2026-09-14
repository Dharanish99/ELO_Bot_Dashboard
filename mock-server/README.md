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
The server will start on port `8000` (listening on `0.0.0.0` so other devices on your local WiFi can connect).

## Endpoints Implemented

- `GET /api/health` - Health check status
- `GET /api/state` - Current robot mode (`moving` or `interacting`)
- `POST /api/mode` - Switch mode (`{ mode: "moving" | "interacting" }`)
- `GET /api/session/current` - Active session progress vs daily limit
- `GET /api/reports?limit=10` - List recent session summaries
- `GET /api/reports/:id` - Full report detail including interactive dialog transcript
- `GET /api/restrictions` - Current daily interaction limit (minutes)
- `POST /api/restrictions` - Set daily interaction limit (`{ dailyLimitMinutes: number }`)
- `POST /api/privacy/visibility` - Exclude current session from reporting (`{ enabled: boolean }`)
- `POST /api/privacy/mute` - Mute robot microphone (`{ enabled: boolean }`)
