import { pgTable, text, serial, timestamp, boolean, integer, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { eventsTable } from "./events";

export const participantsTable = pgTable("participants", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").references(() => eventsTable.id, { onDelete: "cascade" }),
  registrationNumber: text("registration_number").notNull().unique(),
  name: text("name").notNull(),
  cleanName: text("clean_name"),
  email: text("email"),
  mobile: text("mobile"),
  institution: text("institution").notNull(),
  designation: text("designation"),
  passwordHash: text("password_hash"),
  resetToken: text("reset_token"),
  resetTokenExpiry: timestamp("reset_token_expiry", { withTimezone: true }),
  otpCode: text("otp_code"),
  otpExpires: timestamp("otp_expires", { withTimezone: true }),
  address: text("address"),
  age: text("age"),
  gender: text("gender"),
  isOnSpot: boolean("is_on_spot").default(false),
  isOnSpotLinked: boolean("is_on_spot_linked").default(false),
  isOnSpotOnboarded: boolean("is_on_spot_onboarded").default(false),
  eventReminderSent: boolean("event_reminder_sent").default(false).notNull(),
  
  // Payment Details
  isPaid: boolean("is_paid").default(false).notNull(),
  paymentStatus: text("payment_status").default("unpaid").notNull(), // unpaid | paid | waived | refunded
  paymentAmount: integer("payment_amount").default(0),
  paymentId: text("payment_id"), // Razorpay payment ID (e.g. pay_xxx)
  orderId: text("order_id"),     // Razorpay order ID (e.g. order_xxx)
  utrNumber: text("utr_number"),
  
  // Approval Workflow
  approvalStatus: text("approval_status").default("approved").notNull(), // pending | approved | rejected
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  approvedBy: integer("approved_by"),
  rejectionReason: text("rejection_reason"),
  notes: text("notes"),

  isActive: boolean("is_active").default(true).notNull(),
  isSponsored: boolean("is_sponsored").default(false).notNull(),
  sponsorType: text("sponsor_type"),
  delegateType: text("delegate_type").default("delegate").notNull(), // delegate | faculty | speaker | crew | vendor | exhibitor | vip
  
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => {
  return {
    eventIdIdx: index("participants_event_id_idx").on(table.eventId),
    emailIdx: index("participants_email_idx").on(table.email),
    mobileIdx: index("participants_mobile_idx").on(table.mobile),
    cleanNameIdx: index("participants_clean_name_idx").on(table.cleanName),
    isOnSpotIdx: index("participants_is_on_spot_idx").on(table.isOnSpot),
    approvalStatusIdx: index("participants_approval_status_idx").on(table.approvalStatus),
  };
});

export const insertParticipantSchema = createInsertSchema(participantsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertParticipant = z.infer<typeof insertParticipantSchema>;
export type Participant = typeof participantsTable.$inferSelect;

export function getCleanName(fullName: string): string {
  let clean = (fullName || "").trim();
  clean = clean.replace(/^(dr\.|dr|mr\.|mr|ms\.|ms|mrs\.|mrs)\s+/i, "");
  return clean;
}
