// pages/student/student-dashboard.page.js — Phụ trách: Thành viên A/C
import { Session } from "../../core/session.js";
import { renderShell, ICONS, formatSchedule } from "../shell.js";
import { getStudentOverview } from "../../modules/dashboard/dashboard.service.js";
import { enroll, cancelEnrollment } from "../../modules/enrollment/enrollment.service.js";

const statCard = (icon, value, label) => `
  <div class="stat-card">
    <span class="stat-icon">${icon}</span>
    <div>
      <div class="stat-value">${value}</div>
      <div class="stat-label">${label}</div>
    </div>
  </div>`;

export function renderStudentDashboard(container) {
  const student = Session.getCurrentUser();

  const tabs = [
    { id: "overview", label: "Lịch học", icon: ICONS.calendar, active: true, render: renderOverview },
    { id: "enroll", label: "Đăng ký lớp", icon: ICONS.classes, active: false, render: renderEnroll },
  ];

  renderShell(container, { title: "Lịch học", items: tabs });
  const content = container.querySelector("#tab-content");

  container
    .querySelectorAll(".nav-item[data-tab]")
    .forEach((btn) => btn.addEventListener("click", () => switchTab(btn.dataset.tab)));

  function switchTab(id) {
    container
      .querySelectorAll(".nav-item[data-tab]")
      .forEach((b) => b.classList.toggle("active", b.dataset.tab === id));
    container.querySelector("#page-title").textContent =
      tabs.find((t) => t.id === id).label;
    tabs.find((t) => t.id === id).render(content, student);
  }

  switchTab("overview");
}

function renderOverview(el, student) {
  const d = getStudentOverview(student.id);

  el.innerHTML = `
    <div class="welcome-banner">
      <div>
        <h2 class="welcome-title">Xin chào, ${student.fullName}!</h2>
        <p class="welcome-sub">Bạn đang theo học ${d.myClasses.length} lớp trong trung tâm.</p>
      </div>
      <span class="badge student">Học sinh</span>
    </div>

    <div class="stat-grid">
      ${statCard(ICONS.classes, d.myClasses.length, "Lớp đang học")}
      ${statCard(ICONS.school, d.openClasses.length, "Lớp đang mở")}
    </div>

    <div class="section-title">Lịch học của tôi</div>
    ${
      d.myClasses.length
        ? `<div class="class-grid">${d.myClasses.map(myClassCard).join("")}</div>`
        : `<div class="empty panel">Bạn chưa đăng ký lớp nào. Hãy vào mục “Đăng ký lớp” để bắt đầu.</div>`
    }
  `;

  el.querySelectorAll("[data-cancel]").forEach((btn) =>
    btn.addEventListener("click", () => {
      cancelEnrollment(btn.dataset.cancel);
      renderOverview(el, student);
    })
  );
}

const myClassCard = (c) => `
  <div class="class-card">
    <div class="class-top">
      <span class="badge subject">${c.subject}</span>
      <span class="badge ${c.status === "open" ? "open" : "closed"}">${c.status === "open" ? "Đang mở" : "Đã đóng"}</span>
    </div>
    <div class="class-name">${c.className}</div>
    <div class="class-meta">
      <span>${ICONS.calendar} ${formatSchedule(c.schedule)}</span>
      <span>${ICONS.users} Sĩ số: ${c.enrolled}/${c.maxSlot}</span>
    </div>
    <div class="class-actions">
      <button class="btn btn-sm btn-danger" data-cancel="${c.enrollmentId}">Hủy đăng ký</button>
    </div>
  </div>`;

function renderEnroll(el, student) {
  const d = getStudentOverview(student.id);

  el.innerHTML = `
    <div class="section-title">Lớp đang mở để đăng ký</div>
    <p id="enroll-message" class="form-error" role="alert" hidden></p>
    ${
      d.openClasses.length
        ? `<div class="class-grid">${d.openClasses.map((c) => openClassCard(c)).join("")}</div>`
        : `<div class="empty panel">Hiện chưa có lớp nào đang mở.</div>`
    }
  `;

  const flash = (msg) => {
    const box = el.querySelector("#enroll-message");
    box.textContent = msg;
    box.hidden = false;
    setTimeout(() => (box.hidden = true), 2500);
  };

  el.querySelectorAll("[data-enroll]").forEach((btn) =>
    btn.addEventListener("click", () => {
      try {
        enroll(student.id, btn.dataset.enroll);
        renderEnroll(el, student);
      } catch (err) {
        flash(err.message);
      }
    })
  );

  el.querySelectorAll("[data-cancel]").forEach((btn) =>
    btn.addEventListener("click", () => {
      cancelEnrollment(btn.dataset.cancel);
      renderEnroll(el, student);
    })
  );
}

const openClassCard = (c) => `
  <div class="class-card ${c.isEnrolled ? "enrolled" : ""}">
    <div class="class-top">
      <span class="badge subject">${c.subject}</span>
      ${c.isEnrolled ? `<span class="badge active">Đang học</span>` : `<span class="badge open">Còn chỗ</span>`}
    </div>
    <div class="class-name">${c.className}</div>
    <div class="class-meta">
      <span>${ICONS.calendar} ${formatSchedule(c.schedule)}</span>
      <span>${ICONS.users} Đã ghi danh: ${c.enrolled}/${c.maxSlot}</span>
    </div>
    <div class="class-actions">
      ${
        c.isEnrolled
          ? `<button class="btn btn-sm btn-danger" data-cancel="${c.enrollmentId}">Hủy đăng ký</button>`
          : (c.enrolled >= c.maxSlot
              ? `<button class="btn btn-sm" disabled>Đã đủ chỗ</button>`
              : `<button class="btn btn-sm btn-primary" data-enroll="${c.id}">Đăng ký</button>`)
      }
    </div>
  </div>`;