export type CardType = "preregistered" | "onspot";

export type CardSide = "front" | "back";

export type PlaceholderType =
  | "name"
  | "organization"
  | "id_number"
  | "qr_code"
  | "custom_text"
  | "kit_box"
  | "food_box"
  | "commitments_box"
  | "agenda_box";

export interface PlaceholderConfig {
  id: string;
  type: PlaceholderType;
  label: string;
  xPercent: number; // 0 to 100 percentage from left
  yPercent: number; // 0 to 100 percentage from top
  widthPercent: number; // 0 to 100 width percentage
  heightPercent: number; // 0 to 100 height percentage
  isLocked?: boolean;
  // Typography options
  fontFamily?: string;
  fontSizePt?: number;
  fontWeight?: "normal" | "medium" | "semibold" | "bold" | "black";
  color?: string;
  align?: "left" | "center" | "right";
  letterSpacing?: number;
  lineHeight?: number;
  textTransform?: "none" | "uppercase" | "lowercase" | "capitalize";
  truncate?: boolean;
  customSampleText?: string;
  // QR Code options
  qrErrorCorrection?: "L" | "M" | "Q" | "H";
  qrColor?: string;
  qrBgColor?: string;
  qrMargin?: number;
}

export interface SheetLayoutConfig {
  paperSize: "DirectCard" | "A4" | "A3" | "Letter" | "Custom";
  paperWidthMm: number;
  paperHeightMm: number;
  cardsPerRow: number;
  cardsPerCol: number;
  marginTopMm: number;
  marginLeftMm: number;
  gapXmm: number;
  gapYmm: number;
  showCutMarks: boolean;
  pageOrientation: "portrait" | "landscape";
  printSideMode: "single" | "duplex" | "side_by_side"; // duplex = consecutive front/back pages, side_by_side = front & back next to each other
}

export interface IdCardDesignData {
  id?: number;
  eventId: number;
  cardType: CardType;
  templateImageUrl: string | null;
  backTemplateImageUrl: string | null;
  widthInches: string; // e.g. "3.46" (vertical) or "5.51" (horizontal)
  heightInches: string; // e.g. "5.51" (vertical) or "3.46" (horizontal)
  dpi: number; // default 300
  orientation: "portrait" | "landscape";
  isDoubleSided: boolean; // One-Sided vs Two-Sided option
  printSideMode: "single" | "duplex" | "side_by_side";
  placeholders: PlaceholderConfig[]; // Front placeholders
  backPlaceholders: PlaceholderConfig[]; // Back placeholders
  sheetConfig: SheetLayoutConfig;
  status: "not_configured" | "draft" | "published";
  version: number;
  publishedVersion?: number | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface CardAttendee {
  id: number;
  registrationNumber: string;
  name: string;
  institution: string;
  email: string;
  mobile: string;
  delegateType: string;
  isOnSpot: boolean;
  hasName: boolean;
  hasOrg: boolean;
  hasId: boolean;
  hasQr: boolean;
  isReady: boolean;
}
