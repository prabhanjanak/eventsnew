import { pgTable, text, serial, timestamp, integer, boolean, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { eventsTable } from "./events";
import { participantsTable } from "./participants";

export const certificatesTable = pgTable("certificates", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").references(() => eventsTable.id, { onDelete: "cascade" }),
  participantId: integer("participant_id").references(() => participantsTable.id, { onDelete: "cascade" }),
  
  certificateType: text("certificate_type").notNull().default("delegate"), // delegate | faculty | speaker | award | volunteer
  certificateNumber: text("certificate_number").notNull().unique(), // e.g. SECI-2026-CERT-0101
  recipientName: text("recipient_name").notNull(),
  recipientEmail: text("recipient_email"),
  recipientInstitution: text("recipient_institution"),
  
  creditHours: text("credit_hours").default("4 CME Credit Hours"),
  presentationTitle: text("presentation_title"),
  
  pdfUrl: text("pdf_url"),
  qrVerificationToken: text("qr_verification_token").unique(),
  
  isIssued: boolean("is_issued").notNull().default(true),
  isDownloaded: boolean("is_downloaded").notNull().default(false),
  downloadedAt: timestamp("downloaded_at", { withTimezone: true }),
  emailSentAt: timestamp("email_sent_at", { withTimezone: true }),
  
  issuedAt: timestamp("issued_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => {
  return {
    certNumIdx: index("certificates_cert_num_idx").on(table.certificateNumber),
    eventIdIdx: index("certificates_event_id_idx").on(table.eventId),
    participantIdIdx: index("certificates_participant_id_idx").on(table.participantId),
    tokenIdx: index("certificates_token_idx").on(table.qrVerificationToken),
  };
});

export const insertCertificateSchema = createInsertSchema(certificatesTable).omit({
  id: true,
  createdAt: true,
  issuedAt: true,
});
export type InsertCertificate = z.infer<typeof insertCertificateSchema>;
export type Certificate = typeof certificatesTable.$inferSelect;
