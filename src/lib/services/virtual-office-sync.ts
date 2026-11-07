import fs from "fs";
import os from "os";
import path from "path";
import { DEFAULT_OWNER_ID } from "@/lib/config/env";
import { createServerSupabaseAdminClient } from "@/lib/auth/owner-auth";
import {
  type FlowProfileAccount,
  listFlowProfileAccounts,
  saveFlowProfileAccounts,
  updateSingleFlowProfileCredit,
} from "@/lib/providers/flow-accounts-service";

export interface OfficeActivityEvent {
  id: string;
  timestamp: string;
  source: "telegram" | "virtual-office" | "system";
  actorId: string; // e.g., "pic-video", "pic-script", "pic-qc", "editor-p1", "player-ceo"
  actorName: string;
  summary: string;
  command?: string;
  replyPreview?: string;
  speechBubble?: string;
}

export type VirtualOfficeEvent = OfficeActivityEvent;

export interface VirtualOfficeSyncState {
  updatedAt: string;
  playerPosition: [number, number, number];
  lightingMode: "day" | "sunset" | "night";
  mirrorToTelegram: boolean;
  recentEvents: OfficeActivityEvent[];
  activeSpeechBubbles: Record<
    string,
    {
      text: string;
      expiresAt: number;
    }
  >;
}

declare global {
  // eslint-disable-next-line no-var
  var __OBIM_VIRTUAL_OFFICE_STATE__: VirtualOfficeSyncState | undefined;
}

const SYNC_FILE_PATH = path.join(
  process.cwd(),
  "storage",
  "virtual-office-state.json"
);

const TMP_SYNC_FILE_PATH = path.join(os.tmpdir(), "virtual-office-state.json");

const CLOUD_SYNC_ASSET_ID = "00000000-0000-4000-8000-0000000003d0";

function getDefaultSyncState(): VirtualOfficeSyncState {
  return {
    updatedAt: new Date().toISOString(),
    playerPosition: [0, 0, 0],
    lightingMode: "day",
    mirrorToTelegram: true,
    recentEvents: [
      {
        id: "evt-init",
        timestamp: new Date().toISOString(),
        source: "system",
        actorId: "pic-video",
        actorName: "Mas Radit (PIC Video)",
        summary: "Sistem Kantor Virtual 3D & Bot Telegram tersinkronisasi penuh.",
      },
    ],
    activeSpeechBubbles: {},
  };
}

function cleanExpiredBubbles(state: VirtualOfficeSyncState): VirtualOfficeSyncState {
  const now = Date.now();
  const bubbles = { ...(state.activeSpeechBubbles || {}) };
  for (const key of Object.keys(bubbles)) {
    if ((bubbles[key]?.expiresAt || 0) < now) {
      delete bubbles[key];
    }
  }
  return {
    ...state,
    activeSpeechBubbles: bubbles,
  };
}

export function readVirtualOfficeSyncState(): VirtualOfficeSyncState {
  if (globalThis.__OBIM_VIRTUAL_OFFICE_STATE__) {
    return cleanExpiredBubbles(globalThis.__OBIM_VIRTUAL_OFFICE_STATE__);
  }

  for (const candidatePath of [TMP_SYNC_FILE_PATH, SYNC_FILE_PATH]) {
    try {
      if (fs.existsSync(candidatePath)) {
        const raw = fs.readFileSync(candidatePath, "utf8");
        const parsed = JSON.parse(raw) as Partial<VirtualOfficeSyncState>;
        const merged = cleanExpiredBubbles({
          ...getDefaultSyncState(),
          ...parsed,
          activeSpeechBubbles: parsed.activeSpeechBubbles || {},
        });
        globalThis.__OBIM_VIRTUAL_OFFICE_STATE__ = merged;
        return merged;
      }
    } catch {
      // Continue to next candidate
    }
  }

  return getDefaultSyncState();
}

export function saveVirtualOfficeSyncState(state: VirtualOfficeSyncState): void {
  state.updatedAt = new Date().toISOString();
  globalThis.__OBIM_VIRTUAL_OFFICE_STATE__ = state;

  const payload = JSON.stringify(state, null, 2);

  try {
    fs.writeFileSync(TMP_SYNC_FILE_PATH, payload, "utf8");
  } catch {
    // Non-blocking
  }

  try {
    const dir = path.dirname(SYNC_FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(SYNC_FILE_PATH, payload, "utf8");
  } catch {
    // Non-blocking in read-only serverless environments
  }
}

/**
 * Persist current Flow accounts + Virtual Office sync state to Supabase (when configured)
 * so Vercel serverless invocations (/api/telegram/webhook and /api/virtual-office/sync)
 * share 100% real-time state across instances.
 */
export async function persistVirtualOfficeCloudSync(
  accountsInput?: FlowProfileAccount[],
  stateInput?: VirtualOfficeSyncState
): Promise<void> {
  if (process.env.NODE_ENV === "test") return;
  try {
    const supabase = createServerSupabaseAdminClient();
    if (!supabase) return;

    const accounts = accountsInput ?? listFlowProfileAccounts();
    const syncState = stateInput ?? readVirtualOfficeSyncState();
    const nowIso = new Date().toISOString();

    await supabase.from("assets").upsert(
      {
        id: CLOUD_SYNC_ASSET_ID,
        owner_id: DEFAULT_OWNER_ID,
        content_id: null,
        scene_id: null,
        asset_type: "log",
        storage_path: "virtual-office-cloud-sync.json",
        original_filename: "virtual-office-cloud-sync.json",
        mime_type: "application/json",
        size_bytes: 0,
        checksum: "vo-sync",
        metadata: {
          updatedAt: nowIso,
          accounts,
          syncState,
        },
      },
      { onConflict: "id" }
    );
  } catch {
    // Non-blocking if Supabase is offline
  }
}

/**
 * Load the newest Virtual Office & Flow accounts state from Supabase (when configured)
 */
export async function loadVirtualOfficeCloudSync(): Promise<{
  accounts: FlowProfileAccount[];
  syncState: VirtualOfficeSyncState;
}> {
  const localAccounts = listFlowProfileAccounts();
  const localState = readVirtualOfficeSyncState();

  if (process.env.NODE_ENV === "test") {
    return { accounts: localAccounts, syncState: localState };
  }

  try {
    const supabase = createServerSupabaseAdminClient();
    if (!supabase) {
      return { accounts: localAccounts, syncState: localState };
    }

    const { data, error } = await supabase
      .from("assets")
      .select("metadata")
      .eq("id", CLOUD_SYNC_ASSET_ID)
      .maybeSingle();

    if (!error && data && data.metadata && typeof data.metadata === "object") {
      const meta = data.metadata as {
        updatedAt?: string;
        accounts?: FlowProfileAccount[];
        syncState?: VirtualOfficeSyncState;
      };

      const cloudTime = meta.updatedAt ? Date.parse(meta.updatedAt) : 0;
      const localTime = localState.updatedAt ? Date.parse(localState.updatedAt) : 0;

      if (cloudTime >= localTime || !globalThis.__OBIM_VIRTUAL_OFFICE_STATE__) {
        if (Array.isArray(meta.accounts) && meta.accounts.length > 0) {
          saveFlowProfileAccounts(meta.accounts);
        }
        if (meta.syncState) {
          const cleaned = cleanExpiredBubbles(meta.syncState);
          saveVirtualOfficeSyncState(cleaned);
        }
      }
    }
  } catch {
    // Ignore cloud fetch error and use local/tmpdir state
  }

  return {
    accounts: listFlowProfileAccounts(),
    syncState: readVirtualOfficeSyncState(),
  };
}

export function recordVirtualOfficeEvent(params: {
  source: "telegram" | "virtual-office" | "system";
  actorId: string;
  actorName: string;
  summary: string;
  command?: string;
  replyPreview?: string;
  bubbleText?: string;
  bubbleDurationMs?: number;
}): OfficeActivityEvent {
  const state = readVirtualOfficeSyncState();
  const evt: OfficeActivityEvent = {
    id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
    source: params.source,
    actorId: params.actorId,
    actorName: params.actorName,
    summary: params.summary,
    command: params.command,
    replyPreview: params.replyPreview,
    speechBubble: params.bubbleText,
  };

  state.recentEvents = [evt, ...state.recentEvents].slice(0, 25);

  if (params.bubbleText) {
    state.activeSpeechBubbles[params.actorId] = {
      text: params.bubbleText,
      expiresAt: Date.now() + (params.bubbleDurationMs || 14000),
    };
  }

  saveVirtualOfficeSyncState(state);
  return evt;
}

/**
 * Bulk refill, bulk rest, or single update of flow profile credits and record sync event
 */
export function syncUpdateProfileCredits(params: {
  profileIndex?: number;
  credits: number;
  allProfiles?: boolean;
  source: "telegram" | "virtual-office";
}): FlowProfileAccount[] {
  if (params.allProfiles) {
    const accounts = listFlowProfileAccounts().map((acc) => ({
      ...acc,
      credits: params.credits,
      lastChecked: new Date().toISOString(),
      notes: `Sync ${params.source} @ ${new Date().toLocaleTimeString("id-ID")}`,
    }));
    saveFlowProfileAccounts(accounts);
    recordVirtualOfficeEvent({
      source: params.source,
      actorId: "pic-video",
      actorName: "Mas Radit (PIC Video)",
      summary:
        params.credits > 0
          ? `Seluruh 11 Editor Video kembali ke PC masing-masing & siap kerja (${params.credits}/50 kr)!`
          : `Seluruh 11 Editor Video meninggalkan PC dan berpindah duduk di kursi istirahat Lounge Warkop Obim.`,
      bubbleText:
        params.credits > 0
          ? `💻 Semua 11 editor standby kembali ke PC masing-masing!`
          : `☕ Semua 11 editor pindah duduk ke kursi istirahat Lounge!`,
    });
    const updated = listFlowProfileAccounts();
    void persistVirtualOfficeCloudSync(updated, readVirtualOfficeSyncState());
    return updated;
  }

  if (typeof params.profileIndex === "number") {
    updateSingleFlowProfileCredit(
      params.profileIndex,
      params.credits,
      `Sync ${params.source}`
    );
    const actorId = `editor-p${params.profileIndex}`;
    recordVirtualOfficeEvent({
      source: params.source,
      actorId,
      actorName: `Profil ${params.profileIndex}`,
      summary:
        params.credits === 0
          ? `Profil ${params.profileIndex} beranjak dari PC & berjalan ke kursi istirahat Lounge.`
          : `Profil ${params.profileIndex} kembali standby di PC meja kerja (${params.credits}/50 kr).`,
      bubbleText:
        params.credits === 0
          ? "☕ Izin istirahat ke kursi Lounge dulu..."
          : `💻 Siap standby di PC! (${params.credits}/50 kr)`,
    });
  }

  const updated = listFlowProfileAccounts();
  void persistVirtualOfficeCloudSync(updated, readVirtualOfficeSyncState());
  return updated;
}

/**
 * Async version of syncUpdateProfileCredits that awaits cloud persistence (for serverless webhooks)
 */
export async function syncUpdateProfileCreditsAsync(params: {
  profileIndex?: number;
  credits: number;
  allProfiles?: boolean;
  source: "telegram" | "virtual-office";
}): Promise<FlowProfileAccount[]> {
  const updated = syncUpdateProfileCredits(params);
  await persistVirtualOfficeCloudSync(updated, readVirtualOfficeSyncState());
  return updated;
}
