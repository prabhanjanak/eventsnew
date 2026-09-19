import { db, eventsTable, participantsTable, getCleanName } from "@workspace/db";
import { eq, or, sql, and, ne } from "drizzle-orm";
import * as xlsx from "xlsx";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { SANQALP_AGENDA } from "./seed-sanqualp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function generateParticipantQrToken(regNumber: string): string {
  return crypto
    .createHash("sha256")
    .update("sankara_pass_salt_" + regNumber)
    .digest("hex")
    .slice(0, 10)
    .toUpperCase();
}

function cleanMobile(mobile: any): string | null {
  if (!mobile) return null;
  const s = String(mobile).trim().toLowerCase();
  if (["na", "n/a", "n.a.", "#n/a", "nil", "none", "null", "undefined", "-"].includes(s)) return null;

  let val = String(mobile).trim();
  if (val.toLowerCase().includes("e")) {
    const num = Number(val);
    if (!isNaN(num)) val = String(Math.round(num));
  }
  if (val.includes(".")) val = val.split(".")[0];
  const digits = val.replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : null;
}

// Curated 3-day Scientific Program for Vision 2020 20th Annual National Conference
const VISION_2020_AGENDA = [
  // ── DAY 1: Friday, 10th July 2026 ──────────────────────────────────────────
  {
    id: "v2020-d1-1",
    date: "2026-07-10",
    timeFrom: "08:30 AM",
    timeTo: "09:30 AM",
    title: "Registration & Delegate Kit Distribution",
    type: "registration",
    speaker: "Conference Secretariat",
    speakerDesignation: "Organizing Committee",
    speakerInstitution: "VISION 2020 India / Sankara",
    description: "Delegate arrival, badge printing, and welcome refreshment.",
    trackHall: "Main Convention Foyer",
  },
  {
    id: "v2020-d1-2",
    date: "2026-07-10",
    timeFrom: "09:30 AM",
    timeTo: "10:45 AM",
    title: "Grand Inaugural Ceremony & Keynote Address",
    type: "keynote",
    speaker: "Dr. R.V. Ramani & National Dignitaries",
    speakerDesignation: "Founder & Managing Trustee, SEFI / President, Vision 2020 India",
    speakerInstitution: "Sankara Eye Foundation India & Vision 2020 India",
    description: "Opening ceremonial lamp lighting, Presidential Address, and release of the 20th Annual Conference Compendium.",
    trackHall: "Auditorium (Track 1 / Plenary)",
    topics: ["Universal Eye Health", "Vision 2020 Milestones", "National Strategy"],
  },
  {
    id: "v2020-d1-3",
    date: "2026-07-10",
    timeFrom: "11:15 AM",
    timeTo: "01:00 PM",
    title: "Track 1: Innovations and Technological Solutions in Eye Care",
    type: "session",
    speaker: "Dr. Kaushik Murali & Panel",
    speakerDesignation: "President - Quality & Education",
    speakerInstitution: "Sankara Eye Foundation India",
    description: "AI in screening, tele-ophthalmology in tier 2/3 centres, and digital workflow transformation in community eye hospitals.",
    trackHall: "Hall A - Track 1",
    topics: ["AI Screening", "Digital Health", "Surgical Tech"],
  },
  {
    id: "v2020-d1-4",
    date: "2026-07-10",
    timeFrom: "02:00 PM",
    timeTo: "04:00 PM",
    title: "Track 2: Collaboration & Cross-Sector Partnerships for Universal Eye Health",
    type: "session",
    speaker: "Ms. Renu Wadhwa, Mr. Anil Mahto & Dr. Deepshikha Agrawal",
    speakerDesignation: "Hospital Leadership & NGO Panel",
    speakerInstitution: "Sadhu Vaswani Trust & MGM Eye Institute",
    description: "Public-private partnerships, CSR linkages, and government health scheme integrations to eliminate avoidable blindness.",
    trackHall: "Hall B - Track 2",
    topics: ["CSR Partnerships", "Universal Health Coverage", "Outreach Scale"],
  },
  {
    id: "v2020-d1-5",
    date: "2026-07-10",
    timeFrom: "04:30 PM",
    timeTo: "06:00 PM",
    title: "Dharamsey Nensey Award & Best Paper Presentations",
    type: "awards",
    speaker: "Scientific Committee & Award Jury",
    speakerDesignation: "Award Review Committee",
    speakerInstitution: "Vision 2020 India",
    description: "Presentation of the prestigious Dharamsey Nensey Awards for community eye health excellence and paper contests.",
    trackHall: "Main Auditorium",
    topics: ["Awards", "Recognition", "Scientific Excellence"],
  },

  // ── DAY 2: Saturday, 11th July 2026 ────────────────────────────────────────
  {
    id: "v2020-d2-1",
    date: "2026-07-11",
    timeFrom: "09:00 AM",
    timeTo: "11:00 AM",
    title: "Track 3: Impact, Equity, Sustainability and Quality in Eye Care",
    type: "session",
    speaker: "Dr. T. Nirmal Fredrick & Quality Council",
    speakerDesignation: "Quality Director",
    speakerInstitution: "Nirmals Eye Hospital",
    description: "Clinical audit systems, patient safety protocols, NABH accreditation benchmarks, and financial sustainability models.",
    trackHall: "Hall A - Track 3",
    topics: ["Quality Systems", "NABH", "Patient Safety", "Sustainability"],
  },
  {
    id: "v2020-d2-2",
    date: "2026-07-11",
    timeFrom: "11:30 AM",
    timeTo: "01:30 PM",
    title: "Track 4: Excellence in Optometry & Allied Ophthalmic Personnel (AOP)",
    type: "workshop",
    speaker: "Prof. Monica Chaudhry & Senior Faculty",
    speakerDesignation: "Director - Optometry Institute",
    speakerInstitution: "Learn Optometry / Sankara Academy",
    description: "Advanced refractive error management, low vision rehabilitation, binocular vision, and upskilling vision technicians.",
    trackHall: "Hall C - Track 4",
    topics: ["Optometry", "Allied Ophthalmic Personnel", "Low Vision"],
  },
  {
    id: "v2020-d2-3",
    date: "2026-07-11",
    timeFrom: "02:30 PM",
    timeTo: "04:30 PM",
    title: "Track 5: Knowledge Repository — Towards Organizational Excellence & Growth",
    type: "symposium",
    speaker: "Hospital Administrators & HR Leaders",
    speakerDesignation: "Management Forum",
    speakerInstitution: "Consortium of Eye Hospitals",
    description: "Hospital supply chain, patient counseling excellence, retention of clinical talent, and patient experience metrics.",
    trackHall: "Hall B - Track 5",
    topics: ["Hospital Management", "HR Strategy", "Supply Chain"],
  },
  {
    id: "v2020-d2-4",
    date: "2026-07-11",
    timeFrom: "04:30 PM",
    timeTo: "06:00 PM",
    title: "Scientific Poster Sessions & Moderated Discussions (60+ Posters)",
    type: "poster",
    speaker: "Research Fellows & PG Delegates",
    speakerDesignation: "Poster Presenters",
    speakerInstitution: "National Institutes",
    description: "Moderated scientific poster viewing covering clinical epidemiology, surgical outcomes, and community surveys.",
    trackHall: "Poster Exhibition Gallery",
    topics: ["Scientific Posters", "Clinical Research"],
  },

  // ── DAY 3: Sunday, 12th July 2026 ──────────────────────────────────────────
  {
    id: "v2020-d3-1",
    date: "2026-07-12",
    timeFrom: "09:00 AM",
    timeTo: "11:30 AM",
    title: "Plenary Symposium: Reaching the Unreached — Overcoming Cataract & Refractive Backlog",
    type: "session",
    speaker: "National Eye Health Leaders Panel",
    speakerDesignation: "National Advisory Council",
    speakerInstitution: "VISION 2020: The Right to Sight - India",
    description: "State-wise action plans, mobile surgical units, tele-refraction networks, and donor coordination.",
    trackHall: "Main Auditorium",
    topics: ["Cataract Backlog", "Mobile Surgery", "Tele-refraction"],
  },
  {
    id: "v2020-d3-2",
    date: "2026-07-12",
    timeFrom: "11:45 AM",
    timeTo: "01:00 PM",
    title: "Valedictory Function, Awards Distribution & Sankara Declaration 2026",
    type: "valedictory",
    speaker: "Organizing Committee & Vision 2020 Board",
    speakerDesignation: "Executive Board",
    speakerInstitution: "VISION 2020 India",
    description: "Best scientific paper & poster awards, valedictory address, and formal adoption of the Sankara Declaration for 2026-2030.",
    trackHall: "Main Auditorium",
    topics: ["Valedictory", "Sankara Declaration", "Next Host Announcement"],
  },
];

export async function seedEventsVision2020AndSanqualp() {
  console.log("==================================================================");
  console.log("🌱 SEEDING EVENTS: 12th SanQALP (Upcoming) & Vision 2020 (Past)");
  console.log("==================================================================");

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. UPCOMING EVENT: 12th SanQALP Conclave (21-22 September 2026)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n1️⃣ Processing UPCOMING event: 12th SanQALP Conclave...");

  const sanqualpSlug = "sanqalp-bangalore";
  const sanqualpPayload = {
    slug: sanqualpSlug,
    title: "12th SanQALP Conclave",
    eventType: "internal_staff",
    shortDescription:
      "12th SanQALP Conclave on 21st & 22nd September 2026 at Sankara Eye Hospital, Bangalore. Theme: From Vision to Value (TQM). Internal staff delegation.",
    description:
      "The 12th SanQALP Conclave brings together clinical leaders, quality champions, hospital administrators, and operational teams across all Sankara Eye Hospital units nationwide. Focused on embedding Total Quality Management (TQM) principles into everyday healthcare delivery, the conclave explores policy management, daily work management (DWM), clinical safety protocols, patient value streams, and sustainable healthcare operations.",
    venue: "Shri Shankara Vijayendram Auditorium (3rd floor), Sankara Eye Hospital",
    city: "Bangalore",
    locationMapUrl: "https://maps.google.com/?q=Sankara+Eye+Hospital+Varthur+Main+Road+Kundalahalli+Bangalore",
    startDate: "2026-09-21",
    endDate: "2026-09-22",
    timeFrom: "09:00 AM",
    timeTo: "07:00 PM",
    isPaid: false,
    registrationFee: 0,
    currency: "INR",
    requiresApproval: true,
    registrationOpen: true,
    maxCapacity: 350,
    enableAttendance: true,
    attendanceDaysCount: 2,
    enableFood: true,
    enableGoodies: false,
    enableGoogleWallet: false,
    organizerName: "Sankara Eye Care Institutions (SEFI)",
    organizerEmail: "quality@sankaraeye.in",
    organizerPhone: "+91 80 2854 2727",
    spocName: "Dr Geeta",
    spocDesignation: "DGM - Quality Assurance",
    spocEmail: "quality@sankaraeye.in",
    spocPhone: "+91 99169 73590",
    cancellationPolicy: "Internal staff conclave. Participation is by institutional delegation and nomination across Sankara Eye Hospital units.",
    themeColor: "#0F172A",
    accentColor: "#3B82F6",
    badgeSubtitle: "12TH SANQALP CONCLAVE · BANGALORE",
    badgeFooterText: "Sankara Quality Assurance Learning Program · Internal Staff",
    agendaJson: JSON.stringify(SANQALP_AGENDA),
    pricingTiersJson: JSON.stringify([
      {
        id: "internal_staff",
        name: "Internal Staff Delegate",
        role: "delegate",
        price: 0,
        earlyBirdPrice: 0,
        description: "Official internal delegation pass for nominated Sankara Eye Hospital staff.",
        inclusions: ["All TQM Scientific Tracks & Workshops", "Conclave Delegate Kit", "Hospitality & Dining (All 2 Days)"],
        popular: true,
      },
    ]),
    status: "published", // MUST be 'published' to appear under Upcoming Events!
    postEventCompleted: false,
    updatedAt: new Date(),
  };

  const [existingSanqualp] = await db
    .select()
    .from(eventsTable)
    .where(or(eq(eventsTable.slug, sanqualpSlug), eq(eventsTable.slug, "sanqualp-bangalore"), eq(eventsTable.slug, "sankarasanqualp")))
    .limit(1);

  let sanqualpEventId: number;
  if (existingSanqualp) {
    await db
      .update(eventsTable)
      .set(sanqualpPayload)
      .where(eq(eventsTable.id, existingSanqualp.id));
    sanqualpEventId = existingSanqualp.id;
    console.log(`✓ Updated SanQALP as UPCOMING event (ID: ${sanqualpEventId}, Status: published, Dates: 2026-09-21 - 2026-09-22)`);
  } else {
    const [inserted] = await db.insert(eventsTable).values(sanqualpPayload).returning();
    sanqualpEventId = inserted.id;
    console.log(`✓ Inserted SanQALP as UPCOMING event (ID: ${sanqualpEventId}, Status: published)`);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. PAST EVENT: VISION 2020 20th Annual National Conference (July 10-12, 2026)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n2️⃣ Processing PAST event: VISION 2020 20th Annual National Conference...");

  const visionSlug = "vision-2020-annual-conference";
  const visionPayload = {
    slug: visionSlug,
    title: "20th Annual National Conference — VISION 2020: The Right to Sight India",
    eventType: "conference",
    shortDescription:
      "20th Annual National Conference of VISION 2020: The Right to Sight - India. Landmark scientific symposium covering cornea, cataract, pediatric eye care & hospital leadership.",
    description:
      "Hosted proudly by Sankara Eye Foundation India, the 20th Annual National Conference of VISION 2020: The Right to Sight - India brought together more than 1,500 delegates, 120 national and international faculty members, and community eye care pioneers. Over three intensive days, the conference featured 5 specialized scientific tracks, live masterclasses, the prestigious Dharamsey Nensey Awards, scientific posters, and policy symposiums dedicated to eliminating avoidable blindness nationwide.",
    venue: "Sankara Eye Hospital Auditorium & Convention Center",
    city: "Coimbatore",
    locationMapUrl: "https://maps.google.com/?q=Sankara+Eye+Hospital+Coimbatore",
    startDate: "2026-07-10",
    endDate: "2026-07-12",
    timeFrom: "08:30 AM",
    timeTo: "06:00 PM",
    isPaid: true,
    registrationFee: 2500,
    currency: "INR",
    requiresApproval: false,
    registrationOpen: false, // Closed since event is completed
    maxCapacity: 1600,
    enableAttendance: true,
    attendanceDaysCount: 3,
    enableFood: true,
    enableGoodies: true,
    enableGoogleWallet: true,
    organizerName: "VISION 2020: The Right to Sight - India & SEFI",
    organizerEmail: "conference@vision2020india.org",
    organizerPhone: "+91 422 266 6450",
    spocName: "Conference Secretariat",
    spocDesignation: "Organizing Secretary",
    spocEmail: "secretariat@vision2020india.org",
    spocPhone: "+91 422 266 6451",
    cancellationPolicy: "Standard conference cancellation policy: full refund 30 days prior, 50% refund 15 days prior.",
    themeColor: "#F58220", // Sankara Orange
    accentColor: "#6F42C1", // Purple
    bannerUrl: "/headerwebfinal.png",
    logoUrl: "/sahailogo.png",
    badgeSubtitle: "20TH ANNUAL CONFERENCE · COIMBATORE",
    badgeFooterText: "VISION 2020: The Right to Sight India · Hosted by Sankara Eye Foundation",
    agendaJson: JSON.stringify(VISION_2020_AGENDA),
    pricingTiersJson: JSON.stringify([
      {
        id: "delegate_early",
        name: "Delegate Registration",
        role: "delegate",
        price: 2500,
        earlyBirdPrice: 2000,
        description: "Standard 3-day delegate pass with access to all scientific tracks, workshops, conference kit, and dining.",
        inclusions: ["All 5 Scientific Tracks & Masterclasses", "Official Conference Kit & Bag", "Lunch & Refreshments (All 3 Days)", "Dharamsey Nensey Awards Gala"],
        popular: true,
      },
      {
        id: "postgraduate",
        name: "Postgraduate Student / Resident",
        role: "delegate",
        price: 1500,
        earlyBirdPrice: 1200,
        description: "Subsidized registration for MS/DNB/DO postgraduate students and fellows.",
        inclusions: ["All 5 Scientific Tracks", "Poster Contests", "Conference Kit", "Lunch & Dining"],
        popular: false,
      },
    ]),
    status: "completed", // MUST be 'completed' so it appears under Past Events!
    postEventCompleted: true,
    postEventCompletedAt: new Date("2026-07-13T10:00:00Z"),
    postEventVisitorCount: 1520,
    postEventSummary:
      "The landmark 20th Annual National Conference of VISION 2020 India concluded with grand success at Sankara Eye Hospital, Coimbatore. Over 1,520 registered delegates, 120 national faculty members, and healthcare leaders participated across 5 parallel scientific tracks and plenary keynotes. Highlights included presentation of the prestigious Dharamsey Nensey Awards and adoption of the Sankara 2026 Declaration for community eye health.",
    postEventDescription:
      "Organized under the overarching mission of eliminating avoidable blindness, the conference hosted exhaustive academic symposiums on modern cataract surgery, cornea preservation, pediatric visual rehabilitation, optometry excellence, and eye hospital management systems.",
    postEventEndingNotes:
      "We express our profound gratitude to all delegates, faculty, chairpersons, student presenters, and the organizing team for making the 20th Annual National Conference a historic milestone in India's eye care journey.",
    updatedAt: new Date(),
  };

  const [existingVision] = await db
    .select()
    .from(eventsTable)
    .where(or(eq(eventsTable.slug, visionSlug), eq(eventsTable.slug, "annual-ophthalmology-2026")))
    .limit(1);

  let visionEventId: number;
  if (existingVision) {
    await db
      .update(eventsTable)
      .set(visionPayload)
      .where(eq(eventsTable.id, existingVision.id));
    visionEventId = existingVision.id;
    console.log(`✓ Updated VISION 2020 as PAST event (ID: ${visionEventId}, Status: completed, Dates: 2026-07-10 - 2026-07-12)`);
  } else {
    const [inserted] = await db.insert(eventsTable).values(visionPayload).returning();
    visionEventId = inserted.id;
    console.log(`✓ Inserted VISION 2020 as PAST event (ID: ${visionEventId}, Status: completed)`);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. ENFORCE ONLY 2 EVENTS: Upcoming SanQALP & Past Vision 2020
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n3️⃣ Enforcing strictly 2 events in platform directory...");
  await db
    .delete(eventsTable)
    .where(
      and(
        ne(eventsTable.slug, sanqualpSlug),
        ne(eventsTable.slug, visionSlug)
      )
    );
  console.log("✓ Directory strictly configured with 2 events: 12th SanQALP Conclave (upcoming) & Vision 2020 (past).");

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. SEED 447 VISION 2020 REGISTERED ATTENDEES (from Conference Registration Detail)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n4️⃣ Seeding 447 Vision 2020 attendees from Excel into participantsTable...");

  const excelPath = path.resolve(__dirname, "../../Conference Registration Detail_16.062026.xlsx");
  if (!fs.existsSync(excelPath)) {
    console.warn(`⚠️ Warning: '${excelPath}' not found. Skipping attendee import.`);
  } else {
    const buf = fs.readFileSync(excelPath);
    const wb = xlsx.read(buf, { type: "buffer" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const matrix = xlsx.utils.sheet_to_json<any[]>(sheet, { header: 1 });

    let importedAttendees = 0;
    let updatedAttendees = 0;

    // Row 0 is empty, Row 1 is header, Row 2 onwards is delegate data
    for (let i = 2; i < matrix.length; i++) {
      const row = matrix[i];
      if (!row || !Array.isArray(row)) continue;

      const sNo = row[0];
      const rawGroupReg = row[1];
      const orgName = String(row[3] || "").trim() || "Independent / Not Specified";
      const fullName = String(row[4] || "").trim();
      const rawGender = String(row[5] || "").trim().toLowerCase();
      const designation = String(row[6] || "").trim() || null;
      const rawMobile = row[7];
      const rawEmail = String(row[8] || "").trim().toLowerCase();
      const state = String(row[9] || "").trim();
      let address = String(row[10] || "").trim();

      if (!fullName) continue;

      if (state && address && !address.toLowerCase().includes(state.toLowerCase())) {
        address = `${address}, ${state}`;
      } else if (!address && state) {
        address = state;
      }

      const mobile = cleanMobile(rawMobile);
      const email =
        rawEmail && !["na", "n/a", "nil", "none", "-", "null"].includes(rawEmail)
          ? rawEmail
          : `${fullName.toLowerCase().replace(/[^a-z0-9]/g, ".")}@vision2020india.org`;

      const groupRegId = parseInt(rawGroupReg, 10);
      const regNumber = sNo ? `V2020-${String(sNo).padStart(5, "0")}` : `V2020-${String(i - 1).padStart(5, "0")}`;
      const qrToken = generateParticipantQrToken(regNumber);

      // Check if participant already exists by registration number or mobile
      const conditions = [eq(participantsTable.registrationNumber, regNumber)];
      if (mobile) {
        conditions.push(eq(participantsTable.mobile, mobile));
      }

      const [existing] = await db
        .select({ id: participantsTable.id })
        .from(participantsTable)
        .where(or(...conditions))
        .limit(1);

      if (existing) {
        await db
          .update(participantsTable)
          .set({
            eventId: visionEventId,
            name: fullName,
            cleanName: getCleanName(fullName),
            mobile,
            email,
            institution: orgName,
            designation,
            address: address || null,
            gender: rawGender || null,
            groupRegistrationId: !isNaN(groupRegId) ? groupRegId : null,
            isPaid: true,
            paymentStatus: "paid",
            approvalStatus: "approved",
            delegateType: "delegate",
            updatedAt: new Date(),
          })
          .where(eq(participantsTable.id, existing.id));
        updatedAttendees++;
      } else {
        await db.insert(participantsTable).values({
          eventId: visionEventId,
          registrationNumber: regNumber,
          qrToken,
          name: fullName,
          cleanName: getCleanName(fullName),
          mobile,
          email,
          institution: orgName,
          designation,
          address: address || null,
          gender: rawGender || null,
          groupRegistrationId: !isNaN(groupRegId) ? groupRegId : null,
          isPaid: true,
          paymentStatus: "paid",
          approvalStatus: "approved",
          delegateType: "delegate",
        });
        importedAttendees++;
      }
    }

    console.log(`✓ Seeded Vision 2020 Attendees: ${importedAttendees} new inserted, ${updatedAttendees} updated.`);
  }

  console.log("\n==================================================================");
  console.log("🎉 SEEDING COMPLETE!");
  console.log(`• Upcoming Event: 12th SanQALP Conclave (ID: ${sanqualpEventId}, Slug: ${sanqualpSlug}, Status: published)`);
  console.log(`• Past Event: Vision 2020 Annual Conference (ID: ${visionEventId}, Slug: ${visionSlug}, Status: completed)`);
  console.log("==================================================================");
}

// Execute if run directly
seedEventsVision2020AndSanqualp()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Seeding failed:", err);
    process.exit(1);
  });
