import PDFDocument from 'pdfkit';
import JsBarcode from 'jsbarcode';

/**
 * Code 128 Character Patterns (Indices 0 to 102)
 */
const CODE128_PATTERNS = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213",
  "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132",
  "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211",
  "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313",
  "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331",
  "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111",
  "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214",
  "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111",
  "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141",
  "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141",
  "114131", "311141", "411131"
];

/**
 * Returns an optimized 0/1 binary bit sequence for Code 128 encoding (Auto Set A/B/C)
 * @param {string} text 
 * @returns {string} Bit string of 1s (bars) and 0s (spaces)
 */
export const getCode128BitString = (text) => {
  const safeText = String(text || '1234567890123').trim();
  try {
    const CODE128 = JsBarcode.getModule('CODE128');
    const enc = new CODE128(safeText, {});
    if (enc.valid()) {
      const res = enc.encode();
      if (res && res.data) return res.data;
    }
  } catch {
    // fallback
  }

  const startCodeB = 104;
  const values = [startCodeB];
  let checkSum = startCodeB;
  for (let i = 0; i < safeText.length; i++) {
    const code = safeText.charCodeAt(i) - 32;
    const val = code >= 0 && code <= 95 ? code : 0;
    values.push(val);
    checkSum += val * (i + 1);
  }
  const checkDigit = checkSum % 103;
  values.push(checkDigit);

  const fullPatterns = [...CODE128_PATTERNS, "211412", "211214", "211232", "2331112"];
  let sequence = "";
  for (const val of values) {
    const pat = fullPatterns[val] || "121212";
    for (let p = 0; p < pat.length; p++) {
      const count = parseInt(pat[p], 10);
      sequence += (p % 2 === 0 ? "1" : "0").repeat(count);
    }
  }
  sequence += "1100011101011"; // Stop sequence
  return sequence;
};

/**
 * Generates a standard 13-digit EAN-style barcode number string
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
 */
export const isValidBarcode = (barcode) => {
  if (typeof barcode !== 'string') return false;
  const trimmed = barcode.trim();
  return trimmed.length >= 4 && trimmed.length <= 50 && /^[a-zA-Z0-9_-]+$/.test(trimmed);
};

/**
 * Generates full-length SVG representation string of barcode bars
 * @param {string} barcodeStr 
 * @returns {string} SVG string
 */
export const generateBarcodeSvg = (barcodeStr) => {
  const code = (barcodeStr || '1234567890123').toString().trim();
  const bitSequence = getCode128BitString(code);
  const width = 200;
  const height = 50;

  const unitW = width / bitSequence.length;
  let barsHtml = '';
  let inBar = false;
  let startIdx = 0;

  for (let i = 0; i <= bitSequence.length; i++) {
    const char = bitSequence[i];
    if (char === '1') {
      if (!inBar) {
        inBar = true;
        startIdx = i;
      }
    } else {
      if (inBar) {
        const barW = (i - startIdx) * unitW;
        barsHtml += `<rect x="${(startIdx * unitW).toFixed(2)}" y="5" width="${barW.toFixed(2)}" height="${height - 18}" fill="#000000" shape-rendering="crispEdges" />`;
        inBar = false;
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" shape-rendering="crispEdges">
    <rect width="100%" height="100%" fill="#ffffff"/>
    ${barsHtml}
    <text x="${width / 2}" y="${height - 2}" font-family="Arial, sans-serif" font-size="10" font-weight="bold" letter-spacing="1.5" text-anchor="middle" fill="#000000">${code}</text>
  </svg>`;
};

/**
 * Helper to render Code 128 black rectangular bars onto a PDFDocument
 */
const renderBarcodeBars = (doc, bitSequence, startX, startY, unitW, height) => {
  doc.fillColor('#000000');
  let inBar = false;
  let startIdx = 0;

  for (let s = 0; s <= bitSequence.length; s++) {
    if (bitSequence[s] === '1') {
      if (!inBar) {
        inBar = true;
        startIdx = s;
      }
    } else {
      if (inBar) {
        const barW = (s - startIdx) * unitW;
        const barX = startX + startIdx * unitW;
        doc.rect(barX, startY, barW, height).fill('#000000');
        inBar = false;
      }
    }
  }
};

/**
 * Generates a PDF buffer containing printable barcode labels.
 * Defaults to 50x25 mm 2-up thermal roll format (each row has two 50x25 mm stickers with a 5 mm gap).
 * Also supports standard A4 3-column sheet when options.size === 'a4'.
 * 
 * @param {Object} product - Product details (productName, barcode, mrp, offlineSellingPrice, onlineSellingPrice)
 * @param {number} quantity - Number of barcode labels to generate
 * @param {Object} [options] - Options ({ size: '50x25' | 'a4' })
 * @returns {Promise<Buffer>} PDF Buffer
 */
export const generateBarcodePdfBuffer = async (product, quantity = 1, options = {}) => {
  return new Promise((resolve, reject) => {
    const isA4 = options.size === 'a4' || options.format === 'a4';
    const printableCount = Math.max(1, parseInt(quantity, 10) || 1);
    const barcodeStr = String(product.barcode || '8900000000000').trim();
    const bitSequence = getCode128BitString(barcodeStr);

    const mrpNum = Number(product.mrp || 0);
    const sellNum = Number(product.offlineSellingPrice || product.onlineSellingPrice || 0);
    let priceText = `MRP: Rs. ${mrpNum.toLocaleString('en-IN')}`;
    if (sellNum > 0 && sellNum !== mrpNum) {
      priceText = `MRP: Rs. ${mrpNum.toLocaleString('en-IN')} | Sale: Rs. ${sellNum.toLocaleString('en-IN')}`;
    }
    const prodTitle = String(product.productName || 'Product').substring(0, 32);

    if (isA4) {
      // Standard A4 sheet: 3 columns x 7 rows = 21 labels per page
      const doc = new PDFDocument({ margin: 20, size: 'A4' });
      const buffers = [];
      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', (err) => reject(err));

      const labelWidth = 165;
      const labelHeight = 90;
      const cols = 3;
      const startX = 28;
      const startY = 28;
      const gapX = 18;
      const gapY = 18;

      for (let i = 0; i < printableCount; i++) {
        if (i > 0 && i % 21 === 0) {
          doc.addPage();
        }

        const pageIndex = i % 21;
        const row = Math.floor(pageIndex / cols);
        const col = pageIndex % cols;

        const x = startX + col * (labelWidth + gapX);
        const y = startY + row * (labelHeight + gapY);

        doc.roundedRect(x, y, labelWidth, labelHeight, 5).lineWidth(1).stroke('#000000');

        doc
          .font('Helvetica-Bold')
          .fontSize(9.5)
          .fillColor('#000000')
          .text(prodTitle, x + 6, y + 8, {
            width: labelWidth - 12,
            align: 'center',
            ellipsis: true,
          });

        doc
          .font('Helvetica-Bold')
          .fontSize(7.5)
          .fillColor('#222222')
          .text(priceText, x + 6, y + 21, {
            width: labelWidth - 12,
            align: 'center',
          });

        const availableBarcodeWidth = labelWidth - 20;
        const unitBarWidth = availableBarcodeWidth / bitSequence.length;
        const barStartX = x + 10;
        const barStartY = y + 33;
        const barHeight = 32;

        renderBarcodeBars(doc, bitSequence, barStartX, barStartY, unitBarWidth, barHeight);

        doc
          .font('Helvetica-Bold')
          .fontSize(8.5)
          .fillColor('#000000')
          .text(barcodeStr, x + 6, y + 70, {
            width: labelWidth - 12,
            align: 'center',
            characterSpacing: 1.5,
          });
      }

      doc.end();
    } else {
      // 50x25 mm (2-Up Thermal Roll with 5 mm space between columns)
      // 1 mm = 72 / 25.4 = 2.83464567 pt
      // Sticker 1: 50mm (141.73 pt) x 25mm (70.87 pt)
      // Gap: 5mm (14.17 pt)
      // Sticker 2: 50mm (141.73 pt) x 25mm (70.87 pt)
      // Total Page Width: 105mm (297.64 pt), Page Height: 25mm (70.87 pt)
      const MM_TO_PT = 72 / 25.4;
      const labelW = 50 * MM_TO_PT;   // 141.732 pt
      const labelH = 25 * MM_TO_PT;   // 70.866 pt
      const colGap = 5 * MM_TO_PT;    // 14.173 pt
      const pageW = 105 * MM_TO_PT;   // 297.638 pt
      const pageH = 25 * MM_TO_PT;    // 70.866 pt

      const doc = new PDFDocument({
        autoFirstPage: false,
        margin: 0,
      });
      const buffers = [];
      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', (err) => reject(err));

      const totalRows = Math.ceil(printableCount / 2);

      const brandName = (product.brand?.name || product.brandName || '').toString().trim();

      for (let r = 0; r < totalRows; r++) {
        doc.addPage({
          size: [pageW, pageH],
          margins: { top: 0, bottom: 0, left: 0, right: 0 },
        });

        for (let c = 0; c < 2; c++) {
          const itemIdx = r * 2 + c;
          if (itemIdx >= printableCount) break;

          const stickerX = c === 0 ? 0 : labelW + colGap;

          if (brandName) {
            // Brand Name
            doc
              .font('Helvetica-Bold')
              .fontSize(6.5)
              .fillColor('#000000')
              .text(brandName.toUpperCase(), stickerX + 2, 2.5, {
                width: labelW - 4,
                align: 'center',
                ellipsis: true,
                lineBreak: false,
              });

            // Product Name
            doc
              .font('Helvetica-Bold')
              .fontSize(8)
              .fillColor('#000000')
              .text(prodTitle, stickerX + 2, 10, {
                width: labelW - 4,
                align: 'center',
                ellipsis: true,
                lineBreak: false,
              });

            // Price (MRP / Sale)
            doc
              .font('Helvetica-Bold')
              .fontSize(7.5)
              .fillColor('#000000')
              .text(priceText, stickerX + 2, 19.5, {
                width: labelW - 4,
                align: 'center',
                lineBreak: false,
              });

            // Barcode Bars (41mm width centered on 50mm sticker with 4.5mm safe margins)
            const availableBarcodeWidth = 41 * MM_TO_PT;
            const unitBarWidth = availableBarcodeWidth / bitSequence.length;
            const barStartX = stickerX + (labelW - availableBarcodeWidth) / 2;
            const barStartY = 28;
            const barHeight = 27;

            renderBarcodeBars(doc, bitSequence, barStartX, barStartY, unitBarWidth, barHeight);

            // Barcode Numeric String
            doc
              .font('Helvetica-Bold')
              .fontSize(8)
              .fillColor('#000000')
              .text(barcodeStr, stickerX + 2, 57, {
                width: labelW - 4,
                align: 'center',
                characterSpacing: 1.5,
                lineBreak: false,
              });
          } else {
            // Product Name (top)
            doc
              .font('Helvetica-Bold')
              .fontSize(8.5)
              .fillColor('#000000')
              .text(prodTitle, stickerX + 2, 4, {
                width: labelW - 4,
                align: 'center',
                ellipsis: true,
                lineBreak: false,
              });

            // Price (MRP / Sale)
            doc
              .font('Helvetica-Bold')
              .fontSize(8)
              .fillColor('#000000')
              .text(priceText, stickerX + 2, 15, {
                width: labelW - 4,
                align: 'center',
                lineBreak: false,
              });

            // Barcode Bars (41mm width centered on 50mm sticker with 4.5mm safe margins)
            const availableBarcodeWidth = 41 * MM_TO_PT;
            const unitBarWidth = availableBarcodeWidth / bitSequence.length;
            const barStartX = stickerX + (labelW - availableBarcodeWidth) / 2;
            const barStartY = 26;
            const barHeight = 28;

            renderBarcodeBars(doc, bitSequence, barStartX, barStartY, unitBarWidth, barHeight);

            // Barcode Numeric String
            doc
              .font('Helvetica-Bold')
              .fontSize(8.5)
              .fillColor('#000000')
              .text(barcodeStr, stickerX + 2, 56.5, {
                width: labelW - 4,
                align: 'center',
                characterSpacing: 1.5,
                lineBreak: false,
              });
          }
        }
      }

      doc.end();
    }
  });
};
