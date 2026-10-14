// modules/materials/materials.service.js — Phụ trách: Thành viên D
import { DB } from "../../core/db.js";

export function attachMaterial(sessionId, { fileName, fileData }) {
  const session = DB.findById("sessions", sessionId);
  if (session) {
    const cls = DB.findById("classes", session.classId);
    if (cls && cls.status !== "open") {
      throw new Error(cls.status === "closed" ? "Lớp đã đóng" : "Lớp chưa được Admin duyệt");
    }
  }

  const material = DB.insert("materials", {
    sessionId,
    fileName,
    fileData, // base64 hoặc URL
    uploadedAt: new Date().toISOString(),
  });

  const refreshedSession = DB.findById("sessions", sessionId);
  const materials = [...(refreshedSession?.materials || []), material.id];
  DB.update("sessions", sessionId, { materials });

  return material;
}

export function listMaterialsBySession(sessionId) {
  return DB.getAll("materials").filter((m) => m.sessionId === sessionId);
}
