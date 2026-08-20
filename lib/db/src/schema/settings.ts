import { pgTable, serial, boolean, timestamp, text, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const submissionSettingsTable = pgTable("submission_settings", {
  id: serial("id").primaryKey(),
  submissionsOpen: boolean("submissions_open").notNull().default(true),
  otpMode: text("otp_mode").notNull().default("static"), // static | dynamic
  testOtps: text("test_otps").notNull().default("111111,222222,333333"),
  whatsappApiKey: text("whatsapp_api_key"),
  whatsappInstanceId: text("whatsapp_instance_id"),
  whatsappTemplate: text("whatsapp_template"),
  smtpHost: text("smtp_host"),
  smtpPort: integer("smtp_port"),
  smtpSecure: boolean("smtp_secure").notNull().default(false),
  smtpUser: text("smtp_user"),
  smtpPass: text("smtp_pass"),
  smtpFromEmail: text("smtp_from_email"),
  smtpFromName: text("smtp_from_name"),
  razorpayKeyId: text("razorpay_key_id"),
  razorpayKeySecret: text("razorpay_key_secret"),
  sessionTimeoutMinutes: integer("session_timeout_minutes").notNull().default(30),
  googleSheetUrl: text("google_sheet_url"),
  conferenceMapUrl: text("conference_map_url"),
  liveTvUrl: text("live_tv_url"),
  googleServiceAccountEmail: text("google_service_account_email"),
  googleServiceAccountKey: text("google_service_account_key"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertSubmissionSettingsSchema = createInsertSchema(submissionSettingsTable).omit({
  id: true,
  updatedAt: true,
});
export type InsertSubmissionSettings = z.infer<typeof insertSubmissionSettingsSchema>;
export type SubmissionSettings = typeof submissionSettingsTable.$inferSelect;
