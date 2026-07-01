/**
 * deviceIdentity.ts
 * Generates and stores a unique, persistent device ID for sync tracking.
 */

const DEVICE_ID_KEY = 'ceylin_device_id';

export function getDeviceId(): string {
  if (typeof window === 'undefined') return 'server';
  
  let deviceId = localStorage.getItem(DEVICE_ID_KEY);
  if (!deviceId) {
    deviceId = (typeof crypto !== 'undefined' && crypto.randomUUID) 
      ? crypto.randomUUID() 
      : 'dev-' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
  }
  return deviceId;
}
