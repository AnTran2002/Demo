// pages/teacher/teacher-dashboard.page.js — Redesign Toàn diện: Trang Tổng quan Giảng dạy Hợp nhất (Teacher Role)
import { Session } from "../../core/session.js";
import { renderShell, ICONS, formatSchedule, ROLE_LABELS } from "../shell.js";
import {
  getTeacherOverview,
  getTeacherWeekSchedule,
  sessionAttendanceInfo,
} from "../../modules/dashboard/dashboard.service.js";
import {
  createClass,
  updateClassInfo,
  setClassStatus,
  getClassById,
  listStudentsOfClass,
} from "../../modules/classes/classes.service.js";
import {
  createSession,
  markAttendance,
  listAttendanceBySession,
  listUpcomingSessionsByClass,
  listSessionsByClass,
} from "../../modules/sessions/sessions.service.js";
import { attachMaterial, listMaterialsBySession } from "../../modules/materials/materials.service.js";
import { addGrade, listGradesByClass } from "../../modules/grades/grades.service.js";
import { addComment, listCommentsByClass } from "../../modules/comments/comments.service.js";
import { listClassRequests } from "../../modules/classes/class-requests.service.js";
import { DB } from "../../core/db.js";
import { escapeHtml } from "../../core/html.js";
import {
  WEEKDAYS,
  subjectLabel,
  formatDate,
  todayStr,
  ATTENDANCE_LABELS,
  GRADE_TYPES,
} from "../../data/constants.js";

const pct = (a, b) => Math.min(100, Math.round((a / (b || 1)) * 100));

const statusBadge = (status) => {
  if (status === "open") return `<span class="badge open">Đang mở</span>`;
  if (status === "pending") return `<span class="badge late">Chờ phê duyệt</span>`;
  return `<span class="badge closed">Đã đóng</span>`;
};

const attBadge = (sessionId) => {
  const info = sessionAttendanceInfo(sessionId);
  return info.done
    ? `<span class="badge active">Đã điểm danh (${info.marked} HS)</span>`
    : `<span class="badge inactive">Chưa điểm danh</span>`;
};

const materialLink = (m) => {
  const isUrl = String(m.fileData || "").startsWith("http");
  const target = isUrl
    ? m.fileData
    : String(m.fileData || "").startsWith("data:")
    ? m.fileData
    : `data:text/plain;charset=utf-8,${encodeURIComponent(m.fileData || "")}`;
  return isUrl
    ? `<a class="btn btn-sm btn-primary" href="${target}" target="_blank" rel="noopener" style="width:auto;padding:4px 10px;">${ICONS.download} Mở</a>`
    : `<a class="btn btn-sm btn-primary" href="${target}" download="${escapeHtml(m.fileName)}" style="width:auto;padding:4px 10px;">${ICONS.download} Tải về</a>`;
};

function flash(el, message, type = "success") {
  let box = el.querySelector("#teacher-flash");
  if (!box) {
    box = document.createElement("p");
    box.id = "teacher-flash";
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
// KHỞI TẠO TRANG GIÁO VIÊN: DUY NHẤT 1 TAB "TỔNG QUAN"
// =============================================================================
export function renderTeacherDashboard(container) {
  const teacher = Session.getCurrentUser();

  const tabs = [
    {
      id: "overview",
      label: "Tổng quan",
      icon: ICONS.grid,
      active: true,
      render: (content) => renderTeacherOverviewPage(content, teacher),
    },
  ];

  renderShell(container, { title: "Tổng quan Giảng dạy", items: tabs });
  const content = container.querySelector("#tab-content");

  renderTeacherOverviewPage(content, teacher);
}

// =============================================================================
// TRANG TỔNG QUAN GIÁO VIÊN (TỔNG HỢP TOÀN BỘ CÁC KHỐI THÔNG TIN VÀO 1 TRANG)
// =============================================================================
function renderTeacherOverviewPage(el, teacher) {
  const overview = getTeacherOverview(teacher.id);
  const myClasses = overview.classes;
  const weekClasses = getTeacherWeekSchedule(teacher.id);

  // Gom các buổi học của tất cả các lớp của giáo viên
  const allSessions = myClasses
    .flatMap((c) =>
      listSessionsByClass(c.id).map((s) => ({
        ...s,
        cls: c,
      }))
    )
    .sort((a, b) => b.date.localeCompare(a.date));

  const upcomingSessions = allSessions.filter((s) => s.date >= todayStr()).reverse();
  const pastSessions = allSessions.filter((s) => s.date < todayStr());

  // Thống kê chuyên cần của học sinh trong các lớp
  let totalAttMarked = 0;
  let totalAttPresent = 0;
  allSessions.forEach((s) => {
    const records = listAttendanceBySession(s.id);
    totalAttMarked += records.length;
    totalAttPresent += records.filter((r) => r.status === "present" || r.status === "late").length;
  });
  const attRate = pct(totalAttPresent, totalAttMarked || 1);

  // Yêu cầu của giáo viên này gửi admin
  const myRequests = listClassRequests().filter((r) => r.teacher?.id === teacher.id || r.teacherId === teacher.id);
  const pendingRequests = myRequests.filter((r) => r.status === "pending");

  // Thời khóa biểu theo các ngày trong tuần (2 - 8)
  const currentDow = new Date().getDay() === 0 ? 8 : new Date().getDay() + 1;
  const daysWeek = [2, 3, 4, 5, 6, 7, 8].map((day) => {
    const label = WEEKDAYS.find((w) => w.value === day)?.label || `T${day}`;
    const slots = [];
    weekClasses.forEach((c) => {
      (c.schedule || []).forEach((s) => {
        if (s.dayOfWeek === day) {
          slots.push({
            className: c.className,
            classId: c.id,
            subject: c.subject,
            time: `${s.start}–${s.end}`,
            room: c.room || "Phòng BTM",
          });
        }
      });
    });
    return { day, label, slots, isToday: day === currentDow };
  });

  el.innerHTML = `
    <p class="admin-flash" id="teacher-flash" hidden></p>

    <div class="overview-dashboard" id="tab-overview" data-page="giao-vien">

      <!-- Banner chào mừng giáo viên -->
      <div class="welcome-banner">
        <div>
          <h2 class="welcome-title">Xin chào, Thầy/Cô ${escapeHtml(teacher.fullName)}!</h2>
          <p class="welcome-sub">
            Bộ môn phụ trách: <strong>${subjectLabel(teacher.subject)}</strong> · Hôm nay: ${formatDate(todayStr())}
          </p>
        </div>
        <div style="display:flex;gap:10px;align-items:center;">
          <button class="btn btn-sm btn-primary" id="btn-quick-new-session" style="width:auto;padding:8px 16px;">
            ${ICONS.plus} Thêm buổi học mới
          </button>
        </div>
      </div>

      <!-- Thanh nhảy nhanh (Quick Jump Sticky Bar) -->
      <div class="overview-jump-bar" id="overview-jump-bar">
        <span class="jump-label">${ICONS.grid} Xem nhanh mục:</span>
        <a class="jump-pill active" href="#overview-kpis">
          <span>Chỉ số giảng dạy</span>
        </a>
        <a class="jump-pill" href="#overview-schedule">
          <span>Lịch dạy tuần này</span>
          <span class="jump-badge">${weekClasses.length} lớp</span>
        </a>
        <a class="jump-pill" href="#overview-classes">
          <span>Lớp học của tôi</span>
          <span class="jump-badge">${myClasses.length}</span>
        </a>
        <a class="jump-pill" href="#overview-sessions">
          <span>Buổi học & Điểm danh</span>
          <span class="jump-badge">${allSessions.length}</span>
        </a>
        <a class="jump-pill" href="#overview-grading">
          <span>Điểm & Nhận xét</span>
        </a>
        <a class="jump-pill" href="#overview-requests">
          <span>Yêu cầu gửi Admin</span>
          ${
            pendingRequests.length
              ? `<span class="jump-badge" style="background:#ffdd00;color:#5a4100;font-weight:800;">${pendingRequests.length}</span>`
              : `<span class="jump-badge">0</span>`
          }
        </a>
      </div>

      <!-- 1. DIV CHỈ SỐ GIẢNG DẠY (KPI) -->
      <div class="overview-panel" id="overview-kpis">
        <div class="panel-head-overview">
          <div class="panel-title-group">
            <span class="panel-icon-wrap">${ICONS.grid}</span>
            <div>
              <h2 class="panel-title">Chỉ số Giảng dạy & Hoạt động</h2>
              <span class="muted" style="font-size:12px;">Tổng hợp số liệu giảng dạy của Thầy/Cô</span>
            </div>
          </div>
          <div class="panel-actions">
            <button class="btn-view-detail" id="btn-detail-teacher-kpi">
              ${ICONS.eye}
              <span>Xem chi tiết chỉ số</span>
            </button>
          </div>
        </div>
        <div style="padding: 20px 24px;">
          <div class="kpi-row">
            <div class="kpi-card" style="--kpi-color:#4f46e5;--kpi-bg:#eef2ff;">
              <div class="kpi-icon">${ICONS.classes}</div>
              <div class="kpi-content">
                <span class="kpi-val">${myClasses.length}</span>
                <span class="kpi-tit">Lớp phụ trách</span>
                <span class="kpi-sub">${myClasses.filter((c) => c.status === "open").length} lớp đang mở</span>
              </div>
            </div>

            <div class="kpi-card" style="--kpi-color:#0d8a5f;--kpi-bg:#e6f8f0;">
              <div class="kpi-icon">${ICONS.users}</div>
              <div class="kpi-content">
                <span class="kpi-val">${overview.totalStudents}</span>
                <span class="kpi-tit">Tổng số học sinh</span>
                <span class="kpi-sub">Đang theo học các lớp</span>
              </div>
            </div>

            <div class="kpi-card" style="--kpi-color:#6a1bff;--kpi-bg:#f2ecff;">
              <div class="kpi-icon">${ICONS.calendar}</div>
              <div class="kpi-content">
                <span class="kpi-val">${allSessions.length}</span>
                <span class="kpi-tit">Buổi học đã tạo</span>
                <span class="kpi-sub">${upcomingSessions.length} buổi sắp diễn ra</span>
              </div>
            </div>

            <div class="kpi-card" style="--kpi-color:#0b7285;--kpi-bg:#e3f6f8;">
              <div class="kpi-icon">${ICONS.check}</div>
              <div class="kpi-content">
                <span class="kpi-val">${attRate}%</span>
                <span class="kpi-tit">Tỷ lệ chuyên cần</span>
                <span class="kpi-sub">Học sinh đi học đầy đủ</span>
              </div>
            </div>

            <div class="kpi-card" style="--kpi-color:#d97706;--kpi-bg:#fef3c7;">
              <div class="kpi-icon">${ICONS.bell}</div>
              <div class="kpi-content">
                <span class="kpi-val">${pendingRequests.length}</span>
                <span class="kpi-tit">Yêu cầu chờ Admin duyệt</span>
                <span class="kpi-sub">${myRequests.length} tổng yêu cầu đã gửi</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 2. DIV LỊCH GIẢNG DẠY TRONG TUẦN -->
      <div class="overview-panel" id="overview-schedule">
        <div class="panel-head-overview">
          <div class="panel-title-group">
            <span class="panel-icon-wrap" style="background:#eef2ff;color:#4f46e5;">${ICONS.calendar}</span>
            <div>
              <h2 class="panel-title">Lịch Giảng dạy Hàng tuần</h2>
              <span class="count-chip">${weekClasses.length} lớp có lịch tuần này</span>
            </div>
          </div>
          <div class="panel-actions">
            <button class="btn-view-detail" id="btn-detail-schedule">
              ${ICONS.eye}
              <span>Xem chi tiết lịch dạy</span>
            </button>
          </div>
        </div>

        <div style="padding: 20px 24px;">
          <div class="schedule-grid-week">
            ${daysWeek
              .map(
                (d) => `
                  <div class="schedule-day-card ${d.isToday ? "today" : ""}">
                    <div class="schedule-day-head">
                      <span class="schedule-day-name">${d.label}</span>
                      ${d.isToday ? `<span class="badge active" style="font-size:10px;padding:1px 6px;">Hôm nay</span>` : ""}
                      <span class="schedule-day-count">${d.slots.length} ca</span>
                    </div>
                    <div style="display:flex;flex-direction:column;gap:6px;flex:1;">
                      ${
                        d.slots.length
                          ? d.slots
                              .map(
                                (s) => `
                                  <div class="schedule-slot-item">
                                    <span class="schedule-slot-title">${escapeHtml(s.className)}</span>
                                    <span class="schedule-slot-time">⏰ ${s.time}</span>
                                    <span style="font-size:10px;color:var(--muted);">📍 ${escapeHtml(s.room)}</span>
                                  </div>`
                              )
                              .join("")
                          : `<span class="muted" style="font-size:11px;margin:auto 0;text-align:center;">Trống lịch</span>`
                      }
                    </div>
                  </div>`
              )
              .join("")}
          </div>
        </div>
      </div>

      <!-- 3. DIV LỚP HỌC CỦA TÔI -->
      <div class="overview-panel" id="overview-classes">
        <div class="panel-head-overview">
          <div class="panel-title-group">
            <span class="panel-icon-wrap">${ICONS.classes}</span>
            <div>
              <h2 class="panel-title">Danh sách Lớp học Phụ trách</h2>
              <span class="count-chip" id="chip-teacher-classes">${myClasses.length} lớp học</span>
            </div>
          </div>
          <div class="panel-actions">
            <button class="btn-quick-add" id="btn-create-class-panel">
              ${ICONS.plus}
              <span>Đăng ký mở lớp mới</span>
            </button>
            <button class="btn-view-detail" id="btn-detail-classes-panel">
              ${ICONS.eye}
              <span>Xem chi tiết bảng lớp</span>
            </button>
          </div>
        </div>

        <div class="table-wrap">
          ${
            myClasses.length
              ? `<table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Tên lớp</th>
                      <th>Môn học</th>
                      <th>Sĩ số lớp</th>
                      <th>Lịch học cố định</th>
                      <th>Trạng thái</th>
                      <th style="text-align:right;">Thao tác quản lý</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${myClasses
                      .map(
                        (c, i) => {
                          const isClosed = c.status === "closed";
                          const isPending = c.status === "pending";
                          const isInactive = isClosed || isPending;
                          const disabledAttr = isInactive ? "disabled" : "";
                          const disabledStyle = isInactive ? "opacity:0.45;cursor:not-allowed;" : "";
                          const closedTitle = isClosed ? "Lớp đã đóng – không thể thao tác" : isPending ? "Lớp chờ duyệt – chưa thể thao tác" : "";
                          return `
                          <tr style="${isClosed ? 'opacity:0.75;' : ''}">
                            <td>${i + 1}</td>
                            <td>
                              <strong>${escapeHtml(c.className)}</strong>
                              ${isClosed ? `<span class="badge closed" style="font-size:10px;margin-left:6px;">Đã đóng</span>` : ""}
                            </td>
                            <td><span class="badge subject">${subjectLabel(c.subject)}</span></td>
                            <td>
                              <span class="slot-cell">
                                <span class="slot-text">${c.enrolled}/${c.maxSlot} (${pct(c.enrolled, c.maxSlot)}%)</span>
                                <span class="slot-bar"><i style="width:${pct(c.enrolled, c.maxSlot)}%"></i></span>
                              </span>
                            </td>
                            <td class="muted">${formatSchedule(c.schedule)}</td>
                            <td>${statusBadge(c.status)}</td>
                            <td class="actions" style="text-align:right;">
                              <button class="btn btn-sm btn-primary" data-t-cls-view="${c.id}" style="width:auto;padding:5px 12px;">
                                Chi tiết lớp
                              </button>
                              <button class="btn btn-sm btn-toggle" data-t-cls-att="${c.id}" ${disabledAttr} title="${closedTitle}" style="${disabledStyle}">
                                🔒 Điểm danh
                              </button>
                              <button class="btn btn-sm btn-toggle" data-t-cls-mat="${c.id}" ${disabledAttr} title="${closedTitle}" style="${disabledStyle}">
                                ${isInactive ? "🔒" : ""} Tài liệu
                              </button>
                              <button class="btn btn-sm btn-toggle" data-t-cls-grade="${c.id}" ${disabledAttr} title="${closedTitle}" style="${disabledStyle}">
                                ${isInactive ? "🔒" : ""} Nhập điểm
                              </button>
                            </td>
                          </tr>`;
                        }
                      )
                      .join("")}
                  </tbody>
                </table>`
              : `<div class="empty" style="padding:28px;text-align:center;color:var(--muted);">
                  Thầy/Cô chưa có lớp học nào được phân công. Hãy bấm "Đăng ký mở lớp mới" để bắt đầu.
                </div>`
          }
        </div>
      </div>

      <!-- 4. DIV BUỔI HỌC & ĐIỂM DANH -->
      <div class="overview-panel" id="overview-sessions">
        <div class="panel-head-overview">
          <div class="panel-title-group">
            <span class="panel-icon-wrap" style="background:#e6f8f0;color:#0d8a5f;">${ICONS.check}</span>
            <div>
              <h2 class="panel-title">Buổi học & Trạng thái Điểm danh</h2>
              <span class="count-chip">${allSessions.length} buổi học</span>
            </div>
          </div>
          <div class="panel-actions">
            <button class="btn-quick-add" id="btn-add-session-panel">
              ${ICONS.plus}
              <span>Thêm buổi học</span>
            </button>
            <button class="btn-view-detail" id="btn-detail-sessions-panel">
              ${ICONS.eye}
              <span>Xem chi tiết các buổi học</span>
            </button>
          </div>
        </div>

        <div class="table-wrap">
          ${
            allSessions.length
              ? `<table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Tên buổi học</th>
                      <th>Lớp học</th>
                      <th>Ngày học</th>
                      <th>Điểm danh</th>
                      <th>Tài liệu</th>
                      <th style="text-align:right;">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${allSessions.slice(0, 8).map(
                      (s, i) => {
                        const mats = listMaterialsBySession(s.id);
                        const sessionCls = myClasses.find((c) => c.id === s.classId);
                        const clsClosed = sessionCls?.status === "closed";
                        const clsPending = sessionCls?.status === "pending";
                        const clsInactive = clsClosed || clsPending;
                        const disabledAttr = clsInactive ? "disabled" : "";
                        const disabledStyle = clsInactive ? "opacity:0.45;cursor:not-allowed;" : "";
                        const inactiveTitle = clsClosed ? "Lớp đã đóng – không thể thao tác" : clsPending ? "Lớp chờ duyệt" : "";
                        return `
                          <tr style="${clsClosed ? 'opacity:0.75;' : ''}">
                            <td>${i + 1}</td>
                            <td><strong>${escapeHtml(s.title || `Buổi học ${i + 1}`)}</strong></td>
                            <td>
                              ${escapeHtml(s.cls?.className || "—")}
                              ${clsClosed ? `<span class="badge closed" style="font-size:10px;margin-left:4px;">Đã đóng</span>` : ""}
                            </td>
                            <td>${formatDate(s.date)} ${s.date === todayStr() ? `<span class="badge active" style="font-size:10px;">Hôm nay</span>` : ""}</td>
                            <td>${attBadge(s.id)}</td>
                            <td><span class="badge" style="background:#f4efff;color:#6a1bff;">${mats.length} file</span></td>
                            <td class="actions" style="text-align:right;">
                              <button class="btn btn-sm btn-primary" data-t-session-mark="${s.id}" data-t-class-id="${s.classId}" ${disabledAttr} title="${inactiveTitle}" style="width:auto;padding:5px 12px;${disabledStyle}">
                                ${clsInactive ? "🔒" : ""} Điểm danh ngay
                              </button>
                              <button class="btn btn-sm btn-toggle" data-t-session-mat="${s.id}" data-t-class-id="${s.classId}" ${disabledAttr} title="${inactiveTitle}" style="${disabledStyle}">
                                ${clsInactive ? "🔒" : ""} Đính kèm tài liệu
                              </button>
                            </td>
                          </tr>`;
                      }
                    ).join("")}
                  </tbody>
                </table>`
              : `<div class="empty" style="padding:28px;text-align:center;color:var(--muted);">
                  Chưa có buổi học nào được tạo.
                </div>`
          }
        </div>
      </div>

      <!-- 5. DIV QUẢN LÝ ĐIỂM & NHẬN XÉT HỌC SINH -->
      <div class="overview-panel" id="overview-grading">
        <div class="panel-head-overview">
          <div class="panel-title-group">
            <span class="panel-icon-wrap" style="background:#fef3c7;color:#b45309;">${ICONS.edit}</span>
            <div>
              <h2 class="panel-title">Quản lý Bảng điểm & Lời nhận xét</h2>
              <span class="muted" style="font-size:12px;">Đánh giá kết quả học tập của từng học sinh</span>
            </div>
          </div>
          <div class="panel-actions">
            <button class="btn-quick-add" id="btn-quick-add-grade">
              ${ICONS.plus}
              <span>Nhập điểm kiểm tra</span>
            </button>
            <button class="btn-view-detail" id="btn-detail-grading">
              ${ICONS.eye}
              <span>Xem chi tiết bảng điểm</span>
            </button>
          </div>
        </div>

        <div style="padding: 20px 24px;">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;flex-wrap:wrap;">
            <label for="grade-class-select" style="font-weight:700;font-size:13.5px;color:var(--brand-ink);">
              Chọn lớp học để xem bảng điểm:
            </label>
            <select class="toolbar-select" id="grade-class-select" style="min-width:240px;">
              ${myClasses.map((c) => `<option value="${c.id}">${escapeHtml(c.className)} (${c.enrolled} HS)</option>`).join("")}
            </select>
          </div>

          <div id="grade-table-view">
            <!-- Bảng điểm động của lớp được chọn -->
          </div>
        </div>
      </div>

      <!-- 6. DIV YÊU CẦU GỬI QUẢN TRỊ VIÊN -->
      <div class="overview-panel" id="overview-requests">
        <div class="panel-head-overview">
          <div class="panel-title-group">
            <span class="panel-icon-wrap" style="background:#fef3c7;color:#d97706;">${ICONS.bell}</span>
            <div>
              <h2 class="panel-title">Yêu cầu & Đề xuất gửi Quản trị viên</h2>
              <span class="count-chip">${pendingRequests.length} yêu cầu chờ phê duyệt</span>
            </div>
          </div>
          <div class="panel-actions">
            <button class="btn-quick-add" id="btn-req-reschedule">
              ${ICONS.refresh}
              <span>Yêu cầu đổi lịch học</span>
            </button>
            <button class="btn-view-detail" id="btn-detail-teacher-requests">
              ${ICONS.eye}
              <span>Xem chi tiết yêu cầu</span>
            </button>
          </div>
        </div>

        <div style="padding: 18px 24px;">
          ${
            myRequests.length
              ? `<div style="display:flex;flex-direction:column;gap:10px;">
                  ${myRequests.slice(0, 4).map(
                    (r) => `
                      <div class="row-item" style="border:1px solid var(--line);border-radius:12px;padding:12px 18px;display:flex;align-items:center;justify-content:space-between;">
                        <div>
                          <strong>${r.type === 'register' ? 'Đăng ký lớp mới' : 'Yêu cầu đổi lịch học'} · ${escapeHtml(r.cls?.className || '')}</strong>
                          <div class="muted" style="font-size:12px;margin-top:2px;">
                            Ngày gửi: ${formatDate(String(r.createdAt).slice(0, 10))}
                            ${r.decidedAt ? ` · Xử lý lúc ${formatDate(String(r.decidedAt).slice(0, 10))}` : ''}
                          </div>
                        </div>
                        <span class="badge ${r.status === 'approved' ? 'active' : r.status === 'pending' ? 'late' : 'closed'}">
                          ${r.status === 'approved' ? 'Đã phê duyệt' : r.status === 'pending' ? 'Đang chờ duyệt' : 'Đã từ chối'}
                        </span>
                      </div>`
                  ).join("")}
                </div>`
              : `<div class="empty" style="padding:24px;text-align:center;color:var(--muted);">
                  Thầy/Cô chưa gửi yêu cầu nào tới Quản trị viên.
                </div>`
          }
        </div>
      </div>

    </div>
  `;

  // Jump bar scroll
  setupTeacherJumpBar(el);

  // Setup bảng điểm theo lớp được chọn
  setupGradeSection(el, myClasses, teacher);

  // Setup các sự kiện nút Xem chi tiết cho từng bảng thông tin
  setupTeacherDetailButtons(el, { teacher, myClasses, weekClasses, allSessions, myRequests, overview });

  // Setup các sự kiện thao tác nhanh (Thêm buổi học, Đăng ký mở lớp, Điểm danh, v.v.)
  setupTeacherActions(el, teacher, myClasses, allSessions);
}

function setupTeacherJumpBar(el) {
  const links = el.querySelectorAll(".jump-pill");
  links.forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const targetId = link.getAttribute("href").replace("#", "");
      const targetEl = el.querySelector(`#${targetId}`);
      if (targetEl) {
        links.forEach((l) => l.classList.remove("active"));
        link.classList.add("active");
        targetEl.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  });
}

// Render bảng điểm cho lớp được chọn
function setupGradeSection(el, myClasses, teacher) {
  const select = el.querySelector("#grade-class-select");
  const view = el.querySelector("#grade-table-view");
  if (!select || !view) return;

  function renderSelectedClassGrades() {
    const classId = select.value;
    const cls = myClasses.find((c) => c.id === classId);
    if (!cls) {
      view.innerHTML = `<div class="empty">Chưa có dữ liệu lớp.</div>`;
      return;
    }

    const students = listStudentsOfClass(cls.id);
    const grades = listGradesByClass(cls.id);
    const comments = listCommentsByClass(cls.id);

    if (!students.length) {
      view.innerHTML = `<div class="empty" style="padding:20px;text-align:center;color:var(--muted);">Lớp này hiện chưa có học sinh nào đăng ký.</div>`;
      return;
    }

    view.innerHTML = `
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Mã HS</th>
              <th>Họ và tên</th>
              <th>Điểm 15 phút</th>
              <th>Điểm 1 tiết</th>
              <th>Điểm học kỳ</th>
              <th>Điểm trung bình</th>
              <th>Nhận xét của giáo viên</th>
              <th style="text-align:right;">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            ${students
              .map((st, idx) => {
                const stGrades = grades.filter((g) => g.studentId === st.id);
                const g15 = stGrades.filter((g) => g.type === "15m").map((g) => g.score);
                const g45 = stGrades.filter((g) => g.type === "45m").map((g) => g.score);
                const gSem = stGrades.filter((g) => g.type === "semester").map((g) => g.score);

                let totalScore = 0;
                let totalCoeff = 0;
                g15.forEach((s) => { totalScore += s * 1; totalCoeff += 1; });
                g45.forEach((s) => { totalScore += s * 2; totalCoeff += 2; });
                gSem.forEach((s) => { totalScore += s * 3; totalCoeff += 3; });
                const avg = totalCoeff > 0 ? (totalScore / totalCoeff).toFixed(1) : "—";

                const stComments = comments.filter((c) => c.studentId === st.id);
                const latestComment = stComments.length ? stComments[stComments.length - 1].content : "Chưa có nhận xét";

                const clsLocked = cls.status === "closed" || cls.status === "pending";
                const lockAttr = clsLocked ? "disabled" : "";
                const lockStyle = clsLocked ? "opacity:0.45;cursor:not-allowed;" : "";
                const lockTitle = cls.status === "closed" ? "Lớp đã đóng – không thể thao tác" : cls.status === "pending" ? "Lớp chờ duyệt" : "";

                return `
                  <tr>
                    <td>${idx + 1}</td>
                    <td><span class="badge student">${st.id}</span></td>
                    <td><strong>${escapeHtml(st.fullName)}</strong></td>
                    <td>${g15.length ? g15.join(", ") : "—"}</td>
                    <td>${g45.length ? g45.join(", ") : "—"}</td>
                    <td>${gSem.length ? gSem.join(", ") : "—"}</td>
                    <td><strong style="color:var(--brand-dark);">${avg}</strong></td>
                    <td style="max-width:220px;font-size:12.5px;color:#4b4668;">${escapeHtml(latestComment)}</td>
                    <td class="actions" style="text-align:right;">
                      <button class="btn btn-sm btn-primary" data-grade-student="${st.id}" data-class-id="${cls.id}" ${lockAttr} title="${lockTitle}" style="width:auto;padding:4px 10px;${lockStyle}">
                        ${clsLocked ? "🔒" : "+"} Điểm
                      </button>
                      <button class="btn btn-sm btn-toggle" data-comment-student="${st.id}" data-class-id="${cls.id}" ${lockAttr} title="${lockTitle}" style="${lockStyle}">
                        ${clsLocked ? "🔒" : ""} Nhận xét
                      </button>
                    </td>
                  </tr>`;
              })
              .join("")}
          </tbody>
        </table>
      </div>`;

    // Nút thêm điểm từng học sinh
    view.querySelectorAll("[data-grade-student]").forEach((btn) =>
      btn.addEventListener("click", () => {
        if (btn.disabled) return;
        if (cls.status === "closed") return flash(el, `Lớp "${cls.className}" đã đóng – không thể nhập điểm mới.`, "error");
        if (cls.status === "pending") return flash(el, `Lớp "${cls.className}" chưa được Admin duyệt.`, "error");
        const studentId = btn.dataset.gradeStudent;
        const student = students.find((s) => s.id === studentId);
        openAddGradeModal(student, cls, () => {
          renderSelectedClassGrades();
          flash(el, `Đã cập nhật điểm cho học sinh ${student.fullName}.`);
        });
      })
    );

    // Nút ghi nhận xét từng học sinh
    view.querySelectorAll("[data-comment-student]").forEach((btn) =>
      btn.addEventListener("click", () => {
        if (btn.disabled) return;
        if (cls.status === "closed") return flash(el, `Lớp "${cls.className}" đã đóng – không thể ghi nhận xét mới.`, "error");
        if (cls.status === "pending") return flash(el, `Lớp "${cls.className}" chưa được Admin duyệt.`, "error");
        const studentId = btn.dataset.commentStudent;
        const student = students.find((s) => s.id === studentId);
        openAddCommentModal(student, cls, () => {
          renderSelectedClassGrades();
          flash(el, `Đã lưu nhận xét cho học sinh ${student.fullName}.`);
        });
      })
    );
  }

  select.addEventListener("change", renderSelectedClassGrades);
  renderSelectedClassGrades();
}

function setupTeacherDetailButtons(el, { teacher, myClasses, weekClasses, allSessions, myRequests, overview }) {
  // 1. Chi tiết chỉ số KPI
  el.querySelector("#btn-detail-teacher-kpi")?.addEventListener("click", () => {
    openModal({
      title: "Báo cáo Hoạt động Giảng dạy của Thầy/Cô",
      size: "modal-lg",
      body: `
        <div style="display:flex;flex-direction:column;gap:14px;">
          ${infoRow("Giáo viên", escapeHtml(teacher.fullName))}
          ${infoRow("Bộ môn giảng dạy", subjectLabel(teacher.subject))}
          ${infoRow("Tổng số lớp học phụ trách", `${myClasses.length} lớp học`)}
          ${infoRow("Tổng số học sinh quản lý", `${overview.totalStudents} học sinh`)}
          ${infoRow("Tổng số buổi học đã tổ chức", `${allSessions.length} buổi học`)}
          ${infoRow("Tổng số yêu cầu gửi tới Admin", `${myRequests.length} yêu cầu (${myRequests.filter((r) => r.status === "pending").length} đang chờ duyệt)`)}
        </div>`,
      foot: `<button class="btn btn-primary" data-close>Đã hiểu</button>`,
    });
  });

  // 2. Chi tiết Lịch giảng dạy
  el.querySelector("#btn-detail-schedule")?.addEventListener("click", () => {
    openModal({
      title: "Thời khóa biểu Giảng dạy Chi tiết trong tuần",
      size: "modal-xl",
      body: `
        <div class="table-wrap">
          <table>
            <thead>
              <tr><th>Thứ</th><th>Ca học</th><th>Lớp học</th><th>Bộ môn</th><th>Sĩ số</th><th>Phòng học</th></tr>
            </thead>
            <tbody>
              ${[2, 3, 4, 5, 6, 7, 8].flatMap((day) => {
                const label = WEEKDAYS.find((w) => w.value === day)?.label || `T${day}`;
                const slots = [];
                weekClasses.forEach((c) => {
                  (c.schedule || []).forEach((s) => {
                    if (s.dayOfWeek === day) {
                      slots.push({
                        dayLabel: label,
                        time: `${s.start}–${s.end}`,
                        className: c.className,
                        subject: c.subject,
                        enrolled: c.enrolled,
                        maxSlot: c.maxSlot,
                        room: c.room || "Phòng BTM",
                      });
                    }
                  });
                });
                return slots;
              }).map((s) => `
                <tr>
                  <td><strong>${s.dayLabel}</strong></td>
                  <td>${s.time}</td>
                  <td><strong>${escapeHtml(s.className)}</strong></td>
                  <td><span class="badge subject">${subjectLabel(s.subject)}</span></td>
                  <td>${s.enrolled}/${s.maxSlot} HS</td>
                  <td>${escapeHtml(s.room)}</td>
                </tr>
              `).join("") || `<tr><td colspan="6" class="muted" style="text-align:center;">Chưa có ca học nào trong tuần.</td></tr>`}
            </tbody>
          </table>
        </div>`,
      foot: `<button class="btn btn-primary" data-close>Đóng</button>`,
    });
  });

  // 3. Chi tiết Bảng lớp học
  el.querySelector("#btn-detail-classes-panel")?.addEventListener("click", () => {
    openModal({
      title: "Bảng Chi tiết Toàn bộ Lớp học Thầy/Cô Phụ trách",
      size: "modal-xl",
      body: `
        <div class="table-wrap">
          <table>
            <thead>
              <tr><th>#</th><th>Tên lớp</th><th>Môn học</th><th>Sĩ số</th><th>Lịch học cố định</th><th>Trạng thái</th></tr>
            </thead>
            <tbody>
              ${myClasses.map((c, i) => `
                <tr>
                  <td>${i + 1}</td>
                  <td><strong>${escapeHtml(c.className)}</strong></td>
                  <td><span class="badge subject">${subjectLabel(c.subject)}</span></td>
                  <td>${c.enrolled}/${c.maxSlot} (${pct(c.enrolled, c.maxSlot)}%)</td>
                  <td class="muted">${formatSchedule(c.schedule)}</td>
                  <td>${statusBadge(c.status)}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>`,
      foot: `<button class="btn btn-primary" data-close>Đóng</button>`,
    });
  });

  // 4. Chi tiết Buổi học
  el.querySelector("#btn-detail-sessions-panel")?.addEventListener("click", () => {
    openModal({
      title: "Danh sách Toàn bộ Buổi học Đã tạo",
      size: "modal-lg",
      body: `
        <div class="table-wrap">
          <table>
            <thead>
              <tr><th>#</th><th>Tên buổi học</th><th>Lớp</th><th>Ngày học</th><th>Trạng thái điểm danh</th></tr>
            </thead>
            <tbody>
              ${allSessions.map((s, i) => `
                <tr>
                  <td>${i + 1}</td>
                  <td><strong>${escapeHtml(s.title || `Buổi học ${i + 1}`)}</strong></td>
                  <td>${escapeHtml(s.cls?.className || '—')}</td>
                  <td>${formatDate(s.date)}</td>
                  <td>${attBadge(s.id)}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>`,
      foot: `<button class="btn btn-primary" data-close>Đóng</button>`,
    });
  });

  // 5. Chi tiết Bảng điểm
  el.querySelector("#btn-detail-grading")?.addEventListener("click", () => {
    openModal({
      title: "Quy chế & Bảng điểm Tổng thể các Lớp",
      size: "modal-lg",
      body: `
        <div style="display:flex;flex-direction:column;gap:14px;">
          <p class="muted">Hệ thống tính điểm trung bình: Kiểm tra 15 phút (Hệ số 1), Kiểm tra 1 tiết (Hệ số 2), Thi học kỳ (Hệ số 3).</p>
          <div class="table-wrap">
            <table>
              <thead>
                <tr><th>Lớp</th><th>Môn</th><th>Sĩ số</th><th>Số bài kiểm tra đã chấm</th></tr>
              </thead>
              <tbody>
                ${myClasses.map((c) => {
                  const gCount = listGradesByClass(c.id).length;
                  return `
                    <tr>
                      <td><strong>${escapeHtml(c.className)}</strong></td>
                      <td><span class="badge subject">${subjectLabel(c.subject)}</span></td>
                      <td>${c.enrolled} HS</td>
                      <td><strong>${gCount}</strong> đầu điểm đã nhập</td>
                    </tr>`;
                }).join("")}
              </tbody>
            </table>
          </div>
        </div>`,
      foot: `<button class="btn btn-primary" data-close>Đóng</button>`,
    });
  });

  // 6. Chi tiết Yêu cầu gửi Admin
  el.querySelector("#btn-detail-teacher-requests")?.addEventListener("click", () => {
    openModal({
      title: "Lịch sử Yêu cầu & Đề xuất gửi Quản trị viên",
      size: "modal-lg",
      body: `
        <div style="display:flex;flex-direction:column;gap:10px;">
          ${myRequests.map((r) => `
            <div style="padding:12px;border:1px solid var(--line);border-radius:10px;background:#faf9fe;">
              <div style="display:flex;justify-content:space-between;align-items:center;">
                <strong>${r.type === 'register' ? 'Đăng ký lớp mới' : 'Yêu cầu đổi lịch học'} · ${escapeHtml(r.cls?.className || '')}</strong>
                <span class="badge ${r.status === 'approved' ? 'active' : r.status === 'pending' ? 'late' : 'closed'}">
                  ${r.status === 'approved' ? 'Đã duyệt' : r.status === 'pending' ? 'Chờ duyệt' : 'Đã từ chối'}
                </span>
              </div>
              <div class="muted" style="font-size:12px;margin-top:4px;">
                Ngày tạo: ${formatDate(String(r.createdAt).slice(0, 10))}
              </div>
            </div>
          `).join("") || `<div class="empty">Chưa có yêu cầu nào.</div>`}
        </div>`,
      foot: `<button class="btn btn-primary" data-close>Đóng</button>`,
    });
  });
}

function setupTeacherActions(el, teacher, myClasses, allSessions) {
  // Chỉ cho phép tạo buổi học cho các lớp đang mở
  const openClasses = myClasses.filter((c) => c.status === "open");

  // Thêm buổi học nhanh
  const openNewSession = () => {
    if (!openClasses.length) return flash(el, "Không có lớp học nào đang mở để thêm buổi học. Lớp đã đóng không thể thêm buổi mới.", "error");
    openCreateSessionModal(openClasses, () => {
      renderTeacherOverviewPage(el, teacher);
      flash(el, "Đã tạo buổi học mới thành công!");
    });
  };
  el.querySelector("#btn-quick-new-session")?.addEventListener("click", openNewSession);
  el.querySelector("#btn-add-session-panel")?.addEventListener("click", openNewSession);

  // Đăng ký mở lớp mới
  el.querySelector("#btn-create-class-panel")?.addEventListener("click", () => {
    openCreateClassModal(teacher, () => {
      renderTeacherOverviewPage(el, teacher);
      flash(el, "Đã gửi yêu cầu đăng ký mở lớp mới tới Quản trị viên.");
    });
  });

  // Gửi yêu cầu đổi lịch học
  el.querySelector("#btn-req-reschedule")?.addEventListener("click", () => {
    const eligibleClasses = myClasses.filter((c) => c.status !== "closed");
    if (!eligibleClasses.length) return flash(el, "Không có lớp học nào đang hoạt động để gửi yêu cầu đổi lịch.", "error");
    openRescheduleRequestModal(teacher, eligibleClasses, () => {
      renderTeacherOverviewPage(el, teacher);
      flash(el, "Đã gửi yêu cầu đổi lịch học tới Quản trị viên để xét duyệt.");
    });
  });

  // Nhập điểm kiểm tra từ thanh panel
  el.querySelector("#btn-quick-add-grade")?.addEventListener("click", () => {
    const sel = el.querySelector("#grade-class-select");
    const classId = sel?.value || myClasses[0]?.id;
    const cls = myClasses.find((c) => c.id === classId);
    if (!cls) return flash(el, "Vui lòng chọn lớp học trước.", "error");
    if (cls.status === "closed") return flash(el, `Lớp "${cls.className}" đã đóng – không thể nhập điểm mới.`, "error");
    if (cls.status === "pending") return flash(el, `Lớp "${cls.className}" chưa được Admin duyệt.`, "error");

    const students = listStudentsOfClass(cls.id);
    if (!students.length) return flash(el, "Lớp này chưa có học sinh để nhập điểm.", "error");

    openAddGradeModal(students[0], cls, () => {
      renderTeacherOverviewPage(el, teacher);
      flash(el, "Đã lưu điểm cho học sinh.");
    });
  });

  // Xem chi tiết từng lớp
  el.querySelectorAll("[data-t-cls-view]").forEach((btn) =>
    btn.addEventListener("click", () => {
      const cls = myClasses.find((c) => c.id === btn.dataset.tClsView);
      if (cls) openTeacherClassDetailModal(cls, teacher);
    })
  );

  // Điểm danh từ bảng lớp
  el.querySelectorAll("[data-t-cls-att]").forEach((btn) =>
    btn.addEventListener("click", () => {
      if (btn.disabled) return;
      const classId = btn.dataset.tClsAtt;
      const cls = myClasses.find((c) => c.id === classId);
      if (cls?.status === "closed") return flash(el, `Lớp "${cls.className}" đã đóng – không thể điểm danh.`, "error");
      if (cls?.status === "pending") return flash(el, `Lớp "${cls.className}" chưa được Admin duyệt – chưa thể điểm danh.`, "error");
      const clsSessions = listSessionsByClass(classId).sort((a, b) => b.date.localeCompare(a.date));
      if (!clsSessions.length) return flash(el, "Lớp này chưa có buổi học nào để điểm danh. Hãy bấm 'Thêm buổi học'.", "error");
      openAttendanceModal(clsSessions[0].id, classId, () => {
        renderTeacherOverviewPage(el, teacher);
        flash(el, "Đã lưu kết quả điểm danh.");
      });
    })
  );

  // Tài liệu từ bảng lớp
  el.querySelectorAll("[data-t-cls-mat]").forEach((btn) =>
    btn.addEventListener("click", () => {
      if (btn.disabled) return;
      const classId = btn.dataset.tClsMat;
      const cls = myClasses.find((c) => c.id === classId);
      if (cls?.status === "closed") return flash(el, `Lớp "${cls.className}" đã đóng – không thể chỉnh sửa tài liệu.`, "error");
      if (cls?.status === "pending") return flash(el, `Lớp "${cls.className}" chưa được Admin duyệt.`, "error");
      const clsSessions = listSessionsByClass(classId);
      if (!clsSessions.length) return flash(el, "Lớp này chưa có buổi học nào để đính kèm tài liệu.", "error");
      openMaterialsModal(clsSessions[0].id, classId, () => {
        renderTeacherOverviewPage(el, teacher);
        flash(el, "Đã cập nhật tài liệu buổi học.");
      });
    })
  );

  // Nhập điểm từ bảng lớp
  el.querySelectorAll("[data-t-cls-grade]").forEach((btn) =>
    btn.addEventListener("click", () => {
      if (btn.disabled) return;
      const classId = btn.dataset.tClsGrade;
      const cls = myClasses.find((c) => c.id === classId);
      if (cls?.status === "closed") return flash(el, `Lớp "${cls.className}" đã đóng – không thể nhập điểm mới.`, "error");
      if (cls?.status === "pending") return flash(el, `Lớp "${cls.className}" chưa được Admin duyệt.`, "error");
      const students = listStudentsOfClass(classId);
      if (!students.length) return flash(el, "Lớp này chưa có học sinh nào.", "error");
      openAddGradeModal(students[0], cls, () => {
        renderTeacherOverviewPage(el, teacher);
        flash(el, "Đã nhập điểm cho học sinh.");
      });
    })
  );

  // Điểm danh ngay từ bảng buổi học
  el.querySelectorAll("[data-t-session-mark]").forEach((btn) =>
    btn.addEventListener("click", () => {
      if (btn.disabled) return;
      const classId = btn.dataset.tClassId;
      const cls = myClasses.find((c) => c.id === classId);
      if (cls?.status === "closed") return flash(el, `Lớp "${cls.className}" đã đóng – không thể điểm danh.`, "error");
      if (cls?.status === "pending") return flash(el, `Lớp "${cls.className}" chưa được Admin duyệt.`, "error");
      openAttendanceModal(btn.dataset.tSessionMark, classId, () => {
        renderTeacherOverviewPage(el, teacher);
        flash(el, "Đã lưu điểm danh buổi học thành công.");
      });
    })
  );

  // Đính kèm tài liệu từ bảng buổi học
  el.querySelectorAll("[data-t-session-mat]").forEach((btn) =>
    btn.addEventListener("click", () => {
      if (btn.disabled) return;
      const classId = btn.dataset.tClassId;
      const cls = myClasses.find((c) => c.id === classId);
      if (cls?.status === "closed") return flash(el, `Lớp "${cls.className}" đã đóng – không thể chỉnh sửa tài liệu.`, "error");
      if (cls?.status === "pending") return flash(el, `Lớp "${cls.className}" chưa được Admin duyệt.`, "error");
      openMaterialsModal(btn.dataset.tSessionMat, classId, () => {
        renderTeacherOverviewPage(el, teacher);
        flash(el, "Đã đính kèm tài liệu bài học thành công.");
      });
    })
  );
}

// =============================================================================
// MODAL CÁC CHỨC NĂNG NGHIỆP VỤ CỦA GIÁO VIÊN
// =============================================================================

function openTeacherClassDetailModal(cls, teacher) {
  const students = listStudentsOfClass(cls.id);
  const sessions = listSessionsByClass(cls.id).sort((a, b) => a.date.localeCompare(b.date));

  openModal({
    title: `Chi tiết Lớp học · ${escapeHtml(cls.className)}`,
    size: "modal-lg",
    body: `
      <div style="display:flex;flex-direction:column;gap:14px;">
        <div class="roster-summary">
          <div class="roster-chip">
            <span class="roster-chip-k">Môn học</span>
            <span class="roster-chip-v"><span class="badge subject">${subjectLabel(cls.subject)}</span></span>
          </div>
          <div class="roster-chip">
            <span class="roster-chip-k">Sĩ số</span>
            <span class="roster-chip-v">${cls.enrolled}/${cls.maxSlot} HS</span>
          </div>
          <div class="roster-chip">
            <span class="roster-chip-k">Trạng thái</span>
            <span class="roster-chip-v">${statusBadge(cls.status)}</span>
          </div>
        </div>

        <h4 style="margin:10px 0 4px;font-size:14.5px;color:var(--brand-ink);">
          Danh sách Học sinh trong lớp (${students.length} học sinh)
        </h4>

        ${
          students.length
            ? `<div class="table-wrap" style="max-height:220px;overflow-y:auto;">
                <table>
                  <thead>
                    <tr><th>#</th><th>Mã HS</th><th>Họ và tên</th><th>Tài khoản</th><th>Gmail</th><th>Giới tính</th></tr>
                  </thead>
                  <tbody>
                    ${students.map((st, i) => `
                      <tr>
                        <td>${i + 1}</td>
                        <td><span class="badge student">${st.id}</span></td>
                        <td><strong>${escapeHtml(st.fullName)}</strong></td>
                        <td>@${escapeHtml(st.username)}</td>
                        <td>${escapeHtml(st.email || '—')}</td>
                        <td>${escapeHtml(st.gender || '—')}</td>
                      </tr>
                    `).join("")}
                  </tbody>
                </table>
              </div>`
            : `<div class="empty">Chưa có học sinh nào đăng ký lớp này.</div>`
        }

        <h4 style="margin:10px 0 4px;font-size:14.5px;color:var(--brand-ink);">
          Danh sách Buổi học (${sessions.length} buổi)
        </h4>

        ${
          sessions.length
            ? `<div class="table-wrap" style="max-height:180px;overflow-y:auto;">
                <table>
                  <thead>
                    <tr><th>#</th><th>Tên buổi</th><th>Ngày học</th><th>Điểm danh</th></tr>
                  </thead>
                  <tbody>
                    ${sessions.map((s, i) => `
                      <tr>
                        <td>${i + 1}</td>
                        <td><strong>${escapeHtml(s.title || `Buổi học ${i + 1}`)}</strong></td>
                        <td>${formatDate(s.date)}</td>
                        <td>${attBadge(s.id)}</td>
                      </tr>
                    `).join("")}
                  </tbody>
                </table>
              </div>`
            : `<div class="empty">Chưa có buổi học nào.</div>`
        }
      </div>`,
    foot: `<button class="btn btn-primary" data-close>Đóng</button>`,
  });
}

// ============================================================
// HELPER: Tính trạng thái thời gian điểm danh của buổi học
// Trả về object: { minutesElapsed, sessionEnded, sessionStarted, startTime, endTime }
// ============================================================
function getAttendanceTimeStatus(session) {
  const cls = getClassById(session.classId);
  if (!cls || !cls.schedule || !cls.schedule.length) {
    return { minutesElapsed: null, sessionEnded: false, sessionStarted: false, startTime: null, endTime: null };
  }

  // Tính dayOfWeek từ session.date (JS: 0=CN, 1=T2...6=T7 → hệ thống: 2=T2...8=CN)
  const sessionDate = new Date(session.date + "T00:00:00");
  const jsDow = sessionDate.getDay(); // 0=CN, 1=T2...6=T7
  const sysDow = jsDow === 0 ? 8 : jsDow + 1; // chuyển sang hệ thống 2–8

  // Tìm lịch học khớp với ngày của buổi học
  const slot = cls.schedule.find((s) => s.dayOfWeek === sysDow) || cls.schedule[0];

  // Ghép date + time để tạo timestamp đầy đủ
  const [startH, startM] = slot.start.split(":").map(Number);
  const [endH, endM] = slot.end.split(":").map(Number);

  const sessionStart = new Date(session.date + "T00:00:00");
  sessionStart.setHours(startH, startM, 0, 0);

  const sessionEnd = new Date(session.date + "T00:00:00");
  sessionEnd.setHours(endH, endM, 0, 0);

  const now = new Date();
  const minutesElapsed = (now - sessionStart) / 60000; // số phút kể từ khi bắt đầu

  return {
    minutesElapsed,
    sessionStarted: minutesElapsed >= 0,
    sessionEnded: now > sessionEnd,
    startTime: slot.start,
    endTime: slot.end,
  };
}

// ============================================================
// HELPER: Lấy danh sách option select cho từng học sinh
// theo logic thời gian điểm danh
// curStatus: trạng thái điểm danh hiện tại (đã lưu)
// minutesElapsed: số phút kể từ khi buổi bắt đầu (null = không có lịch)
// sessionEnded: buổi học đã kết thúc
// ============================================================
function buildAttendanceOptions(curStatus, minutesElapsed, sessionEnded, hasRecord) {
  // Nếu buổi học đã kết thúc → khóa toàn bộ
  if (sessionEnded) {
    return {
      html: `
        <select class="toolbar-select" disabled style="padding:4px 8px;font-size:13px;opacity:0.6;cursor:not-allowed;">
          <option value="${curStatus}" selected>
            ${curStatus === "present" ? "Có mặt" : curStatus === "late" ? "Đi trễ" : "Vắng mặt"}
          </option>
        </select>
        <span class="muted" style="font-size:11px;margin-left:4px;">(Buổi đã kết thúc)</span>`,
      locked: true,
    };
  }

  // Nếu không có thông tin lịch học hoặc buổi chưa bắt đầu
  if (minutesElapsed === null || minutesElapsed < 0) {
    return {
      html: `
        <select class="toolbar-select" disabled style="padding:4px 8px;font-size:13px;opacity:0.6;cursor:not-allowed;">
          <option value="absent" selected>Vắng mặt (mặc định)</option>
        </select>
        <span class="muted" style="font-size:11px;margin-left:4px;">(Chưa đến giờ học)</span>`,
      locked: true,
    };
  }

  // Trong buổi học: xây dựng option theo rule
  const phase = minutesElapsed <= 15 ? "early" : minutesElapsed <= 30 ? "mid" : "late";

  // Xác định các giá trị được phép chọn
  let allowedValues = [];

  if (phase === "early") {
    // 0–15 phút: vắng mặt → có mặt được; present ↔ absent, late ↔ absent
    // Thực ra: tất cả 3 trạng thái đều cho phép (chưa có record = absent mặc định)
    allowedValues = ["present", "late", "absent"];
  } else if (phase === "mid") {
    // 15–30 phút: không được sửa absent → present; chỉ absent → late, hoặc present/late → absent
    if (curStatus === "absent") {
      allowedValues = ["late", "absent"]; // không được chọn present nữa
    } else {
      allowedValues = ["present", "late", "absent"];
    }
  } else {
    // Sau 30 phút: không thể sửa absent → present hoặc absent → late
    // Chỉ được: present → absent hoặc late → absent
    if (curStatus === "absent") {
      allowedValues = ["absent"]; // đã vắng mặt → không đổi được
    } else if (curStatus === "present") {
      allowedValues = ["present", "absent"];
    } else if (curStatus === "late") {
      allowedValues = ["late", "absent"];
    } else {
      allowedValues = ["absent"];
    }
  }

  const opts = [
    { value: "present", label: "Có mặt" },
    { value: "late", label: "Đi trễ" },
    { value: "absent", label: "Vắng mặt" },
  ]
    .filter((o) => allowedValues.includes(o.value))
    .map((o) => `<option value="${o.value}" ${o.value === curStatus ? "selected" : ""}>${o.label}</option>`)
    .join("");

  return {
    html: `<select class="toolbar-select" data-status-for="__STUDENT_ID__" style="padding:4px 8px;font-size:13px;">${opts}</select>`,
    locked: false,
  };
}

function openAttendanceModal(sessionId, classId, onDone) {
  const session = DB.findById("sessions", sessionId);
  const cls = getClassById(classId);
  const classLocked = !cls || cls.status !== "open";
  const students = listStudentsOfClass(classId);
  const existing = listAttendanceBySession(sessionId);
  const attMap = new Map(existing.map((a) => [a.studentId, a]));

  // Lấy thông tin thời gian buổi học
  const timeStatus = session ? getAttendanceTimeStatus(session) : {
    minutesElapsed: null, sessionEnded: false, sessionStarted: false, startTime: null, endTime: null
  };

  const { minutesElapsed, sessionEnded, sessionStarted, startTime, endTime } = timeStatus;

  // Mô tả trạng thái thời gian hiện tại
  let timeInfoHtml = "";
  if (sessionEnded) {
    timeInfoHtml = `<div style="background:#fff1f0;border:1px solid #ffa39e;border-radius:8px;padding:10px 14px;font-size:13px;color:#cf1322;">
      🚫 <strong>Buổi học đã kết thúc lúc ${endTime}.</strong> Không thể chỉnh sửa điểm danh.
    </div>`;
  } else if (minutesElapsed !== null && minutesElapsed >= 0) {
    const elapsedMin = Math.floor(minutesElapsed);
    if (elapsedMin <= 15) {
      timeInfoHtml = `<div style="background:#f6ffed;border:1px solid #b7eb8f;border-radius:8px;padding:10px 14px;font-size:13px;color:#389e0d;">
        ✅ <strong>Trong 15 phút đầu</strong> (đã qua ${elapsedMin} phút) — Có thể đánh dấu <strong>Có mặt</strong>, <strong>Đi trễ</strong> hoặc <strong>Vắng mặt</strong>.
      </div>`;
    } else if (elapsedMin <= 30) {
      timeInfoHtml = `<div style="background:#fffbe6;border:1px solid #ffe58f;border-radius:8px;padding:10px 14px;font-size:13px;color:#d46b08;">
        ⚠️ <strong>Phút thứ ${elapsedMin}</strong> (15–30 phút) — Chỉ có thể sửa <strong>Vắng mặt</strong> sang <strong>Đi trễ</strong>. Không thể đánh dấu Có mặt cho học sinh đang vắng.
      </div>`;
    } else {
      timeInfoHtml = `<div style="background:#fff2e8;border:1px solid #ffbb96;border-radius:8px;padding:10px 14px;font-size:13px;color:#c04000;">
        🔒 <strong>Sau 30 phút</strong> (đã qua ${elapsedMin} phút) — Chỉ có thể sửa <strong>Có mặt/Đi trễ</strong> sang <strong>Vắng mặt</strong>. Không thể đánh mới Có mặt hoặc Đi trễ.
      </div>`;
    }
  } else if (minutesElapsed !== null && minutesElapsed < 0) {
    const waitMin = Math.ceil(-minutesElapsed);
    timeInfoHtml = `<div style="background:#e6f7ff;border:1px solid #91d5ff;border-radius:8px;padding:10px 14px;font-size:13px;color:#096dd9;">
      ℹ️ <strong>Buổi học chưa bắt đầu</strong> (còn ${waitMin} phút nữa mới đến ${startTime}). Điểm danh sẽ khả dụng khi buổi bắt đầu.
    </div>`;
  } else {
    timeInfoHtml = `<div style="background:#f9f0ff;border:1px solid #d3adf7;border-radius:8px;padding:10px 14px;font-size:13px;color:#531dab;">
      ℹ️ Lớp không có thông tin lịch học. Điểm danh hoạt động ở chế độ tự do.
    </div>`;
  }

  // Banner khóa thao tác nếu lớp đã đóng/chưa duyệt
  if (classLocked) {
    timeInfoHtml = `<div style="background:#fff1f0;border:1px solid #ffa39e;border-radius:8px;padding:10px 14px;font-size:13px;color:#cf1322;">
      🚫 <strong>Lớp "${escapeHtml(cls?.className || "")}" ${cls?.status === "closed" ? "đã đóng" : "chưa được Admin duyệt"}.</strong> Không thể chỉnh sửa điểm danh.
    </div>`;
  }

  // Xây dựng hàng học sinh
  const studentRows = students.map((st, i) => {
    const rec = attMap.get(st.id);
    // Default là vắng mặt nếu chưa có bản ghi
    const curStatus = rec ? rec.status : "absent";
    const note = rec?.note || "";
    const hasRecord = !!rec;

    // minutesElapsed === null và chưa có session → cho phép sửa tự do (không có lịch)
    const effectiveElapsed = minutesElapsed === null ? 0 : minutesElapsed;
    const { html: selectHtml, locked } = buildAttendanceOptions(curStatus, effectiveElapsed, sessionEnded, hasRecord);

    const finalSelectHtml = selectHtml.replace("__STUDENT_ID__", st.id);

    return `
      <tr data-st-att="${st.id}" data-locked="${locked || classLocked}">
        <td>${i + 1}</td>
        <td><span class="badge student">${st.id}</span></td>
        <td><strong>${escapeHtml(st.fullName)}</strong></td>
        <td>
          ${finalSelectHtml}
        </td>
        <td>
          <input type="text" data-note-for="${st.id}" value="${escapeHtml(note)}"
            placeholder="Lý do nếu vắng..."
            ${locked ? "disabled" : ""}
            style="padding:6px 10px;font-size:12.5px;border:1px solid var(--line);border-radius:6px;width:100%;${locked ? 'opacity:0.6;cursor:not-allowed;' : ''}" />
        </td>
      </tr>`;
  }).join("");

  openModal({
    title: "Điểm danh Buổi học",
    size: "modal-lg",
    body: `
      <div style="display:flex;flex-direction:column;gap:12px;">
        ${timeInfoHtml}
        <p class="muted" style="font-size:12.5px;margin:0;">📋 <strong>Mặc định:</strong> Tất cả học sinh được đánh là <strong>Vắng mặt</strong>. Giáo viên cần cập nhật trạng thái cho từng học sinh theo đúng thời điểm.</p>
        <div class="table-wrap" style="max-height:380px;overflow-y:auto;">
          <table>
            <thead>
              <tr><th>#</th><th>Mã HS</th><th>Họ tên</th><th>Trạng thái</th><th>Ghi chú lý do</th></tr>
            </thead>
            <tbody>
              ${studentRows}
            </tbody>
          </table>
        </div>
      </div>`,
    foot: `
      <button class="btn" data-close>Hủy</button>
      ${sessionEnded || classLocked
        ? `<button class="btn" disabled style="opacity:0.5;cursor:not-allowed;">Không thể lưu ${classLocked ? "(Lớp đã đóng/chưa duyệt)" : "(Buổi đã kết thúc)"}</button>`
        : `<button class="btn btn-primary" id="btn-save-attendance">Lưu kết quả điểm danh</button>`
      }`,
    onMount: (root, close) => {
      if (sessionEnded || classLocked) return; // Không gán sự kiện nếu không thể thao tác

      root.querySelector("#btn-save-attendance")?.addEventListener("click", () => {
        const rows = root.querySelectorAll("tr[data-st-att]");
        rows.forEach((row) => {
          if (row.dataset.locked === "true") return; // Bỏ qua hàng bị khóa
          const studentId = row.dataset.stAtt;
          const selectEl = row.querySelector(`select[data-status-for="${studentId}"]`);
          if (!selectEl) return; // select bị disabled không có data-status-for
          const status = selectEl.value;
          const note = row.querySelector(`input[data-note-for="${studentId}"]`)?.value.trim() || "";
          markAttendance(sessionId, studentId, status, note);
        });
        close();
        onDone();
      });
    },
  });
}

function openMaterialsModal(sessionId, classId, onDone) {
  const materials = listMaterialsBySession(sessionId);

  openModal({
    title: "Tài liệu & Bài giảng Buổi học",
    size: "modal-lg",
    body: `
      <div style="display:flex;flex-direction:column;gap:14px;">
        <h4 style="margin:0;font-size:14px;color:var(--brand-ink);">Danh sách tài liệu đã đính kèm</h4>
        <div style="display:flex;flex-direction:column;gap:8px;max-height:200px;overflow-y:auto;">
          ${materials.map((m) => `
            <div class="material-file-card">
              <div>
                <strong>${escapeHtml(m.fileName)}</strong>
                <span class="muted" style="font-size:11.5px;display:block;">Tải lên ngày: ${formatDate(String(m.createdAt).slice(0, 10))}</span>
              </div>
              <div>${materialLink(m)}</div>
            </div>
          `).join("") || `<div class="empty">Buổi học này chưa có tài liệu nào.</div>`}
        </div>

        <h4 style="margin:10px 0 0;font-size:14px;color:var(--brand-ink);">Tải lên tài liệu mới</h4>
        <div class="modal-form">
          <div>
            <label for="mat-title">Tên tài liệu / bài tập *</label>
            <input id="mat-title" type="text" placeholder="Ví dụ: Đề cương ôn tập Chương 1..." />
          </div>
          <div>
            <label for="mat-link">Đường dẫn tài liệu hoặc nội dung text *</label>
            <input id="mat-link" type="text" placeholder="https://drive.google.com/... hoặc link tài liệu" />
          </div>
        </div>
        <p class="form-error" id="mat-error" role="alert" hidden></p>
      </div>`,
    foot: `
      <button class="btn" data-close>Đóng</button>
      <button class="btn btn-primary" id="btn-save-material">Đính kèm tài liệu</button>`,
    onMount: (root, close) => {
      root.querySelector("#btn-save-material")?.addEventListener("click", () => {
        const title = root.querySelector("#mat-title").value.trim();
        const link = root.querySelector("#mat-link").value.trim();
        const err = root.querySelector("#mat-error");
        err.hidden = true;

        const cls = getClassById(classId);
        if (!cls || cls.status !== "open") {
          err.textContent = cls?.status === "closed"
            ? "Lớp đã đóng – không thể chỉnh sửa tài liệu."
            : "Lớp chưa được Admin duyệt.";
          err.hidden = false;
          return;
        }

        if (!title || !link) {
          err.textContent = "Vui lòng nhập đầy đủ tên tài liệu và link.";
          err.hidden = false;
          return;
        }

        try {
          attachMaterial(sessionId, { fileName: title, fileData: link });
        } catch (e) {
          err.textContent = e?.message || "Không thể đính kèm tài liệu.";
          err.hidden = false;
          return;
        }
        close();
        onDone();
      });
    },
  });
}

function openAddGradeModal(student, cls, onDone) {
  const students = listStudentsOfClass(cls.id);

  openModal({
    title: `Nhập điểm kiểm tra · Lớp ${escapeHtml(cls.className)}`,
    body: `
      <div class="modal-form">
        <div>
          <label for="gr-student">Chọn học sinh *</label>
          <select id="gr-student" style="width:100%;padding:10px 12px;border-radius:10px;border:1.5px solid var(--line);background:var(--field);">
            ${students.map((s) => `<option value="${s.id}" ${s.id === student?.id ? "selected" : ""}>${escapeHtml(s.fullName)} (Mã HS: ${s.id})</option>`).join("")}
          </select>
        </div>
        <div>
          <label for="gr-type">Loại bài kiểm tra *</label>
          <select id="gr-type" style="width:100%;padding:10px 12px;border-radius:10px;border:1.5px solid var(--line);background:var(--field);">
            <option value="15m">Kiểm tra 15 phút (Hệ số 1)</option>
            <option value="45m">Kiểm tra 1 tiết (Hệ số 2)</option>
            <option value="semester">Thi Học kỳ (Hệ số 3)</option>
          </select>
        </div>
        <div>
          <label for="gr-score">Điểm số (Thang điểm 10) *</label>
          <input id="gr-score" type="number" step="0.25" min="0" max="10" placeholder="Ví dụ: 8.5" />
        </div>
      </div>
      <p class="form-error" id="gr-error" role="alert" hidden></p>`,
    foot: `
      <button class="btn" data-close>Hủy</button>
      <button class="btn btn-primary" id="btn-save-gr">Lưu điểm</button>`,
    onMount: (root, close) => {
      root.querySelector("#btn-save-gr")?.addEventListener("click", () => {
        const stId = root.querySelector("#gr-student").value;
        const type = root.querySelector("#gr-type").value;
        const score = parseFloat(root.querySelector("#gr-score").value);
        const err = root.querySelector("#gr-error");
        err.hidden = true;

        if (isNaN(score) || score < 0 || score > 10) {
          err.textContent = "Điểm số không hợp lệ (từ 0 đến 10).";
          err.hidden = false;
          return;
        }
        if (cls.status === "closed") {
          err.textContent = `Lớp "${cls.className}" đã đóng – không thể nhập điểm mới.`;
          err.hidden = false;
          return;
        }
        if (cls.status === "pending") {
          err.textContent = `Lớp "${cls.className}" chưa được Admin duyệt.`;
          err.hidden = false;
          return;
        }

        try {
          addGrade(cls.id, stId, { type, score });
        } catch (e) {
          err.textContent = e?.message || "Không thể lưu điểm.";
          err.hidden = false;
          return;
        }
        close();
        onDone();
      });
    },
  });
}

function openAddCommentModal(student, cls, onDone) {
  openModal({
    title: `Ghi nhận xét cho ${escapeHtml(student.fullName)}`,
    body: `
      <div class="modal-form">
        <div>
          <label for="cm-content">Nội dung nhận xét đánh giá học tập *</label>
          <textarea id="cm-content" rows="4" placeholder="Nhận xét về thái độ học tập, điểm mạnh và các điểm cần cải thiện của con..." style="width:100%;padding:10px 12px;border-radius:10px;border:1.5px solid var(--line);background:var(--field);font-family:inherit;"></textarea>
        </div>
      </div>
      <p class="form-error" id="cm-error" role="alert" hidden></p>`,
    foot: `
      <button class="btn" data-close>Hủy</button>
      <button class="btn btn-primary" id="btn-save-cm">Lưu nhận xét</button>`,
    onMount: (root, close) => {
      root.querySelector("#btn-save-cm")?.addEventListener("click", () => {
        const content = root.querySelector("#cm-content").value.trim();
        const err = root.querySelector("#cm-error");
        err.hidden = true;

        if (!content) {
          err.textContent = "Vui lòng nhập nội dung nhận xét.";
          err.hidden = false;
          return;
        }
        if (cls.status === "closed") {
          err.textContent = `Lớp "${cls.className}" đã đóng – không thể ghi nhận xét mới.`;
          err.hidden = false;
          return;
        }
        if (cls.status === "pending") {
          err.textContent = `Lớp "${cls.className}" chưa được Admin duyệt.`;
          err.hidden = false;
          return;
        }

        try {
          addComment(cls.id, student.id, content);
        } catch (e) {
          err.textContent = e?.message || "Không thể lưu nhận xét.";
          err.hidden = false;
          return;
        }
        close();
        onDone();
      });
    },
  });
}

function openCreateSessionModal(myClasses, onDone) {
  openModal({
    title: "Thêm Buổi học Mới cho Lớp",
    body: `
      <div class="modal-form">
        <div>
          <label for="sess-class">Chọn lớp học *</label>
          <select id="sess-class" style="width:100%;padding:10px 12px;border-radius:10px;border:1.5px solid var(--line);background:var(--field);">
            ${myClasses.map((c) => `<option value="${c.id}">${escapeHtml(c.className)}</option>`).join("")}
          </select>
        </div>
        <div>
          <label for="sess-title">Tên buổi học *</label>
          <input id="sess-title" type="text" placeholder="Ví dụ: Ôn tập Hàm số bậc nhất..." />
        </div>
        <div>
          <label for="sess-date">Ngày học *</label>
          <input id="sess-date" type="date" value="${todayStr()}" />
        </div>
        <div>
          <label for="sess-room">Phòng học / Ghi chú</label>
          <input id="sess-room" type="text" placeholder="Phòng BTM-01..." />
        </div>
      </div>
      <p class="form-error" id="sess-error" role="alert" hidden></p>`,
    foot: `
      <button class="btn" data-close>Hủy</button>
      <button class="btn btn-primary" id="btn-save-sess">Tạo buổi học</button>`,
    onMount: (root, close) => {
      root.querySelector("#btn-save-sess")?.addEventListener("click", () => {
        const classId = root.querySelector("#sess-class").value;
        const title = root.querySelector("#sess-title").value.trim();
        const date = root.querySelector("#sess-date").value;
        const room = root.querySelector("#sess-room").value.trim();
        const err = root.querySelector("#sess-error");
        err.hidden = true;

        if (!title || !date) {
          err.textContent = "Vui lòng nhập tên buổi học và ngày học.";
          err.hidden = false;
          return;
        }

        const targetCls = getClassById(classId);
        if (!targetCls || targetCls.status !== "open") {
          err.textContent = targetCls?.status === "closed"
            ? "Lớp đã đóng – không thể thêm buổi học mới."
            : "Lớp chưa được Admin duyệt.";
          err.hidden = false;
          return;
        }

        try {
          createSession(classId, { title, date, room });
        } catch (e) {
          err.textContent = e?.message || "Không thể tạo buổi học.";
          err.hidden = false;
          return;
        }
        close();
        onDone();
      });
    },
  });
}

function openCreateClassModal(teacher, onDone) {
  openModal({
    title: "Đăng ký Mở Lớp học Mới",
    size: "modal-lg",
    body: `
      <div class="modal-form">
        <p class="muted">Lớp học sẽ được gửi tới Quản trị viên để xét duyệt và kích hoạt.</p>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          <div>
            <label for="new-cls-name">Tên lớp học *</label>
            <input id="new-cls-name" type="text" placeholder="Ví dụ: Toán 9 Nâng cao - K3" />
          </div>
          <div>
            <label for="new-cls-max">Chỉ tiêu sĩ số tối đa *</label>
            <input id="new-cls-max" type="number" value="25" min="5" max="50" />
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;">
          <div>
            <label for="new-cls-day">Ngày học trong tuần *</label>
            <select id="new-cls-day" style="width:100%;padding:10px 12px;border-radius:10px;border:1.5px solid var(--line);background:var(--field);">
              ${WEEKDAYS.map((w) => `<option value="${w.value}">${w.label}</option>`).join("")}
            </select>
          </div>
          <div>
            <label for="new-cls-start">Giờ bắt đầu *</label>
            <input id="new-cls-start" type="time" value="17:30" />
          </div>
          <div>
            <label for="new-cls-end">Giờ kết thúc *</label>
            <input id="new-cls-end" type="time" value="19:30" />
          </div>
        </div>
      </div>
      <p class="form-error" id="cls-new-error" role="alert" hidden></p>`,
    foot: `
      <button class="btn" data-close>Hủy</button>
      <button class="btn btn-primary" id="btn-save-new-cls">Gửi đăng ký mở lớp</button>`,
    onMount: (root, close) => {
      root.querySelector("#btn-save-new-cls")?.addEventListener("click", () => {
        const className = root.querySelector("#new-cls-name").value.trim();
        const maxSlot = parseInt(root.querySelector("#new-cls-max").value, 10);
        const dayOfWeek = parseInt(root.querySelector("#new-cls-day").value, 10);
        const start = root.querySelector("#new-cls-start").value;
        const end = root.querySelector("#new-cls-end").value;
        const err = root.querySelector("#cls-new-error");
        err.hidden = true;

        if (!className || isNaN(maxSlot) || !start || !end) {
          err.textContent = "Vui lòng nhập đầy đủ thông tin lớp học.";
          err.hidden = false;
          return;
        }

        const newCls = createClass(teacher, {
          className,
          maxSlot,
          schedule: [{ dayOfWeek, start, end }],
        });

        // Đặt trạng thái lớp là pending và tạo yêu cầu duyệt cho Admin
        DB.update("classes", newCls.id, { status: "pending" });
        DB.insert("class_requests", {
          type: "register",
          classId: newCls.id,
          teacherId: teacher.id,
          status: "pending",
          createdAt: new Date().toISOString(),
        });

        close();
        onDone();
      });
    },
  });
}

function openRescheduleRequestModal(teacher, myClasses, onDone) {
  openModal({
    title: "Yêu cầu Đổi Lịch học (Gửi Admin)",
    size: "modal-lg",
    body: `
      <div class="modal-form">
        <p class="muted">Gửi đề xuất đổi lịch học để Quản trị viên duyệt và cập nhật lịch cho học sinh.</p>
        <div>
          <label for="resched-cls">Chọn lớp học cần đổi lịch *</label>
          <select id="resched-cls" style="width:100%;padding:10px 12px;border-radius:10px;border:1.5px solid var(--line);background:var(--field);">
            ${myClasses.map((c) => `<option value="${c.id}">${escapeHtml(c.className)} · Hiện tại: ${formatSchedule(c.schedule)}</option>`).join("")}
          </select>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;">
          <div>
            <label for="resched-day">Ngày học mới muốn đổi sang *</label>
            <select id="resched-day" style="width:100%;padding:10px 12px;border-radius:10px;border:1.5px solid var(--line);background:var(--field);">
              ${WEEKDAYS.map((w) => `<option value="${w.value}">${w.label}</option>`).join("")}
            </select>
          </div>
          <div>
            <label for="resched-start">Giờ bắt đầu mới *</label>
            <input id="resched-start" type="time" value="18:00" />
          </div>
          <div>
            <label for="resched-end">Giờ kết thúc mới *</label>
            <input id="resched-end" type="time" value="20:00" />
          </div>
        </div>
      </div>
      <p class="form-error" id="resched-error" role="alert" hidden></p>`,
    foot: `
      <button class="btn" data-close>Hủy</button>
      <button class="btn btn-primary" id="btn-save-resched">Gửi yêu cầu tới Admin</button>`,
    onMount: (root, close) => {
      root.querySelector("#btn-save-resched").addEventListener("click", () => {
        const classId = root.querySelector("#resched-cls").value;
        const dayOfWeek = parseInt(root.querySelector("#resched-day").value, 10);
        const start = root.querySelector("#resched-start").value;
        const end = root.querySelector("#resched-end").value;
        const err = root.querySelector("#resched-error");
        err.hidden = true;

        const cls = getClassById(classId);
        if (!cls) return;
        if (cls.status === "closed") {
          err.textContent = "Lớp đã đóng – không thể gửi yêu cầu đổi lịch.";
          err.hidden = false;
          return;
        }

        DB.insert("class_requests", {
          type: "reschedule",
          classId: cls.id,
          teacherId: teacher.id,
          oldSchedule: cls.schedule,
          newSchedule: [{ dayOfWeek, start, end }],
          status: "pending",
          createdAt: new Date().toISOString(),
        });

        close();
        onDone();
      });
    },
  });
}