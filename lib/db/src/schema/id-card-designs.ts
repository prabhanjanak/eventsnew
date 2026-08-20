import { pgTable, text, serial, timestamp, integer, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { eventsTable } from "./events";

export const idCardDesignsTable = pgTable(
  "id_card_designs",
  {
    id: serial("id").primaryKey(),
    eventId: integer("event_id")
      .notNull()
      .references(() => eventsTable.id, { onDelete: "cascade" }),
    cardType: text("card_type").notNull().default("preregistered"), // 'preregistered' | 'onspot'
    templateImageUrl: text("template_image_url"),
    widthInches: text("width_inches").notNull().default("5.51"),
    heightInches: text("height_inches").notNull().default("3.46"),
    dpi: integer("dpi").notNull().default(300),
    orientation: text("orientation").notNull().default("landscape"), // 'landscape' | 'portrait'
    placeholdersJson: text("placeholders_json"),
    sheetConfigJson: text("sheet_config_json"),
    status: text("status").notNull().default("draft"), // 'draft' | 'published' | 'not_configured'
    version: integer("version").notNull().default(1),
    publishedVersion: integer("published_version"),
    createdById: integer("created_by_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    eventCardTypeIdx: index("id_card_designs_event_card_type_idx").on(table.eventId, table.cardType),
  })
);

export const insertIdCardDesignSchema = createInsertSchema(idCardDesignsTable);
export type InsertIdCardDesign = z.infer<typeof insertIdCardDesignSchema>;
export type IdCardDesign = typeof idCardDesignsTable.$inferSelect;
