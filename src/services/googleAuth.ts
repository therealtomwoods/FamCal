// Google Identity Services (GIS) integration with permanent OAuth 2.0 Refresh Token support

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
          initCodeClient: (config: {
            client_id: string;
            scope: string;
            ux_mode?: 'popup' | 'redirect';
            redirect_uri?: string;
            select_account?: boolean;
            callback: (response: CodeResponse) => void;
            error_callback?: (error: unknown) => void;
          }) => CodeClient;
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
  refresh_token?: string;
  error?: string;
  error_description?: string;
}

export interface CodeResponse {
  code: string;
  scope: string;
  error?: string;
  error_description?: string;
}

export interface TokenClient {
  requestAccessToken: (overrideConfig?: { prompt?: string; hint?: string }) => void;
}

export interface CodeClient {
  requestCode: () => void;
}

export interface UserProfile {
  name: string;
  email: string;
  picture?: string;
  grantedScopes?: string;
}

const TOKEN_KEY = 'famcal_google_token';
const REFRESH_TOKEN_KEY = 'famcal_google_refresh_token';
const CLIENT_SECRET_KEY = 'famcal_google_client_secret';
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

export function getStoredRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function hasStoredRefreshToken(): boolean {
  const rt = localStorage.getItem(REFRESH_TOKEN_KEY);
  return Boolean(rt && rt.trim().length > 0);
}

export function getStoredClientSecret(): string {
  if (
    typeof import.meta !== 'undefined' &&
    (import.meta as any).env?.VITE_GOOGLE_CLIENT_SECRET
  ) {
    return (import.meta as any).env.VITE_GOOGLE_CLIENT_SECRET;
  }
  const direct = localStorage.getItem(CLIENT_SECRET_KEY);
  if (direct && direct.trim()) return direct.trim();
  try {
    const settingsRaw = localStorage.getItem('famcal_user_settings');
    if (settingsRaw) {
      const parsed = JSON.parse(settingsRaw);
      if (parsed?.googleClientSecret) {
        return String(parsed.googleClientSecret).trim();
      }
    }
  } catch {
    // ignore
  }
  return '';
}

export function setStoredClientSecret(secret: string): void {
  const trimmed = (secret || '').trim();
  if (trimmed) {
    localStorage.setItem(CLIENT_SECRET_KEY, trimmed);
  } else {
    localStorage.removeItem(CLIENT_SECRET_KEY);
  }
}

export function isTokenExpired(bufferMs: number = 60000): boolean {
  const expiry = localStorage.getItem(EXPIRY_KEY);
  if (!expiry) return true;
  return Date.now() > parseInt(expiry, 10) - bufferMs;
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
  if (localStorage.getItem(TOKEN_KEY) || localStorage.getItem(REFRESH_TOKEN_KEY)) {
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
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(EXPIRY_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(SCOPES_KEY);
  tokenClientInstance = null;
}

function saveTokenResponse(
  tokenData: TokenResponse,
  onToken?: (token: string, profile?: UserProfile) => void
): UserProfile {
  const expiresInMs = (tokenData.expires_in || 3600) * 1000;
  const expiryTime = Date.now() + expiresInMs;
  localStorage.setItem(TOKEN_KEY, tokenData.access_token);
  localStorage.setItem(EXPIRY_KEY, expiryTime.toString());

  if (tokenData.refresh_token) {
    localStorage.setItem(REFRESH_TOKEN_KEY, tokenData.refresh_token);
  }
  if (tokenData.scope) {
    localStorage.setItem(SCOPES_KEY, tokenData.scope);
  }

  const existing = getStoredUserProfile();
  const baselineProfile: UserProfile = {
    name: existing?.name && existing.name !== 'Google Account' ? existing.name : 'Google Account',
    email: existing?.email && existing.email !== 'Connected' ? existing.email : 'Connected',
    picture: existing?.picture,
    grantedScopes: tokenData.scope || getStoredGrantedScopes(),
  };
  localStorage.setItem(USER_KEY, JSON.stringify(baselineProfile));

  if (onTokenReceivedCallback) {
    onTokenReceivedCallback(tokenData.access_token, baselineProfile);
  }
  if (onToken) {
    onToken(tokenData.access_token, baselineProfile);
  }

  fetchUserProfile(tokenData.access_token, tokenData.scope).then((fullProfile) => {
    if (fullProfile && onProfileReceivedCallback) {
      onProfileReceivedCallback(fullProfile);
    }
  });

  return baselineProfile;
}

/**
 * Exchange an OAuth 2.0 authorization code for an access_token + permanent refresh_token
 */
async function exchangeAuthCodeForTokens(
  clientId: string,
  clientSecret: string,
  code: string,
  onToken?: (token: string, profile?: UserProfile) => void
): Promise<TokenResponse | null> {
  try {
    const body = new URLSearchParams({
      code,
      client_id: clientId.trim(),
      client_secret: clientSecret.trim(),
      redirect_uri: 'postmessage',
      grant_type: 'authorization_code',
    });

    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    const data = await res.json();
    if (!res.ok || data.error) {
      console.error('OAuth code exchange error:', data.error, data.error_description);
      alert(
        `Google OAuth Token Exchange Failed: ${
          data.error_description || data.error || res.statusText
        }\n\nPlease verify that your Google OAuth Client Secret in Settings matches your Client ID.`
      );
      return null;
    }

    if (data.access_token) {
      saveTokenResponse(data as TokenResponse, onToken);
      console.log(
        data.refresh_token
          ? '✓ Obtained permanent Google OAuth refresh_token and access_token'
          : '✓ Obtained Google OAuth access_token via authorization code'
      );
      return data as TokenResponse;
    }
  } catch (err) {
    console.error('Network error exchanging OAuth authorization code:', err);
  }
  return null;
}

let isRefreshingSilent = false;
let refreshResolvers: Array<(token: string | null) => void> = [];
let lastFailedSilentRefresh = 0;
const SILENT_REFRESH_COOLDOWN_MS = 5 * 60 * 1000; // 5-minute cooldown after failed network/token refresh

/**
 * Silently renew the Google access_token in the background using the stored permanent refresh_token.
 * Makes a pure HTTP POST to https://oauth2.googleapis.com/token — NEVER opens a browser popup window.
 */
export function requestSilentTokenRefresh(
  clientId: string,
  onToken?: (token: string, profile?: UserProfile) => void,
  clientSecretOverride?: string
): Promise<string | null> {
  return new Promise((resolve) => {
    if (!clientId || clientId.trim() === '') {
      return resolve(null);
    }

    const refreshToken = getStoredRefreshToken();
    const clientSecret = (clientSecretOverride || getStoredClientSecret()).trim();

    // If we do not have a permanent refresh_token + client_secret, do NOT call
    // GIS requestAccessToken({ prompt: '' }) in the background because GIS opens a popup
    // window that gets stuck on screen asking for OAuth verification when cookies/sessions age out.
    if (!refreshToken || !clientSecret) {
      return resolve(null);
    }

    if (Date.now() - lastFailedSilentRefresh < SILENT_REFRESH_COOLDOWN_MS) {
      return resolve(null);
    }

    refreshResolvers.push(resolve);
    if (isRefreshingSilent) {
      return; // Refresh already in-flight, will resolve when complete
    }
    isRefreshingSilent = true;

    const finishAll = (token: string | null) => {
      isRefreshingSilent = false;
      if (!token) {
        lastFailedSilentRefresh = Date.now();
      } else {
        lastFailedSilentRefresh = 0;
      }
      const resolvers = [...refreshResolvers];
      refreshResolvers = [];
      resolvers.forEach((res) => res(token));
    };

    (async () => {
      try {
        const body = new URLSearchParams({
          client_id: clientId.trim(),
          client_secret: clientSecret,
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
        });

        const res = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: body.toString(),
        });

        const data = await res.json();
        if (!res.ok || data.error) {
          console.warn(
            'Background refresh_token renewal failed:',
            data.error,
            data.error_description
          );
          // If the refresh token itself was explicitly revoked or expired (e.g. 7-day Testing mode limit)
          if (data.error === 'invalid_grant') {
            console.warn(
              'Refresh token was invalidated by Google (invalid_grant). Ensure OAuth Consent Screen is set to "In production".'
            );
            localStorage.removeItem(REFRESH_TOKEN_KEY);
          }
          finishAll(null);
          return;
        }

        if (data.access_token) {
          saveTokenResponse(
            {
              access_token: data.access_token,
              expires_in: data.expires_in || 3600,
              scope: data.scope || getStoredGrantedScopes(),
              token_type: data.token_type || 'Bearer',
              refresh_token: data.refresh_token, // Usually omitted on refresh, preserved in saveTokenResponse
            },
            onToken
          );
          console.log('✓ Silently renewed Google OAuth access_token via permanent refresh_token');
          finishAll(data.access_token);
          return;
        }

        finishAll(null);
      } catch (err) {
        console.warn('Network error during silent refresh_token renewal:', err);
        finishAll(null);
      }
    })();
  });
}

export async function ensureValidAccessToken(
  clientId: string,
  clientSecret?: string
): Promise<string | null> {
  const currentToken = getStoredAccessToken();
  const hasRefresh = hasStoredRefreshToken();

  if (!currentToken && !hasRefresh) {
    return null;
  }

  if (currentToken && !isTokenExpired(600000)) {
    // Current token is valid for at least 10 more minutes
    return currentToken;
  }

  // Avoid repeated silent refresh attempts if recent failure is still within cooldown
  if (Date.now() - lastFailedSilentRefresh < SILENT_REFRESH_COOLDOWN_MS) {
    return currentToken;
  }

  if (clientId && clientId.trim() !== '') {
    console.log('Access token expiring soon or expired, renewing via background refresh_token...');
    const freshToken = await requestSilentTokenRefresh(clientId, undefined, clientSecret);
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
          saveTokenResponse(tokenResponse, onSuccess);
        }
      },
      error_callback: (err) => {
        console.error('Google OAuth client error:', err);
      },
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
  onProfile?: (profile: UserProfile) => void,
  clientSecret?: string
): void {
  if (onToken) {
    onTokenReceivedCallback = onToken;
  }
  if (onProfile) {
    onProfileReceivedCallback = onProfile;
  }

  if (!window.google?.accounts?.oauth2) {
    alert('Google Identity script is initializing. Please wait 2 seconds and try again.');
    return;
  }

  const resolvedSecret = (clientSecret ?? getStoredClientSecret()).trim();
  if (resolvedSecret) {
    setStoredClientSecret(resolvedSecret);
  }

  // Preferred: Use OAuth 2.0 Authorization Code flow when Client Secret is configured
  // so the app obtains a permanent offline `refresh_token` and never needs popups again.
  if (resolvedSecret && window.google.accounts.oauth2.initCodeClient) {
    try {
      const codeClient = window.google.accounts.oauth2.initCodeClient({
        client_id: clientId.trim(),
        scope: GOOGLE_SCOPES,
        ux_mode: 'popup',
        select_account: true,
        callback: async (codeResponse: CodeResponse) => {
          if (codeResponse.error) {
            console.error(
              'OAuth code error:',
              codeResponse.error,
              codeResponse.error_description
            );
            return;
          }
          if (codeResponse.code) {
            await exchangeAuthCodeForTokens(
              clientId.trim(),
              resolvedSecret,
              codeResponse.code,
              onToken
            );
          }
        },
        error_callback: (err) => {
          console.error('Google OAuth code client error:', err);
        },
      });
      codeClient.requestCode();
      return;
    } catch (err) {
      console.error('Failed to initialize Google Code Client, falling back to Token Client:', err);
    }
  }

  // Fallback: Token Client (1-hour access_token only) if no Client Secret was provided
  initializeGoogleAuth(clientId, onToken, onProfile);

  if (!tokenClientInstance) {
    alert('Google Identity script is initializing. Please wait 2 seconds and try again.');
    return;
  }

  // Force consent prompt so Google shows the checkboxes for Photos and Nest
  tokenClientInstance.requestAccessToken({ prompt: 'consent' });
}

export async function fetchUserProfile(
  token: string,
  grantedScopes?: string
): Promise<UserProfile | null> {
  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${token}` },
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
