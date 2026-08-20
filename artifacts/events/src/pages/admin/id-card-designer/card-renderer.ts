import QRCode from "qrcode";
import { jsPDF } from "jspdf";
import type { IdCardDesignData, PlaceholderConfig, CardAttendee, SheetLayoutConfig, CardSide } from "./types";

/**
 * Calculates physical pixel dimensions at given DPI
 */
export function getCardPixelDimensions(widthInches: number, heightInches: number, dpi: number = 300) {
  return {
    widthPx: Math.round(widthInches * dpi),
    heightPx: Math.round(heightInches * dpi),
    aspectRatio: widthInches / heightInches,
  };
}

/**
 * Loads an image from URL or dataURI into an HTMLImageElement
 */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = src;
  });
}

/**
 * Generates a QR Code as an image data URL for a given string
 */
async function generateQrDataUrl(
  text: string,
  errorCorrection: "L" | "M" | "Q" | "H" = "M",
  margin: number = 1,
  color: string = "#000000",
  bgColor: string = "#FFFFFF"
): Promise<string> {
  return QRCode.toDataURL(text, {
    errorCorrectionLevel: errorCorrection,
    margin,
    color: {
      dark: color || "#000000",
      light: bgColor || "#FFFFFF",
    },
    width: 600,
  });
}

/**
 * Renders a complete high-resolution ID card (Front or Back side) onto an HTMLCanvasElement
 */
export async function renderCardToCanvas(
  design: IdCardDesignData,
  attendee: Partial<CardAttendee>,
  targetCanvas: HTMLCanvasElement,
  dpi: number = 300,
  side: CardSide = "front"
): Promise<void> {
  const widthInches = parseFloat(design.widthInches) || 3.46;
  const heightInches = parseFloat(design.heightInches) || 5.51;
  const { widthPx, heightPx } = getCardPixelDimensions(widthInches, heightInches, dpi);

  targetCanvas.width = widthPx;
  targetCanvas.height = heightPx;

  const ctx = targetCanvas.getContext("2d");
  if (!ctx) throw new Error("Could not get 2D rendering context");

  const templateImgUrl = side === "back" ? design.backTemplateImageUrl : design.templateImageUrl;
  const placeholdersToRender = side === "back" ? (design.backPlaceholders || []) : (design.placeholders || []);

  // 1. Draw Template Image or Default Backdrop
  if (templateImgUrl) {
    try {
      const img = await loadImage(templateImgUrl);
      ctx.drawImage(img, 0, 0, widthPx, heightPx);
    } catch {
      drawFallbackBackground(ctx, widthPx, heightPx, side);
    }
  } else {
    drawFallbackBackground(ctx, widthPx, heightPx, side);
  }

  // 2. Render Placeholders for this side
  for (const ph of placeholdersToRender) {
    const x = (ph.xPercent / 100) * widthPx;
    const y = (ph.yPercent / 100) * heightPx;
    const w = (ph.widthPercent / 100) * widthPx;
    const h = (ph.heightPercent / 100) * heightPx;

    if (ph.type === "qr_code") {
      const regNo = attendee.registrationNumber || "OS-0000";
      const qrData = `https://events.sankaraeye.in/q/${encodeURIComponent(regNo)}`;
      try {
        const qrUrl = await generateQrDataUrl(
          qrData,
          ph.qrErrorCorrection || "M",
          ph.qrMargin || 1,
          ph.qrColor || "#000000",
          ph.qrBgColor || "#FFFFFF"
        );
        const qrImg = await loadImage(qrUrl);
        // Draw centered inside placeholder boundary
        const qrSize = Math.min(w, h);
        const qrX = x + (w - qrSize) / 2;
        const qrY = y + (h - qrSize) / 2;
        ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);
      } catch (err) {
        console.error("Failed to render QR Code on card canvas", err);
      }
    } else {
      // Text Placeholder
      let textValue = "";
      if (ph.type === "name") {
        textValue = attendee.name && attendee.name !== "Unassigned Pass" ? attendee.name : ph.customSampleText || "Dr. Sample Delegate";
      } else if (ph.type === "organization") {
        textValue = attendee.institution && attendee.institution !== "Unassigned Physical Card" ? attendee.institution : ph.customSampleText || "Sankara Eye Hospital";
      } else if (ph.type === "id_number") {
        textValue = attendee.registrationNumber || ph.customSampleText || "VISION26-00101";
      } else {
        textValue = ph.customSampleText || ph.label;
      }

      if (ph.textTransform === "uppercase") {
        textValue = textValue.toUpperCase();
      } else if (ph.textTransform === "lowercase") {
        textValue = textValue.toLowerCase();
      } else if (ph.textTransform === "capitalize") {
        textValue = textValue.replace(/\b\w/g, (c) => c.toUpperCase());
      }

      ctx.save();
      // Font scale factor based on 300 DPI (72 pt per inch)
      const pt = ph.fontSizePt || 16;
      const fontPx = Math.round((pt * dpi) / 72);
      const weight = ph.fontWeight === "bold" ? "700" : ph.fontWeight === "black" ? "900" : ph.fontWeight === "semibold" ? "600" : "500";
      const fontFamily = ph.fontFamily || "Inter, system-ui, sans-serif";

      ctx.font = `${weight} ${fontPx}px ${fontFamily}`;
      ctx.fillStyle = ph.color || (templateImgUrl ? "#000000" : "#FFFFFF");
      ctx.textBaseline = "middle";

      let textX = x;
      if (ph.align === "center") {
        ctx.textAlign = "center";
        textX = x + w / 2;
      } else if (ph.align === "right") {
        ctx.textAlign = "right";
        textX = x + w;
      } else {
        ctx.textAlign = "left";
      }

      const textY = y + h / 2;

      // Truncate text if it exceeds width
      if (ph.truncate) {
        let displayStr = textValue;
        while (ctx.measureText(displayStr).width > w && displayStr.length > 3) {
          displayStr = displayStr.slice(0, -2) + "…";
        }
        ctx.fillText(displayStr, textX, textY);
      } else {
        ctx.fillText(textValue, textX, textY, w);
      }

      ctx.restore();
    }
  }
}

function drawFallbackBackground(ctx: CanvasRenderingContext2D, widthPx: number, heightPx: number, side: CardSide) {
  // Gradient Slate / Navy
  const grad = ctx.createLinearGradient(0, 0, widthPx, heightPx);
  if (side === "back") {
    grad.addColorStop(0, "#16161B");
    grad.addColorStop(1, "#0D0D10");
  } else {
    grad.addColorStop(0, "#18181B");
    grad.addColorStop(1, "#09090B");
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, widthPx, heightPx);

  // Border Accent
  ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
  ctx.lineWidth = Math.round(widthPx * 0.005);
  ctx.strokeRect(10, 10, widthPx - 20, heightPx - 20);
}

/**
 * Downloads a single high-resolution PNG file for an attendee card (Front or Back)
 */
export async function downloadSingleCardPng(
  design: IdCardDesignData,
  attendee: Partial<CardAttendee>,
  side: CardSide = "front"
): Promise<void> {
  const canvas = document.createElement("canvas");
  await renderCardToCanvas(design, attendee, canvas, 300, side);

  const dataUrl = canvas.toDataURL("image/png");
  const link = document.createElement("a");
  const regNo = attendee.registrationNumber || "ID-Card";
  link.download = `ID_Card_${regNo}_${side}.png`;
  link.href = dataUrl;
  link.click();
}

/**
 * Downloads a single print-ready PDF at exact physical dimensions (300 DPI)
 * If double-sided is enabled, creates a 2-page PDF (Page 1 = Front, Page 2 = Back).
 */
export async function downloadSingleCardPdf(design: IdCardDesignData, attendee: Partial<CardAttendee>): Promise<void> {
  const widthInches = parseFloat(design.widthInches) || 3.46;
  const heightInches = parseFloat(design.heightInches) || 5.51;
  const orientation = widthInches >= heightInches ? "landscape" : "portrait";

  const pdf = new jsPDF({
    orientation,
    unit: "in",
    format: [widthInches, heightInches],
  });

  // 1. Render Front Side (Page 1)
  const frontCanvas = document.createElement("canvas");
  await renderCardToCanvas(design, attendee, frontCanvas, 300, "front");
  const frontImg = frontCanvas.toDataURL("image/png");
  pdf.addImage(frontImg, "PNG", 0, 0, widthInches, heightInches);

  // 2. Render Back Side (Page 2) if double-sided
  if (design.isDoubleSided) {
    pdf.addPage([widthInches, heightInches], orientation);
    const backCanvas = document.createElement("canvas");
    await renderCardToCanvas(design, attendee, backCanvas, 300, "back");
    const backImg = backCanvas.toDataURL("image/png");
    pdf.addImage(backImg, "PNG", 0, 0, widthInches, heightInches);
  }

  const regNo = attendee.registrationNumber || "ID-Card";
  pdf.save(`ID_Card_${regNo}_${design.isDoubleSided ? "2Sided" : "1Sided"}.pdf`);
}

/**
 * Generates and downloads a multi-page Print-Ready Sheet PDF (A4/A3 with 1-Sided, Duplex, or Side-by-Side Folding)
 */
export async function generateBatchPrintPdf(
  design: IdCardDesignData,
  attendees: CardAttendee[],
  sheetConfig: SheetLayoutConfig,
  onProgress?: (current: number, total: number) => void
): Promise<void> {
  const cardWidthInches = parseFloat(design.widthInches) || 3.46;
  const cardHeightInches = parseFloat(design.heightInches) || 5.51;

  // Paper measurements in Millimeters
  const paperFormat = sheetConfig.paperSize === "A3" ? "a3" : sheetConfig.paperSize === "Letter" ? "letter" : "a4";
  const pdf = new jsPDF({
    orientation: sheetConfig.pageOrientation || "portrait",
    unit: "mm",
    format: paperFormat,
  });

  const cardWidthMm = cardWidthInches * 25.4;
  const cardHeightMm = cardHeightInches * 25.4;

  const isDoubleSided = Boolean(design.isDoubleSided);
  const printMode = isDoubleSided ? (sheetConfig.printSideMode || "duplex") : "single";

  const rows = sheetConfig.cardsPerCol || (cardHeightInches > cardWidthInches ? 2 : 3);
  const cols = sheetConfig.cardsPerRow || 2;
  const cardsPerPage = rows * cols;

  const marginLeftMm = sheetConfig.marginLeftMm ?? 10;
  const marginTopMm = sheetConfig.marginTopMm ?? 10;
  const gapXmm = sheetConfig.gapXmm ?? 5;
  const gapYmm = sheetConfig.gapYmm ?? 5;

  const total = attendees.length;
  const tempFrontCanvas = document.createElement("canvas");
  const tempBackCanvas = document.createElement("canvas");

  if (printMode === "side_by_side") {
    // Mode: Side-by-Side (Front card in Col 0, Back card in Col 1 for each attendee with center folding dashed line)
    const pairsPerPage = rows;
    for (let i = 0; i < total; i++) {
      const pageIndex = Math.floor(i / pairsPerPage);
      const slotOnPage = i % pairsPerPage;

      if (slotOnPage === 0 && pageIndex > 0) {
        pdf.addPage(paperFormat, sheetConfig.pageOrientation || "portrait");
      }

      const attendee = attendees[i];
      const yMm = marginTopMm + slotOnPage * (cardHeightMm + gapYmm);

      // Col 0: Front
      const xFrontMm = marginLeftMm;
      await renderCardToCanvas(design, attendee, tempFrontCanvas, 300, "front");
      pdf.addImage(tempFrontCanvas.toDataURL("image/png"), "PNG", xFrontMm, yMm, cardWidthMm, cardHeightMm);

      // Col 1: Back
      const xBackMm = marginLeftMm + cardWidthMm + gapXmm;
      await renderCardToCanvas(design, attendee, tempBackCanvas, 300, "back");
      pdf.addImage(tempBackCanvas.toDataURL("image/png"), "PNG", xBackMm, yMm, cardWidthMm, cardHeightMm);

      // Fold Center Dashed Line
      pdf.setDrawColor(200, 200, 200);
      pdf.setLineDashPattern([2, 2], 0);
      pdf.line(marginLeftMm + cardWidthMm + gapXmm / 2, yMm - 2, marginLeftMm + cardWidthMm + gapXmm / 2, yMm + cardHeightMm + 2);
      pdf.setLineDashPattern([], 0); // reset

      // Cut marks
      if (sheetConfig.showCutMarks) {
        drawSheetCutMarks(pdf, xFrontMm, yMm, cardWidthMm, cardHeightMm);
        drawSheetCutMarks(pdf, xBackMm, yMm, cardWidthMm, cardHeightMm);
      }

      if (onProgress) onProgress(i + 1, total);
    }
  } else if (printMode === "duplex") {
    // Mode: Duplex (Page 1 = Front Cards, Page 2 = Back Cards with mirrored columns for exact backing alignment)
    const totalPages = Math.ceil(total / cardsPerPage);

    for (let p = 0; p < totalPages; p++) {
      if (p > 0) pdf.addPage(paperFormat, sheetConfig.pageOrientation || "portrait");

      const pageAttendees = attendees.slice(p * cardsPerPage, (p + 1) * cardsPerPage);

      // ── FRONT SHEET ──
      for (let i = 0; i < pageAttendees.length; i++) {
        const attendee = pageAttendees[i];
        const row = Math.floor(i / cols);
        const col = i % cols;

        const xMm = marginLeftMm + col * (cardWidthMm + gapXmm);
        const yMm = marginTopMm + row * (cardHeightMm + gapYmm);

        await renderCardToCanvas(design, attendee, tempFrontCanvas, 300, "front");
        pdf.addImage(tempFrontCanvas.toDataURL("image/png"), "PNG", xMm, yMm, cardWidthMm, cardHeightMm);

        if (sheetConfig.showCutMarks) {
          drawSheetCutMarks(pdf, xMm, yMm, cardWidthMm, cardHeightMm);
        }
      }

      // ── BACK SHEET (Duplex Backing) ──
      pdf.addPage(paperFormat, sheetConfig.pageOrientation || "portrait");
      for (let i = 0; i < pageAttendees.length; i++) {
        const attendee = pageAttendees[i];
        const row = Math.floor(i / cols);
        // Mirror column so back aligns with front when printed duplex: col 0 -> col (cols - 1 - col)
        const mirroredCol = cols - 1 - (i % cols);

        const xMm = marginLeftMm + mirroredCol * (cardWidthMm + gapXmm);
        const yMm = marginTopMm + row * (cardHeightMm + gapYmm);

        await renderCardToCanvas(design, attendee, tempBackCanvas, 300, "back");
        pdf.addImage(tempBackCanvas.toDataURL("image/png"), "PNG", xMm, yMm, cardWidthMm, cardHeightMm);

        if (sheetConfig.showCutMarks) {
          drawSheetCutMarks(pdf, xMm, yMm, cardWidthMm, cardHeightMm);
        }
      }

      if (onProgress) {
        onProgress(Math.min(total, (p + 1) * cardsPerPage), total);
      }
    }
  } else {
    // Mode: Single-Sided
    for (let i = 0; i < total; i++) {
      const pageIndex = Math.floor(i / cardsPerPage);
      const slotOnPage = i % cardsPerPage;

      if (slotOnPage === 0 && pageIndex > 0) {
        pdf.addPage(paperFormat, sheetConfig.pageOrientation || "portrait");
      }

      const row = Math.floor(slotOnPage / cols);
      const col = slotOnPage % cols;

      const xMm = marginLeftMm + col * (cardWidthMm + gapXmm);
      const yMm = marginTopMm + row * (cardHeightMm + gapYmm);

      const attendee = attendees[i];
      await renderCardToCanvas(design, attendee, tempFrontCanvas, 300, "front");
      pdf.addImage(tempFrontCanvas.toDataURL("image/png"), "PNG", xMm, yMm, cardWidthMm, cardHeightMm);

      if (sheetConfig.showCutMarks) {
        drawSheetCutMarks(pdf, xMm, yMm, cardWidthMm, cardHeightMm);
      }

      if (onProgress) onProgress(i + 1, total);
    }
  }

  pdf.save(`Batch_ID_Cards_${design.cardType}_${isDoubleSided ? "2Sided" : "1Sided"}_${total}_cards.pdf`);
}

function drawSheetCutMarks(pdf: jsPDF, xMm: number, yMm: number, cardWidthMm: number, cardHeightMm: number) {
  pdf.setDrawColor(180, 180, 180);
  pdf.setLineWidth(0.15);
  // Top-Left
  pdf.line(xMm - 3, yMm, xMm, yMm);
  pdf.line(xMm, yMm - 3, xMm, yMm);
  // Top-Right
  pdf.line(xMm + cardWidthMm, yMm, xMm + cardWidthMm + 3, yMm);
  pdf.line(xMm + cardWidthMm, yMm - 3, xMm + cardWidthMm, yMm);
  // Bottom-Left
  pdf.line(xMm - 3, yMm + cardHeightMm, xMm, yMm + cardHeightMm);
  pdf.line(xMm, yMm + cardHeightMm, xMm, yMm + cardHeightMm + 3);
  // Bottom-Right
  pdf.line(xMm + cardWidthMm, yMm + cardHeightMm, xMm + cardWidthMm + 3, yMm + cardHeightMm);
  pdf.line(xMm + cardWidthMm, yMm + cardHeightMm, xMm + cardWidthMm, yMm + cardHeightMm + 3);
}
