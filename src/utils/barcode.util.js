/**
 * Generates a standard 13-digit EAN-style barcode number string
 * Example: 890 + 9 random/timestamp digits + check digit
 */
export const generateBarcode = () => {
  const prefix = '890';
  const random = Math.floor(Math.random() * 1000000000)
    .toString()
    .padStart(9, '0');
  const codeWithoutChecksum = `${prefix}${random}`;

  // Calculate EAN-13 check digit
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(codeWithoutChecksum[i], 10);
    sum += i % 2 === 0 ? digit : digit * 3;
  }
  const checkDigit = (10 - (sum % 10)) % 10;

  return `${codeWithoutChecksum}${checkDigit}`;
};

/**
 * Validates basic barcode string format
 * @param {string} barcode
 * @returns {boolean}
 */
export const isValidBarcode = (barcode) => {
  if (typeof barcode !== 'string') return false;
  const trimmed = barcode.trim();
  return trimmed.length >= 4 && trimmed.length <= 50 && /^[a-zA-Z0-9_-]+$/.test(trimmed);
};
