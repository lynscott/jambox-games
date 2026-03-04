export interface SpotifyPlaybackState {
  paused: boolean;
}

interface SpotifyPlayerInit {
  name: string;
  getOAuthToken: (callback: (accessToken: string) => void) => void;
  volume?: number;
}

interface SpotifyError {
  message: string;
}

interface SpotifyReadyEvent {
  device_id: string;
}

export interface SpotifyPlaybackPlayer {
  connect: () => Promise<boolean>;
  disconnect: () => void;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  activateElement: () => Promise<void>;
  addListener(event: 'ready' | 'not_ready', callback: (event: SpotifyReadyEvent) => void): boolean;
  addListener(
    event: 'initialization_error' | 'authentication_error' | 'account_error' | 'playback_error',
    callback: (event: SpotifyError) => void,
  ): boolean;
  addListener(
    event: 'player_state_changed',
    callback: (state: SpotifyPlaybackState | null) => void,
  ): boolean;
}

interface SpotifySdkNamespace {
  Player: new (options: SpotifyPlayerInit) => SpotifyPlaybackPlayer;
}

declare global {
  interface Window {
    Spotify?: SpotifySdkNamespace;
    onSpotifyWebPlaybackSDKReady?: () => void;
  }
}

const SPOTIFY_WEB_PLAYBACK_SDK_ID = 'spotify-web-playback-sdk';
const SPOTIFY_WEB_PLAYBACK_SDK_URL = 'https://sdk.scdn.co/spotify-player.js';
let spotifySdkPromise: Promise<SpotifySdkNamespace> | null = null;

export function loadSpotifyWebPlaybackSdk() {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Spotify playback is only available in the browser.'));
  }

  if (window.Spotify) {
    return Promise.resolve(window.Spotify);
  }

  if (spotifySdkPromise) {
    return spotifySdkPromise;
  }

  spotifySdkPromise = new Promise<SpotifySdkNamespace>((resolve, reject) => {
    const finish = () => {
      if (window.Spotify) {
        resolve(window.Spotify);
        return;
      }

      reject(new Error('Spotify Web Playback SDK did not initialize.'));
    };

    const previousReadyHandler = window.onSpotifyWebPlaybackSDKReady;
    window.onSpotifyWebPlaybackSDKReady = () => {
      previousReadyHandler?.();
      finish();
    };

    const existingScript = document.getElementById(SPOTIFY_WEB_PLAYBACK_SDK_ID) as HTMLScriptElement | null;
    if (existingScript) {
      existingScript.addEventListener(
        'error',
        () => reject(new Error('Failed to load Spotify Web Playback SDK.')),
        { once: true },
      );
      return;
    }

    const script = document.createElement('script');
    script.id = SPOTIFY_WEB_PLAYBACK_SDK_ID;
    script.src = SPOTIFY_WEB_PLAYBACK_SDK_URL;
    script.async = true;
    script.onerror = () => reject(new Error('Failed to load Spotify Web Playback SDK.'));
    document.body.appendChild(script);
  }).catch((error: unknown) => {
    spotifySdkPromise = null;
    throw error;
  });

  return spotifySdkPromise;
}
