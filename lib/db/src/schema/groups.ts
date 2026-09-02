import { pgTable, text, serial, timestamp, integer, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { eventsTable } from "./events";

export const groupRegistrationsTable = pgTable("group_registrations", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").references(() => eventsTable.id, { onDelete: "cascade" }),
  groupCode: text("group_code").notNull().unique(), // e.g. GRP-2026-XXXX
  organizationName: text("organization_name").notNull(),
  coordinatorName: text("coordinator_name").notNull(),
  coordinatorEmail: text("coordinator_email").notNull(),
  coordinatorPhone: text("coordinator_phone").notNull(),
  
  totalDelegates: integer("total_delegates").notNull().default(1),
  totalAmount: integer("total_amount").notNull().default(0),
  discountAmount: integer("discount_amount").default(0),
  couponCode: text("coupon_code"),
  
  paymentStatus: text("payment_status").notNull().default("unpaid"), // unpaid | paid | waived | refunded
  paymentId: text("payment_id"),
  orderId: text("order_id"),
  utrNumber: text("utr_number"),
  
  delegatesJson: text("delegates_json").notNull().default("[]"), // Serialized snapshot of registered members
  notes: text("notes"),
  
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => {
  return {
    groupCodeIdx: index("group_reg_code_idx").on(table.groupCode),
    eventIdIdx: index("group_reg_event_id_idx").on(table.eventId),
    emailIdx: index("group_reg_email_idx").on(table.coordinatorEmail),
  };
});

export const insertGroupRegistrationSchema = createInsertSchema(groupRegistrationsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertGroupRegistration = z.infer<typeof insertGroupRegistrationSchema>;
export type GroupRegistration = typeof groupRegistrationsTable.$inferSelect;
