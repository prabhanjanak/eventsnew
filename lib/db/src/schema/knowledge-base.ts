import { pgTable, serial, text, varchar, timestamp, boolean, integer } from "drizzle-orm/pg-core";

// 1. Unresolved & Escalated Delegate Queries
export const unresolvedQueriesTable = pgTable("unresolved_queries", {
  id: serial("id").primaryKey(),
  ticketNumber: varchar("ticket_number", { length: 32 }).notNull().unique(),
  userIdentifier: varchar("user_identifier", { length: 255 }).notNull().default("Anonymous Delegate"),
  userEmail: varchar("user_email", { length: 255 }).notNull(),
  userPhone: varchar("user_phone", { length: 50 }),
  userMessage: text("user_message").notNull(),
  botDraftResponse: text("bot_draft_response"),
  status: varchar("status", { length: 32 }).notNull().default("pending"), // "pending" | "resolved" | "dismissed"
  adminReply: text("admin_reply"),
  resolvedBy: varchar("resolved_by", { length: 255 }),
  resolvedAt: timestamp("resolved_at"),
  addedToKnowledgeBase: boolean("added_to_knowledge_base").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// 2. Dynamic AI Self-Learning Knowledge Base
export const aiKnowledgeBaseTable = pgTable("ai_knowledge_base", {
  id: serial("id").primaryKey(),
  topic: varchar("topic", { length: 255 }).notNull().default("General"),
  questionKeywords: text("question_keywords").notNull(), // comma-separated keywords or phrases
  questionText: text("question_text").notNull(),
  verifiedAnswer: text("verified_answer").notNull(),
  source: varchar("source", { length: 64 }).notNull().default("admin_resolution"), // "admin_resolution" | "institutional"
  addedBy: varchar("added_by", { length: 255 }).default("Super Admin"),
  isActive: boolean("is_active").default(true).notNull(),
  usageCount: integer("usage_count").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
