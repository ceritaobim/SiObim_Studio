"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Send,
  X,
  Minimize2,
  Maximize2,
  Bot,
  RotateCcw,
  CheckCheck,
  Radio,
  Share2,
} from "lucide-react";
import { OfficeMember, ChatMessage } from "./types";
import { NPC_PERSONA_CATALOG } from "./npc-personas";

interface TelegramChatboxProps {
  member: OfficeMember;
  onClose: () => void;
  onResetCamera: () => void;
  onUpdateCredits: (memberId: string, credits: number) => void;
  onSyncResponse?: (payload: {
    accounts?: Array<{ index: number; credits: number; email?: string }>;
    syncState?: {
      activeSpeechBubbles?: Record<string, { text: string; expiresAt: number }>;
    };
  }) => void;
}

export function TelegramChatbox({
  member,
  onClose,
  onResetCamera,
  onUpdateCredits,
  onSyncResponse,
}: TelegramChatboxProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [mirrorToTelegram, setMirrorToTelegram] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize personalized conversation greeting when member changes
  useEffect(() => {
    const persona = NPC_PERSONA_CATALOG[member.id];
    let greeting = "";
    let actions: ChatMessage["actions"] = [];

    if (member.id === "pic-video") {
      greeting =
        `👑 *${persona?.signatureGreeting || `Halo CEO Obim! Saya ${member.name}.`}*\n\n` +
        `• *Jabatan:* ${persona?.role || member.role}\n` +
        `• *Spesialisasi:* ${persona?.specialty}\n` +
        `• *Fokus Saat Ini:* ${persona?.sceneFocus} (Konten \`${persona?.assignedCodes.join(", ")}\`).\n\n` +
        `Mau cek laporan 11 profil Chrome atau batch video yang terakhir dirakit?`;
      actions = [
        { label: "🎬 Batch Video Terakhir", actionId: "last_work", variant: "primary" },
        { label: "🏢 /kantor Cek 11 Profil", actionId: "/kantor", variant: "secondary" },
        { label: "🔋 /refill Semua (+50)", actionId: "refill_all", variant: "success" },
        { label: "☕ Kirim Habis ke Lounge", actionId: "evacuate_lounge", variant: "warning" },
      ];
    } else if (member.id === "pic-script") {
      greeting =
        `✍️ *${persona?.signatureGreeting || `Halo CEO Obim! Saya ${member.name}.`}*\n\n` +
        `• *Peran:* ${persona?.role || member.role}\n` +
        `• *Spesialisasi:* ${persona?.specialty}\n` +
        `• *Naskah Tanggung Jawab Saya:* \`${persona?.assignedCodes.join(", ")}\`\n\n` +
        `Mau bahas struktur Hook 3 detik atau cek naskah terakhir yang saya tulis?`;
      actions = [
        { label: "✍️ Naskah Terakhir Saya", actionId: "last_work", variant: "primary" },
        { label: "🎬 Buat Draf Naskah Baru", actionId: "/draft_naskah", variant: "secondary" },
        { label: "🪪 Peran & Tugas Saya", actionId: "my_role", variant: "secondary" },
      ];
    } else if (member.id === "script-writer-1") {
      greeting =
        `🔬 *${persona?.signatureGreeting || `Halo CEO Obim! Saya ${member.name}.`}*\n\n` +
        `• *Peran:* ${persona?.role || member.role}\n` +
        `• *Spesialisasi:* ${persona?.specialty}\n` +
        `• *Riset Konten Saya:* \`${persona?.assignedCodes.join(", ")}\`\n\n` +
        `Mau cek klaim ilmiah terverifikasi dari riset terakhir saya?`;
      actions = [
        { label: "🔬 Riset Fakta Terakhir Saya", actionId: "last_work", variant: "primary" },
        { label: "🎬 Buat Draf Naskah Sains", actionId: "/draft_naskah", variant: "secondary" },
        { label: "🪪 Detail Peran Saya", actionId: "my_role", variant: "secondary" },
      ];
    } else if (member.id === "script-prompt-eng") {
      greeting =
        `🎨 *${persona?.signatureGreeting || `Halo CEO Obim! Saya ${member.name}.`}*\n\n` +
        `• *Peran:* ${persona?.role || member.role}\n` +
        `• *Spesialisasi:* ${persona?.specialty}\n` +
        `• *Batch Prompt Saya:* \`${persona?.assignedCodes.join(", ")}\`\n\n` +
        `Semua prompt saya jaga 100% *handmade folded paper origami stop-motion* tanpa manusia realistis dan tanpa subtitle!`;
      actions = [
        { label: "🎨 Prompt Video Terakhir Saya", actionId: "last_work", variant: "primary" },
        { label: "🎬 Cek Draf Prompt Origami", actionId: "/draft_naskah", variant: "secondary" },
        { label: "🪪 Spesialisasi Saya", actionId: "my_role", variant: "secondary" },
      ];
    } else if (member.id === "pic-qc") {
      greeting =
        `🔍 *${persona?.signatureGreeting || `Halo CEO Obim! Saya ${member.name}.`}*\n\n` +
        `• *Peran:* ${persona?.role || member.role}\n` +
        `• *Spesialisasi:* ${persona?.specialty}\n` +
        `• *Antrean Audit QC Saya:* \`${persona?.assignedCodes.join(", ")}\`\n\n` +
        `Siap memeriksa kelayakan file master *00Final.mp4* sebelum diserahkan ke Buffer.`;
      actions = [
        { label: "🔍 Video Terakhir Lulus QC", actionId: "last_work", variant: "primary" },
        { label: "🚀 /publish ke Buffer", actionId: "/publish", variant: "success" },
        { label: "📊 /status Studio", actionId: "/status", variant: "secondary" },
      ];
    } else if (member.id === "qc-operator") {
      greeting =
        `🎞️ *${persona?.signatureGreeting || `Halo CEO Obim! Saya ${member.name}.`}*\n\n` +
        `• *Peran:* ${persona?.role || member.role}\n` +
        `• *Spesialisasi:* ${persona?.specialty}\n` +
        `• *Slot Galeri Aktif:* \`${persona?.assignedCodes.join(", ")}\`\n\n` +
        `Mau cek video terakhir yang tayang atau jadwalkan antrean ke TikTok, Shorts & Reels?`;
      actions = [
        { label: "🎞️ Jadwal & Video Terakhir", actionId: "last_work", variant: "primary" },
        { label: "🚀 /publish Sekarang", actionId: "/publish", variant: "success" },
        { label: "📅 Auto-Schedule Buffer", actionId: "jadwal otomatis", variant: "secondary" },
      ];
    } else if (member.teamId === "video-prod") {
      if (member.status === "resting" || member.credits === 0) {
        greeting =
          `☕ *${persona?.signatureGreeting || `Halo CEO Obim! Saya ${member.name}.`}*\n\n` +
          `• *Peran & Meja:* ${persona?.role || member.role} (${persona?.workstationLabel})\n` +
          `• *Spesialisasi Adegan:* ${persona?.sceneFocus}\n` +
          `• *Konten Pegangan Saya:* \`${persona?.assignedCodes.join(", ")}\`\n\n` +
          `Saat ini kuota profil Chrome saya tercatat *0/50 credits* usai merender tugas terakhir, jadi saya sedang istirahat di *Lounge Warkop Obim*.`;
        actions = [
          { label: "🎬 Video Terakhir Saya", actionId: "last_work", variant: "primary" },
          { label: "🔋 Isi Kuota (+50) & Kerja", actionId: "refill_50", variant: "success" },
          { label: "🪪 Peran & Spesialisasi", actionId: "my_role", variant: "secondary" },
        ];
      } else {
        greeting =
          `💻 *${persona?.signatureGreeting || `Halo CEO Obim! Saya ${member.name}.`}*\n\n` +
          `• *Peran & Meja:* ${persona?.role || member.role} (${persona?.workstationLabel})\n` +
          `• *Spesialisasi Adegan:* ${persona?.sceneFocus}\n` +
          `• *Konten Pegangan Saya:* \`${persona?.assignedCodes.join(", ")}\`\n` +
          `• *Sisa Kuota Chrome:* *${member.credits}/50 credits* (${member.email || "Aktif"}).\n\n` +
          `Siap merender adegan stop-motion origami berikutnya!`;
        actions = [
          { label: "🎬 Video Terakhir Saya", actionId: "last_work", variant: "primary" },
          { label: "⚡ Render 1 Klip (-10 kr)", actionId: "consume_10", variant: "secondary" },
          { label: "☕ Suruh Istirahat ke Lounge", actionId: "rest_now", variant: "warning" },
          { label: "🔋 Refill Penuh (+50)", actionId: "refill_50", variant: "success" },
        ];
      }
    } else {
      greeting = `Halo CEO Obim! Saya ${member.name} (${member.role}).`;
      actions = [
        { label: "🎬 Tugas Terakhir Saya", actionId: "last_work", variant: "primary" },
        { label: "🪪 Peran Saya", actionId: "my_role", variant: "secondary" },
      ];
    }

    setMessages([
      {
        id: "msg-welcome-" + member.id,
        sender: "bot",
        senderName: member.name,
        text: greeting,
        timestamp: new Date().toLocaleTimeString("id-ID", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        actions,
      },
    ]);
  }, [member.id, member.status, member.credits, member.isLead, member.name, member.role, member.teamId, member.email]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const handleSendMessage = async (textToSend?: string) => {
    const raw = textToSend || inputText;
    const trimmed = raw.trim();
    if (!trimmed) return;

    setInputText("");

    const userMsg: ChatMessage = {
      id: "user-" + Date.now(),
      sender: "user",
      senderName: "CEO Obim",
      text: trimmed,
      timestamp: new Date().toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsTyping(true);

    try {
      // Handle bulk office actions or send to unified backend API
      if (trimmed === "refill_all") {
        const res = await fetch("/api/virtual-office/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "update_credit",
            bulkAction: "refill_all",
            mirrorToTelegram,
          }),
        });
        const data = await res.json();
        if (data?.ok && onSyncResponse) {
          onSyncResponse(data);
        }
        setIsTyping(false);
        setMessages((prev) => [
          ...prev,
          {
            id: "bot-" + Date.now(),
            sender: "bot",
            senderName: member.name,
            text:
              data?.message ||
              "🔋 Seluruh 11 Profil Chrome telah diisi ulang menjadi 50/50 credits! Semua tim berjalan kembali ke meja kerja.",
            timestamp: new Date().toLocaleTimeString("id-ID", {
              hour: "2-digit",
              minute: "2-digit",
            }),
          },
        ]);
        return;
      }

      if (trimmed === "evacuate_lounge") {
        const res = await fetch("/api/virtual-office/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "update_credit",
            bulkAction: "evacuate_lounge",
            mirrorToTelegram,
          }),
        });
        const data = await res.json();
        if (data?.ok && onSyncResponse) {
          onSyncResponse(data);
        }
        setIsTyping(false);
        setMessages((prev) => [
          ...prev,
          {
            id: "bot-" + Date.now(),
            sender: "bot",
            senderName: member.name,
            text:
              data?.message ||
              "☕ Anggota tim yang kelelahan telah berjalan ke kursi istirahat Warkop Obim.",
            timestamp: new Date().toLocaleTimeString("id-ID", {
              hour: "2-digit",
              minute: "2-digit",
            }),
          },
        ]);
        return;
      }

      // Send chat/command to real Studio + Gemini Copilot + Flow Accounts backend
      const res = await fetch("/api/virtual-office/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "chat",
          memberId: member.id,
          memberName: member.name,
          memberRole: member.role,
          profileIndex: member.profileIndex,
          text: trimmed,
          mirrorToTelegram,
        }),
      });

      const data = await res.json();

      if (data?.ok) {
        if (typeof data.updatedCredits === "number") {
          onUpdateCredits(member.id, data.updatedCredits);
        }
        if (onSyncResponse) {
          onSyncResponse(data);
        }

        let newActions: ChatMessage["actions"] = [];
        if (data.updatedCredits === 0) {
          newActions = [
            { label: "🔋 Isi Kuota (+50)", actionId: "refill_50", variant: "success" },
          ];
        } else if (typeof data.updatedCredits === "number" && data.updatedCredits > 0) {
          newActions = [
            { label: "🎬 Render 1 Klip (-10 kr)", actionId: "consume_10", variant: "primary" },
            { label: "☕ Kirim ke Lounge", actionId: "rest_now", variant: "warning" },
          ];
        }

        setIsTyping(false);
        setMessages((prev) => [
          ...prev,
          {
            id: "bot-" + Date.now(),
            sender: "bot",
            senderName: member.name,
            text: data.reply,
            timestamp: new Date().toLocaleTimeString("id-ID", {
              hour: "2-digit",
              minute: "2-digit",
            }),
            actions: newActions.length > 0 ? newActions : undefined,
          },
        ]);
        return;
      }
    } catch {
      // Fallback if offline
    }

    setIsTyping(false);
    setMessages((prev) => [
      ...prev,
      {
        id: "bot-" + Date.now(),
        sender: "bot",
        senderName: member.name,
        text: `🫡 Siap CEO Obim! Perintah "${trimmed}" telah diterima oleh ${member.name}.`,
        timestamp: new Date().toLocaleTimeString("id-ID", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      },
    ]);
  };

  const handleActionClick = (actionId: string) => {
    handleSendMessage(actionId);
  };

  return (
    <div
      className={`fixed bottom-4 right-4 z-50 flex flex-col transition-all duration-300 shadow-2xl rounded-2xl overflow-hidden border border-slate-700/80 bg-[#17212b] text-slate-100 ${
        isMinimized
          ? "w-80 h-14"
          : "w-[92vw] sm:w-[430px] h-[560px] max-h-[85vh]"
      }`}
    >
      {/* 1. TELEGRAM HEADER */}
      <div className="flex items-center justify-between px-3.5 py-2.5 bg-[#202b36] border-b border-slate-700/50 select-none">
        <div className="flex items-center gap-2.5 min-w-0">
          {/* Avatar with status dot */}
          <div className="relative shrink-0">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shadow"
              style={{
                backgroundColor: member.color,
                color: "#ffffff",
              }}
            >
              {member.isLead ? "👑" : member.profileIndex ? member.profileIndex : "🤖"}
            </div>
            <span
              className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full ring-2 ring-[#202b36] ${
                member.status === "resting" ? "bg-red-500" : "bg-emerald-400"
              }`}
            />
          </div>

          {/* Name & Status */}
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-sm truncate text-slate-100">
                {member.name}
              </span>
              <span className="bg-[#242f3d] text-sky-400 text-[10px] px-1.5 py-0.2 rounded font-mono">
                AI Sync
              </span>
            </div>
            <p className="text-[11px] text-slate-400 truncate">
              {member.status === "resting"
                ? "☕ Istirahat di Lounge (0 kuota)"
                : `💻 Standby • ${member.credits}/50 credits`}
            </p>
          </div>
        </div>

        {/* Action controls */}
        <div className="flex items-center gap-1 shrink-0 text-slate-400">
          <button
            onClick={() => setMirrorToTelegram(!mirrorToTelegram)}
            title={
              mirrorToTelegram
                ? "Teruskan pesan ke Telegram Bot: AKTIF"
                : "Klik untuk teruskan balasan chat ini ke aplikasi Telegram Anda"
            }
            className={`p-1.5 rounded-lg transition flex items-center gap-1 text-[10px] font-semibold cursor-pointer ${
              mirrorToTelegram
                ? "bg-sky-500/20 text-sky-300 border border-sky-500/40"
                : "hover:bg-slate-700/50 text-slate-400"
            }`}
          >
            <Share2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">TG</span>
          </button>
          <button
            onClick={onResetCamera}
            title="Tampak Atas / Reset Kamera"
            className="p-1.5 rounded-lg hover:bg-slate-700/50 hover:text-white transition cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            title={isMinimized ? "Perbesar" : "Perkecil"}
            className="p-1.5 rounded-lg hover:bg-slate-700/50 hover:text-white transition cursor-pointer"
          >
            {isMinimized ? (
              <Maximize2 className="w-4 h-4" />
            ) : (
              <Minimize2 className="w-4 h-4" />
            )}
          </button>
          <button
            onClick={onClose}
            title="Tutup Chatbox"
            className="p-1.5 rounded-lg hover:bg-red-500/20 hover:text-red-400 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 2. TELEGRAM CHAT THREAD (Hidden when minimized) */}
      {!isMinimized && (
        <>
          <div className="flex-1 overflow-y-auto p-3.5 space-y-3 bg-[#0e1621] bg-opacity-95 text-xs">
            {/* Live Sync Status Pill */}
            <div className="text-center my-1">
              <span className="inline-flex items-center gap-1.5 bg-[#182533] text-emerald-300 border border-emerald-500/30 text-[10px] px-2.5 py-0.5 rounded-full shadow-sm">
                <Radio className="w-3 h-3 animate-pulse text-emerald-400" />
                Tersinkron ke Database Studio, Flow Chrome & Bot Telegram
              </span>
            </div>

            {messages.map((msg) => {
              const isUser = msg.sender === "user";

              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${
                    isUser ? "items-end" : "items-start"
                  }`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 shadow-md ${
                      isUser
                        ? "bg-[#2b5278] text-white rounded-tr-none"
                        : "bg-[#182533] text-slate-200 rounded-tl-none border border-slate-700/40"
                    }`}
                  >
                    {!isUser && (
                      <p className="font-semibold text-sky-400 text-[11px] mb-1 flex items-center gap-1">
                        <Bot className="w-3 h-3" />
                        {msg.senderName}
                      </p>
                    )}

                    <div className="whitespace-pre-line leading-relaxed text-slate-100">
                      {msg.text.split("\n").map((line, idx) => (
                        <p key={idx} className={line === "" ? "h-2" : ""}>
                          {line}
                        </p>
                      ))}
                    </div>

                    <div
                      className={`flex items-center justify-end gap-1 text-[9px] mt-1 ${
                        isUser ? "text-sky-200" : "text-slate-400"
                      }`}
                    >
                      <span>{msg.timestamp}</span>
                      {isUser && <CheckCheck className="w-3 h-3 text-sky-300" />}
                    </div>
                  </div>

                  {/* Telegram Inline Buttons (Action Chips) */}
                  {msg.actions && msg.actions.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2 max-w-[85%]">
                      {msg.actions.map((act) => (
                        <button
                          key={act.actionId}
                          onClick={() => handleActionClick(act.actionId)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition shadow-sm border cursor-pointer ${
                            act.variant === "success"
                              ? "bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 border-emerald-500/40"
                              : act.variant === "warning"
                              ? "bg-amber-600/30 hover:bg-amber-600/50 text-amber-300 border-amber-500/40"
                              : act.variant === "primary"
                              ? "bg-sky-600/40 hover:bg-sky-600/60 text-sky-200 border-sky-500/40"
                              : "bg-slate-700/40 hover:bg-slate-700/70 text-slate-300 border-slate-600/40"
                          }`}
                        >
                          {act.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {isTyping && (
              <div className="flex items-center gap-1.5 text-slate-400 text-xs px-2.5 py-1.5 bg-[#182533] rounded-full w-fit">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-bounce" />
                <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-bounce [animation-delay:0.2s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-bounce [animation-delay:0.4s]" />
                <span className="text-[10px] ml-1">memproses di server Studio...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* 3. QUICK CHIPS BAR */}
          <div className="flex items-center gap-1 px-3 py-1.5 bg-[#17212b] border-t border-slate-700/40 overflow-x-auto text-[10px] text-slate-300">
            <button
              onClick={() => handleSendMessage("Apa video terakhir yang kamu generate?")}
              className="shrink-0 px-2 py-0.5 rounded bg-sky-950/80 text-sky-300 hover:bg-sky-900 transition cursor-pointer"
            >
              🎬 Video Terakhir
            </button>
            <button
              onClick={() => handleSendMessage("Apa peran dan spesialisasi kamu?")}
              className="shrink-0 px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 transition cursor-pointer"
            >
              🪪 Peran Saya
            </button>
            {member.teamId === "video-prod" && !member.isLead && (
              <>
                <button
                  onClick={() => handleActionClick("refill_50")}
                  className="shrink-0 px-2 py-0.5 rounded bg-emerald-950/70 text-emerald-300 hover:bg-emerald-900 transition cursor-pointer"
                >
                  🔋 Refill +50
                </button>
                <button
                  onClick={() => handleActionClick("consume_10")}
                  className="shrink-0 px-2 py-0.5 rounded bg-sky-950/70 text-sky-300 hover:bg-sky-900 transition cursor-pointer"
                >
                  ⚡ Render (-10)
                </button>
                <button
                  onClick={() => handleActionClick("rest_now")}
                  className="shrink-0 px-2 py-0.5 rounded bg-amber-950/70 text-amber-300 hover:bg-amber-900 transition cursor-pointer"
                >
                  ☕ Lounge
                </button>
              </>
            )}
            {member.teamId === "script-prod" && (
              <button
                onClick={() => handleSendMessage("/draft_naskah")}
                className="shrink-0 px-2 py-0.5 rounded bg-purple-950/70 text-purple-300 hover:bg-purple-900 transition cursor-pointer"
              >
                🎬 Buat Naskah
              </button>
            )}
            <button
              onClick={() => handleSendMessage("/status")}
              className="shrink-0 px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 transition cursor-pointer"
            >
              📊 /status
            </button>
            <button
              onClick={() => handleSendMessage("/publish")}
              className="shrink-0 px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 transition cursor-pointer"
            >
              🚀 /publish
            </button>
          </div>

          {/* 4. TELEGRAM INPUT BOX */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center gap-2 p-2.5 bg-[#202b36] border-t border-slate-700/50"
          >
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Ketik /status, /publish, atau tanya AI Copilot..."
              className="flex-1 bg-[#17212b] border border-slate-700/60 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-sky-500 transition"
            />

            <button
              type="submit"
              disabled={!inputText.trim() || isTyping}
              className="p-2 rounded-xl bg-sky-500 hover:bg-sky-400 disabled:opacity-40 disabled:hover:bg-sky-500 text-white shadow-md transition cursor-pointer"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </>
      )}
    </div>
  );
}
