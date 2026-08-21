import { pgTable, text, serial, timestamp, integer, boolean, index, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { participantsTable } from "./participants";
import { systemUsersTable } from "./system-users";
import { eventsTable } from "./events";

export const foodSessionsTable = pgTable("food_sessions", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").references(() => eventsTable.id, { onDelete: "cascade" }),
  sessionCode: text("session_code"),
  name: text("name").notNull(),
  date: text("date").notNull(), // YYYY-MM-DD
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  enabled: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => {
  return {
    eventIdIdx: index("food_sessions_event_id_idx").on(table.eventId),
  };
});

export const foodLogsTable = pgTable("food_logs", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").references(() => eventsTable.id, { onDelete: "cascade" }),
  participantId: integer("participant_id").notNull().references(() => participantsTable.id, { onDelete: "cascade" }),
  foodSessionId: integer("food_session_id").notNull().references(() => foodSessionsTable.id, { onDelete: "cascade" }),
  coordinatorId: integer("coordinator_id").references(() => systemUsersTable.id),
  collectedAt: timestamp("collected_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => {
  return {
    eventIdIdx: index("food_logs_event_id_idx").on(table.eventId),
    participantIdIdx: index("food_logs_participant_id_idx").on(table.participantId),
    foodSessionIdIdx: index("food_logs_food_session_id_idx").on(table.foodSessionId),
    uniquePerSession: uniqueIndex("food_logs_unique_per_session").on(table.participantId, table.foodSessionId),
  };
});

export const insertFoodSessionSchema = createInsertSchema(foodSessionsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertFoodLogSchema = createInsertSchema(foodLogsTable).omit({
  id: true,
  collectedAt: true,
});
export type InsertFoodSession = z.infer<typeof insertFoodSessionSchema>;
export type FoodSession = typeof foodSessionsTable.$inferSelect;
export type InsertFoodLog = z.infer<typeof insertFoodLogSchema>;
export type FoodLog = typeof foodLogsTable.$inferSelect;
