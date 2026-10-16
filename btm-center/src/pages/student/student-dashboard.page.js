// pages/student/student-dashboard.page.js — Phụ trách: Thành viên A/C
// Lịch học (overview + chi tiết lớp: buổi học, tài liệu, điểm, nhận xét) · Đăng ký lớp
import { Session } from "../../core/session.js";
import { escapeHtml } from "../../core/html.js";
import { renderShell, ICONS, formatSchedule } from "../shell.js";
import { getStudentOverview } from "../../modules/dashboard/dashboard.service.js";
import {
  enroll,
} from "../../modules/enrollment/enrollment.service.js";
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
import { listUsers } from "../../modules/users/users.service.js";
import {
  SUBJECTS,
  subjectLabel,
  formatDate,
  todayStr,
  ATTENDANCE_LABELS,
  WEEKDAYS,
} from "../../data/constants.js";

const genderBadge = (u) => {
  const g = String(u.gender || "").toLowerCase();
  if (g.startsWith("nữ") || g.startsWith("nam")) {
    const female = g.startsWith("nữ");
    return `<span class="badge ${female ? "gender-female" : "gender-male"}">${female ? "Nữ" : "Nam"}</span>`;
  }
  return `<span class="muted">—</span>`;
};

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
  const target = isUrl ? m.fileData : m.fileData.startsWith("data:") ? m.fileData : `data:text/plain;charset=utf-8,${encodeURIComponent(m.fileData || "")}`;
  return isUrl
    ? `<a class="btn btn-sm" href="${target}" target="_blank" rel="noopener">${ICONS.download} Mở</a>`
    : `<a class="btn btn-sm" href="${target}" download="${m.fileName}">${ICONS.download} Tải về</a>`;
};

const myAttBadge = (sessionId, studentId) => {
  const rec = listAttendanceBySession(sessionId).find((a) => a.studentId === studentId);
  if (!rec) return `<span class="badge inactive">Chưa điểm danh</span>`;
  const cls = rec.status === "present" ? "active" : rec.status === "late" ? "late" : "closed";
  return `<span class="badge ${cls}">${ATTENDANCE_LABELS[rec.status]}</span>`;
};

const pad2 = (n) => String(n).padStart(2, "0");
const toIso = (date) =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
const parseIso = (iso) => {
  const [year, month, day] = String(iso).split("-").map(Number);
  return new Date(year, month - 1, day);
};
const dayOfWeekOf = (date) => (date.getDay() === 0 ? 8 : date.getDay() + 1);
const weekdayLabel = (date) =>
  WEEKDAYS.find((weekday) => weekday.value === dayOfWeekOf(date))?.label || "";

function monthCells(year, month) {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - offset);
  return Array.from(
    { length: 42 },
    (_, index) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + index)
  );
}

function slotOfClass(cls, iso) {
  const dayOfWeek = dayOfWeekOf(parseIso(iso));
  return (cls.schedule || []).find((slot) => slot.dayOfWeek === dayOfWeek) || null;
}

function renderStudentCalendar(el, classes, studentId, calendar) {
  const today = todayStr();
  const byDate = new Map();
  classes.forEach((cls) => {
    (cls.sessions || []).forEach((session) => {
      if (!byDate.has(session.date)) byDate.set(session.date, []);
      byDate.get(session.date).push({ cls, session });
    });
  });

  byDate.forEach((items) =>
    items.sort((a, b) => {
      const startTime = (item) => slotOfClass(item.cls, item.session.date)?.start || "99:99";
      return startTime(a).localeCompare(startTime(b));
    })
  );

  const cells = monthCells(calendar.y, calendar.m);
  const hasSessionsThisMonth = cells.some(
    (date) => date.getMonth() === calendar.m && byDate.has(toIso(date))
  );
  const cellHtml = cells
    .map((date) => {
      const iso = toIso(date);
      const items = byDate.get(iso) || [];
      const cellClasses = ["cal-cell"];
      if (date.getMonth() !== calendar.m) cellClasses.push("cal-out");
      if (items.length) cellClasses.push("cal-has");
      if (iso === today) cellClasses.push("cal-today");

      const chips = items
        .map((item) => {
          const slot = slotOfClass(item.cls, iso);
          const subject = subjectLabel(item.cls.subject);
          const time = slot ? ` ${slot.start}` : "";
          return `<button type="button" class="student-cal-chip" data-session-id="${escapeHtml(item.session.id)}" data-day="${iso}" title="Xem chi tiết: ${escapeHtml(item.cls.className)} · ${escapeHtml(subject)}${slot ? ` (${escapeHtml(slot.start)} – ${escapeHtml(slot.end)})` : ""}">
            ${escapeHtml(subject)}${escapeHtml(time)}
          </button>`;
        })
        .join("");

      return `<div class="${cellClasses.join(" ")}" data-day="${iso}">
        <span class="cal-num">${date.getDate()}</span>${chips}
      </div>`;
    })
    .join("");

  el.innerHTML = `
    <div class="panel cal-panel">
      <div class="cal-head">
        <div>
          <h2 class="cal-title">Tháng ${calendar.m + 1}/${calendar.y}</h2>
          <p class="cal-hint">Chọn buổi học để xem môn học, lớp, giáo viên và thời gian.</p>
        </div>
        <div class="cal-nav">
          <button type="button" class="icon-btn" data-cal="prev" title="Tháng trước" aria-label="Tháng trước">${ICONS.back}</button>
          <button type="button" class="btn btn-sm" data-cal="today">Hôm nay</button>
          <button type="button" class="icon-btn cal-next" data-cal="next" title="Tháng sau" aria-label="Tháng sau">${ICONS.back}</button>
        </div>
      </div>
      <div class="cal-grid">
        ${WEEKDAYS.map((weekday) => `<div class="cal-dow">${weekday.label}</div>`).join("")}
        ${cellHtml}
      </div>
      ${
        hasSessionsThisMonth
          ? ""
          : `<div class="empty student-calendar-empty">${
              byDate.size
                ? "Tháng này chưa có buổi học nào."
                : "Bạn hiện chưa có buổi học nào được xếp lịch."
            }</div>`
      }
    </div>
  `;

  const move = (delta) => {
    const next = new Date(calendar.y, calendar.m + delta, 1);
    calendar.y = next.getFullYear();
    calendar.m = next.getMonth();
    renderStudentCalendar(el, classes, studentId, calendar);
  };
  el.querySelector('[data-cal="prev"]').addEventListener("click", () => move(-1));
  el.querySelector('[data-cal="next"]').addEventListener("click", () => move(1));
  el.querySelector('[data-cal="today"]').addEventListener("click", () => {
    const now = new Date();
    calendar.y = now.getFullYear();
    calendar.m = now.getMonth();
    renderStudentCalendar(el, classes, studentId, calendar);
  });

  el.querySelectorAll(".student-cal-chip").forEach((button) => {
    button.addEventListener("click", () => {
      const items = byDate.get(button.dataset.day) || [];
      const item = items.find((entry) => entry.session.id === button.dataset.sessionId);
      if (item) showStudentSessionModal(item.cls, item.session, button.dataset.day, studentId);
    });
  });
}

function showStudentSessionModal(cls, session, iso, studentId) {
  document.getElementById("student-session-detail-modal")?.remove();

  const slot = slotOfClass(cls, iso);
  const teacher = listUsers("teacher").find((user) => user.id === cls.teacherId);
  const attendance = listAttendanceBySession(session.id).find(
    (record) => record.studentId === studentId
  );
  const room = session.room || cls.room;
  const infoRow = (label, value) =>
    `<div class="modal-info"><span class="k">${label}</span><span class="v">${value}</span></div>`;
  const modalHtml = `
    <div id="student-session-detail-modal" class="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="student-session-modal-title">
      <div class="modal">
        <div class="modal-head">
          <h2 class="modal-title" id="student-session-modal-title">Chi tiết buổi học</h2>
          <button type="button" class="icon-btn" data-modal-close aria-label="Đóng">${ICONS.close}</button>
        </div>
        <div class="modal-body">
          ${infoRow("Môn học", escapeHtml(subjectLabel(cls.subject)))}
          ${infoRow("Lớp học", escapeHtml(cls.className))}
          ${infoRow("Nội dung", escapeHtml(session.title || "Buổi học"))}
          ${infoRow("Ngày học", `${weekdayLabel(parseIso(iso))}, ${formatDate(iso)}`)}
          ${infoRow("Thời gian", slot ? `${escapeHtml(slot.start)} – ${escapeHtml(slot.end)}` : "Chưa cập nhật khung giờ")}
          ${room ? infoRow("Phòng học", escapeHtml(room)) : ""}
          ${infoRow("Giáo viên", escapeHtml(teacher?.fullName || "Chưa phân công"))}
          ${infoRow("Điểm danh", attendance ? escapeHtml(ATTENDANCE_LABELS[attendance.status] || "Chưa cập nhật") : "Chưa điểm danh")}
        </div>
        <div class="modal-foot"><button type="button" class="btn btn-primary" data-modal-close>Đóng</button></div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML("beforeend", modalHtml);

  const modal = document.getElementById("student-session-detail-modal");
  const close = () => {
    modal.remove();
    document.removeEventListener("keydown", onKeyDown);
  };
  const onKeyDown = (event) => {
    if (event.key === "Escape") close();
  };
  document.addEventListener("keydown", onKeyDown);
  modal.querySelectorAll("[data-modal-close]").forEach((button) =>
    button.addEventListener("click", close)
  );
  modal.addEventListener("click", (event) => {
    if (event.target === modal) close();
  });
}

export function renderStudentDashboard(container) {
  const student = Session.getCurrentUser();
  const now = new Date();
  const calendar = { y: now.getFullYear(), m: now.getMonth() };

  const tabs = [
    {
      id: "overview",
      label: "Lịch học",
      icon: ICONS.calendar,
      active: true,
      render: (el, currentStudent) => renderOverview(el, currentStudent, calendar),
    },
    { id: "enroll", label: "Đăng ký lớp", icon: ICONS.classes, active: false, render: renderEnroll },
  ];

  renderShell(container, { title: "Lịch học", items: tabs });
  const content = container.querySelector("#tab-content");

  container
    .querySelectorAll(".nav-item[data-tab]")
    .forEach((btn) =>
      btn.addEventListener("click", () => switchTab(btn.dataset.tab))
    );

  function switchTab(id) {
    container
      .querySelectorAll(".nav-item[data-tab]")
      .forEach((b) => b.classList.toggle("active", b.dataset.tab === id));
    container.querySelector("#page-title").textContent = tabs.find((t) => t.id === id).label;
    tabs.find((t) => t.id === id).render(content, student);
  }

  switchTab("overview");
}

function renderOverview(el, student, calendar) {
  let d;
  try {
    d = getStudentOverview(student.id);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    el.innerHTML = `<p class="form-error" role="alert">Không thể tải lịch học: ${escapeHtml(message)}. Vui lòng tải lại trang.</p>`;
    return;
  }

  const flash = (msg) => {
    let box = el.querySelector("#overview-msg");
    box.textContent = msg;
    box.hidden = false;
    setTimeout(() => (box.hidden = true), 2500);
  };

  el.innerHTML = `
    <div class="welcome-banner">
      <div>
        <h2 class="welcome-title">Xin chào, ${student.fullName}!</h2>
        <p class="welcome-sub">Bạn đang theo học ${d.myClasses.length} lớp trong trung tâm.</p>
        <p class="welcome-sub">Mã học sinh: <strong>${student.id}</strong> — phụ huynh dùng mã này để liên kết tài khoản phụ huynh.</p>
      </div>
      <span class="badge student">Học sinh</span>
    </div>

    <div class="stat-grid">
      ${statCard(ICONS.classes, d.myClasses.length, "Lớp đang học")}
      ${statCard(ICONS.school, d.openClasses.length, "Lớp đang mở")}
    </div>

    <p id="overview-msg" class="form-error" role="alert" hidden></p>
    <div class="section-title">Lịch học của tôi</div>
    <div id="student-calendar"></div>
    <div class="section-title">Các lớp đang theo học</div>
    ${
      d.myClasses.length
        ? `<div class="class-grid">${d.myClasses.map((c) => myClassCard(c, student.id)).join("")}</div>`
        : `<div class="empty panel">Bạn chưa đăng ký lớp nào. Hãy vào mục “Đăng ký lớp” để bắt đầu.</div>`
    }

    <div class="section-title">Bảng điểm của tôi</div>
    <div class="panel">
      ${(() => {
        const rows = d.myClasses
          .map((c) => ({ cls: c, grades: listGradesByStudentInClass(c.id, student.id) }))
          .filter((r) => r.grades.length);
        const total = rows.reduce((s, r) => s + r.grades.length, 0);
        const avg = total
          ? rows.reduce((s, r) => s + r.grades.reduce((ss, g) => ss + g.score, 0), 0) / total
          : null;
        return `
          <div class="panel-head">
            <h2 class="panel-title">Theo dõi điểm số</h2>
            <span class="count-chip">${total} cột điểm${avg !== null ? ` · TBC ${avg.toFixed(1)}` : ""}</span>
          </div>
          ${
            rows.length
              ? `<div class="table-wrap"><table>
                  <thead><tr><th>Lớp</th><th>Môn</th><th>Loại</th><th>Điểm</th><th>Ghi chú</th></tr></thead>
                  <tbody>${rows
                    .map(
                      (r) => r.grades.map(
                        (g) => `
                          <tr>
                            <td><strong>${r.cls.className}</strong></td>
                            <td><span class="badge subject">${subjectLabel(r.cls.subject)}</span></td>
                            <td>${g.type}</td>
                            <td><strong>${g.score}</strong></td>
                            <td class="muted">${g.note || "—"}</td>
                          </tr>`
                      ).join("")
                    )
                    .join("")}</tbody>
                </table></div>`
              : `<div class="empty">Bạn chưa có điểm nào. Điểm số sẽ hiển thị tại đây ngay khi giáo viên nhập.</div>`
          }`;
      })()}
    </div>
  `;

  renderStudentCalendar(el.querySelector("#student-calendar"), d.myClasses, student.id, calendar);

  el.querySelectorAll("[data-request-cancel]").forEach((btn) =>
    btn.addEventListener("click", () => {
      try {
        requestCancelClass(student.id, btn.dataset.requestCancel);
        renderOverview(el, student, calendar);
      } catch (err) {
        flash(err.message);
      }
    })
  );

  el.querySelectorAll("[data-detail]").forEach((btn) =>
    btn.addEventListener("click", () => {
      renderClassDetail(el, student, btn.dataset.detail, calendar);
    })
  );
}

function canCancel(classId) {
  return listSessionsByClass(classId).length === 0;
}

const myClassCard = (c, studentId) => {
  const cancellable = canCancel(c.id);
  const pending = getPendingRequest(studentId, c.id);
  const nextLabel = c.nextSession
    ? `Buổi tới: ${formatDate(c.nextSession.date)} · ${c.nextSession.title || "Chưa có tiêu đề"}`
    : "Chưa có buổi học nào";
  return `
  <div class="class-card">
    <div class="class-top">
      <span class="badge subject">${subjectLabel(c.subject)}</span>
      <span class="badge ${c.status === "open" ? "open" : "closed"}">${c.status === "open" ? "Đang mở" : "Đã đóng"}</span>
    </div>
    <div class="class-name">${c.className}</div>
    <div class="class-meta">
      <span>${ICONS.calendar} ${formatSchedule(c.schedule)}</span>
      <span>${ICONS.clock} ${nextLabel}</span>
      <span>${ICONS.users} Sĩ số: ${c.enrolled}/${c.maxSlot}</span>
    </div>
    <div class="class-actions">
      <button class="btn btn-sm btn-primary" data-detail="${c.id}">Xem chi tiết</button>
      ${
        pending
          ? `<span class="hint-sm">Đã gửi yêu cầu hủy — chờ phụ huynh xác nhận</span>`
          : cancellable
            ? `<button class="btn btn-sm btn-danger" data-request-cancel="${c.id}">Gửi yêu cầu hủy môn</button>`
            : `<span class="hint-sm">Đã có buổi học, không thể hủy</span>`
      }
    </div>
  </div>`;
};

function renderClassDetail(el, student, classId, calendar) {
  const cls = getClassById(classId);
  if (!cls) return renderOverview(el, student, calendar);

  const sessions = listSessionsByClass(classId).sort((a, b) => a.date.localeCompare(b.date));
  const grades = listGradesByStudentInClass(classId, student.id);
  const comments = listCommentsByStudent(classId, student.id);
  const studentNames = listStudentsOfClass(classId);

  el.innerHTML = `
    <div class="detail-head">
      <button class="btn btn-sm" data-back>${ICONS.back} Quay lại lịch học</button>
      <div class="detail-title">
        <h2 class="detail-name">${cls.className}</h2>
        <span class="badge subject">${subjectLabel(cls.subject)}</span>
        <span class="badge ${cls.status === "open" ? "open" : "closed"}">${cls.status === "open" ? "Đang mở" : "Đã đóng"}</span>
      </div>
    </div>

    <div class="info-grid">
      <div class="info-box"><span class="info-label">Lịch học</span><span>${formatSchedule(cls.schedule)}</span></div>
      <div class="info-box"><span class="info-label">Sĩ số</span><span>${studentNames.length}/${cls.maxSlot}</span></div>
      <div class="info-box"><span class="info-label">Số buổi đã tạo</span><span>${sessions.length}</span></div>
    </div>

    <div class="section-title">Bạn cùng lớp (${studentNames.length})</div>
    <div class="panel">
      ${
        studentNames.length
          ? `<div class="table-wrap"><table>
              <thead><tr><th>#</th><th>Họ tên</th><th>Giới tính</th><th>Tài khoản</th></tr></thead>
              <tbody>${studentNames
                .map(
                  (s, i) => `
                    <tr>
                      <td>${i + 1}</td>
                      <td><strong>${s.fullName}</strong>${s.id === student.id ? ` <span class="badge active">Bạn</span>` : ""}</td>
                      <td>${genderBadge(s)}</td>
                      <td class="muted">@${s.username}</td>
                    </tr>`
                )
                .join("")}</tbody>
            </table></div>`
          : `<div class="empty">Lớp chưa có học sinh nào.</div>`
      }
    </div>

    <div class="section-title">Buổi học & tài liệu (${sessions.length})</div>
    <div class="panel">
      ${
        sessions.length
          ? sessions
              .map(
                (s) => `
                  <div class="session-block">
                    <div class="row-item">
                      <div>
                        <strong class="row-title">${formatDate(s.date)} ${myAttBadge(s.id, student.id)}</strong>
                        <span class="row-sub">${s.title || "Buổi học"}</span>
                      </div>
                      <span class="muted">${s.date >= todayStr() ? "Sắp tới" : "Đã diễn ra"}</span>
                    </div>
                    ${(() => {
                      const mats = listMaterialsBySession(s.id);
                      return mats.length
                        ? `<div class="mat-list">${mats.map((m) => `<span class="mat-chip">${ICONS.paperclip} ${m.fileName} ${materialLink(m)}</span>`).join("")}</div>`
                        : `<div class="mat-empty">Buổi chưa có tài liệu</div>`;
                    })()}
                  </div>`
              )
              .join("")
          : `<div class="empty">Lớp chưa có buổi học nào.</div>`
      }
    </div>

    <div class="split mt-lg">
      <div class="panel">
        <div class="panel-head"><h2 class="panel-title">Điểm số của tôi</h2></div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Loại</th><th>Điểm</th><th>Ghi chú</th></tr></thead>
            <tbody>
              ${
                grades.length
                  ? grades.map((g) => `<tr><td>${g.type}</td><td><strong>${g.score}</strong></td><td class="muted">${g.note || "—"}</td></tr>`).join("")
                  : `<tr><td colspan="3" class="empty">Chưa có điểm</td></tr>`
              }
            </tbody>
          </table>
        </div>
      </div>

      <div class="panel">
        <div class="panel-head"><h2 class="panel-title">Nhận xét của giáo viên</h2></div>
        <div class="comment-list">
          ${
            comments.length
              ? comments
                  .map((cm) => `<div class="comment-item"><span class="comment-head"><b>Giáo viên</b><small>${formatDate(cm.createdAt ? cm.createdAt.slice(0, 10) : "")}</small></span><p>${cm.content}</p></div>`)
                  .join("")
              : `<div class="empty">Chưa có nhận xét nào.</div>`
          }
        </div>
      </div>
    </div>
  `;

  el.querySelector("[data-back]").addEventListener("click", () => {
    renderOverview(el, student, calendar);
  });
}

function renderEnroll(el, student) {
  const d = getStudentOverview(student.id);

  const flash = (msg) => {
    const box = el.querySelector("#enroll-message");
    box.textContent = msg;
    box.hidden = false;
    setTimeout(() => (box.hidden = true), 2500);
  };

  el.innerHTML = `
    <div class="panel mb-lg enroll-filter">
      <label class="enroll-filter-label">Lọc theo môn:</label>
      <select id="subject-filter">
        <option value="">Tất cả môn</option>
        ${SUBJECTS.map((s) => `<option value="${s}">${subjectLabel(s)}</option>`).join("")}
      </select>
    </div>

    <div class="section-title">Lớp đang mở để đăng ký</div>
    <p id="enroll-message" class="form-error" role="alert" hidden></p>
    <div id="open-class-wrap">
      ${renderOpenList(d.openClasses, "", student.id)}
    </div>
  `;

  el.querySelector("#subject-filter").addEventListener("change", (e) => {
    const filter = e.target.value;
    el.querySelector("#open-class-wrap").innerHTML = renderOpenList(d.openClasses, filter, student.id);
    bindOpenList(el, student);
  });

  bindOpenList(el, student);
}

function renderOpenList(classes, subject, studentId) {
  const list = subject ? classes.filter((c) => c.subject === subject) : classes;
  if (!list.length) {
    return `<div class="empty panel">Không có lớp phù hợp. Hãy thử lọc môn khác.</div>`;
  }
  return `<div class="class-grid">${list.map((c) => openClassCard(c, studentId)).join("")}</div>`;
}

function bindOpenList(el, student) {
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

  el.querySelectorAll("[data-request-cancel]").forEach((btn) =>
    btn.addEventListener("click", () => {
      try {
        requestCancelClass(student.id, btn.dataset.requestCancel);
        renderEnroll(el, student);
      } catch (err) {
        flash(err.message);
      }
    })
  );
}

const openClassCard = (c, studentId) => {
  const pending = getPendingRequest(studentId, c.id);
  return `
  <div class="class-card ${c.isEnrolled ? "enrolled" : ""}">
    <div class="class-top">
      <span class="badge subject">${subjectLabel(c.subject)}</span>
      ${c.isEnrolled ? `<span class="badge active">Đang học</span>` : `<span class="badge open">Còn chỗ</span>`}
    </div>
    <div class="class-name">${c.className}</div>
    <div class="class-meta">
      <span>${ICONS.calendar} ${formatSchedule(c.schedule)}</span>
      <span>${ICONS.users} Đã ghi danh: ${c.enrolled}/${c.maxSlot}</span>
    </div>
    <div class="class-actions">
      ${
        pending
          ? `<span class="hint-sm">Đã gửi yêu cầu hủy — chờ phụ huynh xác nhận</span>`
          : c.isEnrolled
            ? `<button class="btn btn-sm btn-danger" data-request-cancel="${c.id}">Gửi yêu cầu hủy môn</button>`
            : c.enrolled >= c.maxSlot
              ? `<button class="btn btn-sm" disabled>Đã đủ chỗ</button>`
              : `<button class="btn btn-sm btn-primary" data-enroll="${c.id}">Đăng ký</button>`
      }
    </div>
  </div>`;
};