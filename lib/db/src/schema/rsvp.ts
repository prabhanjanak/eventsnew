import { pgTable, serial, integer, text, timestamp, boolean, index } from "drizzle-orm/pg-core";
import { participantsTable } from "./participants";

export const rsvpTable = pgTable("rsvp", {
  id: serial("id").primaryKey(),
  participantId: integer("participant_id")
    .notNull()
    .references(() => participantsTable.id, { onDelete: "cascade" }),
  // Session identifiers (from assignments timetable)
  trackName: text("track_name").notNull(),
  sessionName: text("session_name").notNull(),
  sessionDate: text("session_date").notNull(),   // YYYY-MM-DD
  sessionTime: text("session_time").notNull(),   // HH:MM
  participantEmail: text("participant_email"),   // stored for convenience during email send
  // Email reminder tracking
  reminder1SentAt: timestamp("reminder1_sent_at", { withTimezone: true }),   // 15 min reminder
  reminder2SentAt: timestamp("reminder2_sent_at", { withTimezone: true }),   // 5 min follow-up (if not opened)
  emailOpenToken: text("email_open_token").unique(),   // unique tracking token per RSVP email
  emailOpenedAt: timestamp("email_opened_at", { withTimezone: true }),       // null = not opened
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => {
  return {
    participantIdIdx: index("rsvp_participant_id_idx").on(table.participantId),
  };
});

export type Rsvp = typeof rsvpTable.$inferSelect;
