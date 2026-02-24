import { useEffect, useRef } from 'react';

interface OverlayCanvasProps {
  video: HTMLVideoElement | null;
  enabled?: boolean;
  onDraw?: (ctx: CanvasRenderingContext2D, width: number, height: number) => void;
}

export function OverlayCanvas({ video, enabled = true, onDraw }: OverlayCanvasProps) {
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
      if (onDraw) {
        onDraw(ctx, width, height);
      }

      rafId = window.requestAnimationFrame(render);
    };

    rafId = window.requestAnimationFrame(render);
    return () => window.cancelAnimationFrame(rafId);
  }, [enabled, onDraw, video]);

  return <canvas ref={canvasRef} className="overlay-canvas" aria-label="Overlay Canvas" />;
}
