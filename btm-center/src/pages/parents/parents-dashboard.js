// pages/parents/parents-dashboard.js — Dashboard phụ huynh.
// Phụ huynh CHỈ xem được dữ liệu của đúng học sinh đã liên kết qua mã học sinh.
// 3 trường dữ liệu: Lịch học của con (lịch dạng calendar) · Bảng điểm & Nhận xét theo môn · Thông báo.
// Không sao chép, không tự đăng ký/hủy lớp: mọi thứ đọc chung entity với học sinh
// (enrollments / sessions / attendance / grades / comments / materials) theo studentId.

import { Session } from "../../core/session.js";
import { renderShell, ICONS, formatSchedule } from "../shell.js";
import { getLinkedStudent } from "../../modules/parents/parents.service.js";
import { escapeHtml } from "../../core/html.js";
import {
  buildStudentNotifications,
  decideCancelRequest,
} from "../../modules/notifications/notifications.service.js";
import { getStudentOverview } from "../../modules/dashboard/dashboard.service.js";
import { listAttendanceBySession } from "../../modules/sessions/sessions.service.js";
import { listGradesByStudentInClass } from "../../modules/grades/grades.service.js";
import { listCommentsByStudent } from "../../modules/comments/comments.service.js";
import { listMaterialsBySession } from "../../modules/materials/materials.service.js";
import { listUsers } from "../../modules/users/users.service.js";
import {
  subjectLabel,
  formatDate,
  todayStr,
  GRADE_TYPES,
  WEEKDAYS,
  ATTENDANCE_LABELS,
} from "../../data/constants.js";

const statCard = (icon, value, label) => `
  <div class="stat-card">
    <span class="stat-icon">${icon}</span>
    <div>
      <div class="stat-value">${value}</div>
      <div class="stat-label">${label}</div>
    </div>
  </div>`;

const materialLink = (m) => {
  const isUrl = String(m.fileData).startsWith("http");
  const target = isUrl
    ? m.fileData
    : m.fileData.startsWith("data:")
      ? m.fileData
      : `data:text/plain;charset=utf-8,${encodeURIComponent(m.fileData || "")}`;
  return isUrl
    ? `<a class="btn btn-sm" href="${target}" target="_blank" rel="noopener">${ICONS.download} Mở</a>`
    : `<a class="btn btn-sm" href="${target}" download="${m.fileName}">${ICONS.download} Tải về</a>`;
};

const attBadge = (sessionId, studentId) => {
  const rec = listAttendanceBySession(sessionId).find((a) => a.studentId === studentId);
  if (!rec) return `<span class="badge inactive">Chưa điểm danh</span>`;
  const cls = rec.status === "present" ? "active" : rec.status === "late" ? "late" : "closed";
  return `<span class="badge ${cls}">${ATTENDANCE_LABELS[rec.status]}</span>`;
};

// ------------------------------------------------------------------ tiện ích ngày
const pad2 = (n) => String(n).padStart(2, "0");

function parseIso(iso) {
  const [y, m, d] = String(iso).split("-").map(Number);
  return new Date(y, m - 1, d);
}

const toIso = (date) =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

// dayOfWeek theo WEEKDAYS: Thứ 2 = 2 … Thứ 7 = 7, Chủ nhật = 8.
const dayOfWeekOf = (date) => (date.getDay() === 0 ? 8 : date.getDay() + 1);

const weekdayLabel = (date) =>
  WEEKDAYS.find((w) => w.value === dayOfWeekOf(date))?.label || "";

// Khung 6 tuần (42 ô) bắt đầu từ Thứ 2 của tháng cần hiển thị.
function monthCells(year, month) {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7; // thứ 2 = đầu tuần
  const start = new Date(year, month, 1 - offset);
  return Array.from({ length: 42 }, (_, i) =>
    new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)
  );
}

// Khung giờ (start–end) của lớp cho một ngày cụ thể, khớp theo ngày trong tuần.
function slotOfClass(cls, iso) {
  const dow = dayOfWeekOf(parseIso(iso));
  return (cls.schedule || []).find((s) => s.dayOfWeek === dow) || null;
}

function teacherName(teacherId) {
  if (!teacherId) return "Chưa phân công";
  return listUsers("teacher").find((u) => u.id === teacherId)?.fullName || "—";
}

export function renderParentsDashboard(container) {
  const parent = Session.getCurrentUser();
  const student = getLinkedStudent(parent.id);
  const ctx = {
    parent,
    student,
    d: student ? getStudentOverview(student.id) : null,
  };

  const tabs = [
    { id: "schedule", label: "Lịch học của con", icon: ICONS.calendar, active: true, render: renderSchedule },
    { id: "grades", label: "Bảng điểm & Nhận xét", icon: ICONS.school, active: false, render: renderGrades },
    { id: "notices", label: "Thông báo", icon: ICONS.bell, active: false, render: renderNotices },
  ];

  renderShell(container, { title: "Lịch học của con", items: tabs });
  const content = container.querySelector("#tab-content");

  container
    .querySelectorAll(".nav-item[data-tab]")
    .forEach((btn) => btn.addEventListener("click", () => switchTab(btn.dataset.tab)));

  function switchTab(id) {
    container
      .querySelectorAll(".nav-item[data-tab]")
      .forEach((b) => b.classList.toggle("active", b.dataset.tab === id));
    container.querySelector("#page-title").textContent = tabs.find((t) => t.id === id).label;
    tabs.find((t) => t.id === id).render(content, ctx, switchTab);
  }

  if (!ctx.d) {
    content.innerHTML = `<div class="empty panel">Tài khoản phụ huynh chưa liên kết với học sinh nào. Vui lòng liên hệ giáo viên hoặc quản trị viên để được liên kết lại.</div>`;
    return;
  }

  switchTab("schedule");
}

// ------------------------------------------------------------------ trường lịch học của con
// Lịch dạng calendar theo tháng: mỗi ngày có buổi học là một ô bấm được,
// bấm vào để xem chi tiết: giáo viên giảng dạy + giờ bắt đầu / kết thúc buổi học.
function renderSchedule(el, ctx) {
  const { student, d } = ctx;
  const now = new Date();
  const today = todayStr();

  // Ghép toàn bộ buổi học của các lớp con đang học theo ngày.
  const byDate = new Map();
  d.myClasses.forEach((c) => {
    (c.sessions || []).forEach((s) => {
      if (!byDate.has(s.date)) byDate.set(s.date, []);
      byDate.get(s.date).push({ cls: c, session: s });
    });
  });
  byDate.forEach((list) =>
    list.sort((a, b) => {
      const start = (it) => slotOfClass(it.cls, it.session.date)?.start || "99:99";
      return start(a).localeCompare(start(b));
    })
  );

  const cal =
    ctx.cal ||
    (ctx.cal = {
      y: now.getFullYear(),
      m: now.getMonth(),
      selected: byDate.has(today) ? today : null,
    });

  const monthLabel = `Tháng ${cal.m + 1}/${cal.y}`;
  const cells = monthCells(cal.y, cal.m);

  const cellHtml = cells
    .map((date) => {
      const iso = toIso(date);
      const items = byDate.get(iso) || [];
      const cls = ["cal-cell"];
      if (date.getMonth() !== cal.m) cls.push("cal-out");
      if (items.length) cls.push("cal-has");
      if (iso === today) cls.push("cal-today");
      if (iso === cal.selected) cls.push("cal-selected");

      const chips = items
        .slice(0, 2)
        .map((it) => {
          const slot = slotOfClass(it.cls, iso);
          return `<span class="cal-chip">${subjectLabel(it.cls.subject)}${slot ? ` ${slot.start}` : ""}</span>`;
        })
        .join("");
      const more =
        items.length > 2 ? `<span class="cal-more">+${items.length - 2} buổi</span>` : "";
      const inner = `<span class="cal-num">${date.getDate()}</span>${chips}${more}`;

      return items.length
        ? `<button type="button" class="${cls.join(" ")}" data-day="${iso}" title="${formatDate(iso)}">${inner}</button>`
        : `<div class="${cls.join(" ")}">${inner}</div>`;
    })
    .join("");

  const dayItems = cal.selected ? byDate.get(cal.selected) || [] : [];
  const detail = !cal.selected
    ? `<div class="panel"><div class="empty">Bấm vào một ngày có lịch học trên lịch để xem chi tiết buổi học.</div></div>`
    : dayItems.length
      ? `<div class="panel cal-detail">
          <div class="panel-head">
            <h2 class="panel-title">Chi tiết buổi học — ${weekdayLabel(parseIso(cal.selected))}, ${formatDate(cal.selected)}</h2>
            <span class="count-chip">${dayItems.length} buổi</span>
          </div>
          ${dayItems.map(({ cls, session: s }) => daySessionRow(cls, s, cal.selected, student.id)).join("")}
        </div>`
      : `<div class="panel cal-detail"><div class="empty">Ngày ${formatDate(cal.selected)} không có buổi học nào.</div></div>`;

  el.innerHTML = `
    <div class="panel cal-panel">
      <div class="cal-head">
        <div>
          <h2 class="cal-title">${monthLabel}</h2>
          <p class="cal-hint">Bấm vào ngày có lịch học để xem chi tiết: giáo viên giảng dạy và giờ bắt đầu – kết thúc.</p>
        </div>
        <div class="cal-nav">
          <button type="button" class="icon-btn" data-cal="prev" title="Tháng trước">${ICONS.back}</button>
          <button type="button" class="btn btn-sm" data-cal="today">Hôm nay</button>
          <button type="button" class="icon-btn cal-next" data-cal="next" title="Tháng sau">${ICONS.back}</button>
        </div>
      </div>
      <div class="cal-grid">
        ${WEEKDAYS.map((w) => `<div class="cal-dow">${w.label}</div>`).join("")}
        ${cellHtml}
      </div>
    </div>

    ${detail}

    <div class="section-title">Lịch học hằng tuần của các lớp</div>
    ${
      d.myClasses.length
        ? `<div class="panel">${d.myClasses.map(weekRow).join("")}</div>`
        : `<div class="empty panel">Học sinh chưa đăng ký lớp nào.</div>`
    }
  `;

  const move = (delta) => {
    const d0 = new Date(cal.y, cal.m + delta, 1);
    cal.y = d0.getFullYear();
    cal.m = d0.getMonth();
    cal.selected = null;
    renderSchedule(el, ctx);
  };

  el.querySelector('[data-cal="prev"]').addEventListener("click", () => move(-1));
  el.querySelector('[data-cal="next"]').addEventListener("click", () => move(1));
  el.querySelector('[data-cal="today"]').addEventListener("click", () => {
    cal.y = now.getFullYear();
    cal.m = now.getMonth();
    cal.selected = byDate.has(today) ? today : null;
    renderSchedule(el, ctx);
  });

  el.querySelectorAll("[data-day]").forEach((btn) =>
    btn.addEventListener("click", () => {
      cal.selected = btn.dataset.day;
      renderSchedule(el, ctx);
    })
  );
}

// Chi tiết một buổi học trong ngày: tên giáo viên + giờ bắt đầu/kết thúc.
function daySessionRow(cls, session, iso, studentId) {
  const slot = slotOfClass(cls, iso);
  const mats = listMaterialsBySession(session.id);
  return `
    <div class="row-item">
      <div>
        <strong class="row-title">
          <span class="badge subject">${subjectLabel(cls.subject)}</span>
          ${cls.className} · ${escapeHtml(session.title || "Buổi học")}
        </strong>
        <span class="row-sub">Giáo viên: <b>${teacherName(cls.teacherId)}</b></span>
        <span class="row-sub">Thời gian: ${slot ? `${slot.start} – ${slot.end}` : "Chưa cập nhật"}</span>
        ${
          mats.length
            ? `<div class="day-mats">${mats
                .map(
                  (m) =>
                    `<span class="mat-chip">${ICONS.paperclip} ${m.fileName} ${materialLink(m)}</span>`
                )
                .join("")}</div>`
            : ""
        }
      </div>
      <span class="row-end day-end">
        ${attBadge(session.id, studentId)}
        <span class="muted">${iso >= todayStr() ? "Sắp tới" : "Đã diễn ra"}</span>
      </span>
    </div>`;
}

const weekRow = (c) => `
  <div class="row-item">
    <div>
      <strong class="row-title">
        <span class="badge subject">${subjectLabel(c.subject)}</span>
        ${c.className}
      </strong>
      <span class="row-sub">${formatSchedule(c.schedule)}</span>
    </div>
    <span class="row-end muted">GV: ${teacherName(c.teacherId)}</span>
  </div>`;

// ------------------------------------------------------------------ trường bảng điểm & nhận xét
// Bảng điểm và nhận xét của giáo viên được gộp theo từng môn (từng lớp),
// kèm điểm trung bình của từng môn và trung bình chung.
function renderGrades(el, ctx) {
  const { student, d } = ctx;

  const blocks = d.myClasses.map((c) => {
    const grades = listGradesByStudentInClass(c.id, student.id)
      .slice()
      .sort(
        (a, b) =>
          GRADE_TYPES.indexOf(a.type) - GRADE_TYPES.indexOf(b.type) ||
          String(a.id).localeCompare(String(b.id))
      );
    const comments = listCommentsByStudent(c.id, student.id)
      .slice()
      .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
    const avg = grades.length
      ? grades.reduce((s, g) => s + Number(g.score || 0), 0) / grades.length
      : null;
    return { cls: c, grades, comments, avg };
  });

  const allGrades = blocks.flatMap((b) => b.grades);
  const overall = allGrades.length
    ? allGrades.reduce((s, g) => s + Number(g.score || 0), 0) / allGrades.length
    : null;
  const commentCount = blocks.reduce((n, b) => n + b.comments.length, 0);

  el.innerHTML = `
    <div class="stat-grid">
      ${statCard(ICONS.classes, blocks.length, "Môn đang học")}
      ${statCard(ICONS.edit, allGrades.length, "Bài đã có điểm")}
      ${statCard(ICONS.school, overall === null ? "—" : overall.toFixed(1), "Điểm trung bình chung")}
    </div>

    <div class="section-title">Bảng điểm & nhận xét theo môn (${blocks.length} môn)</div>
    ${
      blocks.length
        ? blocks.map(gradeBlock).join("")
        : `<div class="empty panel">Học sinh chưa đăng ký lớp nào.</div>`
    }
    ${commentCount === 0 && blocks.length ? `<p class="hint-sm">Chưa có nhận xét nào từ giáo viên.</p>` : ""}
  `;
}

const gradeBlock = ({ cls, grades, comments, avg }) => `
  <div class="subject-block">
    <div class="subject-head">
      <div class="detail-title">
        <span class="badge subject">${subjectLabel(cls.subject)}</span>
        <h3 class="detail-name">${cls.className}</h3>
        <span class="subject-teacher">GV: ${teacherName(cls.teacherId)}</span>
      </div>
      <span class="count-chip">${
        avg !== null
          ? `Điểm TB: ${avg.toFixed(1)} · ${grades.length} bài`
          : "Chưa có điểm"
      }</span>
    </div>

    <div class="split">
      <div class="panel">
        <div class="panel-head"><h4 class="panel-title">Bảng điểm</h4></div>
        ${
          grades.length
            ? `<div class="table-wrap"><table>
                <thead><tr><th>Loại</th><th>Điểm</th><th>Ghi chú</th></tr></thead>
                <tbody>${grades
                  .map(
                    (g) => `
                      <tr>
                        <td>${g.type}</td>
                        <td><strong>${g.score}</strong></td>
                        <td class="muted">${escapeHtml(g.note || "—")}</td>
                      </tr>`
                  )
                  .join("")}</tbody>
              </table></div>`
            : `<div class="empty">Chưa có điểm cho môn này. Điểm số sẽ hiển thị ngay khi giáo viên nhập.</div>`
        }
      </div>

      <div class="panel">
        <div class="panel-head">
          <h4 class="panel-title">Nhận xét của giáo viên</h4>
          <span class="count-chip">${comments.length} nhận xét</span>
        </div>
        <div class="comment-list">
          ${
            comments.length
              ? comments
                  .map(
                    (cm) => `
                    <div class="comment-item">
                      <span class="comment-head">
                        <b>${teacherName(cm.teacherId || cls.teacherId)}</b>
                        <small>${formatDate(String(cm.createdAt || "").slice(0, 10))}</small>
                      </span>
                      <p>${escapeHtml(cm.content)}</p>
                    </div>`
                  )
                  .join("")
              : `<div class="empty">Chưa có nhận xét nào cho môn này.</div>`
          }
        </div>
      </div>
    </div>
  </div>`;

// ------------------------------------------------------------------ trường thông báo
// Nguồn dữ liệu:
//  - Điểm danh: dựng lại từ btm_attendance (giáo viên ghi) → không nhân bản.
//  - Yêu cầu hủy môn: đọc btm_cancel_requests (học sinh gửi) → phụ huynh duyệt.
function renderNotices(el, ctx) {
  const { student } = ctx;
  const notices = buildStudentNotifications(student.id);
  const pending = notices.filter(
    (n) => n.kind === "cancel-request" && n.request.status === "pending"
  );

  el.innerHTML = `
    <div class="panel notice-head">
      <div>
        <h2 class="panel-title">Thông báo dành cho phụ huynh</h2>
        <p class="notice-sub">
          Điểm danh lấy trực tiếp từ dữ liệu giáo viên vừa lưu — bấm “Làm mới” để cập nhật.
        </p>
      </div>
      <button class="btn btn-sm" data-refresh>${ICONS.refresh} Làm mới</button>
    </div>

    <p id="notice-msg" class="form-error" role="alert" hidden></p>

    ${
      pending.length
        ? `<div class="notice-alert danger">
             <strong>Cần bạn xác nhận:</strong> ${pending.length} yêu cầu hủy môn đang chờ phản hồi.
           </div>`
        : ""
    }

    ${
      notices.length
        ? `<div class="notice-list">${notices.map(noticeCard).join("")}</div>`
        : `<div class="empty panel">Chưa có thông báo nào. Thông báo sẽ xuất hiện khi giáo viên điểm danh hoặc con bạn gửi yêu cầu hủy môn.</div>`
    }
  `;

  const msgBox = el.querySelector("#notice-msg");
  const flash = (msg) => {
    msgBox.textContent = msg;
    msgBox.hidden = false;
    setTimeout(() => (msgBox.hidden = true), 3500);
  };

  // Nút "Làm mới": đọc lại localStorage và vẽ lại trường thông báo.
  // Cập nhật luôn ctx.d để các tab khác không dùng dữ liệu cũ.
  el.querySelector("[data-refresh]").addEventListener("click", () => {
    ctx.d = getStudentOverview(student.id);
    renderNotices(el, ctx);
  });

  el.querySelectorAll("[data-decide]").forEach((btn) =>
    btn.addEventListener("click", () => {
      try {
        decideCancelRequest(btn.dataset.decide, btn.dataset.decision);
        // Vẽ lại để thấy ngay: môn đã bị hủy (đồng ý) hoặc giữ nguyên (từ chối),
        // và để các tab khác cũng bỏ môn đã hủy khỏi danh sách.
        ctx.d = getStudentOverview(student.id);
        renderNotices(el, ctx);
      } catch (err) {
        flash(err.message);
      }
    })
  );
}

function noticeCard(n) {
  const pendingRequest = n.kind === "cancel-request" && n.request.status === "pending";
  return `
    <div class="notice-item ${n.tone}">
      <span class="notice-icon">${n.icon}</span>
      <div class="notice-body">
        <div class="notice-title">${escapeHtml(n.title)}</div>
        <p class="notice-text">${escapeHtml(n.message)}</p>
        <div class="notice-meta">${n.kind === "attendance" ? "Điểm danh" : "Yêu cầu hủy môn"} · ${formatDate(n.when)}</div>
        ${n.blockedReason ? `<p class="notice-warn">${escapeHtml(n.blockedReason)}</p>` : ""}
        ${
          pendingRequest
            ? `<div class="notice-actions">
                 ${
                   n.canApprove
                     ? `<button class="btn btn-sm btn-danger" data-decide="${n.request.id}" data-decision="approved">
                          ${ICONS.check} Đồng ý hủy môn
                        </button>`
                     : `<button class="btn btn-sm btn-danger" disabled title="Lớp đã có buổi học — không thể hủy">${ICONS.check} Đồng ý hủy môn</button>`
                 }
                 <button class="btn btn-sm" data-decide="${n.request.id}" data-decision="rejected">
                   ${ICONS.close} Không đồng ý
                 </button>
               </div>`
            : ""
        }
      </div>
    </div>`;
}
