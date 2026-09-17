# ELO Bot Dashboard — Complete Architecture, System Design & Engineering Handoff

> **Version:** 1.0.0 (Phase C Architecture)  
> **Platform:** React Native (0.86.3) / Expo (SDK ~57.0.22) / TypeScript (~6.0.3)  
> **Target Device Ecosystem:** iOS, Android, Web (Companion app for ELO AI Physical Robot)  
> **Protocol:** Direct REST/HTTP Telemetry & Control over Local Area Network (Default Port: 8090)

---

## Table of Contents
1. [Executive Summary & Product Vision](#1-executive-summary--product-vision)
2. [Design Psychology & Aesthetics Philosophy](#2-design-psychology--aesthetics-philosophy)
   - 2.1 The "Nothing OS" Dark Monochromatic Principle
   - 2.2 Cognitive Load Reduction for Parents
   - 2.3 "Color is an Event, Not Decoration"
   - 2.4 Three-Layer Component Hierarchy
   - 2.5 Micro-Interactions, Spring Physics & Spatial Transitions
3. [End-to-End System Architecture](#3-end-to-end-system-architecture)
   - 3.1 Network Topology & Physical Connection Strategy
   - 3.2 Resilience, Polling Cycle & Timeout Budgets
   - 3.3 State Machine & Data Normalization
4. [Deep Dive: Screen-by-Screen Breakdown](#4-deep-dive-screen-by-screen-breakdown)
   - 4.1 Screen 1: Home (Control Center)
   - 4.2 Screen 2: Reports (Session Ledger)
   - 4.3 Screen 3: Report Detail (Pedagogical & Emotional Audit)
   - 4.4 Screen 4: Restrictions / Limits (Parental Guardrails)
   - 4.5 Screen 5: Settings (Network & Diagnostics)
5. [Component Library & Subsystem Anatomy](#5-component-library--subsystem-anatomy)
   - 5.1 `EloIdentityHeader`
   - 5.2 `ConnectionBanner`
   - 5.3 `RobotStateBadge`
   - 5.4 `SubsystemStatusBar`
   - 5.5 `TargetSelector`
   - 5.6 `SafetyStatusCard`
   - 5.7 `CommandButtons`
   - 5.8 `SessionTimeIndicator`
   - 5.9 `PrivacyCard`
   - 5.10 `ModeToggleButton`
6. [API Layer, Protocol Contract & Data Schema](#6-api-layer-protocol-contract--data-schema)
7. [State Management & Lifecycle Dynamics (`ELOContext`)](#7-state-management--lifecycle-dynamics-elocontext)
8. [Offline Testing & The Zero-Dependency Mock Server](#8-offline-testing--the-zero-dependency-mock-server)
9. [Security, Child Safety & Privacy Guarantees](#9-security-child-safety--privacy-guarantees)
10. [Maintenance, Deployment & Developer Onboarding Guide](#10-maintenance-deployment--developer-onboarding-guide)

---

## 1. Executive Summary & Product Vision

The **ELO Bot Dashboard** is the parental command center for **ELO**, an autonomous, physical companion robot designed for children. ELO combines computer vision, robotic locomotion, obstacle avoidance, voice interactions, and emotional/educational scaffolding.

Because ELO operates directly in a child's physical play space, the companion mobile app is **not** a social media feed or a gamified distraction. Instead, it is an **instrument of parental peace of mind, high-reliability remote control, and developmental observation**.

The application provides:
1. **Real-time Locomotion Control & Telemetry:** Visual target locking, follow-mode initiation, interaction triggering, and emergency stopping.
2. **Deterministic Safety Telemetry:** Immediate feedback on ultrasonic proximity alarms, obstacles, and motor lockouts.
3. **Session & Educational Reporting:** Pedagogical breakdowns (vocabulary acquired, questions asked, breathing exercises completed) and full dialogue transcripts.
4. **Parental Restrictions & Guardrails:** Time budgets per day with automatic countdown enforcement.
5. **Zero-Cloud Local Resilience:** Complete operation across local Wi-Fi directly to the robot's onboard Raspberry Pi 5 core.

---

## 2. Design Psychology & Aesthetics Philosophy

### 2.1 The "Nothing OS" Dark Monochromatic Principle
The visual architecture of ELO Dashboard is inspired by the design language of Teenage Engineering and Nothing OS: **"Subtract, don't add."**

* **Pure Pitch Black (`#000000`):** True black is the foundation. On OLED displays (standard on modern iOS and flagship Android devices), true black pixels emit zero photons. This establishes maximum visual contrast while minimizing device battery consumption.
* **Surface Stacking:** Depth is created not through vibrant shadows or color tints, but through strictly calibrated greyscale luminance steps:
  - Base Canvas: `#000000`
  - Layer 1 Surface (Cards, Modules): `#111111`
  - Layer 2 Surface (Elevated chips, Inner cells): `#1A1A1A`
  - Pressed / Active States: `#222222`
  - Subtle Structural Borders: `#222222` (light) to `#333333` (strong)

### 2.2 Cognitive Load Reduction for Parents
Parents opening this app are often multitasking, checking in while cooking, working, or supervising in another room.
* **Zero Visual Clutter:** No decorative illustrations, extraneous badges, or marketing banners.
* **Information Scannability in < 500ms:** A parent can glance at the top of the Home screen and immediately answer two critical questions:
  1. *Is the robot online and safe?* (Green vs red status dot, obstacle readout).
  2. *What is it doing right now?* (34px bold typographic state badge: `Moving`, `Interacting`, or `Stopped`).

### 2.3 "Color is an Event, Not Decoration"
In traditional mobile apps, colors are used indiscriminately for branding, gradients, and backgrounds. In ELO Dashboard, **color is reserved strictly for state changes, safety events, and functional indicators**:
* **White / Off-White (`#F5F5F5`):** Reserved for primary information, active confirmed targets, and primary commands.
* **Medium Greys (`#888888`, `#555555`):** Subsystem labels, secondary meta indicators, and inactive borders.
* **Safety Accent Red (`#FF3B30`):** Indicates danger, emergency stop, obstacle detection, or microphone mute. When the parent sees red anywhere on the screen, their eye is drawn to it immediately because nothing else competes for attention.
* **Subtle System Dots (`#34C759` Green, `#4A9EFF` Blue, `#A78BFA` Purple):** Used exclusively in micro-pills for live network health or distinct state demarcation (`Moving` vs `Interacting`).

### 2.4 Three-Layer Component Hierarchy
Every UI widget conforms to a three-tier information hierarchy:
1. **Layer 1: Context & Origin (11px, Uppercase, Tracking +1.5):** Subdued grey timestamp or category title (e.g., `TRACKING TARGET`, `SAFETY & OBSTACLES`, `SYNCED AT 09:30 AM`).
2. **Layer 2: Primary Value (20px - 48px, Bold / Heavy):** The core datum (e.g., `Moving`, `45 min / day`, `Person 1`).
3. **Layer 3: Supplementary Metadata (12px - 14px, Secondary Grey):** Descriptive sentence or sub-metrics (e.g., `Following Maya around the room`, `2.1m away • 92% conf`).

### 2.5 Micro-Interactions, Spring Physics & Spatial Transitions
A dark minimalist aesthetic can easily feel lifeless if static. To counteract this, ELO Dashboard uses dynamic React Native physics:
* **Staggered Orchestrated Entrances:** When `HomeScreen` mounts, sections animate in sequential 100ms cascades (`animHeader` → `animHero` → `animControls` → `animSecondary`), guiding the user's attention from identity down to controls.
* **Spring-Bounced State Transitions:** When the robot's mode switches from `Moving` to `Interacting` or `Stopped`, `RobotStateBadge` executes a spring scale bounce (`friction: 6, tension: 120`), giving physical tactile weight to remote physical changes.
* **Interactive Radio Pills:** In `TargetSelector`, selecting a person triggers immediate local optimistic state and an inner radio dot expansion before network confirmation arrives.

---

## 3. End-to-End System Architecture

```
                                  LOCAL AREA NETWORK (Wi-Fi)
                             
   ┌────────────────────────────────────────┐         HTTP (Port 8090)        ┌────────────────────────────────────────┐
   │          ELO Mobile Dashboard          │ ──────────────────────────────> │        Raspberry Pi 5 Core (ELO)       │
   │  (React Native / Expo iOS / Android)   │ <────────────────────────────── │       (FastAPI / Python Subsystems)    │
   └────────────────────────────────────────┘                                 └────────────────────────────────────────┘
                       │                                                                          │
         ┌─────────────┴─────────────┐                                              ┌─────────────┴─────────────┐
         ▼                           ▼                                              ▼                           ▼
  [ ELOContext ]              [ Async Storage ]                              [ Vision / Tracker ]       [ Motor & GPIO ]
  - 1500ms Polling Loop       - Base URL Persist                             - Person Detection         - Motor Inhibit
  - Optimistic Commands       - Network Presets                              - Distance & Confidence    - Ultrasonic Safety
  - State Normalization                                                      - Target Lock System       - Hardware E-Stop
```

### 3.1 Network Topology & Physical Connection Strategy
The mobile phone running ELO Dashboard and the physical robot (Raspberry Pi 5) communicate over **mDNS / Local Wi-Fi**.
* The Raspberry Pi runs an HTTP server bound to `0.0.0.0:8090`.
* The Expo app communicates directly via HTTP REST requests using standard `fetch`.
* No cloud intermediate servers or relays are required, ensuring zero latency, absolute privacy, and complete functionality even if the home loses internet access.

### 3.2 Resilience, Polling Cycle & Timeout Budgets
Robotics applications require high resilience against transient Wi-Fi drops:
* **Polling Interval:** Fixed at **1500ms (`POLLING_INTERVAL_MS = 1500`)**. This interval strikes an ideal balance between real-time responsiveness and conserving the mobile device's battery.
* **Request Timeout:** Set to **3500ms (`REQUEST_TIMEOUT_MS = 3500`)** via `AbortController`. Health checks use an aggressive **2500ms** timeout.
* **Concurrency Lock:** `isPollingBusyRef` prevents overlapping poll executions if a slow network request takes longer than 1500ms.
* **Failure Threshold:** The system allows up to **3 consecutive failures (`FAILURE_THRESHOLD = 3`)** before declaring the robot offline (`isUnreachable = true`). This prevents the dashboard from flickering into offline warning states during momentary packet drops.

### 3.3 State Machine & Data Normalization
The Raspberry Pi backend emits states that may use varied naming conventions (`FOLLOW`, `INTERACT`, `STOP`, `moving`, `interacting`, `stopped`). 
The `src/api/client.ts` client implements strict defensive normalization:
* Any raw state (`state`, `mode`, `robot_state`, `current_mode`) is mapped through `normalizeRobotMode()` to one of four strict TypeScript types: `'moving' | 'interacting' | 'stopped' | 'unknown'`.
* Base URLs are automatically sanitized by `normalizeBaseUrl()`, stripping accidental whitespace, ensuring `http://` or `https://` protocols, and trimming trailing slashes.

---

## 4. Deep Dive: Screen-by-Screen Breakdown

```
Root Tab Navigator
├── 1. Control [HomeScreen]
├── 2. Reports [ReportsStackNavigator]
│       ├── ReportsList [ReportsScreen]
│       └── ReportDetail [ReportDetailScreen]
├── 3. Limits [RestrictionsScreen]
└── 4. Settings [SettingsScreen]
```

---

### 4.1 Screen 1: Home (`HomeScreen.tsx`)
The **Home / Control** screen is the primary cockpit of the application. It aggregates all telemetry, vision tracking, safety status, primary commands, and privacy switches onto a single fluid canvas.

#### Visual Hierarchy & Layout:
1. **Status Header (`EloIdentityHeader`):** Shows brand typography, real-time `ONLINE` / `OFFLINE` status pill with pulsing colored dot, and the exact timestamp of the last successful synchronization cycle.
2. **Offline Warning Banner (`ConnectionBanner`):** Appears conditionally only when 3+ consecutive polls fail. Displays a clear message with a direct `Retry` action button.
3. **Command Error Alert:** Red-tinted alert box that automatically displays if the robot rejects an instruction (e.g., trying to initiate `FOLLOW` when no target is selected or path is blocked).
4. **Hero State Badge (`RobotStateBadge`):** 34px dynamic state display with corresponding icon and subtitle.
5. **Subsystem Bar (`SubsystemStatusBar`):** Two-segment status box providing independent visibility into the **AI Engine** and **Audio Pipeline**.
6. **Target Selector (`TargetSelector`):** Dynamic list of people detected by the robot’s camera. Shows real-time distance in meters and tracking confidence percentages. Tapping locks a person as the active target.
7. **Safety Status Card (`SafetyStatusCard`):** Displays path safety. Turns bright red with an alert icon when ultrasonic sensors detect an obstacle, or shows safe green when clear.
8. **Primary Commands (`CommandButtons`):** Three large command tiles:
   - `FOLLOW`: Instructs the robot to follow the selected child.
   - `INTERACT`: Puts the robot in stationary educational conversation mode.
   - `STOP`: High-visibility emergency stop button with danger styling.
9. **Secondary Widgets:**
   - `SessionTimeIndicator`: Micro progress bar indicating current session duration vs daily limit.
   - `PrivacyCard`: Quick-access hardware privacy toggles.

---

### 4.2 Screen 2: Reports (`ReportsScreen.tsx`)
The **Reports** screen provides parents with a chronological ledger of past interactions between their child and ELO.

#### Architecture & Behavior:
* **Dynamic Fetching:** Communicates with `GET /api/reports?limit=15`.
* **Animated FlatList (`ReportRow`):** Each row animates in with a staggered vertical slide and opacity fade (`delay: index * 60ms`).
* **Summary Snapshot:** Every card reveals the date, session duration (e.g. `24m`), number of questions asked by the child, and emotional mood check-in (e.g., `4 questions • curious and energetic`).
* **Empty State:** Clean, distraction-free indicator when no sessions have been logged yet.
* **Pull-to-Refresh:** Integrated `RefreshControl` tied to the dark theme color palette.

---

### 4.3 Screen 3: Report Detail (`ReportDetailScreen.tsx`)
Tapping any report card opens the **Report Detail** screen via `ReportsStackNavigator`. This screen acts as a complete pedagogical and emotional audit of the interaction.

#### Deep Breakdown of Sections:
1. **Navigation Header:** Back navigation arrow, screen title, and balanced header layout.
2. **Topline Metrics:** Formatted session date and total duration in minutes.
3. **Three-Column Stats Grid:**
   - `Distance`: Total distance ELO navigated while following the child (e.g., `42.5m`).
   - `Avoided`: Count of obstacle avoidance maneuvers executed by ELO’s safety systems.
   - `Questions`: Number of inquisitive inquiries voiced by the child.
4. **Wellbeing & Emotional Check-in:**
   - Logs child's self-reported mood or emotional state during check-ins.
   - Indicates whether mindfulness/balloon breathing exercises were successfully completed.
5. **Vocabulary Learned (Pill Cloud):** Displays individual pill chips for new educational concepts and vocabulary words introduced during the session (e.g., `Photosynthesis`, `Chlorophyll`, `Ecosystem`).
6. **Complete Dialogue Transcript:**
   - Formatted chat bubbles clearly separating `child` and `elo` utterances.
   - ELO’s responses are left-aligned in `#111111` surface bubbles.
   - The child's words are right-aligned in elevated `#1A1A1A` bubbles.
   - Micro-timestamps at the bottom of each bubble show speech progression.

---

### 4.4 Screen 4: Restrictions / Limits (`RestrictionsScreen.tsx`)
The **Restrictions** screen empowers parents to enforce healthy screen-free digital balance and physical play boundaries.

#### Interaction Architecture:
* **Large Monospaced Numeric Input:** Centerpiece 48px bold typography showing daily allowed minutes (`min / day`).
* **Tactile Step Increments:** Circular `-` and `+` touch targets flanking the input allow quick adjustments in 5-minute steps.
* **Quick Presets:** Horizontal row of pill chips for standard parental limits (`15`, `30`, `45`, `60`, `90`, `120` minutes). Tapping a preset instantly applies and persists the value to the robot.
* **Persistent Save Action:** Calls `POST /api/restrictions` with inline feedback (`Set to 45 min` or error message).

---

### 4.5 Screen 5: Settings (`SettingsScreen.tsx`)
The **Settings** screen is the connectivity bridge between the mobile app and the physical Raspberry Pi.

#### Capabilities & Diagnostic Features:
* **Base URL Management:** Full text input for the ELO Core endpoint (e.g., `http://172.30.140.141:8090`).
* **Quick IP Switcher:** Pre-configured chips for instant one-tap switching:
  - `Pi (Default)`: `DEFAULT_ELO_CORE_URL` from `.env`
  - `192.168.1.100`: Common standard router assignment
  - `raspberrypi.local`: mDNS local hostname
* **In-App Latency Test (`Test` Button):** Pings `GET /health`, measures exact round-trip ping time in milliseconds, and renders a live green or red status dot (`Connected • 42ms`).
* **Collapsible Troubleshooting Guide:** Tap `Need help?` to reveal a 3-step checklist explaining how to verify Wi-Fi subnets, find Pi IP via `hostname -I`, and configure port 8090.

---

## 5. Component Library & Subsystem Anatomy

All components are located in [`src/components/`](file:///c:/Users/R.P.DHARANISHPURUSOH/ELO_Dashboard/src/components) and follow strict single-responsibility principles:

| Component | File Path | Primary Function |
| :--- | :--- | :--- |
| **`EloIdentityHeader`** | [`EloIdentityHeader.tsx`](file:///c:/Users/R.P.DHARANISHPURUSOH/ELO_Dashboard/src/components/EloIdentityHeader.tsx) | Brand masthead, real-time online/offline badge, and synchronization clock. |
| **`ConnectionBanner`** | [`ConnectionBanner.tsx`](file:///c:/Users/R.P.DHARANISHPURUSOH/ELO_Dashboard/src/components/ConnectionBanner.tsx) | Appears on connection failure threshold with smooth fade-in and manual retry. |
| **`RobotStateBadge`** | [`RobotStateBadge.tsx`](file:///c:/Users/R.P.DHARANISHPURUSOH/ELO_Dashboard/src/components/RobotStateBadge.tsx) | Hero status widget with dynamic icons, spring physics, and target person names. |
| **`SubsystemStatusBar`** | [`SubsystemStatusBar.tsx`](file:///c:/Users/R.P.DHARANISHPURUSOH/ELO_Dashboard/src/components/SubsystemStatusBar.tsx) | Real-time dual telemetry for onboard AI engine and audio hardware pipelines. |
| **`TargetSelector`** | [`TargetSelector.tsx`](file:///c:/Users/R.P.DHARANISHPURUSOH/ELO_Dashboard/src/components/TargetSelector.tsx) | Visual person selector with distance, confidence scoring, and radio selection. |
| **`SafetyStatusCard`** | [`SafetyStatusCard.tsx`](file:///c:/Users/R.P.DHARANISHPURUSOH/ELO_Dashboard/src/components/SafetyStatusCard.tsx) | Obstacle avoidance monitor, safety lock indicator, and path clearance alert. |
| **`CommandButtons`** | [`CommandButtons.tsx`](file:///c:/Users/R.P.DHARANISHPURUSOH/ELO_Dashboard/src/components/CommandButtons.tsx) | Primary robotic control triggers (`FOLLOW`, `INTERACT`, `STOP`) with active indicators. |
| **`SessionTimeIndicator`** | [`SessionTimeIndicator.tsx`](file:///c:/Users/R.P.DHARANISHPURUSOH/ELO_Dashboard/src/components/SessionTimeIndicator.tsx) | Minimal progress bar indicating active interaction vs parental limit. |
| **`PrivacyCard`** | [`PrivacyCard.tsx`](file:///c:/Users/R.P.DHARANISHPURUSOH/ELO_Dashboard/src/components/PrivacyCard.tsx) | Quick toggles for microphone hardware muting and report exclusion. |
| **`ModeToggleButton`** | [`ModeToggleButton.tsx`](file:///c:/Users/R.P.DHARANISHPURUSOH/ELO_Dashboard/src/components/ModeToggleButton.tsx) | Backward-compatible two-state spring toggle for simplified robot mode toggling. |

---

## 6. API Layer, Protocol Contract & Data Schema

The communication protocol is implemented in [`src/api/client.ts`](file:///c:/Users/R.P.DHARANISHPURUSOH/ELO_Dashboard/src/api/client.ts) and types are codified in [`src/types/index.ts`](file:///c:/Users/R.P.DHARANISHPURUSOH/ELO_Dashboard/src/types/index.ts).

### Endpoint Contract Table

| Method | Endpoint | Description | Payload / Response |
| :--- | :--- | :--- | :--- |
| `GET` | `/health` | Hardware heartbeat & server check | `{ "status": "ok", "serverTime": string }` |
| `GET` | `/status` | Full telemetry of ELO robot state | `{ "online": boolean, "state": RobotMode, "target_id": string, "obstacle": boolean, "ai_connected": boolean, "audio_ready": boolean }` |
| `GET` | `/targets` | Vision list of detected persons | `{ "targets": [{ "id": string, "label": string, "confidence": number, "distance": number }] }` |
| `POST` | `/target` | Lock active tracking target | Body: `{ "target_id": string }` ➔ `{ "success": boolean, "target_id": string }` |
| `POST` | `/mode` | Transition mode (`FOLLOW`, `INTERACT`, `STOP`) | Body: `{ "mode": "FOLLOW" \| "INTERACT" \| "STOP" }` ➔ `{ "success": boolean, "state": string }` |
| `POST` | `/stop` | Emergency Stop (disengages motors) | Body: `{}` ➔ `{ "success": true, "state": "stopped" }` |
| `GET` | `/api/session/current`| Active session runtime vs limit | `{ "elapsedMinutes": number, "dailyLimitMinutes": number }` |
| `GET` | `/api/reports` | List of past session summaries | `SessionReportSummary[]` |
| `GET` | `/api/reports/:id` | Full session detail with dialogue | `SessionReportDetail` (includes `transcript: TranscriptItem[]`) |
| `GET` | `/api/restrictions` | Get daily limit configuration | `{ "dailyLimitMinutes": number }` |
| `POST` | `/api/restrictions` | Save daily limit configuration | Body: `{ "dailyLimitMinutes": number }` |
| `POST` | `/api/privacy/visibility`| Exclude session from report | Body: `{ "enabled": boolean }` ➔ `{ "enabled": boolean }` |
| `POST` | `/api/privacy/mute` | Mute microphone hardware | Body: `{ "enabled": boolean }` ➔ `{ "enabled": boolean }` |

---

## 7. State Management & Lifecycle Dynamics (`ELOContext`)

The complete global state of the application is encapsulated in [`ELOContext.tsx`](file:///c:/Users/R.P.DHARANISHPURUSOH/ELO_Dashboard/src/context/ELOContext.tsx).

### Key Lifecycle Mechanisms:
1. **Persistent Bootstrap:** On initial mount, `ELOProvider` retrieves the persisted Base URL from `@react-native-async-storage/async-storage`. If none is saved, it falls back to `EXPO_PUBLIC_ELO_CORE_URL` or `DEFAULT_ELO_CORE_URL`.
2. **Autonomous Polling Loop:**
   - Starts an unblocked `setInterval` running every 1500ms.
   - Employs an `isPollingBusyRef` mutex lock to guarantee requests never stack on slow networks.
   - Updates connection health metrics (`lastSuccessfulPoll`, `consecutiveFailures`, `isConnected`).
3. **Safety Guarded Commands:**
   - `requestFollow()` first validates that a valid target is selected. If no target exists, it immediately halts and surfaces a user-friendly error without executing an invalid network request.
   - `requestStop()` sends an immediate priority command to halt all physical motors.
4. **Command In-Flight Tracking:** All mutations expose `commandPending` strings (e.g., `'Requesting Follow...'`) allowing buttons to render spinners and disable redundant taps while the command is in flight.

---

## 8. Offline Testing & The Zero-Dependency Mock Server

To allow rapid UI development and testing without needing physical access to the Raspberry Pi robot, the project includes a built-in mock server located at [`mock-server/server.js`](file:///c:/Users/R.P.DHARANISHPURUSOH/ELO_Dashboard/mock-server/server.js).

### Features of the Mock Server:
* **Zero External Dependencies:** Built purely on Node.js standard `http` library.
* **Full Contract Simulation:** Implements all 13 REST endpoints, matching every response schema of the physical robot.
* **Simulated Vision Targets:** Emulates 3 tracked persons (`Person 1`, `Person 2`, `Person 3`) with realistic distances and confidence ratings.
* **Seeded Educational Reports:** Contains realistic sample reports with vocabulary lists, obstacle statistics, and complete multi-turn dialogue transcripts between ELO and a child.
* **Diagnostic Test Helpers:**
  - `POST /api/test/toggle-obstacle`: Simulates a sudden obstacle appearing 30cm ahead, forcing the robot into an automatic safety stop.
  - `POST /api/test/toggle-ai`: Simulates AI engine disconnects.
  - `POST /api/test/toggle-audio`: Simulates audio subsystem offline states.

To run the mock server:
```bash
npm run mock
```
It starts on port `8090`, allowing the app to run locally out of the box.

---

## 9. Security, Child Safety & Privacy Guarantees

Because this software governs an AI-driven robot interacting with children, the architecture implements specific safety and privacy invariants:

1. **Hardware-Level Mute Assurance:** Toggling `Mute microphone` in `PrivacyCard` sends an immediate hardware signal to stop audio ingestion. The UI highlights this in warning red: `"Tutoring disabled"`.
2. **Report Exclusion:** Parents can exclude intimate home conversations from persistent storage with a single switch.
3. **Automatic Obstacle Motor Inhibit:** The dashboard cannot override an active obstacle alert. If an obstacle is detected, `requestFollow()` is blocked by both the mobile client and the Pi's motor controller.
4. **Local Network Containment:** No audio data, video feeds, or child voice transcripts are ever transmitted to third-party cloud servers from this dashboard.

---

## 10. Maintenance, Deployment & Developer Onboarding Guide

### Quick Start Checklist for New Developers

1. **Clone & Install:**
   ```bash
   git clone <repo_url>
   cd ELO_Dashboard
   npm install
   ```

2. **Configure Environment:**
   Create `.env` based on `.env.example`:
   ```bash
   EXPO_PUBLIC_ELO_CORE_URL=http://<YOUR_PI_IP>:8090
   ```

3. **Start Development Environment:**
   - In terminal 1 (Optional mock backend):
     ```bash
     npm run mock
     ```
   - In terminal 2 (Expo application):
     ```bash
     npm start
     ```

4. **Verify on Target Platforms:**
   - Press `a` in the Expo CLI for Android.
   - Press `i` for iOS Simulator.
   - Press `w` for Web Browser preview.

### File Structure Map
```
ELO_Dashboard/
├── App.tsx                     # Top-level entry: Providers & NavigationContainer
├── app.json                    # Expo project configuration & metadata
├── mock-server/
│   └── server.js               # Zero-dependency Node.js mock API server (Port 8090)
├── src/
│   ├── api/
│   │   └── client.ts           # REST client, error handlers & data normalizers
│   ├── components/             # Reusable UI component library (10 components)
│   ├── context/
│   │   └── ELOContext.tsx      # Global React Context & 1500ms polling loop
│   ├── navigation/
│   │   ├── RootNavigator.tsx   # Bottom tab navigation (Control, Reports, Limits, Settings)
│   │   └── ReportsStackNavigator.tsx # Stack navigator for Reports list & detail
│   ├── screens/
│   │   ├── HomeScreen.tsx      # Main robot cockpit & telemetry
│   │   ├── ReportsScreen.tsx   # Session reports ledger
│   │   ├── ReportDetailScreen.tsx # Report detail & dialogue transcripts
│   │   ├── RestrictionsScreen.tsx # Parental time limits & preset controls
│   │   └── SettingsScreen.tsx  # Network config, latency test & setup guide
│   ├── theme/
│   │   ├── colors.ts           # Nothing-inspired dark monochrome color tokens
│   │   └── index.ts            # Theme exports
│   └── types/
│       └── index.ts            # TypeScript interfaces & navigation param types
```

---
*Document compiled and verified against the ELO Dashboard codebase.*
