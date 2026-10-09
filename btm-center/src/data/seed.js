// data/seed.js
// Dữ liệu khởi tạo mẫu: seed 1 lần khi app chạy lần đầu (nếu LocalStorage rỗng).
// Thành viên A phụ trách chỉnh sửa file này khi cần thêm dữ liệu demo.

import { DB } from "../core/db.js";
import { hashPassword } from "../core/hash.js";

const HASH_RE = /^[0-9a-f]{64}$/i;

function daysFromNow(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  const p = (x) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// Ngày mang ngày trong tuần `dayOfWeek` (2=T2 … 8=CN, khớp WEEKDAYS),
// lùi/tiến thêm `deltaWeeks` tuần; future=true thì luôn >= hôm nay,
// future=false thì luôn < hôm nay. Dùng để gán buổi học demo đúng theo lịch
// hằng tuần của lớp, nhờ đó phụ huynh xem lịch học thấy rõ giờ bắt đầu – kết thúc.
function onWeekday(dayOfWeek, deltaWeeks = 0, future = false) {
  const d = new Date();
  const cur = d.getDay() === 0 ? 8 : d.getDay() + 1;
  d.setDate(d.getDate() + (dayOfWeek - cur) + deltaWeeks * 7);
  const p = (x) => String(x).padStart(2, "0");
  const iso = () =>
    `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  const today = daysFromNow(0);
  if (future) {
    while (iso() < today) d.setDate(d.getDate() + 7);
  } else {
    while (iso() >= today) d.setDate(d.getDate() - 7);
  }
  return iso();
}

const DEFAULT_USERS = [
  {
    id: "admin-01",
    username: "admin",
    password: "admin123",
    role: "admin",
    fullName: "Quản trị viên",
    email: "admin@btm.edu.vn",
    gender: "Nam",
    dob: "1990-01-01",
    active: true,
  },
  {
    id: "t-toan",
    username: "teacher",
    password: "123456",
    role: "teacher",
    fullName: "Nguyễn Văn Hùng",
    email: "hung.nguyen@gmail.com",
    gender: "Nam",
    dob: "1988-05-12",
    subject: "Toan",
    active: true,
  },
  {
    id: "t-van",
    username: "covan",
    password: "123456",
    role: "teacher",
    fullName: "Trần Thị Lan",
    email: "lan.tran@gmail.com",
    gender: "Nữ",
    dob: "1990-09-03",
    subject: "Van",
    active: true,
  },
  {
    id: "t-anh",
    username: "coanh",
    password: "123456",
    role: "teacher",
    fullName: "Lê Minh Đức",
    email: "duc.le@gmail.com",
    gender: "Nam",
    dob: "1985-02-20",
    subject: "Anh",
    active: true,
  },
  {
    id: "s-01",
    username: "student",
    password: "123456",
    role: "student",
    fullName: "Phạm Thu Trang",
    email: "trang.pham@gmail.com",
    gender: "Nữ",
    dob: "2011-04-15",
    active: true,
  },
  {
    id: "s-02",
    username: "student2",
    password: "123456",
    role: "student",
    fullName: "Vũ Quang Huy",
    email: "huy.vu@gmail.com",
    gender: "Nam",
    dob: "2011-08-22",
    active: true,
  },
  {
    id: "s-03",
    username: "student3",
    password: "123456",
    role: "student",
    fullName: "Đặng Bảo Ngọc",
    email: "ngoc.dang@gmail.com",
    gender: "Nữ",
    dob: "2010-12-01",
    active: true,
  },
  // Tài khoản demo phụ huynh, liên kết với học sinh demo "student" (s-01).
  // Chỉ lưu studentId — mọi dữ liệu lớp/điểm/điểm danh đọc chung từ s-01.
  {
    id: "p-01",
    username: "parent",
    password: "123456",
    role: "parent",
    fullName: "Phụ huynh Phạm Thu Trang",
    email: "phuhuynh.trang@gmail.com",
    gender: "Nữ",
    dob: "1985-03-08",
    studentId: "s-01",
    active: true,
  },
];

const DEFAULT_CLASSES = [
  {
    id: "c-toan-9a",
    className: "Toán 9A",
    subject: "Toan",
    grade: 9,
    teacherId: "t-toan",
    maxSlot: 20,
    schedule: [
      { dayOfWeek: 3, start: "18:00", end: "19:30" },
      { dayOfWeek: 6, start: "18:00", end: "19:30" },
    ],
    status: "open",
  },
  {
    id: "c-van-9a",
    className: "Văn 9A",
    subject: "Van",
    grade: 9,
    teacherId: "t-van",
    maxSlot: 20,
    schedule: [{ dayOfWeek: 2, start: "18:00", end: "19:30" }],
    status: "open",
  },
  {
    id: "c-anh-9a",
    className: "Anh 9A",
    subject: "Anh",
    grade: 9,
    teacherId: "t-anh",
    maxSlot: 15,
    schedule: [
      { dayOfWeek: 4, start: "19:00", end: "20:30" },
      { dayOfWeek: 7, start: "09:00", end: "10:30" },
    ],
    status: "open",
  },
  {
    id: "c-toan-9b",
    className: "Toán 9B (LT)",
    subject: "Toan",
    grade: 9,
    teacherId: "t-toan",
    maxSlot: 18,
    schedule: [{ dayOfWeek: 5, start: "18:00", end: "19:30" }],
    status: "open",
  },
  // Lớp cố ý KHÔNG có buổi học nào (xem DEFAULT_SESSIONS): theo quy tắc sẵn có,
  // lớp đã có buổi học thì không thể hủy. Giữ một lớp trống như vậy để có thể demo
  // trọn vẹn luồng "học sinh gửi yêu cầu hủy → phụ huynh đồng ý / từ chối".
  {
    id: "c-toan-9c",
    className: "Toán 9C (chưa có buổi học)",
    subject: "Toan",
    grade: 9,
    teacherId: "t-toan",
    maxSlot: 20,
    schedule: [{ dayOfWeek: 7, start: "14:00", end: "15:30" }],
    status: "open",
  },
];

const DEFAULT_ENROLLMENTS = [
  { id: "e-1", classId: "c-toan-9a", studentId: "s-01", status: "active", registeredAt: daysFromNow(-20) },
  { id: "e-2", classId: "c-van-9a", studentId: "s-01", status: "active", registeredAt: daysFromNow(-18) },
  { id: "e-3", classId: "c-toan-9a", studentId: "s-02", status: "active", registeredAt: daysFromNow(-19) },
  { id: "e-4", classId: "c-anh-9a", studentId: "s-02", status: "active", registeredAt: daysFromNow(-15) },
  { id: "e-5", classId: "c-van-9a", studentId: "s-03", status: "active", registeredAt: daysFromNow(-14) },
  { id: "e-6", classId: "c-anh-9a", studentId: "s-03", status: "active", registeredAt: daysFromNow(-12) },
  { id: "e-7", classId: "c-toan-9b", studentId: "s-03", status: "active", registeredAt: daysFromNow(-10) },
  // Gán sẵn cho cả 3 học sinh để ai cũng demo được luồng hủy môn qua phụ huynh.
  { id: "e-8", classId: "c-toan-9c", studentId: "s-01", status: "active", registeredAt: daysFromNow(-3) },
  { id: "e-9", classId: "c-toan-9c", studentId: "s-02", status: "active", registeredAt: daysFromNow(-3) },
  { id: "e-10", classId: "c-toan-9c", studentId: "s-03", status: "active", registeredAt: daysFromNow(-3) },
];

const DEFAULT_SESSIONS = [
  // Ngày gán theo đúng ngày trong tuần mà lớp đang học (xem onWeekday) để
  // "Lịch học của con" hiển thị được giờ bắt đầu – kết thúc của buổi học.
  { id: "sess-1", classId: "c-toan-9a", date: onWeekday(3, 0, false), title: "Hàm số bậc nhất", materials: [] },
  { id: "sess-2", classId: "c-toan-9a", date: onWeekday(6, 0, true), title: "Phương trình bậc hai", materials: ["m-1"] },
  { id: "sess-3", classId: "c-van-9a", date: onWeekday(2, 1, true), title: "Văn nghị luận xã hội", materials: [] },
  { id: "sess-4", classId: "c-anh-9a", date: onWeekday(7, 0, true), title: "Grammar: Conditional sentences", materials: ["m-2"] },
  { id: "sess-5", classId: "c-anh-9a", date: onWeekday(7, 0, false), title: "Vocabulary: The environment", materials: [] },
  { id: "sess-6", classId: "c-toan-9b", date: onWeekday(5, 0, true), title: "Ôn tập Hình học", materials: [] },
];

const DEFAULT_ATTENDANCE = [
  { id: "att-1", sessionId: "sess-1", studentId: "s-01", status: "present" },
  { id: "att-2", sessionId: "sess-1", studentId: "s-02", status: "late" },
  { id: "att-3", sessionId: "sess-5", studentId: "s-02", status: "present" },
  { id: "att-4", sessionId: "sess-5", studentId: "s-03", status: "absent" },
];

const DEFAULT_MATERIALS = [
  {
    id: "m-1",
    sessionId: "sess-2",
    fileName: "PT-bac-hai.pdf",
    fileData: "https://drive.google.com/drive/u/0/my-drive",
    uploadedAt: daysFromNow(-1),
  },
  {
    id: "m-2",
    sessionId: "sess-4",
    fileName: "Conditional-sentences.pdf",
    fileData: "https://drive.google.com/drive/u/0/my-drive",
    uploadedAt: daysFromNow(-1),
  },
];

const DEFAULT_GRADES = [
  { id: "g-1", classId: "c-toan-9a", studentId: "s-01", type: "Thường xuyên", score: 8.5, note: "Kiểm tra miệng" },
  { id: "g-2", classId: "c-toan-9a", studentId: "s-01", type: "Định kỳ", score: 7.5, note: "Bài 1 tiết" },
  { id: "g-3", classId: "c-toan-9a", studentId: "s-02", type: "Thường xuyên", score: 6.0, note: "Kiểm tra miệng" },
  { id: "g-4", classId: "c-van-9a", studentId: "s-01", type: "Định kỳ", score: 9.0, note: "Bài 1 tiết" },
  { id: "g-5", classId: "c-anh-9a", studentId: "s-02", type: "Thường xuyên", score: 7.0, note: "Kiểm tra 15 phút" },
];

const DEFAULT_COMMENTS = [
  {
    id: "cm-1",
    classId: "c-toan-9a",
    studentId: "s-01",
    teacherId: "t-toan",
    content: "Em có tư duy tốt, cần chăm phát biểu hơn.",
    createdAt: daysFromNow(-3),
  },
  {
    id: "cm-2",
    classId: "c-toan-9a",
    studentId: "s-02",
    teacherId: "t-toan",
    content: "Cần ôn lại dạng bài phương trình để theo kịp lớp.",
    createdAt: daysFromNow(-3),
  },
];

const DEMO_PENDING_CLASS = {
  id: "c-demo-cho-duyet",
  className: "Toán 9D (chờ phê duyệt)",
  subject: "Toan",
  grade: 9,
  teacherId: "t-toan",
  maxSlot: 20,
  schedule: [
    { dayOfWeek: 4, start: "17:00", end: "18:30" },
    { dayOfWeek: 7, start: "08:00", end: "09:30" },
  ],
  status: "pending",
};

const DEFAULT_CLASS_REQUESTS = [
  {
    id: "cr-1",
    type: "register",
    classId: "c-demo-cho-duyet",
    teacherId: "t-toan",
    status: "pending",
    createdAt: daysFromNow(-1),
  },
  {
    id: "cr-2",
    type: "reschedule",
    classId: "c-van-9a",
    teacherId: "t-van",
    oldSchedule: [{ dayOfWeek: 2, start: "18:00", end: "19:30" }],
    newSchedule: [{ dayOfWeek: 5, start: "18:00", end: "19:30" }],
    status: "pending",
    createdAt: daysFromNow(0),
  },
];

function ensureEntity(entity, seedData) {
  if (DB.getAll(entity).length === 0) DB.saveAll(entity, seedData);
}

// Migration 1 lần: gỡ tài khoản đăng ký tay "Nguyễn Công Minh".
// Tài khoản này được tạo thủ công qua form đăng ký nên chỉ tồn tại trong
// LocalStorage của trình duyệt, không có trong seed — vì vậy phải dọn ở đây.
// Hàm chạy mỗi lần mở app nhưng tự thoát ngay nếu tài khoản đã bị gỡ.
const RETIRED_USERNAMES = ["Nguyễn Công Minh"];

function purgeRetiredUsers() {
  const users = DB.getAll("users");
  const retired = users.filter((u) => RETIRED_USERNAMES.includes(u.username));
  if (!retired.length) return;

  const ids = new Set(retired.map((u) => u.id));
  DB.saveAll("users", users.filter((u) => !ids.has(u.id)));

  // Dọn các bản ghi tham chiếu tới tài khoản bị gỡ (học sinh/giáo viên đã xoá).
  ["enrollments", "attendance", "grades", "comments", "cancel_requests"].forEach((entity) => {
    const rows = DB.getAll(entity);
    const kept = rows.filter((r) => !ids.has(r.studentId) && !ids.has(r.teacherId));
    if (kept.length !== rows.length) DB.saveAll(entity, kept);
  });
}

// Dọn mọi liên kết trỏ tới tài khoản không còn tồn tại. Hàm này KHÔNG phụ thuộc
// danh sách tài khoản cần gỡ nên tự đúng sau mọi lần xoá, kể cả khi dữ liệu được
// tạo ra sau đó (nếu kiểm tra nằm chung trong purgeRetiredUsers thì sẽ bị bỏ sót
// vì hàm đó return sớm khi tài khoản đã bị gỡ từ lần trước).
function cleanDanglingLinks() {
  const ids = new Set(DB.getAll("users").map((u) => u.id));

  // Lớp mà giáo viên đã bị xoá: bỏ liên kết nhưng GIỮ NGUYÊN lớp, buổi học, điểm.
  const classes = DB.getAll("classes");
  if (classes.some((c) => c.teacherId && !ids.has(c.teacherId))) {
    DB.saveAll(
      "classes",
      classes.map((c) => (c.teacherId && !ids.has(c.teacherId) ? { ...c, teacherId: null } : c))
    );
  }

  // Phụ huynh trỏ tới học sinh đã bị xoá: bỏ liên kết cho hợp lệ.
  const users = DB.getAll("users");
  if (users.some((u) => u.studentId && !ids.has(u.studentId))) {
    DB.saveAll(
      "users",
      users.map((u) => (u.studentId && !ids.has(u.studentId) ? { ...u, studentId: null } : u))
    );
  }
}

export function seedDatabase() {
  const users = DB.getAll("users");
  const missingDefaults = DEFAULT_USERS.filter(
    (u) => !users.some((x) => x.username === u.username)
  );

  // Luôn đảm bảo các tài khoản default tồn tại:
  // - LocalStorage chưa từng seed → seed toàn bộ.
  // - LocalStorage cũ chỉ có admin (thiếu teacher/student...) → bổ sung account còn thiếu,
  //   không ghi đè dữ liệu tài khoản người dùng đã tạo.
  if (users.length === 0) {
    DB.saveAll("users", DEFAULT_USERS);
  } else if (missingDefaults.length > 0) {
    DB.saveAll("users", [...users, ...missingDefaults]);
  }

  // Bổ sung trường còn thiếu (gender/email/dob) cho các tài khoản default đã tồn tại từ trước.
  const current = DB.getAll("users");
  const needBackfill = current.some((u) => {
    const def = DEFAULT_USERS.find((d) => d.username === u.username);
    return def && ((def.gender && !u.gender) || (def.email && !u.email) || (def.dob && !u.dob));
  });
  if (needBackfill) {
    DB.saveAll(
      "users",
      current.map((u) => {
        const def = DEFAULT_USERS.find((d) => d.username === u.username);
        return def
          ? { ...u, gender: u.gender || def.gender, email: u.email || def.email, dob: u.dob || def.dob }
          : u;
      })
    );
  }

  // Migration: chuyển mật khẩu lưu dạng văn bản thuần sang dạng hash (dữ liệu đăng ký cũ).
  const after = DB.getAll("users");
  const needHash = after.some((u) => u.password && !HASH_RE.test(String(u.password)));
  if (needHash) {
    DB.saveAll(
      "users",
      after.map((u) =>
        u.password && !HASH_RE.test(String(u.password))
          ? { ...u, password: hashPassword(u.password) }
          : u
      )
    );
  }

  purgeRetiredUsers();
  cleanDanglingLinks();

  // Nếu tài khoản default bị thiếu (dữ liệu cũ) → khôi phục luôn dữ liệu demo
  // cho các entity còn trống để hệ thống demo có thể dùng ngay.
  if (users.length === 0 || missingDefaults.length > 0) {
    ensureEntity("classes", DEFAULT_CLASSES);
    ensureEntity("enrollments", DEFAULT_ENROLLMENTS);
    ensureEntity("sessions", DEFAULT_SESSIONS);
    ensureEntity("attendance", DEFAULT_ATTENDANCE);
    ensureEntity("materials", DEFAULT_MATERIALS);
    ensureEntity("grades", DEFAULT_GRADES);
    ensureEntity("comments", DEFAULT_COMMENTS);
  }

  if (!DB.getAll("classes").some((c) => c.id === DEMO_PENDING_CLASS.id)) {
    DB.saveAll("classes", [...DB.getAll("classes"), DEMO_PENDING_CLASS]);
  }

  if (DB.getAll("class_requests").length === 0) {
    const classIds = new Set(DB.getAll("classes").map((c) => c.id));
    const demoRequests = DEFAULT_CLASS_REQUESTS.filter((r) => classIds.has(r.classId));
    if (demoRequests.length) DB.saveAll("class_requests", demoRequests);
  }
}