import { pgTable, text, serial, timestamp, integer, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { participantsTable } from "./participants";

export const assignmentsTable = pgTable("assignments", {
  id: serial("id").primaryKey(),
  participantId: integer("participant_id").notNull().references(() => participantsTable.id, { onDelete: "cascade" }),
  role: text("role").notNull(), // Speaker | Presenter | Poster | Panelist | Moderator | Judge | Chair | CoChair
  track: text("track").notNull(),
  sessionName: text("session_name"),
  hall: text("hall"),
  date: text("date"), // YYYY-MM-DD string
  time: text("time"),
  presentationTitle: text("presentation_title"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => {
  return {
    participantIdIdx: index("assignments_participant_id_idx").on(table.participantId),
  };
});

export const insertAssignmentSchema = createInsertSchema(assignmentsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertAssignment = z.infer<typeof insertAssignmentSchema>;
export type Assignment = typeof assignmentsTable.$inferSelect;
