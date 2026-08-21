import { Router } from "express";
import { db, eventsTable, chatLogsTable, unresolvedQueriesTable, aiKnowledgeBaseTable } from "@workspace/db";
import { desc, eq, sql, like, or } from "drizzle-orm";
import { logger } from "../lib/logger";
import { sendUnresolvedQueryAdminAlertEmail, sendResolvedQueryUserEmail } from "../lib/mailer";

const router = Router();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GOOGLE_GEMINI_API_KEY || "";
const HF_API_TOKEN = process.env.HF_TOKEN || process.env.HUGGINGFACE_TOKEN || "";
const DEFAULT_MODEL = "gemini-2.0-flash";
const FALLBACK_MODEL = "meta-llama/Llama-3.3-70B-Instruct";

// System Knowledge Base — Institutional Pillars & Hospital Locations
const SANKARA_HOSPITAL_KNOWLEDGE = `
=== SANKARA EYE FOUNDATION INDIA INSTITUTIONAL KNOWLEDGE ===
- Organization: Sankara Eye Foundation India (a unit of Sri Kanchi Kamakoti Medical Trust, established 1977).
- Founder: Dr. R.V. Ramani and Dr. Radha Ramani (Founding Trustees).
- Key Administrative & Event Contacts:
  - Senior Administrator & Event Operations Head: Mr. Saravanan D (Employee ID: 000038 • Email: events@sankaraeye.com • Helpline: +91 89515 68286).
  - General Event Secretariat & Registrations: events@sankaraeye.com / +91 89515 68286.
  - Central Hospital Board & Enquiries (HQ Coimbatore): +91 422 423 6789 / info@sankaraeye.com.
- Network: 14 Super-Specialty Eye Hospitals across India (+ 1 Upcoming Super-Specialty Hospital in Patna, Bihar).
- Surgeries Per Day: 1,500+ Free Surgeries for the Blind / Visually Impaired.
- Historical Impact: 3,000,000+ (3 Million+) Free Surgeries Completed to date.
- Accreditations: NABH (National Accreditation Board for Hospitals & Healthcare Providers) and other quality healthcare accreditations.
- Philosophy: 80:20 Model (Cross-subsidized care providing free surgical care to rural and underprivileged citizens).
- Catering & Hospitality: All conferences, workshops, and hospital events strictly adhere to Pure Vegetarian culinary traditions with highest standards of hygiene.
- Official Website: https://sankaraeye.com
- Photo Gallery & Media: Event photographs are published per conference. For the 20th Annual National Ophthalmology Conference (Vision 2020), delegates can search high-resolution photographs using AI facial recognition on Samaro.ai: https://events.samaro.ai/sankara20thvision2020annualconference/gallery/media. For other events, photographs are available on each event's dedicated page.
- Navigation Links:
  - Event Directory: /events
  - Interactive Academic Calendar: /calendar
  - My Registered Passes: /my-registrations
  - Coordinator Login: /login

=== SANKARA EYE HOSPITAL LOCATIONS & GOOGLE MAPS DIRECTORY (15 UNITS) ===
1. Coimbatore (HQ): Sivanandapuram, Saravanampatti, Coimbatore, Tamil Nadu - 641035 | Maps: https://maps.google.com/?q=Sankara+Eye+Hospital+Coimbatore
2. R.S. Puram / Coimbatore City Hospital: DB Road, R.S. Puram, Coimbatore, Tamil Nadu - 641002 | Maps: https://maps.google.com/?q=Sankara+Eye+Hospital+RS+Puram+Coimbatore
3. Krishnankoil: Srivilliputhur Taluk, Krishnankoil, Tamil Nadu - 626126 | Maps: https://maps.google.com/?q=Sankara+Eye+Hospital+Krishnankoil
4. Guntur: Vijayawada-Guntur Expressway, Pedakakani, Guntur, Andhra Pradesh - 522509 | Maps: https://maps.google.com/?q=Sankara+Eye+Hospital+Guntur
5. Bengaluru (Kundalahalli & Jayanagar): Varthur Main Road, Kundalahalli Gate, Bengaluru, Karnataka - 560037 | Maps: https://maps.google.com/?q=Sankara+Eye+Hospital+Kundalahalli+Bangalore
6. Shivamogga: Harakere, Tirthahalli Road, Shivamogga, Karnataka - 577202 | Maps: https://maps.google.com/?q=Sankara+Eye+Hospital+Shimoga
7. Anand: NH 48, Mogar, Anand, Gujarat - 388340 | Maps: https://maps.google.com/?q=Sankara+Eye+Hospital+Anand+Gujarat
8. Ludhiana: VPO Dhandari Kalan, Ludhiana, Punjab - 141102 | Maps: https://maps.google.com/?q=Sankara+Eye+Hospital+Ludhiana
9. Kanpur: Panki Industrial Area, Kanpur, Uttar Pradesh - 208020 | Maps: https://maps.google.com/?q=Sankara+Eye+Hospital+Kanpur
10. Jaipur: Delhi-Jaipur Express Highway, Kukas, Jaipur, Rajasthan - 302028 | Maps: https://maps.google.com/?q=Sankara+Eye+Hospital+Jaipur
11. Indore: Scheme No. 78, Part II, Vijay Nagar, Indore, Madhya Pradesh - 452010 | Maps: https://maps.google.com/?q=Sankara+Eye+Hospital+Indore
12. Varanasi: Shivpur / Rishi Valley Road, Varanasi, Uttar Pradesh | Maps: https://maps.google.com/?q=Sankara+Eye+Hospital+Varanasi
13. Hyderabad: Financial District, Gachibowli, Hyderabad, Telangana | Maps: https://maps.google.com/?q=Sankara+Eye+Hospital+Hyderabad
14. RJ Sankara Eye Hospital, Panvel, Maharashtra: Plot 1, Sector 5A, New Panvel East, Navi Mumbai, Maharashtra - 410206 | Maps: https://maps.google.com/?q=RJ+Sankara+Eye+Hospital+Panvel
15. RJ Sankara Eye Hospital, Patna, Bihar (Upcoming 15th Unit): Patna, Bihar | Maps: https://maps.google.com/?q=Sankara+Eye+Hospital+Patna
`;

// Helper: Query Google Gemini API (2.0 Flash / 1.5 Flash)
async function queryGemini(systemInstruction: string, messages: Array<{ role: string; content: string }>): Promise<string> {
  if (!GEMINI_API_KEY) {
    throw new Error("No GEMINI_API_KEY provided in environment.");
  }

  const contents = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

  const models = ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-pro"];

  for (const model of models) {
    try {
      const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: {
            parts: [{ text: systemInstruction }],
          },
          contents,
          generationConfig: {
            temperature: 0.25,
            maxOutputTokens: 850,
          },
        }),
      });

      if (resp.ok) {
        const data = await resp.json();
        if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) {
          return data.candidates[0].content.parts.map((p: any) => p.text).join("").trim();
        }
      }
    } catch (e: any) {
      logger.warn({ error: e.message, model }, "Gemini API call failed");
    }
  }

  throw new Error("Gemini API models unavailable.");
}

// Helper: Query Hugging Face Router with Meta Llama 3.3 / 3.1 / Qwen 2.5
async function queryLlama(messages: Array<{ role: string; content: string }>): Promise<string> {
  const modelsToTry = [
    "Qwen/Qwen2.5-72B-Instruct",
    "meta-llama/Llama-3.3-70B-Instruct",
    "meta-llama/Llama-3.1-8B-Instruct",
  ];

  for (const model of modelsToTry) {
    try {
      const response = await fetch("https://router.huggingface.co/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${HF_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages,
          max_tokens: 650,
          temperature: 0.3,
          top_p: 0.9,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.choices && data.choices[0] && data.choices[0].message) {
          return data.choices[0].message.content.trim();
        }
      } else {
        const errText = await response.text();
        logger.warn({ status: response.status, err: errText, model }, "HuggingFace API returned error, attempting next fallback model");
      }
    } catch (e: any) {
      logger.warn({ error: e.message, model }, "Failed to reach model router");
    }
  }

  throw new Error("All AI inference models exhausted or rate-limited.");
}

// Complete 15 Hospital Branch Location Profiles of Sankara Eye Foundation India
const SANKARA_BRANCHES = [
  {
    name: "Sankara Eye Hospital, Coimbatore (Headquarters & Tertiary Institute)",
    keywords: ["coimbatore", "saravanampatti", "sivanandapuram", "headquarters", "hq"],
    address: "Sivanandapuram, Saravanampatti, Coimbatore, Tamil Nadu - 641035",
    maps: "https://maps.google.com/?q=Sankara+Eye+Hospital+Coimbatore",
    specialties: "Tertiary Eye Institute, High-Volume Micro-incision Cataract, LASIK/Contoura Vision, Corneal Transplants (PK/DMEK), Vitreo-Retinal Surgeries, Ocular Oncology",
    description: "The founding flagship tertiary eye hospital of Sri Kanchi Kamakoti Medical Trust, established in 1977.",
  },
  {
    name: "Sankara Eye Hospital, R.S. Puram / Coimbatore City Hospital",
    keywords: ["rs puram", "r.s. puram", "coimbatore city", "city hospital"],
    address: "DB Road, R.S. Puram, Coimbatore, Tamil Nadu - 641002",
    maps: "https://maps.google.com/?q=Sankara+Eye+Hospital+RS+Puram+Coimbatore",
    specialties: "Comprehensive Specialist Eye Care, Cataract Clinic, Glaucoma Diagnostics, Pediatric Consultations, Optical Center",
    description: "Urban central branch of Sankara Eye Hospital providing outpatient consultations and diagnostic services in the heart of Coimbatore.",
  },
  {
    name: "Sankara Eye Hospital, Krishnankoil (Tamil Nadu)",
    keywords: ["krishnankoil", "srivilliputhur", "virudhunagar"],
    address: "Srivilliputhur Taluk, Krishnankoil, Tamil Nadu - 626126",
    maps: "https://maps.google.com/?q=Sankara+Eye+Hospital+Krishnankoil",
    specialties: "High-Volume Rural Cataract Surgeries, Community Outreach Base, Pediatric Vision Screening",
    description: "Dedicated community surgical base serving Southern Tamil Nadu with world-class free and subsidized eye care.",
  },
  {
    name: "Sankara Eye Hospital, Guntur (Andhra Pradesh)",
    keywords: ["guntur", "andhra", "pedakakani", "vijayawada"],
    address: "Vijayawada-Guntur Expressway, Pedakakani, Guntur, Andhra Pradesh - 522509",
    maps: "https://maps.google.com/?q=Sankara+Eye+Hospital+Guntur",
    specialties: "NABH Accredited Super-Specialty, High-Volume Free & Subsidized Cataract Surgeries, Glaucoma, Diabetic Retinopathy Clinics",
    description: "Premier ophthalmic referral centre on the Vijayawada-Guntur Highway serving coastal Andhra Pradesh.",
  },
  {
    name: "Sankara Eye Hospital, Bengaluru (Kundalahalli & Jayanagar)",
    keywords: ["bengaluru", "bangalore", "kundalahalli", "jayanagar", "whitefield", "varthur"],
    address: "Varthur Main Road, Kundalahalli Gate, Bengaluru, Karnataka - 560037 (& 8th Block, Jayanagar)",
    maps: "https://maps.google.com/?q=Sankara+Eye+Hospital+Kundalahalli+Bangalore",
    specialties: "SMILE, Contoura Vision & Blade-Free LASIK, Micro-incision Cataract with Premium IOLs, Glaucoma, Cornea, Oculoplasty, Vitreo-Retina",
    description: "State-of-the-art super-specialty eye institute catering to IT corridor delegates and community outreach across Karnataka.",
  },
  {
    name: "Sankara Eye Hospital, Shivamogga (Shimoga, Karnataka)",
    keywords: ["shivamogga", "shimoga", "karnataka shivamogga"],
    address: "Harakere, Honnali Road, Shivamogga, Karnataka - 577202",
    maps: "https://maps.google.com/?q=Sankara+Eye+Hospital+Shimoga",
    specialties: "Comprehensive Cataract (Phaco), Glaucoma Screening, Diabetic Retinopathy, Rural Community Eye Camps",
    description: "Serving the Malnad region of Karnataka with world-class eye care services and community outreach.",
  },
  {
    name: "Sankara Eye Hospital, Anand (Mogar, Gujarat)",
    keywords: ["anand", "gujarat", "mogar"],
    address: "NH 48, Mogar, Anand, Gujarat - 388340",
    maps: "https://maps.google.com/?q=Sankara+Eye+Hospital+Anand+Gujarat",
    specialties: "Super-Specialty Tertiary Eye Hospital, Advanced Phaco, Glaucoma Management, Cornea, Vitreo-Retina",
    description: "NABH Accredited super-specialty hospital on NH 48 serving central Gujarat.",
  },
  {
    name: "Sankara Eye Hospital, Ludhiana (Punjab)",
    keywords: ["ludhiana", "punjab", "dhandari kalan"],
    address: "VPO Dhandari Kalan, Ludhiana, Punjab - 141102",
    maps: "https://maps.google.com/?q=Sankara+Eye+Hospital+Ludhiana",
    specialties: "Comprehensive Cataract (Phacoemulsification), Cornea & Refractive Services, Glaucoma Clinic, Vitreo-Retina, Pediatric Ophthalmology, 24/7 Eye Trauma Care",
    description: "Serving North India with high-quality super-specialty ophthalmic care, dedicated paying & subsidized community outreach wings.",
  },
  {
    name: "Sankara Eye Hospital, Kanpur (Uttar Pradesh)",
    keywords: ["kanpur", "panki", "uttar pradesh", "up"],
    address: "Panki Industrial Area, Kanpur, Uttar Pradesh - 208020",
    maps: "https://maps.google.com/?q=Sankara+Eye+Hospital+Kanpur",
    specialties: "Comprehensive Phacoemulsification, Glaucoma, Cornea, Retina, Rural Outreach Programs",
    description: "Leading eye care institution in Central UP providing subsidized and world-class private eye care.",
  },
  {
    name: "Sankara Eye Hospital, Jaipur (Rajasthan)",
    keywords: ["jaipur", "rajasthan", "kukas"],
    address: "Delhi-Jaipur Express Highway, Kukas, Jaipur, Rajasthan - 302028",
    maps: "https://maps.google.com/?q=Sankara+Eye+Hospital+Jaipur",
    specialties: "State-of-the-Art Ophthalmic Hospital, Free & Paid Wings, Cataract, Lasik, Retina",
    description: "Serving Rajasthan and North-Western India with NABH-accredited ophthalmic infrastructure.",
  },
  {
    name: "Sankara Eye Hospital, Indore (Madhya Pradesh)",
    keywords: ["indore", "madhya pradesh", "mp", "vijay nagar"],
    address: "Scheme No. 78, Part II, Vijay Nagar, Indore, Madhya Pradesh - 452010",
    maps: "https://maps.google.com/?q=Sankara+Eye+Hospital+Indore",
    specialties: "NABH Accredited Super-Specialty, Micro-incision Cataract, Glaucoma, Pediatric Ophthalmology & Retina",
    description: "Modern eye hospital in Vijay Nagar, Indore catering to Central India.",
  },
  {
    name: "Sankara Eye Hospital, Varanasi (Uttar Pradesh)",
    keywords: ["varanasi", "kashi", "banaras", "shivpur"],
    address: "Shivpur / Rishi Valley Road, Varanasi, Uttar Pradesh",
    maps: "https://maps.google.com/?q=Sankara+Eye+Hospital+Varanasi",
    specialties: "Comprehensive Ophthalmology, High-Volume Cataract Surgeries, Diabetic Retinopathy, Rural Eye Camps",
    description: "Serving Eastern Uttar Pradesh and Bihar border districts with super-specialty eye care.",
  },
  {
    name: "Sankara Eye Hospital, Hyderabad (Telangana)",
    keywords: ["hyderabad", "telangana", "gachibowli", "nanakramguda"],
    address: "Financial District / Gachibowli, Hyderabad, Telangana",
    maps: "https://maps.google.com/?q=Sankara+Eye+Hospital+Hyderabad",
    specialties: "Super-Specialty Laser Vision Correction, Advanced Cataract & Retinal Consultations",
    description: "Serving Telangana and Hyderabad with precision ophthalmic care.",
  },
  {
    name: "RJ Sankara Eye Hospital, Panvel, Maharashtra",
    keywords: ["panvel", "mumbai", "navi mumbai", "maharashtra", "rj sankara panvel"],
    address: "Plot 1, Sector 5A, New Panvel East, Navi Mumbai, Maharashtra - 410206",
    maps: "https://maps.google.com/?q=RJ+Sankara+Eye+Hospital+Panvel",
    specialties: "Tertiary Multi-Specialty Eye Care, Laser Vision, Cataract, Cornea Transplants, Vitreo-Retina",
    description: "State-of-the-art tertiary eye institute catering to Mumbai, Navi Mumbai, and the Konkan belt.",
  },
  {
    name: "RJ Sankara Eye Hospital, Patna, Bihar (Upcoming 15th Unit)",
    keywords: ["patna", "bihar", "upcoming 15th", "rj sankara patna", "patna hospital"],
    address: "Patna, Bihar",
    maps: "https://maps.google.com/?q=Sankara+Eye+Hospital+Patna",
    specialties: "Upcoming 15th Super-Specialty Eye Hospital of Sankara Eye Foundation India with high-volume surgical suites, Cornea, Retina, and Glaucoma clinics",
    description: "The 15th Sankara Eye Hospital bringing world-class ophthalmic care and community blindness eradication to Bihar and Eastern India.",
  },
];

// Sanitize and clean AI / Markdown Output
function cleanAiMarkdown(text: string): string {
  if (!text) return "";
  let cleaned = text
    // Replace hardcoded localhost / local network IP URLs with clean relative paths
    .replace(/https?:\/\/(?:localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+):[0-9]+(\/[a-zA-Z0-9_\-\/]*)/g, "$1")
    // Fix broken double bold lists e.g. **• [Title]...** -> • **[Title]...**
    .replace(/\*\*\s*•\s*/g, "• **")
    // Fix malformed consecutive bullets
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return cleaned;
}

// Local Grounded Search Fallback & Browser-Aware Reasoning Engine
function generateLocalGroundedAnswer(
  userQuery: string,
  events: any[],
  focusedEvent?: any,
  browserContext?: { currentPath?: string; currentUrl?: string; pageTitle?: string; visiblePageContext?: string }
): string {
  const q = userQuery.toLowerCase().trim();
  const todayStr = new Date().toISOString().split("T")[0]; // e.g. "2026-08-20"

  // Separate upcoming active events from concluded/past events
  const upcomingEvents = events.filter((e) => (e.endDate || e.startDate) >= todayStr && e.registrationOpen);
  const pastEvents = events.filter((e) => (e.endDate || e.startDate) < todayStr || !e.registrationOpen);
  const displayUpcoming = upcomingEvents.length > 0 ? upcomingEvents : events;

  // 0. Strict Guardrail against Internal Techstack / Software Infrastructure / Off-Topic queries
  if (
    q.includes("techstack") ||
    q.includes("tech stack") ||
    q.includes("architecture") ||
    q.includes("source code") ||
    q.includes("docker") ||
    q.includes("mongodb") ||
    q.includes("nginx") ||
    q.includes("server infra") ||
    q.includes("backend framework") ||
    q.includes("frontend framework") ||
    q.includes("what is this app built with") ||
    q.includes("how is this app built") ||
    q.includes("how was this website built") ||
    q.includes("codebase") ||
    q.includes("github repo")
  ) {
    return `Namaste! 🙏 As **Drishti AI**, I am dedicated exclusively to assisting delegates, clinicians, and visitors with **Sankara Eye Foundation India**, our upcoming medical conferences, CME registrations, delegate passes, scientific agendas, hospital Google Maps locations, and eye care initiatives.\n\nPlease feel free to explore our [Events Directory](/events) or check our [Academic Calendar](/calendar)!`;
  }

  // 1. Photos & Media Gallery
  if (q.includes("photo") || q.includes("gallery") || q.includes("samaro") || q.includes("picture") || q.includes("media") || q.includes("download photos") || q.includes("video")) {
    const isVision2020 = q.includes("20th") || q.includes("vision 2020") || q.includes("vision2020") || q.includes("samaro") || q.includes("annual ophthalmology") || (focusedEvent && (focusedEvent.slug.includes("annual-ophthalmology") || focusedEvent.slug.includes("vision-2020")));

    if (isVision2020) {
      return `📸 **20th Annual National Ophthalmology Conference (Vision 2020) — AI Photo Gallery**\n\nPhotographs for the **20th Annual National Ophthalmology Conference** are hosted on **Samaro.ai** with AI facial recognition search:\n\n👉 **[Access Samaro AI Photo Gallery](https://events.samaro.ai/sankara20thvision2020annualconference/gallery/media)**\n\nDelegates can upload a selfie to instantly find all their conference photos or browse by session halls!`;
    }

    if (focusedEvent) {
      return `📸 **Photographs & Media for ${focusedEvent.title}**\n\nEvent photographs and session media for this conference are available on its dedicated event overview:\n\n👉 **[View ${focusedEvent.title} Page](/events/${focusedEvent.slug})**`;
    }

    return `📸 **Sankara Event Photographs & Media Galleries**\n\nEvent photographs are published individually per conference:\n\n- **20th Annual National Ophthalmology Conference (Vision 2020)**: [Samaro AI Photo Gallery](https://events.samaro.ai/sankara20thvision2020annualconference/gallery/media)\n- **Other Conferences & CMEs**: Available on each respective [Event Details Page](/events).\n\n👉 **[Browse Events Directory](/events)**`;
  }

  // 2. Specific Hospital Branch Matcher (e.g. Ludhiana, Coimbatore, Bangalore, Guntur, etc.)
  const matchedBranch = SANKARA_BRANCHES.find((b) =>
    b.keywords.some((k) => q.includes(k))
  );

  if (matchedBranch) {
    return `🏥 **${matchedBranch.name}**\n\n- 📍 **Address**: ${matchedBranch.address}\n- 🗺️ **Google Maps Navigation**: [Click to Open Google Maps](${matchedBranch.maps})\n- 🔬 **Clinical Super-Specialties**: ${matchedBranch.specialties}\n- ℹ️ **About Branch**: ${matchedBranch.description}\n- 🥗 **Hospital Ethos**: **100% Pure Vegetarian** dietary service & 80:20 community cross-subsidization model.\n- 🌐 **Official Website**: [sankaraeye.com](https://sankaraeye.com)\n\n👉 **[Explore Upcoming Conferences & CMEs](/events)** | **[Academic Calendar](/calendar)**`;
  }

  // 3. Contact, Staff, Organizers, Secretariat & Helpline Inquiries (e.g. Saravanan D, Secretariat, Helpdesk, Support, Phone)
  if (
    q.includes("secretariat") ||
    q.includes("secretary") ||
    q.includes("contact") ||
    q.includes("phone") ||
    q.includes("email") ||
    q.includes("call") ||
    q.includes("saravanan") ||
    q.includes("helpdesk") ||
    q.includes("helpline") ||
    q.includes("organizer") ||
    q.includes("coordinator") ||
    q.includes("reach out") ||
    q.includes("support") ||
    q.includes("talk to human") ||
    q.includes("ask secretariat")
  ) {
    if (q.includes("saravanan")) {
      return `📞 **Contact Details for Mr. Saravanan D**\n\n- **Role**: Senior Administrator & Event Operations Head, Sankara Eye Hospital (Coimbatore HQ)\n- 📧 **Official Email**: \`events@sankaraeye.com\` | \`info@sankaraeye.com\`\n- 📱 **Event Helpline**: **+91 89515 68286**\n- 🏥 **Hospital HQ Board**: **+91 422 423 6789**\n- 📍 **Office Location**: Sankara Eye Hospital, Sivanandapuram, Saravanampatti, Coimbatore, Tamil Nadu - 641035\n\nFor official event administration, faculty coordination, or delegate assistance, you can also reach the event secretariat through any active [Event Page](/events).`;
    }

    return `📞 **Sankara Event Secretariat & Support Desk**\n\n- 👤 **Operations & Secretariat Head**: Mr. Saravanan D (Senior Administrator)\n- 📧 **Event Secretariat & Registrations**: \`events@sankaraeye.com\`\n- 📱 **Event Operations Helpline**: **+91 89515 68286**\n- 🏥 **Coimbatore HQ Hospital Board**: **+91 422 423 6789**\n- 🌐 **Official Web Portal**: [sankaraeye.com](https://sankaraeye.com)\n- 📍 **Headquarters**: Sivanandapuram, Saravanampatti, Coimbatore, Tamil Nadu - 641035\n\n💡 *Tip: You can use the **Ask Secretariat** button at the top right of this chat to log an inquiry ticket and receive an official verified reply directly to your email!*`;
  }

  // 4. All Hospitals Directory / List of all units
  if (
    q.includes("all hospitals") ||
    q.includes("all branches") ||
    q.includes("list of hospitals") ||
    q.includes("where are the hospitals") ||
    q.includes("locations") ||
    q.includes("hospital list")
  ) {
    const list = SANKARA_BRANCHES.map((b, i) =>
      `${i + 1}. **${b.name}**\n   📍 ${b.address} | [🗺️ Open Maps](${b.maps})`
    ).join("\n\n");

    return `🏥 **Sankara Eye Foundation India — 15 Hospital Locations Across India**\n\n${list}\n\n👉 **[Official Website](https://sankaraeye.com)** | **[Upcoming Academic Conferences](/events)**`;
  }

  // 5. Hospital Network & Institutional Facts Overview
  if (q.includes("hospital") || q.includes("network") || q.includes("surgery") || q.includes("surgeries") || q.includes("about") || q.includes("trust") || q.includes("nabh") || q.includes("founder") || q.includes("ramani")) {
    return `🏥 **About Sankara Eye Foundation India**\n\n- **Super-Specialty Network**: **15 Hospital Units** across India (14 Operational + 1 Upcoming Super-Specialty Unit in **Patna, Bihar**).\n- **Daily Free Surgeries**: **1,500+ Free Surgeries** performed daily for visually impaired & rural patients.\n- **Lifetime Impact**: Over **3,000,000+ (3 Million+) Free Surgeries** completed to date.\n- **Accreditation**: **NABH** (National Accreditation Board for Hospitals) and national healthcare quality certifications.\n- **Trust**: Unit of **Sri Kanchi Kamakoti Medical Trust** (Established 1977 by Dr. R.V. Ramani & Dr. Radha Ramani).\n- **Ethos**: 80:20 cross-subsidization model & **100% Pure Vegetarian** culinary hospitality across all hospital locations and conferences.`;
  }

    // 4. General Multi-Event Pricing, Fees, or Student/PG Concessions Query across UPCOMING events only
    if (
      q.includes("student") ||
      q.includes("pg") ||
      q.includes("resident") ||
      q.includes("fellow") ||
      q.includes("prices") ||
      q.includes("pricing") ||
      q.includes("fees") ||
      q.includes("how much") ||
      (q.includes("cost") && !focusedEvent) ||
      (q.includes("fee") && !focusedEvent) ||
      (q.includes("price") && !focusedEvent)
    ) {
      const isStudentQuery = q.includes("student") || q.includes("pg") || q.includes("resident") || q.includes("fellow");
      const eventCards = displayUpcoming.map((e) => {
        let tierSummary = "";
        if (e.pricingTiersJson) {
          try {
            const tiers = JSON.parse(e.pricingTiersJson);
            if (Array.isArray(tiers) && tiers.length > 0) {
              tierSummary = tiers.map((t: any) => `    - **${t.name}**: ₹${t.price.toLocaleString("en-IN")}${t.earlyBirdPrice ? ` *(Early Bird: ₹${t.earlyBirdPrice})*` : ""}`).join("\n");
            }
          } catch { }
        }
        return `• **[${e.title}](/events/${e.slug})**\n  🗓️ **Dates**: ${e.startDate} to ${e.endDate} | 📍 ${e.venue || e.city || "Coimbatore"}\n  🎟️ **Base Fee**: ${e.isPaid ? `**₹${e.registrationFee.toLocaleString("en-IN")}**` : "**Free Pass**"}\n${tierSummary ? tierSummary + "\n" : ""}  👉 **[Register Here](/events/${e.slug}/register)**`;
      }).join("\n\n");

      const header = isStudentQuery
        ? `🎓 **Upcoming Sankara Conferences & Student / PG Delegate Pricing**\n\nHere are the currently active upcoming medical conclaves and their delegate/student pricing categories:`
        : `🎟️ **Upcoming Sankara Events & Registration Pricing**\n\nHere is the fee schedule for our active upcoming academic conferences:`;

      return `${header}\n\n${eventCards}\n\n👉 **[Open Interactive Calendar](/calendar)** | **[All Events Directory](/events)**`;
    }

    // 5. Past Events / Concluded Archives
    if (q.includes("past") || q.includes("previous") || q.includes("concluded") || q.includes("archive") || q.includes("history")) {
      if (pastEvents.length === 0) {
        return `All currently listed conferences are active and upcoming! You can explore them in our [Events Directory](/events).`;
      }
      const pastCards = pastEvents.map((e) => {
        const isVision2020 = e.slug.includes("annual-ophthalmology") || e.slug.includes("vision-2020");
        const galleryLink = isVision2020
          ? `\n  📸 **Event Gallery**: [View Photos on Samaro AI](https://events.samaro.ai/sankara20thvision2020annualconference/gallery/media)`
          : `\n  📸 **Event Summary**: [View Event Details](/events/${e.slug})`;

        return `• **[${e.title}](/events/${e.slug})** *(🔴 Concluded)*\n  🗓️ **Conducted on**: ${e.startDate} to ${e.endDate} | 📍 ${e.venue}, ${e.city}${galleryLink}`;
      }).join("\n\n");

      return `🏛️ **Past & Concluded Sankara Academic Conferences**\n\n${pastCards}\n\n👉 **[Browse Upcoming Events](/events)** | **[Academic Calendar](/calendar)**`;
    }

    // 6. Current Event on User's Screen (Browser Context)
    const targetEvent = focusedEvent || events.find((e) =>
      q.includes(e.title.toLowerCase()) ||
      q.includes(e.slug.toLowerCase()) ||
      (e.shortDescription && q.includes(e.shortDescription.toLowerCase()))
    );

    // If asking about the active event or specific event attributes
    if (targetEvent) {
      const isEventPast = (targetEvent.endDate || targetEvent.startDate) < todayStr || !targetEvent.registrationOpen;
      const statusLabel = isEventPast ? "🔴 Concluded / Registrations Closed" : "🟢 Open for Registration";

      // A. Dates & Timings of this event
      if (q.includes("when") || q.includes("date") || q.includes("time") || q.includes("timing") || q.includes("schedule") || q.includes("start") || q.includes("end")) {
        return `🗓️ **Event Schedule for ${targetEvent.title}**\n\n- **Dates**: **${targetEvent.startDate}** to **${targetEvent.endDate}**\n- **Timings**: **${targetEvent.timeFrom || "09:00 AM"}** - **${targetEvent.timeTo || "05:00 PM"}**\n- **Venue**: ${targetEvent.venue}, ${targetEvent.city}\n- **Status**: ${statusLabel}\n\n👉 **[View Full Details & Register](/events/${targetEvent.slug})** | **[Academic Calendar](/calendar)**`;
      }

      // B. Venue & Location
      if (q.includes("where") || q.includes("venue") || q.includes("location") || q.includes("city") || q.includes("place") || q.includes("address")) {
        return `📍 **Venue & Location for ${targetEvent.title}**\n\n- **Venue**: **${targetEvent.venue}**\n- **City**: **${targetEvent.city || "Coimbatore, Tamil Nadu"}**\n- **Status**: ${statusLabel}\n- **Conducted by**: ${targetEvent.organizerName || "Sankara Eye Foundation India"}\n\n👉 **[Open Event Page](/events/${targetEvent.slug})**`;
      }

      // C. Pricing, Fee, Passes, Tiers, How to register
      if (
        q.includes("price") ||
        q.includes("fee") ||
        q.includes("cost") ||
        q.includes("tier") ||
        q.includes("ticket") ||
        q.includes("free") ||
        q.includes("pay") ||
        q.includes("discount") ||
        q.includes("coupon") ||
        q.includes("register") ||
        q.includes("how to register") ||
        (q.includes("pass") && !q.includes("my pass"))
      ) {
        let tiersText = "";
        if (targetEvent.pricingTiersJson) {
          try {
            const tiers = JSON.parse(targetEvent.pricingTiersJson);
            if (Array.isArray(tiers) && tiers.length > 0) {
              tiersText = "\n\n**Delegate Pricing Categories:**\n" + tiers.map((t: any) => `• **${t.name}**: ₹${t.price.toLocaleString("en-IN")}${t.earlyBirdPrice ? ` *(Early Bird: ₹${t.earlyBirdPrice})*` : ""}`).join("\n");
            }
          } catch { }
        }

        return `🎟️ **Registration & Fee Details for ${targetEvent.title}**\n\n- **Base Fee**: ${targetEvent.isPaid ? `**₹${targetEvent.registrationFee.toLocaleString("en-IN")}**` : "**Complimentary / Free Pass**"}\n- **Status**: ${statusLabel}${tiersText}\n\n👉 **[Click Here to Register Online](/events/${targetEvent.slug}/register)**`;
      }

      // D. Agenda & Scientific Sessions
      if (q.includes("agenda") || q.includes("session") || q.includes("speaker") || q.includes("faculty") || q.includes("program") || q.includes("topic") || q.includes("talk")) {
        let agendaList = "";
        if (targetEvent.agendaJson) {
          try {
            const agenda = JSON.parse(targetEvent.agendaJson);
            if (Array.isArray(agenda) && agenda.length > 0) {
              agendaList = "\n\n**Scientific Sessions & Schedule:**\n" + agenda.slice(0, 6).map((item: any) =>
                `• **${item.time || item.timeSlot || "Session"}**: ${item.title || item.sessionTitle || "Clinical Topic"} *(Faculty: ${item.speaker || "Faculty"} - ${item.hall || "Main Auditorium"})*`
              ).join("\n");
            }
          } catch { }
        }

        return `📋 **Scientific Agenda for ${targetEvent.title}**\n\n- **Theme**: ${targetEvent.shortDescription || targetEvent.title}${agendaList || "\nDetailed scientific tracks covering Cataract, Cornea, Retina, Glaucoma, and Community Ophthalmology."}\n\n👉 **[View Full Interactive Agenda](/events/${targetEvent.slug})**`;
      }

      // E. Food & Dining
      if (q.includes("food") || q.includes("lunch") || q.includes("dinner") || q.includes("breakfast") || q.includes("tea") || q.includes("catering") || q.includes("veg") || q.includes("non veg") || q.includes("diet")) {
        return `🍽️ **Culinary & Food Arrangements for ${targetEvent.title}**\n\n- In accordance with the institutional ethos of Sankara Eye Foundation India, all conference meals, working lunches, and high-tea refreshments are **100% Pure Vegetarian**.\n- Crafted to the highest standards of culinary hygiene, hospitality, and nutrition.\n- Food access is included with your delegate badge.`;
      }
    }

    // 7. Academic Calendar & Schedule
    if (q.includes("calendar") || q.includes("all events") || q.includes("schedule") || q.includes("dates") || q.includes("upcoming")) {
      const list = displayUpcoming.map((e) =>
        `• **[${e.title}](/events/${e.slug})**\n  🗓️ ${e.startDate} to ${e.endDate} | 📍 ${e.venue}, ${e.city} | ${e.isPaid ? `₹${e.registrationFee}` : "Free"}`
      ).join("\n\n");

      return `📅 **Upcoming Sankara Academic Events & Conferences**\n\n${list}\n\n👉 **[Open Interactive Lu.ma Calendar](/calendar)** | **[All Events Directory](/events)**`;
    }

    // 8. Personal Digital Passes & QR Codes
    if (q.includes("my pass") || q.includes("my registration") || q.includes("my ticket") || q.includes("qr code") || q.includes("my qr") || q.includes("wallet") || q.includes("download pass") || q.includes("find my pass")) {
      return `🎟️ **Access Your Admission Passes & Digital QR Badges**\n\nYou can access your confirmed registration pass, QR code for scanner entry, food token badges, and 1-click Google Wallet pass here:\n\n👉 **[Open My Registrations & Passes](/my-registrations)**`;
    }

    // 9. Medical & Ophthalmology Knowledge (Cataract, Glaucoma, Cornea, Retina, Lasik, General Eye Health)
    if (q.includes("cataract") || q.includes("phaco") || q.includes("iol") || q.includes("lens")) {
      return `👁️ **About Cataract Care & Surgery at Sankara**\n\n- **What is Cataract?**: Clouding of the natural crystalline eye lens, causing blurred or misty vision.\n- **Treatment**: Micro-incision Phacoemulsification with Foldable Intraocular Lens (IOL) implantation.\n- **Sankara Impact**: Over 1,500+ free cataract surgeries performed daily across rural & base hospitals.\n- **Academic Sessions**: Regularly featured in our [Annual Ophthalmology Conferences](/events).`;
    }

    if (q.includes("glaucoma") || q.includes("iop") || q.includes("pressure") || q.includes("optic nerve")) {
      return `👁️ **About Glaucoma Care & Management**\n\n- **The Silent Thief of Sight**: Glaucoma damages the optic nerve often due to elevated intraocular pressure (IOP).\n- **Diagnosis & Care**: Advanced automated perimetry, OCT scans, medical drop therapy, and trabeculectomy / tube shunt surgery.\n- **Academic CMEs**: Check our [Academic Calendar](/calendar) for upcoming sub-specialty glaucoma symposia.`;
    }

    if (q.includes("cornea") || q.includes("keratoplasty") || q.includes("transplant") || q.includes("keratoconus")) {
      return `👁️ **Cornea & Refractive Services at Sankara**\n\n- Comprehensive corneal transplantation (DMEK, DSEK, PKP), eye banking, and Keratoconus cross-linking (C3R).\n- **Upcoming Conclave**: [Pediatric Cornea & Refractive Surgery Conclave 2026](/events/pediatric-cornea-cme-2026).\n- Explore registration details in our [Event Directory](/events).`;
    }

    if (q.includes("retina") || q.includes("diabetic") || q.includes("macular") || q.includes("vitrectomy")) {
      return `👁️ **Vitreoretinal Services & Research**\n\n- Advanced management of Diabetic Retinopathy, Retinal Detachment, and Age-Related Macular Degeneration (AMD) with anti-VEGF therapy and micro-incision vitrectomy (MIVS).\n- Check our [Scientific Events Directory](/events) for retina symposiums.`;
    }

    // 10. Generic Smart Search across Upcoming Events
    const matches = displayUpcoming.filter((e) =>
      e.title.toLowerCase().includes(q) ||
      (e.description && e.description.toLowerCase().includes(q)) ||
      (e.venue && e.venue.toLowerCase().includes(q)) ||
      (e.city && e.city.toLowerCase().includes(q))
    );

    if (matches.length > 0) {
      const list = matches.map((e) =>
        `• **[${e.title}](/events/${e.slug})**\n  🗓️ ${e.startDate} | 📍 ${e.venue}, ${e.city} | ${e.isPaid ? `₹${e.registrationFee}` : "Free Pass"}`
      ).join("\n\n");
      return `Here are the upcoming events matching your request:\n\n${list}\n\n👉 **[Browse Full Event Directory](/events)**`;
    }

    // 11. General Greetings / Conversational Questions
    if (q.includes("who are you") || q.includes("what can you do") || q.includes("help") || q.includes("hello") || q.includes("namaste") || q.includes("hi")) {
      const featured = displayUpcoming.map((e) => `• **[${e.title}](/events/${e.slug})** (${e.startDate})`).join("\n");
      return `Namaste! 🙏 I am **Drishti AI** (दृष्टि), the AI assistant for Sankara Eye Foundation India 👁️\n\nI can assist you with:\n- 📅 **Conferences & CME Registrations**: [Event Directory](/events) | [Academic Calendar](/calendar)\n- 🗺️ **Hospital Google Maps Locations**: 14 Hospitals across India (+1 in Patna, Bihar)\n- 📸 **Event Photos & Media**: [Samaro AI Gallery](https://events.samaro.ai/sankara20thvision2020annualconference/gallery/media)\n- 🎟️ **Admission Passes & QR Badges**: [My Registrations](/my-registrations)\n\n**Upcoming Conclaves:**\n${featured}\n\nHow may I help you today?`;
    }

    // Default helpful overview
    const featured = displayUpcoming.map((e) => `• **[${e.title}](/events/${e.slug})** (${e.startDate})`).join("\n");
    return `Namaste! 🙏 I am **Drishti AI** (दृष्टि), the official AI assistant for Sankara Eye Foundation India.\n\nI specialize strictly in **Sankara Eye Foundation India**, our medical conferences, CME registrations, delegate passes, scientific agendas, hospital network, Google Maps locations, and clinical eye care.\n\n**Upcoming Active Conclaves:**\n${featured}\n\nHow may I assist you with Sankara events today?`;
  }

  // ── 1. POST /api/chat — Public Conversational AI Endpoint ─────────────────────
  router.post("/chat", async (req, res): Promise<void> => {
    const startTime = Date.now();
    try {
      const {
        message,
        sessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        userIdentifier = "Anonymous Delegate",
        history = [],
        currentPath = "",
        currentUrl = "",
        pageTitle = "",
        activeEventSlug = "",
        visiblePageContext = "",
      } = req.body;

      if (!message || !message.trim()) {
        res.status(400).json({ error: "Message is required" });
        return;
      }

      // Retrieve active and recent events from database with full detail
      const allEvents = await db
        .select({
          id: eventsTable.id,
          slug: eventsTable.slug,
          title: eventsTable.title,
          eventType: eventsTable.eventType,
          description: eventsTable.description,
          shortDescription: eventsTable.shortDescription,
          venue: eventsTable.venue,
          city: eventsTable.city,
          startDate: eventsTable.startDate,
          endDate: eventsTable.endDate,
          timeFrom: eventsTable.timeFrom,
          timeTo: eventsTable.timeTo,
          isPaid: eventsTable.isPaid,
          registrationFee: eventsTable.registrationFee,
          registrationOpen: eventsTable.registrationOpen,
          maxCapacity: eventsTable.maxCapacity,
          pricingTiersJson: eventsTable.pricingTiersJson,
          agendaJson: eventsTable.agendaJson,
          organizerName: eventsTable.organizerName,
          organizerEmail: eventsTable.organizerEmail,
          organizerPhone: eventsTable.organizerPhone,
          postEventSummary: eventsTable.postEventSummary,
          postEventVisitorCount: eventsTable.postEventVisitorCount,
        })
        .from(eventsTable)
        .orderBy(desc(eventsTable.startDate))
        .limit(20);

      // Identify if user is currently browsing a specific event
      let focusedEvent = allEvents.find((e) =>
        (activeEventSlug && e.slug.toLowerCase() === activeEventSlug.toLowerCase()) ||
        (currentPath && currentPath.includes(e.slug))
      );

      let focusedEventDetails = "";
      if (focusedEvent) {
        let parsedAgenda = "";
        if (focusedEvent.agendaJson) {
          try {
            const agenda = JSON.parse(focusedEvent.agendaJson);
            if (Array.isArray(agenda)) {
              parsedAgenda = agenda.map((item: any, idx: number) =>
                `  - Day/Slot ${idx + 1}: ${item.time || item.timeSlot || ""} | ${item.title || item.sessionTitle || ""} | Speaker: ${item.speaker || item.faculty || "Faculty"} | Hall: ${item.hall || item.hallName || "Main Hall"}`
              ).join("\n");
            }
          } catch { }
        }

        focusedEventDetails = `
=== EVENT CURRENTLY ACTIVE ON USER'S BROWSER SCREEN ===
- Title: "${focusedEvent.title}"
- Event URL: /events/${focusedEvent.slug}
- Dates: ${focusedEvent.startDate} to ${focusedEvent.endDate} (${focusedEvent.timeFrom} - ${focusedEvent.timeTo})
- Venue: ${focusedEvent.venue}, ${focusedEvent.city}
- Registration Status: ${focusedEvent.registrationOpen ? "Open for Registration" : "Closed / Concluded"}
- Registration Fee: ${focusedEvent.isPaid ? `₹${focusedEvent.registrationFee}` : "Free Pass"}
- Overview: ${focusedEvent.shortDescription || focusedEvent.description || "Super-specialty medical conclave"}
- Contact Organizer: ${focusedEvent.organizerEmail || "events@sankaraeye.com"} | ${focusedEvent.organizerPhone || "+91 89515 68286"}
${parsedAgenda ? `- Detailed Schedule & Sessions:\n${parsedAgenda}` : ""}
`;
      }

      // Fetch verified Q&As from Dynamic AI Knowledge Base
      let dynamicKnowledgeContext = "";
      try {
        const kbEntries = await db
          .select()
          .from(aiKnowledgeBaseTable)
          .where(eq(aiKnowledgeBaseTable.isActive, true));

        const normalizedMsg = message.toLowerCase().trim();

        // Check for direct match in verified knowledge base
        for (const kb of kbEntries) {
          const keywords = kb.questionKeywords.split(",").map((k) => k.trim().toLowerCase()).filter(Boolean);
          const matchesKeyword = keywords.length > 0 && keywords.every((kw) => normalizedMsg.includes(kw));
          const matchesQuestion = normalizedMsg.includes(kb.questionText.toLowerCase().trim()) || kb.questionText.toLowerCase().trim().includes(normalizedMsg);

          if (matchesKeyword || matchesQuestion) {
            // Increment usage count asynchronously
            db.update(aiKnowledgeBaseTable)
              .set({ usageCount: sql`${aiKnowledgeBaseTable.usageCount} + 1` })
              .where(eq(aiKnowledgeBaseTable.id, kb.id))
              .catch(() => { });

            const kbAnswer = cleanAiMarkdown(kb.verifiedAnswer);
            const latencyMs = Date.now() - startTime;

            // Save chat log
            try {
              await db.insert(chatLogsTable).values({
                sessionId,
                userIdentifier: userIdentifier || "Anonymous Delegate",
                userMessage: message.trim(),
                botResponse: kbAnswer,
                modelUsed: "Sankara-Verified-KnowledgeBase",
                latencyMs,
              });
            } catch { }

            return res.json({
              response: kbAnswer,
              sessionId,
              modelUsed: "Sankara-Verified-KnowledgeBase",
              latencyMs,
              timestamp: new Date().toISOString(),
            });
          }
        }

        if (kbEntries.length > 0) {
          dynamicKnowledgeContext = `\n=== VERIFIED INSTITUTIONAL KNOWLEDGE BASE (OFFICIAL ADMIN RESOLUTIONS) ===\n` +
            kbEntries.map((k, idx) => `[Verified Q&A #${idx + 1}] Question: "${k.questionText}" | Answer: "${k.verifiedAnswer}"`).join("\n") + "\n";
        }
      } catch (kbErr: any) {
        logger.warn({ err: kbErr.message }, "Notice: Knowledge base check skipped");
      }

      // Format all events with clear upcoming vs concluded categorization
      const todayStr = new Date().toISOString().split("T")[0]; // "2026-08-20"
      const upcomingList = allEvents.filter((ev) => (ev.endDate || ev.startDate) >= todayStr && ev.registrationOpen);
      const pastList = allEvents.filter((ev) => (ev.endDate || ev.startDate) < todayStr || !ev.registrationOpen);

      const upcomingContext = upcomingList.map((ev, i) => {
        let tiersInfo = "";
        if (ev.pricingTiersJson) {
          try {
            const tiers = JSON.parse(ev.pricingTiersJson);
            if (Array.isArray(tiers)) {
              tiersInfo = ` | Pricing Tiers: ` + tiers.map((t: any) => `${t.name}: ₹${t.price}`).join(", ");
            }
          } catch { }
        }
        return `[Upcoming Event #${i + 1}] Title: "${ev.title}" (Slug: ${ev.slug}) | Dates: ${ev.startDate} to ${ev.endDate} | Venue: ${ev.venue}, ${ev.city} | Status: 🟢 Open for Registration | Fee: ${ev.isPaid ? `₹${ev.registrationFee}` : "Free"}${tiersInfo} | Link: /events/${ev.slug}`;
      }).join("\n");

      const pastContext = pastList.map((ev, i) =>
        `[Past Event #${i + 1}] Title: "${ev.title}" (Slug: ${ev.slug}) | Dates: ${ev.startDate} to ${ev.endDate} | Status: 🔴 Concluded / Closed | Link: /events/${ev.slug}`
      ).join("\n");

      const eventsContext = `
=== CURRENTLY UPCOMING & ACTIVE SANKARA CONFERENCES ===
${upcomingContext || "No upcoming conferences currently scheduled."}

=== PAST & CONCLUDED CONFERENCES (ARCHIVE ONLY - DO NOT RECOMMEND AS UPCOMING) ===
${pastContext || "None."}
`;

      const browserContextSection = `
=== LIVE BROWSER STATE & USER SCREEN CONTEXT ===
- User Current URL: ${currentUrl || "/events"}
- User Current Path: ${currentPath || "/events"}
- Page Title: ${pageTitle || "Sankara Events"}
${visiblePageContext ? `- Visible Text on User's Screen: "${visiblePageContext}"` : ""}
${focusedEventDetails}
`;

      const systemPrompt = `You are Drishti AI (दृष्टि • "Divine Vision & Insight"), the official AI assistant for Sankara Eye Foundation India (Sri Kanchi Kamakoti Medical Trust).

STRICT DOMAIN GUARDRAIL & SCOPE RESTRICTION:
- You must ONLY answer queries that are directly relevant to Sankara Eye Foundation India:
  1. Sankara academic conferences, CMEs, workshops, registration passes, fee tiers, scientific schedules, speakers, halls, agendas.
  2. Sankara Hospital Network (14 hospitals + 1 upcoming in Patna, Bihar), Google Maps navigation links, NABH accreditations, surgical statistics (1,500+ free surgeries/day, 3,000,000+ lifetime free surgeries), founders (Dr. R.V. Ramani & Dr. Radha Ramani), and pure vegetarian catering.
  3. Samaro AI event photo galleries, digital QR passes on /my-registrations, and academic calendar sync on /calendar.
  4. Clinical ophthalmology and eye care procedures (cataract, phaco, IOL, cornea, glaucoma, retina, refractive surgery) as practiced and taught at Sankara Eye Hospitals.
- STRICT PROHIBITION: You MUST NEVER discuss internal software tech stacks (e.g. servers, docker, databases, mongodb, nginx, linux, coding, internal architecture, programming languages, or backend/frontend infrastructure).
- STRICT PROHIBITION: You MUST NEVER answer generic off-topic questions (e.g. general coding, unrelated politics, general IT, gaming, etc.).
- IF ASKED ABOUT TECH STACK OR OFF-TOPIC SUBJECTS, DECLINE POLITELY WITH:
  "Namaste! As **Drishti AI**, I specialize exclusively in **Sankara Eye Foundation India**, our medical conferences, CME registrations, delegate passes, scientific agendas, hospital network, Google Maps locations, and clinical eye care. Please let me know how I can assist you with any of our upcoming events or hospital branches across India!"

CRITICAL TIME AWARENESS & EVENT STATUS:
- Today's Date is: ${todayStr}
- ALWAYS distinguish between UPCOMING active events and PAST/CONCLUDED events.
- When asked for upcoming conferences or registration pricing, ONLY recommend active upcoming events. DO NOT list past/concluded events as if they are in the future!

${SANKARA_HOSPITAL_KNOWLEDGE}

${dynamicKnowledgeContext}

${browserContextSection}

${eventsContext}

=== INSTRUCTIONS & RULES ===
1. Only answer queries relevant to Sankara Eye Foundation India and its events/hospitals/ophthalmology.
2. Directly answer the user's specific request using live browser context and database details.
3. If the user is on an event page, prioritize answering about that event with specific timings, venues, speaker details, pricing tiers, and registration instructions.
4. Always format responses with clean GitHub Markdown (bold titles, bullet points, and clean relative links like [Event Title](/events/slug)). Never output raw localhost or IP address URLs.
5. When mentioning an event, always link to its page using format: [Event Title](/events/slug).
6. Photo Galleries & Media: The Samaro AI gallery link (https://events.samaro.ai/sankara20thvision2020annualconference/gallery/media) is EXCLUSIVELY for the 20th Annual National Ophthalmology Conference (Vision 2020). For other conferences, direct delegates to that event's own page (/events/slug).
7. If asked about hospital locations or maps, provide Google Maps links from the institutional directory.
8. If asked about academic dates or schedule, link to [/calendar](/calendar).
9. If asked about passes, tickets, or QR badges, link to [/my-registrations](/my-registrations).
10. Always state institutional numbers accurately: 14 Hospitals (+1 Upcoming in Patna, Bihar), 1500+ free surgeries/day, 3M+ free surgeries done, NABH accredited.
11. Keep responses warm, respectful, concise, clear, and easy to read.`;

      const conversationMessages = [
        { role: "system", content: systemPrompt },
        ...history.slice(-4).map((h: any) => ({
          role: h.sender === "user" ? "user" : "assistant",
          content: h.text || h.content,
        })),
        { role: "user", content: message.trim() },
      ];

      let aiResponse = "";
      let modelUsed = "Google Gemini 2.0 Flash";

      try {
        if (GEMINI_API_KEY) {
          aiResponse = await queryGemini(systemPrompt, conversationMessages);
          modelUsed = "Google Gemini 2.0 Flash";
        } else {
          aiResponse = await queryLlama(conversationMessages);
          modelUsed = "Meta Llama 3.3 70B";
        }
      } catch (llmErr: any) {
        try {
          aiResponse = await queryLlama(conversationMessages);
          modelUsed = "Meta Llama 3.3 70B (HF Router)";
        } catch (hfErr: any) {
          logger.warn({ error: hfErr.message }, "Falling back to local grounded engine");
          aiResponse = generateLocalGroundedAnswer(
            message.trim(),
            allEvents,
            focusedEvent,
            { currentPath, currentUrl, pageTitle, visiblePageContext }
          );
          modelUsed = "Sankara-Grounded-Engine (Browser-Aware)";
        }
      }

      // Clean and sanitize AI response formatting before returning
      aiResponse = cleanAiMarkdown(aiResponse);

      const latencyMs = Date.now() - startTime;

      // Log to chat_logs database table
      try {
        await db.insert(chatLogsTable).values({
          sessionId,
          userIdentifier: userIdentifier || "Anonymous Delegate",
          userMessage: message.trim(),
          botResponse: aiResponse,
          modelUsed,
          latencyMs,
        });
      } catch (logErr: any) {
        logger.error({ err: logErr.message }, "Failed to save chat log entry");
      }

      res.json({
        response: aiResponse,
        sessionId,
        modelUsed,
        latencyMs,
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      logger.error({ err: err.message }, "Error handling /api/chat");
      res.status(500).json({ error: "Failed to process chat query", details: err.message });
    }
  });

  // ── 2. POST /api/chat/escalate — Escalate Unresolved Query to Human Secretariat ──
  router.post("/chat/escalate", async (req, res): Promise<void> => {
    try {
      const { userEmail, userPhone, userMessage, userIdentifier, botDraftResponse } = req.body;

      if (!userEmail || !userMessage) {
        res.status(400).json({ error: "userEmail and userMessage are required to log an escalation ticket." });
        return;
      }

      const ticketNumber = `SNK-${Math.floor(100000 + Math.random() * 900000)}`;

      const [ticket] = await db
        .insert(unresolvedQueriesTable)
        .values({
          ticketNumber,
          userIdentifier: userIdentifier || "Anonymous Delegate",
          userEmail: userEmail.trim().toLowerCase(),
          userPhone: userPhone ? userPhone.trim() : null,
          userMessage: userMessage.trim(),
          botDraftResponse: botDraftResponse ? String(botDraftResponse).trim() : null,
          status: "pending",
        })
        .returning();

      // Trigger instant email alert to Super Admins via Zoho SMTP
      const host = req.get("host") || "localhost:3000";
      const protocol = req.protocol || "http";
      const adminDashboardUrl = `${protocol}://${host}/admin/unresolved-queries?ticket=${ticketNumber}`;

      sendUnresolvedQueryAdminAlertEmail({
        ticketNumber,
        userIdentifier: userIdentifier || "Anonymous Delegate",
        userEmail: userEmail.trim(),
        userPhone: userPhone || null,
        userMessage: userMessage.trim(),
        adminDashboardUrl,
      }).catch((mailErr: any) => {
        logger.error({ err: mailErr.message }, "Failed to dispatch admin escalation email alert");
      });

      res.json({
        success: true,
        ticketNumber,
        message: `Inquiry ticket #${ticketNumber} successfully logged. Our secretariat has been notified via email and will reply to ${userEmail} directly.`,
        ticket,
      });
    } catch (err: any) {
      logger.error({ err: err.message }, "Error creating escalation ticket");
      res.status(500).json({ error: "Failed to log escalation ticket", details: err.message });
    }
  });

  // ── 3. GET /api/admin/unresolved-queries — Super Admin Tickets List ───────────
  router.get("/admin/unresolved-queries", async (req, res): Promise<void> => {
    try {
      const page = Math.max(1, parseInt((req.query.page as string) || "1", 10));
      const limit = Math.min(100, Math.max(1, parseInt((req.query.limit as string) || "50", 10)));
      const offset = (page - 1) * limit;
      const statusFilter = (req.query.status as string || "all").toLowerCase();
      const search = (req.query.search as string || "").trim();

      let query = db.select().from(unresolvedQueriesTable);

      const conditions: any[] = [];
      if (statusFilter !== "all") {
        conditions.push(eq(unresolvedQueriesTable.status, statusFilter));
      }
      if (search) {
        conditions.push(
          or(
            like(sql`LOWER(${unresolvedQueriesTable.ticketNumber})`, `%${search.toLowerCase()}%`),
            like(sql`LOWER(${unresolvedQueriesTable.userEmail})`, `%${search.toLowerCase()}%`),
            like(sql`LOWER(${unresolvedQueriesTable.userMessage})`, `%${search.toLowerCase()}%`),
            like(sql`LOWER(${unresolvedQueriesTable.userIdentifier})`, `%${search.toLowerCase()}%`)
          )
        );
      }

      const whereClause = conditions.length > 1 ? sql.join(conditions, sql` AND `) : conditions[0];

      const tickets = whereClause
        ? await db
          .select()
          .from(unresolvedQueriesTable)
          .where(whereClause)
          .orderBy(desc(unresolvedQueriesTable.createdAt))
          .limit(limit)
          .offset(offset)
        : await db
          .select()
          .from(unresolvedQueriesTable)
          .orderBy(desc(unresolvedQueriesTable.createdAt))
          .limit(limit)
          .offset(offset);

      // Stats
      const statsResult: any = await db.execute(sql`
      SELECT 
        COUNT(*)::int as total_tickets,
        COUNT(*) FILTER (WHERE status = 'pending')::int as pending_count,
        COUNT(*) FILTER (WHERE status = 'resolved')::int as resolved_count
      FROM unresolved_queries
    `);

      const statsRow = statsResult?.rows?.[0] || statsResult?.[0] || {};

      res.json({
        tickets,
        pagination: { page, limit },
        stats: {
          totalTickets: Number(statsRow.total_tickets || 0),
          pendingCount: Number(statsRow.pending_count || 0),
          resolvedCount: Number(statsRow.resolved_count || 0),
        },
      });
    } catch (err: any) {
      logger.error({ err: err.message }, "Error fetching unresolved queries");
      res.status(500).json({ error: "Failed to fetch unresolved queries", details: err.message });
    }
  });

  // ── 4. POST /api/admin/resolve-query — Send Reply & Train AI Knowledge Base ────
  router.post("/admin/resolve-query", async (req, res): Promise<void> => {
    try {
      const {
        ticketId,
        adminReply,
        resolvedByName = "Super Admin (Sankara HQ)",
        addToKnowledgeBase = true,
        topic = "General",
        questionKeywords,
      } = req.body;

      if (!ticketId || !adminReply) {
        res.status(400).json({ error: "ticketId and adminReply are required." });
        return;
      }

      const [ticket] = await db
        .select()
        .from(unresolvedQueriesTable)
        .where(eq(unresolvedQueriesTable.id, parseInt(ticketId, 10)))
        .limit(1);

      if (!ticket) {
        res.status(404).json({ error: "Ticket not found." });
        return;
      }

      // 1. Update Ticket in Database
      await db
        .update(unresolvedQueriesTable)
        .set({
          status: "resolved",
          adminReply: adminReply.trim(),
          resolvedBy: resolvedByName,
          resolvedAt: new Date(),
          addedToKnowledgeBase: Boolean(addToKnowledgeBase),
          updatedAt: new Date(),
        })
        .where(eq(unresolvedQueriesTable.id, ticket.id));

      // 2. Dispatch verified answer email to the delegate via Zoho SMTP
      await sendResolvedQueryUserEmail({
        ticketNumber: ticket.ticketNumber,
        userIdentifier: ticket.userIdentifier,
        userEmail: ticket.userEmail,
        userQuestion: ticket.userMessage,
        adminReply: adminReply.trim(),
        resolvedByName,
      });

      // 3. Add to AI Dynamic Knowledge Base if requested
      let kbEntry: any = null;
      if (addToKnowledgeBase) {
        // Derive keywords if not provided
        const keywordsToUse = questionKeywords || ticket.userMessage
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, "")
          .split(/\s+/)
          .filter((w: string) => w.length > 3 && !["what", "when", "where", "which", "about", "could", "would", "should", "from", "sankara", "hospital"].includes(w))
          .slice(0, 8)
          .join(", ");

        const [newKb] = await db
          .insert(aiKnowledgeBaseTable)
          .values({
            topic: topic || "General",
            questionKeywords: keywordsToUse || ticket.userMessage,
            questionText: ticket.userMessage.trim(),
            verifiedAnswer: adminReply.trim(),
            source: "admin_resolution",
            addedBy: resolvedByName,
            isActive: true,
          })
          .returning();
        kbEntry = newKb;
      }

      res.json({
        success: true,
        message: `Verified reply sent to ${ticket.userEmail} and added to Drishti AI Knowledge Base!`,
        kbEntry,
      });
    } catch (err: any) {
      logger.error({ err: err.message }, "Error resolving query");
      res.status(500).json({ error: "Failed to resolve query", details: err.message });
    }
  });

  // ── 5. GET /api/admin/knowledge-base — View AI Learned Knowledge Base ─────────
  router.get("/admin/knowledge-base", async (req, res): Promise<void> => {
    try {
      const entries = await db
        .select()
        .from(aiKnowledgeBaseTable)
        .orderBy(desc(aiKnowledgeBaseTable.createdAt));

      res.json({ entries, total: entries.length });
    } catch (err: any) {
      logger.error({ err: err.message }, "Error fetching knowledge base");
      res.status(500).json({ error: "Failed to fetch knowledge base", details: err.message });
    }
  });

  // ── 6. POST /api/admin/knowledge-base — Add / Edit Knowledge Item ──────────────
  router.post("/admin/knowledge-base", async (req, res): Promise<void> => {
    try {
      const { topic = "General", questionKeywords, questionText, verifiedAnswer, addedBy = "Super Admin" } = req.body;

      if (!questionText || !verifiedAnswer) {
        res.status(400).json({ error: "questionText and verifiedAnswer are required." });
        return;
      }

      const [entry] = await db
        .insert(aiKnowledgeBaseTable)
        .values({
          topic,
          questionKeywords: questionKeywords || questionText,
          questionText: questionText.trim(),
          verifiedAnswer: verifiedAnswer.trim(),
          source: "institutional",
          addedBy,
          isActive: true,
        })
        .returning();

      res.json({ success: true, entry });
    } catch (err: any) {
      logger.error({ err: err.message }, "Error saving knowledge base entry");
      res.status(500).json({ error: "Failed to save knowledge base entry", details: err.message });
    }
  });

  // ── 7. DELETE /api/admin/knowledge-base/:id — Delete Knowledge Item ───────────
  router.delete("/admin/knowledge-base/:id", async (req, res): Promise<void> => {
    try {
      const id = parseInt(req.params.id, 10);
      await db.delete(aiKnowledgeBaseTable).where(eq(aiKnowledgeBaseTable.id, id));
      res.json({ success: true, message: "Knowledge base entry removed." });
    } catch (err: any) {
      logger.error({ err: err.message }, "Error deleting knowledge base entry");
      res.status(500).json({ error: "Failed to delete knowledge base entry", details: err.message });
    }
  });

  // ── 8. GET /api/admin/chat-logs — Admin Telemetry & Audit List ─────────────────
  router.get("/admin/chat-logs", async (req, res): Promise<void> => {
    try {
      const page = Math.max(1, parseInt((req.query.page as string) || "1", 10));
      const limit = Math.min(100, Math.max(1, parseInt((req.query.limit as string) || "50", 10)));
      const offset = (page - 1) * limit;
      const search = (req.query.search as string || "").trim();

      let logsQuery = db
        .select()
        .from(chatLogsTable)
        .orderBy(desc(chatLogsTable.createdAt))
        .limit(limit)
        .offset(offset);

      if (search) {
        logsQuery = db
          .select()
          .from(chatLogsTable)
          .where(
            or(
              like(sql`LOWER(${chatLogsTable.userMessage})`, `%${search.toLowerCase()}%`),
              like(sql`LOWER(${chatLogsTable.botResponse})`, `%${search.toLowerCase()}%`),
              like(sql`LOWER(${chatLogsTable.userIdentifier})`, `%${search.toLowerCase()}%`),
              like(sql`LOWER(${chatLogsTable.sessionId})`, `%${search.toLowerCase()}%`)
            )
          )
          .orderBy(desc(chatLogsTable.createdAt))
          .limit(limit)
          .offset(offset) as any;
      }

      const logs = await logsQuery;

      // Aggregate stats
      const statsResult: any = await db.execute(sql`
      SELECT 
        COUNT(*)::int as total_queries,
        COUNT(DISTINCT session_id)::int as unique_sessions,
        COALESCE(AVG(latency_ms)::int, 0) as avg_latency_ms
      FROM chat_logs
    `);

      const statsRow = statsResult?.rows?.[0] || statsResult?.[0] || {};

      res.json({
        logs,
        pagination: {
          page,
          limit,
        },
        stats: {
          totalQueries: Number(statsRow.total_queries || 0),
          uniqueSessions: Number(statsRow.unique_sessions || 0),
          avgLatencyMs: Number(statsRow.avg_latency_ms || 0),
        },
      });
    } catch (err: any) {
      logger.error({ err: err.message }, "Error fetching admin chat logs");
      res.status(500).json({ error: "Failed to fetch chat logs", details: err.message });
    }
  });

  // ── 9. GET /api/admin/chat-logs/export-csv — Download Complete Chat History CSV ──
  router.get("/admin/chat-logs/export-csv", async (req, res): Promise<void> => {
    try {
      const logs = await db
        .select()
        .from(chatLogsTable)
        .orderBy(desc(chatLogsTable.createdAt))
        .limit(5000);

      const escapeCsv = (str: string | number | null | undefined): string => {
        if (str === null || str === undefined) return '""';
        const clean = String(str).replace(/"/g, '""').replace(/\r\n|\n|\r/g, " ");
        return `"${clean}"`;
      };

      const headers = [
        "Log ID",
        "Timestamp (IST)",
        "Session ID",
        "User Identifier",
        "User Query",
        "AI Assistant Response",
        "Model Used",
        "Latency (ms)",
      ];

      const csvRows = [headers.join(",")];

      for (const log of logs) {
        const istDate = log.createdAt
          ? new Date(log.createdAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })
          : "";

        const row = [
          escapeCsv(log.id),
          escapeCsv(istDate),
          escapeCsv(log.sessionId),
          escapeCsv(log.userIdentifier),
          escapeCsv(log.userMessage),
          escapeCsv(log.botResponse),
          escapeCsv(log.modelUsed),
          escapeCsv(log.latencyMs),
        ];

        csvRows.push(row.join(","));
      }

      const csvContent = csvRows.join("\r\n");
      const filename = `sankara_ai_chat_logs_${new Date().toISOString().split("T")[0]}.csv`;

      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.status(200).send(csvContent);
    } catch (err: any) {
      logger.error({ err: err.message }, "Error exporting chat logs to CSV");
      res.status(500).json({ error: "Failed to export chat logs CSV", details: err.message });
    }
  });

  export default router;

