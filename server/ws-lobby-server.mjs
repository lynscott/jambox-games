import { WebSocketServer } from 'ws';

const port = Number(process.env.PORT || 8080);

/** @type {Map<string, { code: string; hostClientId: string; roomCodes: Set<string> }>} */
const lobbies = new Map();
/** @type {Map<string, { code: string; lobbyCode: string; name: string; phoneClientIds: Set<string> }>} */
const rooms = new Map();
/** @type {Map<import('ws').WebSocket, { id: string; role: 'host'|'phone'|null; lobbyCode: string | null; roomCode: string | null; phoneName: string | null; playerSlot: 1 | 2 | null }>} */
const clients = new Map();

const wss = new WebSocketServer({ port });

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

    send(ws, { type: 'error', message: 'Unknown message type' });
  });

  ws.on('close', () => {
    cleanupClient(ws);
  });

  ws.on('error', () => {
    cleanupClient(ws);
  });
});

console.log(`Lobby socket server running on ws://localhost:${port}`);
