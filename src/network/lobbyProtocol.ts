export type DeviceRole = 'host' | 'phone';

export type OnBeatAttemptGrade = 'perfect' | 'good' | 'miss';

export interface OnBeatLiveState {
  game: 'on_beat';
  sessionId: number;
  status: 'ready' | 'countdown' | 'preview' | 'playing' | 'results';
  difficulty: string;
  roundNumber: number | null;
  beatNumber: number | null;
  promptIndex: number | null;
  promptWord: string | null;
  promptEmoji: string | null;
  promptTimeMs: number | null;
  countdownLabel: string | null;
  perfectWindowMs: number;
  okayWindowMs: number;
  totalPrompts: number;
}

export interface OnBeatAttemptSnapshot {
  sessionId: number;
  playerSlot: 1 | 2;
  promptIndex: number;
  grade: OnBeatAttemptGrade;
  offsetMs: number;
  detectedAtMs: number;
  transcript?: string;
  expectedWord?: string;
  recognizedCorrectly?: boolean;
}

export interface LyricsLiveState {
  game: 'lyrics';
  sessionId: number;
  status: 'ready' | 'countdown' | 'playing' | 'results';
  trackId: string;
  trackTitle: string;
  promptIndex: number | null;
  promptText: string | null;
  promptStartMs: number | null;
  promptEndMs: number | null;
  countdownLabel: string | null;
  cueCount: number;
}

export interface LyricsAttemptSnapshot {
  sessionId: number;
  playerSlot: 1 | 2;
  cueIndex: number;
  transcript: string;
  detectedAtMs: number;
}

export interface RoomSnapshot {
  code: string;
  name: string;
  phoneCount: number;
  phones: string[];
}

export interface LobbySnapshot {
  code: string;
  rooms: RoomSnapshot[];
}

export type ServerMessage =
  | {
      type: 'connected';
      clientId: string;
    }
  | {
      type: 'lobby_state';
      lobby: LobbySnapshot;
    }
  | {
      type: 'paired';
      roomCode: string;
      roomName: string;
      lobbyCode: string;
      playerSlot?: 1 | 2;
    }
  | {
      type: 'room_track_selected';
      roomCode: string;
      playerSlot: 1 | 2;
      trackId: string;
      trackName: string;
      artistNames: string;
      uri: string;
    }
  | {
      type: 'on_beat_state';
      state: OnBeatLiveState;
    }
  | {
      type: 'on_beat_attempt_recorded';
      attempt: OnBeatAttemptSnapshot;
    }
  | {
      type: 'lyrics_state';
      state: LyricsLiveState;
    }
  | {
      type: 'lyrics_attempt_recorded';
      attempt: LyricsAttemptSnapshot;
    }
  | {
      type: 'left_lobby';
    }
  | {
      type: 'error';
      message: string;
    };

export type ClientMessage =
  | {
      type: 'create_lobby';
    }
  | {
      type: 'join_lobby';
      lobbyCode: string;
    }
  | {
      type: 'leave_lobby';
    }
  | {
      type: 'create_room';
      roomName: string;
    }
  | {
      type: 'pair_phone';
      lobbyCode: string;
      phoneName: string;
      playerSlot?: 1 | 2;
    }
  | {
      type: 'select_round_track';
      playerSlot: 1 | 2;
      trackId: string;
      trackName: string;
      artistNames: string;
      uri: string;
    }
  | {
      type: 'publish_on_beat_state';
      state: OnBeatLiveState;
    }
  | {
      type: 'submit_on_beat_attempt';
      attempt: OnBeatAttemptSnapshot;
    }
  | {
      type: 'publish_lyrics_state';
      state: LyricsLiveState;
    }
  | {
      type: 'submit_lyrics_attempt';
      attempt: LyricsAttemptSnapshot;
    };
