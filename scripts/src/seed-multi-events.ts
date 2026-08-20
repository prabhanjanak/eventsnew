import { db, eventsTable, participantsTable, systemUsersTable, foodSessionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

async function main() {
  console.log("🌱 Seeding Multi-Event Platform Initial Events & Users...");

  // 1. Ensure Super Admin user exists
  const superAdminHash = await bcrypt.hash("admin123", 10);
  const [existingAdmin] = await db.select().from(systemUsersTable).where(eq(systemUsersTable.empId, "admin"));
  if (!existingAdmin) {
    await db.insert(systemUsersTable).values({
      empId: "admin",
      name: "Super Administrator",
      email: "admin@sankaraeye.in",
      mobile: "9999999999",
      userType: "super_admin",
      passwordHash: superAdminHash,
      mustChangePassword: false,
      permissions: ["attendance", "goodies", "food"],
      assignedEventIds: [],
    });
    console.log("✓ Super Admin created (empId: admin / pwd: admin123)");
  } else {
    await db.update(systemUsersTable)
      .set({ userType: "super_admin", permissions: ["attendance", "goodies", "food"] })
      .where(eq(systemUsersTable.empId, "admin"));
  }

  // 2. Create sample events demonstrating complete non-linkage and diverse types

  // Event A: Multi-day National Conference (Paid + Requires Approval)
  let [confEvent] = await db.select().from(eventsTable).where(eq(eventsTable.slug, "annual-ophthalmology-2026"));
  if (!confEvent) {
    [confEvent] = await db.insert(eventsTable).values({
      slug: "annual-ophthalmology-2026",
      title: "20th Annual National Ophthalmology Conference",
      eventType: "conference",
      shortDescription: "Premier national ophthalmology congress featuring scientific sessions, keynotes, and clinical workshops.",
      description: "Join leading ophthalmic clinicians, surgeons, researchers, and allied healthcare professionals for 3 days of intensive scientific exchange, hands-on masterclasses, and networking.",
      venue: "Sankara Eye Hospital Auditorium",
      city: "Coimbatore",
      startDate: "2026-07-10",
      endDate: "2026-07-12",
      isPaid: true,
      registrationFee: 2000,
      currency: "INR",
      requiresApproval: true,
      registrationOpen: true,
      maxCapacity: 1500,
      organizerName: "Sankara Eye Care Institutions",
      organizerEmail: "conference@sankaraeye.in",
      themeColor: "#F58220",
      accentColor: "#6F42C1",
      badgeSubtitle: "ANNUAL NATIONAL CONFERENCE 2026",
      badgeFooterText: "Sankara Eye Foundation · Coimbatore",
      status: "published",
    }).returning();
    console.log("✓ Event 1 created: Annual Ophthalmology Conference (Slug: annual-ophthalmology-2026)");
  }

  // Event B: Academic Medical CME (Paid + Instant Auto-Approval)
  let [cmeEvent] = await db.select().from(eventsTable).where(eq(eventsTable.slug, "pediatric-cornea-cme-2026"));
  if (!cmeEvent) {
    [cmeEvent] = await db.insert(eventsTable).values({
      slug: "pediatric-cornea-cme-2026",
      title: "Advanced Pediatric Cornea & Refractive CME",
      eventType: "cme",
      shortDescription: "Accredited Continuing Medical Education session focusing on pediatric corneal surgery and diagnostics.",
      description: "A specialized one-day CME featuring live surgical video reviews, interactive case panels, and 4 accredited CME credit points for participating ophthalmologists.",
      venue: "Medical Education Hall B, Sankara Eye Hospital",
      city: "Coimbatore",
      startDate: "2026-08-22",
      endDate: "2026-08-22",
      isPaid: true,
      registrationFee: 500,
      currency: "INR",
      requiresApproval: false,
      registrationOpen: true,
      maxCapacity: 250,
      organizerName: "Dept. of Pediatric Ophthalmology",
      organizerEmail: "cme@sankaraeye.in",
      themeColor: "#0D6EFD",
      accentColor: "#0B5ED7",
      badgeSubtitle: "ACCREDITED MEDICAL CME 2026",
      badgeFooterText: "Department of Pediatric Ophthalmology",
      status: "published",
    }).returning();
    console.log("✓ Event 2 created: Pediatric Cornea CME (Slug: pediatric-cornea-cme-2026)");
  }

  // Event C: Internal Staff Annual Meet (Free + Auto-Approved)
  let [staffEvent] = await db.select().from(eventsTable).where(eq(eventsTable.slug, "staff-excellence-meet-2026"));
  if (!staffEvent) {
    [staffEvent] = await db.insert(eventsTable).values({
      slug: "staff-excellence-meet-2026",
      title: "Sankara Staff Annual Excellence Meet",
      eventType: "internal_staff",
      shortDescription: "Annual internal celebration, rewards & recognition convention for Sankara Hospital staff and healthcare teams.",
      description: "Internal staff convention bringing together clinical, nursing, administrative, and operations teams for department updates, talent showcases, and annual excellence awards.",
      venue: "Grand Convention Center",
      city: "Coimbatore",
      startDate: "2026-09-05",
      endDate: "2026-09-05",
      isPaid: false,
      registrationFee: 0,
      currency: "INR",
      requiresApproval: false,
      registrationOpen: true,
      maxCapacity: 800,
      organizerName: "Sankara HR & Operations",
      organizerEmail: "hr@sankaraeye.in",
      themeColor: "#198754",
      accentColor: "#157347",
      badgeSubtitle: "STAFF EXCELLENCE MEET 2026",
      badgeFooterText: "Internal Staff Event · Sankara Team",
      status: "published",
    }).returning();
    console.log("✓ Event 3 created: Staff Excellence Meet (Slug: staff-excellence-meet-2026)");
  }

  // 3. Create Sample Event Coordinators
  const coordPasswordHash = await bcrypt.hash("coord123", 10);
  const [existingCoord] = await db.select().from(systemUsersTable).where(eq(systemUsersTable.empId, "coord_cme"));
  if (!existingCoord) {
    await db.insert(systemUsersTable).values({
      empId: "coord_cme",
      name: "Dr. Ananya (CME Coordinator)",
      email: "ananya.cme@sankaraeye.in",
      mobile: "9840112233",
      userType: "event_coordinator",
      passwordHash: coordPasswordHash,
      mustChangePassword: false,
      assignedEventIds: [cmeEvent.id],
      permissions: ["attendance", "food", "goodies"],
    });
    console.log("✓ CME Coordinator created (empId: coord_cme / pwd: coord123) scoped to CME Event only");
  }

  // 4. Backfill any existing un-assigned participants to Conference event
  if (confEvent) {
    await db.update(participantsTable)
      .set({ eventId: confEvent.id })
      .where(eq(participantsTable.eventId, null as any));
  }

  console.log("✨ Multi-Event Seed Completed Successfully!");
}

main().catch(console.error);
