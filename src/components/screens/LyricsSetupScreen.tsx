import { startTransition, useEffect, useState } from 'react';
import type { LyricsTrack } from '../../game/lyrics';
import {
  buildLyricsTrackFromYoutube,
  hasYoutubeApiKey,
  searchYoutubeInstrumentals,
  type YoutubeInstrumentalOption,
} from '../../game/lyricsLibrary';

interface LyricsSetupScreenProps {
  fallbackTracks: LyricsTrack[];
  selectedTrack: LyricsTrack | null;
  onSelectTrack: (track: LyricsTrack) => void;
  onStart: () => void;
  onBackToMenu: () => void;
}

export function LyricsSetupScreen({
  fallbackTracks,
  selectedTrack,
  onSelectTrack,
  onStart,
  onBackToMenu,
}: LyricsSetupScreenProps) {
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<YoutubeInstrumentalOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isPreparing, setIsPreparing] = useState(false);
  const [preparingId, setPreparingId] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!hasYoutubeApiKey()) {
      return;
    }

    setIsLoading(true);
    searchYoutubeInstrumentals('')
      .then((results) => {
        startTransition(() => {
          setOptions(results);
          setError('');
        });
      })
      .catch((cause) => {
        setError(cause instanceof Error ? cause.message : 'Could not load YouTube instrumentals.');
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  const runSearch = async () => {
    if (!hasYoutubeApiKey()) {
      setError('Missing VITE_YOUTUBE_API_KEY. Add it to load YouTube songs.');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const results = await searchYoutubeInstrumentals(query);
      startTransition(() => {
        setOptions(results);
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Search failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectYoutubeSong = async (option: YoutubeInstrumentalOption) => {
    setIsPreparing(true);
    setPreparingId(option.id);
    setError('');

    try {
      const track = await buildLyricsTrackFromYoutube(option);
      onSelectTrack(track);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? `Could not prepare ${option.title}: ${cause.message}`
          : `Could not prepare ${option.title}.`,
      );
    } finally {
      setIsPreparing(false);
      setPreparingId('');
    }
  };

  return (
    <section className="phase-screen lyrics-setup-screen" aria-label="Lyrics Setup Screen">
      <div className="phase-card lyrics-card">
        <p className="phase-kicker">Know Your Lyrics</p>
        <h1 className="phase-title">Lyrics Challenge Setup</h1>
        <p className="phase-copy">
          Browse top YouTube instrumentals or search for a song. The game fetches lyrics and builds blind rounds from them.
        </p>

        <div className="vs-field">
          <span>Search YouTube Instrumentals</span>
          <input
            aria-label="Lyrics Song Search"
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
            placeholder="Artist or song title"
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                void runSearch();
              }
            }}
          />
        </div>

        <div className="phase-actions">
          <button type="button" className="phase-action" onClick={() => void runSearch()} disabled={isLoading}>
            {isLoading ? 'Searching...' : 'Search Songs'}
          </button>
          <button type="button" className="phase-action phase-action--primary" onClick={onStart} disabled={!selectedTrack || isPreparing}>
            Start Lyrics Mode
          </button>
          <button type="button" className="phase-action" onClick={onBackToMenu}>
            Back To Menu
          </button>
        </div>

        {selectedTrack ? (
          <div className="on-beat-status-card">
            <h2>Selected Song</h2>
            <p>
              <strong>{selectedTrack.title}</strong> by {selectedTrack.artist}
            </p>
            <p>{selectedTrack.cues.length} rounds prepared.</p>
          </div>
        ) : null}

        {error ? (
          <div className="on-beat-status-card">
            <h2>Song Load Error</h2>
            <p>{error}</p>
          </div>
        ) : null}

        <div className="vs-history">
          <h2>Top Instrumentals</h2>
          <ul>
            {options.length === 0 ? (
              <li>{hasYoutubeApiKey() ? 'No YouTube songs loaded yet.' : 'Set VITE_YOUTUBE_API_KEY to load YouTube results.'}</li>
            ) : (
              options.map((option) => (
                <li key={option.id}>
                  <div className="phone-track-row">
                    <div>
                      <strong>{option.title}</strong>
                      <p>{option.artist}</p>
                    </div>
                    <button
                      type="button"
                      className="phase-action"
                      onClick={() => void handleSelectYoutubeSong(option)}
                      disabled={isPreparing}
                    >
                      {preparingId === option.id ? 'Preparing...' : 'Select'}
                    </button>
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>

        <div className="vs-history">
          <h2>Local Fallback Tracks</h2>
          <ul>
            {fallbackTracks.map((track) => (
              <li key={track.id}>
                <div className="phone-track-row">
                  <div>
                    <strong>{track.title}</strong>
                    <p>{track.artist}</p>
                  </div>
                  <button
                    type="button"
                    className="phase-action"
                    onClick={() => onSelectTrack(track)}
                    disabled={isPreparing}
                  >
                    Use Demo
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
