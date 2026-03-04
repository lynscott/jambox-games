export type DeviceRole = 'host' | 'phone';

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
    };
