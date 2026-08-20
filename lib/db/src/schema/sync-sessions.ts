import { pgTable, serial, text, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const syncSessionsTable = pgTable("sync_sessions", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  googleSheetId: text("google_sheet_id").notNull(),
  sheetName: text("sheet_name").default(""),
  locationName: text("location_name").notNull().default("Sankara Eye Hospital"),
  isActive: boolean("is_active").notNull().default(false),
  fieldMappings: jsonb("field_mappings").$type<{
    name?: string;
    email?: string;
    mobile?: string;
    institution?: string;
    regNum?: string;
    role?: string;
    sessionName?: string;
    date?: string;
    track?: string;
    time?: string;
    title?: string;
    hall?: string;
    isPaid?: string;
  }>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertSyncSessionSchema = createInsertSchema(syncSessionsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertSyncSession = z.infer<typeof insertSyncSessionSchema>;
export type SyncSession = typeof syncSessionsTable.$inferSelect;
