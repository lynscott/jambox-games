import { type ReactNode, useEffect, useRef, useState } from 'react';

interface CameraViewProps {
  isRunning: boolean;
  children?: (video: HTMLVideoElement | null) => ReactNode;
  onVideoElementChange?: (video: HTMLVideoElement | null) => void;
}

const CAMERA_HANDOFF_GRACE_MS = 750;

let sharedStream: MediaStream | null = null;
let pendingStream: Promise<MediaStream> | null = null;
let activeConsumers = 0;
let releaseTimer: number | null = null;
let sharedVideoElement: HTMLVideoElement | null = null;

function clearReleaseTimer() {
  if (releaseTimer !== null) {
    window.clearTimeout(releaseTimer);
    releaseTimer = null;
  }
}

function retainStreamConsumer() {
  activeConsumers += 1;
  clearReleaseTimer();
}

function releaseStreamConsumer() {
  activeConsumers = Math.max(0, activeConsumers - 1);

  if (activeConsumers > 0) {
    return;
  }

  clearReleaseTimer();
  releaseTimer = window.setTimeout(() => {
    if (activeConsumers > 0) {
      return;
    }

    if (sharedStream) {
      sharedStream.getTracks().forEach((track) => track.stop());
      sharedStream = null;
    }
    releaseTimer = null;
  }, CAMERA_HANDOFF_GRACE_MS);
}

async function acquireSharedStream(): Promise<MediaStream> {
  clearReleaseTimer();
  if (sharedStream) {
    return sharedStream;
  }

  if (!pendingStream) {
    pendingStream = navigator.mediaDevices
      .getUserMedia({
        audio: false,
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      })
      .then((stream) => {
        sharedStream = stream;
        return stream;
      })
      .finally(() => {
        pendingStream = null;
      });
  }

  return pendingStream;
}

function getSharedVideoElement() {
  if (sharedVideoElement) {
    return sharedVideoElement;
  }

  const video = document.createElement('video');
  video.className = 'camera-video';
  video.autoplay = true;
  video.muted = true;
  video.playsInline = true;
  sharedVideoElement = video;
  return video;
}

export function __resetCameraViewSharedStateForTests() {
  clearReleaseTimer();
  if (sharedStream) {
    sharedStream.getTracks().forEach((track) => track.stop());
  }
  if (sharedVideoElement) {
    sharedVideoElement.pause();
    sharedVideoElement.srcObject = null;
    sharedVideoElement.remove();
  }
  sharedStream = null;
  pendingStream = null;
  activeConsumers = 0;
  sharedVideoElement = null;
}

export function CameraView({ isRunning, children, onVideoElementChange }: CameraViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const hasConsumerRef = useRef(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const video = getSharedVideoElement();
    if (video.parentElement !== container) {
      container.innerHTML = '';
      container.appendChild(video);
    }

    onVideoElementChange?.(video);

    return () => {
      if (video.parentElement === container) {
        container.removeChild(video);
      }
    };
  }, [onVideoElementChange]);

  useEffect(() => {
    let cancelled = false;

    const start = async () => {
      if (!isRunning) {
        if (hasConsumerRef.current) {
          releaseStreamConsumer();
          hasConsumerRef.current = false;
        }
        return;
      }

      try {
        if (!hasConsumerRef.current) {
          retainStreamConsumer();
          hasConsumerRef.current = true;
        }

        const stream = await acquireSharedStream();
        if (cancelled) {
          return;
        }
        setErrorMessage(null);

        const video = getSharedVideoElement();
        video.srcObject = stream;
        await video.play();
        if (cancelled) {
          return;
        }
        onVideoElementChange?.(video);
      } catch {
        if (hasConsumerRef.current) {
          releaseStreamConsumer();
          hasConsumerRef.current = false;
        }
        setErrorMessage('Unable to access webcam. Check permissions and reload.');
      }
    };

    void start();

    return () => {
      cancelled = true;
      if (hasConsumerRef.current) {
        releaseStreamConsumer();
        hasConsumerRef.current = false;
      }
    };
  }, [isRunning, onVideoElementChange]);

  return (
    <section className="camera-view" aria-label="Camera View">
      {errorMessage ? <p className="camera-error">{errorMessage}</p> : null}
      <div ref={containerRef} className="camera-video-host" />
      {children ? children(sharedVideoElement) : null}
    </section>
  );
}
