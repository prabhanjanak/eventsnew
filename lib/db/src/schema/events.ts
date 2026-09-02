import { pgTable, text, serial, timestamp, boolean, integer, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const eventsTable = pgTable("events", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  eventType: text("event_type").notNull().default("conference"), // conference | cme | workshop | internal_staff | symposium
  description: text("description"),
  shortDescription: text("short_description"),
  venue: text("venue").notNull().default("Sankara Eye Hospital"),
  city: text("city").default("Coimbatore"),
  locationMapUrl: text("location_map_url"),
  
  // Date & Time
  startDate: text("start_date").notNull(), // YYYY-MM-DD
  endDate: text("end_date").notNull(),     // YYYY-MM-DD
  timeFrom: text("time_from").default("09:00 AM"),
  timeTo: text("time_to").default("05:00 PM"),
  
  // Pricing & Payment Gateway
  isPaid: boolean("is_paid").notNull().default(false),
  registrationFee: integer("registration_fee").notNull().default(0), // in INR
  currency: text("currency").notNull().default("INR"),
  razorpayKeyId: text("razorpay_key_id"),
  razorpayKeySecret: text("razorpay_key_secret"),

  // Approval & Capacity
  requiresApproval: boolean("requires_approval").notNull().default(false),
  registrationOpen: boolean("registration_open").notNull().default(true),
  maxCapacity: integer("max_capacity"),
  
  // Feature Toggles (Check-in & Event Logistics)
  enableAttendance: boolean("enable_attendance").notNull().default(true),
  attendanceDaysCount: integer("attendance_days_count").notNull().default(1),
  enableFood: boolean("enable_food").notNull().default(true),
  enableGoodies: boolean("enable_goodies").notNull().default(true),
  enableGoogleWallet: boolean("enable_google_wallet").notNull().default(true),

  // Organizer & CME SPOC Contact details
  organizerName: text("organizer_name").default("Sankara Eye Care Institutions"),
  organizerEmail: text("organizer_email"),
  organizerPhone: text("organizer_phone"),
  spocName: text("spoc_name"),
  spocDesignation: text("spoc_designation"),
  spocPhone: text("spoc_phone"),
  spocEmail: text("spoc_email"),
  cancellationPolicy: text("cancellation_policy"),
  
  // Registration Documents & Group Registration Config
  requireDocumentUpload: boolean("require_document_upload").notNull().default(false),
  documentUploadLabel: text("document_upload_label").default("Upload Medical Council Certificate / Student ID"),
  documentUploadRequired: boolean("document_upload_required").notNull().default(false),
  groupRegistrationEnabled: boolean("group_registration_enabled").notNull().default(true),

  // Design & Branding (Obsidian Dark Lu.ma Theme Defaults)
  themeColor: text("theme_color").notNull().default("#18181B"),
  accentColor: text("accent_color").notNull().default("#6366F1"),
  bannerUrl: text("banner_url"),
  logoUrl: text("logo_url"),
  agendaPdfUrl: text("agenda_pdf_url"),
  agendaPdfButtonText: text("agenda_pdf_button_text").default("Download Event Agenda (PDF)"),
  customPdfUrl: text("custom_pdf_url"),
  customPdfButtonText: text("custom_pdf_button_text").default("View Document (PDF)"),
  awardsPdfUrl: text("awards_pdf_url"),
  awardsPdfButtonText: text("awards_pdf_button_text").default("Download Awards & Winners List (PDF)"),
  externalPhotosUrl: text("external_photos_url"),
  externalPhotosButtonText: text("external_photos_button_text").default("View AI Event Photos (Samaro AI / Photomall)"),
  pdfAttachmentsJson: text("pdf_attachments_json"),
  agendaJson: text("agenda_json"),
  pricingTiersJson: text("pricing_tiers_json"),
  badgeSubtitle: text("badge_subtitle"),
  badgeFooterText: text("badge_footer_text"),
  
  // Dynamic Modules (Feedback, Certificates, Pre/Post Tests)
  feedbackFormJson: text("feedback_form_json"),
  certificateTemplateJson: text("certificate_template_json"),
  prePostTestJson: text("pre_post_test_json"),

  // Post-Event Wrapup & Gallery (Available after event end date)
  postEventSummary: text("post_event_summary"),
  postEventDescription: text("post_event_description"),
  postEventEndingNotes: text("post_event_ending_notes"),
  postEventVisitorCount: integer("post_event_visitor_count"),
  postEventGalleryJson: text("post_event_gallery_json"), // JSON string array of image URLs (min 10 required)
  postEventCompleted: boolean("post_event_completed").notNull().default(false),
  postEventCompletedAt: timestamp("post_event_completed_at", { withTimezone: true }),

  status: text("status").notNull().default("published"), // draft | published | ongoing | completed | archived
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => {
  return {
    slugIdx: index("events_slug_idx").on(table.slug),
    statusIdx: index("events_status_idx").on(table.status),
    eventTypeIdx: index("events_type_idx").on(table.eventType),
  };
});

export const insertEventSchema = createInsertSchema(eventsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertEvent = z.infer<typeof insertEventSchema>;
export type Event = typeof eventsTable.$inferSelect;
