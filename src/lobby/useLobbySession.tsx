import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { LobbyClient } from '../network/lobbyClient';
import type { LobbySnapshot, RoomSnapshot, ServerMessage } from '../network/lobbyProtocol';

const DEFAULT_WS_URL = 'ws://localhost:8080';

function normalizeCode(value: string) {
  return value.trim().toUpperCase();
}

export interface SelectedTrackPayload {
  trackId: string;
  trackName: string;
  artistNames: string;
  uri: string;
  playerSlot: 1 | 2;
}

interface LobbySessionValue {
  socketStatus: 'disconnected' | 'connected';
  message: string;
  lobbyCodeInput: string;
  setLobbyCodeInput: (value: string) => void;
  lobby: LobbySnapshot | null;
  accessPoint: RoomSnapshot | null;
  phoneName: string;
  setPhoneName: (value: string) => void;
  pairedRoom: RoomSnapshot | null;
  playerSlot: 1 | 2 | null;
  selectedTracks: Record<number, SelectedTrackPayload | null>;
  connect: () => void;
  disconnect: () => void;
  createLobby: () => void;
  joinLobby: () => void;
  leaveLobby: () => void;
  pairPhone: (slot?: 1 | 2) => void;
  sendSelectedTrack: (payload: SelectedTrackPayload) => void;
}

const LobbySessionContext = createContext<LobbySessionValue | null>(null);

export function LobbySessionProvider({ children }: { children: ReactNode }) {
  const [socketStatus, setSocketStatus] = useState<'disconnected' | 'connected'>('disconnected');
  const [message, setMessage] = useState('Disconnected');
  const [lobbyCodeInput, setLobbyCodeInput] = useState('');
  const [lobby, setLobby] = useState<LobbySnapshot | null>(null);
  const [phoneName, setPhoneName] = useState('Phone');
  const [pairedRoom, setPairedRoom] = useState<RoomSnapshot | null>(null);
  const [playerSlot, setPlayerSlot] = useState<1 | 2 | null>(null);
  const [selectedTracks, setSelectedTracks] = useState<Record<number, SelectedTrackPayload | null>>({});

  const wsUrl = useMemo(() => import.meta.env.VITE_WS_URL || DEFAULT_WS_URL, []);
  const clientRef = useRef<LobbyClient | null>(null);
  const accessPoint = lobby?.rooms[0] || null;

  useEffect(() => {
    const client = new LobbyClient({
      url: wsUrl,
      onOpen: () => {
        setSocketStatus('connected');
        setMessage('Connected to lobby server');
      },
      onClose: () => {
        setSocketStatus('disconnected');
        setMessage('Disconnected');
      },
      onMessage: (incoming: ServerMessage) => {
        if (incoming.type === 'lobby_state') {
          setLobby(incoming.lobby);
          setLobbyCodeInput(incoming.lobby.code);
          if (incoming.lobby.rooms[0]) {
            setMessage(`Lobby ${incoming.lobby.code} ready for pairing`);
          } else {
            setMessage(`Lobby ${incoming.lobby.code} connected`);
          }
          return;
        }

        if (incoming.type === 'paired') {
          setMessage(`Paired to ${incoming.roomName}`);
          setLobbyCodeInput(incoming.lobbyCode);
          setPlayerSlot(incoming.playerSlot ?? null);
          setPairedRoom({
            code: incoming.roomCode,
            name: incoming.roomName,
            phoneCount: 0,
            phones: [],
          });
          return;
        }

        if (incoming.type === 'room_track_selected') {
          setSelectedTracks((current) => ({
            ...current,
            [incoming.playerSlot]: {
              trackId: incoming.trackId,
              trackName: incoming.trackName,
              artistNames: incoming.artistNames,
              uri: incoming.uri,
              playerSlot: incoming.playerSlot,
            },
          }));
          return;
        }

        if (incoming.type === 'left_lobby') {
          setLobby(null);
          setPairedRoom(null);
          setPlayerSlot(null);
          setSelectedTracks({});
          setMessage('Left lobby');
          return;
        }

        if (incoming.type === 'error') {
          setMessage(incoming.message);
          return;
        }

        if (incoming.type === 'connected') {
          setMessage(`Connected as ${incoming.clientId}`);
        }
      },
    });

    clientRef.current = client;
    return () => {
      client.disconnect();
      clientRef.current = null;
    };
  }, [wsUrl]);

  const value: LobbySessionValue = {
    socketStatus,
    message,
    lobbyCodeInput,
    setLobbyCodeInput: (value) => setLobbyCodeInput(value.toUpperCase()),
    lobby,
    accessPoint,
    phoneName,
    setPhoneName,
    pairedRoom,
    playerSlot,
    selectedTracks,
    connect: () => clientRef.current?.connect(),
    disconnect: () => clientRef.current?.disconnect(),
    createLobby: () => clientRef.current?.send({ type: 'create_lobby' }),
    joinLobby: () => {
      const code = normalizeCode(lobbyCodeInput);
      if (!code) {
        setMessage('Enter a lobby code');
        return;
      }
      clientRef.current?.send({ type: 'join_lobby', lobbyCode: code });
    },
    leaveLobby: () => clientRef.current?.send({ type: 'leave_lobby' }),
    pairPhone: (slot) => {
      const lobbyCode = normalizeCode(lobbyCodeInput || lobby?.code || '');
      if (!lobbyCode) {
        setMessage('Lobby code required');
        return;
      }
      clientRef.current?.send({
        type: 'pair_phone',
        lobbyCode,
        phoneName: phoneName.trim() || 'Phone',
        playerSlot: slot,
      });
    },
    sendSelectedTrack: (payload) =>
      clientRef.current?.send({
        type: 'select_round_track',
        playerSlot: payload.playerSlot,
        trackId: payload.trackId,
        trackName: payload.trackName,
        artistNames: payload.artistNames,
        uri: payload.uri,
      }),
  };

  return <LobbySessionContext.Provider value={value}>{children}</LobbySessionContext.Provider>;
}

export function useLobbySession() {
  const value = useContext(LobbySessionContext);
  if (!value) {
    throw new Error('useLobbySession must be used within LobbySessionProvider');
  }
  return value;
}
