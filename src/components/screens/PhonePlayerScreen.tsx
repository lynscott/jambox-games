import { useCallback, useEffect, useState } from 'react';
import {
  addTrackToSpotifyPlaylist,
  beginSpotifyLogin,
  clearSpotifyConnection,
  ensureVerzuzPlaylist,
  fetchSpotifyPlaylistTracks,
  loadSpotifyConnection,
  removeTrackFromSpotifyPlaylist,
  searchSpotifyTracks,
  VERZUZ_PLAYLIST_NAME,
  type SpotifyPlaylistSummary,
  type SpotifyTrackSummary,
} from '../../spotify/client';
import { useLobbySession } from '../../lobby/useLobbySession';

interface PhonePlayerScreenProps {
  lobbyCode: string;
  playerSlot: 1 | 2;
}

export function PhonePlayerScreen({ lobbyCode, playerSlot }: PhonePlayerScreenProps) {
  const {
    socketStatus,
    pairedRoom,
    message,
    phoneName,
    setPhoneName,
    setLobbyCodeInput,
    connect,
    pairPhone,
    sendSelectedTrack,
  } = useLobbySession();
  const [spotifyName, setSpotifyName] = useState('');
  const [managedPlaylist, setManagedPlaylist] = useState<SpotifyPlaylistSummary | null>(null);
  const [playlistTracks, setPlaylistTracks] = useState<SpotifyTrackSummary[]>([]);
  const [searchResults, setSearchResults] = useState<SpotifyTrackSummary[]>([]);
  const [query, setQuery] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [status, setStatus] = useState('Connect Spotify to prepare your Verzuz queue.');

  const refreshManagedPlaylist = useCallback(async () => {
    const connection = loadSpotifyConnection(playerSlot - 1);
    if (!connection) {
      setSpotifyName('');
      setManagedPlaylist(null);
      setPlaylistTracks([]);
      setStatus('Connect Spotify to prepare your Verzuz queue.');
      return;
    }

    setIsBusy(true);
    setSpotifyName(connection.profileName);
    setStatus(`Syncing ${VERZUZ_PLAYLIST_NAME}...`);

    try {
      const playlist = await ensureVerzuzPlaylist(connection);
      const tracks = await fetchSpotifyPlaylistTracks(connection, playlist.id);
      setManagedPlaylist({ ...playlist, trackCount: tracks.length });
      setPlaylistTracks(tracks);
      setStatus(
        tracks.length > 0
          ? `${tracks.length} songs queued. First song is next for the round.`
          : `Your ${VERZUZ_PLAYLIST_NAME} playlist is empty. Search and add songs from Spotify.`,
      );
    } catch {
      setStatus(`Could not load ${VERZUZ_PLAYLIST_NAME}. Reconnect Spotify and try again.`);
    } finally {
      setIsBusy(false);
    }
  }, [playerSlot]);

  useEffect(() => {
    setLobbyCodeInput(lobbyCode);
    connect();
  }, [connect, lobbyCode, setLobbyCodeInput]);

  useEffect(() => {
    if (socketStatus === 'connected' && !pairedRoom) {
      pairPhone(playerSlot);
    }
  }, [pairPhone, pairedRoom, playerSlot, socketStatus]);

  useEffect(() => {
    void refreshManagedPlaylist();
  }, [refreshManagedPlaylist]);

  const runSearch = async () => {
    const connection = loadSpotifyConnection(playerSlot - 1);
    if (!connection || !query.trim()) {
      return;
    }

    setIsBusy(true);
    setStatus(`Searching Spotify for "${query.trim()}"...`);

    try {
      const results = await searchSpotifyTracks(connection, query);
      setSearchResults(results);
      setStatus(results.length > 0 ? `Found ${results.length} songs.` : 'No songs matched that search.');
    } catch {
      setStatus('Spotify search failed. Try again.');
    } finally {
      setIsBusy(false);
    }
  };

  const addToQueue = async (track: SpotifyTrackSummary) => {
    const connection = loadSpotifyConnection(playerSlot - 1);
    if (!connection || !managedPlaylist) {
      return;
    }

    setIsBusy(true);
    setStatus(`Adding ${track.name} to ${VERZUZ_PLAYLIST_NAME}...`);

    try {
      await addTrackToSpotifyPlaylist(connection, managedPlaylist.id, track.uri);
      await refreshManagedPlaylist();
      setStatus(`${track.name} added. The playlist order is now your round queue.`);
    } catch {
      setStatus(`Could not add ${track.name}.`);
    } finally {
      setIsBusy(false);
    }
  };

  const removeFromQueue = async (track: SpotifyTrackSummary) => {
    const connection = loadSpotifyConnection(playerSlot - 1);
    if (!connection || !managedPlaylist) {
      return;
    }

    setIsBusy(true);
    setStatus(`Removing ${track.name} from ${VERZUZ_PLAYLIST_NAME}...`);

    try {
      await removeTrackFromSpotifyPlaylist(connection, managedPlaylist.id, track.uri);
      await refreshManagedPlaylist();
      setStatus(`${track.name} removed from the queue.`);
    } catch {
      setStatus(`Could not remove ${track.name}.`);
    } finally {
      setIsBusy(false);
    }
  };

  const sendFirstTrack = () => {
    const firstTrack = playlistTracks[0];
    if (!firstTrack) {
      return;
    }

    sendSelectedTrack({
      playerSlot,
      trackId: firstTrack.id,
      trackName: firstTrack.name,
      artistNames: firstTrack.artistNames,
      uri: firstTrack.uri,
    });
    setStatus(`${firstTrack.name} is now cued for this round. Remove it after the round to advance the queue.`);
  };

  const reconnectSpotify = async () => {
    clearSpotifyConnection(playerSlot - 1);
    setSpotifyName('');
    setManagedPlaylist(null);
    setPlaylistTracks([]);
    setSearchResults([]);
    setStatus('Reconnect Spotify and approve playlist access.');
    await beginSpotifyLogin(playerSlot - 1, true);
  };

  return (
    <section className="phase-screen phone-player-screen" aria-label="Phone Player Screen">
      <div className="phase-card vs-setup-card">
        <p className="phase-kicker">Phone Controller</p>
        <h1 className="phase-title">Player {playerSlot} Queue</h1>
        <p className="phase-copy">
          Paired room: <strong>{pairedRoom?.name || 'Connecting...'}</strong>
        </p>
        <p className="phase-copy">{message}</p>

        <label className="vs-field">
          <span>Display Name</span>
          <input value={phoneName} onChange={(event) => setPhoneName(event.currentTarget.value)} />
        </label>

        {spotifyName ? (
          <>
            <p className="phase-copy">
              Connected Spotify: <strong>{spotifyName}</strong>
            </p>
            <p className="phase-copy">{status}</p>
            <div className="phase-actions">
              <button type="button" className="phase-action" onClick={() => void refreshManagedPlaylist()} disabled={isBusy}>
                Refresh Queue
              </button>
              <button type="button" className="phase-action" onClick={() => void reconnectSpotify()} disabled={isBusy}>
                Reconnect Spotify
              </button>
              <button type="button" className="phase-action phase-action--primary" onClick={sendFirstTrack} disabled={isBusy || playlistTracks.length === 0}>
                Send First Song
              </button>
            </div>
          </>
        ) : (
          <button type="button" className="phase-cta" onClick={() => void beginSpotifyLogin(playerSlot - 1)}>
            Connect Spotify
          </button>
        )}

        <div className="vs-history">
          <h2>{VERZUZ_PLAYLIST_NAME}</h2>
          <p className="phase-copy">
            {managedPlaylist ? `${managedPlaylist.trackCount} songs in queue.` : 'This playlist will be created automatically.'}
          </p>
          <ul>
            {playlistTracks.length === 0 ? (
              <li>No songs queued yet</li>
            ) : (
              playlistTracks.map((track, index) => (
                <li key={`${track.id}-${index}`}>
                  <div className="phone-track-row">
                    <div>
                      <strong>{index === 0 ? 'Next up: ' : ''}{track.name}</strong>
                      <p>{track.artistNames}</p>
                    </div>
                    <div className="phone-track-row__actions">
                      {index === 0 ? (
                        <button
                          type="button"
                          className="phase-action phase-action--primary"
                          onClick={sendFirstTrack}
                          disabled={isBusy}
                        >
                          Cue
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="phase-action"
                        onClick={() => void removeFromQueue(track)}
                        disabled={isBusy}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>

        <div className="vs-history">
          <h2>Add Songs To Queue</h2>
          <label className="vs-field">
            <span>Search Spotify</span>
            <input
              aria-label="Phone Spotify Search"
              value={query}
              onChange={(event) => setQuery(event.currentTarget.value)}
              placeholder="Search song, artist, or album"
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  void runSearch();
                }
              }}
            />
          </label>
          <button type="button" className="phase-action" onClick={() => void runSearch()} disabled={isBusy || !spotifyName}>
            {isBusy ? 'Working...' : 'Search Spotify'}
          </button>
          <ul>
            {searchResults.length === 0 ? (
              <li>No search results yet</li>
            ) : (
              searchResults.map((track) => (
                <li key={track.id}>
                  <div className="phone-track-row">
                    <div>
                      <strong>{track.name}</strong>
                      <p>{track.artistNames}</p>
                    </div>
                    <button
                      type="button"
                      className="phase-action"
                      onClick={() => void addToQueue(track)}
                      disabled={isBusy || !managedPlaylist}
                    >
                      Add to Queue
                    </button>
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
    </section>
  );
}
