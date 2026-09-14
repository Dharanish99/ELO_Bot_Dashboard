# ELO Bot Dashboard 🤖📱

A React Native & Expo companion dashboard for monitoring, configuring, and interacting with the ELO companion robot.

## Features

- **Robot State & Mode Control**: Real-time mode tracking and toggling between *Moving* and *Interacting* modes.
- **Session & Restriction Management**: Monitor active session times, enforce daily interaction limits, and view progress.
- **Privacy & Safety Controls**: One-tap microphone muting and session privacy toggling.
- **Interaction Reports**: Review session logs, summaries, and full interactive dialog transcripts.
- **Built-in Mock Server**: Simulated FastAPI backend for seamless local development and offline testing.

## Tech Stack

- **Frontend**: React Native, Expo, React Navigation, TypeScript
- **State & Storage**: React Context API, AsyncStorage
- **Backend (Mock)**: Zero-dependency Node.js HTTP server simulating FastAPI endpoints

## Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Start the Mock Server

To run the local mock API server:

```bash
npm run mock
```
The mock server runs on port `8000` (`http://localhost:8000` or via your local network IP).

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
