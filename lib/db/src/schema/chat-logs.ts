import { pgTable, text, serial, timestamp, integer, index } from "drizzle-orm/pg-core";

export const chatLogsTable = pgTable(
  "chat_logs",
  {
    id: serial("id").primaryKey(),
    sessionId: text("session_id").notNull(),
    userIdentifier: text("user_identifier").default("Anonymous Delegate"),
    userMessage: text("user_message").notNull(),
    botResponse: text("bot_response").notNull(),
    modelUsed: text("model_used").default("meta-llama/Llama-3.1-8B-Instruct"),
    latencyMs: integer("latency_ms").default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("chat_logs_session_idx").on(table.sessionId),
    index("chat_logs_created_at_idx").on(table.createdAt),
  ]
);
