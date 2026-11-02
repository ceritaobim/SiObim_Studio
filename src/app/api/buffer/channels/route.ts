import { NextResponse } from "next/server";
import { getAuthorizedOwner } from "@/lib/auth/owner-auth";
import {
  fetchBufferAccountAndOrg,
  getBufferConnectedChannels,
} from "@/lib/integrations/buffer-client";

export async function GET(request: Request) {
  const owner = await getAuthorizedOwner({
    requestHeaders: request.headers,
  });

  if (!owner.authorized) {
    return NextResponse.json(
      { error: "UNAUTHORIZED: Akses memerlukan otorisasi owner." },
      { status: 401 }
    );
  }

  try {
    const [account, channels] = await Promise.all([
      fetchBufferAccountAndOrg(),
      getBufferConnectedChannels(),
    ]);

    return NextResponse.json({
      ok: true,
      account,
      channels,
      totalChannels: channels.length,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Gagal mengambil data akun Buffer.";
    return NextResponse.json(
      {
        ok: false,
        error: message,
        channels: [],
      },
      { status: 500 }
    );
  }
}
