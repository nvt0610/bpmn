import { keycloak } from "../keycloak-init.js";

// Dùng khi chỉ cần đăng nhập
export const login = keycloak.protect();

// Gộp: verify + check (PO OR ADMIN, v.v.)
export const realmAny = (...roles) => [
  keycloak.protect(), // verify & fill req.kauth
  (req, res, next) => {
    const rolesIn = req.kauth?.grant?.access_token?.content?.realm_access?.roles || [];
    return roles.some(r => rolesIn.includes(r)) ? next() : res.sendStatus(403);
  }
];

// (tuỳ chọn) tất cả roles đều phải có
export const realmAll = (...roles) => [
  keycloak.protect(),
  (req, res, next) => { 
    const rolesIn = req.kauth?.grant?.access_token?.content?.realm_access?.roles || [];
    return roles.every(r => rolesIn.includes(r)) ? next() : res.sendStatus(403);
  }
];

// (tuỳ chọn) attach user info
export const attachUser = (req, _res, next) => {
  const t = req.kauth?.grant?.access_token?.content;
  if (t) req.user = { id: t.sub, username: t.preferred_username, roles: t.realm_access?.roles || [] };
  next();
};
