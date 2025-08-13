// helpers/pagination.js
export function getPaginationParams({ page = 1, pageSize = 10, maxPageSize = 100 }) {
  const take = Math.max(1, Math.min(Number(pageSize) || 1, maxPageSize));
  const skip = (Math.max(1, Number(page) || 1) - 1) * take;
  return { skip, take, page: Number(page), pageSize: take };
}
