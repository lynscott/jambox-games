import { useEffect, useRef, useState } from 'react';

interface CameraViewProps {
  isRunning: boolean;
  children?: (video: HTMLVideoElement | null) => React.ReactNode;
}

export function CameraView({ isRunning, children }: CameraViewProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const stopStream = () => {
      const stream = streamRef.current;
      if (!stream) {
        return;
      }
      stream.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };

    const start = async () => {
      if (!isRunning) {
        stopStream();
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: 'user',
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });

        streamRef.current = stream;
        setErrorMessage(null);

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
      } catch {
        stopStream();
        setErrorMessage('Unable to access webcam. Check permissions and reload.');
      }
    };

    void start();

    return () => {
      stopStream();
    };
  }, [isRunning]);

  return (
    <section className="camera-view" aria-label="Camera View">
      {errorMessage ? <p className="camera-error">{errorMessage}</p> : null}
      <video ref={videoRef} className="camera-video" autoPlay muted playsInline />
      {children ? children(videoRef.current) : null}
    </section>
  );
}
