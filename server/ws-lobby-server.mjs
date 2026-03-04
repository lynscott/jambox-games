import { createServer } from 'node:http';
import { Buffer } from 'node:buffer';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { WebSocketServer } from 'ws';

function loadDotEnvFile(filename) {
  const path = resolve(process.cwd(), filename);
  if (!existsSync(path)) {
    return;
  }

  const contents = readFileSync(path, 'utf8');
  for (const line of contents.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, '');
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadDotEnvFile('.env');
loadDotEnvFile('.env.local');

const port = Number(process.env.PORT || 8080);
const openAiApiKey = process.env.OPENAI_API_KEY || '';
const transcriptionModel = process.env.OPENAI_TRANSCRIPTION_MODEL || 'gpt-4o-mini-transcribe';

/** @type {Map<string, { code: string; hostClientId: string; roomCodes: Set<string> }>} */
const lobbies = new Map();
/** @type {Map<string, { code: string; lobbyCode: string; name: string; phoneClientIds: Set<string> }>} */
const rooms = new Map();
/** @type {Map<import('ws').WebSocket, { id: string; role: 'host'|'phone'|null; lobbyCode: string | null; roomCode: string | null; phoneName: string | null; playerSlot: 1 | 2 | null }>} */
const clients = new Map();

function setCorsHeaders(response) {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

async function readJsonBody(request) {
  const chunks = [];

  for await (const chunk of request) {
    chunks.push(chunk);
  }

  if (chunks.length === 0) {
    return {};
  }

  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

async function handleTranscriptionRequest(request, response) {
  if (!openAiApiKey) {
    response.writeHead(500, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ error: 'OPENAI_API_KEY is not configured on the server.' }));
    return;
  }

  let payload;
  try {
    payload = await readJsonBody(request);
  } catch {
    response.writeHead(400, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ error: 'Malformed JSON body.' }));
    return;
  }

  const audioBase64 = String(payload.audioBase64 || '');
  const mimeType = String(payload.mimeType || 'audio/webm');
  const prompt = String(payload.prompt || '').trim();

  if (!audioBase64) {
    response.writeHead(400, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ error: 'audioBase64 is required.' }));
    return;
  }

  try {
    const audioBuffer = Buffer.from(audioBase64, 'base64');
    const extension = mimeType.includes('ogg')
      ? 'ogg'
      : mimeType.includes('mp4')
        ? 'mp4'
        : mimeType.includes('wav')
          ? 'wav'
          : 'webm';
    const formData = new FormData();
    formData.append(
      'file',
      new Blob([audioBuffer], { type: mimeType }),
      `speech.${extension}`,
    );
    formData.append('model', transcriptionModel);
    formData.append('language', 'en');
    formData.append('response_format', 'json');
    if (prompt) {
      formData.append('prompt', prompt);
    }

    const upstream = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openAiApiKey}`,
      },
      body: formData,
    });

    const result = await upstream.json().catch(() => null);
    if (!upstream.ok) {
      response.writeHead(upstream.status, { 'Content-Type': 'application/json' });
      response.end(
        JSON.stringify({
          error: result?.error?.message || 'Transcription request failed.',
        }),
      );
      return;
    }

    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(
      JSON.stringify({
        text: typeof result?.text === 'string' ? result.text : '',
      }),
    );
  } catch {
    response.writeHead(500, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ error: 'Transcription proxy failed.' }));
  }
}

const server = createServer((request, response) => {
  setCorsHeaders(response);

  if (request.method === 'OPTIONS') {
    response.writeHead(204);
    response.end();
    return;
  }

  if (request.method === 'GET' && request.url === '/health') {
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ ok: true }));
    return;
  }

  if (request.method === 'POST' && request.url === '/api/transcribe') {
    void handleTranscriptionRequest(request, response);
    return;
  }

  response.writeHead(404, { 'Content-Type': 'application/json' });
  response.end(JSON.stringify({ error: 'Not found' }));
});

const wss = new WebSocketServer({ server });

function randomCode(size, alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789') {
  let code = '';
  for (let i = 0; i < size; i += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

function uniqueCode(size, usedSet, alphabet) {
  for (let attempt = 0; attempt < 10_000; attempt += 1) {
    const next = randomCode(size, alphabet);
    if (!usedSet.has(next)) {
      return next;
    }
  }
  throw new Error('Unable to generate unique code');
}

function send(ws, payload) {
  if (ws.readyState !== 1) {
    return;
  }
  ws.send(JSON.stringify(payload));
}

function createAccessPoint(lobbyCode) {
  const roomCode = uniqueCode(4, new Set(rooms.keys()));

  rooms.set(roomCode, {
    code: roomCode,
    lobbyCode,
    name: 'Lobby Access',
    phoneClientIds: new Set(),
  });

  return roomCode;
}

function roomSnapshot(room) {
  return {
    code: room.code,
    name: room.name,
    phoneCount: room.phoneClientIds.size,
    phones: [...room.phoneClientIds]
      .map((clientId) => [...clients.values()].find((entry) => entry.id === clientId)?.phoneName || 'Phone')
      .filter(Boolean),
  };
}

function lobbySnapshot(lobby) {
  return {
    code: lobby.code,
    rooms: [...lobby.roomCodes]
      .map((roomCode) => rooms.get(roomCode))
      .filter(Boolean)
      .map((room) => roomSnapshot(room)),
  };
}

function broadcastLobby(lobbyCode) {
  const lobby = lobbies.get(lobbyCode);
  if (!lobby) {
    return;
  }

  const snapshot = lobbySnapshot(lobby);

  for (const [ws, state] of clients.entries()) {
    if (state.lobbyCode === lobbyCode) {
      send(ws, { type: 'lobby_state', lobby: snapshot });
    }
  }
}

function cleanupClient(ws) {
  const state = clients.get(ws);
  if (!state) {
    return;
  }

  if (state.roomCode) {
    const room = rooms.get(state.roomCode);
    room?.phoneClientIds.delete(state.id);
  }

  if (state.role === 'host' && state.lobbyCode) {
    const lobby = lobbies.get(state.lobbyCode);
    if (lobby?.hostClientId === state.id) {
      for (const roomCode of lobby.roomCodes) {
        rooms.delete(roomCode);
      }
      lobbies.delete(state.lobbyCode);
    }
  }

  if (state.role === 'phone' && state.lobbyCode) {
    broadcastLobby(state.lobbyCode);
  }

  clients.delete(ws);
}

function requireConnected(clientState, ws) {
  if (!clientState) {
    send(ws, { type: 'error', message: 'Client not initialized' });
    return false;
  }
  return true;
}

wss.on('connection', (ws) => {
  const clientId = uniqueCode(8, new Set([...clients.values()].map((entry) => entry.id)));

  clients.set(ws, {
    id: clientId,
    role: null,
    lobbyCode: null,
    roomCode: null,
    phoneName: null,
    playerSlot: null,
  });

  send(ws, { type: 'connected', clientId });

  ws.on('message', (raw) => {
    let message;
    try {
      message = JSON.parse(String(raw));
    } catch {
      send(ws, { type: 'error', message: 'Malformed JSON message' });
      return;
    }

    const clientState = clients.get(ws);
    if (!requireConnected(clientState, ws)) {
      return;
    }

    if (message.type === 'create_lobby') {
      const lobbyCode = uniqueCode(6, new Set(lobbies.keys()));
      const roomCode = createAccessPoint(lobbyCode);
      lobbies.set(lobbyCode, {
        code: lobbyCode,
        hostClientId: clientState.id,
        roomCodes: new Set([roomCode]),
      });
      clientState.role = 'host';
      clientState.lobbyCode = lobbyCode;
      clientState.roomCode = null;
      broadcastLobby(lobbyCode);
      return;
    }

    if (message.type === 'join_lobby') {
      const code = String(message.lobbyCode || '').toUpperCase();
      const lobby = lobbies.get(code);
      if (!lobby) {
        send(ws, { type: 'error', message: 'Lobby not found' });
        return;
      }

      clientState.role = clientState.role || 'host';
      clientState.lobbyCode = code;
      clientState.roomCode = null;
      send(ws, { type: 'lobby_state', lobby: lobbySnapshot(lobby) });
      return;
    }

    if (message.type === 'leave_lobby') {
      const previousLobby = clientState.lobbyCode;
      if (clientState.roomCode) {
        const room = rooms.get(clientState.roomCode);
        room?.phoneClientIds.delete(clientState.id);
      }
      clientState.lobbyCode = null;
      clientState.roomCode = null;
      clientState.phoneName = null;
      clientState.playerSlot = null;
      clientState.role = null;
      send(ws, { type: 'left_lobby' });
      if (previousLobby) {
        broadcastLobby(previousLobby);
      }
      return;
    }

    if (message.type === 'create_room') {
      send(ws, { type: 'error', message: 'Lobby now uses a single access point' });
      return;
    }

    if (message.type === 'pair_phone') {
      const lobbyCode = String(message.lobbyCode || '').toUpperCase();
      const phoneName = String(message.phoneName || 'Phone').trim().slice(0, 40) || 'Phone';
      const playerSlot = message.playerSlot === 1 || message.playerSlot === 2 ? message.playerSlot : null;
      const lobby = lobbies.get(lobbyCode);

      if (!lobby) {
        send(ws, { type: 'error', message: 'Lobby not found' });
        return;
      }

      const room = [...lobby.roomCodes]
        .map((code) => rooms.get(code))
        .find(Boolean);

      if (!room) {
        send(ws, { type: 'error', message: 'Lobby access point not found' });
        return;
      }

      clientState.role = 'phone';
      clientState.lobbyCode = lobbyCode;
      clientState.roomCode = room.code;
      clientState.phoneName = phoneName;
      clientState.playerSlot = playerSlot;
      room.phoneClientIds.add(clientState.id);

      send(ws, {
        type: 'paired',
        lobbyCode,
        roomCode: room.code,
        roomName: room.name,
        playerSlot: clientState.playerSlot ?? undefined,
      });

      broadcastLobby(lobbyCode);
      return;
    }

    if (message.type === 'select_round_track') {
      if (clientState.role !== 'phone' || !clientState.roomCode || !clientState.lobbyCode) {
        send(ws, { type: 'error', message: 'Phone must be paired before selecting a track' });
        return;
      }

      const playerSlot = message.playerSlot === 1 || message.playerSlot === 2 ? message.playerSlot : clientState.playerSlot;
      if (!playerSlot) {
        send(ws, { type: 'error', message: 'Player slot is required' });
        return;
      }

      for (const [targetWs, targetState] of clients.entries()) {
        if (targetState.roomCode === clientState.roomCode || targetState.lobbyCode === clientState.lobbyCode) {
          send(targetWs, {
            type: 'room_track_selected',
            roomCode: clientState.roomCode,
            playerSlot,
            trackId: String(message.trackId || ''),
            trackName: String(message.trackName || ''),
            artistNames: String(message.artistNames || ''),
            uri: String(message.uri || ''),
          });
        }
      }
      return;
    }

    if (message.type === 'publish_on_beat_state') {
      if (clientState.role !== 'host' || !clientState.lobbyCode) {
        send(ws, { type: 'error', message: 'Host must join a lobby before publishing On Beat state' });
        return;
      }

      for (const [targetWs, targetState] of clients.entries()) {
        if (targetState.lobbyCode === clientState.lobbyCode) {
          send(targetWs, {
            type: 'on_beat_state',
            state: message.state,
          });
        }
      }
      return;
    }

    if (message.type === 'submit_on_beat_attempt') {
      if (clientState.role !== 'phone' || !clientState.lobbyCode) {
        send(ws, { type: 'error', message: 'Phone must be paired before sending an On Beat attempt' });
        return;
      }

      for (const [targetWs, targetState] of clients.entries()) {
        if (targetState.lobbyCode === clientState.lobbyCode) {
          send(targetWs, {
            type: 'on_beat_attempt_recorded',
            attempt: message.attempt,
          });
        }
      }
      return;
    }

    if (message.type === 'publish_lyrics_state') {
      if (clientState.role !== 'host' || !clientState.lobbyCode) {
        send(ws, { type: 'error', message: 'Host must join a lobby before publishing lyrics state' });
        return;
      }

      for (const [targetWs, targetState] of clients.entries()) {
        if (targetState.lobbyCode === clientState.lobbyCode) {
          send(targetWs, {
            type: 'lyrics_state',
            state: message.state,
          });
        }
      }
      return;
    }

    if (message.type === 'submit_lyrics_attempt') {
      if (clientState.role !== 'phone' || !clientState.lobbyCode) {
        send(ws, { type: 'error', message: 'Phone must be paired before sending a lyrics attempt' });
        return;
      }

      for (const [targetWs, targetState] of clients.entries()) {
        if (targetState.lobbyCode === clientState.lobbyCode) {
          send(targetWs, {
            type: 'lyrics_attempt_recorded',
            attempt: message.attempt,
          });
        }
      }
      return;
    }

    send(ws, { type: 'error', message: 'Unknown message type' });
  });

  ws.on('close', () => {
    cleanupClient(ws);
  });

  ws.on('error', () => {
    cleanupClient(ws);
  });
});

server.listen(port, () => {
  console.log(`Lobby socket server running on ws://localhost:${port}`);
});
