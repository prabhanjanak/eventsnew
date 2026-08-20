import { pgTable, serial, timestamp, integer, text, index, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { participantsTable } from "./participants";
import { systemUsersTable } from "./system-users";
import { eventsTable } from "./events";

export const attendanceLogsTable = pgTable("attendance_logs", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").references(() => eventsTable.id, { onDelete: "cascade" }),
  participantId: integer("participant_id").notNull().references(() => participantsTable.id, { onDelete: "cascade" }),
  scannedBy: integer("scanned_by").references(() => systemUsersTable.id),
  day: text("day").notNull().default("Day 1"),
  scannedAt: timestamp("scanned_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => {
  return {
    eventIdIdx: index("attendance_logs_event_id_idx").on(table.eventId),
    participantIdIdx: index("attendance_logs_participant_id_idx").on(table.participantId),
    uniquePerDay: uniqueIndex("attendance_logs_unique_per_day").on(table.participantId, table.day),
  };
});

export const insertAttendanceLogSchema = createInsertSchema(attendanceLogsTable).omit({
  id: true,
  scannedAt: true,
});
export type InsertAttendanceLog = z.infer<typeof insertAttendanceLogSchema>;
export type AttendanceLog = typeof attendanceLogsTable.$inferSelect;
