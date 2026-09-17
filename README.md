# ELO Bot Dashboard 🤖📱

A React Native & Expo companion dashboard for monitoring, configuring, and interacting with the ELO companion robot.

## Features

- **Central Control Interface (Phase C)**: Complete control and telemetry surface for ELO Core running on Raspberry Pi.
- **Vision Target Selection**: View real-time tracked persons and explicitly designate the target person for ELO to follow.
- **Primary Commands**: `FOLLOW`, `INTERACT`, and `STOP` (Emergency Stop) with strict state validation and transitional feedback.
- **Safety & Obstacle Monitoring**: Real-time obstacle warnings and automatic motor disengagement alerts (no safety overrides).
- **Subsystem Telemetry**: Live status indicators for AI Engine and Audio subsystems.
- **Session & Restriction Management**: Monitor active session times, enforce daily interaction limits, and view progress.
- **Privacy & Child Safety**: One-tap microphone muting and session report privacy exclusions.
- **Interaction Reports**: Review session logs, summaries, and full educational dialogue transcripts.
- **Built-in Phase C Mock Server**: Simulated FastAPI/Pi backend for offline testing and end-to-end verification.

## Tech Stack

- **Frontend**: React Native, Expo, React Navigation, TypeScript
- **State & Storage**: React Context API, AsyncStorage
- **Backend (Mock)**: Zero-dependency Node.js HTTP server simulating Raspberry Pi ELO Core HTTP API

## Configuration

The dashboard connects directly to the Raspberry Pi running ELO Core on port 8090.

Create a `.env` file (or copy from `.env.example`):
```bash
cp .env.example .env
```
And specify your Raspberry Pi's LAN IP address:
```bash
EXPO_PUBLIC_ELO_CORE_URL=http://<PI_IP_ADDRESS>:8090
```
You can also change the target IP anytime inside the app under the **Settings** tab.

## Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Start the Mock Server (Optional for offline testing)

To run the local mock API server:

```bash
npm run mock
```
The mock server runs on port `8090` (`http://localhost:8090` or via your local network IP).

### 3. Run the App

Start the Expo development server:

```bash
npm start
```

You can then run on:
- **Android**: Press `a` or run `npm run android`
- **iOS**: Press `i` or run `npm run ios`
- **Web**: Press `w` or run `npm run web`

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
