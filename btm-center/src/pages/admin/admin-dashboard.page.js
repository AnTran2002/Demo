// pages/admin/admin-dashboard.page.js — Phụ trách: Thành viên B
import { renderShell, ICONS, formatSchedule, ROLE_LABELS } from "../shell.js";
import { getAdminOverview, getAdminAccountClasses } from "../../modules/dashboard/dashboard.service.js";
import { toggleActive } from "../../modules/users/users.service.js";
import { subjectLabel } from "../../data/constants.js";

const pct = (a, b) => Math.min(100, Math.round((a / (b || 1)) * 100));

const statCard = (icon, value, label) => `
  <div class="stat-card">
    <span class="stat-icon">${icon}</span>
    <div>
      <div class="stat-value">${value}</div>
      <div class="stat-label">${label}</div>
    </div>
  </div>`;

export function renderAdminDashboard(container) {
  const tabs = [
    { id: "overview", label: "Tổng quan", icon: ICONS.grid, active: true, render: renderOverview },
    { id: "accounts", label: "Quản lý tài khoản", icon: ICONS.users, active: false, render: renderAccounts },
    { id: "classes", label: "Lớp học", icon: ICONS.classes, active: false, render: renderClasses },
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
    tabs.find((t) => t.id === id).render(content);
  }

  switchTab("overview");
}

function renderOverview(el) {
  const d = getAdminOverview();
  const recentClasses = d.classes.slice(-4).reverse();
  const recentUsers = d.users.slice(-4).reverse();

  el.innerHTML = `
    <div class="stat-grid">
      ${statCard(ICONS.users, d.totalTeachers, "Giáo viên")}
      ${statCard(ICONS.school, d.totalStudents, "Học sinh")}
      ${statCard(ICONS.classes, d.totalClasses, "Tổng lớp học")}
      ${statCard(ICONS.grid, d.openClasses, "Lớp đang mở")}
    </div>

    <div class="split mt-lg">
      <div class="panel">
        <div class="panel-head">
          <h2 class="panel-title">Lớp gần nhất</h2>
          <a class="link-primary" href="#" data-go="classes">Xem tất cả</a>
        </div>
        ${recentClasses.length
          ? recentClasses
              .map(
                (c) => `
                  <div class="row-item">
                    <div>
                      <strong class="row-title">${c.className}</strong>
                      <span class="row-sub">${c.teacherName} · <span class="badge subject">${subjectLabel(c.subject)}</span></span>
                    </div>
                    <span class="row-end muted">${c.enrolled}/${c.maxSlot}</span>
                  </div>`
              )
              .join("")
          : `<div class="empty">Chưa có lớp học nào</div>`}
      </div>

      <div class="panel">
        <div class="panel-head">
          <h2 class="panel-title">Tài khoản gần nhất</h2>
          <a class="link-primary" href="#" data-go="accounts">Xem tất cả</a>
        </div>
        ${recentUsers.length
          ? recentUsers
              .map(
                (u) => `
                  <div class="row-item">
                    <div>
                      <strong class="row-title">${u.fullName}</strong>
                      <span class="row-sub">@${u.username} · <span class="badge role-${u.role}">${ROLE_LABELS[u.role]}</span></span>
                    </div>
                    <span class="badge ${u.active ? "active" : "inactive"}">${u.active ? "Hoạt động" : "Đã khóa"}</span>
                  </div>`
              )
              .join("")
          : `<div class="empty">Chưa có tài khoản</div>`}
      </div>
    </div>
  `;

  el.querySelectorAll("[data-go]").forEach((a) =>
    a.addEventListener("click", (e) => {
      e.preventDefault();
      const container = el.closest("#app");
      container
        .querySelector(`.nav-item[data-tab="${a.dataset.go}"]`)
        ?.click();
    })
  );
}

function renderAccounts(el, filterRole = "") {
  const d = getAdminOverview();
  const users = filterRole ? d.users.filter((u) => u.role === filterRole) : d.users;

  el.innerHTML = `
    <div class="panel">
      <div class="panel-head">
        <h2 class="panel-title">Danh sách tài khoản</h2>
        <div class="filter-row">
          <select id="role-filter">
            <option value="">Tất cả vai trò</option>
            <option value="admin">${ROLE_LABELS.admin}</option>
            <option value="teacher">${ROLE_LABELS.teacher}</option>
            <option value="student">${ROLE_LABELS.student}</option>
          </select>
          <span class="count-chip">${users.length} tài khoản</span>
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr><th>#</th><th>Họ tên</th><th>Tài khoản</th><th>Vai trò</th><th>Trạng thái</th><th></th></tr>
          </thead>
          <tbody>
            ${users
              .map(
                (u, i) => `
                  <tr data-account="${u.id}">
                    <td>${i + 1}</td>
                    <td><strong>${u.fullName}</strong></td>
                    <td>@${u.username}</td>
                    <td><span class="badge role-${u.role}">${ROLE_LABELS[u.role]}</span></td>
                    <td><span class="badge ${u.active ? "active" : "inactive"}">${u.active ? "Hoạt động" : "Đã khóa"}</span></td>
                    <td class="actions">
                      <button class="btn btn-sm btn-toggle" data-id="${u.id}" data-active="${u.active}">
                        ${u.active ? "Khóa" : "Mở khóa"}
                      </button>
                      <button class="btn btn-sm btn-toggle" data-detail="${u.id}">Chi tiết</button>
                    </td>
                  </tr>
                  <tr class="account-detail" data-detail-of="${u.id}" hidden>
                    <td></td>
                    <td colspan="5">
                      ${accountClassesBlock(u)}
                    </td>
                  </tr>`
              )
              .join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;

  const filterSel = el.querySelector("#role-filter");
  if (filterSel) {
    filterSel.value = filterRole;
    filterSel.addEventListener("change", (e) => renderAccounts(el, e.target.value));
  }

  el.querySelectorAll(".btn-toggle[data-id]").forEach((btn) =>
    btn.addEventListener("click", () => {
      toggleActive(btn.dataset.id);
      renderAccounts(el, filterRole);
    })
  );

  el.querySelectorAll("[data-detail]").forEach((btn) =>
    btn.addEventListener("click", () => {
      const row = el.querySelector(`tr.account-detail[data-detail-of="${btn.dataset.detail}"]`);
      if (row) row.hidden = !row.hidden;
    })
  );
}

function accountClassesBlock(user) {
  const classes = getAdminAccountClasses(user);
  if (!classes.length) {
    return `<span class="muted">Tài khoản chưa tham gia lớp nào.</span>`;
  }
  return `
    <div class="acct-classes">
      ${classes
        .map(
          (c) => `
            <div class="acct-class">
              <span><strong>${c.className}</strong></span>
              <span class="badge subject">${subjectLabel(c.subject)}</span>
              <span class="muted">${formatSchedule(c.schedule)}</span>
              <span class="muted">${c.enrolled}/${c.maxSlot} HS</span>
              <span class="badge ${c.status === "open" ? "open" : "closed"}">${c.status === "open" ? "Đang mở" : "Đã đóng"}</span>
            </div>`
        )
        .join("")}
    </div>`;
}

function renderClasses(el) {
  const d = getAdminOverview();

  el.innerHTML = `
    <div class="panel">
      <div class="panel-head">
        <h2 class="panel-title">Danh sách lớp học</h2>
        <span class="count-chip">${d.totalClasses} lớp</span>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr><th>#</th><th>Tên lớp</th><th>Môn</th><th>Giáo viên</th><th>Sĩ số</th><th>Lịch học</th><th>Trạng thái</th></tr>
          </thead>
          <tbody>
            ${d.classes
              .map(
                (c, i) => `
                  <tr>
                    <td>${i + 1}</td>
                    <td><strong>${c.className}</strong></td>
                    <td><span class="badge subject">${subjectLabel(c.subject)}</span></td>
                    <td>${c.teacherName}</td>
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
    </div>
  `;
}