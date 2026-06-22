export const PILOT_MEDIA_LIMITS = {
  photoBytes: 4 * 1024 * 1024,
  videoBytes: 12 * 1024 * 1024,
};

export function fileToDataUrl(file: File, type: 'photo' | 'video'): Promise<string> {
  return Promise.reject(new Error("Fotoğraf yükleme kalıcı medya depolama fazında açılacak. Ölçü bilgileriniz kaydedildi."));
}
