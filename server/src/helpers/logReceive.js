//logReceive.js
// ESM
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "crypto";

let prisma;
function db() {
  if (!prisma) prisma = new PrismaClient();
  return prisma;
}

/**
 * Ghi log vào AppLog
 * @param {Object} p
 * @param {'DEBUG'|'INFO'|'WARN'|'ERROR'} [p.level='INFO']
 * @param {string} p.message
 * @param {object} [p.context]  // dữ liệu phụ (payload, error...)
 * @param {string} [p.correlationId]  // nếu không truyền sẽ random
 * @param {string} [p.source='api']   // tên service/route
 */
export async function logReceive({
  level = "INFO",
  message,
  context,
  correlationId,
  source = "api",
} = {}) {
  if (!message) return;
  const cid = correlationId || randomUUID();
  try {
    await db().appLog.create({
      data: { level, message, context, correlationId: cid, source },
    });
  } catch (e) {
    // không throw để không ảnh hưởng flow API
    // console.error("logReceive failed:", e?.message);
  }
  return cid;
}

// Sugar API
export const Log = {
  info: (message, context, opts) =>
    logReceive({ level: "INFO", message, context, ...(opts || {}) }),
  warn: (message, context, opts) =>
    logReceive({ level: "WARN", message, context, ...(opts || {}) }),
  error: (message, context, opts) =>
    logReceive({ level: "ERROR", message, context, ...(opts || {}) }),
  debug: (message, context, opts) =>
    logReceive({ level: "DEBUG", message, context, ...(opts || {}) }),
};
