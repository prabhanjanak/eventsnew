import { Router } from "express";
import { eq, ne } from "drizzle-orm";
import { db, syncSessionsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { getGoogleAuthClient, getSpreadsheetSheets } from "../lib/googleSheets";


const router = Router();

// GET /sync-sessions - Get all sessions
router.get(
  "/sync-sessions",
  requireAuth(["super_admin", "admin", "coordinator_view_only"]),
  async (_req, res): Promise<void> => {
    try {
      const sessions = await db
        .select()
        .from(syncSessionsTable)
        .orderBy(syncSessionsTable.id);
      res.json(sessions);
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to fetch sync sessions" });
    }
  }
);

// GET /sync-sessions/active - Get the active session
router.get(
  "/sync-sessions/active",
  async (_req, res): Promise<void> => {
    try {
      const [activeSession] = await db
        .select()
        .from(syncSessionsTable)
        .where(eq(syncSessionsTable.isActive, true))
        .limit(1);
      res.json(activeSession || null);
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to fetch active sync session" });
    }
  }
);

// GET /sync-sessions/sheets - Fetch all available sheets/tabs in a Google Sheets workbook
router.get(
  "/sync-sessions/sheets",
  requireAuth(["super_admin", "admin"]),
  async (req, res): Promise<void> => {
    const sheetId = req.query.sheetId as string;
    if (!sheetId) {
      res.status(400).json({ error: "sheetId query parameter is required." });
      return;
    }

    try {
      // 1. Try official Sheets API first if Service Account is configured
      const auth = await getGoogleAuthClient().catch(() => null);
      if (auth) {
        try {
          const sheets = await getSpreadsheetSheets(sheetId);
          res.json({ sheets });
          return;
        } catch (apiErr: any) {
          console.warn("[Google Sheets API fallback to HTML] Sheets API call failed:", apiErr.message);
        }
      }

      // 2. Fallback: Parse public HTML if API is unconfigured or failed
      const url = `https://docs.google.com/spreadsheets/d/${sheetId}/htmlview`;
      const response = await fetch(url);
      if (!response.ok) {
        res.status(400).json({ error: `Failed to fetch sheets list from Google. Status: ${response.status}` });
        return;
      }
      
      const html = await response.text();
      const nameRegex = /items\.push\(\s*\{\s*name:\s*"([^"]+)"/g;
      const sheets: string[] = [];
      let match;
      while ((match = nameRegex.exec(html)) !== null) {
        let sheetName = match[1];
        try {
          // Unescape backslash escapes
          sheetName = JSON.parse(`"${sheetName}"`);
        } catch {
          // Fallback
        }
        if (sheetName && !sheets.includes(sheetName)) {
          sheets.push(sheetName);
        }
      }

      res.json({ sheets });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to fetch spreadsheet tabs." });
    }
  }
);

// POST /sync-sessions - Create a new session
router.post(
  "/sync-sessions",
  requireAuth(["super_admin"]),
  async (req, res): Promise<void> => {
    const { name, googleSheetId, sheetName, locationName, fieldMappings } = req.body;
    if (!name || !googleSheetId) {
      res.status(400).json({ error: "Name and Google Sheet ID are required." });
      return;
    }

    try {
      const [newSession] = await db
        .insert(syncSessionsTable)
        .values({
          name,
          googleSheetId,
          sheetName: sheetName || "",
          locationName: locationName || "Sankara Eye Hospital",
          fieldMappings: fieldMappings || {},
          isActive: false,
        })
        .returning();

      res.status(201).json(newSession);
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to create sync session" });
    }
  }
);

// PATCH /sync-sessions/:id - Update session settings/mappings
router.patch(
  "/sync-sessions/:id",
  requireAuth(["super_admin"]),
  async (req, res): Promise<void> => {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid session ID." });
      return;
    }

    const { name, googleSheetId, sheetName, locationName, fieldMappings } = req.body;

    try {
      const [existing] = await db
        .select()
        .from(syncSessionsTable)
        .where(eq(syncSessionsTable.id, id))
        .limit(1);

      if (!existing) {
        res.status(404).json({ error: "Sync session not found." });
        return;
      }

      const [updated] = await db
        .update(syncSessionsTable)
        .set({
          ...(name !== undefined ? { name } : {}),
          ...(googleSheetId !== undefined ? { googleSheetId } : {}),
          ...(sheetName !== undefined ? { sheetName } : {}),
          ...(locationName !== undefined ? { locationName } : {}),
          ...(fieldMappings !== undefined ? { fieldMappings } : {}),
        })
        .where(eq(syncSessionsTable.id, id))
        .returning();

      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to update sync session" });
    }
  }
);

// POST /sync-sessions/:id/activate - Activate a session and deactivate all others
router.post(
  "/sync-sessions/:id/activate",
  requireAuth(["super_admin"]),
  async (req, res): Promise<void> => {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid session ID." });
      return;
    }

    try {
      const [existing] = await db
        .select()
        .from(syncSessionsTable)
        .where(eq(syncSessionsTable.id, id))
        .limit(1);

      if (!existing) {
        res.status(404).json({ error: "Sync session not found." });
        return;
      }

      // Deactivate all sessions
      await db
        .update(syncSessionsTable)
        .set({ isActive: false })
        .where(ne(syncSessionsTable.id, id));

      // Activate chosen session
      const [activated] = await db
        .update(syncSessionsTable)
        .set({ isActive: true })
        .where(eq(syncSessionsTable.id, id))
        .returning();

      res.json(activated);
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to activate sync session" });
    }
  }
);

// POST /sync-sessions/:id/validate - Validate Sheet ID configuration
router.post(
  "/sync-sessions/:id/validate",
  requireAuth(["super_admin"]),
  async (req, res): Promise<void> => {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid session ID." });
      return;
    }

    try {
      const [session] = await db
        .select()
        .from(syncSessionsTable)
        .where(eq(syncSessionsTable.id, id))
        .limit(1);

      if (!session) {
        res.status(404).json({ error: "Sync session not found." });
        return;
      }

      const sheetId = session.googleSheetId;
      // We will try to fetch the first/default tab (e.g. sheetName or 'Chair')
      const tabName = session.sheetName || "Chair";
      const fetchUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tabName)}`;

      const response = await fetch(fetchUrl);
      if (!response.ok) {
        res.status(400).json({
          error: `Could not access Sheet ID. Verify sharing permissions (Anyone with link can view). Status: ${response.status}`,
        });
        return;
      }

      const text = await response.text();
      if (!text || text.includes("<!DOCTYPE html>") || text.includes("<html")) {
        res.status(400).json({
          error: "Fetched data was HTML instead of CSV. Ensure spreadsheet link sharing is active.",
        });
        return;
      }

      res.json({ success: true, message: `Successfully validated connection to Sheet ID for tab '${tabName}'.` });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to validate Google Sheet ID" });
    }
  }
);

// DELETE /sync-sessions/:id - Delete session config
router.delete(
  "/sync-sessions/:id",
  requireAuth(["super_admin"]),
  async (req, res): Promise<void> => {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid session ID." });
      return;
    }

    try {
      const [session] = await db
        .select()
        .from(syncSessionsTable)
        .where(eq(syncSessionsTable.id, id))
        .limit(1);

      if (!session) {
        res.status(404).json({ error: "Sync session not found." });
        return;
      }

      if (session.isActive) {
        res.status(400).json({ error: "Cannot delete the active session. Please activate another session first." });
        return;
      }

      await db.delete(syncSessionsTable).where(eq(syncSessionsTable.id, id));
      res.json({ success: true, message: "Sync session deleted successfully." });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to delete sync session" });
    }
  }
);

export default router;
