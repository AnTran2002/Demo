// pages/auth/login.page.js — Phụ trách: Thành viên A
import { login } from "../../modules/auth/auth.service.js";
import { Session } from "../../core/session.js";
import { Router } from "../../core/router.js";

export function renderLoginPage(container) {
  container.innerHTML = `
    <div class="auth-box">
      <h2>Đăng nhập</h2>
      <form id="login-form">
        <input name="username" placeholder="Tài khoản" required />
        <input name="password" type="password" placeholder="Mật khẩu" required />
        <button type="submit">Đăng nhập</button>
      </form>
      <p id="login-error" class="error"></p>
      <p>Chưa có tài khoản? <a href="#/register">Đăng ký</a></p>
    </div>
  `;

  container.querySelector("#login-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    try {
      const user = login(form.get("username"), form.get("password"));
      Session.login(user);
      Router.navigate(`/${user.role}`);
    } catch (err) {
      container.querySelector("#login-error").textContent = err.message;
    }
  });
}
