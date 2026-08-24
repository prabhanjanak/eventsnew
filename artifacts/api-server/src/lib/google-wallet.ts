import jwt from "jsonwebtoken";
import { google } from "googleapis";
import type { Event, Participant } from "@workspace/db";
import { generateParticipantQrToken } from "../routes/participants";

export interface GoogleWalletConfig {
  issuerId: string;
  serviceAccountEmail: string;
  privateKey: string;
}

export function getGoogleWalletConfig(dbOverrides?: Partial<GoogleWalletConfig> | null): GoogleWalletConfig | null {
  const issuerId = dbOverrides?.issuerId?.trim() || process.env.GOOGLE_WALLET_ISSUER_ID?.trim() || "3388000000023186695";
  const serviceAccountEmail = dbOverrides?.serviceAccountEmail?.trim() || process.env.GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL?.trim();
  let privateKey = dbOverrides?.privateKey?.trim() || process.env.GOOGLE_WALLET_PRIVATE_KEY?.trim();

  if (!serviceAccountEmail || !privateKey) {
    return null;
  }

  // Properly handle escaped newlines if passed in environment files or UI
  if (privateKey.includes("\\n")) {
    privateKey = privateKey.replace(/\\n/g, "\n");
  }

  return {
    issuerId,
    serviceAccountEmail,
    privateKey,
  };
}

/**
 * Sanitize string according to Google Wallet ID requirements: ^[a-zA-Z0-9._-]+$
 */
export function sanitizeWalletIdentifier(str: string): string {
  return str.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export function buildEventClassId(issuerId: string, event: Event): string {
  const identifier = event.slug || `event_${event.id}`;
  return `${issuerId}.${sanitizeWalletIdentifier(identifier)}`;
}

export function buildTicketObjectId(issuerId: string, eventId: number, registrationNumber: string): string {
  const identifier = `event_${eventId}_${registrationNumber}`;
  return `${issuerId}.${sanitizeWalletIdentifier(identifier)}`;
}

export interface GoogleWalletPassResult {
  saveUrl: string;
  classId: string;
  objectId: string;
}

/**
 * Ensure EventTicketClass and EventTicketObject are upserted via Google REST API
 * and generate a signed Google Wallet Save URL.
 */
export async function generateGoogleWalletPass(
  event: Event,
  participant: Participant,
  config: GoogleWalletConfig
): Promise<GoogleWalletPassResult> {
  const classId = buildEventClassId(config.issuerId, event);
  const objectId = buildTicketObjectId(config.issuerId, event.id, participant.registrationNumber);

  // Format start date/time (RFC 3339 format)
  let startDateTimeIso: string;
  try {
    const d = new Date(event.startDate);
    if (!isNaN(d.getTime())) {
      startDateTimeIso = d.toISOString().replace(/\.\d{3}Z$/, "Z");
    } else {
      startDateTimeIso = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
    }
  } catch {
    startDateTimeIso = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  }

  // Determine ticket validity state
  const isActive = participant.isActive && participant.approvalStatus === "approved";
  const state = isActive ? "ACTIVE" : "INACTIVE";

  // Ensure 7-character hex color
  let bgColor = (event.themeColor || "#18181B").trim();
  if (!bgColor.startsWith("#")) bgColor = `#${bgColor}`;
  if (bgColor.length !== 7) bgColor = "#18181B";

  // Build the EventTicketClass payload
  // Use DRAFT for test accounts (allows save without full review approval)
  const eventTicketClass: Record<string, any> = {
    id: classId,
    issuerName: event.organizerName || "Sankara Eye Foundation India",
    eventName: {
      defaultValue: {
        language: "en",
        value: event.title,
      },
    },
    venue: {
      name: {
        defaultValue: {
          language: "en",
          value: event.venue || "Sankara Eye Hospital",
        },
      },
      address: {
        defaultValue: {
          language: "en",
          value: event.city || "Coimbatore, India",
        },
      },
    },
    dateTime: {
      start: startDateTimeIso,
    },
    reviewStatus: "UNDER_REVIEW",
    hexBackgroundColor: bgColor,
  };

  const defaultLogoUri = "https://images.unsplash.com/photo-1516549655169-df83a0774514?w=300";
  const logoUri = (event.logoUrl && event.logoUrl.startsWith("http")) ? event.logoUrl : defaultLogoUri;

  eventTicketClass.logo = {
    sourceUri: {
      uri: logoUri,
    },
    contentDescription: {
      defaultValue: {
        language: "en",
        value: event.title || "Sankara Eye Foundation India",
      },
    },
  };

  // Canonical QR code string with unguessable 10-char hex token
  const tokenCode = participant.qrToken || generateParticipantQrToken(participant.registrationNumber);
  const qrValue = `https://events.sankaraeye.in/q/${tokenCode}`;

  // Build the EventTicketObject payload (Strict Google Wallet v1 schema)
  const eventTicketObject: Record<string, any> = {
    id: objectId,
    classId: classId,
    state: state,
    ticketHolderName: participant.name,
    ticketNumber: participant.registrationNumber,
    barcode: {
      type: "QR_CODE",
      value: qrValue,
      alternateText: participant.registrationNumber,
    },
    reservationInfo: {
      confirmationCode: participant.registrationNumber,
    },
    textModulesData: [
      {
        id: "institution",
        header: "INSTITUTION / HOSPITAL",
        body: participant.institution || "Sankara Eye Care Institutions",
      },
      {
        id: "pass_type",
        header: "PASS TYPE",
        body: participant.delegateType?.toUpperCase() || "DELEGATE PASS",
      },
      {
        id: "reg_number",
        header: "REGISTRATION NUMBER",
        body: participant.registrationNumber,
      },
      {
        id: "dates",
        header: "EVENT DATES",
        body: `${event.startDate} ${event.endDate && event.endDate !== event.startDate ? `to ${event.endDate}` : ""}`.trim(),
      },
    ],
  };

  // 1. Direct Google Wallet REST API sync (non-blocking — failures won't prevent JWT generation)
  try {
    const auth = new google.auth.JWT({
      email: config.serviceAccountEmail,
      key: config.privateKey,
      scopes: ["https://www.googleapis.com/auth/wallet_object.issuer"],
    });

    const wallet = google.walletobjects({
      version: "v1",
      auth: auth,
    });

    // Ensure Class exists in Google Wallet (create or update)
    try {
      await wallet.eventticketclass.get({ resourceId: classId });
      // Class exists — update it to keep in sync
      try {
        await wallet.eventticketclass.update({
          resourceId: classId,
          requestBody: eventTicketClass,
        });
        console.log(`[Google Wallet] Class ${classId} updated successfully.`);
      } catch (updateErr: any) {
        console.warn(`[Google Wallet] Class update warning:`, updateErr.response?.data?.error?.message || updateErr.message);
      }
    } catch (e: any) {
      if (e.status === 404 || e.code === 404) {
        try {
          await wallet.eventticketclass.insert({ requestBody: eventTicketClass });
          console.log(`[Google Wallet] Class ${classId} created successfully.`);
        } catch (insertErr: any) {
          console.error(`[Google Wallet] Class insert failed:`, JSON.stringify(insertErr.response?.data || insertErr.message));
        }
      } else {
        console.warn(`[Google Wallet] Class get failed (non-404):`, e.status, e.response?.data?.error?.message || e.message);
      }
    }

    // Ensure Object exists / updated in Google Wallet
    try {
      await wallet.eventticketobject.insert({ requestBody: eventTicketObject });
      console.log(`[Google Wallet] Object ${objectId} created successfully.`);
    } catch (e: any) {
      if (e.status === 409 || e.code === 409) {
        try {
          await wallet.eventticketobject.update({
            resourceId: objectId,
            requestBody: eventTicketObject,
          });
          console.log(`[Google Wallet] Object ${objectId} updated successfully.`);
        } catch (updateErr: any) {
          console.warn(`[Google Wallet] Object update warning:`, updateErr.response?.data?.error?.message || updateErr.message);
        }
      } else {
        console.error(`[Google Wallet] Object insert failed:`, e.status, JSON.stringify(e.response?.data || e.message));
      }
    }
  } catch (apiErr: any) {
    console.warn("[Google Wallet REST API] Non-blocking sync warning:", apiErr.response?.data?.error?.message || apiErr.message);
  }

  // 2. Standard JWT claims for the Google Wallet Save link
  // Include origins for proper domain validation
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
  const origins = [frontendUrl];
  // Also add production domain if different
  if (!frontendUrl.includes("events.sankaraeye.in")) {
    origins.push("https://events.sankaraeye.in");
  }

  const claims = {
    iss: config.serviceAccountEmail,
    aud: "google",
    typ: "savetowallet",
    origins: origins,
    payload: {
      eventTicketClasses: [eventTicketClass],
      eventTicketObjects: [eventTicketObject],
    },
  };

  const token = jwt.sign(claims, config.privateKey, {
    algorithm: "RS256",
  });

  const saveUrl = `https://pay.google.com/gp/v/save/${token}`;

  return {
    saveUrl,
    classId,
    objectId,
  };
}

