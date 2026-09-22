// core/db.js
// Lớp trừu tượng thao tác LocalStorage dùng chung cho toàn bộ hệ thống.
// TẤT CẢ module (auth, classes, enrollment, sessions, materials, grades, comments)
// đều thao tác dữ liệu qua đây, KHÔNG gọi localStorage trực tiếp ở nơi khác.

const PREFIX = "btm_";

function getAll(entity) {
  const raw = localStorage.getItem(PREFIX + entity);
  return raw ? JSON.parse(raw) : [];
}

function saveAll(entity, list) {
  localStorage.setItem(PREFIX + entity, JSON.stringify(list));
}

function insert(entity, item) {
  const list = getAll(entity);
  const newItem = { id: crypto.randomUUID(), ...item };
  list.push(newItem);
  saveAll(entity, list);
  return newItem;
}

function update(entity, id, patch) {
  const list = getAll(entity);
  const idx = list.findIndex((x) => x.id === id);
  if (idx === -1) return null;
  list[idx] = { ...list[idx], ...patch };
  saveAll(entity, list);
  return list[idx];
}

function remove(entity, id) {
  const list = getAll(entity).filter((x) => x.id !== id);
  saveAll(entity, list);
}

function findById(entity, id) {
  return getAll(entity).find((x) => x.id === id) || null;
}

function seedIfEmpty(entity, seedData) {
  const existing = localStorage.getItem(PREFIX + entity);
  if (!existing) saveAll(entity, seedData);
}

export const DB = { getAll, saveAll, insert, update, remove, findById, seedIfEmpty };
