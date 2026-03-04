import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LobbySessionProvider } from '../../lobby/useLobbySession';
import { LobbyPairingPanel } from './LobbyPairingPanel';

describe('LobbyPairingPanel', () => {
  const originalUserAgent = window.navigator.userAgent;

  beforeEach(() => {
    window.history.replaceState({}, '', '/');
    Object.defineProperty(window.navigator, 'userAgent', {
      configurable: true,
      value: originalUserAgent,
    });
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockImplementation(() => ({
        matches: false,
        media: '',
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('defaults to host on desktop-like devices', () => {
    render(
      <LobbySessionProvider>
        <LobbyPairingPanel />
      </LobbySessionProvider>,
    );

    expect((screen.getByRole('option', { name: /host \/ tv/i }) as HTMLOptionElement).selected).toBe(true);
  });

  it('defaults to phone on phone-like devices', () => {
    Object.defineProperty(window.navigator, 'userAgent', {
      configurable: true,
      value:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
    });

    render(
      <LobbySessionProvider>
        <LobbyPairingPanel />
      </LobbySessionProvider>,
    );

    expect((screen.getByRole('option', { name: /^phone$/i }) as HTMLOptionElement).selected).toBe(true);
    expect((screen.getByRole('option', { name: /player 1/i }) as HTMLOptionElement).selected).toBe(true);

    fireEvent.change(screen.getByLabelText(/player slot/i), { target: { value: '2' } });
    expect((screen.getByRole('option', { name: /player 2/i }) as HTMLOptionElement).selected).toBe(true);
  });
});
