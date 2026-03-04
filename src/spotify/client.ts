const SPOTIFY_AUTHORIZE_URL = 'https://accounts.spotify.com/authorize';
const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';
const SPOTIFY_API_BASE = 'https://api.spotify.com/v1';
const STORAGE_PREFIX = 'jambox-spotify-auth';
export const VERZUZ_PLAYLIST_NAME = 'Jambox Verzuz';

export interface SpotifyTrackSummary {
  id: string;
  name: string;
  artistNames: string;
  uri: string;
}

export interface SpotifyPlaylistSummary {
  id: string;
  name: string;
  ownerName: string;
  trackCount: number;
}

export interface SpotifyConnection {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: number;
  profileName: string;
  spotifyUserId: string;
  savedTracks: SpotifyTrackSummary[];
}

interface StoredAuthContext {
  state: string;
  verifier: string;
  playerIndex: number;
  returnToUrl: string;
}

function getClientId() {
  return import.meta.env.VITE_SPOTIFY_CLIENT_ID || '';
}

function getRedirectUri() {
  const configured = import.meta.env.VITE_SPOTIFY_REDIRECT_URI;
  if (configured) {
    return configured;
  }

  if (typeof window === 'undefined') {
    return '';
  }

  return window.location.origin;
}

function randomString(length: number) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (value) => chars[value % chars.length]).join('');
}

async function sha256(input: string) {
  const data = new TextEncoder().encode(input);
  return crypto.subtle.digest('SHA-256', data);
}

function base64UrlEncode(buffer: ArrayBuffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

async function createPkcePair() {
  const verifier = randomString(64);
  const challenge = base64UrlEncode(await sha256(verifier));
  return { verifier, challenge };
}

function getStorageKey(playerIndex: number) {
  return `${STORAGE_PREFIX}:${playerIndex}`;
}

function getPendingAuthKey() {
  return `${STORAGE_PREFIX}:pending`;
}

export function hasSpotifyClientConfig() {
  return Boolean(getClientId());
}

export async function beginSpotifyLogin(playerIndex: number, forceDialog = false) {
  const clientId = getClientId();
  const redirectUri = getRedirectUri();
  if (!clientId || !redirectUri) {
    throw new Error('Spotify client configuration is missing');
  }

  const { verifier, challenge } = await createPkcePair();
  const state = `${playerIndex}:${randomString(12)}`;
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    code_challenge_method: 'S256',
    code_challenge: challenge,
    state,
    show_dialog: forceDialog ? 'true' : 'false',
    scope: [
      'user-library-read',
      'playlist-read-private',
      'playlist-read-collaborative',
      'playlist-modify-private',
      'user-read-private',
      'user-read-email',
      'user-read-playback-state',
      'user-modify-playback-state',
      'streaming',
    ].join(' '),
  });

  const pending: StoredAuthContext = {
    state,
    verifier,
    playerIndex,
    returnToUrl: typeof window === 'undefined' ? redirectUri : window.location.href,
  };
  sessionStorage.setItem(getPendingAuthKey(), JSON.stringify(pending));
  window.location.assign(`${SPOTIFY_AUTHORIZE_URL}?${params.toString()}`);
}

export function loadSpotifyConnection(playerIndex: number): SpotifyConnection | null {
  const raw = localStorage.getItem(getStorageKey(playerIndex));
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as SpotifyConnection;
  } catch {
    return null;
  }
}

export function saveSpotifyConnection(playerIndex: number, connection: SpotifyConnection) {
  localStorage.setItem(getStorageKey(playerIndex), JSON.stringify(connection));
}

export function clearSpotifyConnection(playerIndex: number) {
  localStorage.removeItem(getStorageKey(playerIndex));
}

async function exchangeCodeForToken(code: string, verifier: string) {
  const response = await fetch(SPOTIFY_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: getClientId(),
      grant_type: 'authorization_code',
      code,
      redirect_uri: getRedirectUri(),
      code_verifier: verifier,
    }),
  });

  if (!response.ok) {
    throw new Error('Spotify token exchange failed');
  }

  return response.json() as Promise<{
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  }>;
}

async function spotifyGet<T>(accessToken: string, path: string) {
  const response = await spotifyRequest(accessToken, path);

  if (!response.ok) {
    throw new Error(`Spotify request failed for ${path}`);
  }

  return response.json() as Promise<T>;
}

async function spotifyRequest(accessToken: string, path: string, init?: RequestInit) {
  return fetch(`${SPOTIFY_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init?.headers || {}),
    },
  });
}

async function spotifyWrite<T>(accessToken: string, path: string, method: 'POST' | 'DELETE', body?: unknown) {
  const response = await spotifyRequest(accessToken, path, {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    throw new Error(`Spotify request failed for ${path}`);
  }

  if (response.status === 204) {
    return null as T;
  }

  return response.json() as Promise<T>;
}

function requireAccessToken(connection: SpotifyConnection | null) {
  if (!connection?.accessToken) {
    throw new Error('Spotify is not connected');
  }

  return connection.accessToken;
}

async function fetchProfile(accessToken: string) {
  return spotifyGet<{ display_name: string | null; id: string }>(accessToken, '/me');
}

async function fetchSavedTracks(accessToken: string) {
  const saved = await spotifyGet<{
    items: Array<{
      track: {
        id: string;
        name: string;
        uri: string;
        artists: Array<{ name: string }>;
      };
    }>;
  }>(accessToken, '/me/tracks?limit=50');

  return saved.items
    .filter((item) => item.track?.id)
    .map((item) => ({
      id: item.track.id,
      name: item.track.name,
      artistNames: item.track.artists.map((artist) => artist.name).join(', '),
      uri: item.track.uri,
    }));
}

export async function completeSpotifyLoginFromUrl() {
  if (typeof window === 'undefined') {
    return null;
  }

  const url = new URL(window.location.href);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  if (!code || !state) {
    return null;
  }

  const pendingRaw = sessionStorage.getItem(getPendingAuthKey());
  if (!pendingRaw) {
    throw new Error('Spotify auth state is missing');
  }

  const pending = JSON.parse(pendingRaw) as StoredAuthContext;
  if (pending.state !== state) {
    throw new Error('Spotify auth state mismatch');
  }

  const token = await exchangeCodeForToken(code, pending.verifier);
  const profile = await fetchProfile(token.access_token);
  const savedTracks = await fetchSavedTracks(token.access_token);

  const connection: SpotifyConnection = {
    accessToken: token.access_token,
    refreshToken: token.refresh_token || null,
    expiresAt: Date.now() + token.expires_in * 1000,
    profileName: profile.display_name || profile.id,
    spotifyUserId: profile.id,
    savedTracks,
  };

  saveSpotifyConnection(pending.playerIndex, connection);
  sessionStorage.removeItem(getPendingAuthKey());
  if (pending.returnToUrl) {
    window.location.replace(pending.returnToUrl);
    return { playerIndex: pending.playerIndex, connection };
  }

  url.searchParams.delete('code');
  url.searchParams.delete('state');
  window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`);

  return { playerIndex: pending.playerIndex, connection };
}

export async function fetchSpotifyPlaylists(connection: SpotifyConnection | null) {
  const accessToken = requireAccessToken(connection);
  const playlists = await spotifyGet<{
    items: Array<{
      id: string;
      name: string;
      owner: { display_name: string | null };
      tracks: { total: number };
    }>;
  }>(accessToken, '/me/playlists?limit=30');

  return playlists.items.map((playlist) => ({
    id: playlist.id,
    name: playlist.name,
    ownerName: playlist.owner.display_name || 'Spotify',
    trackCount: playlist.tracks.total,
  })) as SpotifyPlaylistSummary[];
}

export async function fetchSpotifyPlaylistTracks(
  connection: SpotifyConnection | null,
  playlistId: string,
) {
  const accessToken = requireAccessToken(connection);
  const playlist = await spotifyGet<{
    items: Array<{
      track: {
        id: string | null;
        name: string;
        uri: string;
        artists: Array<{ name: string }>;
      } | null;
    }>;
  }>(accessToken, `/playlists/${playlistId}/tracks?limit=50`);

  return playlist.items
    .filter((item) => item.track?.id)
    .map((item) => ({
      id: item.track!.id as string,
      name: item.track!.name,
      artistNames: item.track!.artists.map((artist) => artist.name).join(', '),
      uri: item.track!.uri,
    })) as SpotifyTrackSummary[];
}

export async function ensureVerzuzPlaylist(connection: SpotifyConnection | null) {
  const accessToken = requireAccessToken(connection);
  const playlists = await fetchSpotifyPlaylists(connection);
  const existing = playlists.find(
    (playlist) => playlist.name.trim().toLowerCase() === VERZUZ_PLAYLIST_NAME.toLowerCase(),
  );

  if (existing) {
    return existing;
  }

  const created = await spotifyWrite<{
    id: string;
    name: string;
    owner: { display_name: string | null };
    tracks: { total: number };
  }>(accessToken, `/users/${connection?.spotifyUserId}/playlists`, 'POST', {
    name: VERZUZ_PLAYLIST_NAME,
    description: 'Round queue for Jambox Verzuz battles',
    public: false,
  });

  return {
    id: created.id,
    name: created.name,
    ownerName: created.owner.display_name || connection?.profileName || 'Spotify',
    trackCount: created.tracks.total,
  } as SpotifyPlaylistSummary;
}

export async function addTrackToSpotifyPlaylist(
  connection: SpotifyConnection | null,
  playlistId: string,
  trackUri: string,
) {
  const accessToken = requireAccessToken(connection);
  await spotifyWrite(accessToken, `/playlists/${playlistId}/tracks`, 'POST', {
    uris: [trackUri],
  });
}

export async function removeTrackFromSpotifyPlaylist(
  connection: SpotifyConnection | null,
  playlistId: string,
  trackUri: string,
) {
  const accessToken = requireAccessToken(connection);
  await spotifyWrite(accessToken, `/playlists/${playlistId}/tracks`, 'DELETE', {
    tracks: [{ uri: trackUri }],
  });
}

export async function searchSpotifyTracks(connection: SpotifyConnection | null, query: string) {
  const accessToken = requireAccessToken(connection);
  const encoded = encodeURIComponent(query.trim());
  const search = await spotifyGet<{
    tracks: {
      items: Array<{
        id: string;
        name: string;
        uri: string;
        artists: Array<{ name: string }>;
      }>;
    };
  }>(accessToken, `/search?type=track&limit=20&q=${encoded}`);

  return search.tracks.items.map((track) => ({
    id: track.id,
    name: track.name,
    artistNames: track.artists.map((artist) => artist.name).join(', '),
    uri: track.uri,
  })) as SpotifyTrackSummary[];
}
