/**
 * FamCal Kiosk & Display Management Service
 * Manages Fullscreen mode, Screen Wake Lock (display stay-on),
 * persistent kiosk preference, and auto-recovery across system blur/screen wake.
 */

export const KIOSK_FS_PREF_KEY = 'famcal_kiosk_fullscreen_preferred';
export const KIOSK_WAKELOCK_PREF_KEY = 'famcal_kiosk_wakelock_preferred';

let activeWakeLockSentinel: any = null;

export const isBrowserFullscreen = (): boolean => {
  if (typeof document === 'undefined') return false;
  return !!(
    document.fullscreenElement ||
    (document as any).webkitFullscreenElement ||
    (document as any).mozFullScreenElement ||
    (document as any).msFullscreenElement
  );
};

export const requestBrowserFullscreen = async (): Promise<boolean> => {
  if (typeof document === 'undefined') return false;
  try {
    const docEl = document.documentElement as any;
    if (docEl.requestFullscreen) {
      await docEl.requestFullscreen();
      return true;
    } else if (docEl.webkitRequestFullscreen) {
      await docEl.webkitRequestFullscreen();
      return true;
    } else if (docEl.mozRequestFullScreen) {
      await docEl.mozRequestFullScreen();
      return true;
    } else if (docEl.msRequestFullscreen) {
      await docEl.msRequestFullscreen();
      return true;
    }
  } catch (err) {
    console.warn('requestFullscreen failed:', err);
  }
  return false;
};

export const exitBrowserFullscreen = async (): Promise<boolean> => {
  if (typeof document === 'undefined') return false;
  try {
    const doc = document as any;
    if (doc.exitFullscreen) {
      await doc.exitFullscreen();
      return true;
    } else if (doc.webkitExitFullscreen) {
      await doc.webkitExitFullscreen();
      return true;
    } else if (doc.mozCancelFullScreen) {
      await doc.mozCancelFullScreen();
      return true;
    } else if (doc.msExitFullscreen) {
      await doc.msExitFullscreen();
      return true;
    }
  } catch (err) {
    console.warn('exitFullscreen failed:', err);
  }
  return false;
};

export const isWakeLockSupported = (): boolean => {
  return typeof navigator !== 'undefined' && 'wakeLock' in navigator;
};

export const acquireScreenWakeLock = async (): Promise<boolean> => {
  if (!isWakeLockSupported()) return false;
  try {
    if (activeWakeLockSentinel && !activeWakeLockSentinel.released) {
      return true;
    }
    const sentinel = await (navigator as any).wakeLock.request('screen');
    activeWakeLockSentinel = sentinel;
    sentinel.addEventListener('release', () => {
      if (activeWakeLockSentinel === sentinel) {
        activeWakeLockSentinel = null;
      }
    });
    return true;
  } catch (err) {
    console.warn('Screen Wake Lock request failed:', err);
    return false;
  }
};

export const releaseScreenWakeLock = async (): Promise<void> => {
  if (activeWakeLockSentinel) {
    try {
      await activeWakeLockSentinel.release();
    } catch {
      // ignore
    }
    activeWakeLockSentinel = null;
  }
};

export const isWakeLockActive = (): boolean => {
  return !!(activeWakeLockSentinel && !activeWakeLockSentinel.released);
};

export const getKioskFullscreenPreferred = (): boolean => {
  if (typeof localStorage === 'undefined') return false;
  return localStorage.getItem(KIOSK_FS_PREF_KEY) === 'true';
};

export const setKioskFullscreenPreferred = (preferred: boolean): void => {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(KIOSK_FS_PREF_KEY, preferred ? 'true' : 'false');
};

export const getKioskWakeLockPreferred = (): boolean => {
  if (typeof localStorage === 'undefined') return false;
  // Default to true if user preferred fullscreen
  const stored = localStorage.getItem(KIOSK_WAKELOCK_PREF_KEY);
  if (stored !== null) return stored === 'true';
  return getKioskFullscreenPreferred();
};

export const setKioskWakeLockPreferred = (preferred: boolean): void => {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(KIOSK_WAKELOCK_PREF_KEY, preferred ? 'true' : 'false');
};
