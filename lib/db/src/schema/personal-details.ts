import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { participantsTable } from "./participants";

export const personalDetailsTable = pgTable("personal_details", {
  id: serial("id").primaryKey(),
  participantId: integer("participant_id")
    .notNull()
    .unique()
    .references(() => participantsTable.id, { onDelete: "cascade" }),
  age: text("age"),
  gender: text("gender"),          // Male | Female | Other | Prefer not to say
  dietaryPreference: text("dietary_preference"), // Veg | Non-Veg | Vegan | Jain
  city: text("city"),
  submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
});

export type PersonalDetails = typeof personalDetailsTable.$inferSelect;
