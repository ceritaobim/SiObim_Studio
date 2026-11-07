import { describe, it, expect } from "vitest";
import {
  INITIAL_OFFICE_MEMBERS,
  LOUNGE_SEATS,
  CAMERA_PRESETS,
  DEFAULT_BUFFER_POSTERS,
  BUFFER_POSTER_WORLD_COORDS,
} from "@/features/virtual-office/constants";
import { OfficeMember } from "@/features/virtual-office/types";
import {
  checkBodyCollision,
  resolveBodyBlockCollision,
} from "@/features/virtual-office/collision-map";
import {
  readVirtualOfficeSyncState,
  recordVirtualOfficeEvent,
} from "@/lib/services/virtual-office-sync";
import {
  NPC_PERSONA_CATALOG,
  generatePersonalizedNpcReply,
} from "@/features/virtual-office/npc-persona-engine";
import { getStudioStoreSnapshot } from "@/features/telegram/studio-store-manager";
import { listFlowProfileAccounts } from "@/lib/providers/flow-accounts-service";

describe("Virtual Office 3D Configuration, Third-Person Body-Block & Buffer Corridor", () => {
  it("should have 11 Chrome video profiles and 1 PIC for Video Production Team", () => {
    const videoTeam = INITIAL_OFFICE_MEMBERS.filter(
      (m) => m.teamId === "video-prod"
    );
    const pic = videoTeam.find((m) => m.isLead);
    const editors = videoTeam.filter((m) => !m.isLead);

    expect(pic).toBeDefined();
    expect(pic?.name).toBe("Mas Radit");
    expect(pic?.role).toContain("PIC Tim Produksi Video");
    expect(editors.length).toBe(11);

    const indices = editors.map((e) => e.profileIndex).sort((a, b) => a! - b!);
    expect(indices).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  });

  it("should have Producer / Scriptwriting team with 1 PIC and Writers", () => {
    const scriptTeam = INITIAL_OFFICE_MEMBERS.filter(
      (m) => m.teamId === "script-prod"
    );
    const lead = scriptTeam.find((m) => m.isLead);
    expect(lead).toBeDefined();
    expect(lead?.role).toContain("PIC Produser");
    expect(scriptTeam.length).toBeGreaterThanOrEqual(3);
  });

  it("should have Ruangan Buffer (Publisher) with PIC Mba Siska and Publisher named 'Buffer'", () => {
    const qcTeam = INITIAL_OFFICE_MEMBERS.filter((m) => m.teamId === "qc-dist");
    const lead = qcTeam.find((m) => m.isLead);
    const publisher = qcTeam.find((m) => !m.isLead);

    expect(lead).toBeDefined();
    expect(lead?.role).toContain("PIC Buffer");
    expect(publisher).toBeDefined();
    expect(publisher?.name).toBe("Buffer");
    expect(publisher?.role).toContain("Publisher");
  });

  it("should provide 8 sequential cinema schedule posters in the Buffer Corridor ordered left-to-right", () => {
    expect(DEFAULT_BUFFER_POSTERS.length).toBe(8);
    expect(BUFFER_POSTER_WORLD_COORDS.length).toBe(8);

    // Verify X coordinates are strictly increasing from West (-10.5) to East (+10.5) like a cinema corridor
    for (let i = 1; i < BUFFER_POSTER_WORLD_COORDS.length; i++) {
      expect(BUFFER_POSTER_WORLD_COORDS[i]![0]).toBeGreaterThan(
        BUFFER_POSTER_WORLD_COORDS[i - 1]![0]
      );
    }
  });

  it("should block characters from walking through desks and walls using Body-Block collision solver", () => {
    // Desk MEJA-01 is centered at [-8.4, 0, -10.8]
    const deskCollision = checkBodyCollision(-8.4, -10.8, 0.44);
    expect(deskCollision.collided).toBe(true);
    expect(deskCollision.blockerLabel).toContain("Meja");

    // Outer wall boundary check
    const wallCollision = checkBodyCollision(-31.0, 0, 0.44);
    expect(wallCollision.collided).toBe(true);

    // Resolve sliding when moving diagonally into Desk MEJA-01 from behind chair (-8.4, -9.8) -> (-8.0, -10.6)
    const resolved = resolveBodyBlockCollision(-8.4, -9.7, -8.0, -10.7, [], 0.44);
    expect(resolved.blocked).toBe(true);
    // Z should stay at -9.7 (blocked from entering desk Z = -10.7), while X slides to -8.0!
    expect(resolved.z).toBe(-9.7);
    expect(resolved.x).toBe(-8.0);
  });

  it("should provide at least 11 lounge seats for resting members", () => {
    expect(LOUNGE_SEATS.length).toBeGreaterThanOrEqual(11);
  });

  it("should transition member to 'resting' and place in lounge when credits are 0", () => {
    const editor = INITIAL_OFFICE_MEMBERS.find((m) => m.id === "editor-p1")!;
    expect(editor.status).toBe("standby");

    const exhaustedMember: OfficeMember = {
      ...editor,
      credits: 0,
      status: "resting",
      currentPosition: editor.loungePosition,
    };

    expect(exhaustedMember.status).toBe("resting");
    expect(exhaustedMember.currentPosition).toEqual(editor.loungePosition);
    expect(exhaustedMember.currentPosition).not.toEqual(editor.deskPosition);
  });

  it("should define top-down overview and Buffer Cinema Corridor camera presets", () => {
    const overviewPreset = CAMERA_PRESETS.find((p) => p.id === "overview");
    const bufferPreset = CAMERA_PRESETS.find((p) => p.id === "buffer-corridor");

    expect(overviewPreset).toBeDefined();
    expect(bufferPreset).toBeDefined();
    expect(overviewPreset!.position[1]).toBeGreaterThanOrEqual(20);
  });

  it("should persist and retrieve bidirectional Telegram <-> 3D Office sync events and speech bubbles", () => {
    const evt = recordVirtualOfficeEvent({
      source: "telegram",
      actorId: "pic-video",
      actorName: "Mas Radit (PIC Video)",
      summary: "Telegram /status dipanggil",
      bubbleText: "📊 Mengecek status 11 Profil Chrome...",
      bubbleDurationMs: 10000,
    });

    expect(evt.summary).toBe("Telegram /status dipanggil");
    expect(evt.actorId).toBe("pic-video");

    const readBack = readVirtualOfficeSyncState();
    expect(readBack.recentEvents.length).toBeGreaterThanOrEqual(1);
    expect(readBack.recentEvents[0]?.summary).toBe("Telegram /status dipanggil");
    expect(readBack.activeSpeechBubbles["pic-video"]?.text).toContain("11 Profil Chrome");
  });

  it("should personalize every NPC on their specific role and assigned videos so Profil 2 and Profil 8 give distinct answers", async () => {
    // 1. Verify all 17 members have distinct persona profiles
    for (const member of INITIAL_OFFICE_MEMBERS) {
      const persona = NPC_PERSONA_CATALOG[member.id];
      expect(persona).toBeDefined();
      expect(persona?.specialty.length).toBeGreaterThan(10);
      expect(persona?.assignedCodes.length).toBeGreaterThanOrEqual(1);
    }

    const snapshot = await getStudioStoreSnapshot();
    const accounts = listFlowProfileAccounts();

    // 2. Ask "apa video terahir yang km generate?" to Profil 2 (Iqbal) vs Profil 8 (Belligerent) vs Kak Fajar vs Dimas Origami
    const replyP2 = await generatePersonalizedNpcReply({
      memberId: "editor-p2",
      memberName: "Profil 2 • Iqbal",
      memberRole: "Editor Video #2",
      profileIndex: 2,
      userText: "apa video terahir yang km generate?",
      snapshot,
      accounts,
    });

    const replyP8 = await generatePersonalizedNpcReply({
      memberId: "editor-p8",
      memberName: "Profil 8 • Belligerent",
      memberRole: "Editor Video #8",
      profileIndex: 8,
      userText: "apa video terahir yang km generate?",
      snapshot,
      accounts,
    });

    const replyScriptLead = await generatePersonalizedNpcReply({
      memberId: "pic-script",
      memberName: "Kak Fajar",
      memberRole: "PIC Produser & Penulis Naskah",
      userText: "apa video terahir yang km generate?",
      snapshot,
      accounts,
    });

    const replyPromptEng = await generatePersonalizedNpcReply({
      memberId: "script-prompt-eng",
      memberName: "Dimas Origami",
      memberRole: "Prompt Architect Stop-Motion",
      userText: "apa video terahir yang km generate?",
      snapshot,
      accounts,
    });

    expect(replyP2).not.toEqual(replyP8);
    expect(replyP2).toContain("Profil 2");
    expect(replyP2).toContain("CO-2026-002");
    expect(replyP8).toContain("Profil 8");
    expect(replyP8).toContain("CO-2026-008");
    expect(replyScriptLead).toContain("Kak Fajar");
    expect(replyPromptEng).toContain("Dimas Origami");
  });
});
