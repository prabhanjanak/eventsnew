import { pgTable, text, serial, timestamp, integer, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { assignmentsTable } from "./assignments";

export const uploadedFilesTable = pgTable("uploaded_files", {
  id: serial("id").primaryKey(),
  assignmentId: integer("assignment_id").notNull().references(() => assignmentsTable.id, { onDelete: "cascade" }),
  filename: text("filename").notNull(),
  originalName: text("original_name").notNull(),
  fileType: text("file_type").notNull(), // pptx | jpg
  version: integer("version").notNull().default(1),
  size: integer("size"),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => {
  return {
    assignmentIdIdx: index("uploaded_files_assignment_id_idx").on(table.assignmentId),
  };
});

export const insertUploadedFileSchema = createInsertSchema(uploadedFilesTable).omit({
  id: true,
  uploadedAt: true,
});
export type InsertUploadedFile = z.infer<typeof insertUploadedFileSchema>;
export type UploadedFile = typeof uploadedFilesTable.$inferSelect;
