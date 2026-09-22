// Google Identity Services (GIS) integration

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: TokenResponse) => void;
            error_callback?: (error: unknown) => void;
          }) => TokenClient;
        };
      };
    };
  }
}

export interface TokenResponse {
  access_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
  error?: string;
  error_description?: string;
}

export interface TokenClient {
  requestAccessToken: (overrideConfig?: { prompt?: string }) => void;
}

export interface UserProfile {
  name: string;
  email: string;
  picture?: string;
}

const TOKEN_KEY = 'famcal_google_token';
const EXPIRY_KEY = 'famcal_token_expiry';
const USER_KEY = 'famcal_user_profile';

let tokenClientInstance: TokenClient | null = null;
let onTokenReceivedCallback: ((token: string) => void) | null = null;

export const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/photoslibrary.readonly',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/userinfo.email',
].join(' ');

export function getStoredAccessToken(): string | null {
  const token = localStorage.getItem(TOKEN_KEY);
  const expiry = localStorage.getItem(EXPIRY_KEY);
  if (!token || !expiry) return null;

  if (Date.now() > parseInt(expiry, 10)) {
    // Expired
    clearStoredSession();
    return null;
  }
  return token;
}

export function getStoredUserProfile(): UserProfile | null {
  const stored = localStorage.getItem(USER_KEY);
  if (!stored) return null;
  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

export function clearStoredSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(EXPIRY_KEY);
  localStorage.removeItem(USER_KEY);
}

export function initializeGoogleAuth(
  clientId: string,
  onSuccess?: (token: string) => void
): boolean {
  if (!window.google?.accounts?.oauth2) {
    console.warn('Google Identity Services script not yet loaded.');
    return false;
  }

  if (!clientId || clientId.trim() === '') {
    return false;
  }

  try {
    tokenClientInstance = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId.trim(),
      scope: GOOGLE_SCOPES,
      callback: (tokenResponse: TokenResponse) => {
        if (tokenResponse.error) {
          console.error('OAuth error:', tokenResponse.error, tokenResponse.error_description);
          return;
        }
        if (tokenResponse.access_token) {
          const expiresInMs = (tokenResponse.expires_in || 3600) * 1000;
          const expiryTime = Date.now() + expiresInMs;
          localStorage.setItem(TOKEN_KEY, tokenResponse.access_token);
          localStorage.setItem(EXPIRY_KEY, expiryTime.toString());

          // Fetch basic profile info
          fetchUserProfile(tokenResponse.access_token);

          if (onTokenReceivedCallback) {
            onTokenReceivedCallback(tokenResponse.access_token);
          }
          if (onSuccess) {
            onSuccess(tokenResponse.access_token);
          }
        }
      },
      error_callback: (err) => {
        console.error('Google OAuth client error:', err);
      }
    });
    return true;
  } catch (err) {
    console.error('Failed to initialize Google OAuth:', err);
    return false;
  }
}

export function triggerGoogleSignIn(clientId: string, onToken?: (token: string) => void): void {
  if (onToken) {
    onTokenReceivedCallback = onToken;
  }
  if (!tokenClientInstance) {
    const initialized = initializeGoogleAuth(clientId, onToken);
    if (!initialized) {
      alert('Google Identity script is still initializing or Client ID is missing. Please check your Client ID in Settings.');
      return;
    }
  }
  tokenClientInstance?.requestAccessToken({ prompt: 'consent' });
}

export async function fetchUserProfile(token: string): Promise<UserProfile | null> {
  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.ok) {
      const data = await res.json();
      const profile: UserProfile = {
        name: data.name || data.email,
        email: data.email,
        picture: data.picture,
      };
      localStorage.setItem(USER_KEY, JSON.stringify(profile));
      return profile;
    }
  } catch (err) {
    console.error('Failed to fetch user profile:', err);
  }
  return null;
}
