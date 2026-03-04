import type { ClientMessage, ServerMessage } from './lobbyProtocol';

interface LobbyClientOptions {
  url: string;
  onMessage: (message: ServerMessage) => void;
  onOpen?: () => void;
  onClose?: () => void;
}

export class LobbyClient {
  private socket: WebSocket | null = null;
  private readonly options: LobbyClientOptions;

  constructor(options: LobbyClientOptions) {
    this.options = options;
  }

  connect() {
    if (this.socket && this.socket.readyState <= WebSocket.OPEN) {
      return;
    }

    const socket = new WebSocket(this.options.url);
    this.socket = socket;

    socket.addEventListener('open', () => {
      this.options.onOpen?.();
    });

    socket.addEventListener('close', () => {
      this.options.onClose?.();
      if (this.socket === socket) {
        this.socket = null;
      }
    });

    socket.addEventListener('message', (event) => {
      if (typeof event.data !== 'string') {
        return;
      }

      try {
        const parsed = JSON.parse(event.data) as ServerMessage;
        this.options.onMessage(parsed);
      } catch {
        // Ignore malformed payloads from the socket transport.
      }
    });
  }

  disconnect() {
    this.socket?.close();
    this.socket = null;
  }

  send(message: ClientMessage) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return;
    }

    this.socket.send(JSON.stringify(message));
  }

  isConnected() {
    return this.socket?.readyState === WebSocket.OPEN;
  }
}
