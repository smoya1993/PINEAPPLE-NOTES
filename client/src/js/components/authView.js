/**
 * Vista de Autenticación (Login y Registro) integrada con JWT + PostgreSQL
 */

import { authService } from '../services/authService.js';
import { $ } from '../utils/dom.js';
import { toastSuccess, toastError } from '../utils/toast.js';

class AuthView {
  constructor() {
    this.mode = 'login'; // 'login' | 'register'
    this.onAuthenticated = null;
  }

  init(onAuthenticated) {
    this.onAuthenticated = onAuthenticated;

    const form = $('authForm');
    const switchBtn = $('authSwitchBtn');

    if (switchBtn) {
      switchBtn.addEventListener('click', () => {
        this.setMode(this.mode === 'login' ? 'register' : 'login');
      });
    }

    if (form) {
      form.addEventListener('submit', (e) => this.handleSubmit(e));
    }

    this.setMode('login');
  }

  setMode(mode) {
    this.mode = mode;
    const isRegister = mode === 'register';

    const title = $('authTitle');
    const subtitle = $('authSubtitle');
    const nameField = $('authNameField');
    const nameInput = $('authName');
    const submitBtn = $('authSubmitBtn');
    const switchText = $('authSwitchText');
    const switchBtn = $('authSwitchBtn');
    const errorBox = $('authError');

    if (title) title.textContent = isRegister ? 'Crear cuenta en Pineapple Notes' : 'Inicia sesión en Pineapple Notes';
    if (subtitle) {
      subtitle.textContent = isRegister
        ? 'Tus notas, tareas y reuniones se guardarán de forma segura en PostgreSQL.'
        : 'Accede a tu espacio de notas sincronizado con PostgreSQL.';
    }
    if (nameField) nameField.hidden = !isRegister;
    if (nameInput) nameInput.required = isRegister;
    if (submitBtn) submitBtn.textContent = isRegister ? 'Crear cuenta' : 'Entrar';
    if (switchText) switchText.textContent = isRegister ? '¿Ya tienes cuenta?' : '¿No tienes cuenta todavía?';
    if (switchBtn) switchBtn.textContent = isRegister ? 'Iniciar sesión' : 'Regístrate';
    if (errorBox) {
      errorBox.hidden = true;
      errorBox.textContent = '';
    }
  }

  show(message = '') {
    const gate = $('authGate');
    const errorBox = $('authError');
    if (gate) gate.classList.remove('hidden');
    if (errorBox) {
      errorBox.hidden = !message;
      errorBox.textContent = message;
    }
  }

  hide() {
    const gate = $('authGate');
    if (gate) gate.classList.add('hidden');
  }

  async handleSubmit(e) {
    e.preventDefault();

    const name = $('authName')?.value.trim() || '';
    const email = $('authEmail')?.value.trim() || '';
    const password = $('authPassword')?.value || '';
    const submitBtn = $('authSubmitBtn');
    const errorBox = $('authError');

    if (errorBox) {
      errorBox.hidden = true;
      errorBox.textContent = '';
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = this.mode === 'register' ? 'Creando cuenta...' : 'Entrando...';
    }

    try {
      if (this.mode === 'register') {
        await authService.register(name, email, password);
        toastSuccess('Cuenta creada correctamente. Iniciando sesión...');
      }

      const user = await authService.login(email, password);
      this.hide();
      $('authPassword').value = '';

      if (this.onAuthenticated) {
        await this.onAuthenticated(user);
      }
    } catch (err) {
      const msg = err.message || 'No se pudo completar la autenticación';
      if (errorBox) {
        errorBox.hidden = false;
        errorBox.textContent = msg;
      }
      toastError(msg);
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = this.mode === 'register' ? 'Crear cuenta' : 'Entrar';
      }
    }
  }
}

export const authView = new AuthView();
