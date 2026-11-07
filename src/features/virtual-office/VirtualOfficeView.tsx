"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import confetti from "canvas-confetti";
import {
  OfficeMember,
  CameraPreset,
  LightingMode,
  BufferSchedulePosterItem,
} from "./types";
import { DEFAULT_BUFFER_POSTERS, INITIAL_OFFICE_MEMBERS } from "./constants";
import { Office3DCanvas } from "./Office3DCanvas";
import { TelegramChatbox } from "./TelegramChatbox";
import { OfficeHUD } from "./OfficeHUD";
import { BufferCinemaModal } from "./BufferCinemaModal";
import type { VirtualOfficeEvent } from "@/lib/services/virtual-office-sync";

export function VirtualOfficeView() {
  const [members, setMembers] = useState<OfficeMember[]>(INITIAL_OFFICE_MEMBERS);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [lightingMode, setLightingMode] = useState<LightingMode>("day");
  const [propToast, setPropToast] = useState<string | null>(null);
  const [cameraFollowPlayer, setCameraFollowPlayer] = useState<boolean>(true);
  const [activeSpeechBubbles, setActiveSpeechBubbles] = useState<
    Record<string, { text: string; expiresAt: number }>
  >({});
  const [recentEvents, setRecentEvents] = useState<VirtualOfficeEvent[]>([]);
  const [bufferPosters, setBufferPosters] =
    useState<BufferSchedulePosterItem[]>(DEFAULT_BUFFER_POSTERS);
  const [showBufferModal, setShowBufferModal] = useState<boolean>(false);
  const [selectedBufferPoster, setSelectedBufferPoster] =
    useState<BufferSchedulePosterItem | null>(null);

  const [virtualMoveInput, setVirtualMoveInput] = useState<{
    dx: number;
    dz: number;
    sprint: boolean;
  }>({ dx: 0, dz: 0, sprint: false });

  const lastSeenEventIdRef = useRef<string | null>(null);

  const [targetCamera, setTargetCamera] = useState<{
    position: [number, number, number];
    target: [number, number, number];
  } | null>(null);

  const showToast = useCallback((msg: string) => {
    setPropToast(msg);
  }, []);

  useEffect(() => {
    if (!propToast) return;
    const timer = setTimeout(() => setPropToast(null), 4200);
    return () => clearTimeout(timer);
  }, [propToast]);

  // Helper to apply backend sync payload to local 3D office state
  const applySyncData = useCallback(
    (data: {
      accounts?: Array<{ index: number; credits: number; email?: string }>;
      bufferSchedulePosters?: BufferSchedulePosterItem[];
      syncState?: {
        recentEvents?: VirtualOfficeEvent[];
        activeSpeechBubbles?: Record<string, { text: string; expiresAt: number }>;
      };
    }) => {
      if (data?.accounts && Array.isArray(data.accounts)) {
        setMembers((prev) =>
          prev.map((m) => {
            if (m.profileIndex) {
              const match = data.accounts?.find((a) => a.index === m.profileIndex);
              if (match) {
                const credits = match.credits ?? m.credits;
                const isExhausted = credits === 0;
                return {
                  ...m,
                  email: match.email || m.email,
                  credits,
                  status: isExhausted ? "resting" : "standby",
                  currentPosition: isExhausted ? m.loungePosition : m.deskPosition,
                  currentTask: isExhausted
                    ? "Istirahat di Lounge (Kuota Habis 0/50)"
                    : "Standby mengetik di depan laptop",
                };
              }
            }
            return m;
          })
        );
      }

      if (data?.bufferSchedulePosters && Array.isArray(data.bufferSchedulePosters)) {
        setBufferPosters(data.bufferSchedulePosters);
      }

      if (data?.syncState?.activeSpeechBubbles) {
        setActiveSpeechBubbles(data.syncState.activeSpeechBubbles);
      }

      if (data?.syncState?.recentEvents && Array.isArray(data.syncState.recentEvents)) {
        const events = data.syncState.recentEvents;
        setRecentEvents(events);
        const newest = events[0];
        if (newest && newest.id !== lastSeenEventIdRef.current) {
          if (lastSeenEventIdRef.current !== null && newest.source === "telegram") {
            showToast(`📲 [Telegram Live] ${newest.summary}`);
          }
          lastSeenEventIdRef.current = newest.id;
        }
      }
    },
    [showToast]
  );

  // Real-time polling of /api/virtual-office/sync every 2.5s for bidirectional Telegram & DB sync
  useEffect(() => {
    let mounted = true;

    async function pollSyncState() {
      try {
        const res = await fetch("/api/virtual-office/sync", { cache: "no-store" });
        if (!res.ok || !mounted) return;
        const data = await res.json();
        if (mounted && data?.ok) {
          applySyncData(data);
        }
      } catch {
        // Ignore transient network errors
      }
    }

    pollSyncState();
    const interval = setInterval(pollSyncState, 2500);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [applySyncData]);

  // Handle member click or [E] proximity interaction -> Smooth third-person dialogue camera & open Telegram AI Chatbox
  const handleSelectMember = useCallback((member: OfficeMember) => {
    setSelectedMemberId(member.id);
    setCameraFollowPlayer(false);

    const activeCoord =
      member.status === "resting" ? member.loungePosition : member.deskPosition;
    const [posX, posY, posZ] = activeCoord;

    // Cinematic Third-Person Dialogue Shot (Eye-level over-the-shoulder angle!)
    setTargetCamera({
      target: [posX, posY + 1.25, posZ],
      position: [posX + 2.1, posY + 2.2, posZ + 3.2],
    });
  }, []);

  // Reset camera to spacious top-down overview
  const handleResetCamera = useCallback(() => {
    setSelectedMemberId(null);
    setCameraFollowPlayer(false);
    setTargetCamera({
      position: [0, 38, 38],
      target: [0, 0, -1],
    });
  }, []);

  // Toggle between Third-Person Game Mode and Top-Down Overview
  const handleToggleGameMode = useCallback(() => {
    setSelectedMemberId(null);
    setCameraFollowPlayer((prev) => {
      const next = !prev;
      if (!next) {
        setTargetCamera({
          position: [0, 38, 38],
          target: [0, 0, -1],
        });
      } else {
        setTargetCamera(null);
        showToast(
          "🎮 Mode Game Third-Person Aktif! Gunakan WASD / Panah untuk bergerak, Mouse Drag untuk putar kamera, dan [E] untuk interaksi."
        );
      }
      return next;
    });
  }, [showToast]);

  // Camera room preset switcher
  const handleSelectPreset = useCallback((preset: CameraPreset) => {
    setSelectedMemberId(null);
    setCameraFollowPlayer(false);
    setTargetCamera({
      position: preset.position,
      target: preset.target,
    });
  }, []);

  // Update credits & persist to flow-accounts.json + virtual-office-sync.ts
  const handleUpdateCredits = useCallback(
    async (memberId: string, newCredits: number) => {
      const targetMember = members.find((m) => m.id === memberId);

      setMembers((prev) =>
        prev.map((m) => {
          if (m.id === memberId) {
            const isResting = newCredits === 0;
            return {
              ...m,
              credits: newCredits,
              status: isResting ? "resting" : "standby",
              currentPosition: isResting ? m.loungePosition : m.deskPosition,
              currentTask: isResting
                ? "Istirahat di Lounge (Kuota Habis 0/50)"
                : "Standby mengetik di depan laptop",
            };
          }
          return m;
        })
      );

      if (newCredits > 0) {
        confetti({
          particleCount: 40,
          spread: 60,
          origin: { y: 0.7 },
        });
      }

      if (targetMember?.profileIndex) {
        try {
          const res = await fetch("/api/virtual-office/sync", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "update_credit",
              profileIndex: targetMember.profileIndex,
              credits: newCredits,
            }),
          });
          const data = await res.json();
          if (data?.ok) {
            applySyncData(data);
          }
        } catch {
          // Ignore
        }
      }
    },
    [members, applySyncData]
  );

  // Simulate batch rendering 1 clip (-10 credits persisted to database)
  const handleSimulateBatchRender = useCallback(() => {
    const activeEditor = members.find(
      (m) => m.teamId === "video-prod" && !m.isLead && m.credits > 0
    );

    if (activeEditor) {
      const nextCredits = Math.max(0, activeEditor.credits - 10);
      handleUpdateCredits(activeEditor.id, nextCredits);
      if (nextCredits === 0) {
        showToast(
          `☕ Kuota ${activeEditor.name} habis (0/50)! Berjalan menuju kursi istirahat Warkop Obim...`
        );
      } else {
        showToast(
          `🎬 ${activeEditor.name} merender klip! Sisa kuota di database: ${nextCredits}/50 kr.`
        );
      }
    }
  }, [members, handleUpdateCredits, showToast]);

  // Refill all video editors to 50 credits & walk them back to desks
  const handleRefillAll = useCallback(async () => {
    setMembers((prev) =>
      prev.map((m) => {
        if (m.teamId === "video-prod" && !m.isLead) {
          return {
            ...m,
            credits: 50,
            status: "standby",
            currentPosition: m.deskPosition,
            currentTask: "Standby di depan laptop",
          };
        }
        return m;
      })
    );

    showToast(
      "🔋 Seluruh 11 Profil Chrome diisi ulang (50/50 kr di database)! Semua tim berjalan kembali ke meja kerja."
    );
    confetti({
      particleCount: 70,
      spread: 90,
      origin: { y: 0.6 },
    });

    try {
      const res = await fetch("/api/virtual-office/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_credit",
          bulkAction: "refill_all",
        }),
      });
      const data = await res.json();
      if (data?.ok) {
        applySyncData(data);
      }
    } catch {
      // Ignore
    }
  }, [showToast, applySyncData]);

  // Send all video editors to walk to the lounge chairs
  const handleSendExhaustedToLounge = useCallback(async () => {
    setMembers((prev) =>
      prev.map((m) => {
        if (m.teamId === "video-prod" && !m.isLead) {
          return {
            ...m,
            credits: 0,
            status: "resting",
            currentPosition: m.loungePosition,
            currentTask: "Istirahat di Lounge Warkop Obim",
          };
        }
        return m;
      })
    );

    showToast(
      "☕ Seluruh 11 Editor Video meninggalkan PC dan berjalan menuju kursi istirahat di Lounge Warkop Obim!"
    );

    try {
      const res = await fetch("/api/virtual-office/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_credit",
          bulkAction: "evacuate_lounge",
        }),
      });
      const data = await res.json();
      if (data?.ok) {
        applySyncData(data);
      }
    } catch {
      // Ignore
    }
  }, [showToast, applySyncData]);

  const handleSelectBufferPoster = useCallback(
    (poster: BufferSchedulePosterItem) => {
      setSelectedBufferPoster(poster);
      setShowBufferModal(true);
    },
    []
  );

  const handlePublishFromBufferModal = useCallback(
    async (code: string) => {
      showToast(`🚀 Mengirim perintah Publish ${code} ke Publisher Buffer...`);
      try {
        const res = await fetch("/api/virtual-office/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "chat",
            memberId: "qc-operator",
            memberName: "Buffer (Publisher)",
            memberRole: "Publisher Jadwal Tayang • Buffer",
            text: `/publish ${code}`,
          }),
        });
        const data = await res.json();
        if (data?.ok) {
          applySyncData(data);
          showToast(data.replyText || `✅ ${code} diproses oleh Publisher Buffer!`);
        }
      } catch {
        // Ignore
      }
    },
    [applySyncData, showToast]
  );

  const handleCameraTransitionDone = useCallback(() => {
    setTargetCamera(null);
  }, []);

  const selectedMember = members.find((m) => m.id === selectedMemberId);

  return (
    <div className="relative w-screen h-screen bg-[#090d16] overflow-hidden select-none">
      {/* 1. TOP GAME HUD, VIRTUAL GAMEPAD & LIVE SYNC FEED */}
      <OfficeHUD
        members={members}
        lightingMode={lightingMode}
        onChangeLighting={setLightingMode}
        onSelectPreset={handleSelectPreset}
        onResetCamera={handleResetCamera}
        onSimulateBatchRender={handleSimulateBatchRender}
        onRefillAll={handleRefillAll}
        onSendExhaustedToLounge={handleSendExhaustedToLounge}
        propToast={propToast}
        cameraFollowPlayer={cameraFollowPlayer}
        onToggleCameraFollow={handleToggleGameMode}
        onOpenBufferModal={() => {
          setSelectedBufferPoster(null);
          setShowBufferModal(true);
        }}
        recentEvents={recentEvents}
        onVirtualMoveChange={setVirtualMoveInput}
      />

      {/* 2. SPACIOUS 3D INTERACTIVE WORLD WITH PLAYABLE CEO AVATAR & BUFFER CORRIDOR */}
      <Office3DCanvas
        members={members}
        selectedMemberId={selectedMemberId}
        lightingMode={lightingMode}
        onSelectMember={handleSelectMember}
        onSelectBufferPoster={handleSelectBufferPoster}
        onPropInteract={(id, msg) => {
          showToast(msg);
          if (id === "exit-door") {
            setTimeout(() => {
              window.location.href = "/";
            }, 450);
          }
        }}
        targetCamera={targetCamera}
        onCameraTransitionDone={handleCameraTransitionDone}
        cameraFollowPlayer={cameraFollowPlayer}
        activeSpeechBubbles={activeSpeechBubbles}
        virtualMoveInput={virtualMoveInput}
        bufferPosters={bufferPosters}
      />

      {/* 3. BUFFER CINEMA SCHEDULE CORRIDOR MODAL */}
      {showBufferModal && (
        <BufferCinemaModal
          posters={bufferPosters}
          selectedPoster={selectedBufferPoster}
          onClose={() => setShowBufferModal(false)}
          onPublishCode={handlePublishFromBufferModal}
          onTalkToBufferPublisher={() => {
            setShowBufferModal(false);
            const bufferChar = members.find((m) => m.id === "qc-operator");
            if (bufferChar) handleSelectMember(bufferChar);
          }}
        />
      )}

      {/* 4. TELEGRAM-STYLE AI CHATBOX */}
      {selectedMember && (
        <TelegramChatbox
          member={selectedMember}
          onClose={() => setSelectedMemberId(null)}
          onResetCamera={handleResetCamera}
          onUpdateCredits={handleUpdateCredits}
          onSyncResponse={applySyncData}
        />
      )}
    </div>
  );
}
