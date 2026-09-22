// pages/shell.js — Layout dùng chung cho Dashboard theo vai trò (sidebar + topbar + logout)
import { Session } from "../core/session.js";
import { Router } from "../core/router.js";
import { WEEKDAYS } from "../data/constants.js";

const svg = (inner) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;

export const ICONS = {
  grid: svg(
    `<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>`
  ),
  users: svg(
    `<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>`
  ),
  classes: svg(
    `<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>`
  ),
  school: svg(
    `<path d="M22 9L12 4 2 9l10 5 10-5z"/><path d="M6 12v5c0 1.66 2.69 3 6 3s6-1.34 6-3v-5"/>`
  ),
  calendar: svg(
    `<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>`
  ),
  clock: svg(
    `<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>`
  ),
  logout: svg(
    `<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>`
  ),
};

export const BOLT_LOGO = `<svg viewBox="0 0 48 46" fill="currentColor"><path d="M25.946 44.938c-.664.845-2.021.375-2.021-.698V33.937a2.26 2.26 0 0 0-2.262-2.262H10.287c-.92 0-1.456-1.04-.92-1.788l7.48-10.471c1.07-1.497 0-3.578-1.842-3.578H1.237c-.92 0-1.456-1.04-.92-1.788L10.013.474c.214-.297.556-.474.92-.474h28.894c.92 0 1.456 1.04.92 1.788l-7.48 10.471c-1.07 1.498 0 3.579 1.842 3.579h11.377c.943 0 1.473 1.088.89 1.83L25.947 44.94z"/></svg>`;

export const ROLE_LABELS = {
  admin: "Quản trị viên",
  teacher: "Giáo viên",
  student: "Học sinh",
};

export function initials(name = "") {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase() || "U"
  );
}

export function formatSchedule(schedule = []) {
  if (!schedule || !schedule.length) return "Chưa xếp lịch";
  return schedule
    .map((s) => {
      const day = WEEKDAYS.find((w) => w.value === s.dayOfWeek)?.label || s.dayOfWeek;
      return `${day} · ${s.start}–${s.end}`;
    })
    .join(" · ");
}

export function renderShell(container, { title, items }) {
  const user = Session.getCurrentUser();

  container.innerHTML = `
    <div class="app-shell">
      <aside class="sidebar">
        <div class="sidebar-brand">
          <span class="sidebar-logo">${BOLT_LOGO}</span>
          <div class="brand-text"><strong>BTM Center</strong><small>Trung tâm dạy học</small></div>
        </div>
        <nav class="sidebar-nav">
          ${items
            .map(
              (i) => `
                <button class="nav-item${i.active ? " active" : ""}" data-tab="${i.id}">
                  <span class="nav-icon">${i.icon}</span><span class="nav-label">${i.label}</span>
                </button>`
            )
            .join("")}
        </nav>
        <button class="nav-item logout" id="logout-sidebar">
          <span class="nav-icon">${ICONS.logout}</span><span class="nav-label">Đăng xuất</span>
        </button>
      </aside>

      <main class="main">
        <header class="topbar">
          <h1 class="page-title" id="page-title">${title}</h1>
          <div class="user-chip">
            <span class="avatar">${initials(user?.fullName)}</span>
            <div class="user-meta">
              <strong>${user?.fullName || ""}</strong>
              <span class="role-badge ${user?.role || ""}">${ROLE_LABELS[user?.role] || ""}</span>
            </div>
            <button class="icon-btn" id="logout-top" title="Đăng xuất">${ICONS.logout}</button>
          </div>
        </header>
        <div class="content" id="tab-content"></div>
      </main>
    </div>
  `;

  const logout = () => {
    Session.logout();
    Router.navigate("/login");
  };
  container.querySelector("#logout-sidebar").addEventListener("click", logout);
  container.querySelector("#logout-top").addEventListener("click", logout);
}