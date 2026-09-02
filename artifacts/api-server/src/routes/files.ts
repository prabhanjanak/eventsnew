import { Router } from "express";
import { eq, inArray, desc, and, or, ilike, sql } from "drizzle-orm";
import { db, assignmentsTable, uploadedFilesTable, participantsTable, submissionSettingsTable, activityLogsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import {
  UploadFileParams,
  GetFileParams,
  DownloadFileParams,
} from "@workspace/api-zod";
import multer from "multer";
import path from "path";
import fs from "fs";
import { sendUploadSuccessWhatsapp } from "../lib/mailer";
import { ZipArchive } from "archiver";

const router = Router();

function sanitizePathSegment(val: string | null | undefined, fallback: string): string {
  if (!val) return fallback;
  return val
    .trim()
    .replace(/[^a-zA-Z0-9-_]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const uploadsDir = path.resolve(process.cwd(), "uploads");
const fallbackUploadsDir = path.resolve(process.cwd(), "artifacts/api-server/uploads");

try {
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true, mode: 0o777 });
  }
} catch {}

export function resolveUploadedFilePath(filename: string): string {
  const p1 = path.join(uploadsDir, filename);
  if (fs.existsSync(p1)) return p1;
  const p2 = path.join(fallbackUploadsDir, filename);
  if (fs.existsSync(p2)) return p2;
  return p1;
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    // Sanitize original filename: keep only alphanumeric, dots, hyphens
    const ext = path.extname(file.originalname).toLowerCase();
    const base = path.basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9_\-]/g, "_")
      .replace(/_+/g, "_")
      .slice(0, 80); // max 80 chars for base
    cb(null, `${Date.now()}_${base}${ext}`);
  },
});

const ALLOWED_MIMES: Record<string, string[]> = {
  ".pptx": ["application/vnd.openxmlformats-officedocument.presentationml.presentation", "application/octet-stream"],
  ".ppt":  ["application/vnd.ms-powerpoint", "application/octet-stream"],
  ".pdf":  ["application/pdf"],
  ".jpg":  ["image/jpeg"],
  ".jpeg": ["image/jpeg"],
  ".png":  ["image/png"],
};

const upload = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedMimes = ALLOWED_MIMES[ext];
    if (!allowedMimes) {
      cb(new Error("Only PPT, PPTX, PDF presentation slides and JPG, JPEG, PNG poster images are allowed"));
      return;
    }
    cb(null, true);
  }
});

// ─── GET /submissions/all ─────────────────────────────────────────────────────
// Lists all assignments + upload status. Admin only.
// Query: ?track=&session=&role=&date=&uploaded=true|false
router.get("/submissions/all", requireAuth(["admin", "pr_member", "coordinator_view_only"]), async (req, res): Promise<void> => {
  const { track, session, role, date, uploaded } = req.query as Record<string, string>;

  // Build filters for database query
  const conditions = [sql`lower(${assignmentsTable.role}) not like '%staff%'`];

  if (track) conditions.push(ilike(assignmentsTable.track, `%${track}%`));
  if (session) conditions.push(ilike(assignmentsTable.sessionName, `%${session}%`));
  if (role) {
    const requestedRoles = role.toLowerCase().split(",").map(r => r.trim()).filter(Boolean);
    if (requestedRoles.length > 0) {
      conditions.push(sql`lower(${assignmentsTable.role}) in (${sql.join(requestedRoles, sql`, `)})`);
    }
  }
  if (date) conditions.push(eq(assignmentsTable.date, date));

  const rolesRequiringUpload = ["Speaker", "Presenter", "Poster", "Discussion"];
  if (uploaded === "true") {
    conditions.push(sql`exists (select 1 from ${uploadedFilesTable} where ${uploadedFilesTable.assignmentId} = ${assignmentsTable.id})`);
  } else if (uploaded === "false") {
    conditions.push(sql`not exists (select 1 from ${uploadedFilesTable} where ${uploadedFilesTable.assignmentId} = ${assignmentsTable.id})`);
    conditions.push(inArray(assignmentsTable.role, rolesRequiringUpload));
  }

  // Fetch filtered assignments + participant info from database
  const rows = await db
    .select({
      assignmentId: assignmentsTable.id,
      participantId: participantsTable.id,
      participantName: participantsTable.name,
      registrationNumber: participantsTable.registrationNumber,
      institution: participantsTable.institution,
      role: assignmentsTable.role,
      track: assignmentsTable.track,
      sessionName: assignmentsTable.sessionName,
      hall: assignmentsTable.hall,
      date: assignmentsTable.date,
      time: assignmentsTable.time,
      presentationTitle: assignmentsTable.presentationTitle,
    })
    .from(assignmentsTable)
    .innerJoin(participantsTable, eq(assignmentsTable.participantId, participantsTable.id))
    .where(and(...conditions))
    .orderBy(assignmentsTable.date, assignmentsTable.track, assignmentsTable.sessionName, assignmentsTable.time);

  // Fetch associated files for these specific assignments (latest versions only)
  const assignmentIds = rows.map((r) => r.assignmentId);
  const files =
    assignmentIds.length > 0
      ? await db
          .select()
          .from(uploadedFilesTable)
          .where(inArray(uploadedFilesTable.assignmentId, assignmentIds))
          .orderBy(uploadedFilesTable.version)
      : [];

  const fileMap = new Map<number, typeof files[0]>();
  for (const f of files) fileMap.set(f.assignmentId, f);

  const result = rows.map((r) => {
    const file = fileMap.get(r.assignmentId) ?? null;
    return {
      assignmentId: r.assignmentId,
      participantId: r.participantId,
      participantName: r.participantName,
      registrationNumber: r.registrationNumber,
      institution: r.institution,
      role: r.role,
      track: r.track,
      sessionName: r.sessionName,
      hall: r.hall,
      date: r.date,
      time: r.time,
      presentationTitle: r.presentationTitle,
      uploadedFile: file
        ? {
            id: file.id,
            filename: file.filename,
            originalName: file.originalName,
            fileType: file.fileType,
            version: file.version,
            size: file.size,
            uploadedAt: file.uploadedAt.toISOString(),
          }
        : null,
    };
  });

  // Query distinct filter lists from database
  const [tracksRes, sessionsRes, rolesRes, datesRes] = await Promise.all([
    db
      .selectDistinct({ track: assignmentsTable.track })
      .from(assignmentsTable)
      .where(and(
        sql`lower(${assignmentsTable.role}) not like '%staff%'`,
        sql`${assignmentsTable.track} is not null`
      ))
      .orderBy(assignmentsTable.track),
    db
      .selectDistinct({ sessionName: assignmentsTable.sessionName })
      .from(assignmentsTable)
      .where(and(
        sql`lower(${assignmentsTable.role}) not like '%staff%'`,
        sql`${assignmentsTable.sessionName} is not null`
      ))
      .orderBy(assignmentsTable.sessionName),
    db
      .selectDistinct({ role: assignmentsTable.role })
      .from(assignmentsTable)
      .where(and(
        sql`lower(${assignmentsTable.role}) not like '%staff%'`,
        sql`${assignmentsTable.role} is not null`
      ))
      .orderBy(assignmentsTable.role),
    db
      .selectDistinct({ date: assignmentsTable.date })
      .from(assignmentsTable)
      .where(and(
        sql`lower(${assignmentsTable.role}) not like '%staff%'`,
        sql`${assignmentsTable.date} is not null`
      ))
      .orderBy(assignmentsTable.date),
  ]);

  const tracks = tracksRes.map((r) => r.track).filter(Boolean) as string[];
  const sessions = sessionsRes.map((r) => r.sessionName).filter(Boolean) as string[];
  const roles = rolesRes.map((r) => r.role).filter(Boolean) as string[];
  const dates = datesRes.map((r) => r.date).filter(Boolean) as string[];

  // ── Global stats — always unfiltered so cards show correct total counts ──────
  // (filtered `result` is only used for the submissions list below)
  const globalRows = await db
    .select({
      participantId: participantsTable.id,
      role: assignmentsTable.role,
      track: assignmentsTable.track,
      hasFile: sql<boolean>`exists (select 1 from ${uploadedFilesTable} where ${uploadedFilesTable.assignmentId} = ${assignmentsTable.id})`,
    })
    .from(assignmentsTable)
    .innerJoin(participantsTable, eq(assignmentsTable.participantId, participantsTable.id))
    .where(sql`lower(${assignmentsTable.role}) not like '%staff%'`);

  // Count non-General entries first; for any participant that only has General, count them once.
  const countUnique = (role: string) => {
    const properTrack = globalRows.filter((r) => r.role === role && r.track !== "General");
    const properParticipantIds = new Set(properTrack.map((r) => r.participantId));
    const generalOnlyCount = globalRows.filter(
      (r) => r.role === role && r.track === "General" && !properParticipantIds.has(r.participantId)
    ).length;
    return properTrack.length + generalOnlyCount;
  };

  const totalSpeakers = countUnique("Speaker");
  const totalDiscussion = countUnique("Discussion");
  const totalPresenters = countUnique("Presenter");
  const totalPosters = countUnique("Poster");
  const totalPresentations = totalSpeakers + totalDiscussion + totalPresenters;

  // Uploaded/pending — from the filtered result (respects active filter)
  const globalUploadable = globalRows.filter((r) => rolesRequiringUpload.includes(r.role));

  res.json({
    total: globalUploadable.length,
    totalPresentations,
    totalSpeakers,
    totalDiscussion,
    totalPresenters,
    totalPosters,
    uploaded: globalUploadable.filter((r) => r.hasFile).length,
    pending: globalUploadable.filter((r) => !r.hasFile).length,
    filters: { tracks, sessions, roles, dates },
    submissions: result,
  });
});

// ─── POST /files/download-zip ─────────────────────────────────────────────────
// Body: { fileIds: number[] } — download selected files as structured ZIP
router.post("/files/download-zip", requireAuth(["admin", "pr_member", "coordinator_view_only"]), async (req, res): Promise<void> => {
  const { fileIds } = req.body as { fileIds?: number[] };
  if (!Array.isArray(fileIds) || fileIds.length === 0) {
    res.status(400).json({ error: "fileIds array is required" });
    return;
  }
  const files = await db
    .select({
      file: uploadedFilesTable,
      assignment: assignmentsTable,
      participant: participantsTable
    })
    .from(uploadedFilesTable)
    .leftJoin(assignmentsTable, eq(uploadedFilesTable.assignmentId, assignmentsTable.id))
    .leftJoin(participantsTable, eq(assignmentsTable.participantId, participantsTable.id))
    .where(inArray(uploadedFilesTable.id, fileIds));

  if (files.length === 0) {
    res.status(404).json({ error: "No files found" });
    return;
  }

  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", `attachment; filename="vision2020_selected_${Date.now()}.zip"`);

  const arc = new ZipArchive({ zlib: { level: 6 } });
  arc.on("error", (err: any) => { res.destroy(err); });
  arc.pipe(res);

  for (const { file, assignment, participant } of files) {
    if (!file) continue;
    const filePath = resolveUploadedFilePath(file.filename);
    if (fs.existsSync(filePath)) {
      const sanitize = (s?: string | null) => (s || "").replace(/[^a-zA-Z0-9 ]/g, "").trim().replace(/\s+/g, "_");
      const dateStr = sanitize(assignment?.date) || "No_Date";
      const trackStr = sanitize(assignment?.track) || "Track";
      const sessionStr = assignment?.sessionName ? `_${sanitize(assignment.sessionName)}` : "";
      const timeStr = sanitize(assignment?.time) || "No_Time";
      const nameStr = participant?.name ? `_${sanitize(participant.name)}` : "";
      const instStr = participant?.institution ? `_${sanitize(participant.institution)}` : "";
      
      const downloadName = `${dateStr}_${trackStr}${sessionStr}${nameStr}${instStr}.${file.fileType}`;
      const roleFolder = (assignment?.role || "").toLowerCase().includes("poster") ? "Posters" : "PPT";
      const zipPath = `${roleFolder}/${trackStr}/${dateStr}/${sessionStr.replace("_", "") || "Session"}/${timeStr}/${downloadName}`;
      
      arc.file(filePath, { name: zipPath });
    }
  }

  await arc.finalize();
});

// ─── GET /files/download-all ──────────────────────────────────────────────────
// Download ALL uploaded files as structured ZIP
router.get("/files/download-all", requireAuth(["admin", "pr_member", "coordinator_view_only"]), async (_req, res): Promise<void> => {
  const files = await db
    .select({
      file: uploadedFilesTable,
      assignment: assignmentsTable,
      participant: participantsTable
    })
    .from(uploadedFilesTable)
    .leftJoin(assignmentsTable, eq(uploadedFilesTable.assignmentId, assignmentsTable.id))
    .leftJoin(participantsTable, eq(assignmentsTable.participantId, participantsTable.id))
    .orderBy(uploadedFilesTable.uploadedAt);

  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", `attachment; filename="vision2020_all_submissions_${Date.now()}.zip"`);

  const arc = new ZipArchive({ zlib: { level: 6 } });
  arc.on("error", (err: any) => { res.destroy(err); });
  arc.pipe(res);

  // Filter to only latest version per assignment
  const latestFilesMap = new Map<number, typeof files[0]>();
  for (const f of files) {
    if (f.assignment) {
      latestFilesMap.set(f.assignment.id, f);
    }
  }

  for (const { file, assignment, participant } of latestFilesMap.values()) {
    if (!file) continue;
    const filePath = resolveUploadedFilePath(file.filename);
    if (fs.existsSync(filePath)) {
      const sanitize = (s?: string | null) => (s || "").replace(/[^a-zA-Z0-9 ]/g, "").trim().replace(/\s+/g, "_");
      const dateStr = sanitize(assignment?.date) || "No_Date";
      const trackStr = sanitize(assignment?.track) || "Track";
      const sessionStr = assignment?.sessionName ? `_${sanitize(assignment.sessionName)}` : "";
      const timeStr = sanitize(assignment?.time) || "No_Time";
      const nameStr = participant?.name ? `_${sanitize(participant.name)}` : "";
      const instStr = participant?.institution ? `_${sanitize(participant.institution)}` : "";
      
      const downloadName = `${dateStr}_${trackStr}${sessionStr}${nameStr}${instStr}.${file.fileType}`;
      const roleFolder = (assignment?.role || "").toLowerCase().includes("poster") ? "Posters" : "PPT";
      const zipPath = `${roleFolder}/${trackStr}/${dateStr}/${sessionStr.replace("_", "") || "Session"}/${timeStr}/${downloadName}`;
      
      arc.file(filePath, { name: zipPath });
    }
  }

  await arc.finalize();
});

// ─── POST /assignments/:assignmentId/file ─────────────────────────────────────
router.post(
  "/assignments/:assignmentId/file",
  requireAuth(["admin", "participant", "track_coordinator"]),
  upload.single("file"),
  async (req, res): Promise<void> => {
    const params = UploadFileParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    if (!req.file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }

    const isStaff = ["admin", "track_coordinator", "super_admin"].includes(req.user?.userType || "");
    if (isStaff) {
      const hasPermission = req.user?.userType === "super_admin" || req.user?.permissions?.includes("edit_submissions");
      if (!hasPermission) {
        fs.unlinkSync(req.file.path);
        res.status(403).json({ error: "You are not authorized to upload or edit files. Please contact the super admin." });
        return;
      }
    }

    const [settings] = await db.select().from(submissionSettingsTable).limit(1);
    const isAdminOrEditor = req.user?.userType === "admin" || req.user?.userType === "super_admin" || req.user?.permissions?.includes("edit_submissions");
    const isPastDeadline = false; // Bypassed deadline per user request

    if (!isAdminOrEditor) {
      if (settings && !settings.submissionsOpen) {
        fs.unlinkSync(req.file.path);
        res.status(403).json({ error: "Submissions are closed" });
        return;
      }
      if (isPastDeadline) {
        fs.unlinkSync(req.file.path);
        res.status(403).json({ error: "Submissions are closed (passed 3-day deadline before conference)" });
        return;
      }
    }

    const [assignment] = await db
      .select()
      .from(assignmentsTable)
      .where(eq(assignmentsTable.id, params.data.assignmentId));
    if (!assignment) {
      fs.unlinkSync(req.file.path);
      res.status(404).json({ error: "Assignment not found" });
      return;
    }

    const ext = path.extname(req.file.originalname).toLowerCase().replace(".", "");
    const isPoster = assignment.role === "Poster";

    if (isPoster && !["jpg", "jpeg", "png"].includes(ext)) {
      fs.unlinkSync(req.file.path);
      res.status(400).json({ error: "Poster presenters must upload JPG, JPEG or PNG images only" });
      return;
    }
    if (!isPoster && !["pptx", "ppt", "pdf"].includes(ext)) {
      fs.unlinkSync(req.file.path);
      res.status(400).json({ error: "Speakers and presenters must upload PPTX, PPT or PDF files only" });
      return;
    }

    const [participant] = await db
      .select()
      .from(participantsTable)
      .where(eq(participantsTable.id, assignment.participantId));

    const existingFiles = await db
      .select()
      .from(uploadedFilesTable)
      .where(eq(uploadedFilesTable.assignmentId, params.data.assignmentId));
    const version = existingFiles.length + 1;

    const dateFolder = sanitizePathSegment(assignment.date, "No-Date");
    const trackFolder = sanitizePathSegment(assignment.track, "No-Track");
    const sessionFolder = sanitizePathSegment(assignment.sessionName, "No-Session");
    const timeFolder = sanitizePathSegment(assignment.time, "No-Time");
    const roleFolder = sanitizePathSegment(assignment.role, "No-Role");
    const regNum = sanitizePathSegment(participant?.registrationNumber, "REGXXX");

    const relativeDir = path.join(dateFolder, trackFolder, sessionFolder, timeFolder);
    const targetDir = path.join(uploadsDir, relativeDir);
    if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

    // Standard name: Date_Track_Session_Time_Role_RegNo_V1.ext
    const standardFilename = `${dateFolder}_${trackFolder}_${sessionFolder}_${timeFolder}_${roleFolder}_${regNum}_V${version}.${ext}`;
    const newPath = path.join(targetDir, standardFilename);
    fs.renameSync(req.file.path, newPath);

    const dbFilename = `${dateFolder}/${trackFolder}/${sessionFolder}/${timeFolder}/${standardFilename}`;

    const [uploadedFile] = await db
      .insert(uploadedFilesTable)
      .values({
        assignmentId: params.data.assignmentId,
        filename: dbFilename,
        originalName: req.file.originalname,
        fileType: ext,
        version,
        size: req.file.size,
      })
      .returning();

    if (participant && participant.mobile && !participant.mobile.startsWith("__")) {
      sendUploadSuccessWhatsapp(
        participant.mobile,
        participant.name,
        uploadedFile.originalName,
        assignment.role
      ).catch((err) => {
        console.error(`[WHATSAPP] Failed to send upload success notification:`, err);
      });
    }

    res.json({
      id: uploadedFile.id,
      assignmentId: uploadedFile.assignmentId,
      filename: uploadedFile.filename,
      originalName: uploadedFile.originalName,
      fileType: uploadedFile.fileType,
      version: uploadedFile.version,
      size: uploadedFile.size,
      uploadedAt: uploadedFile.uploadedAt.toISOString(),
    });
  }
);
// ─── DELETE /assignments/:assignmentId/file ───────────────────────────────────
// Delete uploaded file for an assignment. Admin only.
router.delete(
  "/assignments/:assignmentId/file",
  requireAuth(["admin", "track_coordinator"]),
  async (req, res): Promise<void> => {
    const assignmentId = Number(req.params.assignmentId);
    if (isNaN(assignmentId)) {
      res.status(400).json({ error: "Invalid assignmentId" });
      return;
    }

    const isAdminOrEditor = req.user?.userType === "admin" || req.user?.userType === "super_admin" || req.user?.permissions?.includes("edit_submissions");
    if (!isAdminOrEditor) {
      res.status(403).json({ error: "Insufficient permissions to delete submission" });
      return;
    }

    try {
      const [assignment] = await db
        .select()
        .from(assignmentsTable)
        .where(eq(assignmentsTable.id, assignmentId));

      if (!assignment) {
        res.status(404).json({ error: "Assignment not found" });
        return;
      }

      const files = await db
        .select()
        .from(uploadedFilesTable)
        .where(eq(uploadedFilesTable.assignmentId, assignmentId));

      if (files.length === 0) {
        res.status(404).json({ error: "No files found for this assignment" });
        return;
      }

      // Delete all files for this assignment from disk and database
      for (const file of files) {
        const filePath = path.join(uploadsDir, file.filename);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }

      await db
        .delete(uploadedFilesTable)
        .where(eq(uploadedFilesTable.assignmentId, assignmentId));

      const [participant] = await db
        .select()
        .from(participantsTable)
        .where(eq(participantsTable.id, assignment.participantId));

      await db.insert(activityLogsTable).values({
        type: "upload",
        message: `File deleted by admin: ${participant?.name ?? "Unknown"} (${participant?.registrationNumber ?? ""}) - Assignment ID: ${assignmentId}`,
      });

      res.json({ success: true, message: "File deleted successfully" });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to delete file" });
    }
  }
);

// ─── GET /assignments/:assignmentId/file ──────────────────────────────────────
router.get(
  "/assignments/:assignmentId/file",
  requireAuth(),
  async (req, res): Promise<void> => {
    const params = GetFileParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const files = await db
      .select()
      .from(uploadedFilesTable)
      .where(eq(uploadedFilesTable.assignmentId, params.data.assignmentId))
      .orderBy(desc(uploadedFilesTable.version));
    const file = files[0];
    if (!file) {
      res.status(404).json({ error: "No file found" });
      return;
    }
    res.json({
      id: file.id,
      assignmentId: file.assignmentId,
      filename: file.filename,
      originalName: file.originalName,
      fileType: file.fileType,
      version: file.version,
      size: file.size,
      uploadedAt: file.uploadedAt.toISOString(),
    });
  }
);

// ─── GET /assignments/:assignmentId/versions ──────────────────────────────────
router.get(
  "/assignments/:assignmentId/versions",
  requireAuth(["admin", "pr_member", "track_coordinator", "coordinator_view_only"]),
  async (req, res): Promise<void> => {
    const assignmentId = Number(req.params.assignmentId);
    if (isNaN(assignmentId)) {
      res.status(400).json({ error: "Invalid assignmentId" });
      return;
    }
    const files = await db
      .select()
      .from(uploadedFilesTable)
      .where(eq(uploadedFilesTable.assignmentId, assignmentId))
      .orderBy(desc(uploadedFilesTable.version));
    res.json(files.map(file => ({
      id: file.id,
      assignmentId: file.assignmentId,
      filename: file.filename,
      originalName: file.originalName,
      fileType: file.fileType,
      version: file.version,
      size: file.size,
      uploadedAt: file.uploadedAt.toISOString(),
    })));
  }
);

// ─── GET /files/:fileId/download ──────────────────────────────────────────────
router.get(
  "/files/:fileId/download",
  requireAuth(),
  async (req, res): Promise<void> => {
    const params = DownloadFileParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const [fileRow] = await db
      .select({
        file: uploadedFilesTable,
        assignment: assignmentsTable,
        participant: participantsTable
      })
      .from(uploadedFilesTable)
      .leftJoin(assignmentsTable, eq(uploadedFilesTable.assignmentId, assignmentsTable.id))
      .leftJoin(participantsTable, eq(assignmentsTable.participantId, participantsTable.id))
      .where(eq(uploadedFilesTable.id, params.data.fileId));

    if (!fileRow || !fileRow.file) {
      res.status(404).json({ error: "File not found" });
      return;
    }
    const { file, assignment, participant } = fileRow;
    const filePath = resolveUploadedFilePath(file.filename);
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: "File not found on disk" });
      return;
    }
    
    const sanitize = (s?: string | null) => (s || "").replace(/[^a-zA-Z0-9 ]/g, "").trim().replace(/\s+/g, "_");
    const dateStr = sanitize(assignment?.date) || "No_Date";
    const trackStr = sanitize(assignment?.track) || "Track";
    const sessionStr = assignment?.sessionName ? `_${sanitize(assignment.sessionName)}` : "";
    const nameStr = participant?.name ? `_${sanitize(participant.name)}` : "";
    const instStr = participant?.institution ? `_${sanitize(participant.institution)}` : "";
    
    const downloadName = `${dateStr}_${trackStr}${sessionStr}${nameStr}${instStr}.${file.fileType}`;

    res.download(filePath, downloadName);
  }
);

// ─── GET /files/:fileId/view ──────────────────────────────────────────────────
router.get(
  "/files/:fileId/view",
  requireAuth(),
  async (req, res): Promise<void> => {
    const fileId = Number(req.params.fileId);
    if (isNaN(fileId)) {
      res.status(400).json({ error: "Invalid fileId" });
      return;
    }
    const [file] = await db
      .select()
      .from(uploadedFilesTable)
      .where(eq(uploadedFilesTable.id, fileId));
    if (!file) {
      res.status(404).json({ error: "File not found" });
      return;
    }
    const filePath = resolveUploadedFilePath(file.filename);
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: "File not found on disk" });
      return;
    }
    
    let contentType = "application/octet-stream";
    const ext = file.fileType.toLowerCase();
    if (ext === "pdf") {
      contentType = "application/pdf";
    } else if (ext === "jpg" || ext === "jpeg") {
      contentType = "image/jpeg";
    } else if (ext === "png") {
      contentType = "image/png";
    } else if (ext === "pptx") {
      contentType = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
    } else if (ext === "ppt") {
      contentType = "application/vnd.ms-powerpoint";
    }

    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", "inline");
    res.sendFile(filePath);
  }
);

// ─── GET /assignments/:assignmentId/file/download ─────────────────────────────
router.get(
  "/assignments/:assignmentId/file/download",
  requireAuth(),
  async (req, res): Promise<void> => {
    const assignmentId = Number(req.params.assignmentId);
    if (isNaN(assignmentId)) {
      res.status(400).json({ error: "Invalid assignmentId" });
      return;
    }
    const files = await db
      .select({
        file: uploadedFilesTable,
        assignment: assignmentsTable,
        participant: participantsTable
      })
      .from(uploadedFilesTable)
      .leftJoin(assignmentsTable, eq(uploadedFilesTable.assignmentId, assignmentsTable.id))
      .leftJoin(participantsTable, eq(assignmentsTable.participantId, participantsTable.id))
      .where(eq(uploadedFilesTable.assignmentId, assignmentId))
      .orderBy(desc(uploadedFilesTable.version));

    const fileRow = files[0];
    if (!fileRow || !fileRow.file) {
      res.status(404).json({ error: "File not found" });
      return;
    }
    const { file, assignment, participant } = fileRow;
    const filePath = resolveUploadedFilePath(file.filename);
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: "File not found on disk" });
      return;
    }
    const sanitize = (s?: string | null) => (s || "").replace(/[^a-zA-Z0-9 ]/g, "").trim().replace(/\s+/g, "_");
    const trackStr = sanitize(assignment?.track) || "Track";
    const sessionStr = assignment?.sessionName ? `_${sanitize(assignment.sessionName)}` : "";
    const nameStr = participant?.name ? `_${sanitize(participant.name)}` : "";
    const instStr = participant?.institution ? `_${sanitize(participant.institution)}` : "";
    
    const downloadName = `${trackStr}${sessionStr}${nameStr}${instStr}.${file.fileType}`;

    res.download(filePath, downloadName);
  }
);

// ─── GET /assignments/:assignmentId/file/view ─────────────────────────────
router.get(
  "/assignments/:assignmentId/file/view",
  requireAuth(),
  async (req, res): Promise<void> => {
    const assignmentId = Number(req.params.assignmentId);
    if (isNaN(assignmentId)) {
      res.status(400).json({ error: "Invalid assignmentId" });
      return;
    }
    const files = await db
      .select()
      .from(uploadedFilesTable)
      .where(eq(uploadedFilesTable.assignmentId, assignmentId))
      .orderBy(desc(uploadedFilesTable.version));
    const file = files[0];
    if (!file) {
      res.status(404).json({ error: "File not found" });
      return;
    }
    const filePath = resolveUploadedFilePath(file.filename);
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: "File not found on disk" });
      return;
    }
    
    let contentType = "application/octet-stream";
    const ext = file.fileType.toLowerCase();
    if (ext === "pdf") {
      contentType = "application/pdf";
    } else if (ext === "jpg" || ext === "jpeg") {
      contentType = "image/jpeg";
    } else if (ext === "png") {
      contentType = "image/png";
    } else if (ext === "pptx") {
      contentType = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
    } else if (ext === "ppt") {
      contentType = "application/vnd.ms-powerpoint";
    }

    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", "inline");
    res.sendFile(filePath);
  }
);

export default router;
