import { NextResponse } from "next/server";

export async function POST() {
  const response = NextResponse.json({ ok: true, message: "Berhasil logout." });
  response.cookies.delete("co_studio_hosted_session");
  return response;
}
