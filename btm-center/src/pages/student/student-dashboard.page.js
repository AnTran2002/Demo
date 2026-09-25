// pages/student/student-dashboard.page.js — Phụ trách: Thành viên A/C
// Lịch học (overview + chi tiết lớp: buổi học, tài liệu, điểm, nhận xét) · Đăng ký lớp
import { Session } from "../../core/session.js";
import { renderShell, ICONS, formatSchedule } from "../shell.js";
import { getStudentOverview } from "../../modules/dashboard/dashboard.service.js";
import {
  enroll,
  cancelEnrollment,
} from "../../modules/enrollment/enrollment.service.js";
import {
  listSessionsByClass,
  listAttendanceBySession,
} from "../../modules/sessions/sessions.service.js";
import { listGradesByStudentInClass } from "../../modules/grades/grades.service.js";
import { listCommentsByStudent } from "../../modules/comments/comments.service.js";
import { listMaterialsBySession } from "../../modules/materials/materials.service.js";
import { listStudentsOfClass, getClassById } from "../../modules/classes/classes.service.js";
import {
  SUBJECTS,
  subjectLabel,
  formatDate,
  todayStr,
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

export function renderStudentDashboard(container) {
  const student = Session.getCurrentUser();

  const tabs = [
    { id: "overview", label: "Lịch học", icon: ICONS.calendar, active: true, render: renderOverview },
    { id: "enroll", label: "Đăng ký lớp", icon: ICONS.classes, active: false, render: renderEnroll },
  ];

  renderShell(container, { title: "Lịch học", items: tabs });
  const content = container.querySelector("#tab-content");

  let detailClassId = null;

  container
    .querySelectorAll(".nav-item[data-tab]")
    .forEach((btn) =>
      btn.addEventListener("click", () => switchTab(btn.dataset.tab))
    );

  function switchTab(id) {
    detailClassId = null;
    container
      .querySelectorAll(".nav-item[data-tab]")
      .forEach((b) => b.classList.toggle("active", b.dataset.tab === id));
    container.querySelector("#page-title").textContent = tabs.find((t) => t.id === id).label;
    tabs.find((t) => t.id === id).render(content, student);
  }

  switchTab("overview");
}

function renderOverview(el, student) {
  const d = getStudentOverview(student.id);

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
      </div>
      <span class="badge student">Học sinh</span>
    </div>

    <div class="stat-grid">
      ${statCard(ICONS.classes, d.myClasses.length, "Lớp đang học")}
      ${statCard(ICONS.school, d.openClasses.length, "Lớp đang mở")}
    </div>

    <p id="overview-msg" class="form-error" role="alert" hidden></p>
    <div class="section-title">Lịch học của tôi</div>
    ${
      d.myClasses.length
        ? `<div class="class-grid">${d.myClasses.map((c) => myClassCard(c)).join("")}</div>`
        : `<div class="empty panel">Bạn chưa đăng ký lớp nào. Hãy vào mục “Đăng ký lớp” để bắt đầu.</div>`
    }
  `;

  el.querySelectorAll("[data-cancel]").forEach((btn) =>
    btn.addEventListener("click", () => {
      try {
        cancelEnrollment(btn.dataset.cancel);
        renderOverview(el, student);
      } catch (err) {
        flash(err.message);
      }
    })
  );

  el.querySelectorAll("[data-detail]").forEach((btn) =>
    btn.addEventListener("click", () => {
      detailClassId = btn.dataset.detail;
      renderClassDetail(el, student, detailClassId);
    })
  );
}

function canCancel(classId) {
  return listSessionsByClass(classId).length === 0;
}

const myClassCard = (c) => {
  const cancellable = canCancel(c.id);
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
        cancellable
          ? `<button class="btn btn-sm btn-danger" data-cancel="${c.enrollmentId}">Hủy đăng ký</button>`
          : `<span class="hint-sm">Đã có buổi học, không thể hủy</span>`
      }
    </div>
  </div>`;
};

function renderClassDetail(el, student, classId) {
  const cls = getClassById(classId);
  if (!cls) return renderOverview(el, student);

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
    detailClassId = null;
    renderOverview(el, student);
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
      ${renderOpenList(d.openClasses, "")}
    </div>
  `;

  el.querySelector("#subject-filter").addEventListener("change", (e) => {
    const filter = e.target.value;
    el.querySelector("#open-class-wrap").innerHTML = renderOpenList(d.openClasses, filter);
    bindOpenList(el, student);
  });

  bindOpenList(el, student);
}

function renderOpenList(classes, subject) {
  const list = subject ? classes.filter((c) => c.subject === subject) : classes;
  if (!list.length) {
    return `<div class="empty panel">Không có lớp phù hợp. Hãy thử lọc môn khác.</div>`;
  }
  return `<div class="class-grid">${list.map(openClassCard).join("")}</div>`;
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

  el.querySelectorAll("[data-cancel]").forEach((btn) =>
    btn.addEventListener("click", () => {
      try {
        cancelEnrollment(btn.dataset.cancel);
        renderEnroll(el, student);
      } catch (err) {
        flash(err.message);
      }
    })
  );
}

const openClassCard = (c) => `
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
        c.isEnrolled
          ? `<button class="btn btn-sm btn-danger" data-cancel="${c.enrollmentId}">Hủy đăng ký</button>`
          : c.enrolled >= c.maxSlot
            ? `<button class="btn btn-sm" disabled>Đã đủ chỗ</button>`
            : `<button class="btn btn-sm btn-primary" data-enroll="${c.id}">Đăng ký</button>`
      }
    </div>
  </div>`;