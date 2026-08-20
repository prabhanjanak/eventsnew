import { pgTable, text, serial, timestamp, boolean, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const systemUsersTable = pgTable("system_users", {
  id: serial("id").primaryKey(),
  empId: text("emp_id").notNull().unique(),
  name: text("name").notNull(),
  email: text("email"),
  mobile: text("mobile").unique(),
  userType: text("user_type").notNull(), // super_admin | admin | event_coordinator | track_coordinator | food_coordinator | scientific_committee | staff
  passwordHash: text("password_hash").notNull(),
  assignedTrack: text("assigned_track"),
  assignedEventIds: json("assigned_event_ids").$type<number[]>().default([]),
  mustChangePassword: boolean("must_change_password").notNull().default(true),
  // Granular scanning permissions: array of "attendance" | "goodies" | "food"
  permissions: json("permissions").$type<string[]>().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertSystemUserSchema = createInsertSchema(systemUsersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertSystemUser = z.infer<typeof insertSystemUserSchema>;
export type SystemUser = typeof systemUsersTable.$inferSelect;
