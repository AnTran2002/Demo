// pages/teacher/teacher-dashboard.page.js — Phụ trách: Thành viên A/B
import { Session } from "../../core/session.js";
import { getTeacherSchedule } from "../../modules/dashboard/dashboard.service.js";

export function renderTeacherDashboard(container) {
  const teacher = Session.getCurrentUser();
  const classes = getTeacherSchedule(teacher.id);

  container.innerHTML = `
    <h2>Lịch giảng dạy — ${teacher.fullName}</h2>
    <ul>
      ${classes
        .map(
          (c) => `<li>${c.className} (${c.subject}) — Sĩ số tối đa: ${c.maxSlot}</li>`
        )
        .join("") || "<li>Chưa có lớp nào</li>"}
    </ul>
    <!-- TODO: hiển thị lịch theo tuần, trạng thái điểm danh từng buổi (M9 FR-9.2) -->
  `;
}
