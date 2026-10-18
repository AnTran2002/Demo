// pages/student/student-dashboard.page.js — Redesign Toàn diện: Trang Tổng quan Học tập Hợp nhất (Student Role)
import { Session } from "../../core/session.js";
import { renderShell, ICONS, formatSchedule } from "../shell.js";
import { getStudentOverview } from "../../modules/dashboard/dashboard.service.js";
import { enroll } from "../../modules/enrollment/enrollment.service.js";
import {
  requestCancelClass,
  getPendingRequest,
} from "../../modules/notifications/notifications.service.js";
import {
  listSessionsByClass,
  listAttendanceBySession,
} from "../../modules/sessions/sessions.service.js";
import { listGradesByStudentInClass } from "../../modules/grades/grades.service.js";
import { listCommentsByStudent } from "../../modules/comments/comments.service.js";
import { listMaterialsBySession } from "../../modules/materials/materials.service.js";
import { listStudentsOfClass, getClassById } from "../../modules/classes/classes.service.js";
import { escapeHtml } from "../../core/html.js";
import {
  subjectLabel,
  formatDate,
  todayStr,
  WEEKDAYS,
} from "../../data/constants.js";

const pct = (a, b) => Math.min(100, Math.round((a / (b || 1)) * 100));

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
  let box = el.querySelector("#student-flash");
  if (!box) {
    box = document.createElement("p");
    box.id = "student-flash";
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

const infoRow = (key, value) => `
  <div class="modal-info">
    <span class="k">${key}</span>
    <span class="v">${value}</span>
  </div>`;

// =============================================================================
// KHỞI TẠO TRANG HỌC SINH: DUY NHẤT 1 TAB "TỔNG QUAN"
// =============================================================================
export function renderStudentDashboard(container) {
  const student = Session.getCurrentUser();

  const tabs = [
    {
      id: "overview-kpis",
      label: "Tổng quan",
      icon: ICONS.grid,
      active: true,
    },
    {
      id: "overview-schedule",
      label: "Thời khóa biểu",
      icon: ICONS.calendar,
    },
    {
      id: "overview-my-classes",
      label: "Lớp đang học",
      icon: ICONS.classes,
    },
    {
      id: "overview-grades",
      label: "Bảng điểm & Nhận xét",
      icon: ICONS.edit,
    },
    {
      id: "overview-materials",
      label: "Tài liệu học tập",
      icon: ICONS.paperclip,
    },
    {
      id: "overview-enroll",
      label: "Đăng ký lớp mới",
      icon: ICONS.plus,
    },
  ];

  renderShell(container, { title: "Tổng quan Học tập", items: tabs });
  const sidebar = container.querySelector(".sidebar");
  if (sidebar) {
    sidebar.classList.add("student-sidebar");
    const sidebarStyles = document.createElement("style");
    sidebarStyles.textContent = `
      .student-sidebar {
        width: 240px;
        flex: none;
        padding: 20px 14px;
        color: #fff;
        background: linear-gradient(180deg, #2b0a5e 0%, #4a12a6 62%, #5e1bd6 100%);
      }
      .student-sidebar .sidebar-brand { gap: 12px; padding: 0 8px 22px; }
      .student-sidebar .brand-text strong { font-size: 16px; letter-spacing: -0.01em; }
      .student-sidebar .brand-text small { font-size: 11px; opacity: 0.65; }
      .student-sidebar .sidebar-nav { gap: 6px; margin-top: 6px; }
      .student-sidebar .nav-item {
        gap: 11px;
        padding: 11px 14px;
        font-family: inherit;
        font-size: 14px;
        font-weight: 600;
        color: rgba(255, 255, 255, 0.74);
        background: transparent;
        border-radius: 12px;
        transition:
          background-color var(--dur-fast) var(--ease-out),
          color var(--dur-fast) var(--ease-out),
          transform var(--dur-fast) var(--ease-out),
          box-shadow var(--dur-fast) var(--ease-out);
      }
      .student-sidebar .nav-item:hover { background: rgba(255, 255, 255, 0.1); color: #fff; }
      .student-sidebar .nav-item:active { transform: scale(0.98); }
      .student-sidebar .nav-item.active {
        background: #fff;
        color: var(--brand-ink);
        box-shadow: 0 8px 18px -10px rgba(0, 0, 0, 0.5);
        transform: translateX(2px);
      }
      .student-sidebar .nav-item::before {
        content: "";
        position: absolute;
        left: 0;
        top: 50%;
        width: 3px;
        height: 56%;
        border-radius: 0 3px 3px 0;
        background: #a05bff;
        opacity: 0;
        transform: translateY(-50%) scaleY(0.2);
        transform-origin: center;
        transition:
          transform var(--dur) var(--ease-spring),
          opacity var(--dur-fast) var(--ease-out);
      }
      .student-sidebar .nav-item.active::before {
        opacity: 1;
        transform: translateY(-50%) scaleY(1);
      }
      .student-sidebar .nav-icon svg { width: 18px; height: 18px; }
      .student-sidebar .nav-item.logout { margin-top: auto; }
      .student-sidebar .nav-item.logout:hover {
        background: rgba(255, 80, 80, 0.16);
        color: #ffb7b7;
      }
      @media (max-width: 900px) {
        .student-sidebar { width: 68px; padding: 18px 10px; }
        .student-sidebar .brand-text,
        .student-sidebar .nav-label { display: none; }
        .student-sidebar .sidebar-brand { justify-content: center; padding: 0 0 20px; }
        .student-sidebar .nav-item { justify-content: center; padding: 12px; }
      }
      @media (hover: hover) {
        .student-sidebar .nav-item:hover { transform: translateX(2px); }
        .student-sidebar .nav-item:hover .nav-icon svg { transform: scale(1.1) rotate(-4deg); }
      }
    `;
    container.append(sidebarStyles);
  }
  const content = container.querySelector("#tab-content");

  renderStudentOverviewPage(content, student);
  setupStudentSidebarNav(container);
}

function setupStudentSidebarNav(container) {
  const nav = container.querySelector(".sidebar-nav");
  const content = container.querySelector("#tab-content");
  if (!nav || !content) return;

  nav.querySelectorAll(".nav-item:not(.logout)").forEach((button) => {
    button.addEventListener("click", () => {
      const section = Array.from(content.querySelectorAll(".overview-panel"))
        .find((panel) => panel.id === button.dataset.tab);
      if (!section) return;

      setStudentSidebarActive(container, section.id);
      section.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

function setStudentSidebarActive(container, sectionId) {
  const nav = container.querySelector(".sidebar-nav");
  nav?.querySelectorAll(".nav-item").forEach((item) => {
    item.classList.toggle("active", item.dataset.tab === sectionId);
  });
}

// =============================================================================
// TRANG TỔNG QUAN HỌC SINH (HỢP NHẤT TOÀN BỘ CÁC KHỐI THÔNG TIN)
// =============================================================================
function renderStudentOverviewPage(el, student) {
  const data = getStudentOverview(student.id);
  const myClasses = data.myClasses;
  const openClasses = data.openClasses;

  // Thu thập điểm của học sinh ở tất cả các môn
  let totalScore = 0;
  let totalCoeff = 0;
  const classGradesMap = new Map();
  myClasses.forEach((c) => {
    const grades = listGradesByStudentInClass(c.id, student.id);
    const g15 = grades.filter((g) => g.type === "15m").map((g) => g.score);
    const g45 = grades.filter((g) => g.type === "45m").map((g) => g.score);
    const gSem = grades.filter((g) => g.type === "semester").map((g) => g.score);

    let clsScore = 0;
    let clsCoeff = 0;
    g15.forEach((s) => { clsScore += s * 1; clsCoeff += 1; totalScore += s * 1; totalCoeff += 1; });
    g45.forEach((s) => { clsScore += s * 2; clsCoeff += 2; totalScore += s * 2; totalCoeff += 2; });
    gSem.forEach((s) => { clsScore += s * 3; clsCoeff += 3; totalScore += s * 3; totalCoeff += 3; });
    const avg = clsCoeff > 0 ? (clsScore / clsCoeff).toFixed(1) : "—";
    classGradesMap.set(c.id, { g15, g45, gSem, avg });
  });
  const overallAvg = totalCoeff > 0 ? (totalScore / totalCoeff).toFixed(1) : "—";

  // Thống kê chuyên cần của học sinh (các buổi đã điểm danh)
  let attTotal = 0;
  let attPresent = 0;
  const sessionsList = [];
  myClasses.forEach((c) => {
    const sessions = listSessionsByClass(c.id);
    sessions.forEach((s) => {
      const records = listAttendanceBySession(s.id);
      const myRec = records.find((a) => a.studentId === student.id);
      if (myRec) {
        attTotal++;
        if (myRec.status === "present" || myRec.status === "late") attPresent++;
      }
      sessionsList.push({ ...s, cls: c, myAtt: myRec });
    });
  });
  const attendanceRate = attTotal > 0 ? pct(attPresent, attTotal) : null;
  const upcomingSessions = sessionsList
    .filter((s) => s.date >= todayStr())
    .sort((a, b) => a.date.localeCompare(b.date));

  // Thời khóa biểu tuần của học sinh
  const currentDow = new Date().getDay() === 0 ? 8 : new Date().getDay() + 1;
  const daysWeek = [2, 3, 4, 5, 6, 7, 8].map((day) => {
    const label = WEEKDAYS.find((w) => w.value === day)?.label || `T${day}`;
    const slots = [];
    myClasses.forEach((c) => {
      (c.schedule || []).forEach((s) => {
        if (s.dayOfWeek === day) {
          slots.push({
            className: c.className,
            subject: c.subject,
            time: `${s.start}–${s.end}`,
            teacherName: c.teacherName || "Giáo viên",
          });
        }
      });
    });
    return { day, label, slots, isToday: day === currentDow };
  });

  // Thu thập tất cả tài liệu bài học của các lớp đang học
  const allMaterials = [];
  myClasses.forEach((c) => {
    listSessionsByClass(c.id).forEach((s) => {
      listMaterialsBySession(s.id).forEach((m) => {
        allMaterials.push({ ...m, sessionTitle: s.title, date: s.date, className: c.className });
      });
    });
  });

  // Nhận xét từ giáo viên
  const myComments = listCommentsByStudent(student.id);

  el.innerHTML = `
    <p class="admin-flash" id="student-flash" hidden></p>

    <div class="overview-dashboard" id="tab-overview" data-page="hoc-sinh">

      <!-- Banner chào mừng học sinh -->
      <div class="welcome-banner">
        <div>
          <h2 class="welcome-title">Xin chào, ${escapeHtml(student.fullName)}!</h2>
          <p class="welcome-sub">
            Mã học sinh: <strong>${student.id}</strong> · Tài khoản: @${escapeHtml(student.username)} · Hôm nay: ${formatDate(todayStr())}
          </p>
        </div>
        <div style="display:flex;gap:10px;align-items:center;">
          <button class="btn btn-sm btn-primary" id="btn-banner-enroll" style="width:auto;padding:8px 16px;cursor:pointer;">
            ${ICONS.plus}
            <span>Đăng ký thêm lớp</span>
          </button>
        </div>
      </div>

      <!-- 1. DIV CHỈ SỐ HỌC TẬP (KPI) -->
      <div class="overview-panel" id="overview-kpis">
        <div class="panel-head-overview">
          <div class="panel-title-group">
            <span class="panel-icon-wrap">${ICONS.grid}</span>
            <div>
              <h2 class="panel-title">Chỉ số Học tập Toàn diện</h2>
              <span class="muted" style="font-size:12px;">Đánh giá tiến độ và kết quả học tập của bạn</span>
            </div>
          </div>
          <div class="panel-actions">
            <button class="btn-view-detail" id="btn-detail-student-kpi">
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
                <span class="kpi-tit">Lớp đang theo học</span>
                <span class="kpi-sub">Môn: ${myClasses.map((c) => subjectLabel(c.subject)).join(", ") || "Chưa có"}</span>
              </div>
            </div>

            <div class="kpi-card" style="--kpi-color:#0d8a5f;--kpi-bg:#e6f8f0;">
              <div class="kpi-icon">${ICONS.edit}</div>
              <div class="kpi-content">
                <span class="kpi-val">${overallAvg}</span>
                <span class="kpi-tit">Điểm trung bình chung</span>
                <span class="kpi-sub">${overallAvg !== "—" && parseFloat(overallAvg) >= 8 ? "Học lực giỏi" : "Tiến độ ổn định"}</span>
              </div>
            </div>

            <div class="kpi-card" style="--kpi-color:#0b7285;--kpi-bg:#e3f6f8;">
              <div class="kpi-icon">${ICONS.check}</div>
              <div class="kpi-content">
                <span class="kpi-val">${attendanceRate === null ? "—" : `${attendanceRate}%`}</span>
                <span class="kpi-tit">Tỷ lệ chuyên cần</span>
                <span class="kpi-sub">${attTotal ? `${attPresent}/${attTotal} buổi có mặt` : "Chưa có dữ liệu điểm danh"}</span>
              </div>
            </div>

            <div class="kpi-card" style="--kpi-color:#6a1bff;--kpi-bg:#f2ecff;">
              <div class="kpi-icon">${ICONS.calendar}</div>
              <div class="kpi-content">
                <span class="kpi-val">${upcomingSessions.length}</span>
                <span class="kpi-tit">Buổi học sắp tới</span>
                <span class="kpi-sub">${upcomingSessions.length ? `Gần nhất: ${formatDate(upcomingSessions[0].date)}` : "Chưa có lịch mới"}</span>
              </div>
            </div>

            <div class="kpi-card" style="--kpi-color:#d97706;--kpi-bg:#fef3c7;">
              <div class="kpi-icon">${ICONS.paperclip}</div>
              <div class="kpi-content">
                <span class="kpi-val">${allMaterials.length}</span>
                <span class="kpi-tit">Tài liệu học tập</span>
                <span class="kpi-sub">Sẵn sàng để tải về ôn bài</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 2. DIV THỜI KHÓA BIỂU TRONG TUẦN -->
      <div class="overview-panel" id="overview-schedule">
        <div class="panel-head-overview">
          <div class="panel-title-group">
            <span class="panel-icon-wrap" style="background:#eef2ff;color:#4f46e5;">${ICONS.calendar}</span>
            <div>
              <h2 class="panel-title">Thời khóa biểu Học tập Hàng tuần</h2>
              <span class="count-chip">${myClasses.length} môn đang học</span>
            </div>
          </div>
          <div class="panel-actions">
            <button class="btn-view-detail" id="btn-detail-student-schedule">
              ${ICONS.eye}
              <span>Xem chi tiết thời khóa biểu</span>
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
                                    <span class="badge subject" style="font-size:10px;padding:1px 6px;align-self:flex-start;">${subjectLabel(s.subject)}</span>
                                    <span class="schedule-slot-time">⏰ ${s.time}</span>
                                    <span style="font-size:10.5px;color:var(--muted);">Thầy/Cô: ${escapeHtml(s.teacherName)}</span>
                                  </div>`
                              )
                              .join("")
                          : `<span class="muted" style="font-size:11px;margin:auto 0;text-align:center;">Nghỉ học</span>`
                      }
                    </div>
                  </div>`
              )
              .join("")}
          </div>
        </div>
      </div>

      <!-- 3. DIV LỚP HỌC CỦA TÔI -->
      <div class="overview-panel" id="overview-my-classes">
        <div class="panel-head-overview">
          <div class="panel-title-group">
            <span class="panel-icon-wrap">${ICONS.classes}</span>
            <div>
              <h2 class="panel-title">Danh sách Lớp học Đang tham gia</h2>
              <span class="count-chip">${myClasses.length} lớp học</span>
            </div>
          </div>
          <div class="panel-actions">
            <button class="btn-quick-add" id="btn-panel-enroll" style="cursor:pointer;">
              ${ICONS.plus}
              <span>Đăng ký thêm lớp</span>
            </button>
            <button class="btn-view-detail" id="btn-detail-student-classes">
              ${ICONS.eye}
              <span>Xem chi tiết các lớp</span>
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
                      <th>Tên lớp học</th>
                      <th>Môn học</th>
                      <th>Giáo viên dạy</th>
                      <th>Lịch học cố định</th>
                      <th>Điểm TB môn</th>
                      <th style="text-align:right;">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${myClasses
                      .map((c, i) => {
                        const gr = classGradesMap.get(c.id);
                        const hasPending = getPendingRequest(student.id, c.id);
                        return `
                          <tr>
                            <td>${i + 1}</td>
                            <td><strong>${escapeHtml(c.className)}</strong></td>
                            <td><span class="badge subject">${subjectLabel(c.subject)}</span></td>
                            <td>${escapeHtml(c.teacherName || "—")}</td>
                            <td class="muted">${formatSchedule(c.schedule)}</td>
                            <td><strong style="color:var(--brand-dark);">${gr ? gr.avg : "—"}</strong></td>
                            <td class="actions" style="text-align:right;">
                              <button class="btn btn-sm btn-primary" data-st-cls-detail="${c.id}" style="width:auto;padding:5px 12px;">
                                Chi tiết môn học
                              </button>
                              ${
                                hasPending
                                  ? `<span class="badge late">Chờ PH duyệt hủy</span>`
                                  : `<button class="btn btn-sm btn-danger" data-st-cancel-cls="${c.id}">Hủy môn</button>`
                              }
                            </td>
                          </tr>`;
                      })
                      .join("")}
                  </tbody>
                </table>`
              : `<div class="empty" style="padding:28px;text-align:center;color:var(--muted);">
                  Bạn chưa đăng ký môn học nào. Hãy tham khảo danh sách lớp bên dưới để đăng ký ngay.
                </div>`
          }
        </div>
      </div>

      <!-- 4. DIV BẢNG ĐIỂM & NHẬN XÉT -->
      <div class="overview-panel" id="overview-grades">
        <div class="panel-head-overview">
          <div class="panel-title-group">
            <span class="panel-icon-wrap" style="background:#fef3c7;color:#b45309;">${ICONS.edit}</span>
            <div>
              <h2 class="panel-title">Bảng điểm & Nhận xét của Giáo viên</h2>
              <span class="count-chip">ĐTB Chung: ${overallAvg}</span>
            </div>
          </div>
          <div class="panel-actions">
            <button class="btn-view-detail" id="btn-detail-student-grades">
              ${ICONS.eye}
              <span>Xem chi tiết bảng điểm</span>
            </button>
          </div>
        </div>

        <div style="padding: 20px 24px;">
          ${
            myClasses.length
              ? `<div style="display:flex;flex-direction:column;gap:14px;">
                  ${myClasses
                    .map((c) => {
                      const gr = classGradesMap.get(c.id);
                      const comments = myComments.filter((cm) => cm.classId === c.id);
                      const latestCm = comments.length ? comments[comments.length - 1].content : "Chưa có nhận xét cho môn này.";

                      return `
                        <div class="grade-matrix-card">
                          <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--line);padding-bottom:8px;">
                            <div style="display:flex;align-items:center;gap:10px;">
                              <span class="badge subject">${subjectLabel(c.subject)}</span>
                              <strong style="font-size:15px;color:var(--brand-ink);">${escapeHtml(c.className)}</strong>
                              <span class="muted" style="font-size:12.5px;">(Thầy/Cô ${escapeHtml(c.teacherName)})</span>
                            </div>
                            <div style="display:flex;align-items:center;gap:6px;">
                              <span style="font-size:12.5px;color:var(--muted);font-weight:700;">ĐTB Môn:</span>
                              <span class="grade-score-pill ${gr && gr.avg !== '—' && parseFloat(gr.avg) >= 8 ? 'high' : ''}">
                                ${gr ? gr.avg : '—'}
                              </span>
                            </div>
                          </div>

                          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;font-size:13px;">
                            <div style="background:#fff;padding:8px 12px;border-radius:8px;border:1px solid var(--line);">
                              <span class="muted" style="font-size:11px;font-weight:700;display:block;">KIỂM TRA 15 PHÚT (HS 1)</span>
                              <strong style="color:var(--brand-ink);">${gr?.g15.length ? gr.g15.join(", ") : "—"}</strong>
                            </div>
                            <div style="background:#fff;padding:8px 12px;border-radius:8px;border:1px solid var(--line);">
                              <span class="muted" style="font-size:11px;font-weight:700;display:block;">KIỂM TRA 1 TIẾT (HS 2)</span>
                              <strong style="color:var(--brand-ink);">${gr?.g45.length ? gr.g45.join(", ") : "—"}</strong>
                            </div>
                            <div style="background:#fff;padding:8px 12px;border-radius:8px;border:1px solid var(--line);">
                              <span class="muted" style="font-size:11px;font-weight:700;display:block;">THI HỌC KỲ (HS 3)</span>
                              <strong style="color:var(--brand-ink);">${gr?.gSem.length ? gr.gSem.join(", ") : "—"}</strong>
                            </div>
                          </div>

                          <div class="comment-bubble">
                            <strong>Lời phê của Thầy/Cô:</strong> ${escapeHtml(latestCm)}
                          </div>
                        </div>`;
                    })
                    .join("")}
                </div>`
              : `<div class="empty">Chưa có dữ liệu điểm môn học.</div>`
          }
        </div>
      </div>

      <!-- 5. DIV TÀI LIỆU HỌC TẬP -->
      <div class="overview-panel" id="overview-materials">
        <div class="panel-head-overview">
          <div class="panel-title-group">
            <span class="panel-icon-wrap" style="background:#f4efff;color:#6a1bff;">${ICONS.paperclip}</span>
            <div>
              <h2 class="panel-title">Tài liệu & Bài tập Các môn học</h2>
              <span class="count-chip">${allMaterials.length} file tài liệu</span>
            </div>
          </div>
          <div class="panel-actions">
            <button class="btn-view-detail" id="btn-detail-student-materials">
              ${ICONS.eye}
              <span>Xem tất cả tài liệu</span>
            </button>
          </div>
        </div>

        <div style="padding: 20px 24px;">
          ${
            allMaterials.length
              ? `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px;">
                  ${allMaterials.slice(0, 6).map(
                    (m) => `
                      <div class="material-file-card">
                        <div style="min-width:0;">
                          <strong style="display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(m.fileName)}</strong>
                          <span class="muted" style="font-size:11.5px;">${escapeHtml(m.className)} · ${formatDate(m.date)}</span>
                        </div>
                        <div>${materialLink(m)}</div>
                      </div>`
                  ).join("")}
                </div>`
              : `<div class="empty" style="padding:24px;text-align:center;color:var(--muted);">
                  Các lớp học hiện chưa tải lên tài liệu mới.
                </div>`
          }
        </div>
      </div>

      <!-- 6. DIV ĐĂNG KÝ LỚP HỌC MỚI -->
      <div class="overview-panel" id="overview-enroll">
        <div class="panel-head-overview">
          <div class="panel-title-group">
            <span class="panel-icon-wrap" style="background:#e6f8f0;color:#0d8a5f;">${ICONS.classes}</span>
            <div>
              <h2 class="panel-title">Các Lớp học Đang Mở Tuyển sinh</h2>
              <span class="count-chip">${openClasses.length} lớp học</span>
            </div>
          </div>
          <div class="panel-actions">
            <button class="btn-view-detail" id="btn-detail-open-classes">
              ${ICONS.eye}
              <span>Xem chi tiết các lớp</span>
            </button>
          </div>
        </div>

        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Tên lớp học</th>
                <th>Môn</th>
                <th>Giáo viên phụ trách</th>
                <th>Sĩ số lớp</th>
                <th>Lịch học cố định</th>
                <th style="text-align:right;">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              ${openClasses
                .map(
                  (c, idx) => `
                    <tr>
                      <td>${idx + 1}</td>
                      <td><strong>${escapeHtml(c.className)}</strong></td>
                      <td><span class="badge subject">${subjectLabel(c.subject)}</span></td>
                      <td>${escapeHtml(c.teacherName || "—")}</td>
                      <td>
                        <span class="slot-cell">
                          <span class="slot-text">${c.enrolled}/${c.maxSlot} (${pct(c.enrolled, c.maxSlot)}%)</span>
                          <span class="slot-bar"><i style="width:${pct(c.enrolled, c.maxSlot)}%"></i></span>
                        </span>
                      </td>
                      <td class="muted">${formatSchedule(c.schedule)}</td>
                      <td class="actions" style="text-align:right;">
                        ${
                          c.isEnrolled
                            ? `<span class="badge active">Đang theo học</span>`
                            : c.enrolled >= c.maxSlot
                            ? `<span class="badge closed">Hết chỗ</span>`
                            : `<button class="btn btn-sm btn-primary" data-st-enroll="${c.id}" style="width:auto;padding:5px 14px;">
                                Đăng ký ngay
                              </button>`
                        }
                      </td>
                    </tr>`
                )
                .join("")}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  `;

  // Setup detail modals
  setupStudentDetailButtons(el, { student, myClasses, openClasses, allMaterials, overallAvg, attendanceRate });

  // Setup actions (enroll, cancel)
  setupStudentActions(el, student);
}

function setupStudentDetailButtons(el, { student, myClasses, openClasses, allMaterials, overallAvg, attendanceRate }) {
  // 1. Chi tiết chỉ số học tập
  el.querySelector("#btn-detail-student-kpi")?.addEventListener("click", () => {
    openModal({
      title: "Hồ sơ Học tập Toàn diện của Bạn",
      size: "modal-lg",
      body: `
        <div style="display:flex;flex-direction:column;gap:14px;">
          ${infoRow("Học sinh", escapeHtml(student.fullName))}
          ${infoRow("Mã học sinh", student.id)}
          ${infoRow("Điểm trung bình các môn", `<strong>${overallAvg}</strong>`)}
          ${infoRow("Tỷ lệ chuyên cần", attendanceRate === null ? "Chưa có dữ liệu điểm danh" : `${attendanceRate}%`)}
          ${infoRow("Số lượng môn học đang tham gia", `${myClasses.length} lớp học`)}
          ${infoRow("Số tài liệu bài học có sẵn", `${allMaterials.length} file`)}
        </div>`,
      foot: `<button class="btn btn-primary" data-close>Đã hiểu</button>`,
    });
  });

  // 2. Chi tiết thời khóa biểu
  el.querySelector("#btn-detail-student-schedule")?.addEventListener("click", () => {
    openModal({
      title: "Thời khóa biểu Tuần Toàn diện",
      size: "modal-xl",
      body: `
        <div class="table-wrap">
          <table>
            <thead>
              <tr><th>Thứ</th><th>Môn học</th><th>Lớp</th><th>Khung giờ học</th><th>Giáo viên</th></tr>
            </thead>
            <tbody>
              ${[2, 3, 4, 5, 6, 7, 8].flatMap((day) => {
                const label = WEEKDAYS.find((w) => w.value === day)?.label || `T${day}`;
                const slots = [];
                myClasses.forEach((c) => {
                  (c.schedule || []).forEach((s) => {
                    if (s.dayOfWeek === day) {
                      slots.push({
                        dayLabel: label,
                        subject: c.subject,
                        className: c.className,
                        time: `${s.start}–${s.end}`,
                        teacher: c.teacherName || "Giáo viên",
                      });
                    }
                  });
                });
                return slots;
              }).map((s) => `
                <tr>
                  <td><strong>${s.dayLabel}</strong></td>
                  <td><span class="badge subject">${subjectLabel(s.subject)}</span></td>
                  <td><strong>${escapeHtml(s.className)}</strong></td>
                  <td>${s.time}</td>
                  <td>${escapeHtml(s.teacher)}</td>
                </tr>
              `).join("") || `<tr><td colspan="5" class="muted" style="text-align:center;">Chưa có lịch học nào.</td></tr>`}
            </tbody>
          </table>
        </div>`,
      foot: `<button class="btn btn-primary" data-close>Đóng</button>`,
    });
  });

  // 3. Chi tiết các lớp
  el.querySelector("#btn-detail-student-classes")?.addEventListener("click", () => {
    openModal({
      title: "Bảng Chi tiết Lớp học Đang tham gia",
      size: "modal-lg",
      body: `
        <div class="table-wrap">
          <table>
            <thead>
              <tr><th>#</th><th>Tên lớp</th><th>Môn</th><th>Giáo viên</th><th>Sĩ số</th><th>Lịch học</th></tr>
            </thead>
            <tbody>
              ${myClasses.map((c, i) => `
                <tr>
                  <td>${i + 1}</td>
                  <td><strong>${escapeHtml(c.className)}</strong></td>
                  <td><span class="badge subject">${subjectLabel(c.subject)}</span></td>
                  <td>${escapeHtml(c.teacherName || "—")}</td>
                  <td>${c.enrolled}/${c.maxSlot}</td>
                  <td class="muted">${formatSchedule(c.schedule)}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>`,
      foot: `<button class="btn btn-primary" data-close>Đóng</button>`,
    });
  });

  // 4. Chi tiết bảng điểm
  el.querySelector("#btn-detail-student-grades")?.addEventListener("click", () => {
    openModal({
      title: "Bảng điểm Tổng thể & Xếp loại",
      size: "modal-lg",
      body: `
        <div style="display:flex;flex-direction:column;gap:12px;">
          <p class="muted">Bảng điểm tổng kết các bài kiểm tra 15 phút, 1 tiết và thi học kỳ.</p>
          <div class="table-wrap">
            <table>
              <thead>
                <tr><th>Môn học</th><th>Lớp</th><th>Điểm 15p</th><th>Điểm 1T</th><th>Học kỳ</th><th>ĐTB Môn</th></tr>
              </thead>
              <tbody>
                ${myClasses.map((c) => {
                  const grades = listGradesByStudentInClass(c.id, student.id);
                  const g15 = grades.filter((g) => g.type === "15m").map((g) => g.score);
                  const g45 = grades.filter((g) => g.type === "45m").map((g) => g.score);
                  const gSem = grades.filter((g) => g.type === "semester").map((g) => g.score);
                  let tot = 0; let coe = 0;
                  g15.forEach((s) => { tot += s * 1; coe += 1; });
                  g45.forEach((s) => { tot += s * 2; coe += 2; });
                  gSem.forEach((s) => { tot += s * 3; coe += 3; });
                  const avg = coe > 0 ? (tot / coe).toFixed(1) : "—";
                  return `
                    <tr>
                      <td><span class="badge subject">${subjectLabel(c.subject)}</span></td>
                      <td><strong>${escapeHtml(c.className)}</strong></td>
                      <td>${g15.join(", ") || "—"}</td>
                      <td>${g45.join(", ") || "—"}</td>
                      <td>${gSem.join(", ") || "—"}</td>
                      <td><strong style="color:var(--brand-dark);">${avg}</strong></td>
                    </tr>`;
                }).join("")}
              </tbody>
            </table>
          </div>
        </div>`,
      foot: `<button class="btn btn-primary" data-close>Đóng</button>`,
    });
  });

  // 5. Chi tiết tài liệu
  el.querySelector("#btn-detail-student-materials")?.addEventListener("click", () => {
    openModal({
      title: "Thư viện Tài liệu Bài học Toàn diện",
      size: "modal-lg",
      body: `
        <div style="display:flex;flex-direction:column;gap:10px;max-height:420px;overflow-y:auto;">
          ${allMaterials.map((m) => `
            <div class="material-file-card">
              <div>
                <strong>${escapeHtml(m.fileName)}</strong>
                <span class="muted" style="font-size:12px;display:block;">${escapeHtml(m.className)} · Buổi: ${escapeHtml(m.sessionTitle || '')} (${formatDate(m.date)})</span>
              </div>
              <div>${materialLink(m)}</div>
            </div>
          `).join("") || `<div class="empty">Chưa có tài liệu nào.</div>`}
        </div>`,
      foot: `<button class="btn btn-primary" data-close>Đóng</button>`,
    });
  });

  // 6. Chi tiết các lớp đang mở
  el.querySelector("#btn-detail-open-classes")?.addEventListener("click", () => {
    openModal({
      title: "Danh sách Lớp học Đang Mở Tuyển sinh của Trung tâm",
      size: "modal-xl",
      body: `
        <div class="table-wrap">
          <table>
            <thead>
              <tr><th>#</th><th>Tên lớp</th><th>Môn</th><th>Giáo viên</th><th>Sĩ số</th><th>Lịch học</th></tr>
            </thead>
            <tbody>
              ${openClasses.map((c, i) => `
                <tr>
                  <td>${i + 1}</td>
                  <td><strong>${escapeHtml(c.className)}</strong></td>
                  <td><span class="badge subject">${subjectLabel(c.subject)}</span></td>
                  <td>${escapeHtml(c.teacherName || "—")}</td>
                  <td>${c.enrolled}/${c.maxSlot}</td>
                  <td class="muted">${formatSchedule(c.schedule)}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>`,
      foot: `<button class="btn btn-primary" data-close>Đóng</button>`,
    });
  });
}

function setupStudentActions(el, student) {
  // Tự động kéo mượt xuống phần Các lớp học đang mở tuyển sinh
  const scrollToEnroll = (e) => {
    e?.preventDefault();
    const targetEl = el.querySelector("#overview-enroll");
    if (targetEl) {
      targetEl.scrollIntoView({ behavior: "smooth", block: "start" });
      setStudentSidebarActive(el.closest(".app-shell"), "overview-enroll");
      targetEl.style.transition = "box-shadow 0.3s ease, border-color 0.3s ease";
      targetEl.style.borderColor = "#863bff";
      targetEl.style.boxShadow = "0 0 0 4px rgba(134, 59, 255, 0.25)";
      setTimeout(() => {
        targetEl.style.borderColor = "";
        targetEl.style.boxShadow = "";
      }, 1600);
    }
  };

  el.querySelector("#btn-banner-enroll")?.addEventListener("click", scrollToEnroll);
  el.querySelector("#btn-panel-enroll")?.addEventListener("click", scrollToEnroll);

  // Đăng ký lớp
  el.querySelectorAll("[data-st-enroll]").forEach((btn) =>
    btn.addEventListener("click", () => {
      const classId = btn.dataset.stEnroll;
      try {
        enroll(student.id, classId);
        renderStudentOverviewPage(el, student);
        flash(el, "Đăng ký môn học thành công!");
      } catch (e) {
        flash(el, e.message, "error");
      }
    })
  );

  // Chi tiết môn học
  el.querySelectorAll("[data-st-cls-detail]").forEach((btn) =>
    btn.addEventListener("click", () => {
      const cls = getClassById(btn.dataset.stClsDetail);
      if (cls) openStudentClassModal(cls, student);
    })
  );

  // Hủy đăng ký lớp (gửi yêu cầu cho phụ huynh duyệt)
  el.querySelectorAll("[data-st-cancel-cls]").forEach((btn) =>
    btn.addEventListener("click", () => {
      const classId = btn.dataset.stCancelCls;
      const cls = getClassById(classId);
      if (!cls) return;

      openModal({
        title: "Xác nhận gửi yêu cầu hủy môn học",
        body: `
          <p>Bạn chắc chắn muốn gửi yêu cầu hủy môn <strong>${escapeHtml(cls.className)}</strong>?</p>
          <p class="muted">Phụ huynh của bạn sẽ nhận được thông báo và cần phê duyệt để lớp học chính thức được hủy khỏi danh sách.</p>`,
        foot: `
          <button class="btn" data-close>Đóng</button>
          <button class="btn btn-danger" id="confirm-cancel-req">Gửi yêu cầu hủy</button>`,
        onMount: (root, close) => {
          root.querySelector("#confirm-cancel-req")?.addEventListener("click", () => {
            try {
              requestCancelClass(student.id, classId);
              close();
              renderStudentOverviewPage(el, student);
              flash(el, "Đã gửi yêu cầu hủy môn tới phụ huynh để xác nhận.");
            } catch (e) {
              close();
              flash(el, e.message, "error");
            }
          });
        },
      });
    })
  );
}

function openStudentClassModal(cls, student) {
  const classmates = listStudentsOfClass(cls.id);
  const sessions = listSessionsByClass(cls.id);
  const grades = listGradesByStudentInClass(cls.id, student.id);

  openModal({
    title: `Chi tiết Môn học · ${escapeHtml(cls.className)}`,
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
            <span class="roster-chip-k">Sĩ số lớp</span>
            <span class="roster-chip-v">${cls.enrolled}/${cls.maxSlot} HS</span>
          </div>
        </div>

        ${infoRow("Lịch học định kỳ", formatSchedule(cls.schedule))}
        ${infoRow("Số buổi học đã diễn ra", `${sessions.length} buổi`)}

        <h4 style="margin:10px 0 4px;font-size:14.5px;color:var(--brand-ink);">
          Điểm kiểm tra của bạn ở môn này
        </h4>
        <div style="display:flex;gap:12px;flex-wrap:wrap;">
          <div style="padding:10px 14px;background:#f8f7fd;border-radius:10px;border:1px solid var(--line);">
            <span class="muted" style="font-size:11px;font-weight:700;">15 PHÚT:</span>
            <strong>${grades.filter((g) => g.type === "15m").map((g) => g.score).join(", ") || "Chưa có"}</strong>
          </div>
          <div style="padding:10px 14px;background:#f8f7fd;border-radius:10px;border:1px solid var(--line);">
            <span class="muted" style="font-size:11px;font-weight:700;">1 TIẾT:</span>
            <strong>${grades.filter((g) => g.type === "45m").map((g) => g.score).join(", ") || "Chưa có"}</strong>
          </div>
          <div style="padding:10px 14px;background:#f8f7fd;border-radius:10px;border:1px solid var(--line);">
            <span class="muted" style="font-size:11px;font-weight:700;">HỌC KỲ:</span>
            <strong>${grades.filter((g) => g.type === "semester").map((g) => g.score).join(", ") || "Chưa có"}</strong>
          </div>
        </div>

        <h4 style="margin:10px 0 4px;font-size:14.5px;color:var(--brand-ink);">
          Danh sách Bạn cùng lớp (${classmates.length} bạn)
        </h4>
        <div style="max-height:180px;overflow-y:auto;background:#faf9fe;padding:10px 14px;border-radius:10px;border:1px solid var(--line);">
          <div style="display:flex;flex-wrap:wrap;gap:8px;">
            ${classmates.map((st) => `
              <span class="badge ${st.id === student.id ? 'active' : 'student'}" style="font-size:12px;">
                ${escapeHtml(st.fullName)} ${st.id === student.id ? '(Bạn)' : ''}
              </span>
            `).join("")}
          </div>
        </div>
      </div>`,
    foot: `<button class="btn btn-primary" data-close>Đóng</button>`,
  });
}