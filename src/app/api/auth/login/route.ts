import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const username = String(body.username || "").trim();
    const password = String(body.password || "").trim();

    // Kredensial resmi: username siobim, password siobim1
    const validUsername = process.env.STUDIO_HOSTED_USERNAME || "siobim";
    const validPassword = process.env.STUDIO_HOSTED_PASSWORD || "siobim1";

    if (username === validUsername && password === validPassword) {
      const response = NextResponse.json({
        ok: true,
        message: "Login berhasil.",
      });

      // Set cookie sesi hosting berlaku 30 hari
      response.cookies.set("co_studio_hosted_session", "authenticated_siobim", {
        path: "/",
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 30, // 30 hari
      });

      return response;
    }

    return NextResponse.json(
      { ok: false, error: "Username atau password salah." },
      { status: 401 }
    );
  } catch {
    return NextResponse.json(
      { ok: false, error: "Terjadi kesalahan server saat login." },
      { status: 500 }
    );
  }
}
