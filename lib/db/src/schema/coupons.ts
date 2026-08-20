import { pgTable, text, serial, timestamp, boolean, integer, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { eventsTable } from "./events";

export const eventCouponsTable = pgTable("event_coupons", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").references(() => eventsTable.id, { onDelete: "cascade" }),
  code: text("code").notNull(), // e.g. SANKARA20, SPONSORED100, EARLYBIRD
  discountType: text("discount_type").notNull().default("percentage"), // percentage | fixed | sponsor_free
  discountValue: integer("discount_value").notNull().default(0), // 20 for 20%, 500 for ₹500, 100 for 100%
  sponsorName: text("sponsor_name"), // e.g. "Alcon", "Zeiss", "Internal Staff"
  description: text("description"),
  maxUses: integer("max_uses"), // null for unlimited
  usedCount: integer("used_count").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => {
  return {
    codeIdx: index("event_coupons_code_idx").on(table.code),
    eventIdIdx: index("event_coupons_event_id_idx").on(table.eventId),
  };
});

export const insertCouponSchema = createInsertSchema(eventCouponsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  usedCount: true,
});
export type InsertCoupon = z.infer<typeof insertCouponSchema>;
export type EventCoupon = typeof eventCouponsTable.$inferSelect;
