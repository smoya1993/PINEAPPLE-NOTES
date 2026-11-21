/**
 * Cliente HTTP centralizado con autenticación JWT y refresco automático de sesión
 */

const rawBase = import.meta.env?.VITE_API_BASE_URL || '/api';
export const API_BASE_URL = rawBase.replace(/\/+$/, '');

class ApiService {
  constructor() {
    this.accessToken = null;
    this.refreshPromise = null;
    this.onUnauthorized = null;
  }

  setAccessToken(token) {
    this.accessToken = token || null;
  }

  getAccessToken() {
    return this.accessToken;
  }

  async refreshAccessToken() {
    if (!this.refreshPromise) {
      this.refreshPromise = (async () => {
        const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
          method: 'GET',
          credentials: 'include',
        });

        if (!res.ok) {
          this.accessToken = null;
          return null;
        }

        const data = await res.json();
        this.accessToken = data.accessToken || null;
        return data;
      })().finally(() => {
        this.refreshPromise = null;
      });
    }
    return this.refreshPromise;
  }

  async request(path, options = {}, retry = true) {
    const headers = new Headers(options.headers || {});
    if (this.accessToken) {
      headers.set('Authorization', `Bearer ${this.accessToken}`);
    }

    const isFormData = options.body instanceof FormData;
    if (!isFormData && options.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    const res = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers,
      credentials: 'include',
    });

    if ((res.status === 401 || res.status === 403) && retry && !path.startsWith('/auth/')) {
      const refreshed = await this.refreshAccessToken();
      if (refreshed?.accessToken) {
        return this.request(path, options, false);
      }
      if (this.onUnauthorized) {
        this.onUnauthorized();
      }
    }

    if (res.status === 204) {
      return null;
    }

    const contentType = res.headers.get('content-type') || '';
    const payload = contentType.includes('application/json')
      ? await res.json().catch(() => ({}))
      : await res.text();

    if (!res.ok) {
      const message =
        (typeof payload === 'object' && payload?.message) ||
        `Error HTTP ${res.status}`;
      const error = new Error(message);
      error.status = res.status;
      error.payload = payload;
      throw error;
    }

    return payload;
  }

  get(path) {
    return this.request(path, { method: 'GET' });
  }

  post(path, body) {
    return this.request(path, {
      method: 'POST',
      body: body instanceof FormData ? body : JSON.stringify(body),
    });
  }

  put(path, body) {
    return this.request(path, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }

  patch(path, body) {
    return this.request(path, {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  delete(path) {
    return this.request(path, { method: 'DELETE' });
  }
}

export const apiService = new ApiService();
