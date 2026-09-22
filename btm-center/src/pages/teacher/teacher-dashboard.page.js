// pages/teacher/teacher-dashboard.page.js — Phụ trách: Thành viên A/B
import { Session } from "../../core/session.js";
import { renderShell, ICONS, formatSchedule } from "../shell.js";
import { getTeacherOverview } from "../../modules/dashboard/dashboard.service.js";
import { createClass } from "../../modules/classes/classes.service.js";
import { WEEKDAYS } from "../../data/constants.js";

const pct = (a, b) => Math.min(100, Math.round((a / (b || 1)) * 100));

const statCard = (icon, value, label) => `
  <div class="stat-card">
    <span class="stat-icon">${icon}</span>
    <div>
      <div class="stat-value">${value}</div>
      <div class="stat-label">${label}</div>
    </div>
  </div>`;

export function renderTeacherDashboard(container) {
  const teacher = Session.getCurrentUser();

  const tabs = [
    { id: "overview", label: "Tổng quan", icon: ICONS.grid, active: true, render: renderOverview },
    { id: "classes", label: "Lớp của tôi", icon: ICONS.classes, active: false, render: renderClasses },
  ];

  renderShell(container, { title: "Tổng quan", items: tabs });
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
    tabs.find((t) => t.id === id).render(content, teacher);
  }

  switchTab("overview");
}

function renderOverview(el, teacher) {
  const d = getTeacherOverview(teacher.id);

  el.innerHTML = `
    <div class="welcome-banner">
      <div>
        <h2 class="welcome-title">Xin chào, ${teacher.fullName}!</h2>
        <p class="welcome-sub">${d.totalClasses} lớp đang dạy · tổng ${d.totalStudents} học sinh theo học.</p>
      </div>
      <span class="badge subject">Môn: ${teacher.subject}</span>
    </div>

    <div class="stat-grid">
      ${statCard(ICONS.classes, d.totalClasses, "Lớp đang dạy")}
      ${statCard(ICONS.school, d.totalStudents, "Học sinh đang theo")}
    </div>

    <div class="panel mt-lg">
      <div class="panel-head">
        <h2 class="panel-title">Lớp học của tôi</h2>
        <a class="link-primary" href="#" data-go="classes">Quản lý lớp</a>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr><th>Tên lớp</th><th>Môn</th><th>Sĩ số</th><th>Lịch học</th><th>Trạng thái</th></tr>
          </thead>
          <tbody>
            ${d.classes
              .map(
                (c) => `
                  <tr>
                    <td><strong>${c.className}</strong></td>
                    <td><span class="badge subject">${c.subject}</span></td>
                    <td>
                      <span class="slot-cell">
                        <span class="slot-text">${c.enrolled}/${c.maxSlot}</span>
                        <span class="slot-bar"><i style="width:${pct(c.enrolled, c.maxSlot)}%"></i></span>
                      </span>
                    </td>
                    <td class="muted">${formatSchedule(c.schedule)}</td>
                    <td><span class="badge ${c.status === "open" ? "open" : "closed"}">${c.status === "open" ? "Đang mở" : "Đã đóng"}</span></td>
                  </tr>`
              )
              .join("")}
          </tbody>
        </table>
      </div>
      ${d.classes.length === 0 ? `<div class="empty">Bạn chưa mở lớp nào — hãy mở lớp ở mục “Lớp của tôi”.</div>` : ""}
    </div>
  `;

  el.querySelector("[data-go]").addEventListener("click", (e) => {
    e.preventDefault();
    el.closest("#app").querySelector(`.nav-item[data-tab="classes"]`)?.click();
  });
}

function renderClasses(el, teacher) {
  const d = getTeacherOverview(teacher.id);

  el.innerHTML = `
    <div class="panel mb-lg">
      <div class="panel-head">
        <h2 class="panel-title">Tạo lớp mới</h2>
      </div>
      <form id="class-create" class="form-grid">
        <div><label>Tên lớp</label><input name="className" placeholder="VD: Toán 9A" required /></div>
        <div><label>Sĩ số tối đa</label><input name="maxSlot" type="number" min="1" max="40" value="20" required /></div>
        <div><label>Thứ trong tuần</label>
          <select name="dayOfWeek">${WEEKDAYS.map((w) => `<option value="${w.value}">${w.label}</option>`).join("")}</select>
        </div>
        <div><label>Giờ bắt đầu</label><input name="start" type="time" value="18:00" required /></div>
        <div><label>Giờ kết thúc</label><input name="end" type="time" value="19:30" required /></div>
        <div class="align-end"><button class="btn btn-primary" type="submit">Tạo lớp</button></div>
      </form>
      <p id="class-error" class="form-error" role="alert" hidden></p>
    </div>

    <div class="section-title">Lớp của tôi (${d.totalClasses})</div>
    <div class="class-grid">
      ${
        d.classes.length
          ? d.classes.map(classCard).join("")
          : `<div class="empty panel">Bạn chưa mở lớp nào.</div>`
      }
    </div>
  `;

  el.querySelector("#class-create").addEventListener("submit", (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    const err = el.querySelector("#class-error");
    err.hidden = true;
    try {
      const start = form.get("start");
      const end = form.get("end");
      if (start >= end) throw new Error("Giờ kết thúc phải sau giờ bắt đầu");

      createClass(teacher, {
        className: form.get("className"),
        maxSlot: Number(form.get("maxSlot")),
        schedule: [{ dayOfWeek: Number(form.get("dayOfWeek")), start, end }],
      });
      renderClasses(el, teacher);
    } catch (err2) {
      err.textContent = err2.message;
      err.hidden = false;
    }
  });
}

const classCard = (c) => `
  <div class="class-card">
    <div class="class-top">
      <span class="badge subject">${c.subject}</span>
      <span class="badge ${c.status === "open" ? "open" : "closed"}">${c.status === "open" ? "Đang mở" : "Đã đóng"}</span>
    </div>
    <div class="class-name">${c.className}</div>
    <div class="class-meta">
      <span>${ICONS.calendar} ${formatSchedule(c.schedule)}</span>
      <span>${ICONS.users} Đã ghi danh: ${c.enrolled}/${c.maxSlot}</span>
    </div>
    <span class="slot-bar"><i style="width:${pct(c.enrolled, c.maxSlot)}%"></i></span>
  </div>`;