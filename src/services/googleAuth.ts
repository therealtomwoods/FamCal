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
  requestAccessToken: (overrideConfig?: { prompt?: string; hint?: string }) => void;
}

export interface UserProfile {
  name: string;
  email: string;
  picture?: string;
  grantedScopes?: string;
}

const TOKEN_KEY = 'famcal_google_token';
const EXPIRY_KEY = 'famcal_token_expiry';
const USER_KEY = 'famcal_user_profile';
const SCOPES_KEY = 'famcal_granted_scopes';

let tokenClientInstance: TokenClient | null = null;
let onTokenReceivedCallback: ((token: string, profile?: UserProfile) => void) | null = null;
let onProfileReceivedCallback: ((profile: UserProfile) => void) | null = null;

// Full scopes for Calendar, Photos (Picker API + legacy), Smart Device Management (Nest), and Profile
export const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/photospicker.mediaitems.readonly',
  'https://www.googleapis.com/auth/photoslibrary.readonly',
  'https://www.googleapis.com/auth/photoslibrary',
  'https://www.googleapis.com/auth/photoslibrary.sharing',
  'https://www.googleapis.com/auth/sdm.service',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/userinfo.email',
].join(' ');

export function getStoredAccessToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function isTokenExpired(bufferMs: number = 60000): boolean {
  const expiry = localStorage.getItem(EXPIRY_KEY);
  if (!expiry) return true;
  return Date.now() > (parseInt(expiry, 10) - bufferMs);
}

export function getTokenRemainingMs(): number {
  const expiry = localStorage.getItem(EXPIRY_KEY);
  if (!expiry) return 0;
  return Math.max(0, parseInt(expiry, 10) - Date.now());
}

export function getStoredGrantedScopes(): string {
  return localStorage.getItem(SCOPES_KEY) || '';
}

export function getStoredUserProfile(): UserProfile | null {
  const stored = localStorage.getItem(USER_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      // ignore
    }
  }

  // If token is present in storage, provide baseline profile so UI stays connected
  if (localStorage.getItem(TOKEN_KEY)) {
    return {
      name: 'Google Account',
      email: 'Connected',
      grantedScopes: getStoredGrantedScopes(),
    };
  }

  return null;
}

export function clearStoredSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(EXPIRY_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(SCOPES_KEY);
  tokenClientInstance = null;
}

let isRefreshingSilent = false;
let refreshResolvers: Array<(token: string | null) => void> = [];

export function requestSilentTokenRefresh(
  clientId: string,
  onToken?: (token: string, profile?: UserProfile) => void
): Promise<string | null> {
  return new Promise((resolve) => {
    if (!clientId || clientId.trim() === '') {
      return resolve(null);
    }

    refreshResolvers.push(resolve);
    if (isRefreshingSilent) {
      return; // Refresh already in-flight, will resolve when complete
    }
    isRefreshingSilent = true;

    const finishAll = (token: string | null) => {
      isRefreshingSilent = false;
      const resolvers = [...refreshResolvers];
      refreshResolvers = [];
      resolvers.forEach((res) => res(token));
    };

    const attemptGIS = (retries = 20) => {
      if (window.google?.accounts?.oauth2) {
        try {
          tokenClientInstance = window.google.accounts.oauth2.initTokenClient({
            client_id: clientId.trim(),
            scope: GOOGLE_SCOPES,
            callback: (tokenResponse: TokenResponse) => {
              if (tokenResponse.error) {
                console.warn('Silent OAuth refresh error:', tokenResponse.error, tokenResponse.error_description);
                finishAll(null);
                return;
              }
              if (tokenResponse.access_token) {
                const expiresInMs = (tokenResponse.expires_in || 3600) * 1000;
                const expiryTime = Date.now() + expiresInMs;
                localStorage.setItem(TOKEN_KEY, tokenResponse.access_token);
                localStorage.setItem(EXPIRY_KEY, expiryTime.toString());
                if (tokenResponse.scope) {
                  localStorage.setItem(SCOPES_KEY, tokenResponse.scope);
                }

                // Preserve existing user profile name/picture if already stored
                const existing = getStoredUserProfile();
                const baselineProfile: UserProfile = {
                  name: existing?.name && existing.name !== 'Google Account' ? existing.name : 'Google Account',
                  email: existing?.email && existing.email !== 'Connected' ? existing.email : 'Connected',
                  picture: existing?.picture,
                  grantedScopes: tokenResponse.scope,
                };
                localStorage.setItem(USER_KEY, JSON.stringify(baselineProfile));

                if (onTokenReceivedCallback) {
                  onTokenReceivedCallback(tokenResponse.access_token, baselineProfile);
                }
                if (onToken) {
                  onToken(tokenResponse.access_token, baselineProfile);
                }

                fetchUserProfile(tokenResponse.access_token, tokenResponse.scope).then((fullProfile) => {
                  if (fullProfile && onProfileReceivedCallback) {
                    onProfileReceivedCallback(fullProfile);
                  }
                });

                finishAll(tokenResponse.access_token);
              } else {
                finishAll(null);
              }
            },
            error_callback: (err) => {
              console.warn('Silent Google OAuth client error:', err);
              finishAll(null);
            }
          });

          // Request access token silently with hint if user email is known
          const profile = getStoredUserProfile();
          const userEmail =
            profile?.email && profile.email !== 'Connected' && !profile.email.includes('...')
              ? profile.email
              : undefined;

          const requestConfig: { prompt: string; hint?: string } = { prompt: '' };
          if (userEmail) {
            requestConfig.hint = userEmail;
          }

          tokenClientInstance.requestAccessToken(requestConfig);

          setTimeout(() => {
            if (isRefreshingSilent) {
              console.warn('Silent token refresh timed out');
              finishAll(null);
            }
          }, 12000);
        } catch (err) {
          console.warn('Failed to start silent token refresh:', err);
          finishAll(null);
        }
      } else if (retries > 0) {
        setTimeout(() => attemptGIS(retries - 1), 250);
      } else {
        finishAll(null);
      }
    };

    attemptGIS();
  });
}

export async function ensureValidAccessToken(clientId: string): Promise<string | null> {
  const currentToken = getStoredAccessToken();
  if (currentToken && !isTokenExpired(600000)) {
    // Current token is valid for at least 10 more minutes
    return currentToken;
  }

  if (clientId && clientId.trim() !== '') {
    console.log('Access token expiring soon or expired, requesting silent renewal...');
    const freshToken = await requestSilentTokenRefresh(clientId);
    if (freshToken) return freshToken;
  }

  return currentToken;
}

export function initializeGoogleAuth(
  clientId: string,
  onSuccess?: (token: string, profile?: UserProfile) => void,
  onProfile?: (profile: UserProfile) => void
): boolean {
  if (!window.google?.accounts?.oauth2) {
    console.warn('Google Identity Services script not yet loaded.');
    return false;
  }

  if (!clientId || clientId.trim() === '') {
    return false;
  }

  if (onProfile) {
    onProfileReceivedCallback = onProfile;
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
          if (tokenResponse.scope) {
            localStorage.setItem(SCOPES_KEY, tokenResponse.scope);
          }

          // Immediately construct and save a baseline profile so user status is instantly updated
          const baselineProfile: UserProfile = {
            name: 'Google Account',
            email: 'Connected',
            grantedScopes: tokenResponse.scope,
          };
          localStorage.setItem(USER_KEY, JSON.stringify(baselineProfile));

          if (onTokenReceivedCallback) {
            onTokenReceivedCallback(tokenResponse.access_token, baselineProfile);
          }
          if (onSuccess) {
            onSuccess(tokenResponse.access_token, baselineProfile);
          }

          // Fetch full user profile asynchronously and update
          fetchUserProfile(tokenResponse.access_token, tokenResponse.scope).then((fullProfile) => {
            if (fullProfile) {
              if (onProfileReceivedCallback) {
                onProfileReceivedCallback(fullProfile);
              }
            }
          });
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

export function triggerGoogleSignIn(
  clientId: string,
  onToken?: (token: string, profile?: UserProfile) => void,
  onProfile?: (profile: UserProfile) => void
): void {
  if (onToken) {
    onTokenReceivedCallback = onToken;
  }
  if (onProfile) {
    onProfileReceivedCallback = onProfile;
  }

  // Re-create tokenClient to ensure latest GOOGLE_SCOPES are requested
  initializeGoogleAuth(clientId, onToken, onProfile);

  if (!tokenClientInstance) {
    alert('Google Identity script is initializing. Please wait 2 seconds and try again.');
    return;
  }

  // Force consent prompt so Google shows the checkboxes for Photos and Nest
  tokenClientInstance.requestAccessToken({ prompt: 'consent' });
}

export async function fetchUserProfile(token: string, grantedScopes?: string): Promise<UserProfile | null> {
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
        grantedScopes: grantedScopes || getStoredGrantedScopes(),
      };
      localStorage.setItem(USER_KEY, JSON.stringify(profile));
      return profile;
    }
  } catch (err) {
    console.error('Failed to fetch user profile:', err);
  }
  return null;
}
