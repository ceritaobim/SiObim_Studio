import { NextResponse } from "next/server";
import {
  OWNER_SESSION_COOKIE,
  STUDIO_SESSION_TOKEN,
  verifyStudioLoginCredentials,
} from "@/lib/auth/owner-auth";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      action?: "login" | "logout";
      username?: string;
      password?: string;
    };

    if (body.action === "logout") {
      const res = NextResponse.json({ ok: true });
      res.cookies.delete(OWNER_SESSION_COOKIE);
      return res;
    }

    const username = String(body.username ?? "");
    const password = String(body.password ?? "");

    if (!verifyStudioLoginCredentials(username, password)) {
      return NextResponse.json(
        { error: "Username atau password salah. Silakan cek kembali." },
        { status: 401 }
      );
    }

    const res = NextResponse.json({
      ok: true,
      username: username.trim(),
    });

    // Persist session cookie for 365 days (1 year) so mobile browsers stay logged in
    res.cookies.set(OWNER_SESSION_COOKIE, STUDIO_SESSION_TOKEN, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });

    return res;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Gagal memproses login.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
