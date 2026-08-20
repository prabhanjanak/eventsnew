/**
 * Parses the User-Agent string to extract a human-readable device name
 * and classify device type as 'mobile' | 'tablet' | 'desktop'.
 */

export type DeviceType = "mobile" | "tablet" | "desktop";

export interface DeviceInfo {
  deviceType: DeviceType;
  deviceName: string; // e.g. "Chrome on Windows", "Safari on iPhone"
}

export function parseDevice(userAgent: string | undefined): DeviceInfo {
  if (!userAgent) {
    return { deviceType: "desktop", deviceName: "Unknown Browser" };
  }

  const ua = userAgent;

  // --- Detect device type ---
  const isTablet =
    /tablet|ipad|playbook|silk/i.test(ua) ||
    (/android/i.test(ua) && !/mobile/i.test(ua));
  const isMobile = !isTablet && /mobile|iphone|ipod|android|blackberry|opera mini|iemobile|wpdesktop/i.test(ua);
  const deviceType: DeviceType = isTablet ? "tablet" : isMobile ? "mobile" : "desktop";

  // --- Detect OS ---
  let os = "Unknown OS";
  if (/windows nt/i.test(ua)) os = "Windows";
  else if (/mac os x/i.test(ua)) os = "macOS";
  else if (/android/i.test(ua)) {
    const match = ua.match(/android\s?([\d.]+)/i);
    os = match ? `Android ${match[1]}` : "Android";
  } else if (/iphone/i.test(ua)) os = "iPhone";
  else if (/ipad/i.test(ua)) os = "iPad";
  else if (/linux/i.test(ua)) os = "Linux";

  // --- Detect Browser ---
  let browser = "Unknown Browser";
  if (/edg\//i.test(ua)) browser = "Edge";
  else if (/opr\/|opera/i.test(ua)) browser = "Opera";
  else if (/chrome\/[\d.]+/i.test(ua) && !/chromium/i.test(ua)) browser = "Chrome";
  else if (/firefox\/[\d.]+/i.test(ua)) browser = "Firefox";
  else if (/safari\//i.test(ua) && !/chrome/i.test(ua)) browser = "Safari";
  else if (/msie|trident/i.test(ua)) browser = "Internet Explorer";

  return {
    deviceType,
    deviceName: `${browser} on ${os}`,
  };
}
