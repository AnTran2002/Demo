// main.js — điểm khởi động ứng dụng
import "./styles/style.css";
import { seedDatabase } from "./data/seed.js";
import { Router } from "./core/router.js";
import { Session } from "./core/session.js";

import { renderLoginPage } from "./pages/auth/login.page.js";
import { renderRegisterPage } from "./pages/auth/register.page.js";
import { renderAdminDashboard } from "./pages/admin/admin-dashboard.page.js";
import { renderTeacherDashboard } from "./pages/teacher/teacher-dashboard.page.js";
import { renderStudentDashboard } from "./pages/student/student-dashboard.page.js";

seedDatabase();

Router.registerRoute("/login", renderLoginPage);
Router.registerRoute("/register", renderRegisterPage);

Router.registerRoute("/admin", (container) => {
  if (!Session.requireRole("admin")) return Router.navigate("/login");
  renderAdminDashboard(container);
});

Router.registerRoute("/teacher", (container) => {
  if (!Session.requireRole("teacher")) return Router.navigate("/login");
  renderTeacherDashboard(container);
});

Router.registerRoute("/student", (container) => {
  if (!Session.requireRole("student")) return Router.navigate("/login");
  renderStudentDashboard(container);
});

Router.registerRoute("/not-found", (container) => {
  container.innerHTML = "<h2>404 - Không tìm thấy trang</h2>";
});

Router.initRouter();
