import { pgTable, serial, text, timestamp, integer, uniqueIndex, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const sessionLikesTable = pgTable("session_likes", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull(),
  sessionSlotId: text("session_slot_id").notNull(),
  userIdentifier: text("user_identifier").notNull(), // Device UUID, IP, or participant session id
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => {
  return {
    eventSessionUserIdx: uniqueIndex("session_likes_event_session_user_idx").on(table.eventId, table.sessionSlotId, table.userIdentifier),
    eventSessionIdx: index("session_likes_event_session_idx").on(table.eventId, table.sessionSlotId),
  };
});

export const insertSessionLikeSchema = createInsertSchema(sessionLikesTable).omit({
  id: true,
  createdAt: true,
});

export type InsertSessionLike = z.infer<typeof insertSessionLikeSchema>;
export type SessionLike = typeof sessionLikesTable.$inferSelect;
