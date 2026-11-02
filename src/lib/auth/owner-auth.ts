import { cookies } from "next/headers";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_OWNER_ID } from "@/lib/config/env";

export const OWNER_SESSION_COOKIE = "co_studio_owner_session";

export interface AuthOwnerContext {
  ownerId: string;
  email?: string;
  displayName: string;
  authMode: "supabase_jwt" | "owner_passcode" | "local_single_owner";
  authorized: boolean;
}

export function createServerSupabaseAdminClient(): SupabaseClient | null {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const rawKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!rawUrl || !rawKey) {
    return null;
  }

  const cleanUrl = rawUrl.trim().replace(/^["']|["']$/g, "");
  const cleanKey = rawKey.trim().replace(/^["']|["']$/g, "");

  return createClient(cleanUrl, cleanKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

/**
 * Resolves and authorizes the current request's owner identity on the server.
 * Supports:
 * 1. Explicit ownerId override in unit tests.
 * 2. STUDIO_OWNER_PASSCODE check via cookie or x-owner-passcode header when configured.
 * 3. Default single-owner mode (`DEFAULT_OWNER_ID`) for MVP.
 */
export async function getAuthorizedOwner(options?: {
  requestHeaders?: Headers;
  overrideOwnerId?: string;
}): Promise<AuthOwnerContext> {
  if (options?.overrideOwnerId) {
    return {
      ownerId: options.overrideOwnerId,
      displayName: "Owner cerita_obim",
      authMode: "local_single_owner",
      authorized: true,
    };
  }

  const requiredPasscode = process.env.STUDIO_OWNER_PASSCODE?.trim();
  if (requiredPasscode) {
    const headerPasscode = options?.requestHeaders
      ?.get("x-owner-passcode")
      ?.trim();
    let cookiePasscode: string | undefined;
    try {
      const cookieStore = await cookies();
      cookiePasscode = cookieStore.get(OWNER_SESSION_COOKIE)?.value;
    } catch {
      // cookies() may be called outside request context in tests
    }

    const authorized =
      headerPasscode === requiredPasscode ||
      cookiePasscode === requiredPasscode;

    return {
      ownerId: DEFAULT_OWNER_ID,
      displayName: "Creator cerita_obim",
      authMode: "owner_passcode",
      authorized,
    };
  }

  return {
    ownerId: DEFAULT_OWNER_ID,
    displayName: "Creator cerita_obim",
    authMode: "local_single_owner",
    authorized: true,
  };
}

function sanitizeCredential(val: string | undefined | null): string {
  if (!val) return "";
  let s = String(val).trim();
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    s = s.slice(1, -1).trim();
  }
  return s;
}

export const STUDIO_DEFAULT_USERNAME =
  process.env.STUDIO_OWNER_USERNAME || "obim_creator_studio";

export const STUDIO_DEFAULT_PASSWORD =
  process.env.STUDIO_OWNER_PASSWORD || "Obim#Studio9x16!Origami2026$Xq9";

export const STUDIO_SESSION_TOKEN = "co_verified_owner_365d_token_v1";

export function verifyStudioLoginCredentials(
  username: string,
  password: string
): boolean {
  const cleanUser = sanitizeCredential(username).toLowerCase();
  const cleanPass = sanitizeCredential(password);

  const envUser = sanitizeCredential(process.env.STUDIO_OWNER_USERNAME).toLowerCase();
  const envPass = sanitizeCredential(process.env.STUDIO_OWNER_PASSWORD);

  // Match custom env credentials if provided
  if (envUser && envPass && cleanUser === envUser && cleanPass === envPass) {
    return true;
  }

  // Accepted studio usernames (case-insensitive for mobile keyboards)
  const validUsernames = ["obim_creator_studio", "ceritaobim", "admin", "obim"];
  if (!validUsernames.includes(cleanUser) && cleanUser !== envUser) {
    return false;
  }

  // Accepted studio passwords (supports original strong pass and mobile-friendly PIN)
  const validPasswords = [
    "Obim#Studio9x16!Origami2026$Xq9",
    "obim2026",
    "Obim2026",
    "Obim2026!",
    envPass,
  ].filter(Boolean);

  return validPasswords.includes(cleanPass);
}

/**
 * Enforces owner-level row scoping: verifies that a target record belongs to the authenticated owner.
 */
export function assertOwnerAccess(
  recordOwnerId: string,
  authenticatedOwnerId: string
): void {
  if (
    !recordOwnerId ||
    !authenticatedOwnerId ||
    recordOwnerId !== authenticatedOwnerId
  ) {
    throw new Error(
      "FORBIDDEN_OWNER_MISMATCH: Akses ditolak untuk data milik pengguna lain."
    );
  }
}

export async function resolveAuthenticatedOwner(
  request?: Request
): Promise<AuthOwnerContext> {
  const ctx = await getAuthorizedOwner({
    requestHeaders: request?.headers,
  });
  if (!ctx.authorized) {
    throw new Error("UNAUTHORIZED: Passcode pemilik studio tidak valid.");
  }
  return ctx;
}


