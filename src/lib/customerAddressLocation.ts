export function validateAddressCoordinates(latitude: number, longitude: number) {
  return Number.isFinite(latitude) && latitude >= -90 && latitude <= 90 &&
    Number.isFinite(longitude) && longitude >= -180 && longitude <= 180;
}

export function captureAddressLocation({ latitude, longitude, accuracy }: GeolocationCoordinates) {
  if (!validateAddressCoordinates(latitude, longitude) || !Number.isFinite(accuracy) || accuracy < 0) {
    throw new Error("Geçersiz konum ölçümü.");
  }
  if (accuracy > 100) throw new Error(`Konum doğruluğu düşük (${Math.round(accuracy)} m). Yeniden deneyin veya konumu elle girin.`);
  return { latitude, longitude, accuracy, mapLocation: `${latitude},${longitude}` };
}

export function parseAddressMapLocation(value: string) {
  const mapLocation = value.trim();
  if (!mapLocation) return { mapLocation: undefined, latitude: undefined, longitude: undefined };
  const match = mapLocation.match(/^(-?\d+(?:\.\d+)?)\s*[,;]\s*(-?\d+(?:\.\d+)?)$/);
  if (match) {
    const latitude = Number(match[1]), longitude = Number(match[2]);
    if (!validateAddressCoordinates(latitude, longitude)) throw new Error("Enlem veya boylam geçersiz.");
    return { mapLocation: `${latitude},${longitude}`, latitude, longitude };
  }
  if (/^https?:\/\//i.test(mapLocation)) {
    const url = new URL(mapLocation);
    if (url.hostname && !url.username && !url.password) return { mapLocation, latitude: undefined, longitude: undefined };
  }
  throw new Error("Bir harita bağlantısı veya enlem,boylam girin.");
}
