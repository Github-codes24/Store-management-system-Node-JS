import PDFDocument from 'pdfkit';

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

/**
 * Generates an SVG representation string of barcode bars for rendering in UI or PDFs
 * @param {string} barcodeStr 
 * @returns {string} SVG string
 */
export const generateBarcodeSvg = (barcodeStr) => {
  const code = (barcodeStr || '1234567890123').toString();
  const width = 200;
  const height = 50;

  let barsHtml = '';
  let x = 10;
  for (let i = 0; i < code.length; i++) {
    const charCode = code.charCodeAt(i);
    const barWidth = (charCode % 3) + 1;
    const isBar = i % 2 === 0;
    if (isBar) {
      barsHtml += `<rect x="${x}" y="5" width="${barWidth}" height="${height - 15}" fill="#000000" />`;
    }
    x += barWidth + (i % 2 === 0 ? 1 : 2);
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <rect width="100%" height="100%" fill="#ffffff"/>
    ${barsHtml}
    <text x="${width / 2}" y="${height - 2}" font-family="Arial, sans-serif" font-size="10" text-anchor="middle" fill="#000000">${code}</text>
  </svg>`;
};

/**
 * Generates a PDF buffer containing printable barcode labels for a product
 * @param {Object} product - Product details (productName, barcode, mrp, onlineSellingPrice)
 * @param {number} quantity - Number of barcode labels to generate (e.g. 100)
 * @returns {Promise<Buffer>} PDF Buffer
 */
export const generateBarcodePdfBuffer = async (product, quantity = 1) => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 20, size: 'A4' });
    const buffers = [];

    doc.on('data', (chunk) => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', (err) => reject(err));

    const labelWidth = 160;
    const labelHeight = 85;
    const cols = 3;
    const startX = 30;
    const startY = 30;
    const gapX = 20;
    const gapY = 20;

    const printableCount = Math.max(1, parseInt(quantity, 10) || 1);

    for (let i = 0; i < printableCount; i++) {
      if (i > 0 && i % 24 === 0) {
        doc.addPage();
      }

      const pageIndex = i % 24;
      const row = Math.floor(pageIndex / cols);
      const col = pageIndex % cols;

      const x = startX + col * (labelWidth + gapX);
      const y = startY + row * (labelHeight + gapY);

      // Label border
      doc.roundedRect(x, y, labelWidth, labelHeight, 4).stroke('#cccccc');

      // Product Name
      doc
        .font('Helvetica-Bold')
        .fontSize(9)
        .fillColor('#000000')
        .text((product.productName || 'Product').substring(0, 24), x + 5, y + 6, {
          width: labelWidth - 10,
          align: 'center',
          ellipsis: true,
        });

      // Price display
      const priceText = product.onlineSellingPrice
        ? `MRP: ₹${product.mrp || product.onlineSellingPrice} | Price: ₹${product.onlineSellingPrice}`
        : `MRP: ₹${product.mrp || 0}`;
      
      doc
        .font('Helvetica')
        .fontSize(7)
        .fillColor('#333333')
        .text(priceText, x + 5, y + 18, {
          width: labelWidth - 10,
          align: 'center',
        });

      // Barcode bars representation
      const barcodeStr = product.barcode || '8900000000000';
      const barStartY = y + 28;
      let barX = x + 15;
      const barHeight = 28;

      doc.fillColor('#000000');
      for (let b = 0; b < barcodeStr.length; b++) {
        const charCode = barcodeStr.charCodeAt(b);
        const w = (charCode % 2) + 1;
        if (b % 2 === 0) {
          doc.rect(barX, barStartY, w, barHeight).fill('#000000');
        }
        barX += w + 1;
      }

      // Barcode numeric string below bars
      doc
        .font('Helvetica')
        .fontSize(8)
        .fillColor('#000000')
        .text(barcodeStr, x + 5, y + 60, {
          width: labelWidth - 10,
          align: 'center',
        });
    }

    doc.end();
  });
};
