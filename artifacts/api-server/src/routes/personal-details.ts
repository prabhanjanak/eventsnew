import { Router } from "express";
import { db, personalDetailsTable, participantsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";

const router = Router();

// GET /participants/:id/personal-details — check if already submitted
router.get("/participants/:id/personal-details", requireAuth(["participant", "admin"]), async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const user = req.user!;
  if (user.userType === "participant" && user.participantId !== id) {
    res.status(403).json({ error: "Forbidden" }); return;
  }

  try {
    const [details] = await db
      .select()
      .from(personalDetailsTable)
      .where(eq(personalDetailsTable.participantId, id));

    if (!details) {
      res.json({ submitted: false });
      return;
    }

    res.json({
      submitted: true,
      age: details.age,
      gender: details.gender,
      dietaryPreference: details.dietaryPreference,
      city: details.city,
      submittedAt: details.submittedAt.toISOString(),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to fetch personal details" });
  }
});

// POST /participants/:id/personal-details — save once
router.post("/participants/:id/personal-details", requireAuth(["participant"]), async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const user = req.user!;
  if (user.participantId !== id) {
    res.status(403).json({ error: "Forbidden" }); return;
  }

  const { age, gender, dietaryPreference, city } = req.body as {
    age?: string; gender?: string; dietaryPreference?: string; city?: string;
  };

  try {
    // Check if already submitted
    const [existing] = await db
      .select()
      .from(personalDetailsTable)
      .where(eq(personalDetailsTable.participantId, id));

    if (existing) {
      res.status(400).json({ error: "Personal details already submitted. Contact admin to update." });
      return;
    }

    const [details] = await db
      .insert(personalDetailsTable)
      .values({ participantId: id, age: age || null, gender: gender || null, dietaryPreference: dietaryPreference || null, city: city || null })
      .returning();

    res.status(201).json({
      submitted: true,
      age: details.age,
      gender: details.gender,
      dietaryPreference: details.dietaryPreference,
      city: details.city,
      submittedAt: details.submittedAt.toISOString(),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to save personal details" });
  }
});

export default router;
