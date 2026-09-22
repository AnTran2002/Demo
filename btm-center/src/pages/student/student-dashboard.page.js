// pages/student/student-dashboard.page.js — Phụ trách: Thành viên A/C
import { Session } from "../../core/session.js";
import { getStudentSchedule } from "../../modules/dashboard/dashboard.service.js";
import { listOpenClasses } from "../../modules/classes/classes.service.js";

export function renderStudentDashboard(container) {
  const student = Session.getCurrentUser();
  const myClasses = getStudentSchedule(student.id);
  const openClasses = listOpenClasses();

  container.innerHTML = `
    <h2>Xin chào, ${student.fullName}</h2>

    <section>
      <h3>Lịch học của tôi</h3>
      <ul>
        ${myClasses.map((c) => `<li>${c.className} (${c.subject})</li>`).join("") || "<li>Chưa đăng ký lớp nào</li>"}
      </ul>
    </section>

    <section>
      <h3>Lớp đang mở để đăng ký</h3>
      <ul>
        ${openClasses.map((c) => `<li>${c.className} (${c.subject}) — còn chỗ</li>`).join("") || "<li>Hiện chưa có lớp mở</li>"}
      </ul>
    </section>
    <!-- TODO: Thành viên C nối nút "Đăng ký" gọi enrollment.service.js -->
  `;
}
