export type TeamId = "video-prod" | "script-prod" | "qc-dist" | "executive";

export type MemberStatus = "standby" | "working" | "resting" | "offline";

export type AvatarStyle = "lead" | "editor" | "writer" | "qc" | "director";

export type LightingMode = "day" | "sunset" | "night";

export interface BufferSchedulePosterItem {
  slotIndex: number; // 1..8
  code: string;
  title: string;
  badgeNumber: string; // e.g., "01", "08", "15" (top neon number like reference image)
  scheduleLabel: string; // e.g., "08 Nov • 19:30 WIB" or "SIAP JADWAL"
  status: "scheduled" | "ready" | "published";
  platforms: string[];
  worldPosition: [number, number, number];
}

export interface OfficeMember {
  id: string;
  name: string;
  role: string;
  teamId: TeamId;
  teamName: string;
  isLead: boolean;
  gender: "male" | "female";
  profileIndex?: number; // 1-11 for video profiles
  email?: string;
  credits: number;
  maxCredits: number;
  status: MemberStatus;
  avatarStyle: AvatarStyle;
  color: string; // Jacket / Overshirt color
  innerShirtColor: string; // Inner tee color
  hairColor: string;
  // 3D coordinates [x, y, z] — Chair/Avatar sitting coordinate (offset cleanly from desk!)
  deskPosition: [number, number, number];
  loungePosition: [number, number, number];
  currentPosition: [number, number, number];
  facingAngle: number; // in radians when sitting at desk
  loungeFacingAngle: number; // in radians when sitting in lounge
  currentTask?: string;
  notes?: string;
}

export interface ChatMessage {
  id: string;
  sender: "user" | "bot" | "system";
  senderName: string;
  text: string;
  timestamp: string;
  actions?: Array<{
    label: string;
    actionId: string;
    variant?: "primary" | "secondary" | "success" | "warning";
  }>;
}

export interface CameraPreset {
  id: string;
  label: string;
  iconName: string;
  position: [number, number, number];
  target: [number, number, number];
}
