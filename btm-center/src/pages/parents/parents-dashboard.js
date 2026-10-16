// pages/parents/parents-dashboard.js — Redesign Toàn diện: Trang Tổng quan Phụ huynh Hợp nhất (Parent Role)
import { Session } from "../../core/session.js";
import { renderShell, ICONS, formatSchedule, ROLE_LABELS } from "../shell.js";
import { getLinkedStudent } from "../../modules/parents/parents.service.js";
import { escapeHtml } from "../../core/html.js";
import {
  buildStudentNotifications,
  decideCancelRequest,
} from "../../modules/notifications/notifications.service.js";
import { getStudentOverview } from "../../modules/dashboard/dashboard.service.js";
import {
  listSessionsByClass,
  listAttendanceBySession,
  listAttendanceOfStudent,
} from "../../modules/sessions/sessions.service.js";
import { listGradesByStudentInClass } from "../../modules/grades/grades.service.js";
import { listCommentsByStudent } from "../../modules/comments/comments.service.js";
import { listMaterialsBySession } from "../../modules/materials/materials.service.js";
import { listUsers } from "../../modules/users/users.service.js";
import { getClassById } from "../../modules/classes/classes.service.js";
import { DB } from "../../core/db.js";
import {
  subjectLabel,
  formatDate,
  todayStr,
  WEEKDAYS,
  ATTENDANCE_LABELS,
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
  let box = el.querySelector("#parent-flash");
  if (!box) {
    box = document.createElement("p");
    box.id = "parent-flash";
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
// KHỞI TẠO TRANG PHỤ HUYNH: DUY NHẤT 1 TAB "TỔNG QUAN"
// =============================================================================
export function renderParentsDashboard(container) {
  const parent = Session.getCurrentUser();
  const student = getLinkedStudent(parent.id);

  const tabs = [
    {
      id: "overview",
      label: "Tổng quan",
      icon: ICONS.grid,
      active: true,
      render: (content) => renderParentOverviewPage(content, parent, student),
    },
  ];

  renderShell(container, { title: "Tổng quan Theo dõi Học tập", items: tabs });
  const content = container.querySelector("#tab-content");

  renderParentOverviewPage(content, parent, student);
}

// =============================================================================
// TRANG TỔNG QUAN PHỤ HUYNH (HỢP NHẤT TOÀN BỘ CÁC KHỐI THÔNG TIN CỦA CON)
// =============================================================================
function renderParentOverviewPage(el, parent, student) {
  if (!student) {
    el.innerHTML = `
      <div class="panel" style="padding:32px;text-align:center;">
        <h2 style="color:var(--brand-ink);">Tài khoản chưa liên kết học sinh</h2>
        <p class="muted">Tài khoản phụ huynh của bạn chưa được liên kết với mã học sinh nào. Vui lòng liên hệ ban quản trị để hỗ trợ.</p>
      </div>`;
    return;
  }

  const studentData = getStudentOverview(student.id);
  const myClasses = studentData.myClasses;
  const notifications = buildStudentNotifications(student.id);
  const pendingCancelRequests = notifications.filter(
    (n) => n.kind === "cancel-request" && n.request?.status === "pending"
  );

  // Điểm số của con
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

  // Chuyên cần của con
  const attendanceList = listAttendanceOfStudent(student.id);
  const attPresentCount = attendanceList.filter((a) => a.status === "present" || a.status === "late").length;
  const attRate = attendanceList.length ? pct(attPresentCount, attendanceList.length) : null;

  // Lịch học trong tuần của con
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

  // Tài liệu của các môn con đang học
  const allMaterials = [];
  myClasses.forEach((c) => {
    listSessionsByClass(c.id).forEach((s) => {
      listMaterialsBySession(s.id).forEach((m) => {
        allMaterials.push({ ...m, sessionTitle: s.title, date: s.date, className: c.className });
      });
    });
  });

  // Nhận xét của giáo viên về con
  const comments = listCommentsByStudent(student.id);

  el.innerHTML = `
    <p class="admin-flash" id="parent-flash" hidden></p>

    <div class="overview-dashboard" id="tab-overview" data-page="phu-huynh">

      <!-- Banner chào mừng phụ huynh -->
      <div class="welcome-banner">
        <div>
          <h2 class="welcome-title">Xin chào, ${escapeHtml(parent.fullName)}!</h2>
          <p class="welcome-sub">
            Đang theo dõi học sinh: <strong>${escapeHtml(student.fullName)}</strong> (Mã HS: <strong>${student.id}</strong>) · Hôm nay: ${formatDate(todayStr())}
          </p>
        </div>
        <div style="display:flex;gap:10px;align-items:center;">
          <span class="badge active" style="font-size:13px;padding:6px 14px;">
            ● Đã liên kết học sinh
          </span>
        </div>
      </div>

      <!-- Thanh nhảy nhanh (Quick Jump Sticky Bar) -->
      <div class="overview-jump-bar" id="overview-jump-bar">
        <span class="jump-label">${ICONS.grid} Xem nhanh mục:</span>
        <a class="jump-pill active" href="#overview-kpis">
          <span>Chỉ số của con</span>
        </a>
        <a class="jump-pill" href="#overview-schedule">
          <span>Lịch học tuần này</span>
          <span class="jump-badge">${myClasses.length} môn</span>
        </a>
        <a class="jump-pill" href="#overview-grades">
          <span>Bảng điểm & Lời phê</span>
        </a>
        <a class="jump-pill" href="#overview-attendance">
          <span>Theo dõi Chuyên cần</span>
          <span class="jump-badge">${attendanceList.length} buổi</span>
        </a>
        <a class="jump-pill" href="#overview-notifications">
          <span>Thông báo & Phê duyệt</span>
          ${
            pendingCancelRequests.length
              ? `<span class="jump-badge" style="background:#ffdd00;color:#5a4100;font-weight:800;">${pendingCancelRequests.length}</span>`
              : `<span class="jump-badge">0</span>`
          }
        </a>
        <a class="jump-pill" href="#overview-materials">
          <span>Tài liệu bài học của con</span>
          <span class="jump-badge">${allMaterials.length}</span>
        </a>
      </div>

      <!-- 1. DIV CHỈ SỐ HỌC TẬP CỦA CON (KPI) -->
      <div class="overview-panel" id="overview-kpis">
        <div class="panel-head-overview">
          <div class="panel-title-group">
            <span class="panel-icon-wrap">${ICONS.grid}</span>
            <div>
              <h2 class="panel-title">Chỉ số Học tập Toàn diện của Con</h2>
              <span class="muted" style="font-size:12px;">Tổng hợp học lực, chuyên cần và tiến độ học tập</span>
            </div>
          </div>
          <div class="panel-actions">
            <button class="btn-view-detail" id="btn-detail-parent-kpi">
              ${ICONS.eye}
              <span>Xem chi tiết hồ sơ con</span>
            </button>
          </div>
        </div>
        <div style="padding: 20px 24px;">
          <div class="kpi-row">
            <div class="kpi-card" style="--kpi-color:#4f46e5;--kpi-bg:#eef2ff;">
              <div class="kpi-icon">${ICONS.classes}</div>
              <div class="kpi-content">
                <span class="kpi-val">${myClasses.length}</span>
                <span class="kpi-tit">Số môn đang học</span>
                <span class="kpi-sub">${myClasses.map((c) => subjectLabel(c.subject)).join(", ") || "Chưa có"}</span>
              </div>
            </div>

            <div class="kpi-card" style="--kpi-color:#0d8a5f;--kpi-bg:#e6f8f0;">
              <div class="kpi-icon">${ICONS.edit}</div>
              <div class="kpi-content">
                <span class="kpi-val">${overallAvg}</span>
                <span class="kpi-tit">Điểm trung bình hiện tại</span>
                <span class="kpi-sub">${overallAvg !== "—" && parseFloat(overallAvg) >= 8 ? "Học lực giỏi" : "Tiến độ đạt yêu cầu"}</span>
              </div>
            </div>

            <div class="kpi-card" style="--kpi-color:#0b7285;--kpi-bg:#e3f6f8;">
              <div class="kpi-icon">${ICONS.check}</div>
              <div class="kpi-content">
                <span class="kpi-val">${attRate === null ? "—" : `${attRate}%`}</span>
                <span class="kpi-tit">Tỷ lệ chuyên cần</span>
                <span class="kpi-sub">${attendanceList.length ? `${attPresentCount}/${attendanceList.length} buổi có mặt` : "Chưa có dữ liệu điểm danh"}</span>
              </div>
            </div>

            <div class="kpi-card" style="--kpi-color:#6a1bff;--kpi-bg:#f2ecff;">
              <div class="kpi-icon">${ICONS.bell}</div>
              <div class="kpi-content">
                <span class="kpi-val">${notifications.length}</span>
                <span class="kpi-tit">Thông báo học tập</span>
                <span class="kpi-sub">${pendingCancelRequests.length ? `${pendingCancelRequests.length} yêu cầu cần duyệt` : "Cập nhật liên tục"}</span>
              </div>
            </div>

            <div class="kpi-card" style="--kpi-color:#d97706;--kpi-bg:#fef3c7;">
              <div class="kpi-icon">${ICONS.paperclip}</div>
              <div class="kpi-content">
                <span class="kpi-val">${allMaterials.length}</span>
                <span class="kpi-tit">Tài liệu ôn tập</span>
                <span class="kpi-sub">Hỗ trợ con tự học tại nhà</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 2. DIV LỊCH HỌC TRONG TUẦN CỦA CON -->
      <div class="overview-panel" id="overview-schedule">
        <div class="panel-head-overview">
          <div class="panel-title-group">
            <span class="panel-icon-wrap" style="background:#eef2ff;color:#4f46e5;">${ICONS.calendar}</span>
            <div>
              <h2 class="panel-title">Thời khóa biểu Học tập của Con</h2>
              <span class="count-chip">${myClasses.length} môn học</span>
            </div>
          </div>
          <div class="panel-actions">
            <button class="btn-view-detail" id="btn-detail-parent-schedule">
              ${ICONS.eye}
              <span>Xem chi tiết lịch học</span>
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
                                    <span style="font-size:10.5px;color:var(--muted);">Giáo viên: ${escapeHtml(s.teacherName)}</span>
                                  </div>`
                              )
                              .join("")
                          : `<span class="muted" style="font-size:11px;margin:auto 0;text-align:center;">Không có lịch</span>`
                      }
                    </div>
                  </div>`
              )
              .join("")}
          </div>
        </div>
      </div>

      <!-- 3. DIV BẢNG ĐIỂM & NHẬN XÉT CỦA GIÁO VIÊN -->
      <div class="overview-panel" id="overview-grades">
        <div class="panel-head-overview">
          <div class="panel-title-group">
            <span class="panel-icon-wrap" style="background:#fef3c7;color:#b45309;">${ICONS.edit}</span>
            <div>
              <h2 class="panel-title">Bảng điểm & Lời nhận xét của Thầy/Cô</h2>
              <span class="count-chip">ĐTB Tổng: ${overallAvg}</span>
            </div>
          </div>
          <div class="panel-actions">
            <button class="btn-view-detail" id="btn-detail-parent-grades">
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
                      const myCm = comments.filter((cm) => cm.classId === c.id);
                      const latestCm = myCm.length ? myCm[myCm.length - 1].content : "Chưa có lời phê cho môn này.";

                      return `
                        <div class="grade-matrix-card">
                          <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--line);padding-bottom:8px;">
                            <div style="display:flex;align-items:center;gap:10px;">
                              <span class="badge subject">${subjectLabel(c.subject)}</span>
                              <strong style="font-size:15px;color:var(--brand-ink);">${escapeHtml(c.className)}</strong>
                              <span class="muted" style="font-size:12.5px;">(Thầy/Cô: ${escapeHtml(c.teacherName)})</span>
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
              : `<div class="empty">Chưa có dữ liệu điểm học tập của con.</div>`
          }
        </div>
      </div>

      <!-- 4. DIV THEO DÕI CHUYÊN CẦN & ĐIỂM DANH -->
      <div class="overview-panel" id="overview-attendance">
        <div class="panel-head-overview">
          <div class="panel-title-group">
            <span class="panel-icon-wrap" style="background:#e3f6f8;color:#0b7285;">${ICONS.check}</span>
            <div>
              <h2 class="panel-title">Nhật ký Điểm danh & Chuyên cần của Con</h2>
              <span class="count-chip">${attendanceList.length} buổi đã ghi nhận</span>
            </div>
          </div>
          <div class="panel-actions">
            <button class="btn-view-detail" id="btn-detail-parent-attendance">
              ${ICONS.eye}
              <span>Xem chi tiết chuyên cần</span>
            </button>
          </div>
        </div>

        <div class="table-wrap">
          ${
            attendanceList.length
              ? `<table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Buổi học</th>
                      <th>Môn học</th>
                      <th>Trạng thái của con</th>
                      <th>Ghi chú từ giáo viên</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${attendanceList.slice(0, 8).map((a, i) => {
                      const sess = DB.findById("sessions", a.sessionId);
                      const cls = sess ? getClassById(sess.classId) : null;
                      const badgeCls = a.status === "present" ? "active" : a.status === "late" ? "late" : "closed";
                      return `
                        <tr>
                          <td>${i + 1}</td>
                          <td><strong>${escapeHtml(sess?.title || 'Buổi học')}</strong> <small class="muted">(${formatDate(sess?.date || '')})</small></td>
                          <td><span class="badge subject">${subjectLabel(cls?.subject)}</span></td>
                          <td><span class="badge ${badgeCls}">${ATTENDANCE_LABELS[a.status] || a.status}</span></td>
                          <td>${escapeHtml(a.note || 'Không có ghi chú')}</td>
                        </tr>`;
                    }).join("")}
                  </tbody>
                </table>`
              : `<div class="empty" style="padding:28px;text-align:center;color:var(--muted);">
                  Chưa có lịch sử điểm danh nào được ghi nhận cho con.
                </div>`
          }
        </div>
      </div>

      <!-- 5. DIV THÔNG BÁO & PHÊ DUYỆT YÊU CẦU HỦY MÔN -->
      <div class="overview-panel" id="overview-notifications">
        <div class="panel-head-overview">
          <div class="panel-title-group">
            <span class="panel-icon-wrap" style="background:#fef3c7;color:#d97706;">${ICONS.bell}</span>
            <div>
              <h2 class="panel-title">Thông báo & Yêu cầu Cần Phê duyệt</h2>
              <span class="count-chip">${pendingCancelRequests.length} yêu cầu chờ xác nhận</span>
            </div>
          </div>
          <div class="panel-actions">
            <button class="btn-view-detail" id="btn-detail-parent-notifications">
              ${ICONS.eye}
              <span>Xem chi tiết thông báo</span>
            </button>
          </div>
        </div>

        <div style="padding: 20px 24px;">
          ${
            notifications.length
              ? `<div style="display:flex;flex-direction:column;gap:12px;">
                  ${notifications.slice(0, 6).map((n) => `
                    <div style="border:1px solid var(--line);border-radius:12px;padding:14px;background:#fff;display:flex;justify-content:space-between;align-items:flex-start;gap:14px;flex-wrap:wrap;">
                      <div style="flex:1;min-width:240px;">
                        <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
                          <span class="badge ${n.tone === 'danger' ? 'closed' : n.tone === 'success' ? 'active' : 'subject'}">
                            ${n.icon} ${n.kind === 'cancel-request' ? 'Yêu cầu hủy môn' : 'Điểm danh'}
                          </span>
                          <strong style="font-size:14px;color:var(--brand-ink);">${escapeHtml(n.title)}</strong>
                        </div>
                        <p style="margin:4px 0 0;font-size:13px;color:#4b4668;line-height:1.4;">${escapeHtml(n.message)}</p>
                        ${n.blockedReason ? `<p style="margin:4px 0 0;font-size:12px;color:#c0392b;">⚠️ ${escapeHtml(n.blockedReason)}</p>` : ''}
                      </div>

                      ${
                        n.canApprove
                          ? `<div style="display:flex;gap:8px;align-items:center;">
                              <button class="btn btn-sm btn-primary" data-p-decide="${n.request.id}" data-action="approved" style="width:auto;padding:6px 12px;">
                                Đồng ý hủy
                              </button>
                              <button class="btn btn-sm btn-danger" data-p-decide="${n.request.id}" data-action="rejected" style="width:auto;padding:6px 12px;">
                                Không đồng ý
                              </button>
                            </div>`
                          : n.kind === 'cancel-request' && n.request?.status === 'pending'
                          ? `<div style="display:flex;gap:8px;align-items:center;">
                              <button class="btn btn-sm btn-danger" data-p-decide="${n.request.id}" data-action="rejected" style="width:auto;padding:6px 12px;">
                                Đóng yêu cầu
                              </button>
                            </div>`
                          : ''
                      }
                    </div>
                  `).join("")}
                </div>`
              : `<div class="empty" style="padding:24px;text-align:center;color:var(--muted);">
                  Hiện tại không có thông báo mới nào về việc học của con.
                </div>`
          }
        </div>
      </div>

      <!-- 6. DIV TÀI LIỆU BÀI HỌC CỦA CON -->
      <div class="overview-panel" id="overview-materials">
        <div class="panel-head-overview">
          <div class="panel-title-group">
            <span class="panel-icon-wrap" style="background:#f4efff;color:#6a1bff;">${ICONS.paperclip}</span>
            <div>
              <h2 class="panel-title">Tài liệu & Bài tập Con đang học</h2>
              <span class="count-chip">${allMaterials.length} file tài liệu</span>
            </div>
          </div>
          <div class="panel-actions">
            <button class="btn-view-detail" id="btn-detail-parent-materials">
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
                  Chưa có tài liệu nào được tải lên.
                </div>`
          }
        </div>
      </div>

    </div>
  `;

  // Jump bar
  setupParentJumpBar(el);

  // Setup detail modals
  setupParentDetailButtons(el, { parent, student, myClasses, notifications, attendanceList, allMaterials, overallAvg, attRate });

  // Setup action decide cancel request
  setupParentActions(el, parent, student);
}

function setupParentJumpBar(el) {
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

function setupParentDetailButtons(el, { parent, student, myClasses, notifications, attendanceList, allMaterials, overallAvg, attRate }) {
  // 1. Chi tiết hồ sơ của con
  el.querySelector("#btn-detail-parent-kpi")?.addEventListener("click", () => {
    openModal({
      title: "Hồ sơ Học tập Tổng thể của Con",
      size: "modal-lg",
      body: `
        <div style="display:flex;flex-direction:column;gap:14px;">
          ${infoRow("Họ và tên con", escapeHtml(student.fullName))}
          ${infoRow("Mã học sinh", student.id)}
          ${infoRow("Tài khoản học sinh", `@${escapeHtml(student.username)}`)}
          ${infoRow("Gmail học sinh", escapeHtml(student.email || "—"))}
          ${infoRow("Điểm trung bình các môn", `<strong>${overallAvg}</strong>`)}
          ${infoRow("Tỷ lệ chuyên cần", attRate === null ? "Chưa có dữ liệu điểm danh" : `<strong>${attRate}%</strong>`)}
          ${infoRow("Số lượng môn con đang học", `${myClasses.length} môn`)}
        </div>`,
      foot: `<button class="btn btn-primary" data-close>Đã hiểu</button>`,
    });
  });

  // 2. Chi tiết lịch học
  el.querySelector("#btn-detail-parent-schedule")?.addEventListener("click", () => {
    openModal({
      title: "Thời khóa biểu Học tập Tuần của Con",
      size: "modal-xl",
      body: `
        <div class="table-wrap">
          <table>
            <thead>
              <tr><th>Thứ</th><th>Môn học</th><th>Lớp</th><th>Khung giờ học</th><th>Giáo viên phụ trách</th></tr>
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
              `).join("") || `<tr><td colspan="5" class="muted" style="text-align:center;">Con chưa có lịch học nào.</td></tr>`}
            </tbody>
          </table>
        </div>`,
      foot: `<button class="btn btn-primary" data-close>Đóng</button>`,
    });
  });

  // 3. Chi tiết bảng điểm & nhận xét
  el.querySelector("#btn-detail-parent-grades")?.addEventListener("click", () => {
    openModal({
      title: "Bảng điểm & Lời phê Toàn diện của Con",
      size: "modal-lg",
      body: `
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
        </div>`,
      foot: `<button class="btn btn-primary" data-close>Đóng</button>`,
    });
  });

  // 4. Chi tiết chuyên cần
  el.querySelector("#btn-detail-parent-attendance")?.addEventListener("click", () => {
    openModal({
      title: "Nhật ký Điểm danh Toàn bộ Buổi học của Con",
      size: "modal-lg",
      body: `
        <div class="table-wrap" style="max-height:420px;overflow-y:auto;">
          <table>
            <thead>
              <tr><th>#</th><th>Tên buổi học</th><th>Ngày</th><th>Trạng thái</th><th>Ghi chú</th></tr>
            </thead>
            <tbody>
              ${attendanceList.map((a, i) => {
                const sess = DB.findById("sessions", a.sessionId);
                const badgeCls = a.status === "present" ? "active" : a.status === "late" ? "late" : "closed";
                return `
                  <tr>
                    <td>${i + 1}</td>
                    <td><strong>${escapeHtml(sess?.title || 'Buổi học')}</strong></td>
                    <td>${formatDate(sess?.date || '')}</td>
                    <td><span class="badge ${badgeCls}">${ATTENDANCE_LABELS[a.status] || a.status}</span></td>
                    <td>${escapeHtml(a.note || '—')}</td>
                  </tr>`;
              }).join("") || `<tr><td colspan="5" class="muted" style="text-align:center;">Chưa có dữ liệu điểm danh.</td></tr>`}
            </tbody>
          </table>
        </div>`,
      foot: `<button class="btn btn-primary" data-close>Đóng</button>`,
    });
  });

  // 5. Chi tiết thông báo
  el.querySelector("#btn-detail-parent-notifications")?.addEventListener("click", () => {
    openModal({
      title: "Tất cả Thông báo & Cập nhật từ Trung tâm",
      size: "modal-lg",
      body: `
        <div style="display:flex;flex-direction:column;gap:10px;max-height:420px;overflow-y:auto;">
          ${notifications.map((n) => `
            <div style="padding:12px;border:1px solid var(--line);border-radius:10px;background:#faf9fe;">
              <strong style="display:block;font-size:14px;color:var(--brand-ink);">${escapeHtml(n.title)}</strong>
              <p style="margin:4px 0 0;font-size:13px;color:#4b4668;">${escapeHtml(n.message)}</p>
            </div>
          `).join("") || `<div class="empty">Không có thông báo nào.</div>`}
        </div>`,
      foot: `<button class="btn btn-primary" data-close>Đóng</button>`,
    });
  });

  // 6. Chi tiết tài liệu
  el.querySelector("#btn-detail-parent-materials")?.addEventListener("click", () => {
    openModal({
      title: "Thư viện Tài liệu Các môn Con đang học",
      size: "modal-lg",
      body: `
        <div style="display:flex;flex-direction:column;gap:10px;max-height:420px;overflow-y:auto;">
          ${allMaterials.map((m) => `
            <div class="material-file-card">
              <div>
                <strong>${escapeHtml(m.fileName)}</strong>
                <span class="muted" style="font-size:12px;display:block;">${escapeHtml(m.className)} · Buổi: ${escapeHtml(m.sessionTitle || '')}</span>
              </div>
              <div>${materialLink(m)}</div>
            </div>
          `).join("") || `<div class="empty">Chưa có tài liệu nào.</div>`}
        </div>`,
      foot: `<button class="btn btn-primary" data-close>Đóng</button>`,
    });
  });
}

function setupParentActions(el, parent, student) {
  // Phụ huynh duyệt / từ chối yêu cầu hủy môn của con
  el.querySelectorAll("[data-p-decide]").forEach((btn) =>
    btn.addEventListener("click", () => {
      const requestId = btn.dataset.pDecide;
      const decision = btn.dataset.action; // "approved" hoặc "rejected"
      try {
        decideCancelRequest(requestId, decision);
        renderParentOverviewPage(el, parent, student);
        flash(
          el,
          decision === "approved"
            ? "Đã đồng ý hủy môn học theo yêu cầu của con."
            : "Đã từ chối yêu cầu hủy môn học của con."
        );
      } catch (e) {
        flash(el, e.message, "error");
      }
    })
  );
}
