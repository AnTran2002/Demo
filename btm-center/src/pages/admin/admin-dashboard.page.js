// pages/admin/admin-dashboard.page.js — Phụ trách: Thành viên B
import { renderShell, ICONS, formatSchedule, ROLE_LABELS } from "../shell.js";
import {
  getAdminOverview,
  getAdminAccountClasses,
} from "../../modules/dashboard/dashboard.service.js";
import {
  toggleActive,
  updateUserCredentials,
  deleteUser,
} from "../../modules/users/users.service.js";
import { setClassStatus } from "../../modules/classes/classes.service.js";
import {
  listClassRequests,
  approveClassRequest,
  rejectClassRequest,
} from "../../modules/classes/class-requests.service.js";
import { getLinkedStudent } from "../../modules/parents/parents.service.js";
import { subjectLabel, WEEKDAYS, formatDate } from "../../data/constants.js";
import { escapeHtml } from "../../core/html.js";

const pct = (a, b) => Math.min(100, Math.round((a / (b || 1)) * 100));

const REQ_TYPE_LABELS = {
  register: "Đăng ký lớp mới",
  reschedule: "Yêu cầu đổi lịch học",
};

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
  if (status === "pending") return `<span class="badge late">Chờ phê duyệt</span>`;
  return `<span class="badge closed">Đã đóng</span>`;
};

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
  const box = el.querySelector("#admin-flash");
  if (!box) return;
  box.textContent = message;
  box.dataset.type = type;
  box.hidden = false;
  window.clearTimeout(box._timer);
  box._timer = window.setTimeout(() => (box.hidden = true), 2800);
}

function openModal({ title, body, foot = "", onMount }) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true">
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

export function renderAdminDashboard(container) {
  const tabs = [
    {
      id: "accounts",
      label: "Quản lý tài khoản",
      icon: ICONS.users,
      active: true,
      render: renderAccounts,
    },
    {
      id: "classes",
      label: "Quản lý lớp học",
      icon: ICONS.classes,
      active: false,
      render: renderClasses,
    },
    {
      id: "notifications",
      label: "Thông báo",
      icon: ICONS.bell,
      active: false,
      render: renderNotifications,
    },
  ];

  renderShell(container, { title: tabs[0].label, items: tabs });
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

  switchTab("accounts");
}

function renderAccounts(el, filterRole = "") {
  const users = getAdminOverview().users.filter((u) => u.role !== "admin");
  const list = filterRole ? users.filter((u) => u.role === filterRole) : users;

  el.innerHTML = `
    <p class="admin-flash" id="admin-flash" hidden></p>

    <div class="panel">
      <div class="panel-head">
        <h2 class="panel-title">Danh sách tài khoản</h2>
        <div class="filter-row">
          <select id="role-filter">
            <option value="">Tất cả vai trò</option>
            <option value="teacher">${ROLE_LABELS.teacher}</option>
            <option value="student">${ROLE_LABELS.student}</option>
            <option value="parent">${ROLE_LABELS.parent}</option>
          </select>
          <span class="count-chip">${list.length} tài khoản</span>
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr><th>#</th><th>Họ tên</th><th>Tài khoản</th><th>Vai trò</th><th>Trạng thái</th><th></th></tr>
          </thead>
          <tbody>
            ${list
              .map(
                (u, i) => `
                  <tr data-account="${u.id}">
                    <td>${i + 1}</td>
                    <td><strong>${escapeHtml(u.fullName)}</strong></td>
                    <td>@${escapeHtml(u.username)}</td>
                    <td><span class="badge role-${u.role}">${ROLE_LABELS[u.role]}</span></td>
                    <td><span class="badge ${u.active ? "active" : "inactive"}">${u.active ? "Hoạt động" : "Đã khóa"}</span></td>
                    <td class="actions">
                      <button class="btn btn-sm btn-toggle" data-id="${u.id}" data-active="${u.active}">
                        ${u.active ? "Khóa" : "Mở khóa"}
                      </button>
                      <button class="btn btn-sm btn-toggle" data-edit="${u.id}">Sửa</button>
                      <button class="btn btn-sm btn-danger" data-del="${u.id}">Xóa</button>
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
      ${list.length ? "" : `<div class="empty">Không có tài khoản nào phù hợp.</div>`}
    </div>
  `;

  const filterSel = el.querySelector("#role-filter");
  filterSel.value = filterRole;
  filterSel.addEventListener("change", (e) => renderAccounts(el, e.target.value));

  el.querySelectorAll(".btn-toggle[data-id]").forEach((btn) =>
    btn.addEventListener("click", () => {
      toggleActive(btn.dataset.id);
      renderAccounts(el, filterRole);
    })
  );

  el.querySelectorAll("[data-edit]").forEach((btn) =>
    btn.addEventListener("click", () => {
      const user = users.find((u) => u.id === btn.dataset.edit);
      if (!user) return;
      openEditAccount(user, () => {
        renderAccounts(el, filterRole);
        flash(el, `Đã cập nhật tài khoản của ${user.fullName}.`);
      });
    })
  );

  el.querySelectorAll("[data-del]").forEach((btn) =>
    btn.addEventListener("click", () => {
      const user = users.find((u) => u.id === btn.dataset.del);
      if (!user) return;
      openDeleteAccount(user, () => {
        renderAccounts(el, filterRole);
        flash(el, `Đã xóa tài khoản ${user.fullName}.`);
      });
    })
  );

  el.querySelectorAll("[data-detail]").forEach((btn) =>
    btn.addEventListener("click", () => {
      const row = el.querySelector(
        `tr.account-detail[data-detail-of="${btn.dataset.detail}"]`
      );
      if (row) row.hidden = !row.hidden;
    })
  );
}

function openEditAccount(user, onSaved) {
  openModal({
    title: `Sửa tài khoản · ${escapeHtml(user.fullName)}`,
    body: `
      <p class="muted">@${escapeHtml(user.username)} · <span class="badge role-${user.role}">${ROLE_LABELS[user.role]}</span></p>
      <div class="modal-form">
        <div>
          <label for="acc-email">Gmail</label>
          <input id="acc-email" type="email" value="${escapeHtml(user.email || "")}" />
        </div>
        <div>
          <label for="acc-password">Mật khẩu mới</label>
          <input id="acc-password" type="password" autocomplete="new-password" placeholder="Để trống để giữ nguyên mật khẩu hiện tại" />
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

function openDeleteAccount(user, onDeleted) {
  openModal({
    title: "Xóa tài khoản",
    body: `
      <p>Bạn chắc chắn muốn xóa tài khoản <strong>${escapeHtml(user.fullName)}</strong> (@${escapeHtml(user.username)})?</p>
      <p class="muted">Các lớp đăng ký, điểm, điểm danh, nhận xét và yêu cầu liên quan đến tài khoản này sẽ bị xóa theo. Hành động không thể hoàn tác.</p>
      <p class="form-error" id="acc-error" role="alert" hidden></p>`,
    foot: `
      <button class="btn" data-close>Hủy</button>
      <button class="btn btn-danger" id="acc-del-confirm">Xóa tài khoản</button>`,
    onMount: (root, close) => {
      root.querySelector("#acc-del-confirm").addEventListener("click", () => {
        try {
          deleteUser(user.id);
          close();
          onDeleted();
        } catch (e) {
          const err = root.querySelector("#acc-error");
          if (err) {
            err.textContent = e.message;
            err.hidden = false;
          }
        }
      });
    },
  });
}

function accountClassesBlock(user) {
  if (user.role === "parent") {
    const student = getLinkedStudent(user.id);
    return student
      ? `<div class="acct-classes">
          <div class="acct-class">
            <span><strong>${escapeHtml(student.fullName)}</strong></span>
            <span class="badge student">Mã: ${student.id}</span>
            <span class="muted">@${escapeHtml(student.username)}</span>
          </div>
        </div>`
      : `<span class="muted">Tài khoản phụ huynh chưa liên kết học sinh.</span>`;
  }

  const classes = getAdminAccountClasses(user);
  if (!classes.length) {
    return user.role === "student"
      ? `<span class="muted">Tài khoản chưa tham gia lớp nào. Mã học sinh: <strong>${user.id}</strong></span>`
      : `<span class="muted">Tài khoản chưa tham gia lớp nào.</span>`;
  }
  return `
    <div class="acct-classes">
      ${
        user.role === "student"
          ? `<div class="acct-class"><span class="muted">Mã học sinh: <strong>${user.id}</strong></span></div>`
          : ""
      }
      ${classes
        .map(
          (c) => `
            <div class="acct-class">
              <span><strong>${escapeHtml(c.className)}</strong></span>
              <span class="badge subject">${subjectLabel(c.subject)}</span>
              <span class="muted">${formatSchedule(c.schedule)}</span>
              <span class="muted">${c.enrolled}/${c.maxSlot} HS</span>
              ${statusBadge(c.status)}
            </div>`
        )
        .join("")}
    </div>`;
}

function renderClasses(el) {
  const classes = getAdminOverview().classes.filter((c) => c.status === "open");

  el.innerHTML = `
    <p class="admin-flash" id="admin-flash" hidden></p>

    <div class="panel">
      <div class="panel-head">
        <h2 class="panel-title">Lớp đang hoạt động</h2>
        <span class="count-chip">${classes.length} lớp</span>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr><th>#</th><th>Tên lớp</th><th>Môn</th><th>Giáo viên</th><th>Sĩ số</th><th>Lịch học</th><th>Trạng thái</th><th></th></tr>
          </thead>
          <tbody>
            ${classes
              .map(
                (c, i) => `
                  <tr>
                    <td>${i + 1}</td>
                    <td><strong>${escapeHtml(c.className)}</strong></td>
                    <td><span class="badge subject">${subjectLabel(c.subject)}</span></td>
                    <td>${escapeHtml(c.teacherName)}</td>
                    <td>
                      <span class="slot-cell">
                        <span class="slot-text">${c.enrolled}/${c.maxSlot}</span>
                        <span class="slot-bar"><i style="width:${pct(c.enrolled, c.maxSlot)}%"></i></span>
                      </span>
                    </td>
                    <td class="muted">${formatSchedule(c.schedule)}</td>
                    <td>${statusBadge(c.status)}</td>
                    <td class="actions">
                      <button class="btn btn-sm btn-warn" data-close-class="${c.id}">Đóng lớp</button>
                    </td>
                  </tr>`
              )
              .join("")}
          </tbody>
        </table>
      </div>
      ${classes.length ? "" : `<div class="empty">Hiện không có lớp nào đang hoạt động.</div>`}
    </div>
  `;

  el.querySelectorAll("[data-close-class]").forEach((btn) =>
    btn.addEventListener("click", () => {
      const cls = classes.find((c) => c.id === btn.dataset.closeClass);
      if (!cls) return;
      openCloseClass(cls, () => {
        renderClasses(el);
        flash(el, `Đã đóng lớp ${cls.className}.`);
      });
    })
  );
}

function openCloseClass(cls, onClosed) {
  openModal({
    title: "Đóng lớp học",
    body: `
      ${infoRow("Lớp học", escapeHtml(cls.className))}
      ${infoRow("Môn học", subjectLabel(cls.subject))}
      ${infoRow("Giáo viên dạy", escapeHtml(cls.teacherName))}
      ${infoRow("Lịch học", formatSchedule(cls.schedule))}
      ${infoRow("Sĩ số", `${cls.enrolled}/${cls.maxSlot}`)}
      <p class="muted">Lớp sẽ ngừng hoạt động và không còn hiển thị trên lịch học của học sinh, phụ huynh và giáo viên.</p>`,
    foot: `
      <button class="btn" data-close>Hủy</button>
      <button class="btn btn-warn" id="cls-close-confirm">Đóng lớp</button>`,
    onMount: (root, close) => {
      root.querySelector("#cls-close-confirm").addEventListener("click", () => {
        setClassStatus(cls.id, "closed");
        close();
        onClosed();
      });
    },
  });
}

function renderNotifications(el) {
  const requests = listClassRequests();
  const pending = requests.filter((r) => r.status === "pending").length;

  el.innerHTML = `
    <p class="admin-flash" id="admin-flash" hidden></p>

    <div class="panel">
      <div class="panel-head">
        <h2 class="panel-title">Yêu cầu từ giáo viên</h2>
        <span class="count-chip">${pending} chờ phê duyệt</span>
      </div>
      ${
        requests.length
          ? requests
              .map(
                (r) => `
                  <div class="row-item notif-item" data-request="${r.id}">
                    <div>
                      <strong class="row-title">${REQ_TYPE_LABELS[r.type] || "Yêu cầu"} · ${escapeHtml(r.cls.className)}</strong>
                      <span class="row-sub">
                        ${escapeHtml(r.teacher?.fullName || "—")}
                        <span class="badge subject">${subjectLabel(r.cls.subject)}</span>
                        ${formatDate(String(r.createdAt).slice(0, 10))}
                      </span>
                    </div>
                    <span class="row-end notif-end">
                      <span class="badge ${REQ_STATUS_BADGES[r.status]}">${REQ_STATUS_LABELS[r.status]}</span>
                      <button class="btn btn-sm btn-toggle" tabindex="-1">Xem chi tiết</button>
                    </span>
                  </div>`
              )
              .join("")
          : `<div class="empty">Chưa có yêu cầu nào từ giáo viên.</div>`
      }
    </div>
  `;

  el.querySelectorAll("[data-request]").forEach((row) =>
    row.addEventListener("click", () => {
      const req = requests.find((r) => r.id === row.dataset.request);
      if (!req) return;
      openRequestDetail(req, (message) => {
        renderNotifications(el);
        flash(el, message);
      });
    })
  );
}

function openRequestDetail(req, onDone) {
  const isRegister = req.type === "register";
  const statusRow = infoRow(
    "Trạng thái",
    `<span class="badge ${REQ_STATUS_BADGES[req.status]}">${REQ_STATUS_LABELS[req.status]}</span>`
  );

  const body = `
    ${infoRow("Lớp học", escapeHtml(req.cls.className))}
    ${infoRow("Môn học", subjectLabel(req.cls.subject))}
    ${infoRow("Giáo viên dạy", escapeHtml(req.teacher?.fullName || "—"))}
    ${
      isRegister
        ? `${infoRow("Thời gian học", dayLabels(req.cls.schedule))}
           ${infoRow("Khung giờ học", timeLabels(req.cls.schedule))}`
        : `<div class="modal-compare">
            <div class="cmp-box">
              <span class="cmp-label">Thời gian & khung giờ cũ</span>
              <div class="cmp-line">${dayLabels(req.oldSchedule)}</div>
              <div class="cmp-sub">${timeLabels(req.oldSchedule)}</div>
            </div>
            <div class="cmp-box new">
              <span class="cmp-label">Thời gian & khung giờ muốn đổi sang</span>
              <div class="cmp-line">${dayLabels(req.newSchedule)}</div>
              <div class="cmp-sub">${timeLabels(req.newSchedule)}</div>
            </div>
          </div>`
    }
    ${statusRow}
    <p class="form-error" id="req-error" role="alert" hidden></p>`;

  const foot =
    req.status === "pending"
      ? `
        <button class="btn" data-close>Đóng</button>
        <button class="btn btn-danger" id="req-reject">Từ chối</button>
        <button class="btn btn-primary" id="req-approve">Phê duyệt</button>`
      : `<button class="btn" data-close>Đóng</button>`;

  openModal({
    title: isRegister ? "Chi tiết đăng ký lớp" : "Chi tiết đổi lịch học",
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
        decide(
          approveClassRequest,
          isRegister
            ? "Đã phê duyệt — lớp học đã được kích hoạt."
            : "Đã phê duyệt — lịch học của lớp đã được cập nhật."
        )
      );

      root.querySelector("#req-reject")?.addEventListener("click", () =>
        decide(rejectClassRequest, "Đã từ chối yêu cầu.")
      );
    },
  });
}
