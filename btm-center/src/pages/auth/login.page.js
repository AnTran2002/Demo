// pages/auth/login.page.js — Phụ trách: Thành viên A
import { login } from "../../modules/auth/auth.service.js";
import { Session } from "../../core/session.js";
import { Router } from "../../core/router.js";

const ICON_USER = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
const ICON_LOCK = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2.5"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`;
const ICON_EYE = `<svg class="pw-eye" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
const ICON_EYE_OFF = `<svg class="pw-eye-off" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" hidden><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;
const ICON_ALERT = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;

export function renderLoginPage(container) {
  container.innerHTML = `
    <div class="auth-page">
      <div class="auth-card">
        <header class="auth-header">
          <div class="auth-logo" aria-hidden="true">
            <img src="../assets/logo.png" alt="BTM Center">
          </div>
          <h1 class="auth-title">Trung tâm Dạy học BTM</h1>
          <p class="auth-subtitle">Chào mừng bạn quay trở lại!</p>
        </header>

        <form id="login-form" class="auth-form">
          <div class="form-field">
            <label for="login-username">Tài khoản</label>
            <div class="input-group">
              ${ICON_USER}
              <input id="login-username" name="username" placeholder="Nhập tài khoản" autocomplete="username" required />
            </div>
          </div>

          <div class="form-field">
            <label for="login-password">Mật khẩu</label>
            <div class="input-group has-toggle">
              ${ICON_LOCK}
              <input id="login-password" name="password" type="password" placeholder="Nhập mật khẩu" autocomplete="current-password" required />
              <button type="button" class="password-toggle" aria-label="Hiện hoặc ẩn mật khẩu">${ICON_EYE}${ICON_EYE_OFF}</button>
            </div>
          </div>

          <p id="login-error" class="form-error" role="alert" hidden>${ICON_ALERT}<span></span></p>

          <button type="submit" class="btn-primary" id="login-submit">
            <span class="btn-spinner" aria-hidden="true" hidden></span>
            <span class="btn-label">Đăng nhập</span>
          </button>
        </form>

        <p class="auth-switch">Chưa có tài khoản? <a href="#/register">Đăng ký ngay</a></p>

        <div class="demo-hint">
          <span class="demo-label">Tài khoản demo:</span>
          <button type="button" class="demo-chip" data-username="admin" data-password="admin123">admin / admin123</button>
        </div>
      </div>
    </div>
  `;

  const form = container.querySelector("#login-form");
  const usernameInput = container.querySelector("#login-username");
  const passwordInput = container.querySelector("#login-password");
  const errorBox = container.querySelector("#login-error");
  const errorText = errorBox.querySelector("span");
  const submitBtn = container.querySelector("#login-submit");
  const btnLabel = submitBtn.querySelector(".btn-label");
  const btnSpinner = submitBtn.querySelector(".btn-spinner");

  const passwordToggle = container.querySelector(".password-toggle");
  passwordToggle.addEventListener("click", () => {
    const show = passwordInput.type === "password";
    passwordInput.type = show ? "text" : "password";
    passwordToggle.querySelector(".pw-eye").hidden = !show;
    passwordToggle.querySelector(".pw-eye-off").hidden = show;
  });

  function showError(message) {
    errorText.textContent = message;
    errorBox.hidden = false;
    form.classList.remove("shake");
    void form.offsetWidth;
    form.classList.add("shake");
  }

  function setLoading(loading) {
    submitBtn.disabled = loading;
    btnSpinner.hidden = !loading;
    btnLabel.textContent = loading ? "Đang đăng nhập..." : "Đăng nhập";
  }

  function attemptLogin(username, password) {
    errorBox.hidden = true;
    setLoading(true);
    setTimeout(() => {
      try {
        const user = login(username, password);
        Session.login(user);
        Router.navigate(`/${user.role}`);
      } catch (err) {
        setLoading(false);
        showError(err.message);
      }
    }, 600);
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const data = new FormData(e.target);
    attemptLogin(data.get("username"), data.get("password"));
  });

  container.querySelector(".demo-chip").addEventListener("click", function () {
    usernameInput.value = this.dataset.username;
    passwordInput.value = this.dataset.password;
    attemptLogin(this.dataset.username, this.dataset.password);
  });
}
