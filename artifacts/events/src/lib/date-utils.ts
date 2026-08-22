/**
 * Centralized Date & Time Utilities
 * Enforces DD MM YYYY with 24-hour time format across the entire application.
 */

const MONTH_NAMES_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

const MONTH_NAMES_FULL = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

/**
 * Safely parses any date string, timestamp, or Date object into a valid Date.
 */
export function safeDate(input: any): Date | null {
  if (!input) return null;
  if (input instanceof Date) return isNaN(input.getTime()) ? null : input;
  
  if (typeof input === "string") {
    // If format is DD/MM/YYYY or DD-MM-YYYY
    const dmyMatch = input.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(.*)$/);
    if (dmyMatch) {
      const day = parseInt(dmyMatch[1], 10);
      const month = parseInt(dmyMatch[2], 10) - 1;
      const year = parseInt(dmyMatch[3], 10);
      const rest = dmyMatch[4]?.trim();
      if (rest) {
        const timeMatch = rest.match(/(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?/);
        if (timeMatch) {
          const hours = parseInt(timeMatch[1], 10);
          const mins = parseInt(timeMatch[2], 10);
          const secs = timeMatch[3] ? parseInt(timeMatch[3], 10) : 0;
          return new Date(year, month, day, hours, mins, secs);
        }
      }
      return new Date(year, month, day);
    }
  }

  const parsed = new Date(input);
  return isNaN(parsed.getTime()) ? null : parsed;
}

const pad2 = (n: number) => String(n).padStart(2, "0");

/**
 * Returns date in DD/MM/YYYY format (e.g. "22/08/2026")
 */
export function formatDateDDMMYYYY(input: any, separator: "/" | "-" = "/"): string {
  const d = safeDate(input);
  if (!d) return "—";
  return `${pad2(d.getDate())}${separator}${pad2(d.getMonth() + 1)}${separator}${d.getFullYear()}`;
}

/**
 * Returns date in DD MMM YYYY format (e.g. "22 Aug 2026")
 */
export function formatDateTextual(input: any): string {
  const d = safeDate(input);
  if (!d) return "—";
  return `${pad2(d.getDate())} ${MONTH_NAMES_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

/**
 * Returns date in DD MMMM YYYY format (e.g. "22 August 2026")
 */
export function formatDateFull(input: any): string {
  const d = safeDate(input);
  if (!d) return "—";
  return `${pad2(d.getDate())} ${MONTH_NAMES_FULL[d.getMonth()]} ${d.getFullYear()}`;
}

/**
 * Returns 24-hour time in HH:mm format (e.g. "14:30")
 */
export function formatTime24h(input: any): string {
  const d = safeDate(input);
  if (!d) return "—";
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/**
 * Returns 24-hour time with seconds in HH:mm:ss format (e.g. "14:30:45")
 */
export function formatTimeWithSeconds24h(input: any): string {
  const d = safeDate(input);
  if (!d) return "—";
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

/**
 * Returns full Date & 24hr Time (e.g. "22/08/2026 14:30")
 */
export function formatDateTime24h(input: any, separator: "/" | "-" = "/"): string {
  const d = safeDate(input);
  if (!d) return "—";
  return `${formatDateDDMMYYYY(d, separator)} ${formatTime24h(d)}`;
}

/**
 * Returns full Date & 24hr Time with seconds (e.g. "22/08/2026 14:30:45")
 */
export function formatDateTimeWithSeconds24h(input: any, separator: "/" | "-" = "/"): string {
  const d = safeDate(input);
  if (!d) return "—";
  return `${formatDateDDMMYYYY(d, separator)} ${formatTimeWithSeconds24h(d)}`;
}

/**
 * Returns textual Date & 24hr Time (e.g. "22 Aug 2026, 14:30")
 */
export function formatDateTextual24h(input: any): string {
  const d = safeDate(input);
  if (!d) return "—";
  return `${formatDateTextual(d)}, ${formatTime24h(d)}`;
}

/**
 * Returns textual Date & 24hr Time with seconds (e.g. "22 Aug 2026, 14:30:45")
 */
export function formatDateTextualWithSeconds24h(input: any): string {
  const d = safeDate(input);
  if (!d) return "—";
  return `${formatDateTextual(d)}, ${formatTimeWithSeconds24h(d)}`;
}

/**
 * Formats a Date Range (e.g. "22 Aug 2026 – 24 Aug 2026" or "22 – 24 Aug 2026")
 */
export function formatDateRange24h(startDateInput: any, endDateInput: any): string {
  const start = safeDate(startDateInput);
  const end = safeDate(endDateInput);

  if (!start && !end) return "—";
  if (start && !end) return formatDateTextual(start);
  if (!start && end) return formatDateTextual(end);

  if (start && end) {
    if (start.getTime() === end.getTime()) {
      return formatDateTextual(start);
    }
    if (start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth()) {
      return `${pad2(start.getDate())} – ${pad2(end.getDate())} ${MONTH_NAMES_SHORT[start.getMonth()]} ${start.getFullYear()}`;
    }
    return `${formatDateTextual(start)} – ${formatDateTextual(end)}`;
  }

  return "—";
}
