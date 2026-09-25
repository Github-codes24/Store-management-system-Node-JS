export const successResponse = ({ success = true, message = 'success', data, pagination, ...extra } = {}) => ({ success, message, data, pagination, ...extra });
