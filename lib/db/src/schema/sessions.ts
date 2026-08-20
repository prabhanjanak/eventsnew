import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const activeSessionsTable = pgTable("active_sessions", {
  id: serial("id").primaryKey(),
  sessionToken: text("session_token").notNull().unique(),
  userId: integer("user_id").notNull(),
  userType: text("user_type").notNull(), // participant | admin | track_coordinator | food_coordinator | scientific_committee
  userName: text("user_name").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  deviceType: text("device_type"), // mobile | tablet | desktop
  deviceName: text("device_name"), // e.g. "Chrome on Windows"
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
});

export const insertActiveSessionSchema = createInsertSchema(activeSessionsTable).omit({
  id: true,
  createdAt: true,
  lastSeenAt: true,
});
export type InsertActiveSession = z.infer<typeof insertActiveSessionSchema>;
export type ActiveSession = typeof activeSessionsTable.$inferSelect;
