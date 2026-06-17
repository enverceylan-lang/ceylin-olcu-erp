export const PILOT_MEDIA_LIMITS = {
  photoBytes: 4 * 1024 * 1024,
  videoBytes: 12 * 1024 * 1024,
};

export function fileToDataUrl(file: File, type: 'photo' | 'video'): Promise<string> {
  const maxBytes = type === 'photo' ? PILOT_MEDIA_LIMITS.photoBytes : PILOT_MEDIA_LIMITS.videoBytes;

  if (file.size > maxBytes) {
    const maxMb = Math.round(maxBytes / 1024 / 1024);
    throw new Error(`${type === 'photo' ? 'Fotoğraf' : 'Video'} en fazla ${maxMb} MB olabilir.`);
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('Dosya okunamadı.'));
    };
    reader.onerror = () => reject(new Error('Dosya okunamadı.'));
    reader.readAsDataURL(file);
  });
}
