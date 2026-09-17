/**
 * ELO Companion Robot - Mock Backend Server
 * Implements the 8 original API endpoints + Phase C ELO Core Pi endpoints.
 * Pure Node.js (zero external dependencies).
 * Run: node mock-server/server.js [port] (default port: 8000)
 */

const http = require('http');
const PORT = process.env.PORT || process.argv[2] || 8090;

// In-memory robot state (original)
let robotState = {
  mode: 'moving', // 'moving' | 'interacting'
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
  state: 'stopped',          // 'moving' | 'interacting' | 'stopped' | 'unknown'
  target_id: null,           // currently selected target
  obstacle: false,
  obstacle_detail: null,
  ai_connected: true,
  audio_ready: true,
};

let availableTargets = [
  { id: 'person_1', label: 'Person 1', confidence: 0.92, distance: 2.1 },
  { id: 'person_2', label: 'Person 2', confidence: 0.87, distance: 3.5 },
  { id: 'person_3', label: 'Person 3', confidence: 0.74, distance: 5.0 },
];

// Seeded session reports
let sessionReports = [
  {
    id: 'rep-101',
    date: new Date(Date.now() - 3600000 * 2).toISOString(), // 2 hours ago
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
    date: new Date(Date.now() - 86400000 * 1).toISOString(), // Yesterday
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
    date: new Date(Date.now() - 86400000 * 3).toISOString(), // 3 days ago
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
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        if (!body.trim()) {
          resolve({});
        } else {
          resolve(JSON.parse(body));
        }
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;
  const method = req.method;

  // Handle CORS preflight
  if (method === 'OPTIONS') {
    setCors(res);
    res.writeHead(204);
    res.end();
    return;
  }

  try {
    // 1. GET /health or /api/health
    if (method === 'GET' && (pathname === '/health' || pathname === '/api/health')) {
      return sendJson(res, 200, { status: 'ok', serverTime: new Date().toISOString() });
    }

    // 2. GET /api/state
    if (method === 'GET' && pathname === '/api/state') {
      return sendJson(res, 200, robotState);
    }

    // 3. POST /api/mode
    if (method === 'POST' && pathname === '/api/mode') {
      const body = await parseJsonBody(req);
      if (body.mode === 'moving' || body.mode === 'interacting') {
        robotState.mode = body.mode;
        robotState.updatedAt = new Date().toISOString();
        console.log(`[ELO Mock] Mode switched to: ${body.mode}`);
        return sendJson(res, 200, { mode: robotState.mode });
      } else {
        return sendJson(res, 400, { error: 'Invalid mode. Must be "moving" or "interacting".' });
      }
    }

    // 4. GET /api/session/current
    if (method === 'GET' && pathname === '/api/session/current') {
      if (!currentSession.active) {
        return sendJson(res, 404, { error: 'No active session' });
      }
      return sendJson(res, 200, {
        elapsedMinutes: currentSession.elapsedMinutes,
        dailyLimitMinutes: restrictionsState.dailyLimitMinutes,
      });
    }

    // 5. GET /api/reports
    if (method === 'GET' && pathname === '/api/reports') {
      const limit = parseInt(url.searchParams.get('limit') || '10', 10);
      const summaries = sessionReports.slice(0, limit).map(rep => {
        const { transcript, ...summary } = rep;
        return summary;
      });
      return sendJson(res, 200, summaries);
    }

    // 6. GET /api/reports/:id
    if (method === 'GET' && pathname.startsWith('/api/reports/')) {
      const id = pathname.replace('/api/reports/', '');
      const report = sessionReports.find(r => r.id === id);
      if (!report) {
        return sendJson(res, 404, { error: 'Report not found' });
      }
      return sendJson(res, 200, report);
    }

    // 7. GET /api/restrictions
    if (method === 'GET' && pathname === '/api/restrictions') {
      return sendJson(res, 200, { dailyLimitMinutes: restrictionsState.dailyLimitMinutes });
    }

    // 8. POST /api/restrictions
    if (method === 'POST' && pathname === '/api/restrictions') {
      const body = await parseJsonBody(req);
      if (typeof body.dailyLimitMinutes === 'number' && body.dailyLimitMinutes >= 0) {
        restrictionsState.dailyLimitMinutes = body.dailyLimitMinutes;
        console.log(`[ELO Mock] Daily limit updated to: ${restrictionsState.dailyLimitMinutes} minutes`);
        return sendJson(res, 200, { dailyLimitMinutes: restrictionsState.dailyLimitMinutes });
      } else {
        return sendJson(res, 400, { error: 'dailyLimitMinutes must be a non-negative number' });
      }
    }

    // 9. POST /api/privacy/visibility
    if (method === 'POST' && pathname === '/api/privacy/visibility') {
      const body = await parseJsonBody(req);
      if (typeof body.enabled === 'boolean') {
        privacyState.excludeFromReport = body.enabled;
        console.log(`[ELO Mock] Privacy: Exclude session from report = ${body.enabled}`);
        return sendJson(res, 200, { enabled: privacyState.excludeFromReport });
      } else {
        return sendJson(res, 400, { error: 'enabled must be a boolean' });
      }
    }

    // 10. POST /api/privacy/mute
    if (method === 'POST' && pathname === '/api/privacy/mute') {
      const body = await parseJsonBody(req);
      if (typeof body.enabled === 'boolean') {
        privacyState.muteMicrophone = body.enabled;
        console.log(`[ELO Mock] Privacy: Mute microphone = ${body.enabled}`);
        return sendJson(res, 200, { enabled: privacyState.muteMicrophone });
      } else {
        return sendJson(res, 400, { error: 'enabled must be a boolean' });
      }
    }

    // Helper: simulate session toggle for testing
    if (method === 'POST' && pathname === '/api/test/toggle-session') {
      currentSession.active = !currentSession.active;
      return sendJson(res, 200, { sessionActive: currentSession.active });
    }

    // ─── Phase C: ELO Core Pi Endpoints ───

    // GET /status or /api/elo/status — Full ELO status
    if (method === 'GET' && (pathname === '/status' || pathname === '/api/elo/status')) {
      return sendJson(res, 200, {
        online: true,
        state: eloCore.state,
        target_id: eloCore.target_id,
        obstacle: eloCore.obstacle,
        obstacle_detail: eloCore.obstacle_detail,
        ai_connected: eloCore.ai_connected,
        audio_ready: eloCore.audio_ready,
        last_updated: new Date().toISOString(),
      });
    }

    // GET /targets or /api/elo/targets — Available tracked people
    if (method === 'GET' && (pathname === '/targets' || pathname === '/api/elo/targets')) {
      return sendJson(res, 200, { targets: availableTargets });
    }

    // POST /target or /api/elo/target — Parent selects target
    if (method === 'POST' && (pathname === '/target' || pathname === '/api/elo/target')) {
      const body = await parseJsonBody(req);
      const targetId = body.target_id;
      if (!targetId) {
        return sendJson(res, 400, { success: false, error: 'target_id is required' });
      }
      const found = availableTargets.find(t => t.id === targetId);
      if (!found) {
        return sendJson(res, 400, { success: false, error: `Target "${targetId}" not found in tracked list` });
      }
      eloCore.target_id = targetId;
      console.log(`[ELO Phase C] Target selected: ${targetId} (${found.label})`);
      return sendJson(res, 200, { success: true, target_id: targetId });
    }

    // POST /mode or /api/elo/mode — FOLLOW or INTERACT
    if (method === 'POST' && (pathname === '/mode' || pathname === '/api/elo/mode')) {
      const body = await parseJsonBody(req);
      const mode = (body.mode || '').toUpperCase();

      if (mode === 'FOLLOW') {
        // Validate: must have a valid target selected
        if (!eloCore.target_id) {
          return sendJson(res, 400, { success: false, error: 'No target selected. Select a target first.' });
        }
        const targetExists = availableTargets.find(t => t.id === eloCore.target_id);
        if (!targetExists) {
          return sendJson(res, 400, { success: false, error: 'Selected target is no longer available.' });
        }
        // Check obstacle
        if (eloCore.obstacle) {
          return sendJson(res, 400, { success: false, error: 'Movement blocked — obstacle detected.', state: 'stopped' });
        }
        eloCore.state = 'moving';
        console.log(`[ELO Phase C] Mode → FOLLOW (target: ${eloCore.target_id})`);
        return sendJson(res, 200, { success: true, state: 'moving' });
      }

      if (mode === 'INTERACT') {
        eloCore.state = 'interacting';
        console.log(`[ELO Phase C] Mode → INTERACT`);
        return sendJson(res, 200, { success: true, state: 'interacting' });
      }

      if (mode === 'STOP') {
        eloCore.state = 'stopped';
        console.log(`[ELO Phase C] Mode → STOP`);
        return sendJson(res, 200, { success: true, state: 'stopped' });
      }

      return sendJson(res, 400, { success: false, error: 'Invalid mode. Must be "FOLLOW", "INTERACT", or "STOP".' });
    }

    // POST /stop or /api/elo/stop — Emergency stop
    if (method === 'POST' && (pathname === '/stop' || pathname === '/api/elo/stop')) {
      eloCore.state = 'stopped';
      console.log(`[ELO Phase C] EMERGENCY STOP`);
      return sendJson(res, 200, { success: true, state: 'stopped' });
    }

    // GET /audio/status
    if (method === 'GET' && pathname === '/audio/status') {
      return sendJson(res, 200, { ready: eloCore.audio_ready, active: false });
    }

    // POST /audio/start
    if (method === 'POST' && pathname === '/audio/start') {
      return sendJson(res, 200, { success: true });
    }

    // POST /audio/stop
    if (method === 'POST' && pathname === '/audio/stop') {
      return sendJson(res, 200, { success: true });
    }

    // POST /interaction/start
    if (method === 'POST' && pathname === '/interaction/start') {
      return sendJson(res, 200, { success: true });
    }

    // POST /interaction/end
    if (method === 'POST' && pathname === '/interaction/end') {
      return sendJson(res, 200, { success: true });
    }

    // ─── Phase C: Test helpers ───

    // POST /api/test/toggle-obstacle — Toggle simulated obstacle
    if (method === 'POST' && pathname === '/api/test/toggle-obstacle') {
      eloCore.obstacle = !eloCore.obstacle;
      eloCore.obstacle_detail = eloCore.obstacle ? 'Object detected 30cm ahead' : null;
      if (eloCore.obstacle && eloCore.state === 'moving') {
        eloCore.state = 'stopped';
        console.log(`[ELO Phase C] Obstacle detected — auto-stopped`);
      }
      console.log(`[ELO Phase C] Obstacle: ${eloCore.obstacle}`);
      return sendJson(res, 200, { obstacle: eloCore.obstacle, state: eloCore.state });
    }

    // POST /api/test/toggle-ai — Toggle AI connection
    if (method === 'POST' && pathname === '/api/test/toggle-ai') {
      eloCore.ai_connected = !eloCore.ai_connected;
      console.log(`[ELO Phase C] AI connected: ${eloCore.ai_connected}`);
      return sendJson(res, 200, { ai_connected: eloCore.ai_connected });
    }

    // POST /api/test/toggle-audio — Toggle audio
    if (method === 'POST' && pathname === '/api/test/toggle-audio') {
      eloCore.audio_ready = !eloCore.audio_ready;
      console.log(`[ELO Phase C] Audio ready: ${eloCore.audio_ready}`);
      return sendJson(res, 200, { audio_ready: eloCore.audio_ready });
    }

    // Route not found
    return sendJson(res, 404, { error: 'Endpoint not found' });
  } catch (error) {
    console.error('[ELO Mock Server Error]', error);
    return sendJson(res, 500, { error: 'Internal Server Error' });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`
===================================================
  🤖 ELO Mock Backend Server Running!
  Local URL:   http://localhost:${PORT}
  Network URL: http://0.0.0.0:${PORT}
  Contract:    Raspberry Pi ELO Core HTTP API (Port 8090 / configurable)

  Pi Core Endpoints:
    GET  /health            — Connection & health check
    GET  /status            — Robot state, target, obstacles, AI & audio
    GET  /targets           — Vision detected trackable persons
    POST /target            — Parent selects tracking target
    POST /mode              — Set mode (FOLLOW, INTERACT, STOP)
    POST /stop              — Emergency stop
    GET  /audio/status      — Audio subsystem status
    POST /audio/start       — Start audio
    POST /audio/stop        — Stop audio
    POST /interaction/start — Start interaction
    POST /interaction/end   — End interaction

  Test Helpers:
    POST /api/test/toggle-obstacle
    POST /api/test/toggle-ai
    POST /api/test/toggle-audio
    POST /api/test/toggle-session
===================================================
`);
});

