const DEFAULT_WS_URL = 'ws://localhost:8080';

export function getLobbyHttpBaseUrl() {
  const rawUrl = import.meta.env.VITE_WS_URL || DEFAULT_WS_URL;
  const url = new URL(rawUrl);

  url.protocol = url.protocol === 'wss:' ? 'https:' : 'http:';
  url.pathname = '';
  url.search = '';
  url.hash = '';

  return url.toString().replace(/\/$/, '');
}
