export function successResponse<T>(data: T) {
  return { success: true, data };
}

export function listResponse<T>(
  data: T[],
  meta: { page: number; limit: number; total: number },
) {
  return { success: true, data, meta };
}
