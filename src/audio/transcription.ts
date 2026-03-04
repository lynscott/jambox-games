import { getLobbyHttpBaseUrl } from '../network/httpBase';

const AUDIO_MIME_TYPES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
  'audio/ogg;codecs=opus',
];

function wait(ms: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function blobToBase64(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const base64 = result.split(',')[1] || '';
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('Could not read audio blob.'));
    reader.readAsDataURL(blob);
  });
}

export function pickSupportedAudioMimeType() {
  if (typeof MediaRecorder === 'undefined') {
    return '';
  }

  return AUDIO_MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type)) || '';
}

export async function recordAudioClip(stream: MediaStream, mimeType: string, durationMs: number) {
  const recorder = new MediaRecorder(stream, { mimeType });
  const chunks: Blob[] = [];

  return new Promise<Blob>((resolve, reject) => {
    recorder.addEventListener('dataavailable', (event) => {
      if (event.data && event.data.size > 0) {
        chunks.push(event.data);
      }
    });

    recorder.addEventListener('error', () => {
      reject(new Error('Audio recording failed.'));
    });

    recorder.addEventListener('stop', () => {
      resolve(new Blob(chunks, { type: mimeType }));
    });

    recorder.start();
    void wait(durationMs).then(() => {
      if (recorder.state !== 'inactive') {
        recorder.stop();
      }
    });
  });
}

export async function transcribeAudioBlob(blob: Blob, prompt?: string) {
  const audioBase64 = await blobToBase64(blob);
  const response = await fetch(`${getLobbyHttpBaseUrl()}/api/transcribe`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      audioBase64,
      mimeType: blob.type || 'audio/webm',
      prompt: prompt || '',
    }),
  });

  const data = (await response.json().catch(() => null)) as { text?: string; error?: string } | null;
  if (!response.ok) {
    throw new Error(data?.error || 'Transcription failed.');
  }

  return String(data?.text || '').trim();
}
