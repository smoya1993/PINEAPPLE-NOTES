/**
 * Servicio de Autenticación JWT (Login, Registro, Refresh, Logout)
 */

import { apiService } from './apiService.js';

class AuthService {
  constructor() {
    this.user = null;
  }

  get isAuthenticated() {
    return Boolean(this.user && apiService.getAccessToken());
  }

  getUser() {
    return this.user;
  }

  async restoreSession() {
    try {
      const data = await apiService.refreshAccessToken();
      if (data?.accessToken && data?.user) {
        this.user = data.user;
        return this.user;
      }
      this.user = null;
      return null;
    } catch {
      this.user = null;
      return null;
    }
  }

  async login(email, password) {
    const data = await apiService.post('/auth/login', { email, password });
    apiService.setAccessToken(data.accessToken);
    this.user = data.user;
    return this.user;
  }

  async register(name, email, password) {
    return apiService.post('/auth/register', { name, email, password });
  }

  async logout() {
    try {
      await apiService.post('/auth/logout', {});
    } catch {
      // Ignorar errores de red al cerrar sesión
    } finally {
      apiService.setAccessToken(null);
      this.user = null;
    }
  }
}

export const authService = new AuthService();
