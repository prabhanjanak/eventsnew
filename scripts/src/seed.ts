import { db, participantsTable, systemUsersTable, submissionSettingsTable, foodSessionsTable, assignmentsTable, getCleanName } from "@workspace/db";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";

async function seed() {
  console.log("Seeding database...");

  // Ensure submission settings row exists
  const [existing] = await db.select().from(submissionSettingsTable).limit(1);
  if (!existing) {
    await db.insert(submissionSettingsTable).values({ submissionsOpen: true, whatsappTemplate: "vision2020_otp" });
    console.log("Created submission settings");
  }

  // Create default admin
  const adminMobile = "9999900000";
  const [existingAdmin] = await db
    .select()
    .from(systemUsersTable)
    .where(eq(systemUsersTable.mobile, adminMobile));

  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash("Admin@2026", 10);
    await db.insert(systemUsersTable).values({
      empId: "EMP0000",
      name: "Admin",
      mobile: adminMobile,
      userType: "admin",
      passwordHash,
    });
    console.log("Created admin user — mobile: 9999900000, password: Admin@2026");
  }

  // Create food coordinator
  const fcMobile = "9999900001";
  const [existingFC] = await db
    .select()
    .from(systemUsersTable)
    .where(eq(systemUsersTable.mobile, fcMobile));
  if (!existingFC) {
    const passwordHash = await bcrypt.hash("Food@2026", 10);
    await db.insert(systemUsersTable).values({
      empId: "EMP0001",
      name: "Food Coordinator",
      mobile: fcMobile,
      userType: "food_coordinator",
      passwordHash,
    });
    console.log("Created food coordinator — mobile: 9999900001, password: Food@2026");
  }

  // Create admin user: Saravanan D
  const saravananEmp = "000038";
  const [existingSaravanan] = await db
    .select()
    .from(systemUsersTable)
    .where(eq(systemUsersTable.empId, saravananEmp));
  if (!existingSaravanan) {
    const passwordHash = await bcrypt.hash("Saravanan@2026", 10);
    await db.insert(systemUsersTable).values({
      empId: saravananEmp,
      name: "Saravanan D",
      userType: "admin",
      passwordHash,
    });
    console.log("Created admin user Saravanan D — empId: 000038, password: Saravanan@2026");
  }

  // Create/update super admin user: Prabhanjan K
  const prabhanjanEmp = "010177";
  const [existingPrabhanjan] = await db
    .select()
    .from(systemUsersTable)
    .where(eq(systemUsersTable.empId, prabhanjanEmp));
  if (!existingPrabhanjan) {
    const passwordHash = await bcrypt.hash("Prabhanjan@2026", 10);
    await db.insert(systemUsersTable).values({
      empId: prabhanjanEmp,
      name: "Prabhanjan K",
      mobile: "8951568286",
      email: "prabhanjan@sankaraeye.com",
      userType: "super_admin",
      passwordHash,
    });
    console.log("Created super_admin user Prabhanjan K — empId: 010177, password: Prabhanjan@2026");
  } else {
    await db.update(systemUsersTable).set({
      userType: "super_admin",
      mobile: "8951568286",
      email: "prabhanjan@sankaraeye.com",
      name: "Prabhanjan K"
    }).where(eq(systemUsersTable.empId, prabhanjanEmp));
    console.log("Updated Prabhanjan K to super_admin");
  }

  // Create sample food sessions for 10-12 July 2026
  const foodSessions = [
    { name: "Breakfast Day 1", date: "2026-07-10", startTime: "07:30", endTime: "08:30", enabled: false },
    { name: "Lunch Day 1", date: "2026-07-10", startTime: "13:00", endTime: "14:00", enabled: false },
    { name: "Dinner Day 1", date: "2026-07-10", startTime: "19:00", endTime: "20:30", enabled: false },
    { name: "Breakfast Day 2", date: "2026-07-11", startTime: "07:30", endTime: "08:30", enabled: false },
    { name: "Lunch Day 2", date: "2026-07-11", startTime: "13:00", endTime: "14:00", enabled: false },
    { name: "Dinner Day 2", date: "2026-07-11", startTime: "19:00", endTime: "20:30", enabled: false },
    { name: "Breakfast Day 3", date: "2026-07-12", startTime: "07:30", endTime: "08:30", enabled: false },
    { name: "Lunch Day 3", date: "2026-07-12", startTime: "13:00", endTime: "14:00", enabled: false },
  ];

  const existingSessions = await db.select().from(foodSessionsTable);
  if (existingSessions.length === 0) {
    await db.insert(foodSessionsTable).values(foodSessions);
    console.log("Created food sessions");
  }

  // Create sample participants with assignments
  const sampleParticipants = [
    {
      registrationNumber: "V2020-00001",
      name: "Dr. Rajesh Kumar",
      email: "rajesh.kumar@example.com",
      mobile: "9876543210",
      institution: "Sankara Eye Hospital, Bangalore",
      password: "Test@1234",
      role: "Speaker",
      track: "Cataract Surgery",
      sessionName: "Advanced Phaco Techniques",
      hall: "Main Auditorium",
      date: "2026-07-10",
      time: "09:00",
      presentationTitle: "Femtosecond Laser in Modern Cataract Surgery",
    },
    {
      registrationNumber: "V2020-00002",
      name: "Dr. Priya Nair",
      email: "priya.nair@example.com",
      mobile: "9876543211",
      institution: "LV Prasad Eye Institute, Hyderabad",
      password: "Test@1234",
      role: "Presenter",
      track: "Retina",
      sessionName: "Diabetic Retinopathy Management",
      hall: "Hall B",
      date: "2026-07-10",
      time: "11:00",
      presentationTitle: "Anti-VEGF Therapy: Current Evidence",
    },
    {
      registrationNumber: "V2020-00542",
      name: "Dr. Arjun Mehta",
      email: "arjun.mehta@example.com",
      mobile: "9876543212",
      institution: "Aravind Eye Care, Madurai",
      password: "Test@1234",
      role: "Poster",
      track: "Glaucoma",
      sessionName: "Glaucoma Innovations",
      hall: "Poster Area",
      date: "2026-07-11",
      time: "14:00",
      presentationTitle: "Novel Drainage Implants in Refractory Glaucoma",
    },
    {
      registrationNumber: "V2020-00003",
      name: "Dr. Sunita Verma",
      email: "sunita.verma@example.com",
      mobile: "9876543213",
      institution: "AIIMS, New Delhi",
      password: "Test@1234",
      role: "Moderator",
      track: "Cataract Surgery",
      sessionName: "Advanced Phaco Techniques",
      hall: "Main Auditorium",
      date: "2026-07-10",
      time: "09:00",
      presentationTitle: null,
    },
  ];

  for (const p of sampleParticipants) {
    const [existing] = await db
      .select()
      .from(participantsTable)
      .where(eq(participantsTable.registrationNumber, p.registrationNumber));

    let participantId: number;
    if (!existing) {
      const passwordHash = await bcrypt.hash(p.password, 10);
      const [newP] = await db
        .insert(participantsTable)
        .values({
          registrationNumber: p.registrationNumber,
          name: p.name,
          cleanName: getCleanName(p.name),
          email: p.email,
          mobile: p.mobile,
          institution: p.institution,
          passwordHash,
        })
        .returning();
      participantId = newP.id;
      console.log(`Created participant: ${p.name} (${p.registrationNumber})`);
    } else {
      participantId = existing.id;
    }

    // Create assignment
    const existingAssignment = await db
      .select()
      .from(assignmentsTable)
      .where(eq(assignmentsTable.participantId, participantId));

    if (existingAssignment.length === 0) {
      await db.insert(assignmentsTable).values({
        participantId,
        role: p.role,
        track: p.track,
        sessionName: p.sessionName,
        hall: p.hall,
        date: p.date,
        time: p.time,
        presentationTitle: p.presentationTitle,
      });
    }
  }

  console.log("Seeding complete!");
  console.log("\nTest credentials:");
  console.log("Admin: mobile=9999900000, password=Admin@2026, userType=admin");
  console.log("Participant: mobile=9876543210, password=Test@1234 (Dr. Rajesh Kumar, V2020-00001)");
  console.log("Food Coordinator: mobile=9999900001, password=Food@2026, userType=food_coordinator");
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
