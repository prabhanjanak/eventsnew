import { Router } from "express";
import { db, eventsTable, chatLogsTable } from "@workspace/db";
import { desc, eq, sql, like, or } from "drizzle-orm";
import { logger } from "../lib/logger";

const router = Router();

const HF_API_TOKEN = process.env.HF_TOKEN || process.env.HUGGINGFACE_TOKEN || "";
const DEFAULT_MODEL = "meta-llama/Llama-3.3-70B-Instruct";
const FALLBACK_MODEL = "Qwen/Qwen2.5-72B-Instruct";

// System Knowledge Base — Institutional Pillars
const SANKARA_HOSPITAL_KNOWLEDGE = `
=== SANKARA EYE FOUNDATION INDIA INSTITUTIONAL KNOWLEDGE ===
- Organization: Sankara Eye Foundation India (a unit of Sri Kanchi Kamakoti Medical Trust, established 1977).
- Founder: Dr. R.V. Ramani and Dr. Radha Ramani.
- Network: 14 Super-Specialty Eye Hospitals across India (+ 1 Upcoming Super-Specialty Hospital in Patna, Bihar).
- Surgeries Per Day: 1,500+ Free Surgeries for the Blind / Visually Impaired.
- Historical Impact: 3,000,000+ (3 Million+) Free Surgeries Completed to date.
- Accreditations: NABH (National Accreditation Board for Hospitals & Healthcare Providers) and other quality healthcare accreditations.
- Philosophy: 80:20 Model (Cross-subsidized care providing free surgical care to rural and underprivileged citizens).
- Catering & Hospitality: All conferences, workshops, and hospital events strictly adhere to Pure Vegetarian culinary traditions with highest standards of hygiene.
- Official Website: https://sankaraeye.com
- Photo Gallery & Media: Event attendees can access and search high-resolution photographs with AI facial recognition on Samaro.ai: https://events.samaro.ai/sankara20thvision2020annualconference/gallery/media
- Navigation Links:
  - Event Directory: /events
  - Interactive Academic Calendar: /calendar
  - My Registered Passes: /my-registrations
  - Coordinator Login: /login
`;

// Helper to call Hugging Face Router API (OpenAI compatible)
async function queryHuggingFace(messages: Array<{ role: string; content: string }>, modelName: string = DEFAULT_MODEL): Promise<string> {
  const modelsToTry = [modelName, FALLBACK_MODEL, "meta-llama/Llama-3.1-8B-Instruct"];

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
          max_tokens: 600,
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
      logger.warn({ error: e.message, model }, "Failed to reach HuggingFace router");
    }
  }

  throw new Error("All HuggingFace inference models exhausted or rate-limited.");
}

// Local Grounded Search Fallback (if HF API is completely unreachable)
function generateLocalGroundedAnswer(userQuery: string, events: any[]): string {
  const q = userQuery.toLowerCase();

  if (q.includes("photo") || q.includes("gallery") || q.includes("samaro") || q.includes("picture") || q.includes("media")) {
    return `📸 **Event Photos & Media Gallery**\n\nYou can access, search using AI face recognition, and download high-resolution event photographs directly on the **Samaro.ai Gallery**:\n👉 [Open Samaro AI Photo Gallery](https://events.samaro.ai/sankara20thvision2020annualconference/gallery/media)\n\nPhotos from the Vision 2020 Annual Conference and other conclaves are available for all delegates!`;
  }

  if (q.includes("hospital") || q.includes("surgery") || q.includes("surgeries") || q.includes("about") || q.includes("patna") || q.includes("bihar") || q.includes("trust") || q.includes("nabh")) {
    return `🏥 **About Sankara Eye Foundation India**\n\n- **Hospitals**: 14 Super-Specialty Hospitals across India (+ 1 Upcoming Hospital in Patna, Bihar).\n- **Daily Surgeries**: 1,500+ Free Surgeries for the Blind per day.\n- **Total Impact**: 3M+ (3 Million+) Free Surgeries Completed.\n- **Accreditation**: NABH and other recognized quality accreditations.\n- **Trust**: Sri Kanchi Kamakoti Medical Trust (Founded 1977).\n- **Culinary**: Exclusively Pure Vegetarian catering across all institutional gatherings.`;
  }

  if (q.includes("calendar") || q.includes("schedule") || q.includes("agenda")) {
    return `📅 **Sankara Academic Schedule & Calendar**\n\nYou can view the full academic schedule in Month, Week, and Agenda views with 1-click Google Calendar & Apple iCal sync:\n👉 [Open Lu.ma Events Calendar](/calendar)`;
  }

  if (q.includes("pass") || q.includes("ticket") || q.includes("qr") || q.includes("my registration") || q.includes("badge")) {
    return `🎟️ **Access Your Admission Passes & Badges**\n\nYou can view your registered digital admission passes, QR codes, and Google Wallet passes anytime under:\n👉 [My Registrations & Passes](/my-registrations)`;
  }

  const matchedEvents = events.filter((e) =>
    e.title.toLowerCase().includes(q) ||
    (e.description && e.description.toLowerCase().includes(q)) ||
    (e.venue && e.venue.toLowerCase().includes(q)) ||
    (e.city && e.city.toLowerCase().includes(q))
  );

  if (matchedEvents.length > 0) {
    const list = matchedEvents.map((e) =>
      `• **[${e.title}](/events/${e.slug})**\n  🗓️ ${e.startDate} | 📍 ${e.venue}, ${e.city} | 🎟️ ${e.isPaid ? "Paid CME" : "Complimentary Registration"}`
    ).join("\n\n");
    return `Here are the relevant events matching your query:\n\n${list}\n\n👉 [Explore All Events](/events)`;
  }

  const upcomingList = events.slice(0, 3).map((e) =>
    `• **[${e.title}](/events/${e.slug})** (${e.startDate}) - ${e.city}`
  ).join("\n");

  return `Hello! I am your **Sankara Event & Hospital Concierge** 👁️\n\nI can help you with:\n- 📅 **Conferences & CME Registration**: [Explore Directory](/events) or [Interactive Calendar](/calendar)\n- 📸 **Event Photos & Media**: [Samaro AI Gallery](https://events.samaro.ai/sankara20thvision2020annualconference/gallery/media)\n- 🎟️ **Digital Passes & QR Codes**: [My Passes](/my-registrations)\n- 🏥 **Hospital Network**: 14 Hospitals across India (+ 1 Upcoming in Patna, Bihar), 1500+ free surgeries/day.\n\n**Featured Events:**\n${upcomingList}\n\nHow may I assist you today?`;
}

// ── 1. POST /api/chat — Public Conversational AI Endpoint ─────────────────────
router.post("/chat", async (req, res): Promise<void> => {
  const startTime = Date.now();
  try {
    const { message, sessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`, userIdentifier = "Anonymous Delegate", history = [] } = req.body;

    if (!message || !message.trim()) {
      res.status(400).json({ error: "Message is required" });
      return;
    }

    // Retrieve active and recent events from database
    const allEvents = await db
      .select({
        id: eventsTable.id,
        slug: eventsTable.slug,
        title: eventsTable.title,
        eventType: eventsTable.eventType,
        description: eventsTable.description,
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
        postEventVisitorCount: eventsTable.postEventVisitorCount,
      })
      .from(eventsTable)
      .orderBy(desc(eventsTable.startDate))
      .limit(20);

    // Format events for grounded LLM context
    const eventsContext = allEvents.map((ev, i) => {
      let tiersInfo = "";
      if (ev.pricingTiersJson) {
        try {
          const tiers = JSON.parse(ev.pricingTiersJson);
          if (Array.isArray(tiers)) {
            tiersInfo = ` | Pricing: ` + tiers.map((t: any) => `${t.name}: ₹${t.price}`).join(", ");
          }
        } catch {}
      }

      return `[Event #${i + 1}] Title: "${ev.title}" (Slug: ${ev.slug}) | Type: ${ev.eventType} | Dates: ${ev.startDate} to ${ev.endDate} | Venue: ${ev.venue}, ${ev.city} | Reg Status: ${ev.registrationOpen ? "Open" : "Concluded/Closed"} | Fee: ${ev.isPaid ? `₹${ev.registrationFee}` : "Free"}${tiersInfo} | Link: /events/${ev.slug}`;
    }).join("\n");

    const systemPrompt = `You are the official AI Event & Medical Concierge for Sankara Eye Foundation India (Sri Kanchi Kamakoti Medical Trust).
Your job is to provide accurate, warm, professional, and helpful answers about conferences, CMEs, workshops, registration passes, photo gallery access, and hospital information.

${SANKARA_HOSPITAL_KNOWLEDGE}

=== LIVE DATABASE OF SANKARA EVENTS ===
${eventsContext}

=== INSTRUCTIONS & RULES ===
1. Always format responses with clean GitHub Markdown (bold titles, bullet points, and clickable markdown links).
2. When mentioning an event, always link to its page using format: [Event Title](/events/slug).
3. If asked about event photographs, always provide the Samaro AI link: https://events.samaro.ai/sankara20thvision2020annualconference/gallery/media
4. If asked about academic dates or schedule, link to [/calendar](/calendar).
5. If asked about passes, tickets, or QR badges, link to [/my-registrations](/my-registrations).
6. Always state institutional numbers accurately: 14 Hospitals (+1 Upcoming in Patna, Bihar), 1500+ free surgeries/day, 3M+ free surgeries done, NABH accredited.
7. Keep responses concise, clear, and easy to read on mobile and desktop screens.`;

    const conversationMessages = [
      { role: "system", content: systemPrompt },
      ...history.slice(-4).map((h: any) => ({
        role: h.sender === "user" ? "user" : "assistant",
        content: h.text || h.content,
      })),
      { role: "user", content: message.trim() },
    ];

    let aiResponse = "";
    let modelUsed = DEFAULT_MODEL;

    try {
      aiResponse = await queryHuggingFace(conversationMessages, DEFAULT_MODEL);
    } catch (hfErr: any) {
      logger.warn({ error: hfErr.message }, "Falling back to local grounded engine");
      aiResponse = generateLocalGroundedAnswer(message.trim(), allEvents);
      modelUsed = "Sankara-Grounded-Engine (Local Fallback)";
    }

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

// ── 2. GET /api/admin/chat-logs — Admin Telemetry & Audit List ─────────────────
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

// ── 3. GET /api/admin/chat-logs/export-csv — Download Complete Chat History CSV ──
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
