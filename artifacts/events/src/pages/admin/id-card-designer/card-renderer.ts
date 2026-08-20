import QRCode from "qrcode";
import { jsPDF } from "jspdf";
import type { IdCardDesignData, PlaceholderConfig, CardAttendee, SheetLayoutConfig } from "./types";

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
 * Renders a complete high-resolution ID card onto an HTMLCanvasElement
 */
export async function renderCardToCanvas(
  design: IdCardDesignData,
  attendee: Partial<CardAttendee>,
  targetCanvas: HTMLCanvasElement,
  dpi: number = 300
): Promise<void> {
  const widthInches = parseFloat(design.widthInches) || 5.51;
  const heightInches = parseFloat(design.heightInches) || 3.46;
  const { widthPx, heightPx } = getCardPixelDimensions(widthInches, heightInches, dpi);

  targetCanvas.width = widthPx;
  targetCanvas.height = heightPx;

  const ctx = targetCanvas.getContext("2d");
  if (!ctx) throw new Error("Could not get 2D rendering context");

  // 1. Draw Template Image or Default Backdrop
  if (design.templateImageUrl) {
    try {
      const img = await loadImage(design.templateImageUrl);
      ctx.drawImage(img, 0, 0, widthPx, heightPx);
    } catch {
      drawFallbackBackground(ctx, widthPx, heightPx);
    }
  } else {
    drawFallbackBackground(ctx, widthPx, heightPx);
  }

  // 2. Render Placeholders
  for (const ph of design.placeholders) {
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
      ctx.fillStyle = ph.color || "#000000";
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

function drawFallbackBackground(ctx: CanvasRenderingContext2D, widthPx: number, heightPx: number) {
  // Gradient Slate / Navy
  const grad = ctx.createLinearGradient(0, 0, widthPx, heightPx);
  grad.addColorStop(0, "#18181B");
  grad.addColorStop(1, "#09090B");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, widthPx, heightPx);

  // Border Accent
  ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
  ctx.lineWidth = Math.round(widthPx * 0.005);
  ctx.strokeRect(10, 10, widthPx - 20, heightPx - 20);
}

/**
 * Downloads a single high-resolution PNG file for an attendee card
 */
export async function downloadSingleCardPng(design: IdCardDesignData, attendee: Partial<CardAttendee>): Promise<void> {
  const canvas = document.createElement("canvas");
  await renderCardToCanvas(design, attendee, canvas, 300);

  const dataUrl = canvas.toDataURL("image/png");
  const link = document.createElement("a");
  const regNo = attendee.registrationNumber || "ID-Card";
  link.download = `ID_Card_${regNo}.png`;
  link.href = dataUrl;
  link.click();
}

/**
 * Downloads a single print-ready PDF at exact physical dimensions (300 DPI)
 */
export async function downloadSingleCardPdf(design: IdCardDesignData, attendee: Partial<CardAttendee>): Promise<void> {
  const widthInches = parseFloat(design.widthInches) || 5.51;
  const heightInches = parseFloat(design.heightInches) || 3.46;
  const orientation = widthInches >= heightInches ? "landscape" : "portrait";

  const canvas = document.createElement("canvas");
  await renderCardToCanvas(design, attendee, canvas, 300);
  const imgData = canvas.toDataURL("image/png");

  const pdf = new jsPDF({
    orientation,
    unit: "in",
    format: [widthInches, heightInches],
  });

  pdf.addImage(imgData, "PNG", 0, 0, widthInches, heightInches);
  const regNo = attendee.registrationNumber || "ID-Card";
  pdf.save(`ID_Card_${regNo}.pdf`);
}

/**
 * Generates and downloads a multi-page Print-Ready Sheet PDF (e.g. A4 with 2x3 or 2x4 layout & cut marks)
 */
export async function generateBatchPrintPdf(
  design: IdCardDesignData,
  attendees: CardAttendee[],
  sheetConfig: SheetLayoutConfig,
  onProgress?: (current: number, total: number) => void
): Promise<void> {
  const cardWidthInches = parseFloat(design.widthInches) || 5.51;
  const cardHeightInches = parseFloat(design.heightInches) || 3.46;

  // Paper measurements in Millimeters
  const paperFormat = sheetConfig.paperSize === "A3" ? "a3" : sheetConfig.paperSize === "Letter" ? "letter" : "a4";
  const pdf = new jsPDF({
    orientation: sheetConfig.pageOrientation || "portrait",
    unit: "mm",
    format: paperFormat,
  });

  const cardWidthMm = cardWidthInches * 25.4;
  const cardHeightMm = cardHeightInches * 25.4;

  const rows = sheetConfig.cardsPerCol || 3;
  const cols = sheetConfig.cardsPerRow || 2;
  const cardsPerPage = rows * cols;

  const marginLeftMm = sheetConfig.marginLeftMm ?? 10;
  const marginTopMm = sheetConfig.marginTopMm ?? 10;
  const gapXmm = sheetConfig.gapXmm ?? 5;
  const gapYmm = sheetConfig.gapYmm ?? 5;

  const total = attendees.length;
  const tempCanvas = document.createElement("canvas");

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
    await renderCardToCanvas(design, attendee, tempCanvas, 300);
    const imgData = tempCanvas.toDataURL("image/png");

    pdf.addImage(imgData, "PNG", xMm, yMm, cardWidthMm, cardHeightMm);

    // Optional Cut Marks around cards
    if (sheetConfig.showCutMarks) {
      pdf.setDrawColor(180, 180, 180);
      pdf.setLineWidth(0.15);
      // Top-Left Corner Cut Marks
      pdf.line(xMm - 3, yMm, xMm, yMm);
      pdf.line(xMm, yMm - 3, xMm, yMm);
      // Top-Right Corner Cut Marks
      pdf.line(xMm + cardWidthMm, yMm, xMm + cardWidthMm + 3, yMm);
      pdf.line(xMm + cardWidthMm, yMm - 3, xMm + cardWidthMm, yMm);
      // Bottom-Left Corner Cut Marks
      pdf.line(xMm - 3, yMm + cardHeightMm, xMm, yMm + cardHeightMm);
      pdf.line(xMm, yMm + cardHeightMm, xMm, yMm + cardHeightMm + 3);
      // Bottom-Right Corner Cut Marks
      pdf.line(xMm + cardWidthMm, yMm + cardHeightMm, xMm + cardWidthMm + 3, yMm + cardHeightMm);
      pdf.line(xMm + cardWidthMm, yMm + cardHeightMm, xMm + cardWidthMm, yMm + cardHeightMm + 3);
    }

    if (onProgress) {
      onProgress(i + 1, total);
    }
  }

  pdf.save(`Batch_ID_Cards_${design.cardType}_${total}_attendees.pdf`);
}
