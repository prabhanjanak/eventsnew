import { Router } from "express";
import { eq, or } from "drizzle-orm";
import { db, systemUsersTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { hashPassword, comparePassword, checkEmailOrMobileRegistered } from "../lib/auth";
import {
  CreateSystemUserBody,
  UpdateSystemUserParams,
  UpdateSystemUserBody,
  DeleteSystemUserParams,
} from "@workspace/api-zod";
import QRCode from "qrcode";
import { ZipArchive } from "archiver";
import { getClientBaseUrl } from "../lib/ip-helper";

const router = Router();

function buildUser(u: typeof systemUsersTable.$inferSelect) {
  const effectivePermissions = (u.userType === "admin" || u.userType === "super_admin")
    ? ["attendance", "goodies", "food"]
    : (u.permissions ?? []);
  return {
    id: u.id,
    empId: u.empId,
    name: u.name,
    email: u.email,
    mobile: u.mobile,
    userType: u.userType,
    assignedTrack: u.assignedTrack,
    assignedEventIds: (u.assignedEventIds as number[]) || [],
    mustChangePassword: u.mustChangePassword,
    permissions: effectivePermissions,
    createdAt: u.createdAt.toISOString(),
  };
}

// GET /system-users
router.get("/system-users", requireAuth(["admin"]), async (_req, res): Promise<void> => {
  const users = await db.select().from(systemUsersTable).orderBy(systemUsersTable.createdAt);
  res.json(users.map(buildUser));
});

// POST /system-users
router.post("/system-users", requireAuth(["admin"]), async (req, res): Promise<void> => {
  const parsed = CreateSystemUserBody.safeParse(req.body);
  if (!parsed.success) {
    const errorMsg = parsed.error.issues.map((i) => `${i.path.join(".") || "field"}: ${i.message}`).join(", ");
    res.status(400).json({ error: errorMsg });
    return;
  }

  // Only super_admin can create a super_admin account
  if (parsed.data.userType === "super_admin" && req.user?.userType !== "super_admin") {
    res.status(403).json({ error: "Only the super admin can create a super admin account" });
    return;
  }

  // Check EMP ID uniqueness
  const [existing] = await db
    .select({ id: systemUsersTable.id })
    .from(systemUsersTable)
    .where(eq(systemUsersTable.empId, parsed.data.empId));
  if (existing) {
    res.status(400).json({ error: "EMP ID already exists" });
    return;
  }

  if (parsed.data.email || parsed.data.mobile) {
    const checkDuplicate = await checkEmailOrMobileRegistered({
      email: parsed.data.email || undefined,
      mobile: parsed.data.mobile || undefined,
    });
    if (checkDuplicate) {
      res.status(400).json({ error: checkDuplicate.reason });
      return;
    }
  }

  const rawPassword = parsed.data.password || "Welcome@123";
  const passwordHash = await hashPassword(rawPassword);
  const reqPermissions = (req.body as { permissions?: string[] }).permissions ?? 
    ((parsed.data.userType === "admin" || parsed.data.userType === "super_admin") ? ["attendance", "goodies", "food"] : []);
  const assignedEventIds = (req.body as { assignedEventIds?: number[] }).assignedEventIds ?? [];
  const [user] = await db
    .insert(systemUsersTable)
    .values({
      empId: parsed.data.empId,
      name: parsed.data.name,
      email: parsed.data.email ?? null,
      mobile: parsed.data.mobile ?? null,
      userType: parsed.data.userType,
      passwordHash,
      assignedTrack: parsed.data.assignedTrack ?? null,
      assignedEventIds,
      mustChangePassword: true,
      permissions: reqPermissions,
    })
    .returning();
  res.status(201).json(buildUser(user));
});

// PATCH /system-users/:id
router.patch("/system-users/:id", requireAuth(["admin"]), async (req, res): Promise<void> => {
  const params = UpdateSystemUserParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateSystemUserBody.safeParse(req.body);
  if (!parsed.success) {
    const errorMsg = parsed.error.issues.map((i) => `${i.path.join(".") || "field"}: ${i.message}`).join(", ");
    res.status(400).json({ error: errorMsg });
    return;
  }

  const [targetUser] = await db
    .select()
    .from(systemUsersTable)
    .where(eq(systemUsersTable.id, params.data.id))
    .limit(1);

  if (!targetUser) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  // Only super_admin can modify a super_admin account
  if (targetUser.userType === "super_admin" && req.user?.userType !== "super_admin") {
    res.status(403).json({ error: "Only the super admin can modify a super admin account" });
    return;
  }

  // Only super_admin can promote/demote to/from super_admin
  if ((parsed.data.userType === "super_admin" || (parsed.data.userType !== undefined && targetUser.userType === "super_admin")) && req.user?.userType !== "super_admin") {
    res.status(403).json({ error: "Only the super admin can assign or revoke the super admin role" });
    return;
  }

  if (parsed.data.email || parsed.data.mobile) {
    const checkDuplicate = await checkEmailOrMobileRegistered({
      email: parsed.data.email,
      mobile: parsed.data.mobile,
      excludeSystemUserId: params.data.id,
    });
    if (checkDuplicate) {
      res.status(400).json({ error: checkDuplicate.reason });
      return;
    }
  }

  const updateData: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
  if (parsed.data.email !== undefined) updateData.email = parsed.data.email || null;
  if (parsed.data.mobile !== undefined) updateData.mobile = parsed.data.mobile || null;
  if (parsed.data.userType !== undefined) updateData.userType = parsed.data.userType;
  if (parsed.data.assignedTrack !== undefined) updateData.assignedTrack = parsed.data.assignedTrack || null;
  if ((req.body as any).assignedEventIds !== undefined) updateData.assignedEventIds = (req.body as any).assignedEventIds;
  if ((req.body as { permissions?: string[] }).permissions !== undefined) {
    updateData.permissions = (req.body as { permissions?: string[] }).permissions;
  }
  if (parsed.data.password) {
    updateData.passwordHash = await hashPassword(parsed.data.password);
    updateData.mustChangePassword = true;
  }

  const [updated] = await db
    .update(systemUsersTable)
    .set(updateData)
    .where(eq(systemUsersTable.id, params.data.id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json(buildUser(updated));
});

// DELETE /system-users/:id
router.delete("/system-users/:id", requireAuth(["admin"]), async (req, res): Promise<void> => {
  const params = DeleteSystemUserParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [targetUser] = await db
    .select()
    .from(systemUsersTable)
    .where(eq(systemUsersTable.id, params.data.id))
    .limit(1);

  if (!targetUser) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  // Only super_admin can delete a super_admin account
  if (targetUser.userType === "super_admin" && req.user?.userType !== "super_admin") {
    res.status(403).json({ error: "Only the super admin can delete a super admin account" });
    return;
  }
  const [deleted] = await db
    .delete(systemUsersTable)
    .where(eq(systemUsersTable.id, params.data.id))
    .returning();
  if (!deleted) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.sendStatus(204);
});

// POST /system-users/:id/reset-password  — admin resets to Welcome@123 + force change
router.post("/system-users/:id/reset-password", requireAuth(["admin"]), async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const passwordHash = await hashPassword("Welcome@123");
  const [user] = await db
    .update(systemUsersTable)
    .set({ passwordHash, mustChangePassword: true })
    .where(eq(systemUsersTable.id, id))
    .returning();
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  res.json({ message: "Password reset to Welcome@123, user must change on next login" });
});

// POST /auth/staff/change-password  — staff member changes their own password after force reset
router.post("/auth/staff/change-password", requireAuth(), async (req, res): Promise<void> => {
  const user = req.user!;
  const { currentPassword, newPassword } = req.body as { currentPassword?: string; newPassword?: string };
  if (!currentPassword || !newPassword || newPassword.length < 6) {
    res.status(400).json({ error: "currentPassword and newPassword (min 6 chars) are required" });
    return;
  }

  const [sysUser] = await db.select().from(systemUsersTable).where(eq(systemUsersTable.id, user.id));
  if (!sysUser) { res.status(404).json({ error: "User not found" }); return; }

  const valid = await comparePassword(currentPassword, sysUser.passwordHash);
  if (!valid) { res.status(401).json({ error: "Current password is incorrect" }); return; }

  const passwordHash = await hashPassword(newPassword);
  await db.update(systemUsersTable).set({ passwordHash, mustChangePassword: false }).where(eq(systemUsersTable.id, user.id));
  res.json({ message: "Password changed successfully" });
});

// GET /system-users/qr-batch
router.get("/system-users/qr-batch", requireAuth(["admin"]), async (req, res): Promise<void> => {
  try {
    const allUsers = await db.select().from(systemUsersTable).orderBy(systemUsersTable.createdAt);
    
    const archive = new ZipArchive({ zlib: { level: 9 } });
    res.setHeader("Content-Disposition", `attachment; filename="vision2020_staff_qr_codes_${Date.now()}.zip"`);
    res.setHeader("Content-Type", "application/zip");
    archive.pipe(res);
    
    archive.on("error", (err: any) => {
      console.error("ZIP Archive Error:", err);
    });

    const baseUrl = getClientBaseUrl(req);

    for (const user of allUsers) {
      const cleanName = user.name
        .trim()
        .replace(/[^a-zA-Z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");
      const cleanEmpId = user.empId
        .trim()
        .replace(/[^a-zA-Z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");
      const cleanRole = user.userType
        .trim()
        .replace(/[^a-zA-Z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");

      const qrUrl = `${baseUrl}/q/STAFF-${user.empId}`;
      const qrBuffer = await QRCode.toBuffer(qrUrl, { width: 300, margin: 2 });
      
      archive.append(qrBuffer, { name: `${cleanName}_${cleanEmpId}_${cleanRole}.png` });
    }

    await archive.finalize();
  } catch (err: any) {
    if (!res.headersSent) {
      res.status(500).json({ error: err.message || "Failed to batch export QR codes" });
    }
  }
});

// GET /system-users/:id/qr
router.get("/system-users/:id/qr", requireAuth(["admin"]), async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [sysUser] = await db.select().from(systemUsersTable).where(eq(systemUsersTable.id, id));
  if (!sysUser) { res.status(404).json({ error: "User not found" }); return; }

  const baseUrl = getClientBaseUrl(req);
  const qrUrl = `${baseUrl}/q/STAFF-${sysUser.empId}`;
  const qrDataUrl = await QRCode.toDataURL(qrUrl, { width: 300, margin: 2 });

  const firstName = sysUser.name.split(" ")[0];
  res.json({
    qr1: {
      type: "staff_registration",
      dataUrl: qrDataUrl,
      label: "Staff QR",
      downloadName: `${firstName}_StaffQR.png`,
    }
  });
});

export default router;
