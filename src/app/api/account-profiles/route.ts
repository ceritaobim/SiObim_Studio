import { NextResponse } from "next/server";
import { getAuthorizedOwner } from "@/lib/auth/owner-auth";
import {
  deleteProviderProfile,
  fetchElevenLabsQuotaForProfile,
  readProviderProfilesVault,
  setActiveProviderProfile,
  toMaskedProfile,
  upsertProviderProfile,
  type ElevenLabsModelId,
} from "@/lib/providers/account-profiles";

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

  const url = new URL(request.url);
  const includeQuota = url.searchParams.get("quota") !== "0";
  const checkGeminiLive = url.searchParams.get("live") === "1";
  const singleProfileId = url.searchParams.get("profileId");

  const vault = readProviderProfilesVault();
  const maskedProfiles = vault.profiles.map(toMaskedProfile);

  const quotas = includeQuota
    ? await Promise.all(
        vault.profiles.map((p) => {
          const shouldLiveCheckThis =
            checkGeminiLive && (!singleProfileId || singleProfileId === p.id);
          return fetchElevenLabsQuotaForProfile(p, {
            checkGeminiLive: shouldLiveCheckThis,
          });
        })
      )
    : [];

  return NextResponse.json({
    activeProfileId: vault.activeProfileId,
    profiles: maskedProfiles,
    quotas,
  });
}

export async function POST(request: Request) {
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
    const body = await request.json();
    const action = String(body.action ?? "upsert").trim();

    if (action === "set_active") {
      const profileId = String(body.profileId ?? "").trim();
      const updated = setActiveProviderProfile(profileId);
      const quotas = await Promise.all(
        updated.profiles.map((p) => fetchElevenLabsQuotaForProfile(p))
      );
      return NextResponse.json({
        activeProfileId: updated.activeProfileId,
        profiles: updated.profiles.map(toMaskedProfile),
        quotas,
      });
    }

    if (action === "delete") {
      const profileId = String(body.profileId ?? "").trim();
      const updated = deleteProviderProfile(profileId);
      const quotas = await Promise.all(
        updated.profiles.map((p) => fetchElevenLabsQuotaForProfile(p))
      );
      return NextResponse.json({
        activeProfileId: updated.activeProfileId,
        profiles: updated.profiles.map(toMaskedProfile),
        quotas,
      });
    }

    // Default: upsert (create or update a Google Account API profile)
    const modelIdRaw = String(body.elevenlabsModelId ?? "eleven_flash_v2_5");
    const elevenlabsModelId: ElevenLabsModelId =
      modelIdRaw === "eleven_multilingual_v2" ||
      modelIdRaw === "eleven_turbo_v2_5"
        ? modelIdRaw
        : "eleven_flash_v2_5";

    const updated = upsertProviderProfile({
      id: body.id ? String(body.id) : undefined,
      label: String(body.label ?? ""),
      googleEmail: body.googleEmail !== undefined ? String(body.googleEmail) : undefined,
      geminiApiKey:
        body.geminiApiKey !== undefined ? String(body.geminiApiKey) : undefined,
      elevenlabsApiKey:
        body.elevenlabsApiKey !== undefined
          ? String(body.elevenlabsApiKey)
          : undefined,
      elevenlabsVoiceId:
        body.elevenlabsVoiceId !== undefined
          ? String(body.elevenlabsVoiceId)
          : undefined,
      elevenlabsModelId,
      gflowApiKey:
        body.gflowApiKey !== undefined ? String(body.gflowApiKey) : undefined,
      localUsedCredits:
        typeof body.localUsedCredits === "number"
          ? body.localUsedCredits
          : undefined,
      localCreditLimit:
        typeof body.localCreditLimit === "number"
          ? body.localCreditLimit
          : undefined,
      notes: body.notes !== undefined ? String(body.notes) : undefined,
      setAsActive: Boolean(body.setAsActive ?? true),
    });

    const quotas = await Promise.all(
      updated.profiles.map((p) => fetchElevenLabsQuotaForProfile(p))
    );

    return NextResponse.json({
      activeProfileId: updated.activeProfileId,
      profiles: updated.profiles.map(toMaskedProfile),
      quotas,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Gagal menyimpan profil akun API.",
      },
      { status: 400 }
    );
  }
}
