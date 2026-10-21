// data/constants.js
// Hằng số dùng chung toàn hệ thống: danh sách môn học, khối lớp, trạng thái...

export const SUBJECTS = ["Toan", "Van", "Anh"];

export const SUBJECT_LABELS = {
  Toan: "Toán",
  Van: "Văn",
  Anh: "Anh",
};

export const GRADE = 9; // Chỉ hỗ trợ khối 9

export const ROLES = {
  ADMIN: "admin",
  TEACHER: "teacher",
  STUDENT: "student",
  PARENT: "parent",
};

export const ATTENDANCE_STATUS = {
  PRESENT: "present",
  ABSENT: "absent",
  LATE: "late",
};

export const CLASS_STATUS = {
  OPEN: "open",
  CLOSED: "closed",
};

export const WEEKDAYS = [
  { value: 2, label: "Thứ 2" },
  { value: 3, label: "Thứ 3" },
  { value: 4, label: "Thứ 4" },
  { value: 5, label: "Thứ 5" },
  { value: 6, label: "Thứ 6" },
  { value: 7, label: "Thứ 7" },
  { value: 8, label: "Chủ nhật" },
];

export const ATTENDANCE_LABELS = {
  present: "Có mặt",
  absent: "Vắng",
  late: "Trễ",
};

export const GRADE_TYPES = ["Thường xuyên", "Định kỳ", "Học kỳ"];

export function subjectLabel(subject) {
  return SUBJECT_LABELS[subject] || subject || "—";
}

export function todayStr() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// Thứ trong tuần theo quy ước của hệ thống: 2 = Thứ 2 … 7 = Thứ 7, 8 = Chủ nhật
export function weekdayOf(dateStr) {
  if (!dateStr) return 0;
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return 0;
  const js = d.getDay(); // 0 = Chủ nhật, 1 = Thứ 2 … 6 = Thứ 7
  return js === 0 ? 8 : js + 1;
}

// Nhãn thứ trong tuần: weekdayLabel(3) → "Thứ 3"
export function weekdayLabel(value) {
  return WEEKDAYS.find((w) => w.value === Number(value))?.label || `Thứ ${value}`;
}

// Cộng/trừ số ngày vào một chuỗi ngày YYYY-MM-DD
export function addDays(dateStr, days) {
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  d.setDate(d.getDate() + days);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function formatDate(iso) {
  if (!iso) return "—";
  const [y, m, d] = String(iso).split("-");
  return `${d}/${m}/${y}`;
}
