/**
 * ELO Companion Robot - Mock Backend Server
 * Implements the core API endpoints + Phase C ELO Core Pi endpoints + Phase D camera/target geometry.
 * Pure Node.js (zero external dependencies).
 * Run: node mock-server/server.js [port] (default port: 8090)
 */

const http = require('http');
const PORT = process.env.PORT || process.argv[2] || 8090;

// In-memory robot state
let robotState = {
  mode: 'stopped',
  updatedAt: new Date().toISOString(),
};

let privacyState = {
  excludeFromReport: false,
  muteMicrophone: false,
};

let restrictionsState = {
  dailyLimitMinutes: 45,
};

let currentSession = {
  active: true,
  elapsedMinutes: 18,
};

// ─── Phase C: ELO Core State ───

let eloCore = {
  state: 'stopped',
  target_id: null,
  obstacle: false,
  obstacle_detail: null,
  ai_connected: true,
  audio_ready: true,
  audio_status: 'IDLE',
  display_connected: true,
  safety_locked: false,
};

let audioTimer = null;

// ─── Phase D: Camera state ───
let cameraState = {
  available: true,
  streaming: false,   // MJPEG stream not available in mock — triggers fallback
  width: 640,
  height: 480,        // Pi camera standard 4:3
  fps: 10,
  format: 'mjpeg',
  local_only: true,
};

// Minimal valid JPEG binary buffer for mock camera frame testing
const MOCK_JPEG_BUFFER = Buffer.from(
  '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
  'base64'
);

// ─── Phase D: Targets with bbox geometry ───
// bbox coordinates are normalized 0.0–1.0 relative to frame width/height
let availableTargets = [
  {
    id: 'person_1',
    label: 'Person 1',
    confidence: 0.92,
    distance: 2.1,
    tracking_state: 'tracked',
    bbox: { x: 0.15, y: 0.10, width: 0.22, height: 0.65 },
  },
  {
    id: 'person_2',
    label: 'Person 2',
    confidence: 0.87,
    distance: 3.5,
    tracking_state: 'tracked',
    bbox: { x: 0.55, y: 0.15, width: 0.20, height: 0.58 },
  },
  {
    id: 'person_3',
    label: 'Person 3',
    confidence: 0.74,
    distance: 5.0,
    tracking_state: 'tracked',
    bbox: { x: 0.75, y: 0.25, width: 0.18, height: 0.50 },
  },
];

// Seeded session reports (same as before)
let sessionReports = [
  {
    id: 'rep-101',
    date: new Date(Date.now() - 3600000 * 2).toISOString(),
    durationMinutes: 24,
    distanceFollowedMeters: 42.5,
    obstaclesAvoided: 7,
    questionsAsked: 4,
    vocabularyLearned: ['Photosynthesis', 'Chlorophyll', 'Ecosystem'],
    moodCheckIn: 'Curious and energetic',
    breathingExerciseCompleted: true,
    transcript: [
      { speaker: 'elo', text: "Hi Maya! Ready to explore today's science question?", timestamp: '11:02:10' },
      { speaker: 'child', text: 'Why are leaves green?', timestamp: '11:02:22' },
      { speaker: 'elo', text: "Great question! Leaves contain a special green helper called chlorophyll that catches sunlight to make food.", timestamp: '11:02:35' },
      { speaker: 'child', text: 'Like solar panels on houses?', timestamp: '11:03:00' },
      { speaker: 'elo', text: "Exactly like solar panels! That process is called photosynthesis.", timestamp: '11:03:15' },
      { speaker: 'child', text: "I want to take a breath break now.", timestamp: '11:15:30' },
      { speaker: 'elo', text: "Let's breathe together: inhale 1-2-3-4... and slow exhale 1-2-3-4.", timestamp: '11:15:45' }
    ]
  },
  {
    id: 'rep-102',
    date: new Date(Date.now() - 86400000 * 1).toISOString(),
    durationMinutes: 32,
    distanceFollowedMeters: 68.2,
    obstaclesAvoided: 12,
    questionsAsked: 6,
    vocabularyLearned: ['Constellation', 'Orion', 'Telescope'],
    moodCheckIn: 'Calm and focused',
    breathingExerciseCompleted: false,
    transcript: [
      { speaker: 'elo', text: "Look out for the chair leg! Turning smoothly now.", timestamp: '16:10:05' },
      { speaker: 'child', text: "Elo, what stars can we see tonight?", timestamp: '16:10:45' },
      { speaker: 'elo', text: "If the sky is clear, look for the three stars in Orion's belt! A constellation is a picture made of stars.", timestamp: '16:11:12' },
      { speaker: 'child', text: "My teacher showed us Orion in class!", timestamp: '16:12:00' }
    ]
  },
  {
    id: 'rep-103',
    date: new Date(Date.now() - 86400000 * 3).toISOString(),
    durationMinutes: 15,
    distanceFollowedMeters: 18.0,
    obstaclesAvoided: 3,
    questionsAsked: 2,
    vocabularyLearned: ['Empathy', 'Kindness'],
    moodCheckIn: 'Slightly frustrated at first, then happy',
    breathingExerciseCompleted: true,
    transcript: [
      { speaker: 'child', text: "I didn't get picked for team captain today.", timestamp: '14:20:00' },
      { speaker: 'elo', text: "That can feel really disappointing. It's okay to feel that way. Want to do a balloon breathing exercise with me?", timestamp: '14:20:18' },
      { speaker: 'child', text: "Okay...", timestamp: '14:20:30' },
      { speaker: 'elo', text: "Pretend your belly is a big gentle balloon. Deep breath in... and blow it all away.", timestamp: '14:20:45' },
      { speaker: 'child', text: "I feel a little better now. Let's play math trivia!", timestamp: '14:25:00' }
    ]
  }
];

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function sendJson(res, statusCode, data) {
  setCors(res);
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        resolve(!body.trim() ? {} : JSON.parse(body));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

// Simulate bbox positions drifting slightly each poll (realistic)
let targetDriftAngle = 0;
function getTargetsWithDrift() {
  targetDriftAngle += 0.03;
  return availableTargets.map((t, i) => {
    if (!t.bbox) return t;
    const drift = Math.sin(targetDriftAngle + i * 1.2) * 0.01;
    return {
      ...t,
      bbox: {
        ...t.bbox,
        x: Math.max(0, Math.min(0.85, t.bbox.x + drift)),
      },
      distance: parseFloat((t.distance + Math.sin(targetDriftAngle + i) * 0.05).toFixed(2)),
    };
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;
  const method = req.method;

  if (method === 'OPTIONS') {
    setCors(res);
    res.writeHead(204);
    res.end();
    return;
  }

  try {
    // ─── Health ───
    if (method === 'GET' && (pathname === '/health' || pathname === '/api/health')) {
      return sendJson(res, 200, { status: 'ok', serverTime: new Date().toISOString() });
    }

    // ─── Legacy state endpoints ───
    if (method === 'GET' && pathname === '/api/state') {
      return sendJson(res, 200, robotState);
    }

    if (method === 'POST' && pathname === '/api/mode') {
      const body = await parseJsonBody(req);
      if (body.mode === 'moving' || body.mode === 'interacting') {
        robotState.mode = body.mode;
        robotState.updatedAt = new Date().toISOString();
        return sendJson(res, 200, { mode: robotState.mode });
      }
      return sendJson(res, 400, { error: 'Invalid mode.' });
    }

    // ─── Session ───
    if (method === 'GET' && pathname === '/api/session/current') {
      if (!currentSession.active) {
        return sendJson(res, 404, { error: 'No active session' });
      }
      return sendJson(res, 200, {
        elapsedMinutes: currentSession.elapsedMinutes,
        dailyLimitMinutes: restrictionsState.dailyLimitMinutes,
      });
    }

    // ─── Reports ───
    if (method === 'GET' && pathname === '/api/reports') {
      const limit = parseInt(url.searchParams.get('limit') || '10', 10);
      const summaries = sessionReports.slice(0, limit).map(({ transcript, ...summary }) => summary);
      return sendJson(res, 200, summaries);
    }

    if (method === 'GET' && pathname.startsWith('/api/reports/')) {
      const id = pathname.replace('/api/reports/', '');
      const report = sessionReports.find(r => r.id === id);
      if (!report) return sendJson(res, 404, { error: 'Report not found' });
      return sendJson(res, 200, report);
    }

    // ─── Restrictions ───
    if (method === 'GET' && pathname === '/api/restrictions') {
      return sendJson(res, 200, { dailyLimitMinutes: restrictionsState.dailyLimitMinutes });
    }

    if (method === 'POST' && pathname === '/api/restrictions') {
      const body = await parseJsonBody(req);
      if (typeof body.dailyLimitMinutes === 'number' && body.dailyLimitMinutes >= 0) {
        restrictionsState.dailyLimitMinutes = body.dailyLimitMinutes;
        return sendJson(res, 200, { dailyLimitMinutes: restrictionsState.dailyLimitMinutes });
      }
      return sendJson(res, 400, { error: 'dailyLimitMinutes must be a non-negative number' });
    }

    // ─── Privacy ───
    if (method === 'POST' && pathname === '/api/privacy/visibility') {
      const body = await parseJsonBody(req);
      if (typeof body.enabled === 'boolean') {
        privacyState.excludeFromReport = body.enabled;
        return sendJson(res, 200, { enabled: privacyState.excludeFromReport });
      }
      return sendJson(res, 400, { error: 'enabled must be a boolean' });
    }

    if (method === 'POST' && pathname === '/api/privacy/mute') {
      const body = await parseJsonBody(req);
      if (typeof body.enabled === 'boolean') {
        privacyState.muteMicrophone = body.enabled;
        return sendJson(res, 200, { enabled: privacyState.muteMicrophone });
      }
      return sendJson(res, 400, { error: 'enabled must be a boolean' });
    }

    // ─── ELO Core Pi Endpoints ───

    if (method === 'GET' && (pathname === '/status' || pathname === '/api/elo/status')) {
      return sendJson(res, 200, {
        online: true,
        state: eloCore.state,
        mode: eloCore.state === 'moving' ? 'FOLLOW' : eloCore.state === 'interacting' ? 'INTERACT' : 'STOP',
        target_id: eloCore.target_id,
        obstacle: eloCore.obstacle,
        obstacle_detail: eloCore.obstacle_detail,
        safety_locked: eloCore.safety_locked,
        ai_connected: eloCore.ai_connected,
        audio_ready: eloCore.audio_ready,
        audio_status: eloCore.audio_status || (eloCore.audio_ready ? 'IDLE' : 'OFFLINE'),
        display_connected: eloCore.display_connected,
        last_error: null,
        server_time: new Date().toISOString(),
      });
    }

    if (method === 'GET' && (pathname === '/targets' || pathname === '/api/elo/targets')) {
      return sendJson(res, 200, {
        timestamp: new Date().toISOString(),
        frame_width: 640,
        frame_height: 360,
        targets: getTargetsWithDrift(),
      });
    }

    if (method === 'POST' && (pathname === '/target' || pathname === '/api/elo/target')) {
      const body = await parseJsonBody(req);
      const targetId = body.target_id;
      if (!targetId) {
        return sendJson(res, 400, { success: false, error: 'target_id is required' });
      }
      const found = availableTargets.find(t => t.id === targetId);
      if (!found) {
        return sendJson(res, 400, {
          success: false,
          target_id: null,
          error: { code: 'TARGET_NOT_FOUND', message: 'Target is no longer available.' }
        });
      }
      eloCore.target_id = targetId;
      console.log(`[ELO Phase D] Target locked: ${targetId} (${found.label})`);
      return sendJson(res, 200, { success: true, target_id: targetId });
    }

    if (method === 'POST' && (pathname === '/mode' || pathname === '/api/elo/mode')) {
      const body = await parseJsonBody(req);
      const mode = (body.mode || '').toUpperCase();

      if (mode === 'FOLLOW') {
        if (!eloCore.target_id) {
          return sendJson(res, 400, { success: false, error: 'No target selected. Select a target first.' });
        }
        if (!availableTargets.find(t => t.id === eloCore.target_id)) {
          return sendJson(res, 400, { success: false, error: 'Selected target is no longer available.' });
        }
        if (eloCore.obstacle) {
          return sendJson(res, 400, { success: false, error: 'Movement blocked — obstacle detected.', state: 'stopped' });
        }
        eloCore.state = 'moving';
        console.log(`[ELO Phase D] Mode → FOLLOW (target: ${eloCore.target_id})`);
        return sendJson(res, 200, { success: true, state: 'moving' });
      }

      if (mode === 'INTERACT') {
        eloCore.state = 'interacting';
        eloCore.audio_status = 'IDLE';
        if (audioTimer) clearTimeout(audioTimer);
        console.log(`[ELO Phase D] Mode → INTERACT (audio=IDLE)`);
        return sendJson(res, 200, { success: true, state: 'interacting' });
      }

      if (mode === 'STOP') {
        eloCore.state = 'stopped';
        eloCore.audio_status = 'IDLE';
        if (audioTimer) clearTimeout(audioTimer);
        console.log(`[ELO Phase D] Mode → STOP`);
        return sendJson(res, 200, { success: true, state: 'stopped' });
      }

      return sendJson(res, 400, { success: false, error: 'Invalid mode.' });
    }

    if (method === 'POST' && (pathname === '/stop' || pathname === '/api/elo/stop')) {
      eloCore.state = 'stopped';
      eloCore.audio_status = 'IDLE';
      if (audioTimer) clearTimeout(audioTimer);
      console.log(`[ELO Phase D] EMERGENCY STOP`);
      return sendJson(res, 200, { success: true, state: 'stopped' });
    }

    // ─── Audio endpoints ───
    if (method === 'GET' && pathname === '/audio/status') {
      const isSpeaking = eloCore.audio_status === 'SPEAKING';
      const isProcessing = eloCore.audio_status === 'PROCESSING' || eloCore.audio_status === 'THINKING';
      const isRecording = eloCore.audio_status === 'RECORDING';
      return sendJson(res, 200, {
        ready: eloCore.audio_ready,
        status: eloCore.audio_status || 'IDLE',
        recording: isRecording,
        processing: isProcessing,
        speaking: isSpeaking,
        active: isRecording || isSpeaking || isProcessing,
      });
    }
    if (method === 'POST' && pathname === '/audio/start') {
      if (audioTimer) clearTimeout(audioTimer);
      eloCore.audio_status = 'RECORDING';
      console.log('[Mock Pi] Audio recording started (status=RECORDING)');
      return sendJson(res, 200, { success: true, status: 'RECORDING' });
    }
    if (method === 'POST' && pathname === '/audio/stop') {
      if (audioTimer) clearTimeout(audioTimer);
      eloCore.audio_status = 'PROCESSING';
      console.log('[Mock Pi] Audio recording stopped -> status=PROCESSING (THINKING)');
      audioTimer = setTimeout(() => {
        eloCore.audio_status = 'SPEAKING';
        console.log('[Mock Pi] Pi speech synthesis started -> status=SPEAKING');
        audioTimer = setTimeout(() => {
          eloCore.audio_status = 'IDLE';
          console.log('[Mock Pi] Speech playback completed -> status=IDLE');
        }, 3500);
      }, 1500);
      return sendJson(res, 200, { success: true, status: 'PROCESSING' });
    }

    // ─── Interaction endpoints ───
    if (method === 'POST' && pathname === '/interaction/start') {
      eloCore.state = 'interacting';
      eloCore.audio_status = 'IDLE';
      if (audioTimer) clearTimeout(audioTimer);
      console.log('[Mock Pi] Interaction session started (mode=INTERACT, audio=IDLE)');
      return sendJson(res, 200, { success: true, state: 'interacting' });
    }
    if (method === 'POST' && pathname === '/interaction/end') {
      eloCore.state = 'stopped';
      eloCore.audio_status = 'OFF';
      if (audioTimer) clearTimeout(audioTimer);
      console.log('[Mock Pi] Interaction session ended (mode=STOP, audio=OFF)');
      return sendJson(res, 200, { success: true, state: 'stopped' });
    }

    // ─── Phase D: Camera endpoints ───

    if (method === 'GET' && pathname === '/camera/status') {
      return sendJson(res, 200, cameraState);
    }

    // MJPEG stream — not available in mock (returns 503)
    // This triggers the dashboard's fallback to /camera/frame polling
    if (method === 'GET' && pathname === '/camera/stream') {
      setCors(res);
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Stream not available in mock server. Use /camera/frame.' }));
      return;
    }

    // Single JPEG frame — returns real JPEG bytes
    if ((method === 'GET' || method === 'HEAD') && pathname === '/camera/frame') {
      setCors(res);
      res.writeHead(200, {
        'Content-Type': 'image/jpeg',
        'Content-Length': MOCK_JPEG_BUFFER.length,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Access-Control-Allow-Origin': '*',
      });
      if (method === 'HEAD') {
        res.end();
        return;
      }
      res.end(MOCK_JPEG_BUFFER);
      return;
    }

    // ─── Test helpers ───

    if (method === 'POST' && pathname === '/api/test/toggle-obstacle') {
      eloCore.obstacle = !eloCore.obstacle;
      eloCore.obstacle_detail = eloCore.obstacle ? 'Object detected 30cm ahead' : null;
      if (eloCore.obstacle && eloCore.state === 'moving') {
        eloCore.state = 'stopped';
        console.log(`[ELO Phase D] Obstacle detected — auto-stopped`);
      }
      console.log(`[ELO Phase D] Obstacle: ${eloCore.obstacle}`);
      return sendJson(res, 200, { obstacle: eloCore.obstacle, state: eloCore.state });
    }

    if (method === 'POST' && pathname === '/api/test/toggle-ai') {
      eloCore.ai_connected = !eloCore.ai_connected;
      console.log(`[ELO Phase D] AI connected: ${eloCore.ai_connected}`);
      return sendJson(res, 200, { ai_connected: eloCore.ai_connected });
    }

    if (method === 'POST' && pathname === '/api/test/toggle-audio') {
      eloCore.audio_ready = !eloCore.audio_ready;
      console.log(`[ELO Phase D] Audio ready: ${eloCore.audio_ready}`);
      return sendJson(res, 200, { audio_ready: eloCore.audio_ready });
    }

    if (method === 'POST' && pathname === '/api/test/toggle-session') {
      currentSession.active = !currentSession.active;
      return sendJson(res, 200, { sessionActive: currentSession.active });
    }

    if (method === 'POST' && pathname === '/api/test/toggle-camera') {
      cameraState.available = !cameraState.available;
      console.log(`[ELO Phase D] Camera available: ${cameraState.available}`);
      return sendJson(res, 200, { available: cameraState.available });
    }

    if (method === 'POST' && pathname === '/api/test/toggle-display') {
      eloCore.display_connected = !eloCore.display_connected;
      console.log(`[ELO Phase D] Display connected: ${eloCore.display_connected}`);
      return sendJson(res, 200, { display_connected: eloCore.display_connected });
    }

    // Set tracking state for a specific target (for testing target lost/reacquired flow)
    if (method === 'POST' && pathname === '/api/test/set-tracking-state') {
      const body = await parseJsonBody(req);
      const { target_id, tracking_state } = body;
      const target = availableTargets.find(t => t.id === target_id);
      if (!target) return sendJson(res, 404, { error: 'Target not found' });
      target.tracking_state = tracking_state;
      console.log(`[ELO Phase D] Target ${target_id} tracking_state → ${tracking_state}`);
      return sendJson(res, 200, { target_id, tracking_state });
    }

    // Remove/restore a target from the vision list (for testing target lost/reacquired)
    if (method === 'POST' && pathname === '/api/test/remove-target') {
      const body = await parseJsonBody(req);
      const { target_id } = body;
      availableTargets = availableTargets.filter(t => t.id !== target_id);
      if (eloCore.target_id === target_id) {
        eloCore.target_id = null;
      }
      console.log(`[ELO Phase D] Target removed: ${target_id}`);
      return sendJson(res, 200, { removed: target_id, remaining: availableTargets.length });
    }

    if (method === 'POST' && pathname === '/api/test/restore-targets') {
      availableTargets = [
        { id: 'person_1', label: 'Person 1', confidence: 0.92, distance: 2.1, tracking_state: 'tracked', bbox: { x: 0.15, y: 0.10, width: 0.22, height: 0.65 } },
        { id: 'person_2', label: 'Person 2', confidence: 0.87, distance: 3.5, tracking_state: 'tracked', bbox: { x: 0.55, y: 0.15, width: 0.20, height: 0.58 } },
        { id: 'person_3', label: 'Person 3', confidence: 0.74, distance: 5.0, tracking_state: 'tracked', bbox: { x: 0.75, y: 0.25, width: 0.18, height: 0.50 } },
      ];
      console.log(`[ELO Phase D] Targets restored to default`);
      return sendJson(res, 200, { targets: availableTargets.length });
    }

    return sendJson(res, 404, { error: 'Endpoint not found' });
  } catch (error) {
    console.error('[ELO Mock Server Error]', error);
    return sendJson(res, 500, { error: 'Internal Server Error' });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`
===================================================
  🤖 ELO Mock Backend Server — Phase D
  Local URL:   http://localhost:${PORT}
  Network URL: http://0.0.0.0:${PORT}

  Pi Core Endpoints:
    GET  /health                 — Connection & health check
    GET  /status                 — Robot state, target, obstacles, AI & audio
    GET  /targets                — Vision detected people with bbox geometry
    POST /target                 — Parent locks tracking target
    POST /mode                   — Set mode (FOLLOW, INTERACT, STOP)
    POST /stop                   — Emergency stop
    GET  /audio/status           — Audio subsystem status
    POST /audio/start            — Start audio
    POST /audio/stop             — Stop audio
    POST /interaction/start      — Start interaction
    POST /interaction/end        — End interaction

  Phase D: Camera Endpoints:
    GET  /camera/status          — Camera subsystem status
    GET  /camera/stream          — MJPEG stream (503 in mock — triggers fallback)
    GET  /camera/frame           — Single JPEG frame (SVG placeholder in mock)

  Test Helpers:
    POST /api/test/toggle-obstacle        — Toggle simulated obstacle
    POST /api/test/toggle-ai             — Toggle AI connection
    POST /api/test/toggle-audio          — Toggle audio
    POST /api/test/toggle-session        — Toggle active session
    POST /api/test/toggle-camera         — Toggle camera availability
    POST /api/test/toggle-display        — Toggle display connection
    POST /api/test/set-tracking-state    — Body: { target_id, tracking_state }
    POST /api/test/remove-target         — Body: { target_id }
    POST /api/test/restore-targets       — Restore all 3 default targets
===================================================
`);
});
