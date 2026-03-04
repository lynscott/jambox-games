import { useEffect, useRef } from 'react';
import type { ZoneId } from '../types';

interface OverlayCanvasProps {
  video: HTMLVideoElement | null;
  enabled?: boolean;
  beatPhase?: number;
  cueWindowActive?: boolean;
  activeZones?: Record<ZoneId, boolean>;
  hitFlashes?: Record<ZoneId, number>;
  onDraw?: (ctx: CanvasRenderingContext2D, width: number, height: number) => void;
}

// Lane colors: drums (amber), bass (cyan), pad (magenta)
const LANE_COLORS: Record<ZoneId, { wash: string; inactiveWash: string; glow: string; dot: string }> = {
  left: {
    wash: 'rgba(255, 140, 0, 0.06)',
    inactiveWash: 'rgba(255, 140, 0, 0.015)',
    glow: 'rgba(255, 140, 0, 0.7)',
    dot: '#ff8c00',
  },
  middle: {
    wash: 'rgba(0, 229, 255, 0.06)',
    inactiveWash: 'rgba(0, 229, 255, 0.015)',
    glow: 'rgba(0, 229, 255, 0.7)',
    dot: '#00e5ff',
  },
  right: {
    wash: 'rgba(224, 64, 251, 0.06)',
    inactiveWash: 'rgba(224, 64, 251, 0.015)',
    glow: 'rgba(224, 64, 251, 0.7)',
    dot: '#e040fb',
  },
};

const ZONES: ZoneId[] = ['left', 'middle', 'right'];
const HIT_FLASH_DURATION_MS = 300;

export function drawNeonOverlay(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  beatPhase: number,
  cueWindowActive: boolean,
  activeZones: Record<ZoneId, boolean>,
  hitFlashes: Record<ZoneId, number>,
  now: number,
) {
  const zoneWidth = width / 3;

  ctx.save();

  // --- Tinted zone washes ---
  ZONES.forEach((zone, i) => {
    ctx.fillStyle = activeZones[zone] ? LANE_COLORS[zone].wash : LANE_COLORS[zone].inactiveWash;
    ctx.fillRect(zoneWidth * i, 0, zoneWidth, height);
  });

  // --- Hit flash effect ---
  ZONES.forEach((zone, i) => {
    const elapsed = now - hitFlashes[zone];
    if (elapsed < HIT_FLASH_DURATION_MS && hitFlashes[zone] > 0) {
      const alpha = 0.25 * (1 - elapsed / HIT_FLASH_DURATION_MS);
      ctx.fillStyle = LANE_COLORS[zone].glow.replace(/[\d.]+\)$/, `${alpha})`);
      ctx.fillRect(zoneWidth * i, 0, zoneWidth, height);
    }
  });

  // --- Neon divider lines ---
  const dividerPositions = [zoneWidth, zoneWidth * 2];
  dividerPositions.forEach((x) => {
    const gradient = ctx.createLinearGradient(x, 0, x, height);
    gradient.addColorStop(0, 'rgba(124, 77, 255, 0)');
    gradient.addColorStop(0.2, 'rgba(124, 77, 255, 0.5)');
    gradient.addColorStop(0.5, 'rgba(124, 77, 255, 0.7)');
    gradient.addColorStop(0.8, 'rgba(124, 77, 255, 0.5)');
    gradient.addColorStop(1, 'rgba(124, 77, 255, 0)');

    ctx.strokeStyle = gradient;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  });

  // --- Beat dots with glow ---
  const activeBeat = Math.floor((((beatPhase % 1) + 1) % 1) * 4) % 4;
  ZONES.forEach((zone, i) => {
    const x = zoneWidth * i + zoneWidth / 2;
    const y = 26;
    const isActive = i === activeBeat % 3;

    ctx.beginPath();
    if (isActive) {
      ctx.shadowColor = LANE_COLORS[zone].glow;
      ctx.shadowBlur = 14;
      ctx.fillStyle = LANE_COLORS[zone].dot;
      ctx.arc(x, y, 9, 0, Math.PI * 2);
    } else {
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.arc(x, y, 5, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
  });

  // --- Cue window strips ("play now" moment across all lanes) ---
  if (cueWindowActive) {
    ZONES.forEach((zone, i) => {
      if (!activeZones[zone]) {
        return;
      }
      const x = zoneWidth * i;
      ctx.fillStyle = LANE_COLORS[zone].glow.replace(/[\d.]+\)$/, '0.35)');
      ctx.fillRect(x + 6, 46, zoneWidth - 12, 6);
    });
  }

  ctx.restore();
}

export function OverlayCanvas({
  video,
  enabled = true,
  beatPhase = 0,
  cueWindowActive = false,
  activeZones = { left: true, middle: true, right: true },
  hitFlashes = { left: 0, middle: 0, right: 0 },
  onDraw,
}: OverlayCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let rafId = 0;

    const render = () => {
      const canvas = canvasRef.current;
      if (!canvas || !video) {
        rafId = window.requestAnimationFrame(render);
        return;
      }

      const width = video.videoWidth || video.clientWidth || 640;
      const height = video.videoHeight || video.clientHeight || 480;
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        rafId = window.requestAnimationFrame(render);
        return;
      }

      ctx.clearRect(0, 0, width, height);
      drawNeonOverlay(
        ctx,
        width,
        height,
        beatPhase,
        cueWindowActive,
        activeZones,
        hitFlashes,
        performance.now(),
      );
      if (onDraw) {
        onDraw(ctx, width, height);
      }

      rafId = window.requestAnimationFrame(render);
    };

    rafId = window.requestAnimationFrame(render);
    return () => window.cancelAnimationFrame(rafId);
  }, [activeZones, beatPhase, cueWindowActive, enabled, hitFlashes, onDraw, video]);

  return <canvas ref={canvasRef} className="overlay-canvas" aria-label="Overlay Canvas" />;
}
