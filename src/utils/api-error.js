export default class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export const notFound = (message) => new ApiError(404, message || 'Not found');
export const badRequest = (message) => new ApiError(400, message || 'Bad request');
export const forbidden = (message) => new ApiError(403, message || 'Forbidden');
export const unauthorized = (message) => new ApiError(401, message || 'Unauthorized');
export const conflict = (message) => new ApiError(409, message || 'Conflict');
export const internal = (message) => new ApiError(500, message || 'Internal server error');
export const serviceUnavailable = (message) => new ApiError(503, message || 'Service unavailable');
export const tooManyRequests = (message) => new ApiError(429, message || 'Too many requests');
