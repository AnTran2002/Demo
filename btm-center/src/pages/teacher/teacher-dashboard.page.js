// pages/teacher/teacher-dashboard.page.js — Phụ trách: Thành viên A/B/C
// Tổng quan · Lịch giảng dạy · Quản lý lớp (buổi học, điểm danh, tài liệu, điểm, nhận xét)
import { Session } from "../../core/session.js";
import { renderShell, ICONS, formatSchedule } from "../shell.js";
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
} from "../../modules/sessions/sessions.service.js";
import { attachMaterial, listMaterialsBySession } from "../../modules/materials/materials.service.js";
import { addGrade, listGradesByClass } from "../../modules/grades/grades.service.js";
import { addComment, listCommentsByClass } from "../../modules/comments/comments.service.js";
import { DB } from "../../core/db.js";
import {
  WEEKDAYS,
  subjectLabel,
  formatDate,
  todayStr,
  ATTENDANCE_LABELS,
  GRADE_TYPES,
} from "../../data/constants.js";

const pct = (a, b) => Math.min(100, Math.round((a / (b || 1)) * 100));

const statCard = (icon, value, label) => `
  <div class="stat-card">
    <span class="stat-icon">${icon}</span>
    <div>
      <div class="stat-value">${value}</div>
      <div class="stat-label">${label}</div>
    </div>
  </div>`;

const attBadge = (sessionId) => {
  const info = sessionAttendanceInfo(sessionId);
  return info.done
    ? `<span class="badge active">Đã điểm danh</span>`
    : `<span class="badge inactive">Chưa điểm danh</span>`;
};

const materialLink = (m) => {
  const isUrl = String(m.fileData).startsWith("http");
  const target = isUrl ? m.fileData : m.fileData.startsWith("data:") ? m.fileData : `data:text/plain;charset=utf-8,${encodeURIComponent(m.fileData || "")}`;
  return isUrl
    ? `<a class="btn btn-sm" href="${target}" target="_blank" rel="noopener">${ICONS.download} Mở</a>`
    : `<a class="btn btn-sm" href="${target}" download="${m.fileName}">${ICONS.download} Tải về</a>`;
};

export function renderTeacherDashboard(container) {
  const teacher = Session.getCurrentUser();

  const tabs = [
    { id: "overview", label: "Tổng quan", icon: ICONS.grid, active: true, render: renderOverview },
    { id: "schedule", label: "Lịch giảng dạy", icon: ICONS.calendar, active: false, render: renderSchedule },
    { id: "classes", label: "Lớp của tôi", icon: ICONS.classes, active: false, render: goClassesTab },
  ];

  renderShell(container, { title: "Tổng quan", items: tabs });
  const content = container.querySelector("#tab-content");

  let subView = { name: "list", classId: null, sessionId: null };

  function goTab(name, classId, sessionId) {
    subView = { name, classId, sessionId };
    goClassesTab(content, teacher);
  }

  function goClassesTab(el, teacher) {
    if (subView.name === "detail") {
      return renderClassDetail(el, teacher, subView.classId, goTab);
    }
    if (subView.name === "attendance") {
      return renderAttendance(el, teacher, subView.classId, subView.sessionId, goTab);
    }
    if (subView.name === "materials") {
      return renderMaterials(el, teacher, subView.classId, subView.sessionId, goTab);
    }
    return renderClassesList(el, teacher, goTab);
  }

  container
    .querySelectorAll(".nav-item[data-tab]")
    .forEach((btn) =>
      btn.addEventListener("click", () => switchTab(btn.dataset.tab))
    );

  function switchTab(id) {
    subView = { name: "list", classId: null, sessionId: null };
    container
      .querySelectorAll(".nav-item[data-tab]")
      .forEach((b) => b.classList.toggle("active", b.dataset.tab === id));
    container.querySelector("#page-title").textContent = tabs.find((t) => t.id === id).label;
    tabs.find((t) => t.id === id).render(content, teacher);
  }

  switchTab("overview");
}

function renderOverview(el, teacher) {
  const d = getTeacherOverview(teacher.id);
  const upcoming = d.classes
    .map((c) => ({ ...c, next: c.nextSession }))
    .filter((c) => c.next)
    .sort((a, b) => a.next.date.localeCompare(b.next.date));

  el.innerHTML = `
    <div class="welcome-banner">
      <div>
        <h2 class="welcome-title">Xin chào, ${teacher.fullName}!</h2>
        <p class="welcome-sub">${d.totalClasses} lớp đang dạy · tổng ${d.totalStudents} học sinh theo học.</p>
      </div>
      <span class="badge subject">Môn: ${subjectLabel(teacher.subject)}</span>
    </div>

    <div class="stat-grid">
      ${statCard(ICONS.classes, d.totalClasses, "Lớp đang dạy")}
      ${statCard(ICONS.school, d.totalStudents, "Học sinh đang theo")}
      ${statCard(ICONS.calendar, upcoming.length, "Buổi học sắp tới")}
    </div>

    <div class="panel mt-lg">
      <div class="panel-head">
        <h2 class="panel-title">Buổi học sắp tới</h2>
        <a class="link-primary" href="#" data-go="schedule">Xem lịch giảng dạy</a>
      </div>
      ${
        upcoming.length
          ? upcoming
              .map(
                (c) => `
                  <div class="row-item">
                    <div>
                      <strong class="row-title">${c.className} · ${formatDate(c.next.date)} ${attBadge(c.next.id)}</strong>
                      <span class="row-sub">${c.next.title || "—"} · <span class="badge subject">${subjectLabel(c.subject)}</span></span>
                    </div>
                    <span class="row-end muted">${c.enrolled}/${c.maxSlot} HS</span>
                  </div>`
              )
              .join("")
          : `<div class="empty">Bạn chưa có buổi học nào sắp tới — hãy tạo buổi học ở mục “Lớp của tôi”.</div>`
      }
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
                    <td><span class="badge subject">${subjectLabel(c.subject)}</span></td>
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

    <div class="panel mt-lg">
      <div class="panel-head">
        <h2 class="panel-title">Bảng điểm theo lớp</h2>
        <span class="count-chip">${d.classes.reduce((s, c) => s + listGradesByClass(c.id).length, 0)} cột điểm</span>
      </div>
      ${
        d.classes.length
          ? `<div class="table-wrap"><table>
              <thead>
                <tr><th>Lớp</th><th>Môn</th><th>Sĩ số</th><th>HS đã chấm điểm</th><th>Số cột điểm</th><th>Điểm TBC</th></tr>
              </thead>
              <tbody>${d.classes
                .map((c) => {
                  const gs = listGradesByClass(c.id);
                  const scored = new Set(gs.map((g) => g.studentId)).size;
                  const avg = gs.length ? gs.reduce((s, g) => s + g.score, 0) / gs.length : null;
                  return `<tr>
                    <td><strong>${c.className}</strong></td>
                    <td><span class="badge subject">${subjectLabel(c.subject)}</span></td>
                    <td>${c.enrolled}</td>
                    <td>${scored}/${c.enrolled}</td>
                    <td>${gs.length}</td>
                    <td><strong>${avg !== null ? avg.toFixed(1) : "—"}</strong></td>
                  </tr>`;
                })
                .join("")}</tbody>
            </table></div>`
          : `<div class="empty">Chưa có lớp nào nên chưa có bảng thống kê điểm.</div>`
      }
    </div>
  `;

  el.querySelectorAll("[data-go]").forEach((a) =>
    a.addEventListener("click", (e) => {
      e.preventDefault();
      el.closest("#app").querySelector(`.nav-item[data-tab="${a.dataset.go}"]`)?.click();
    })
  );
}

function renderSchedule(el, teacher) {
  const classes = getTeacherWeekSchedule(teacher.id);

  const allUpcoming = classes
    .flatMap((c) =>
      listUpcomingSessionsByClass(c.id, todayStr()).map((s) => ({ ...c, session: s }))
    )
    .sort((a, b) => a.session.date.localeCompare(b.session.date));

  el.innerHTML = `
    <div class="section-title">Lịch giảng dạy theo tuần</div>
    <div class="panel">
      <div class="table-wrap">
        <table class="week-table">
          <thead>
            <tr><th class="week-class-col">Lớp</th>${WEEKDAYS.map((w) => `<th>${w.label}</th>`).join("")}</tr>
          </thead>
          <tbody>
            ${classes
              .map(
                (c) => `
                  <tr>
                    <td>
                      <strong>${c.className}</strong>
                      <span class="badge subject">${subjectLabel(c.subject)}</span>
                    </td>
                    ${WEEKDAYS.map((w) => {
                      const slot = (c.schedule || []).find((s) => s.dayOfWeek === w.value);
                      return `<td>${slot ? `<span class="slot-chip">${slot.start}–${slot.end}</span>` : ""}</td>`;
                    }).join("")}
                  </tr>`
              )
              .join("")}
          </tbody>
        </table>
      </div>
      ${classes.length === 0 ? `<div class="empty">Bạn chưa mở lớp nào.</div>` : ""}
    </div>

    <div class="section-title">Buổi học sắp tới & trạng thái điểm danh</div>
    <div class="panel">
      ${
        allUpcoming.length
          ? allUpcoming.map(
              (c) => `
                <div class="row-item">
                  <div>
                    <strong class="row-title">${formatDate(c.session.date)} · ${c.className} ${attBadge(c.session.id)}</strong>
                    <span class="row-sub">${c.session.title || "Chưa có tiêu đề"}</span>
                  </div>
                  <span class="row-end muted">${c.enrolled}/${c.maxSlot} HS</span>
                </div>`
            ).join("")
          : `<div class="empty">Chưa có buổi học sắp tới cho lớp nào.</div>`
      }
    </div>
  `;
}

function renderClassesList(el, teacher, goTab) {
  const d = getTeacherOverview(teacher.id);

  el.innerHTML = `
    <div class="panel mb-lg">
      <div class="panel-head"><h2 class="panel-title">Tạo lớp mới</h2></div>
      <form id="class-create" class="form-grid">
        <div><label>Tên lớp</label><input name="className" placeholder="VD: Toán 9A" required /></div>
        <div><label>Sĩ số tối đa</label><input name="maxSlot" type="number" min="1" max="40" value="20" required /></div>
        <div><label>Giờ bắt đầu</label><input name="start" type="time" value="18:00" required /></div>
        <div><label>Giờ kết thúc</label><input name="end" type="time" value="19:30" required /></div>
        <div class="form-grid-days">
          <label>Ngày học trong tuần (chọn ít nhất 1)</label>
          <div class="day-checks">
            ${WEEKDAYS.map(
              (w) => `<label class="day-check"><input type="checkbox" name="day" value="${w.value}" ${w.value === 3 || w.value === 6 ? "checked" : ""} /> ${w.label}</label>`
            ).join("")}
          </div>
        </div>
        <div class="align-end"><button class="btn btn-primary" type="submit">Tạo lớp</button></div>
      </form>
      <p id="class-error" class="form-error" role="alert" hidden></p>
    </div>

    <div class="section-title">Lớp của tôi (${d.totalClasses})</div>
    <div class="class-grid">
      ${
        d.classes.length
          ? d.classes.map((c) => classCard(c)).join("")
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
      const days = form.getAll("day").map(Number);
      if (start >= end) throw new Error("Giờ kết thúc phải sau giờ bắt đầu");
      if (!days.length) throw new Error("Chọn ít nhất 1 ngày học");

      createClass(teacher, {
        className: form.get("className"),
        maxSlot: Number(form.get("maxSlot")),
        schedule: days.map((d) => ({ dayOfWeek: d, start, end })),
      });
      goTab("list", null, null);
    } catch (err2) {
      err.textContent = err2.message;
      err.hidden = false;
    }
  });

  el.querySelectorAll("[data-detail]").forEach((btn) =>
    btn.addEventListener("click", () => goTab("detail", btn.dataset.detail, null))
  );
}

const classCard = (c) => `
  <div class="class-card">
    <div class="class-top">
      <span class="badge subject">${subjectLabel(c.subject)}</span>
      <span class="badge ${c.status === "open" ? "open" : "closed"}">${c.status === "open" ? "Đang mở" : "Đã đóng"}</span>
    </div>
    <div class="class-name">${c.className}</div>
    <div class="class-meta">
      <span>${ICONS.calendar} ${formatSchedule(c.schedule)}</span>
      <span>${ICONS.users} Đã ghi danh: ${c.enrolled}/${c.maxSlot}</span>
    </div>
    <span class="slot-bar"><i style="width:${pct(c.enrolled, c.maxSlot)}%"></i></span>
    <div class="class-actions">
      <button class="btn btn-sm btn-primary" data-detail="${c.id}">Quản lý lớp</button>
    </div>
  </div>`;

function renderClassDetail(el, teacher, classId, goTab) {
  const cls = getClassById(classId);
  if (!cls) return goTab("list", null, null);

  const students = listStudentsOfClass(classId);
  const sessions = DB.getAll("sessions")
    .filter((s) => s.classId === classId)
    .sort((a, b) => b.date.localeCompare(a.date));
  const grades = listGradesByClass(classId);
  const comments = listCommentsByClass(classId);
  const userOf = (id) => DB.getAll("users").find((u) => u.id === id);

  el.innerHTML = `
    <div class="detail-head">
      <button class="btn btn-sm" data-back>${ICONS.back} Quay lại</button>
      <div class="detail-title">
        <h2 class="detail-name">${cls.className}</h2>
        <span class="badge subject">${subjectLabel(cls.subject)}</span>
        <span class="badge ${cls.status === "open" ? "open" : "closed"}">${cls.status === "open" ? "Đang mở" : "Đã đóng"}</span>
      </div>
      <button class="btn btn-sm ${cls.status === "open" ? "btn-warn" : ""}" data-toggle>${cls.status === "open" ? "Đóng lớp" : "Mở lại lớp"}</button>
    </div>

    <div class="info-grid">
      <div class="info-box"><span class="info-label">Lịch học</span><span>${formatSchedule(cls.schedule)}</span></div>
      <div class="info-box"><span class="info-label">Sĩ số</span><span>${students.length}/${cls.maxSlot}</span></div>
      <div class="info-box"><span class="info-label">Số buổi đã tạo</span><span>${sessions.length}</span></div>
    </div>

    <details class="panel edit-panel">
      <summary class="panel-head">${ICONS.edit} Chỉnh sửa lịch & sĩ số</summary>
      <form id="class-edit" class="form-grid">
        <div><label>Sĩ số tối đa</label><input name="maxSlot" type="number" min="1" max="40" value="${cls.maxSlot}" required /></div>
        <div><label>Giờ bắt đầu</label><input name="start" type="time" value="${(cls.schedule[0] || {}).start || "18:00"}" required /></div>
        <div><label>Giờ kết thúc</label><input name="end" type="time" value="${(cls.schedule[0] || {}).end || "19:30"}" required /></div>
        <div class="form-grid-days">
          <label>Ngày học trong tuần</label>
          <div class="day-checks">
            ${WEEKDAYS.map((w) => {
              const checked = (cls.schedule || []).some((s) => s.dayOfWeek === w.value);
              return `<label class="day-check"><input type="checkbox" name="day" value="${w.value}" ${checked ? "checked" : ""} /> ${w.label}</label>`;
            }).join("")}
          </div>
        </div>
        <div class="align-end"><button class="btn btn-primary" type="submit">Lưu thay đổi</button></div>
      </form>
      <p id="edit-error" class="form-error" role="alert" hidden></p>
    </details>

    <div class="section-title">Học sinh trong lớp (${students.length})</div>
    <div class="panel">
      ${
        students.length
          ? `<div class="table-wrap"><table>
              <thead><tr><th>#</th><th>Họ tên</th><th>Tài khoản</th></tr></thead>
              <tbody>${students
                .map(
                  (s, i) => `<tr><td>${i + 1}</td><td><strong>${s.fullName}</strong></td><td class="muted">@${s.username}</td></tr>`
                )
                .join("")}</tbody>
            </table></div>`
          : `<div class="empty">Lớp chưa có học sinh nào.</div>`
      }
    </div>

    <div class="section-title">Buổi học (${sessions.length})</div>
    <div class="panel mb-lg">
      <form id="session-create" class="session-form">
        <div><label>Ngày học</label><input name="date" type="date" value="${todayStr()}" required /></div>
        <div class="session-title-field"><label>Tiêu đề bài học</label><input name="title" placeholder="VD: Phương trình bậc hai" required /></div>
        <div class="align-end"><button class="btn btn-primary" type="submit">${ICONS.plus} Tạo buổi học</button></div>
      </form>
      <p id="session-error" class="form-error" role="alert" hidden></p>
      ${
        sessions.length
          ? `<div class="table-wrap"><table class="session-table">
              <thead><tr><th>Ngày</th><th>Tiêu đề</th><th>Tài liệu</th><th>Điểm danh</th><th class="right">Thao tác</th></tr></thead>
              <tbody>${sessions
                .map((s) => {
                  const matCount = listMaterialsBySession(s.id).length;
                  return `<tr>
                    <td><strong>${formatDate(s.date)}</strong></td>
                    <td>${s.title || "—"}</td>
                    <td>${matCount ? `<span class="badge subject">${ICONS.paperclip} ${matCount}</span>` : `<span class="muted">0</span>`}</td>
                    <td>${attBadge(s.id)}</td>
                    <td class="right actions">
                      <button class="btn btn-sm" data-attend="${s.id}">Điểm danh</button>
                      <button class="btn btn-sm" data-mat="${s.id}">${ICONS.paperclip} Tài liệu</button>
                    </td>
                  </tr>`;
                })
                .join("")}</tbody>
            </table></div>`
          : `<div class="empty">Chưa có buổi học nào — hãy tạo buổi học đầu tiên.</div>`
      }
    </div>

    <div class="split">
      <div class="panel">
        <div class="panel-head"><h2 class="panel-title">Điểm số</h2></div>
        ${
          students.length
            ? `<form id="grade-form" class="mini-form">
                <div><label>Học sinh</label><select name="studentId">${students
                  .map((s) => `<option value="${s.id}">${s.fullName}</option>`)
                  .join("")}</select></div>
                <div><label>Loại điểm</label><select name="type">${GRADE_TYPES.map((t) => `<option>${t}</option>`).join("")}</select></div>
                <div><label>Điểm (0–10)</label><input name="score" type="number" min="0" max="10" step="0.5" required /></div>
                <div><label>Ghi chú</label><input name="note" placeholder="VD: Kiểm tra miệng" /></div>
                <div class="align-end"><button class="btn btn-sm btn-primary" type="submit">Thêm điểm</button></div>
              </form>
              <p id="grade-error" class="form-error" role="alert" hidden></p>
              <div class="table-wrap"><table>
                <thead><tr><th>Học sinh</th><th>Điểm</th></tr></thead>
                <tbody>${students
                  .map((s) => {
                    const gs = grades.filter((g) => g.studentId === s.id);
                    return `<tr>
                      <td><strong>${s.fullName}</strong></td>
                      <td>${gs.length ? gs.map((g) => `<span class="grade-chip">${g.type}: <b>${g.score}</b></span>`).join(" ") : `<span class="muted">Chưa có</span>`}</td>
                    </tr>`;
                  })
                  .join("")}</tbody>
              </table></div>`
            : `<div class="empty">Lớp chưa có học sinh.</div>`
        }
      </div>

      <div class="panel">
        <div class="panel-head"><h2 class="panel-title">Nhận xét học sinh</h2></div>
        ${
          students.length
            ? `<form id="comment-form" class="mini-form">
                <div><label>Học sinh</label><select name="studentId">${students
                  .map((s) => `<option value="${s.id}">${s.fullName}</option>`)
                  .join("")}</select></div>
                <div class="full"><label>Nội dung nhận xét</label><textarea name="content" rows="2" placeholder="Nhập nhận xét..." required></textarea></div>
                <div class="align-end"><button class="btn btn-sm btn-primary" type="submit">Gửi nhận xét</button></div>
              </form>
              <p id="comment-error" class="form-error" role="alert" hidden></p>
              <div class="comment-list">
                ${comments.length ? comments
                  .map((cm) => {
                    const st = userOf(cm.studentId);
                    return `<div class="comment-item">
                      <span class="comment-head"><b>${st?.fullName || "Học sinh"}</b><small>${formatDate(cm.createdAt ? cm.createdAt.slice(0, 10) : "")}</small></span>
                      <p>${cm.content}</p>
                    </div>`;
                  })
                  .join("") : `<div class="empty">Chưa có nhận xét.</div>`}
              </div>`
            : `<div class="empty">Lớp chưa có học sinh.</div>`
        }
      </div>
    </div>
  `;

  el.querySelector("[data-back]").addEventListener("click", () => goTab("list", null, null));
  el.querySelector("[data-toggle]").addEventListener("click", () => {
    setClassStatus(classId, cls.status === "open" ? "closed" : "open");
    renderClassDetail(el, teacher, classId, goTab);
  });

  const editForm = el.querySelector("#class-edit");
  if (editForm) {
    editForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const form = new FormData(e.target);
      const err = el.querySelector("#edit-error");
      err.hidden = true;
      const start = form.get("start");
      const end = form.get("end");
      const days = form.getAll("day").map(Number);
      try {
        if (start >= end) throw new Error("Giờ kết thúc phải sau giờ bắt đầu");
        if (!days.length) throw new Error("Chọn ít nhất 1 ngày học");
        updateClassInfo(classId, {
          maxSlot: Number(form.get("maxSlot")),
          schedule: days.map((d) => ({ dayOfWeek: d, start, end })),
        });
        renderClassDetail(el, teacher, classId, goTab);
      } catch (err2) {
        err.textContent = err2.message;
        err.hidden = false;
      }
    });
  }

  const sessionForm = el.querySelector("#session-create");
  if (sessionForm) {
    sessionForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const form = new FormData(e.target);
      const err = el.querySelector("#session-error");
      err.hidden = true;
      try {
        createSession(classId, { date: form.get("date"), title: form.get("title") });
        renderClassDetail(el, teacher, classId, goTab);
      } catch (err2) {
        err.textContent = err2.message;
        err.hidden = false;
      }
    });
  }

  el.querySelectorAll("[data-attend]").forEach((btn) =>
    btn.addEventListener("click", () => goTab("attendance", classId, btn.dataset.attend))
  );
  el.querySelectorAll("[data-mat]").forEach((btn) =>
    btn.addEventListener("click", () => goTab("materials", classId, btn.dataset.mat))
  );

  const gradeForm = el.querySelector("#grade-form");
  if (gradeForm) {
    gradeForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const form = new FormData(e.target);
      const err = el.querySelector("#grade-error");
      err.hidden = true;
      try {
        addGrade({
          classId,
          studentId: form.get("studentId"),
          type: form.get("type"),
          score: Number(form.get("score")),
          note: form.get("note"),
        });
        renderClassDetail(el, teacher, classId, goTab);
      } catch (err2) {
        err.textContent = err2.message;
        err.hidden = false;
      }
    });
  }

  const commentForm = el.querySelector("#comment-form");
  if (commentForm) {
    commentForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const form = new FormData(e.target);
      const err = el.querySelector("#comment-error");
      err.hidden = true;
      try {
        addComment({
          classId,
          studentId: form.get("studentId"),
          teacherId: teacher.id,
          content: form.get("content"),
        });
        renderClassDetail(el, teacher, classId, goTab);
      } catch (err2) {
        err.textContent = err2.message;
        err.hidden = false;
      }
    });
  }
}

function renderAttendance(el, teacher, classId, sessionId, goTab) {
  const cls = getClassById(classId);
  const sess = DB.getAll("sessions").find((s) => s.id === sessionId);
  if (!cls || !sess) return goTab("list", null, null);

  const students = listStudentsOfClass(classId);
  const existing = listAttendanceBySession(sessionId);
  const statusOf = (sid) => existing.find((a) => a.studentId === sid)?.status || "present";

  const summary = sessionAttendanceInfo(sessionId);

  el.innerHTML = `
    <div class="detail-head">
      <button class="btn btn-sm" data-back>${ICONS.back} Quay lại lớp</button>
      <div class="detail-title">
        <h2 class="detail-name">Điểm danh · ${cls.className}</h2>
        <span class="badge subject">${formatDate(sess.date)}</span>
        <span class="badge ${summary.done ? "active" : "inactive"}">${summary.done ? `Đã điểm danh ${summary.marked}/${students.length}` : "Chưa điểm danh"}</span>
      </div>
    </div>

    <div class="panel">
      <div class="panel-head"><h2 class="panel-title">${sess.title || "Buổi học"}</h2></div>
      <p id="att-error" class="form-error" role="alert" hidden></p>
      ${
        students.length
          ? `<div class="table-wrap"><table>
              <thead><tr><th>#</th><th>Học sinh</th><th>Trạng thái</th></tr></thead>
              <tbody>${students
                .map(
                  (s, i) => `
                    <tr>
                      <td>${i + 1}</td>
                      <td><strong>${s.fullName}</strong></td>
                      <td>
                        <select class="att-select" data-student="${s.id}">
                          ${Object.entries(ATTENDANCE_LABELS)
                            .map(
                              ([val, label]) => `<option value="${val}" ${statusOf(s.id) === val ? "selected" : ""}>${label}</option>`
                            )
                            .join("")}
                        </select>
                      </td>
                    </tr>`
                )
                .join("")}</tbody>
            </table></div>
            <div class="panel-foot">
              <button id="att-save" class="btn btn-primary">Lưu điểm danh</button>
              <button id="att-reset" class="btn btn-danger">Xoá điểm danh buổi này</button>
            </div>`
          : `<div class="empty">Lớp chưa có học sinh.</div>`
      }
    </div>
  `;

  el.querySelector("[data-back]").addEventListener("click", () => goTab("detail", classId, null));

  const saveBtn = el.querySelector("#att-save");
  if (saveBtn) {
    saveBtn.addEventListener("click", () => {
      el.querySelectorAll(".att-select").forEach((sel) => {
        markAttendance(sessionId, sel.dataset.student, sel.value);
      });
      renderAttendance(el, teacher, classId, sessionId, goTab);
    });
  }

  const resetBtn = el.querySelector("#att-reset");
  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      existing.forEach((a) => DB.remove("attendance", a.id));
      renderAttendance(el, teacher, classId, sessionId, goTab);
    });
  }
}

function renderMaterials(el, teacher, classId, sessionId, goTab) {
  const cls = getClassById(classId);
  const sess = DB.getAll("sessions").find((s) => s.id === sessionId);
  if (!cls || !sess) return goTab("list", null, null);

  const materials = listMaterialsBySession(sessionId);

  el.innerHTML = `
    <div class="detail-head">
      <button class="btn btn-sm" data-back>${ICONS.back} Quay lại lớp</button>
      <div class="detail-title">
        <h2 class="detail-name">Tài liệu · ${cls.className}</h2>
        <span class="badge subject">${formatDate(sess.date)} · ${sess.title || "Buổi học"}</span>
      </div>
    </div>

    <div class="panel mb-lg">
      <div class="panel-head"><h2 class="panel-title">${ICONS.paperclip} Đính kèm tài liệu</h2></div>
      <form id="mat-form" class="mini-form">
        <div><label>Tên tài liệu</label><input name="fileName" id="mat-name" placeholder="VD: Bai-tap-1.pdf" required /></div>
        <div><label>File (tải lên)</label><input name="file" id="mat-file" type="file" /></div>
        <div class="full"><label>Hoặc dán link tài liệu (VD: Google Drive)</label><input name="url" id="mat-url" placeholder="https://drive.google.com/..." /></div>
        <div class="align-end"><button class="btn btn-primary" type="submit">${ICONS.paperclip} Đính kèm</button></div>
      </form>
      <p id="mat-error" class="form-error" role="alert" hidden></p>
    </div>

    <div class="section-title">Danh sách tài liệu (${materials.length})</div>
    <div class="panel">
      ${
        materials.length
          ? materials
              .map(
                (m) => `
                  <div class="row-item">
                    <div>
                      <strong class="row-title">${ICONS.paperclip} ${m.fileName}</strong>
                      <span class="row-sub">${formatDate(m.uploadedAt ? m.uploadedAt.slice(0, 10) : "—")}</span>
                    </div>
                    ${materialLink(m)}
                  </div>`
              )
              .join("")
          : `<div class="empty">Buổi học này chưa có tài liệu.</div>`
      }
    </div>
  `;

  el.querySelector("[data-back]").addEventListener("click", () => goTab("detail", classId, null));

  let fileData = null;
  const fileInput = el.querySelector("#mat-file");
  const urlInput = el.querySelector("#mat-url");
  fileInput.addEventListener("change", () => {
    const file = fileInput.files[0];
    if (!file) return;
    if (file.size > 1024 * 1024) {
      showMatError("File quá lớn (giới hạn 1MB) — hãy dùng link tài liệu thay thế.");
      fileInput.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      fileData = reader.result;
      const nameInput = el.querySelector("#mat-name");
      if (!nameInput.value) nameInput.value = file.name;
      showMatError(null);
    };
    reader.readAsDataURL(file);
  });
  urlInput.addEventListener("input", () => showMatError(null));

  const showMatError = (msg) => {
    const err = el.querySelector("#mat-error");
    if (!msg) {
      err.hidden = true;
      return;
    }
    err.textContent = msg;
    err.hidden = false;
  };

  el.querySelector("#mat-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    const fileName = form.get("fileName").trim();
    const url = form.get("url").trim();
    try {
      if (!fileName) throw new Error("Vui lòng nhập tên tài liệu");
      const data = fileData || url;
      if (!data) throw new Error("Vui lòng tải file lên hoặc dán link tài liệu");
      attachMaterial(sessionId, { fileName, fileData: data });
      renderMaterials(el, teacher, classId, sessionId, goTab);
    } catch (err) {
      showMatError(err.message);
    }
  });
}