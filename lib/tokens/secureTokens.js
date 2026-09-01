import * as SecureStore from 'expo-secure-store';

const ACCESS_TOKEN_KEY = 'mechji_admin_access_token';
const REFRESH_TOKEN_KEY = 'mechji_admin_refresh_token';

export async function saveTokens({ accessToken, refreshToken } = {}) {
  const ops = [];
  if (accessToken) ops.push(SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken));
  if (refreshToken) ops.push(SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken));
  await Promise.all(ops);
}

export async function getAccessToken() {
  try {
    return await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function getRefreshToken() {
  try {
    return await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function clearTokens() {
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY).catch(() => {}),
    SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY).catch(() => {}),
  ]);
}

export async function hasStoredSession() {
  const refreshToken = await getRefreshToken();
  return Boolean(refreshToken);
}