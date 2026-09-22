// pages/auth/register.page.js — Phụ trách: Thành viên A
// Chỉ Giáo viên và Học sinh được đăng ký (không có lựa chọn Admin).
import { registerTeacher, registerStudent } from "../../modules/auth/auth.service.js";
import { SUBJECTS, SUBJECT_LABELS } from "../../data/constants.js";
import { Router } from "../../core/router.js";

export function renderRegisterPage(container) {
  container.innerHTML = `
    <div class="auth-box">
      <h2>Đăng ký</h2>
      <form id="register-form">
        <label>Vai trò
          <select name="role">
            <option value="student">Học sinh</option>
            <option value="teacher">Giáo viên</option>
          </select>
        </label>
        <input name="fullName" placeholder="Họ tên" required />
        <input name="username" placeholder="Tài khoản" required />
        <input name="password" type="password" placeholder="Mật khẩu" required />
        <label id="subject-field">Môn giảng dạy
          <select name="subject">
            ${SUBJECTS.map((s) => `<option value="${s}">${SUBJECT_LABELS[s]}</option>`).join("")}
          </select>
        </label>
        <button type="submit">Đăng ký</button>
      </form>
      <p id="register-error" class="error"></p>
      <p>Đã có tài khoản? <a href="#/login">Đăng nhập</a></p>
    </div>
  `;

  const roleSelect = container.querySelector('select[name="role"]');
  const subjectField = container.querySelector("#subject-field");
  const toggleSubject = () => {
    subjectField.style.display = roleSelect.value === "teacher" ? "block" : "none";
  };
  roleSelect.addEventListener("change", toggleSubject);
  toggleSubject();

  container.querySelector("#register-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    try {
      if (form.get("role") === "teacher") {
        registerTeacher({
          username: form.get("username"),
          password: form.get("password"),
          fullName: form.get("fullName"),
          subject: form.get("subject"),
        });
      } else {
        registerStudent({
          username: form.get("username"),
          password: form.get("password"),
          fullName: form.get("fullName"),
        });
      }
      Router.navigate("/login");
    } catch (err) {
      container.querySelector("#register-error").textContent = err.message;
    }
  });
}
