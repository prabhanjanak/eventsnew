import { pgTable, serial, integer, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";

export const goodiesLogsTable = pgTable("goodies_logs", {
  id: serial("id").primaryKey(),
  participantId: integer("participant_id").notNull(),
  scannedBy: integer("scanned_by"),
  scannedAt: timestamp("scanned_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => {
  return {
    participantIdIdx: index("goodies_logs_participant_id_idx").on(table.participantId),
    // UNIQUE: one goodies collection per participant — DB-level race condition protection.
    uniqueParticipant: uniqueIndex("goodies_logs_unique_participant").on(table.participantId),
  };
});
