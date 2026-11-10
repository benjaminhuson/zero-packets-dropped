// Building pass photo: checks and prepares a picture taken on the phone (or picked from it) so it is
// the right shape and size for a pass. Everything runs in the browser; nothing is uploaded here.

export const PASS_PHOTO = {
  // Largest file we will even try to read. Phone photos are often 3 to 8 MB.
  maxInputBytes: 15 * 1024 * 1024,
  // Output: portrait 4:5, the usual shape for a pass photo. Head and shoulders fill most of the frame.
  width: 600,
  height: 750,
  quality: 0.86,
  // Largest saved picture. JPEG at this size is well under this limit.
  maxOutputBytes: 400 * 1024,
} as const;

export type PhotoProblem =
  | { kind: 'not-image'; message: string }
  | { kind: 'too-large'; message: string };

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

// Returns a problem to show the starter, or null if the file can be tried.
export function checkPhotoFile(file: { type: string; size: number; name: string }): PhotoProblem | null {
  const looksLikeImage = IMAGE_TYPES.includes(file.type) || /\.(jpe?g|png|webp|heic|heif)$/i.test(file.name);
  if (!looksLikeImage) {
    return { kind: 'not-image', message: 'That is not a photo we can use. Choose a JPEG, PNG or HEIC image, or take one with the camera.' };
  }
  if (file.size > PASS_PHOTO.maxInputBytes) {
    return { kind: 'too-large', message: 'That photo is too large. Choose a smaller one, or take a new photo with the camera.' };
  }
  return null;
}

// Something we can draw: a camera frame, a decoded image, or a still from a file.
export type Drawable = HTMLVideoElement | HTMLImageElement | ImageBitmap;

function sourceSize(src: Drawable): { w: number; h: number } {
  if (src instanceof HTMLVideoElement) return { w: src.videoWidth, h: src.videoHeight };
  if (src instanceof HTMLImageElement) return { w: src.naturalWidth, h: src.naturalHeight };
  return { w: src.width, h: src.height };
}

// Centre-crops to 4:5 and scales to the pass size. Returns a JPEG data URL.
export function toPassPhoto(src: Drawable): string {
  const { w, h } = sourceSize(src);
  if (!w || !h) throw new Error('The photo has no picture in it yet.');

  const target = PASS_PHOTO.width / PASS_PHOTO.height;
  let sw = w;
  let sh = h;
  if (w / h > target) sw = Math.round(h * target);
  else sh = Math.round(w / target);
  const sx = Math.round((w - sw) / 2);
  const sy = Math.round((h - sh) / 2);

  const canvas = document.createElement('canvas');
  canvas.width = PASS_PHOTO.width;
  canvas.height = PASS_PHOTO.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This browser cannot prepare the photo.');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', PASS_PHOTO.quality);
}

// Reads a picked file into something we can draw. Safari decodes HEIC; other browsers may not.
export function loadFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('This browser cannot open that photo. Take a new one with the camera instead.'));
    };
    img.src = url;
  });
}

// Approximate size of a data URL in bytes, to keep the saved picture small.
export function dataUrlBytes(dataUrl: string): number {
  const base64 = dataUrl.split(',')[1] ?? '';
  return Math.floor((base64.length * 3) / 4);
}

// Can this browser open the camera here? Needs a secure page (https or localhost).
export function cameraAvailable(): boolean {
  return typeof window !== 'undefined' && window.isSecureContext && !!navigator.mediaDevices?.getUserMedia;
}
