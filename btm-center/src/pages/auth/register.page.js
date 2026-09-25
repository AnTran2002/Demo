// pages/auth/register.page.js — Phụ trách: Thành viên A
// Chỉ Giáo viên và Học sinh được đăng ký (không có lựa chọn Admin).
import { registerTeacher, registerStudent } from "../../modules/auth/auth.service.js";
import { SUBJECTS, SUBJECT_LABELS } from "../../data/constants.js";
import { Router } from "../../core/router.js";

export function renderRegisterPage(container) {
  container.innerHTML = `
    <div class="auth-page">
      <div class="auth-card">
        <header class="auth-header">
          <div class="auth-logo" aria-hidden="true">
            <svg viewBox="0 0 48 46" fill="currentColor"><path d="M25.946 44.938c-.664.845-2.021.375-2.021-.698V33.937a2.26 2.26 0 0 0-2.262-2.262H10.287c-.92 0-1.456-1.04-.92-1.788l7.48-10.471c1.07-1.497 0-3.578-1.842-3.578H1.237c-.92 0-1.456-1.04-.92-1.788L10.013.474c.214-.297.556-.474.92-.474h28.894c.92 0 1.456 1.04.92 1.788l-7.48 10.471c-1.07 1.498 0 3.579 1.842 3.579h11.377c.943 0 1.473 1.088.89 1.83L25.947 44.94z"/></svg>
          </div>
          <h1 class="auth-title">Tạo tài khoản</h1>
          <p class="auth-subtitle">Đăng ký để bắt đầu sử dụng hệ thống</p>
        </header>

        <form id="register-form" class="auth-form">
          <div class="form-field">
            <label for="reg-role">Vai trò</label>
            <select id="reg-role" name="role">
              <option value="student">Học sinh</option>
              <option value="teacher">Giáo viên</option>
            </select>
          </div>

          <div class="form-field">
            <label for="reg-name">Họ tên</label>
            <input id="reg-name" name="fullName" placeholder="Nhập họ tên" required />
          </div>

          <div class="form-row">
            <div class="form-field">
              <label for="reg-gender">Giới tính</label>
              <select id="reg-gender" name="gender" required>
                <option value="" disabled selected>Chọn giới tính</option>
                <option value="Nam">Nam</option>
                <option value="Nữ">Nữ</option>
              </select>
            </div>
            <div class="form-field">
              <label for="reg-dob">Ngày sinh</label>
              <input id="reg-dob" name="dob" type="date" max="${new Date().toISOString().slice(0, 10)}" required />
            </div>
          </div>

          <div class="form-field">
            <label for="reg-email">Gmail (duy nhất)</label>
            <input id="reg-email" name="email" type="email" placeholder="VD: nguyenvanhung@gmail.com" autocomplete="email" required />
          </div>

          <div class="form-field">
            <label for="reg-username">Tài khoản</label>
            <input id="reg-username" name="username" placeholder="Nhập tài khoản" required />
          </div>

          <div class="form-field">
            <label for="reg-password">Mật khẩu</label>
            <input id="reg-password" name="password" type="password" placeholder="8–16 ký tự" autocomplete="new-password" required />
            <span class="form-hint">8–16 ký tự, gồm chữ hoa, chữ thường, số và ký tự đặc biệt.</span>
          </div>

          <div class="form-field">
            <label for="reg-confirm">Xác nhận mật khẩu</label>
            <input id="reg-confirm" name="confirmPassword" type="password" placeholder="Nhập lại mật khẩu" autocomplete="new-password" required />
          </div>

          <div class="form-field" id="subject-field">
            <label for="reg-subject">Môn giảng dạy</label>
            <select id="reg-subject" name="subject">
              ${SUBJECTS.map((s) => `<option value="${s}">${SUBJECT_LABELS[s]}</option>`).join("")}
            </select>
          </div>

          <p id="register-error" class="form-error" role="alert" hidden></p>

          <button type="submit" class="btn-primary">Đăng ký</button>
        </form>

        <p class="auth-switch">Đã có tài khoản? <a href="#/login">Đăng nhập</a></p>
      </div>
    </div>
  `;

  const roleSelect = container.querySelector("#reg-role");
  const subjectField = container.querySelector("#subject-field");
  const toggleSubject = () => {
    subjectField.style.display = roleSelect.value === "teacher" ? "flex" : "none";
  };
  roleSelect.addEventListener("change", toggleSubject);
  toggleSubject();

  const PASSWORD_RE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,16}$/;

  container.querySelector("#register-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    const errorBox = container.querySelector("#register-error");
    errorBox.hidden = true;
    try {
      const password = form.get("password");
      const confirm = form.get("confirmPassword");
      const dob = form.get("dob");
      if (!PASSWORD_RE.test(password)) {
        throw new Error("Mật khẩu phải 8–16 ký tự, gồm chữ hoa, chữ thường, số và ký tự đặc biệt");
      }
      if (password !== confirm) {
        throw new Error("Xác nhận mật khẩu không khớp");
      }
      if (!dob || new Date(dob) >= new Date()) {
        throw new Error("Ngày sinh không hợp lệ");
      }

      const base = {
        username: form.get("username"),
        password,
        email: form.get("email"),
        fullName: form.get("fullName"),
        gender: form.get("gender"),
        dob,
      };

      if (form.get("role") === "teacher") {
        registerTeacher({ ...base, subject: form.get("subject") });
      } else {
        registerStudent(base);
      }
      Router.navigate("/login");
    } catch (err) {
      errorBox.textContent = err.message;
      errorBox.hidden = false;
    }
  });
}