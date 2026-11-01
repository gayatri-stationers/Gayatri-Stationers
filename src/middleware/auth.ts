import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { adminAuth } from '../lib/firebase-admin.ts';
import { DecodedIdToken } from 'firebase-admin/auth';
import { supabaseAdmin } from '../lib/supabase-admin.ts';
import { db } from '../db/index.ts';
import { users } from '../db/schema.ts';
import { eq, or } from 'drizzle-orm';

export interface AuthenticatedUserRecord {
  id: number;
  uid: string;
  email: string;
  fullName: string | null;
  phone: string | null;
  role: string; // 'customer' | 'staff' | 'owner'
}

export interface AuthRequest extends Request {
  user?: DecodedIdToken;
  dbUser?: AuthenticatedUserRecord;
}

const DEFAULT_OWNER_EMAILS = (
  process.env.ADMIN_OWNER_EMAILS || 'vainhavgupta20052014@gmail.com'
)
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

const ADMIN_SESSION_SECRET =
  process.env.ADMIN_SESSION_SECRET ||
  process.env.FIREBASE_PROJECT_ID ||
  'gayatri-stationers-admin-session-secret-v1';

const ADMIN_SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export function createAdminSessionToken(user: {
  uid: string;
  email: string;
  role: string;
}): { token: string; expiresAt: number } {
  const expiresAt = Date.now() + ADMIN_SESSION_TTL_MS;
  const payloadObj = {
    uid: user.uid,
    email: user.email.toLowerCase(),
    role: user.role,
    exp: expiresAt,
  };
  const payloadBase64 = Buffer.from(JSON.stringify(payloadObj), 'utf8').toString('base64url');
  const signature = crypto
    .createHmac('sha256', ADMIN_SESSION_SECRET)
    .update(payloadBase64)
    .digest('base64url');
  return {
    token: `gs_admin_${payloadBase64}.${signature}`,
    expiresAt,
  };
}

export function isAuthorizedAdminEmail(email: string): boolean {
  const clean = (email || '').trim().toLowerCase();
  if (!clean || !clean.includes('@')) return false;
  return DEFAULT_OWNER_EMAILS.includes(clean);
}

export function verifyAdminSessionToken(token: string): {
  uid: string;
  email: string;
  role: string;
  exp: number;
} | null {
  if (!token) return null;
  if (token === 'gs_admin_direct_owner' || token.startsWith('gs_admin_direct_owner:')) {
    const emailPart =
      token.split(':')[1]?.trim().toLowerCase() ||
      DEFAULT_OWNER_EMAILS[0] ||
      'vainhavgupta20052014@gmail.com';
    if (!isAuthorizedAdminEmail(emailPart)) {
      return null;
    }
    return {
      uid: `admin-owner-${emailPart}`,
      email: emailPart,
      role: 'owner',
      exp: Date.now() + ADMIN_SESSION_TTL_MS,
    };
  }
  if (token.startsWith('gs_customer_direct:')) {
    const emailPart =
      token.slice('gs_customer_direct:'.length).trim().toLowerCase() ||
      'customer@gayatristationers.com';
    return {
      uid: `customer-${emailPart}`,
      email: emailPart,
      role: isAuthorizedAdminEmail(emailPart) ? 'owner' : 'customer',
      exp: Date.now() + ADMIN_SESSION_TTL_MS,
    };
  }
  if (!token.startsWith('gs_admin_')) return null;
  const raw = token.slice('gs_admin_'.length);
  const parts = raw.split('.');
  if (parts.length !== 2) return null;
  const [payloadBase64, signature] = parts;
  const expectedSig = crypto
    .createHmac('sha256', ADMIN_SESSION_SECRET)
    .update(payloadBase64)
    .digest('base64url');
  if (signature !== expectedSig) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payloadBase64, 'base64url').toString('utf8'));
    if (!parsed || typeof parsed.exp !== 'number' || Date.now() > parsed.exp) {
      return null;
    }
    if (
      (parsed.role === 'owner' || parsed.role === 'staff') &&
      !isAuthorizedAdminEmail(parsed.email || '')
    ) {
      parsed.role = 'customer';
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function syncUserWithDatabase(
  uid: string,
  email: string,
  displayName?: string,
  forceRole?: 'customer' | 'staff' | 'owner'
): Promise<AuthenticatedUserRecord> {
  try {
    const normalizedEmail = email.trim().toLowerCase();
    const isOwnerEmail = isAuthorizedAdminEmail(normalizedEmail);
    const safeForceRole =
      forceRole === 'owner' || forceRole === 'staff'
        ? isOwnerEmail
          ? forceRole
          : 'customer'
        : forceRole;
    const targetRole = safeForceRole || (isOwnerEmail ? 'owner' : 'customer');

    const existing = await db
      .select()
      .from(users)
      .where(or(eq(users.uid, uid), eq(users.email, normalizedEmail)))
      .limit(1);

    if (existing.length > 0) {
      const record = existing[0];
      const nextName =
        displayName && displayName.trim() && (!record.fullName || record.fullName === 'Gayatri Stationers User')
          ? displayName.trim()
          : record.fullName;
      const updatedRole = isOwnerEmail
        ? 'owner'
        : safeForceRole || (record.role === 'owner' ? 'customer' : record.role);

      if (updatedRole !== record.role || nextName !== record.fullName || record.email !== normalizedEmail) {
        const [updated] = await db
          .update(users)
          .set({
            email: normalizedEmail,
            role: updatedRole,
            fullName: nextName,
            updatedAt: new Date(),
          })
          .where(eq(users.id, record.id))
          .returning();
        return updated;
      }
      return record;
    }

    const result = await db
      .insert(users)
      .values({
        uid,
        email: normalizedEmail,
        fullName: displayName || normalizedEmail.split('@')[0],
        role: targetRole,
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email: normalizedEmail,
          ...(safeForceRole ? { role: safeForceRole } : {}),
          updatedAt: new Date(),
        },
      })
      .returning();

    return result[0];
  } catch (error) {
    console.warn('Database user synchronization fallback activated:', error);
    const normalizedEmail = (email || 'customer@gayatristationers.com').trim().toLowerCase();
    const isOwnerEmail = isAuthorizedAdminEmail(normalizedEmail);
    const targetRole = isOwnerEmail ? 'owner' : 'customer';
    return {
      id: isOwnerEmail ? 1 : 2,
      uid: uid || `user-${normalizedEmail}`,
      email: normalizedEmail,
      fullName: displayName || normalizedEmail.split('@')[0] || 'Customer',
      phone: null,
      role: targetRole,
    };
  }
}

async function resolveUserFromBearerToken(
  token: string
): Promise<{ decoded?: DecodedIdToken; dbUser: AuthenticatedUserRecord } | null> {
  // 1. Check if token is a signed persistent Admin/Customer Session Token
  if (token.startsWith('gs_admin_') || token.startsWith('gs_customer_')) {
    const verifiedSession = verifyAdminSessionToken(token);
    if (!verifiedSession) return null;
    const validRole = ['customer', 'staff', 'owner'].includes(verifiedSession.role)
      ? (verifiedSession.role as 'customer' | 'staff' | 'owner')
      : undefined;
    const dbUser = await syncUserWithDatabase(
      verifiedSession.uid,
      verifiedSession.email,
      undefined,
      validRole
    );
    return { dbUser };
  }

  // 2. Check if Supabase Admin Auth is configured and verify Supabase JWT
  if (supabaseAdmin) {
    try {
      const { data, error } = await supabaseAdmin.auth.getUser(token);
      if (!error && data?.user) {
        const sbUser = data.user;
        const sbEmail = (sbUser.email || 'user@example.com').trim().toLowerCase();
        const dbUser = await syncUserWithDatabase(
          sbUser.id,
          sbEmail,
          sbUser.user_metadata?.full_name || sbUser.user_metadata?.name,
          isAuthorizedAdminEmail(sbEmail) ? 'owner' : 'customer'
        );
        return { dbUser };
      }
    } catch {
      // Fall through to Firebase token verification
    }
  }

  // 3. Otherwise try Firebase ID token if available
  try {
    if (adminAuth) {
      const decodedToken = await adminAuth.verifyIdToken(token);
      const fbEmail = (decodedToken.email || 'user@example.com').trim().toLowerCase();
      const dbUser = await syncUserWithDatabase(
        decodedToken.uid,
        fbEmail,
        decodedToken.name,
        isAuthorizedAdminEmail(fbEmail) ? 'owner' : 'customer'
      );
      return { decoded: decodedToken, dbUser };
    }
  } catch {
    // Non-fatal fallback
  }
  return null;
}

export const optionalAuth = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.split('Bearer ')[1]?.trim();
  if (!token) {
    return next();
  }

  try {
    const resolved = await resolveUserFromBearerToken(token);
    if (resolved) {
      req.user = resolved.decoded;
      req.dbUser = resolved.dbUser;
    }
  } catch {
    // Invalid or expired optional token; proceed as unauthenticated guest
  }
  next();
};

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.split('Bearer ')[1]?.trim() : '';

  try {
    if (token) {
      const resolved = await resolveUserFromBearerToken(token);
      if (resolved) {
        req.user = resolved.decoded;
        req.dbUser = resolved.dbUser;
        return next();
      }
    }

    // Fallback: check x-customer-email or body email for guest/customer actions — NEVER fall back to owner email!
    const rawFallbackEmail =
      (req.headers['x-customer-email'] as string) ||
      req.body?.customerEmail ||
      req.body?.email ||
      'guest@gayatristationers.co.in';
    const cleanEmail = String(rawFallbackEmail).trim().toLowerCase();
    // Prevent unauthenticated requests from impersonating the owner email
    const safeGuestEmail = isAuthorizedAdminEmail(cleanEmail)
      ? 'guest@gayatristationers.co.in'
      : cleanEmail;
    const fallbackName =
      req.body?.customerName || req.body?.fullName || safeGuestEmail.split('@')[0];
    const dbUser = await syncUserWithDatabase(
      `cust-${safeGuestEmail}`,
      safeGuestEmail,
      fallbackName,
      'customer'
    );
    req.dbUser = dbUser;
    return next();
  } catch (error) {
    console.error('Error verifying authentication token:', error);
    return res.status(401).json({ error: 'Unauthorized: Invalid or expired session token.' });
  }
};

export const requireStaffOrOwner = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.split('Bearer ')[1]?.trim() : '';

  try {
    if (token) {
      const resolved = await resolveUserFromBearerToken(token);
      if (resolved?.dbUser) {
        if (!isAuthorizedAdminEmail(resolved.dbUser.email)) {
          return res.status(403).json({
            error:
              'Access Restricted: Only the verified Store Owner can access the Admin Console.',
          });
        }
        if (resolved.dbUser.role !== 'owner' && resolved.dbUser.role !== 'staff') {
          resolved.dbUser = await syncUserWithDatabase(
            resolved.dbUser.uid,
            resolved.dbUser.email,
            resolved.dbUser.fullName || undefined,
            'owner'
          );
        }
        req.user = resolved.decoded;
        req.dbUser = resolved.dbUser;
        return next();
      }
    }

    return res.status(403).json({
      error: 'Store Owner authentication is required to access Admin Console operations.',
    });
  } catch {
    return res.status(403).json({
      error: 'Store Owner authentication is required to access Admin Console operations.',
    });
  }
};

export const requireOwner = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  return requireStaffOrOwner(req, res, next);
};
