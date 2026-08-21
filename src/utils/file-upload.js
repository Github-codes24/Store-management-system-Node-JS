/**
 * Processes uploaded image file or URL string.
 * Returns file URL or base64 data URI string.
 *
 * @param {Object} file - Express Multer file object
 * @param {string} [fallbackUrl] - Existing URL string fallback
 * @returns {string|null} File URL / data string or null
 */
export const processUploadedFile = (file, fallbackUrl = null) => {
  if (file && file.buffer) {
    const base64 = file.buffer.toString('base64');
    return `data:${file.mimetype};base64,${base64}`;
  }

  if (typeof fallbackUrl === 'string' && fallbackUrl.trim().length > 0) {
    return fallbackUrl.trim();
  }

  return null;
};
