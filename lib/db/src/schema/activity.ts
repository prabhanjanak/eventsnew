import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const activityLogsTable = pgTable("activity_logs", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(), // registration | upload | attendance | food | submission_status
  message: text("message").notNull(),
  timestamp: timestamp("timestamp", { withTimezone: true }).notNull().defaultNow(),
});

export const insertActivityLogSchema = createInsertSchema(activityLogsTable).omit({
  id: true,
  timestamp: true,
});
export type InsertActivityLog = z.infer<typeof insertActivityLogSchema>;
export type ActivityLog = typeof activityLogsTable.$inferSelect;
