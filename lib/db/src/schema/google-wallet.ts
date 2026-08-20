import { pgTable, text, serial, timestamp, integer, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { eventsTable } from "./events";
import { participantsTable } from "./participants";

export const googleWalletPassesTable = pgTable(
  "google_wallet_passes",
  {
    id: serial("id").primaryKey(),
    participantId: integer("participant_id")
      .notNull()
      .references(() => participantsTable.id, { onDelete: "cascade" }),
    eventId: integer("event_id")
      .notNull()
      .references(() => eventsTable.id, { onDelete: "cascade" }),
    walletObjectId: text("wallet_object_id").notNull().unique(),
    walletClassId: text("wallet_class_id").notNull(),
    status: text("status").notNull().default("active"), // active | revoked | completed
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => {
    return {
      participantIdIdx: index("gwallet_participant_id_idx").on(table.participantId),
      eventIdIdx: index("gwallet_event_id_idx").on(table.eventId),
      walletObjectIdIdx: index("gwallet_object_id_idx").on(table.walletObjectId),
    };
  }
);

export const insertGoogleWalletPassSchema = createInsertSchema(googleWalletPassesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertGoogleWalletPass = z.infer<typeof insertGoogleWalletPassSchema>;
export type GoogleWalletPass = typeof googleWalletPassesTable.$inferSelect;
