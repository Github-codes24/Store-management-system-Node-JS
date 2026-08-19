export const getPagination = ({ page = 1, limit = 10, total }) => {
  const safePage = Number(page);
  const safeLimit = Number(limit);
  const safeTotal = Number(total);
  const totalPages = Math.ceil(safeTotal / safeLimit);
  
  return {
    skip: (safePage - 1) * safeLimit,
    limit: safeLimit,
    totalItems: safeTotal,
    page: safePage,
    totalPages,
    hasPreviousPage: safePage > 1,
    hasNextPage: safePage < totalPages,
  };
};
