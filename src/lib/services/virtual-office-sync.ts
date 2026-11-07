import fs from "fs";
import path from "path";
import {
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

const SYNC_FILE_PATH = path.join(
  process.cwd(),
  "storage",
  "virtual-office-state.json"
);

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

export function readVirtualOfficeSyncState(): VirtualOfficeSyncState {
  try {
    if (fs.existsSync(SYNC_FILE_PATH)) {
      const raw = fs.readFileSync(SYNC_FILE_PATH, "utf8");
      const parsed = JSON.parse(raw) as Partial<VirtualOfficeSyncState>;
      const now = Date.now();
      const bubbles = parsed.activeSpeechBubbles || {};
      // Clean expired speech bubbles
      for (const key of Object.keys(bubbles)) {
        if ((bubbles[key]?.expiresAt || 0) < now) {
          delete bubbles[key];
        }
      }
      return {
        ...getDefaultSyncState(),
        ...parsed,
        activeSpeechBubbles: bubbles,
      };
    }
  } catch {
    // Fallback to default
  }
  return getDefaultSyncState();
}

export function saveVirtualOfficeSyncState(state: VirtualOfficeSyncState): void {
  try {
    const dir = path.dirname(SYNC_FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    state.updatedAt = new Date().toISOString();
    fs.writeFileSync(SYNC_FILE_PATH, JSON.stringify(state, null, 2), "utf8");
  } catch {
    // Non-blocking in read-only environments
  }
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
 * Bulk refill or update flow profile credits and record sync event
 */
export function syncUpdateProfileCredits(params: {
  profileIndex?: number;
  credits: number;
  allProfiles?: boolean;
  source: "telegram" | "virtual-office";
}) {
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
          ? `Seluruh 11 Profil Chrome diisi ulang menjadi ${params.credits}/50 kr. Tim kembali ke meja kerja!`
          : `Seluruh tim dievakuasi untuk istirahat di Lounge Warkop Obim.`,
      bubbleText:
        params.credits > 0
          ? `🔋 Semua 11 profil full ${params.credits} kr! Ayo kembali ke meja!`
          : `☕ Waktunya istirahat ngopi di Lounge!`,
    });
    return listFlowProfileAccounts();
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
          ? `Profil ${params.profileIndex} kehabisan kuota (0/50 kr) & berjalan ke kursi istirahat Lounge.`
          : `Kuota Profil ${params.profileIndex} diupdate menjadi ${params.credits}/50 kr.`,
      bubbleText:
        params.credits === 0
          ? "☕ Kuota 0! Jalan ke Warkop Obim dulu..."
          : `💻 Siap kerja! Kuota: ${params.credits}/50 kr`,
    });
  }

  return listFlowProfileAccounts();
}
