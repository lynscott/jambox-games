import { useEffect, useRef } from 'react';

interface OverlayCanvasProps {
  video: HTMLVideoElement | null;
  enabled?: boolean;
  beatPhase?: number;
  onDraw?: (ctx: CanvasRenderingContext2D, width: number, height: number) => void;
}

export function drawOverlayGuides(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  beatPhase: number,
) {
  const zoneWidth = width / 3;

  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(zoneWidth, 0);
  ctx.lineTo(zoneWidth, height);
  ctx.moveTo(zoneWidth * 2, 0);
  ctx.lineTo(zoneWidth * 2, height);
  ctx.stroke();

  const activeBeat = Math.floor(((beatPhase % 1) + 1) % 1 * 4) % 4;
  for (let index = 0; index < 3; index += 1) {
    const x = zoneWidth * index + zoneWidth / 2;
    const y = 26;
    const isActive = index === activeBeat % 3;
    ctx.beginPath();
    ctx.fillStyle = isActive ? 'rgba(252, 211, 77, 0.95)' : 'rgba(255, 255, 255, 0.35)';
    ctx.arc(x, y, isActive ? 9 : 6, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

export function OverlayCanvas({ video, enabled = true, beatPhase = 0, onDraw }: OverlayCanvasProps) {
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
      drawOverlayGuides(ctx, width, height, beatPhase);
      if (onDraw) {
        onDraw(ctx, width, height);
      }

      rafId = window.requestAnimationFrame(render);
    };

    rafId = window.requestAnimationFrame(render);
    return () => window.cancelAnimationFrame(rafId);
  }, [beatPhase, enabled, onDraw, video]);

  return <canvas ref={canvasRef} className="overlay-canvas" aria-label="Overlay Canvas" />;
}
