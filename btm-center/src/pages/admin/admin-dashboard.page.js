// pages/admin/admin-dashboard.page.js — Phụ trách: Thành viên B
import { getAdminStats } from "../../modules/dashboard/dashboard.service.js";

export function renderAdminDashboard(container) {
  const stats = getAdminStats();
  container.innerHTML = `
    <h2>Dashboard Admin</h2>
    <div class="stats">
      <div>Giáo viên: ${stats.totalTeachers}</div>
      <div>Học sinh: ${stats.totalStudents}</div>
      <div>Lớp học: ${stats.totalClasses}</div>
    </div>
    <!-- TODO: Thành viên B bổ sung danh sách tài khoản (M2) và danh sách lớp -->
  `;
}
