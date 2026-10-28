// pages/admin/admin-dashboard.page.js — Redesign Toàn diện: Trang Tổng quan Quản trị Hợp nhất
import { renderShell, ICONS, formatSchedule, ROLE_LABELS } from "../shell.js";
import {
  getAdminOverview,
  getAdminAccountClasses,
} from "../../modules/dashboard/dashboard.service.js";
import {
  toggleActive,
  updateUserCredentials,
} from "../../modules/users/users.service.js";
import {
  listStudentsOfClass,
} from "../../modules/classes/classes.service.js";
import {
  listClassRequests,
  approveClassRequest,
  rejectClassRequest,
} from "../../modules/classes/class-requests.service.js";
import {
  getLinkedStudent,
  listStudentsAvailableForLink,
  linkParentToStudent,
  unlinkParent,
} from "../../modules/parents/parents.service.js";
import {
  registerTeacher,
  registerStudent,
  registerParent,
} from "../../modules/auth/auth.service.js";
import { Session } from "../../core/session.js";
import { Router } from "../../core/router.js";
import { SUBJECTS, subjectLabel, WEEKDAYS, formatDate, todayStr } from "../../data/constants.js";
import { escapeHtml } from "../../core/html.js";
import { DB } from "../../core/db.js";
import { seedDatabase } from "../../data/seed.js";

const pct = (a, b) => Math.min(100, Math.round((a / (b || 1)) * 100));

const REQ_TYPE_LABELS = {
  register: "Đăng ký lớp mới",
  reschedule: "Yêu cầu đổi lịch học",
  reopen: "Yêu cầu mở lại lớp học",
  close: "Yêu cầu đóng lớp học",
};

// Màu nền + icon cho từng loại yêu cầu của giáo viên
const REQ_TYPE_STYLE = {
  register: { bg: "#e6f8f0;color:#0d8a5f", icon: "plus" },
  reschedule: { bg: "#fef3c7;color:#b45309", icon: "refresh" },
  reopen: { bg: "#e8f0fe;color:#1d4ed8", icon: "refresh" },
  close: { bg: "#fdecec;color:#c0392b", icon: "close" },
};
const reqTypeStyle = (type) => REQ_TYPE_STYLE[type] || REQ_TYPE_STYLE.reschedule;

const REQ_STATUS_LABELS = {
  pending: "Chờ phê duyệt",
  approved: "Đã phê duyệt",
  rejected: "Đã từ chối",
};

const REQ_STATUS_BADGES = {
  pending: "late",
  approved: "active",
  rejected: "closed",
};

const statusBadge = (status) => {
  if (status === "open") return `<span class="badge open">Đang mở</span>`;
  if (status === "pending") return `<span class="badge pending">Chờ phê duyệt</span>`;
  return `<span class="badge closed">Đã đóng</span>`;
};

// Chuẩn hoá chuỗi để tìm kiếm không phân biệt hoa/thường và dấu tiếng Việt.
const searchKey = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .trim();

// Cho phép các khu vực khác (ví dụ sửa tài khoản) làm mới bảng liên kết PH - HS
// mà không cần render lại toàn bộ dashboard.
let refreshParentLinksTable = null;

const dayLabels = (schedule) => {
  const labels = [];
  (schedule || []).forEach((s) => {
    const label = WEEKDAYS.find((w) => w.value === s.dayOfWeek)?.label || String(s.dayOfWeek);
    if (!labels.includes(label)) labels.push(label);
  });
  return labels.join(", ") || "Chưa xếp lịch";
};

const timeLabels = (schedule) => {
  const list = [];
  (schedule || []).forEach((s) => {
    const slot = `${s.start}–${s.end}`;
    if (!list.includes(slot)) list.push(slot);
  });
  return list.join(" · ") || "—";
};

const infoRow = (key, value) => `
  <div class="modal-info">
    <span class="k">${key}</span>
    <span class="v">${value}</span>
  </div>`;

function flash(el, message, type = "success") {
  let box = el.querySelector("#admin-flash");
  if (!box) {
    box = document.createElement("p");
    box.id = "admin-flash";
    box.className = "admin-flash";
    el.prepend(box);
  }
  box.textContent = message;
  box.dataset.type = type;
  box.hidden = false;
  window.clearTimeout(box._timer);
  box._timer = window.setTimeout(() => (box.hidden = true), 3200);
}

function openModal({ title, body, foot = "", size = "", onMount }) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal ${size}" role="dialog" aria-modal="true">
      <div class="modal-head">
        <h3 class="modal-title">${title}</h3>
        <button class="icon-btn" data-close aria-label="Đóng">${ICONS.close}</button>
      </div>
      <div class="modal-body">${body}</div>
      ${foot ? `<div class="modal-foot">${foot}</div>` : ""}
    </div>`;
  document.body.appendChild(overlay);

  const onKey = (e) => {
    if (e.key === "Escape") close();
  };

  function close() {
    document.removeEventListener("keydown", onKey);
    overlay.remove();
  }

  document.addEventListener("keydown", onKey);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });
  overlay.querySelectorAll("[data-close]").forEach((btn) =>
    btn.addEventListener("click", close)
  );
  onMount?.(overlay, close);
  return close;
}

// =============================================================================
// KHỞI TẠO TRANG DASHBOARD ADMIN (CHỈ GIỮ TAB TỔNG QUAN Ở MENU)
// =============================================================================
// Cập nhật số thông báo (badge) hiển thị trên mỗi mục menu Sidebar Admin.
function updateAdminSidebarBadges(appShell, counts) {
  if (!appShell) return;
  counts = counts || {};
  const prevCounts = {};
  appShell.querySelectorAll(".sidebar .nav-item:not(.logout)").forEach((btn) => {
    const b = btn.querySelector(".nav-badge");
    prevCounts[btn.dataset.tab] = b ? Number(b.textContent) || 0 : 0;
  });
  const map = {
    overview: counts.overview != null ? counts.overview : (prevCounts.overview ?? 0),
    accounts: counts.accounts != null ? counts.accounts : (prevCounts.accounts ?? 0),
    classes: counts.classes != null ? counts.classes : (prevCounts.classes ?? 0),
    parentlinks: counts.parentlinks != null ? counts.parentlinks : (prevCounts.parentlinks ?? 0),
    notifications: counts.notifications != null ? counts.notifications : (prevCounts.notifications ?? 0),
    analytics: counts.analytics != null ? counts.analytics : (prevCounts.analytics ?? 0),
    settings: counts.settings != null ? counts.settings : (prevCounts.settings ?? 0),
  };
  appShell.querySelectorAll(".sidebar .nav-item:not(.logout)").forEach((btn) => {
    const id = btn.dataset.tab;
    if (!(id in map)) return;
    const val = map[id];
    let badge = btn.querySelector(".nav-badge");
    const iconGroup = btn.querySelector(".nav-icon-group") || btn;
    if (val > 0) {
      if (!badge) {
        badge = document.createElement("span");
        badge.className = "nav-badge";
        iconGroup.appendChild(badge);
      }
      if (badge.parentElement !== iconGroup) iconGroup.appendChild(badge);
      badge.textContent = val;
    } else if (badge) {
      badge.remove();
    }
  });
}
export function renderAdminDashboard(container) {
  // Yêu cầu: Bỏ tab quản lý lớp học và tab thông báo ở menu.
  // Đưa tất cả vào 1 trang duy nhất trong tab "Tổng quan".
  const tabs = [
    { id: "overview", label: "Tổng quan", icon: ICONS.grid, active: true, section: "overview-kpis" },
    { id: "accounts", label: "Quản lý người dùng", icon: ICONS.users, section: "overview-accounts" },
    { id: "classes", label: "Quản lý lớp học", icon: ICONS.classes, section: "overview-classes" },
    { id: "parentlinks", label: "Liên kết PH - HS", icon: ICONS.school, section: "overview-parentlinks" },
    { id: "notifications", label: "Thông báo & Phê duyệt", icon: ICONS.bell, section: "overview-notifications" },
    { id: "analytics", label: "Báo cáo & Thống kê", icon: ICONS.calendar, section: "overview-analytics" },
    { id: "settings", label: "Cài đặt hệ thống", icon: ICONS.clock, section: "overview-quickactions" },
  ];

  renderShell(container, { title: "Tổng quan Quản trị viên", items: tabs });
  const content = container.querySelector("#tab-content");

  // Render trang Tổng hợp hợp nhất
  renderAdminOverviewPage(content);

  // Điều hướng Sidebar: cuộn tới section tương ứng & giữ trạng thái active
  setupAdminSidebarNav(container, tabs);
}

function setupAdminSidebarNav(container, tabs) {
  const nav = container.querySelector(".sidebar-nav");
  const content = container.querySelector("#tab-content");
  if (!nav || !content) return;
  nav.querySelectorAll(".nav-item:not(.logout)").forEach((btn) => {
    const id = btn.dataset.tab;
    const item = tabs.find((t) => t.id === id);
    if (!item) return;
    btn.addEventListener("click", () => {
      nav.querySelectorAll(".nav-item").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const section = content.querySelector(`#${item.section}`);
      if (section) section.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

// =============================================================================
// TRANG TỔNG QUAN HỢP NHẤT: CHỨA CÁC DIV QUẢN LÝ TÀI KHOẢN, LỚP HỌC, THÔNG BÁO...
// MỖI DIV ĐỀU CÓ NÚT "XEM CHI TIẾT" CHO BẢNG THÔNG TIN ĐÓ
// =============================================================================
function renderAdminOverviewPage(el) {
  const overview = getAdminOverview();
  const allUsers = overview.users.filter((u) => u.role !== "admin");
  const allClasses = overview.classes;
  const requests = listClassRequests();
  const pendingRequests = requests.filter((r) => r.status === "pending");

  // Số hiển thị badge trên menu Sidebar (theo từng mục)
  const unlinkedParents = allUsers.filter((u) => u.role === "parent" && !u.studentId).length;
  const sidebarCounts = {
    overview: 0,
    accounts: allUsers.length,
    classes: allClasses.length,
    parentlinks: unlinkedParents,
    notifications: pendingRequests.length,
    analytics: 0,
    settings: 0,
  };

  // Thống kê nhanh
  const teachersCount = allUsers.filter((u) => u.role === "teacher").length;
  const activeTeachersCount = allUsers.filter((u) => u.role === "teacher" && u.active).length;
  const studentsCount = allUsers.filter((u) => u.role === "student").length;
  const activeStudentsCount = allUsers.filter((u) => u.role === "student" && u.active).length;
  const parentsCount = allUsers.filter((u) => u.role === "parent").length;
  const openClassesCount = allClasses.filter((c) => c.status === "open").length;
  const teachers = allUsers.filter((u) => u.role === "teacher");

  // Tính tổng dung lượng học sinh và tỷ lệ lấp đầy
  const totalMaxSlots = allClasses.reduce((sum, c) => sum + (c.maxSlot || 0), 0);
  const totalEnrolled = allClasses.reduce((sum, c) => sum + (c.enrolled || 0), 0);
  const avgOccupancy = pct(totalEnrolled, totalMaxSlots);

  // Thống kê phân bố môn học
  const subjects = [
    { key: "Toan", name: "Toán", color: "#4f46e5" },
    { key: "Van", name: "Văn", color: "#b45309" },
    { key: "Anh", name: "Tiếng Anh", color: "#0d8a5f" },
  ].map((sub) => {
    const clsList = allClasses.filter((c) => c.subject === sub.key);
    const subEnrolled = clsList.reduce((s, c) => s + (c.enrolled || 0), 0);
    const subCapacity = clsList.reduce((s, c) => s + (c.maxSlot || 0), 0);
    return {
      ...sub,
      classCount: clsList.length,
      enrolled: subEnrolled,
      capacity: subCapacity,
      occupancy: pct(subEnrolled, subCapacity),
    };
  });

  // Mật độ lịch học các ngày trong tuần (T2 - CN: 2 - 8)
  const weekdayCounts = [2, 3, 4, 5, 6, 7, 8].map((day) => {
    const label = WEEKDAYS.find((w) => w.value === day)?.label || `T${day}`;
    let count = 0;
    allClasses.forEach((c) => {
      if (c.status === "open" && Array.isArray(c.schedule)) {
        if (c.schedule.some((s) => s.dayOfWeek === day)) count++;
      }
    });
    return { day, label, count };
  });
  const maxDayCount = Math.max(...weekdayCounts.map((w) => w.count), 1);

  el.innerHTML = `
    <p class="admin-flash" id="admin-flash" hidden></p>

    <!-- Master Div Tổng Quan -->
    <div class="overview-dashboard" id="tab-overview" data-page="tong-quan">

      <!-- Banner chào mừng & trạng thái trung tâm -->
      <div class="welcome-banner">
        <div>
          <h2 class="welcome-title">Trung tâm Dạy học BTM · Tổng quan Quản trị</h2>
          <p class="welcome-sub">
            Hệ thống quản lý hợp nhất — Năm học 2024 - 2025 · Hôm nay: ${formatDate(todayStr())}
          </p>
        </div>
        <div style="display:flex;gap:10px;align-items:center;">
          <span class="badge active" style="font-size:13px;padding:6px 14px;">
            ● Hệ thống đang hoạt động
          </span>
          <button class="btn btn-sm btn-primary" id="btn-quick-new-user" style="width:auto;padding:8px 16px;">
            ${ICONS.plus} Thêm tài khoản
          </button>
        </div>
      </div>

      <!-- 1. DIV CHỈ SỐ TỔNG QUAN & KPI -->
      <div class="overview-panel" id="overview-kpis">
        <div class="panel-head-overview">
          <div class="panel-title-group">
            <span class="panel-icon-wrap">${ICONS.grid}</span>
            <div>
              <h2 class="panel-title">Chỉ số Hoạt động Tổng quan</h2>
              <span class="muted" style="font-size:12px;">Tổng hợp dữ liệu toàn trung tâm theo thời gian thực</span>
            </div>
          </div>
          <div class="panel-actions">
            <button class="btn-view-detail" id="btn-detail-kpi" title="Xem chi tiết toàn bộ chỉ số">
              ${ICONS.eye}
              <span>Xem chi tiết chỉ số</span>
            </button>
          </div>
        </div>
        <div style="padding: 20px 24px;">
          <div class="kpi-row">
            <div class="kpi-card" style="--kpi-color:#0d8a5f;--kpi-bg:#e6f8f0;">
              <div class="kpi-icon">${ICONS.users}</div>
              <div class="kpi-content">
                <span class="kpi-val">${studentsCount}</span>
                <span class="kpi-tit">Học sinh</span>
                <span class="kpi-sub">${activeStudentsCount} đang học · ${studentsCount - activeStudentsCount} đã khóa</span>
              </div>
            </div>

            <div class="kpi-card" style="--kpi-color:#6a1bff;--kpi-bg:#f2ecff;">
              <div class="kpi-icon">${ICONS.school}</div>
              <div class="kpi-content">
                <span class="kpi-val">${teachersCount}</span>
                <span class="kpi-tit">Giáo viên</span>
                <span class="kpi-sub">${activeTeachersCount} đang dạy · 3 bộ môn</span>
              </div>
            </div>

            <div class="kpi-card" style="--kpi-color:#0b7285;--kpi-bg:#e3f6f8;">
              <div class="kpi-icon">${ICONS.users}</div>
              <div class="kpi-content">
                <span class="kpi-val">${parentsCount}</span>
                <span class="kpi-tit">Phụ huynh</span>
                <span class="kpi-sub">Liên kết theo dõi học sinh</span>
              </div>
            </div>

            <div class="kpi-card" style="--kpi-color:#4f46e5;--kpi-bg:#eef2ff;">
              <div class="kpi-icon">${ICONS.classes}</div>
              <div class="kpi-content">
                <span class="kpi-val">${openClassesCount}/${allClasses.length}</span>
                <span class="kpi-tit">Lớp đang mở</span>
                <span class="kpi-sub">Tỷ lệ lấp đầy sĩ số: ${avgOccupancy}%</span>
              </div>
            </div>

            <div class="kpi-card" style="--kpi-color:#d97706;--kpi-bg:#fef3c7;">
              <div class="kpi-icon">${ICONS.bell}</div>
              <div class="kpi-content">
                <span class="kpi-val">${pendingRequests.length}</span>
                <span class="kpi-tit">Yêu cầu chờ duyệt</span>
                <span class="kpi-sub">${requests.length} tổng yêu cầu nhận được</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 2. DIV QUẢN LÝ TÀI KHOẢN -->
      <div class="overview-panel" id="overview-accounts">
        <div class="panel-head-overview">
          <div class="panel-title-group">
            <span class="panel-icon-wrap">${ICONS.users}</span>
            <div>
              <h2 class="panel-title">Quản lý Tài khoản Người dùng</h2>
              <span class="count-chip" id="chip-accounts-count">${allUsers.length} tài khoản</span>
            </div>
          </div>
          <div class="panel-actions">
            <button class="btn-quick-add" id="btn-add-account-panel">
              ${ICONS.plus}
              <span>Thêm tài khoản</span>
            </button>
            <button class="btn-view-detail" id="btn-detail-accounts-table">
              ${ICONS.eye}
              <span>Xem chi tiết bảng tài khoản</span>
            </button>
          </div>
        </div>

        <!-- Toolbar tìm kiếm & lọc -->
        <div class="overview-toolbar">
          <div class="toolbar-search">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input type="text" id="acc-search-input" placeholder="Tìm theo tên, username, email..." />
          </div>
          <div class="toolbar-filters">
            <select class="toolbar-select" id="acc-role-select">
              <option value="">Tất cả vai trò</option>
              <option value="teacher">Giáo viên (${teachersCount})</option>
              <option value="student">Học sinh (${studentsCount})</option>
              <option value="parent">Phụ huynh (${parentsCount})</option>
            </select>
            <select class="toolbar-select" id="acc-status-select">
              <option value="">Tất cả trạng thái</option>
              <option value="active">Đang hoạt động</option>
              <option value="inactive">Đã bị khóa</option>
            </select>
            <select class="toolbar-select" id="acc-link-select">
              <option value="">Trạng thái liên kết HS</option>
              <option value="linked">Phụ huynh đã liên kết học sinh</option>
              <option value="unlinked">Phụ huynh CHƯA liên kết học sinh</option>
            </select>
          </div>
        </div>

        <!-- Bảng danh sách tài khoản -->
        <div class="table-wrap" id="acc-table-container">
          <!-- Bảng render động bởi JS -->
        </div>
      </div>

      <!-- 3. DIV QUẢN LÝ LỚP HỌC -->
      <div class="overview-panel" id="overview-classes">
        <div class="panel-head-overview">
          <div class="panel-title-group">
            <span class="panel-icon-wrap">${ICONS.classes}</span>
            <div>
              <h2 class="panel-title">Quản lý Lớp học & Lịch giảng dạy</h2>
              <span class="count-chip" id="chip-classes-count">${allClasses.length} lớp học (${openClassesCount} đang mở)</span>
            </div>
          </div>
        </div>

        <!-- Toolbar tìm kiếm & lọc lớp học -->
        <div class="overview-toolbar">
          <div class="toolbar-search">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input type="text" id="cls-search-input" placeholder="Tìm theo tên lớp hoặc giáo viên..." />
          </div>
          <div class="toolbar-filters">
            <select class="toolbar-select" id="cls-subject-select">
              <option value="">Tất cả bộ môn</option>
              ${SUBJECTS.map((s) => {
                const count = allClasses.filter((c) => c.subject === s).length;
                return `<option value="${s}">${subjectLabel(s)} (${count})</option>`;
              }).join("")}
            </select>
            <select class="toolbar-select" id="cls-status-select">
              <option value="">Tất cả trạng thái</option>
              <option value="open">Đang mở (${allClasses.filter((c) => c.status === "open").length})</option>
              <option value="pending">Chờ phê duyệt (${allClasses.filter((c) => c.status === "pending").length})</option>
              <option value="closed">Đã đóng (${allClasses.filter((c) => c.status === "closed").length})</option>
            </select>
          </div>
        </div>

        <div class="table-wrap" id="cls-table-container">
          <!-- Bảng render động bởi JS -->
        </div>
      </div>

      <!-- 4. DIV THÔNG BÁO & YÊU CẦU PHÊ DUYỆT -->
      <div class="overview-panel" id="overview-notifications">
        <div class="panel-head-overview">
          <div class="panel-title-group">
            <span class="panel-icon-wrap" style="background:#fef3c7;color:#b45309;">${ICONS.bell}</span>
            <div>
              <h2 class="panel-title">Thông báo & Yêu cầu từ Giáo viên</h2>
              <span class="count-chip" id="chip-requests-count">
                ${pendingRequests.length} yêu cầu chờ phê duyệt
              </span>
            </div>
          </div>
          <div class="panel-actions">
            <button class="btn-view-detail" id="btn-detail-requests-table">
              ${ICONS.eye}
              <span>Xem chi tiết bảng thông báo</span>
            </button>
          </div>
        </div>

        <div style="padding: 18px 24px;">
          ${
            requests.length
              ? `<div style="display:flex;flex-direction:column;gap:10px;">
                  ${requests
                    .slice(0, 6)
                    .map(
                      (r) => `
                        <div class="row-item notif-item" data-request-id="${r.id}" style="border:1px solid var(--line);border-radius:12px;padding:12px 18px;">
                          <div style="display:flex;align-items:center;gap:14px;min-width:0;">
                            <div style="width:40px;height:40px;border-radius:10px;display:grid;place-items:center;flex:none;background:${reqTypeStyle(r.type).bg};">
                              ${ICONS[reqTypeStyle(r.type).icon]}
                            </div>
                            <div style="min-width:0;">
                              <strong class="row-title" style="display:block;font-size:14.5px;">
                                ${REQ_TYPE_LABELS[r.type] || "Yêu cầu"} · ${escapeHtml(r.cls.className)}
                              </strong>
                              <span class="row-sub" style="display:flex;align-items:center;gap:8px;margin-top:3px;font-size:12.5px;color:var(--muted);flex-wrap:wrap;">
                                <span>Giáo viên: <strong>${escapeHtml(r.teacher?.fullName || "—")}</strong></span>
                                <span class="badge subject">${subjectLabel(r.cls.subject)}</span>
                                <span>${formatDate(String(r.createdAt).slice(0, 10))}</span>
                              </span>
                            </div>
                          </div>
                          <span class="row-end notif-end">
                            <span class="badge ${REQ_STATUS_BADGES[r.status]}">
                              ${REQ_STATUS_LABELS[r.status]}
                            </span>
                            ${
                              r.status === "pending"
                                ? `
                                <button class="btn btn-sm btn-success" data-req-approve="${r.id}" style="width:auto;padding:5px 10px;font-size:12px;">Chấp nhận</button>
                                <button class="btn btn-sm btn-danger" data-req-reject="${r.id}" style="width:auto;padding:5px 10px;font-size:12px;margin-left:6px;">Từ chối</button>
                                `
                                : ""
                            }
                            <button class="btn btn-sm btn-primary" data-open-req="${r.id}" style="width:auto;padding:6px 14px;">
                              Xem chi tiết & Xử lý
                            </button>
                          </span>
                        </div>`
                    )
                    .join("")}
                </div>`
              : `<div class="empty" style="padding:30px;text-align:center;color:var(--muted);">
                  Chưa có thông báo hoặc yêu cầu nào từ giáo viên.
                </div>`
          }
        </div>
      </div>

      <!-- 4b. DIV QUẢN LÝ LIÊN KẾT PHỤ HUYNH - HỌC SINH (MỚI) -->
      <div class="overview-panel" id="overview-parentlinks">
        <div class="panel-head-overview">
          <div class="panel-title-group">
            <span class="panel-icon-wrap" style="background:#e6f8f0;color:#0d8a5f;">${ICONS.school}</span>
            <div>
              <h2 class="panel-title">Quản lý Liên kết Phụ huynh - Học sinh</h2>
              <span class="count-chip" id="chip-parentlinks-count"></span>
            </div>
          </div>
          <div class="panel-actions">
            <button class="btn-quick-add" id="btn-add-parent-link">
              ${ICONS.plus}
              <span>Liên kết phụ huynh</span>
            </button>
          </div>
        </div>

        <div style="padding: 18px 24px;">
          <p class="muted" style="font-size:13px;margin-bottom:12px;">
            Mỗi tài khoản Phụ huynh chỉ được liên kết với đúng 1 học sinh (con). Học sinh đã có phụ huynh
            sẽ không xuất hiện trong danh sách chọn khi tạo liên kết mới.
          </p>

          <!-- Toolbar tìm kiếm & lọc liên kết phụ huynh - học sinh -->
          <div class="overview-toolbar" style="padding:0 0 14px;background:transparent;border-bottom:none;">
            <div class="toolbar-search">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
              <input type="text" id="pl-search-input" aria-label="Tìm kiếm phụ huynh theo tên, username, email hoặc số điện thoại" placeholder="Tìm theo tên, username, email hoặc SĐT..." />
            </div>
            <div class="toolbar-filters">
              <select class="toolbar-select" id="pl-status-select" aria-label="Lọc theo trạng thái liên kết">
                <option value="">Tất cả trạng thái liên kết</option>
                <option value="linked">Đã liên kết học sinh</option>
                <option value="unlinked">Chưa liên kết học sinh</option>
              </select>
            </div>
          </div>

          <div class="table-wrap" id="parentlinks-table-container"></div>
        </div>
      </div>

      <!-- 5. DIV PHÂN TÍCH & TÌNH TRẠNG TRUNG TÂM (ROLE ADMIN) -->
      <div class="overview-panel" id="overview-analytics">
        <div class="panel-head-overview">
          <div class="panel-title-group">
            <span class="panel-icon-wrap" style="background:#eef2ff;color:#4f46e5;">${ICONS.classes}</span>
            <div>
              <h2 class="panel-title">Phân tích & Tình trạng Trung tâm</h2>
              <span class="muted" style="font-size:12px;">Sĩ số theo môn học & mật độ lịch giảng dạy</span>
            </div>
          </div>
          <div class="panel-actions">
            <button class="btn-view-detail" id="btn-detail-analytics">
              ${ICONS.eye}
              <span>Xem chi tiết phân tích</span>
            </button>
          </div>
        </div>

        <div class="analytics-grid">
          <!-- Phân bổ môn học -->
          <div class="analytics-card">
            <div class="analytics-head">
              <span class="analytics-tit">Tỷ lệ lấp đầy theo Môn học</span>
              <span class="count-chip">${allClasses.length} lớp</span>
            </div>
            <div style="display:flex;flex-direction:column;gap:8px;margin-top:6px;">
              ${subjects
                .map(
                  (s) => `
                    <div class="subject-stat-row">
                      <div class="subject-info">
                        <span class="badge subject" style="font-size:12px;">${s.name}</span>
                        <span style="font-size:13px;font-weight:600;color:var(--brand-ink);">
                          ${s.classCount} lớp (${s.enrolled}/${s.capacity} HS)
                        </span>
                      </div>
                      <div class="capacity-meter">
                        <div style="display:flex;justify-content:space-between;font-size:11px;font-weight:700;color:var(--muted);">
                          <span>Tỷ lệ</span>
                          <span>${s.occupancy}%</span>
                        </div>
                        <div class="capacity-meter-bar">
                          <div class="capacity-meter-fill" style="width:${s.occupancy}%"></div>
                        </div>
                      </div>
                    </div>`
                )
                .join("")}
            </div>
          </div>

          <!-- Mật độ các ngày trong tuần -->
          <div class="analytics-card">
            <div class="analytics-head">
              <span class="analytics-tit">Mật độ Lịch học Trong tuần</span>
              <span class="count-chip">Thứ 2 — Chủ nhật</span>
            </div>
            <div class="weekday-bars">
              ${weekdayCounts
                .map(
                  (w) => `
                    <div class="weekday-col">
                      <span class="weekday-count">${w.count}</span>
                      <div class="weekday-bar-wrap">
                        <div class="weekday-bar" style="height:${Math.max(6, pct(w.count, maxDayCount))}%"></div>
                      </div>
                      <span class="weekday-label">${w.label}</span>
                    </div>`
                )
                .join("")}
            </div>
          </div>
        </div>
      </div>

      <!-- 6. DIV THAO TÁC NHANH & NHẬT KÝ HỆ THỐNG -->
      <div class="overview-panel" id="overview-quickactions">
        <div class="panel-head-overview">
          <div class="panel-title-group">
            <span class="panel-icon-wrap" style="background:#e6f8f0;color:#0d8a5f;">${ICONS.refresh}</span>
            <div>
              <h2 class="panel-title">Thao tác Nhanh & Nhật ký Quản trị</h2>
              <span class="muted" style="font-size:12px;">Công cụ trợ giúp vận hành và kiểm tra hệ thống</span>
            </div>
          </div>
          <div class="panel-actions">
            <button class="btn-view-detail" id="btn-detail-logs">
              ${ICONS.eye}
              <span>Xem chi tiết nhật ký</span>
            </button>
          </div>
        </div>

        <div class="quick-ops-grid">
          <!-- Các nút tác vụ nhanh -->
          <div class="quick-action-cards">
            <button class="quick-act-card" id="act-create-user">
              <span class="quick-act-icon">${ICONS.plus}</span>
              <span class="quick-act-title">Thêm tài khoản mới</span>
              <span class="quick-act-desc">Tạo tài khoản giáo viên, học sinh hoặc phụ huynh ngay</span>
            </button>

            <button class="quick-act-card" id="act-export-data">
              <span class="quick-act-icon">${ICONS.download}</span>
              <span class="quick-act-title">Xuất dữ liệu trung tâm</span>
              <span class="quick-act-desc">Tải về sao lưu cơ sở dữ liệu hệ thống định dạng JSON</span>
            </button>

            <button class="quick-act-card" id="act-refresh-all">
              <span class="quick-act-icon">${ICONS.refresh}</span>
              <span class="quick-act-title">Làm mới dữ liệu</span>
              <span class="quick-act-desc">Cập nhật lại toàn bộ bảng thông tin và chỉ số mới nhất</span>
            </button>

            <button class="quick-act-card" id="act-reset-seed">
              <span class="quick-act-icon" style="color:#c0392b;background:#fdecec;">${ICONS.close}</span>
              <span class="quick-act-title">Khôi phục dữ liệu gốc</span>
              <span class="quick-act-desc">Đặt lại danh sách mẫu ban đầu khi cần thử nghiệm lại</span>
            </button>
          </div>

          <!-- Nhật ký hoạt động gần đây -->
          <div>
            <div style="font-size:13.5px;font-weight:800;color:var(--brand-ink);margin-bottom:12px;">
              Nhật ký sự kiện gần đây
            </div>
            <div class="activity-feed">
              ${
                requests.length
                  ? requests.slice(0, 4).map(
                      (r) => `
                        <div class="activity-item">
                          <span class="activity-dot" style="background:${r.status === 'pending' ? '#d97706' : '#0d8a5f'};"></span>
                          <div class="activity-text">
                            <strong>${escapeHtml(r.teacher?.fullName || 'Giáo viên')}</strong> gửi yêu cầu
                            “${REQ_TYPE_LABELS[r.type]}” cho lớp <em>${escapeHtml(r.cls.className)}</em>
                          </div>
                          <span class="activity-time">${formatDate(String(r.createdAt).slice(0, 10))}</span>
                        </div>`
                    ).join("")
                  : ""
              }
              <div class="activity-item">
                <span class="activity-dot" style="background:#4f46e5;"></span>
                <div class="activity-text">
                  Hệ thống kiểm tra định kỳ cơ sở dữ liệu: <strong>${allUsers.length} tài khoản</strong> và <strong>${allClasses.length} lớp học</strong>.
                </div>
                <span class="activity-time">Hôm nay</span>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  `;

  // Cập nhật số thông báo (badge) trên menu Sidebar
  updateAdminSidebarBadges(el.closest('.app-shell'), sidebarCounts);

  // Render bảng Quản lý tài khoản
  setupAccountsSection(el, allUsers);

  // Render bảng Quản lý lớp học
  setupClassesSection(el, allClasses);

  // Render bảng Quản lý liên kết Phụ huynh - Học sinh (MỚI)
  setupParentLinksSection(el);

  // Setup các sự kiện nút Xem chi tiết cho từng bảng thông tin
  setupDetailButtons(el, { overview, allUsers, allClasses, requests, subjects, weekdayCounts });

  // Setup các sự kiện thao tác nhanh & yêu cầu
  setupQuickActions(el);
}

// =============================================================================
// QUẢN LÝ BẢNG TÀI KHOẢN (TÌM KIẾM, LỌC, XEM CHI TIẾT TỪNG DÒNG, SỬA, KHÓA)
// =============================================================================
function setupAccountsSection(el, initialUsers) {
  const container = el.querySelector("#acc-table-container");
  const searchInput = el.querySelector("#acc-search-input");
  const roleSelect = el.querySelector("#acc-role-select");
  const statusSelect = el.querySelector("#acc-status-select");
  const countChip = el.querySelector("#chip-accounts-count");

  function getFilteredList() {
    const q = (searchInput?.value || "").trim().toLowerCase();
    const role = roleSelect?.value || "";
    const status = statusSelect?.value || "";
    const linkFilter = (el.querySelector("#acc-link-select")?.value || "");

    return initialUsers.filter((u) => {
      if (role && u.role !== role) return false;
      if (status === "active" && !u.active) return false;
      if (status === "inactive" && u.active) return false;
      if (linkFilter === "linked" && !(u.role === "parent" && u.studentId)) return false;
      if (linkFilter === "unlinked" && !(u.role === "parent" && !u.studentId)) return false;
      if (q) {
        const matchesName = (u.fullName || "").toLowerCase().includes(q);
        const matchesUser = (u.username || "").toLowerCase().includes(q);
        const matchesEmail = (u.email || "").toLowerCase().includes(q);
        const matchesId = (u.id || "").toLowerCase().includes(q);
        if (!matchesName && !matchesUser && !matchesEmail && !matchesId) return false;
      }
      return true;
    });
  }

  function renderTable() {
    const list = getFilteredList();
    if (countChip) countChip.textContent = `${list.length} tài khoản`;

    if (!list.length) {
      container.innerHTML = `
        <div class="empty" style="padding:28px;text-align:center;color:var(--muted);">
          Không tìm thấy tài khoản nào khớp với bộ lọc.
        </div>`;
      return;
    }

    container.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Họ và tên</th>
            <th>Tài khoản</th>
            <th>Email</th>
            <th>Vai trò</th>
            <th>Trạng thái</th>
            <th style="text-align:right;">Thao tác</th>
          </tr>
        </thead>
        <tbody>
          ${list
            .map(
              (u, i) => `
                <tr data-account-row="${u.id}">
                  <td>${i + 1}</td>
                  <td>
                    <strong>${escapeHtml(u.fullName)}</strong>
                    ${
                      u.role === "student"
                        ? `<small class="muted" style="display:block;font-size:11px;">Mã HS: ${u.id}</small>`
                        : ""
                    }
                  </td>
                  <td><span class="badge" style="background:#f4efff;color:#5e1bd6;">@${escapeHtml(u.username)}</span></td>
                  <td>${escapeHtml(u.email || "—")}</td>
                  <td><span class="badge role-${u.role}">${ROLE_LABELS[u.role] || u.role}</span></td>
                  <td><span class="badge ${u.active ? "active" : "inactive"}">${u.active ? "Hoạt động" : "Đã khóa"}</span></td>
                  <td class="actions">
                    <div class="actions-grid actions-3">
                      <button class="btn btn-sm btn-toggle" data-acc-detail="${u.id}" title="Xem chi tiết lớp hoặc học sinh">Chi tiết</button>
                      <button class="btn btn-sm btn-toggle" data-acc-toggle="${u.id}">${u.active ? "Khóa" : "Mở khóa"}</button>
                      <button class="btn btn-sm btn-toggle" data-acc-edit="${u.id}">Sửa</button>
                    </div>
                  </td>
                </tr>
                <tr class="account-detail" data-detail-row="${u.id}" hidden>
                  <td></td>
                  <td colspan="6" style="background:#faf9fe;padding:14px 20px;">
                    ${accountClassesBlock(u)}
                  </td>
                </tr>`
            )
            .join("")}
        </tbody>
      </table>`;

    // Sự kiện mở rộng chi tiết dòng
    container.querySelectorAll("[data-acc-detail]").forEach((btn) =>
      btn.addEventListener("click", () => {
        const row = container.querySelector(`tr[data-detail-row="${btn.dataset.accDetail}"]`);
        if (row) row.hidden = !row.hidden;
      })
    );

    // Sự kiện Khóa / Mở khóa
    container.querySelectorAll("[data-acc-toggle]").forEach((btn) =>
      btn.addEventListener("click", () => {
        const id = btn.dataset.accToggle;
        toggleActive(id);
        const user = initialUsers.find((u) => u.id === id);
        if (user) user.active = !user.active;
        renderTable();
        flash(el, `Đã ${user?.active ? "mở khóa" : "khóa"} tài khoản ${user?.fullName}.`);
      })
    );

    // Sửa tài khoản
    container.querySelectorAll("[data-acc-edit]").forEach((btn) =>
      btn.addEventListener("click", () => {
        const user = initialUsers.find((u) => u.id === btn.dataset.accEdit);
        if (!user) return;
        openEditAccountModal(user, () => {
          const updated = DB.findById("users", user.id);
          if (updated) Object.assign(user, updated);
          renderTable();
          refreshParentLinksTable?.();
          flash(el, `Đã cập nhật thông tin tài khoản ${user.fullName}.`);
        });
      })
    );
  }

  searchInput?.addEventListener("input", renderTable);
  roleSelect?.addEventListener("change", renderTable);
  statusSelect?.addEventListener("change", renderTable);
  el.querySelector("#acc-link-select")?.addEventListener("change", renderTable);

  renderTable();
}

function accountClassesBlock(user) {
  if (user.role === "parent") {
    const student = getLinkedStudent(user.id);
    return student
      ? `<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
          <span style="font-size:13px;font-weight:700;color:var(--brand-ink);">Học sinh liên kết:</span>
          <span class="badge student">Mã HS: ${student.id}</span>
          <strong>${escapeHtml(student.fullName)}</strong>
          <span class="muted">(@${escapeHtml(student.username)} · ${escapeHtml(student.email || "")})</span>
        </div>`
      : `<span class="muted">Tài khoản phụ huynh chưa liên kết với học sinh nào.</span>`;
  }

  const classes = getAdminAccountClasses(user);
  if (!classes.length) {
    return user.role === "student"
      ? `<span class="muted">Học sinh chưa đăng ký lớp nào. Mã học sinh: <strong>${user.id}</strong></span>`
      : `<span class="muted">Giáo viên hiện chưa được phân công lớp nào.</span>`;
  }

  return `
    <div>
      <div style="font-size:13px;font-weight:700;color:var(--brand-ink);margin-bottom:8px;">
        ${user.role === "student" ? `Danh sách lớp đang học (Mã HS: ${user.id}):` : "Danh sách lớp đang phụ trách giảng dạy:"}
      </div>
      <div style="display:flex;flex-direction:column;gap:6px;">
        ${classes
          .map(
            (c) => `
              <div style="display:flex;align-items:center;gap:12px;padding:6px 12px;background:#fff;border:1px solid var(--line);border-radius:8px;font-size:13px;flex-wrap:wrap;">
                <strong>${escapeHtml(c.className)}</strong>
                <span class="badge subject">${subjectLabel(c.subject)}</span>
                <span class="muted">${formatSchedule(c.schedule)}</span>
                <span class="muted">Sĩ số: ${c.enrolled}/${c.maxSlot}</span>
                ${statusBadge(c.status)}
              </div>`
          )
          .join("")}
      </div>
    </div>`;
}

// =============================================================================
// QUẢN LÝ BẢNG LỚP HỌC (TÌM KIẾM, LỌC, XEM CHI TIẾT TỪNG LỚP, ĐÓNG/MỞ LỚP)
// =============================================================================
function setupClassesSection(el, allClasses) {
  const container = el.querySelector("#cls-table-container");
  const countChip = el.querySelector("#chip-classes-count");
  const searchInput = el.querySelector("#cls-search-input");
  const subjectSelect = el.querySelector("#cls-subject-select");
  const statusSelect = el.querySelector("#cls-status-select");

  function getFilteredClasses() {
    const q = searchKey(searchInput?.value);
    const subject = subjectSelect?.value || "";
    const status = statusSelect?.value || "";

    return allClasses.filter((c) => {
      if (subject && c.subject !== subject) return false;
      if (status && c.status !== status) return false;
      if (q) {
        const matchesName = searchKey(c.className).includes(q);
        const matchesTeacher = searchKey(c.teacherName).includes(q);
        if (!matchesName && !matchesTeacher) return false;
      }
      return true;
    });
  }

  function renderCompactTable() {
    const list = getFilteredClasses();
    const openCount = list.filter((c) => c.status === "open").length;
    if (countChip) {
      const totalLabel =
        list.length === allClasses.length
          ? String(allClasses.length)
          : `${list.length}/${allClasses.length}`;
      countChip.textContent = `${totalLabel} lớp (${openCount} đang mở)`;
    }

    if (!allClasses.length) {
      container.innerHTML = `
        <div class="empty" style="padding:28px;text-align:center;color:var(--muted);">
          Chưa có lớp học nào trong hệ thống.
        </div>`;
      return;
    }

    if (!list.length) {
      container.innerHTML = `
        <div class="empty" style="padding:28px;text-align:center;color:var(--muted);">
          Không tìm thấy lớp học nào khớp với bộ lọc.
        </div>`;
      return;
    }

    container.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Tên lớp học</th>
            <th>Bộ môn</th>
            <th>Giáo viên phụ trách</th>
            <th>Sĩ số lớp</th>
            <th>Lịch học trong tuần</th>
            <th>Trạng thái</th>
            <th style="text-align:right;">Thao tác</th>
          </tr>
        </thead>
        <tbody>
          ${list
            .map(
              (c, i) => `
                <tr${c.status === "pending" ? ' class="class-row-pending"' : ""}>
                  <td>${i + 1}</td>
                  <td><strong>${escapeHtml(c.className)}</strong></td>
                  <td><span class="badge subject">${subjectLabel(c.subject)}</span></td>
                  <td>${escapeHtml(c.teacherName)}</td>
                  <td>
                    <span class="slot-cell">
                      <span class="slot-text">${c.enrolled}/${c.maxSlot} (${pct(c.enrolled, c.maxSlot)}%)</span>
                      <span class="slot-bar"><i style="width:${pct(c.enrolled, c.maxSlot)}%"></i></span>
                    </span>
                  </td>
                  <td class="muted">${formatSchedule(c.schedule)}</td>
                  <td>${statusBadge(c.status)}</td>
                  <td class="actions">
                    <div class="actions-grid">
                      <button class="btn btn-sm btn-primary" data-cls-view="${c.id}">
                        Xem chi tiết
                      </button>
                    </div>
                  </td>
                </tr>`
            )
            .join("")}
        </tbody>
      </table>`;

    container.querySelectorAll("[data-cls-view]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const cls = allClasses.find((c) => c.id === btn.dataset.clsView);
        if (cls) openClassDetailModal(cls);
      });
    });
  }

  searchInput?.addEventListener("input", renderCompactTable);
  subjectSelect?.addEventListener("change", renderCompactTable);
  statusSelect?.addEventListener("change", renderCompactTable);

  renderCompactTable();
}

// =============================================================================
// QUẢN LÝ LIÊN KẾT PHỤ HUYNH - HỌC SINH (MỚI CHO ADMIN)
// =============================================================================
function setupParentLinksSection(el) {
  const container = el.querySelector("#parentlinks-table-container");
  const countChip = el.querySelector("#chip-parentlinks-count");
  const btnAdd = el.querySelector("#btn-add-parent-link");
  const searchInput = el.querySelector("#pl-search-input");
  const statusSelect = el.querySelector("#pl-status-select");

  function loadParents() {
    return DB.getAll("users").filter((u) => u.role === "parent");
  }

  function getFilteredParents(parents) {
    const q = searchKey(searchInput?.value);
    const linkStatus = statusSelect?.value || "";

    return parents.filter((parent) => {
      const student = getLinkedStudent(parent.id);
      if (linkStatus === "linked" && !student) return false;
      if (linkStatus === "unlinked" && student) return false;
      if (q) {
        const matches =
          searchKey(parent.fullName).includes(q) ||
          searchKey(parent.username).includes(q) ||
          searchKey(parent.email).includes(q) ||
          searchKey(parent.phone).includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }

  function renderTable() {
    const parents = loadParents();
    const filtered = getFilteredParents(parents);

    if (countChip) {
      countChip.textContent =
        filtered.length === parents.length
          ? `${parents.length} tài khoản phụ huynh`
          : `${filtered.length}/${parents.length} tài khoản phụ huynh`;
    }

    // Đồng bộ badge menu Sidebar cho mục Liên kết PH - HS
    updateAdminSidebarBadges(el.closest(".app-shell"), {
      parentlinks: parents.filter((p) => !getLinkedStudent(p.id)).length,
    });

    if (!parents.length) {
      container.innerHTML = `<div class="empty" style="padding:28px;text-align:center;color:var(--muted);">Chưa có tài khoản phụ huynh nào.</div>`;
      return;
    }

    if (!filtered.length) {
      container.innerHTML = `<div class="empty" style="padding:28px;text-align:center;color:var(--muted);">Không tìm thấy phụ huynh nào khớp với bộ lọc.</div>`;
      return;
    }

    container.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>#</th><th>Phụ huynh</th><th>Tài khoản</th><th>Email</th><th>Số điện thoại</th><th>Học sinh liên kết</th><th style="text-align:right;">Thao tác</th>
          </tr>
        </thead>
        <tbody>
          ${filtered
            .map(
              (p, i) => {
                const student = getLinkedStudent(p.id);
                return `
                  <tr data-parent-row="${p.id}">
                    <td>${i + 1}</td>
                    <td><strong>${escapeHtml(p.fullName)}</strong></td>
                    <td><span class="badge" style="background:#f4efff;color:#5e1bd6;">@${escapeHtml(p.username)}</span></td>
                    <td>${escapeHtml(p.email || "—")}</td>
                    <td>${
                      p.phone
                        ? `<a href="tel:${escapeHtml(p.phone)}" title="Gọi điện thoại" style="color:#5e1bd6;font-weight:700;text-decoration:none;">${escapeHtml(p.phone)}</a>`
                        : `<span class="muted">—</span>`
                    }</td>
                    <td>
                      ${student
                        ? `<div>
                            <strong>${escapeHtml(student.fullName)}</strong>
                            <span class="badge student">Mã HS: ${student.id}</span>
                            <span class="muted">(@${escapeHtml(student.username)} · ${escapeHtml(student.email || "")})</span>
                          </div>`
                        : `<span class="muted">Chưa liên kết học sinh nào</span>`}
                    </td>
                    <td class="actions">
                      <div class="actions-grid">
                        ${student
                          ? `<button class="btn btn-sm btn-warn" data-pl-unlink="${p.id}" title="Hủy liên kết">${ICONS.close}</button>
                             <button class="btn btn-sm btn-primary" data-pl-change="${p.id}" title="Thay đổi học sinh">${ICONS.edit}</button>`
                          : `<button class="btn btn-sm btn-primary" data-pl-link="${p.id}" title="Liên kết">${ICONS.plus}</button>`}
                      </div>
                    </td>
                  </tr>`;
              }
            )
            .join("")}
        </tbody>
      </table>`;

    container.querySelectorAll("[data-pl-link]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const parent = loadParents().find((p) => p.id === btn.dataset.plLink);
        if (parent) openParentLinkModal(parent, el, () => renderTable());
      });
    });

    container.querySelectorAll("[data-pl-change]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const parent = loadParents().find((p) => p.id === btn.dataset.plChange);
        if (parent) openParentLinkModal(parent, el, () => renderTable());
      });
    });

    container.querySelectorAll("[data-pl-unlink]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const parent = loadParents().find((p) => p.id === btn.dataset.plUnlink);
        if (!parent) return;
        const student = getLinkedStudent(parent.id);
        if (!student) return;
        openUnlinkConfirmModal(parent, student, () => {
          renderTable();
          flash(el, `Đã hủy liên kết phụ huynh ${parent.fullName}.`);
        });
      });
    });
  }

  refreshParentLinksTable = renderTable;

  searchInput?.addEventListener("input", renderTable);
  statusSelect?.addEventListener("change", renderTable);

  btnAdd?.addEventListener("click", () => {
    const unlinkedParents = loadParents().filter((p) => !getLinkedStudent(p.id));
    if (!unlinkedParents.length) {
      flash(el, "Tất cả phụ huynh hiện đã được liên kết học sinh.");
      return;
    }
    openParentLinkModal(unlinkedParents[0], el, () => renderTable());
  });

  renderTable();
}

// Popup xác nhận trước khi hủy liên kết phụ huynh - học sinh.
function openUnlinkConfirmModal(parent, student, onConfirmed) {
  openModal({
    title: "Xác nhận hủy liên kết",
    body: `
      <div style="display:flex;gap:14px;align-items:flex-start;">
        <span class="unlink-warning-icon" style="width:42px;height:42px;border-radius:50%;background:#fdecec;color:#c0392b;display:grid;place-items:center;flex:none;">
          ${ICONS.close}
        </span>
        <div>
          <p style="margin:0 0 8px;font-size:14.5px;line-height:1.55;color:var(--brand-ink);">
            Bạn có chắc chắn muốn hủy liên kết giữa phụ huynh
            <strong>${escapeHtml(parent.fullName)}</strong> và học sinh
            <strong>${escapeHtml(student.fullName)}</strong> không?
          </p>
          <p class="muted" style="margin:0;font-size:12.5px;">
            Sau khi hủy, tài khoản phụ huynh sẽ không còn theo dõi được thông tin học tập của học sinh này.
          </p>
        </div>
      </div>
      <p class="form-error" id="pl-unlink-error" role="alert" hidden></p>`,
    foot: `
      <button class="btn" data-close>Hủy</button>
      <button class="btn btn-danger" id="pl-unlink-confirm">Xác nhận hủy liên kết</button>`,
    onMount: (root, close) => {
      root.querySelector("#pl-unlink-confirm").addEventListener("click", () => {
        const err = root.querySelector("#pl-unlink-error");
        err.hidden = true;
        try {
          unlinkParent(parent.id);
          close();
          onConfirmed();
        } catch (e) {
          err.textContent = e.message;
          err.hidden = false;
        }
      });
    },
  });
}

function openParentLinkModal(parent, el, onSaved) {
  const currentStudent = getLinkedStudent(parent.id);
  const available = listStudentsAvailableForLink();
  const options = currentStudent ? [...available, currentStudent] : available;

  openModal({
    title: currentStudent
      ? `Thay đổi học sinh liên kết · ${escapeHtml(parent.fullName)}`
      : `Liên kết học sinh · ${escapeHtml(parent.fullName)}`,
    size: "modal-lg",
    body: `
      <p class="muted">
        Phụ huynh: <strong>${escapeHtml(parent.fullName)}</strong> (@${escapeHtml(parent.username)}) · Email: ${escapeHtml(parent.email || "—")} · SĐT: ${escapeHtml(parent.phone || "—")}
      </p>
      <div class="modal-form">
        <div>
          <label for="pl-student-id">Chọn học sinh (con) *</label>
          <select id="pl-student-id" style="width:100%;padding:10px 12px;border-radius:10px;border:1.5px solid var(--line);background:var(--field);">
            <option value="">-- Chọn học sinh --</option>
            ${options
              .map(
                (s) => `<option value="${s.id}" ${currentStudent && s.id === currentStudent.id ? "selected" : ""}>
                  ${escapeHtml(s.fullName)} · Mã HS: ${s.id} (@${escapeHtml(s.username)})
                </option>`
              )
              .join("")}
          </select>
        </div>
        <p class="muted" style="font-size:12px;">
          ${currentStudent ? "Hệ thống sẽ hủy liên kết cũ trước khi gán học sinh mới." : "Mỗi học sinh chỉ được liên kết 1 tài khoản phụ huynh."}
        </p>
      </div>
      <p class="form-error" id="pl-error" role="alert" hidden></p>
    `,
    foot: `<button class="btn" data-close>Hủy</button><button class="btn btn-primary" id="pl-save">Lưu liên kết</button>`,
    onMount: (root, close) => {
      root.querySelector("#pl-save").addEventListener("click", () => {
        const err = root.querySelector("#pl-error");
        err.hidden = true;
        const studentId = root.querySelector("#pl-student-id").value;
        if (!studentId) {
          err.textContent = "Vui lòng chọn học sinh để liên kết.";
          err.hidden = false;
          return;
        }
        try {
          if (currentStudent && studentId === currentStudent.id) {
            close();
            onSaved();
            return;
          }
          if (currentStudent) unlinkParent(parent.id);
          linkParentToStudent(parent.id, studentId);
          close();
          onSaved();
          flash(el, `Đã liên kết ${escapeHtml(parent.fullName)} với học sinh ${escapeHtml(DB.findById("users", studentId).fullName)}.`);
        } catch (e) {
          err.textContent = e.message;
          err.hidden = false;
        }
      });
    },
  });
}

// =============================================================================
// CÁC NÚT "XEM CHI TIẾT" CHO TỪNG BẢNG THÔNG TIN
// (YÊU CẦU: CÓ NÚT XEM CHI TIẾT CHO BẢNG THÔNG TIN ĐÓ)
// =============================================================================
function setupDetailButtons(el, { overview, allUsers, allClasses, requests, subjects, weekdayCounts }) {
  // 1. Xem chi tiết chỉ số KPI
  el.querySelector("#btn-detail-kpi")?.addEventListener("click", () => {
    const enrollments = DB.getAll("enrollments");
    const uniqueStudents = new Set(
      enrollments.filter((e) => e.status === "active").map((e) => e.studentId)
    ).size;
    openModal({
      title: "Chi tiết Chỉ số Hoạt động Toàn Trung tâm",
      size: "modal-lg",
      body: `
        <div style="display:flex;flex-direction:column;gap:16px;">
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;">
            <div style="padding:16px;background:#f8f7fd;border-radius:12px;border:1px solid var(--line);">
              <span class="muted" style="font-size:12px;font-weight:700;">TỔNG SỐ HỌC SINH</span>
              <div style="font-size:24px;font-weight:900;color:var(--brand-ink);">${overview.totalStudents}</div>
              <small class="muted">Tất cả tài khoản học sinh đã đăng ký</small>
            </div>
            <div style="padding:16px;background:#f8f7fd;border-radius:12px;border:1px solid var(--line);">
              <span class="muted" style="font-size:12px;font-weight:700;">TỔNG SỐ GIÁO VIÊN</span>
              <div style="font-size:24px;font-weight:900;color:var(--brand-ink);">${overview.totalTeachers}</div>
              <small class="muted">Phụ trách 3 môn Toán, Văn, Anh</small>
            </div>
            <div style="padding:16px;background:#f8f7fd;border-radius:12px;border:1px solid var(--line);">
              <span class="muted" style="font-size:12px;font-weight:700;">LỚP HOẠT ĐỘNG</span>
              <div style="font-size:24px;font-weight:900;color:var(--brand-ink);">${overview.openClasses}/${overview.totalClasses}</div>
              <small class="muted">Lớp đang mở trên tổng số lớp</small>
            </div>
          </div>

          <h4 style="margin:10px 0 4px;font-size:15px;color:var(--brand-ink);">Thống kê sĩ số và tỷ lệ đáp ứng</h4>
          ${infoRow("Tổng chỉ tiêu tiếp nhận (Slots)", `${allClasses.reduce((s, c) => s + (c.maxSlot || 0), 0)} học sinh`)}
          ${infoRow("Số lượng học sinh đã vào lớp", `${allClasses.reduce((s, c) => s + (c.enrolled || 0), 0)} lượt học sinh`)}
          ${infoRow("Học sinh đã đăng ký ít nhất 1 lớp", `${uniqueStudents} học sinh (${overview.totalStudents} tài khoản HS)`)}
          ${infoRow("Tỷ lệ lấp đầy trung bình", `${pct(allClasses.reduce((s, c) => s + (c.enrolled || 0), 0), allClasses.reduce((s, c) => s + (c.maxSlot || 0), 0))}%`)}
          ${infoRow("Tỷ lệ tài khoản hoạt động", `${pct(allUsers.filter((u) => u.active).length, allUsers.length)}% (${allUsers.filter((u) => u.active).length}/${allUsers.length})`)}
          ${infoRow("Số lượng yêu cầu từ giáo viên", `${requests.length} yêu cầu (${requests.filter((r) => r.status === "pending").length} chờ duyệt)`)}
        </div>`,
      foot: `<button class="btn btn-primary" data-close>Đã hiểu</button>`,
    });
  });

  // 2. Xem chi tiết Bảng Tài khoản
  el.querySelector("#btn-detail-accounts-table")?.addEventListener("click", () => {
    openModal({
      title: "Bảng Chi tiết Toàn bộ Tài khoản Hệ thống",
      size: "modal-xl",
      body: `
        <div style="display:flex;flex-direction:column;gap:14px;">
          <div style="display:flex;gap:12px;flex-wrap:wrap;padding:12px 16px;background:#f8f7fd;border-radius:10px;">
            <span>Tổng số: <strong>${allUsers.length} tài khoản</strong></span>
            <span>· Giáo viên: <strong>${allUsers.filter((u) => u.role === "teacher").length}</strong></span>
            <span>· Học sinh: <strong>${allUsers.filter((u) => u.role === "student").length}</strong></span>
            <span>· Phụ huynh: <strong>${allUsers.filter((u) => u.role === "parent").length}</strong></span>
            <span>· Đang hoạt động: <strong>${allUsers.filter((u) => u.active).length}</strong></span>
          </div>

          <div class="table-wrap" style="max-height:480px;overflow-y:auto;">
            <table>
              <thead>
                <tr>
                  <th>#</th><th>Họ tên</th><th>Tài khoản</th><th>Gmail</th><th>Vai trò</th><th>Giới tính</th><th>Ngày sinh</th><th>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                ${allUsers
                  .map(
                    (u, idx) => `
                      <tr>
                        <td>${idx + 1}</td>
                        <td><strong>${escapeHtml(u.fullName)}</strong></td>
                        <td>@${escapeHtml(u.username)}</td>
                        <td>${escapeHtml(u.email || "—")}</td>
                        <td><span class="badge role-${u.role}">${ROLE_LABELS[u.role] || u.role}</span></td>
                        <td>${escapeHtml(u.gender || "—")}</td>
                        <td>${escapeHtml(u.dob || "—")}</td>
                        <td><span class="badge ${u.active ? "active" : "inactive"}">${u.active ? "Hoạt động" : "Đã khóa"}</span></td>
                      </tr>`
                  )
                  .join("")}
              </tbody>
            </table>
          </div>
        </div>`,
      foot: `
        <button class="btn" id="modal-export-users-csv">Xuất file CSV</button>
        <button class="btn btn-primary" data-close>Đóng</button>`,
      onMount: (root) => {
        root.querySelector("#modal-export-users-csv")?.addEventListener("click", () => {
          downloadCSV(
            "danh-sach-tai-khoan.csv",
            ["STT", "HoTen", "TaiKhoan", "Email", "VaiTro", "GioiTinh", "NgaySinh", "TrangThai"],
            allUsers.map((u, i) => [
              i + 1,
              u.fullName,
              u.username,
              u.email || "",
              ROLE_LABELS[u.role] || u.role,
              u.gender || "",
              u.dob || "",
              u.active ? "HoatDong" : "BiKhoa",
            ])
          );
        });
      },
    });
  });

  // 3. Xem chi tiết Bảng Thông báo & Yêu cầu
  el.querySelector("#btn-detail-requests-table")?.addEventListener("click", () => {
    openModal({
      title: "Bảng Chi tiết Yêu cầu & Thông báo từ Giáo viên",
      size: "modal-lg",
      body: `
        <div style="display:flex;flex-direction:column;gap:14px;">
          <div style="display:flex;gap:14px;padding:12px 16px;background:#f8f7fd;border-radius:10px;">
            <span>Tổng yêu cầu: <strong>${requests.length}</strong></span>
            <span>· Chờ duyệt: <strong style="color:#b45309;">${requests.filter((r) => r.status === "pending").length}</strong></span>
            <span>· Đã duyệt: <strong style="color:#0d8a5f;">${requests.filter((r) => r.status === "approved").length}</strong></span>
            <span>· Đã từ chối: <strong style="color:#c0392b;">${requests.filter((r) => r.status === "rejected").length}</strong></span>
          </div>

          <div style="display:flex;flex-direction:column;gap:10px;max-height:480px;overflow-y:auto;">
            ${
              requests.length
                ? requests
                    .map(
                      (r) => `
                        <div style="border:1px solid var(--line);border-radius:12px;padding:14px;background:#fff;display:flex;justify-content:space-between;align-items:center;gap:12px;">
                          <div>
                            <strong style="font-size:14px;display:block;">
                              ${REQ_TYPE_LABELS[r.type] || "Yêu cầu"} · ${escapeHtml(r.cls.className)}
                            </strong>
                            <div style="font-size:12.5px;color:var(--muted);margin-top:3px;">
                              Giáo viên: <strong>${escapeHtml(r.teacher?.fullName || "—")}</strong>
                              · <span class="badge subject">${subjectLabel(r.cls.subject)}</span>
                              · Ngày gửi: ${formatDate(String(r.createdAt).slice(0, 10))}
                            </div>
                          </div>
                          <div style="display:flex;align-items:center;gap:10px;">
                            <span class="badge ${REQ_STATUS_BADGES[r.status]}">
                              ${REQ_STATUS_LABELS[r.status]}
                            </span>
                            <button class="btn btn-sm btn-primary" data-modal-req="${r.id}" style="width:auto;padding:5px 12px;">
                              Xem & Xử lý
                            </button>
                          </div>
                        </div>`
                    )
                    .join("")
                : `<div class="empty">Không có yêu cầu nào.</div>`
            }
          </div>
        </div>`,
      foot: `<button class="btn btn-primary" data-close>Đóng</button>`,
      onMount: (root, close) => {
        root.querySelectorAll("[data-modal-req]").forEach((btn) =>
          btn.addEventListener("click", () => {
            const req = requests.find((r) => r.id === btn.dataset.modalReq);
            if (req) {
              close();
              openRequestDetail(req, (msg, type) => {
                renderAdminOverviewPage(el);
                flash(el, msg, type);
              });
            }
          })
        );
      },
    });
  });

  // 4. Xem chi tiết Phân tích
  el.querySelector("#btn-detail-analytics")?.addEventListener("click", () => {
    openModal({
      title: "Báo cáo Phân tích Chuyên sâu Hoạt động Trung tâm",
      size: "modal-lg",
      body: `
        <div style="display:flex;flex-direction:column;gap:16px;">
          <h4 style="margin:0;font-size:15px;color:var(--brand-ink);">1. Tình hình tuyển sinh và quy mô môn học</h4>
          <div class="table-wrap">
            <table>
              <thead>
                <tr><th>Môn học</th><th>Số lớp</th><th>Tổng sĩ số</th><th>Chỉ tiêu tối đa</th><th>Tỷ lệ lấp đầy</th></tr>
              </thead>
              <tbody>
                ${subjects
                  .map(
                    (s) => `
                      <tr>
                        <td><strong>${s.name}</strong></td>
                        <td>${s.classCount} lớp</td>
                        <td>${s.enrolled} học sinh</td>
                        <td>${s.capacity} chỗ</td>
                        <td><strong>${s.occupancy}%</strong></td>
                      </tr>`
                  )
                  .join("")}
              </tbody>
            </table>
          </div>

          <h4 style="margin:10px 0 0;font-size:15px;color:var(--brand-ink);">2. Phân bố ca học các ngày trong tuần</h4>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(90px,1fr));gap:8px;">
            ${weekdayCounts
              .map(
                (w) => `
                  <div style="padding:12px 8px;text-align:center;background:#f8f7fd;border-radius:10px;border:1px solid var(--line);">
                    <div style="font-size:12px;color:var(--muted);font-weight:700;">${w.label}</div>
                    <div style="font-size:20px;font-weight:900;color:var(--brand-dark);">${w.count}</div>
                    <small style="font-size:11px;color:var(--muted);">lớp học</small>
                  </div>`
              )
              .join("")}
          </div>
        </div>`,
      foot: `<button class="btn btn-primary" data-close>Đóng báo cáo</button>`,
    });
  });

  // 5. Xem chi tiết Nhật ký
  el.querySelector("#btn-detail-logs")?.addEventListener("click", () => {
    openModal({
      title: "Nhật ký Hoạt động & Hệ thống",
      size: "modal-lg",
      body: `
        <div style="display:flex;flex-direction:column;gap:12px;">
          <p class="muted">Ghi nhận các sự kiện phát sinh từ tài khoản, lớp học và các phê duyệt của Quản trị viên.</p>
          <div style="display:flex;flex-direction:column;gap:8px;">
            ${requests
              .map(
                (r) => `
                  <div style="padding:10px 14px;background:#faf9fe;border-radius:10px;border-left:4px solid ${r.status === 'pending' ? '#d97706' : '#0d8a5f'};">
                    <div style="display:flex;justify-content:space-between;">
                      <strong>${REQ_TYPE_LABELS[r.type] || "Yêu cầu"} · ${escapeHtml(r.cls.className)}</strong>
                      <span class="badge ${REQ_STATUS_BADGES[r.status]}">${REQ_STATUS_LABELS[r.status]}</span>
                    </div>
                    <div style="font-size:12px;color:var(--muted);margin-top:4px;">
                      Giáo viên ${escapeHtml(r.teacher?.fullName || "—")} gửi vào ngày ${formatDate(String(r.createdAt).slice(0, 10))}
                      ${r.decidedAt ? ` · Xử lý lúc ${formatDate(String(r.decidedAt).slice(0, 10))}` : ""}
                    </div>
                  </div>`
              )
              .join("")}
          </div>
        </div>`,
      foot: `<button class="btn btn-primary" data-close>Đóng</button>`,
    });
  });

  // Sự kiện nút Xem chi tiết từ danh sách yêu cầu
  el.querySelectorAll("[data-open-req]").forEach((btn) =>
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const req = requests.find((r) => r.id === btn.dataset.openReq);
      if (req) {
        openRequestDetail(req, (msg, type) => {
          renderAdminOverviewPage(el);
          flash(el, msg, type);
        });
      }
    })
  );

  el.querySelectorAll(".notif-item[data-request-id]").forEach((row) =>
    row.addEventListener("click", () => {
      const req = requests.find((r) => r.id === row.dataset.requestId);
      if (req) {
        openRequestDetail(req, (msg, type) => {
          renderAdminOverviewPage(el);
          flash(el, msg, type);
        });
      }
    })
  );

  // Phê duyệt / từ chối ngay tại chỗ từ danh sách thông báo (không cần vào modal chi tiết).
  // stopPropagation để không kích hoạt handler mở modal chi tiết của cả dòng.
  el.querySelectorAll("[data-req-approve]").forEach((btn) =>
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const req = requests.find((r) => r.id === btn.dataset.reqApprove);
      try {
        approveClassRequest(btn.dataset.reqApprove);
        renderAdminOverviewPage(el);
        flash(el, req?.type === "close" ? "Đã phê duyệt — lớp học đã được đóng." : "Đã phê duyệt yêu cầu của giáo viên.");
      } catch (err) {
        flash(el, err.message, "error");
      }
    })
  );

  el.querySelectorAll("[data-req-reject]").forEach((btn) =>
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const req = requests.find((r) => r.id === btn.dataset.reqReject);
      openRejectRequestModal(req, (reason) => {
        try {
          rejectClassRequest(btn.dataset.reqReject, reason);
          renderAdminOverviewPage(el);
          flash(
            el,
            "Đã từ chối yêu cầu của giáo viên." + (reason ? ` Lý do: ${reason}` : "")
          );
        } catch (err) {
          flash(el, err.message, "error");
        }
      });
    })
  );
}

// =============================================================================
// THAO TÁC NHANH (TẠO TÀI KHOẢN, XUẤT DỮ LIỆU, RESET SEED)
// =============================================================================
function setupQuickActions(el) {
  // Nút Thêm tài khoản từ banner và panel
  const openNewUser = () => {
    openCreateUserModal(() => {
      renderAdminOverviewPage(el);
      flash(el, "Đã tạo tài khoản mới thành công!");
    });
  };
  el.querySelector("#btn-quick-new-user")?.addEventListener("click", openNewUser);
  el.querySelector("#btn-add-account-panel")?.addEventListener("click", openNewUser);
  el.querySelector("#act-create-user")?.addEventListener("click", openNewUser);

  // Xuất dữ liệu trung tâm dạng JSON
  el.querySelector("#act-export-data")?.addEventListener("click", () => {
    const data = {
      exportedAt: new Date().toISOString(),
      users: DB.getAll("users"),
      classes: DB.getAll("classes"),
      enrollments: DB.getAll("enrollments"),
      sessions: DB.getAll("sessions"),
      attendance: DB.getAll("attendance"),
      class_requests: DB.getAll("class_requests"),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `btm-backup-${todayStr()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    flash(el, "Đã xuất file dữ liệu hệ thống (JSON) thành công.");
  });

  // Làm mới giao diện
  el.querySelector("#act-refresh-all")?.addEventListener("click", () => {
    renderAdminOverviewPage(el);
    flash(el, "Đã làm mới toàn bộ dữ liệu tổng quan.");
  });

  // Khôi phục dữ liệu gốc mẫu (Reset Seed) — xác nhận 2 bước để tránh bấm nhầm
  el.querySelector("#act-reset-seed")?.addEventListener("click", () => {
    openResetSeedFlow(el);
  });
}

/**
 * Khôi phục dữ liệu gốc: Bước 1 - Cảnh báo conséquences.
 */
function openResetSeedFlow(el) {
  openModal({
    title: "Cảnh báo: Khôi phục dữ liệu gốc",
    body: `
      <p style="color:#c0392b;font-weight:700;margin:0 0 10px;">⚠ Hành động này sẽ XÓA TRÊN TẤT CẢ dữ liệu hiện có.</p>
      <ul style="color:var(--muted);margin:0 0 12px;padding-left:20px;font-size:13px;">
        <li>Tất cả tài khoản, lớp học, đăng ký học, điểm số, điểm danh đã tạo thử nghiệm sẽ bị mất vĩnh viễn.</li>
        <li>Dữ liệu sẽ được đặt lại về mẫu chuẩn ban đầu từ hệ thống seed (bao gồm tài khoản demo mới).</li>
        <li>Bạn sẽ bị đăng xuất và quay về trang đăng nhập ngay sau khi khôi phục.</li>
      </ul>
      <p class="muted" style="font-size:12px;">Hành động không thể hoàn tác.</p>`,
    foot: `<button class="btn" data-close>Hủy</button><button class="btn btn-primary" id="reset-confirm-step1">Tôi hiểu, tiếp tục</button>`,
    onMount: (root, close) => {
      root.querySelector("#reset-confirm-step1").addEventListener("click", () => {
        close();
        openResetSeedConfirm(el);
      });
    },
  });
}

/**
 * Khôi phục dữ liệu gốc: Bước 2 - Yêu cầu gõ mã xác nhận "KHÔI PHỤC".
 */
function openResetSeedConfirm(el) {
  openModal({
    title: "Xác nhận cuối cùng",
    body: `
      <p style="margin:0 0 10px;">Để xác nhận, vui lòng gõ chính xác từ khoá <strong>KHÔI PHỤC</strong> vào ô dưới đây.</p>
      <div class="modal-form">
        <input id="reset-confirm-code" type="text" placeholder="KHÔI PHỤC" />
      </div>
      <p class="form-error" id="reset-confirm-error" role="alert" hidden></p>`,
    foot: `<button class="btn" data-close>Hủy</button><button class="btn btn-danger" id="reset-confirm-final" disabled>Khôi phục dữ liệu gốc</button>`,
    onMount: (root, close) => {
      const input = root.querySelector("#reset-confirm-code");
      const btn = root.querySelector("#reset-confirm-final");
      const err = root.querySelector("#reset-confirm-error");

      const enable = () => {
        btn.disabled = input.value.trim() !== "KHÔI PHỤC";
        err.hidden = true;
      };
      input.addEventListener("input", enable);

      btn.addEventListener("click", () => {
        if (input.value.trim() !== "KHÔI PHỤC") {
          err.textContent = "Vui lòng gõ đúng từ khoá KHÔI PHỤC.";
          err.hidden = false;
          return;
        }
        localStorage.clear();
        Session.logout();
        seedDatabase();
        close();
        Router.navigate("/login");
      });
    },
  });
}

// =============================================================================
// MODAL CHI TIẾT TỪNG LỚP HỌC (HIỂN THỊ DANH SÁCH HỌC SINH VÀ LỊCH BUỔI HỌC)
// =============================================================================
function openClassDetailModal(cls) {
  const students = listStudentsOfClass(cls.id);
  const sessions = DB.getAll("sessions")
    .filter((s) => s.classId === cls.id)
    .sort((a, b) => a.date.localeCompare(b.date));

  openModal({
    title: `Chi tiết Lớp học · ${escapeHtml(cls.className)}`,
    size: "modal-lg",
    body: `
      <div style="display:flex;flex-direction:column;gap:14px;">
        <div class="roster-summary">
          <div class="roster-chip">
            <span class="roster-chip-k">Bộ môn</span>
            <span class="roster-chip-v"><span class="badge subject">${subjectLabel(cls.subject)}</span></span>
          </div>
          <div class="roster-chip">
            <span class="roster-chip-k">Giáo viên phụ trách</span>
            <span class="roster-chip-v">${escapeHtml(cls.teacherName || "—")}</span>
          </div>
          <div class="roster-chip">
            <span class="roster-chip-k">Sĩ số hiện tại</span>
            <span class="roster-chip-v">${cls.enrolled}/${cls.maxSlot} (${pct(cls.enrolled, cls.maxSlot)}%)</span>
          </div>
          <div class="roster-chip">
            <span class="roster-chip-k">Trạng thái</span>
            <span class="roster-chip-v">${statusBadge(cls.status)}</span>
          </div>
        </div>

        ${infoRow("Lịch học định kỳ hàng tuần", formatSchedule(cls.schedule))}
        ${infoRow("Số buổi học đã lên lịch", `${sessions.length} buổi`)}

        <h4 style="margin:12px 0 6px;font-size:14.5px;color:var(--brand-ink);">
          Danh sách Học sinh trong lớp (${students.length} học sinh)
        </h4>

        ${
          students.length
            ? `<div class="table-wrap" style="max-height:240px;overflow-y:auto;">
                <table>
                  <thead>
                    <tr><th>#</th><th>Mã HS</th><th>Họ và tên</th><th>Tài khoản</th><th>Gmail</th><th>Giới tính</th></tr>
                  </thead>
                  <tbody>
                    ${students
                      .map(
                        (st, i) => `
                          <tr>
                            <td>${i + 1}</td>
                            <td><span class="badge student">${st.id}</span></td>
                            <td><strong>${escapeHtml(st.fullName)}</strong></td>
                            <td>@${escapeHtml(st.username)}</td>
                            <td>${escapeHtml(st.email || "—")}</td>
                            <td>${escapeHtml(st.gender || "—")}</td>
                          </tr>`
                      )
                      .join("")}
                  </tbody>
                </table>
              </div>`
            : `<div class="empty" style="padding:14px;background:#faf9fe;border-radius:10px;text-align:center;">
                Lớp này hiện chưa có học sinh đăng ký.
              </div>`
        }

        <h4 style="margin:12px 0 6px;font-size:14.5px;color:var(--brand-ink);">
          Lịch các buổi học (${sessions.length} buổi)
        </h4>

        ${
          sessions.length
            ? `<div class="table-wrap" style="max-height:180px;overflow-y:auto;">
                <table>
                  <thead>
                    <tr><th>#</th><th>Tên buổi học</th><th>Ngày học</th><th>Phòng / Ghi chú</th></tr>
                  </thead>
                  <tbody>
                    ${sessions
                      .map(
                        (s, i) => `
                          <tr>
                            <td>${i + 1}</td>
                            <td><strong>${escapeHtml(s.title || `Buổi học ${i + 1}`)}</strong></td>
                            <td>${formatDate(s.date)}</td>
                            <td>${escapeHtml(s.room || s.note || "Phòng học trung tâm")}</td>
                          </tr>`
                      )
                      .join("")}
                  </tbody>
                </table>
              </div>`
            : `<div class="empty" style="padding:14px;background:#faf9fe;border-radius:10px;text-align:center;">
                Chưa có buổi học cụ thể nào được tạo cho lớp này.
              </div>`
        }
      </div>`,
    foot: `<button class="btn btn-primary" data-close>Đóng</button>`,
  });
}

// =============================================================================
// MODAL TẠO TÀI KHOẢN MỚI CHO ADMIN (GIÁO VIÊN / HỌC SINH / PHỤ HUYNH)
// =============================================================================
function openCreateUserModal(onCreated) {
  const students = DB.getAll("users").filter((u) => u.role === "student");

  openModal({
    title: "Thêm tài khoản người dùng mới",
    size: "modal-lg",
    body: `
      <div class="modal-form">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          <div>
            <label for="new-role">Vai trò tài khoản *</label>
            <select id="new-role" style="width:100%;padding:10px 12px;border-radius:10px;border:1.5px solid var(--line);background:var(--field);">
              <option value="teacher">Giáo viên</option>
              <option value="student">Học sinh</option>
              <option value="parent">Phụ huynh</option>
            </select>
          </div>
          <div id="new-subject-wrap">
            <label for="new-subject">Bộ môn phụ trách (Giáo viên) *</label>
            <select id="new-subject" style="width:100%;padding:10px 12px;border-radius:10px;border:1.5px solid var(--line);background:var(--field);">
              <option value="Toan">Toán</option>
              <option value="Van">Ngữ Văn</option>
              <option value="Anh">Tiếng Anh</option>
            </select>
          </div>
          <div id="new-parent-student-wrap" style="display:none;">
            <label for="new-student-id">Học sinh liên kết (Phụ huynh) *</label>
            <select id="new-student-id" style="width:100%;padding:10px 12px;border-radius:10px;border:1.5px solid var(--line);background:var(--field);">
              <option value="">-- Chọn học sinh --</option>
              ${students.map((s) => `<option value="${s.id}">${escapeHtml(s.fullName)} (Mã: ${s.id})</option>`).join("")}
            </select>
          </div>
          <div id="new-phone-wrap" style="display:none;">
            <label for="new-phone">Số điện thoại phụ huynh</label>
            <input id="new-phone" type="tel" placeholder="VD: 0901234567" />
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          <div>
            <label for="new-fullname">Họ và tên *</label>
            <input id="new-fullname" type="text" placeholder="Nguyễn Văn A" />
          </div>
          <div>
            <label for="new-username">Tên đăng nhập (Username) *</label>
            <input id="new-username" type="text" placeholder="nguyenvana" />
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          <div>
            <label for="new-email">Gmail liên hệ *</label>
            <input id="new-email" type="email" placeholder="example@gmail.com" />
          </div>
          <div>
            <label for="new-password">Mật khẩu *</label>
            <input id="new-password" type="password" placeholder="Tối thiểu 8 ký tự, gồm Hoa, Thường, Số, Ký tự đặc biệt" />
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          <div>
            <label for="new-gender">Giới tính *</label>
            <select id="new-gender" style="width:100%;padding:10px 12px;border-radius:10px;border:1.5px solid var(--line);background:var(--field);">
              <option value="Nam">Nam</option>
              <option value="Nữ">Nữ</option>
            </select>
          </div>
          <div>
            <label for="new-dob">Ngày sinh *</label>
            <input id="new-dob" type="date" value="2005-01-01" />
          </div>
        </div>
      </div>
      <p class="form-error" id="new-user-error" role="alert" hidden></p>`,
    foot: `
      <button class="btn" data-close>Hủy</button>
      <button class="btn btn-primary" id="btn-save-new-user">Tạo tài khoản</button>`,
    onMount: (root, close) => {
      const roleSel = root.querySelector("#new-role");
      const subjWrap = root.querySelector("#new-subject-wrap");
      const pStudWrap = root.querySelector("#new-parent-student-wrap");
      const phoneWrap = root.querySelector("#new-phone-wrap");
      const err = root.querySelector("#new-user-error");

      roleSel.addEventListener("change", () => {
        const r = roleSel.value;
        subjWrap.style.display = r === "teacher" ? "block" : "none";
        pStudWrap.style.display = r === "parent" ? "block" : "none";
        phoneWrap.style.display = r === "parent" ? "block" : "none";
      });

      root.querySelector("#btn-save-new-user").addEventListener("click", () => {
        err.hidden = true;
        const role = roleSel.value;
        const fullName = root.querySelector("#new-fullname").value.trim();
        const username = root.querySelector("#new-username").value.trim();
        const email = root.querySelector("#new-email").value.trim();
        const password = root.querySelector("#new-password").value;
        const phone = root.querySelector("#new-phone").value.trim();
        const gender = root.querySelector("#new-gender").value;
        const dob = root.querySelector("#new-dob").value;

        try {
          if (role === "teacher") {
            const subject = root.querySelector("#new-subject").value;
            registerTeacher({ username, password, email, fullName, gender, dob, subject });
          } else if (role === "student") {
            registerStudent({ username, password, email, fullName, gender, dob });
          } else if (role === "parent") {
            const studentId = root.querySelector("#new-student-id").value;
            if (!studentId) throw new Error("Vui lòng chọn học sinh liên kết cho phụ huynh");
            registerParent({ username, password, email, fullName, gender, dob, studentId, phone });
          }
          close();
          onCreated();
        } catch (e) {
          err.textContent = e.message;
          err.hidden = false;
        }
      });
    },
  });
}

// =============================================================================
// MODAL SỬA THÔNG TIN TÀI KHOẢN (GMAIL / SĐT / MẬT KHẨU)
// =============================================================================
function openEditAccountModal(user, onSaved) {
  openModal({
    title: `Sửa tài khoản · ${escapeHtml(user.fullName)}`,
    body: `
      <p class="muted" style="margin-bottom:12px;">@${escapeHtml(user.username)} · <span class="badge role-${user.role}">${ROLE_LABELS[user.role] || user.role}</span></p>
      <div class="modal-form">
        <div>
          <label for="acc-email">Gmail liên hệ</label>
          <input id="acc-email" type="email" value="${escapeHtml(user.email || "")}" />
        </div>
        ${
          user.role === "parent"
            ? `<div>
                <label for="acc-phone">Số điện thoại phụ huynh</label>
                <input id="acc-phone" type="tel" value="${escapeHtml(user.phone || "")}" placeholder="VD: 0901234567" />
              </div>`
            : ""
        }
        <div>
          <label for="acc-password">Mật khẩu mới</label>
          <input id="acc-password" type="password" autocomplete="new-password" placeholder="Để trống nếu muốn giữ nguyên mật khẩu cũ" />
        </div>
      </div>
      <p class="form-error" id="acc-error" role="alert" hidden></p>`,
    foot: `
      <button class="btn" data-close>Hủy</button>
      <button class="btn btn-primary" id="acc-save">Lưu thay đổi</button>`,
    onMount: (root, close) => {
      root.querySelector("#acc-save").addEventListener("click", () => {
        const err = root.querySelector("#acc-error");
        err.hidden = true;
        try {
          updateUserCredentials(user.id, {
            email: root.querySelector("#acc-email").value.trim(),
            phone: root.querySelector("#acc-phone")?.value.trim(),
            password: root.querySelector("#acc-password").value,
          });
          close();
          onSaved();
        } catch (e) {
          err.textContent = e.message;
          err.hidden = false;
        }
      });
    },
  });
}

// =============================================================================
// MODAL NHẬP LÝ DO TỪ CHỐI YÊU CẦU (thay cho prompt() của trình duyệt)
// =============================================================================
function openRejectRequestModal(req, onRejected) {
  const clsName = escapeHtml(req?.cls?.className || "");
  openModal({
    title: "Từ chối yêu cầu của giáo viên",
    body: `
      <div class="modal-form">
        ${
          req
            ? `${infoRow("Loại yêu cầu", REQ_TYPE_LABELS[req.type] || "Yêu cầu")}
               ${infoRow("Lớp học", clsName)}
               ${infoRow("Giáo viên gửi yêu cầu", escapeHtml(req.teacher?.fullName || "—"))}`
            : ""
        }
        <div>
          <label for="req-reject-reason">Lý do từ chối (không bắt buộc)</label>
          <textarea id="req-reject-reason" rows="3" placeholder="Nhập lý do để giáo viên nắm được thông tin"></textarea>
        </div>
      </div>`,
    foot: `
      <button class="btn" data-close>Hủy</button>
      <button class="btn btn-danger" id="req-reject-confirm">Từ chối yêu cầu</button>`,
    onMount: (root, close) => {
      root.querySelector("#req-reject-confirm").addEventListener("click", () => {
        const reason = root.querySelector("#req-reject-reason").value.trim();
        close();
        onRejected(reason);
      });
    },
  });
}

// =============================================================================
// MODAL CHI TIẾT & PHÊ DUYỆT YÊU CẦU TỪ GIÁO VIÊN
// =============================================================================
function openRequestDetail(req, onDone) {
  const isRegister = req.type === "register";
  const isReschedule = req.type === "reschedule";
  const isReopen = req.type === "reopen";
  const isClose = req.type === "close";

  const statusRow = infoRow(
    "Trạng thái hiện tại",
    `<span class="badge ${REQ_STATUS_BADGES[req.status]}">${REQ_STATUS_LABELS[req.status]}</span>`
  );

  // Nội dung riêng cho từng loại yêu cầu
  const typeBlock = isRegister
    ? `${infoRow("Thời gian học", dayLabels(req.cls.schedule))}
       ${infoRow("Khung giờ học", timeLabels(req.cls.schedule))}`
    : isReschedule
      ? `<div class="modal-compare" style="margin:12px 0;">
          <div class="cmp-box">
            <span class="cmp-label">Lịch học cũ</span>
            <div class="cmp-line">${dayLabels(req.oldSchedule)}</div>
            <div class="cmp-sub">${timeLabels(req.oldSchedule)}</div>
          </div>
          <div class="cmp-box new">
            <span class="cmp-label">Lịch học muốn đổi sang</span>
            <div class="cmp-line">${dayLabels(req.newSchedule)}</div>
            <div class="cmp-sub">${timeLabels(req.newSchedule)}</div>
          </div>
        </div>`
      : isClose
        ? `${infoRow("Thời gian học", dayLabels(req.cls.schedule))}
           ${infoRow("Khung giờ học", timeLabels(req.cls.schedule))}
           <p class="muted" style="margin-top:12px;">
             Phê duyệt yêu cầu này sẽ <strong>đóng lớp học</strong>: lớp ngừng hoạt động,
             không còn hiển thị để học sinh đăng ký mới và không thao tác điểm danh / nhập điểm được nữa.
           </p>`
        : isReopen
          ? `${infoRow("Thời gian học", dayLabels(req.cls.schedule))}
             ${infoRow("Khung giờ học", timeLabels(req.cls.schedule))}
             <p class="muted" style="margin-top:12px;">
               Phê duyệt yêu cầu này sẽ <strong>mở lại lớp học</strong> để học sinh đăng ký tham gia.
             </p>`
          : "";

  const title = isRegister
    ? "Chi tiết Yêu cầu Đăng ký Lớp mới"
    : isReschedule
      ? "Chi tiết Yêu cầu Đổi Lịch học"
      : isClose
        ? "Chi tiết Yêu cầu Đóng Lớp học"
        : "Chi tiết Yêu cầu Mở lại Lớp học";

  const approveMessage = isRegister
    ? "Đã phê duyệt — lớp học đã được mở hoạt động."
    : isReschedule
      ? "Đã phê duyệt — lịch học của lớp đã được cập nhật thành công."
      : isClose
        ? "Đã phê duyệt — lớp học đã được đóng."
        : "Đã phê duyệt — lớp học đã được mở lại.";

  const body = `
    ${infoRow("Lớp học", escapeHtml(req.cls.className))}
    ${infoRow("Môn học", subjectLabel(req.cls.subject))}
    ${infoRow("Giáo viên gửi yêu cầu", escapeHtml(req.teacher?.fullName || "—"))}
    ${typeBlock}
    ${statusRow}
    <p class="form-error" id="req-error" role="alert" hidden></p>`;

  const foot =
    req.status === "pending"
      ? `
        <button class="btn" data-close>Đóng</button>
        <button class="btn btn-danger" id="req-reject">Từ chối</button>
        <button class="btn btn-primary" id="req-approve">Phê duyệt yêu cầu</button>`
      : `<button class="btn" data-close>Đóng</button>`;

  openModal({
    title,
    body,
    foot,
    onMount: (root, close) => {
      const err = root.querySelector("#req-error");

      const decide = (fn, message) => {
        err.hidden = true;
        try {
          fn(req.id);
          close();
          onDone(message);
        } catch (e) {
          err.textContent = e.message;
          err.hidden = false;
        }
      };

      root.querySelector("#req-approve")?.addEventListener("click", () =>
        decide(approveClassRequest, approveMessage)
      );

      root.querySelector("#req-reject")?.addEventListener("click", () => {
        err.hidden = true;
        close();
        openRejectRequestModal(req, (reason) => {
          try {
            rejectClassRequest(req.id, reason);
            onDone(
              "Đã từ chối yêu cầu của giáo viên." + (reason ? ` Lý do: ${reason}` : "")
            );
          } catch (e) {
            onDone(e.message, "error");
          }
        });
      });
    },
  });
}

// =============================================================================
// HÀM TIỆN ÍCH XUẤT CSV CHO QUẢN TRỊ VIÊN
// =============================================================================
function downloadCSV(filename, headers, rows) {
  const content = [
    headers.join(","),
    ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")),
  ].join("\n");

  const blob = new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
