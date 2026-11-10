import { useEffect, useRef, useState } from 'react';
import { PASS_PHOTO, cameraAvailable, checkPhotoFile, dataUrlBytes, loadFile, toPassPhoto } from '../photo';

type Props = {
  // The saved picture, if the starter has already taken one
  savedPhoto: string | null;
  onSave: (dataUrl: string, name: string) => void;
};

type Mode =
  | { kind: 'start' }
  | { kind: 'live' }
  | { kind: 'review'; dataUrl: string }
  | { kind: 'denied'; reason: 'blocked' | 'no-camera' | 'insecure' | 'failed'; detail?: string }
  | { kind: 'saved'; dataUrl: string };

// Takes or chooses the building pass photo. The camera only starts after the starter taps "Use camera",
// so the browser's permission prompt always follows a clear reason.
export function PassPhotoCapture({ savedPhoto, onSave }: Props) {
  const [mode, setMode] = useState<Mode>(() => (savedPhoto ? { kind: 'saved', dataUrl: savedPhoto } : { kind: 'start' }));
  const [message, setMessage] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  // Always release the camera when leaving the screen
  useEffect(() => stopCamera, []);

  const startCamera = async () => {
    setMessage(null);
    if (!cameraAvailable()) {
      setMode({ kind: 'denied', reason: window.isSecureContext ? 'no-camera' : 'insecure' });
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 1600 } },
      });
      streamRef.current = stream;
      setMode({ kind: 'live' });
    } catch (err) {
      const name = err instanceof DOMException ? err.name : '';
      if (name === 'NotAllowedError' || name === 'SecurityError') setMode({ kind: 'denied', reason: 'blocked' });
      else if (name === 'NotFoundError' || name === 'OverconstrainedError') setMode({ kind: 'denied', reason: 'no-camera' });
      else setMode({ kind: 'denied', reason: 'failed', detail: err instanceof Error ? err.message : undefined });
    }
  };

  // Attach the stream to the video element once it is on screen
  useEffect(() => {
    if (mode.kind !== 'live') return;
    const video = videoRef.current;
    const stream = streamRef.current;
    if (!video || !stream) return;
    video.srcObject = stream;
    void video.play().catch(() => undefined);
  }, [mode.kind]);

  const takePhoto = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) {
      setMessage('The camera is still starting. Try again in a moment.');
      return;
    }
    try {
      const dataUrl = toPassPhoto(video);
      stopCamera();
      setMode({ kind: 'review', dataUrl });
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Could not take the photo. Try again.');
    }
  };

  const chooseFile = async (file: File | undefined) => {
    if (!file) return;
    setMessage(null);
    const problem = checkPhotoFile(file);
    if (problem) {
      setMessage(problem.message);
      return;
    }
    try {
      const img = await loadFile(file);
      const dataUrl = toPassPhoto(img);
      if (dataUrlBytes(dataUrl) > PASS_PHOTO.maxOutputBytes) throw new Error('That photo is too detailed to save. Try another, or take a new one.');
      setMode({ kind: 'review', dataUrl });
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Could not use that photo. Try another.');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const useThis = (dataUrl: string) => {
    onSave(dataUrl, 'building-pass-photo.jpg');
    setMode({ kind: 'saved', dataUrl });
  };

  const fileInput = (
    <input
      ref={fileRef}
      type="file"
      accept="image/*"
      capture="user"
      className="visually-hidden"
      id="pass-photo-file"
      onChange={(e) => void chooseFile(e.target.files?.[0])}
    />
  );

  if (mode.kind === 'start') {
    return (
      <div className="pass-photo">
        {fileInput}
        <p className="pass-photo-why">
          Your building pass needs a clear photo of your face, looking straight at the camera, with nothing covering your face.
          Stride asks your phone for camera access to take it. The photo stays on this device until you send it.
        </p>
        <div className="pass-photo-actions">
          <button className="btn primary" onClick={() => void startCamera()}>
            Use my camera
          </button>
          <label className="btn outline" htmlFor="pass-photo-file">
            Choose a photo instead
          </label>
        </div>
        {message && <p className="pass-photo-notice" role="status">{message}</p>}
      </div>
    );
  }

  if (mode.kind === 'live') {
    return (
      <div className="pass-photo">
        <div className="pass-photo-frame">
          <video ref={videoRef} className="pass-photo-video" playsInline muted autoPlay aria-label="Camera preview" />
          <div className="pass-photo-guide" aria-hidden="true" />
        </div>
        <p className="pass-photo-why">Line your face up inside the outline. Good light from the front helps.</p>
        <div className="pass-photo-actions">
          <button className="btn primary" onClick={takePhoto}>
            Take photo
          </button>
          <button
            className="btn outline"
            onClick={() => {
              stopCamera();
              setMode({ kind: 'start' });
            }}
          >
            Cancel
          </button>
        </div>
        {message && <p className="pass-photo-notice" role="status">{message}</p>}
      </div>
    );
  }

  if (mode.kind === 'review') {
    return (
      <div className="pass-photo">
        <img className="pass-photo-still" src={mode.dataUrl} alt="Your building pass photo" width={PASS_PHOTO.width / 3} height={PASS_PHOTO.height / 3} />
        <p className="pass-photo-why">Check your face is clear and fills the outline. You can retake it if not.</p>
        <div className="pass-photo-actions">
          <button className="btn primary" onClick={() => useThis(mode.dataUrl)}>
            Use this photo
          </button>
          <button className="btn outline" onClick={() => void startCamera()}>
            Retake
          </button>
        </div>
      </div>
    );
  }

  if (mode.kind === 'saved') {
    return (
      <div className="pass-photo">
        {fileInput}
        <img className="pass-photo-still" src={mode.dataUrl} alt="Your building pass photo" width={PASS_PHOTO.width / 3} height={PASS_PHOTO.height / 3} />
        <p className="status">Photo saved. It has been sent for your building pass.</p>
        <div className="pass-photo-actions">
          <button className="btn outline" onClick={() => void startCamera()}>
            Retake with camera
          </button>
          <label className="btn outline" htmlFor="pass-photo-file">
            Choose a different photo
          </label>
        </div>
        {message && <p className="pass-photo-notice" role="status">{message}</p>}
      </div>
    );
  }

  // denied
  const reasons: Record<'blocked' | 'no-camera' | 'insecure' | 'failed', string> = {
    blocked: 'Camera access is off for Stride. You can turn it on in your phone settings, or choose a photo instead.',
    'no-camera': 'No camera found on this device. You can choose a photo instead.',
    insecure: 'The camera needs a secure connection here. You can choose a photo instead.',
    failed: 'The camera did not start. Try again, or choose a photo instead.',
  };
  return (
    <div className="pass-photo">
      {fileInput}
      <p className="pass-photo-notice" role="status">{reasons[mode.reason]}</p>
      <div className="pass-photo-actions">
        {mode.reason !== 'no-camera' && mode.reason !== 'insecure' && (
          <button className="btn outline" onClick={() => void startCamera()}>
            Try again
          </button>
        )}
        <label className="btn primary" htmlFor="pass-photo-file">
          Choose a photo instead
        </label>
      </div>
      {message && <p className="pass-photo-notice" role="status">{message}</p>}
    </div>
  );
}
