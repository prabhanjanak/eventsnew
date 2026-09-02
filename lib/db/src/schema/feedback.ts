import { pgTable, text, serial, timestamp, integer, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { eventsTable } from "./events";
import { participantsTable } from "./participants";

export const feedbackSubmissionsTable = pgTable("feedback_submissions", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").references(() => eventsTable.id, { onDelete: "cascade" }),
  participantId: integer("participant_id").references(() => participantsTable.id, { onDelete: "cascade" }),
  participantName: text("participant_name"),
  participantEmail: text("participant_email"),
  
  // Dynamic Ratings and Answers (Scientific content, Audio/Visual, Food, Hospitality, Overall)
  ratingsJson: text("ratings_json").notNull().default("{}"), // e.g. {"scientific": 5, "av": 4, "hospitality": 5, "overall": 5}
  comments: text("comments"),
  suggestions: text("suggestions"),
  
  submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => {
  return {
    eventIdIdx: index("feedback_event_id_idx").on(table.eventId),
    participantIdIdx: index("feedback_participant_id_idx").on(table.participantId),
  };
});

export const insertFeedbackSchema = createInsertSchema(feedbackSubmissionsTable).omit({
  id: true,
  submittedAt: true,
});
export type InsertFeedback = z.infer<typeof insertFeedbackSchema>;
export type FeedbackSubmission = typeof feedbackSubmissionsTable.$inferSelect;
