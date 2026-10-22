import Constants from 'expo-constants';

function getApiBaseUrl() {
  const configuredUrl = process.env.EXPO_PUBLIC_API_URL;
  if (configuredUrl) {
    return configuredUrl.replace(/\/+$/, '');
  }

  const hostUri =
    Constants.expoConfig?.hostUri ||
    Constants.easConfig?.hostUri ||
    '';
  const developmentHost = hostUri.split(':')[0];
  const host = developmentHost || '127.0.0.1';

  return `http://${host}:8000/api`;
}

export const API_BASE_URL = getApiBaseUrl();
export const API_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, '');

export function imageUrl(path) {
  if (!path || typeof path !== 'string') {
    return null;
  }

  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  return `${API_ORIGIN}/${path.replace(/^\/+/, '')}`;
}

export async function apiGet(path, options = {}) {
  return apiRequest(path, { ...options, method: 'GET' });
}

export async function apiPost(path, body, options = {}) {
  return apiRequest(path, { ...options, method: 'POST', body });
}

export async function apiPatch(path, body, options = {}) {
  return apiRequest(path, { ...options, method: 'PATCH', body });
}

export async function apiDelete(path, options = {}) {
  return apiRequest(path, { ...options, method: 'DELETE' });
}

export async function apiRequest(path, options = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method || 'GET',
      headers: {
        Accept: 'application/json',
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: options.signal,
    });
  } catch (error) {
    if (error.name === 'AbortError') {
      throw error;
    }
    throw new Error(
      `Can't reach the GenTech API at ${API_BASE_URL}. Check that the backend is running and your phone is on the same Wi-Fi.`,
    );
  }

  if (!response.ok) {
    let message = `API request failed (${response.status})`;
    try {
      const errorBody = await response.json();
      if (typeof errorBody.detail === 'string') {
        message = errorBody.detail;
      }
    } catch {
      // Keep the HTTP status message when the server response is not JSON.
    }
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  if (response.status === 204) {
    return null;
  }
  return response.json();
}

export function getProducts(path, options) {
  return apiGet(path, options);
}
