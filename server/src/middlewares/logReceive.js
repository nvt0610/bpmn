import { randomUUID } from "crypto";

export function attachCorrelationId(req, res, next) {
  const headerCid = req.headers["x-correlation-id"];
  req.correlationId = typeof headerCid === "string" && headerCid.trim()
    ? headerCid.trim()
    : randomUUID();
  res.setHeader("x-correlation-id", req.correlationId);
  next();
}
