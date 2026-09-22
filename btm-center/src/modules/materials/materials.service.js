// modules/materials/materials.service.js — Phụ trách: Thành viên D
import { DB } from "../../core/db.js";

export function attachMaterial(sessionId, { fileName, fileData }) {
  const material = DB.insert("materials", {
    sessionId,
    fileName,
    fileData, // base64 hoặc URL
    uploadedAt: new Date().toISOString(),
  });

  const session = DB.findById("sessions", sessionId);
  const materials = [...(session.materials || []), material.id];
  DB.update("sessions", sessionId, { materials });

  return material;
}

export function listMaterialsBySession(sessionId) {
  return DB.getAll("materials").filter((m) => m.sessionId === sessionId);
}
