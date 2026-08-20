import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { eq, and, ne } from "drizzle-orm";
import { db, participantsTable, systemUsersTable } from "@workspace/db";

const SECRET = process.env.SESSION_SECRET || "vision2020_secret_key";

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signToken(payload: object): string {
  return jwt.sign(payload, SECRET, { expiresIn: "30m" });
}

export function signLongLivedToken(payload: object): string {
  return jwt.sign(payload, SECRET, { expiresIn: "10d" });
}

export function verifyToken(token: string): Record<string, unknown> | null {
  try {
    return jwt.verify(token, SECRET) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function checkEmailOrMobileRegistered(options: {
  email?: string | null;
  mobile?: string | null;
  eventId?: number | null;
  excludeParticipantId?: number;
  excludeSystemUserId?: number;
}): Promise<{ isDuplicate: boolean; reason: string } | null> {
  const { email, mobile, eventId, excludeParticipantId, excludeSystemUserId } = options;

  const emailClean = email?.trim().toLowerCase();
  const mobileClean = mobile?.trim().replace(/[^0-9]/g, "");

  if (!emailClean && !mobileClean) {
    return null;
  }

  // 1. Check participants table: Strict mobile uniqueness per event (Email can be shared for family/group registrations)
  if (mobileClean) {
    const condParticipant = [eq(participantsTable.mobile, mobileClean)];
    if (eventId) {
      condParticipant.push(eq(participantsTable.eventId, eventId));
    }
    if (excludeParticipantId !== undefined) {
      condParticipant.push(ne(participantsTable.id, excludeParticipantId));
    }
    const [existingParticipant] = await db
      .select({ name: participantsTable.name, registrationNumber: participantsTable.registrationNumber })
      .from(participantsTable)
      .where(and(...condParticipant))
      .limit(1);

    if (existingParticipant) {
      return {
        isDuplicate: true,
        reason: `Mobile number '+91 ${mobileClean}' is already registered for this event under '${existingParticipant.name}' (${existingParticipant.registrationNumber}). Each attendee must use a unique mobile number.`
      };
    }
  }

  // 2. Check system_users table
  if (emailClean) {
    const condUser = [eq(systemUsersTable.email, emailClean)];
    if (excludeSystemUserId !== undefined) {
      condUser.push(ne(systemUsersTable.id, excludeSystemUserId));
    }
    const [existingUser] = await db
      .select({ name: systemUsersTable.name })
      .from(systemUsersTable)
      .where(and(...condUser))
      .limit(1);

    if (existingUser) {
      return {
        isDuplicate: true,
        reason: `Email address '${emailClean}' is already in use by staff member '${existingUser.name}'.`
      };
    }
  }

  if (mobileClean) {
    const condUser = [eq(systemUsersTable.mobile, mobileClean)];
    if (excludeSystemUserId !== undefined) {
      condUser.push(ne(systemUsersTable.id, excludeSystemUserId));
    }
    const [existingUser] = await db
      .select({ name: systemUsersTable.name })
      .from(systemUsersTable)
      .where(and(...condUser))
      .limit(1);

    if (existingUser) {
      return {
        isDuplicate: true,
        reason: `Mobile number '${mobileClean}' is already in use by staff member '${existingUser.name}'.`
      };
    }
  }

  return null;
}

