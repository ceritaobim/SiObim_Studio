import fs from "fs";
import os from "os";
import path from "path";

export interface FlowProfileAccount {
  index: number;
  dirName: string;
  name: string;
  email: string;
  credits: number;
  maxCredits: number;
  percentage: number;
  status: "healthy" | "warning" | "danger";
  lastChecked: string;
  notes?: string;
}

declare global {
  // eslint-disable-next-line no-var
  var __OBIM_FLOW_ACCOUNTS__: FlowProfileAccount[] | undefined;
}

const FLOW_ACCOUNTS_FILE = path.join(
  process.cwd(),
  "storage",
  "flow-accounts.json"
);

const TMP_FLOW_ACCOUNTS_FILE = path.join(os.tmpdir(), "flow-accounts.json");

const DEFAULT_11_PROFILES: Array<{
  index: number;
  dirName: string;
  name: string;
  email: string;
}> = [
  { index: 1, dirName: "Profile 6", name: "1(andimuhammadiqbal361)", email: "andimuhammadiqbal361@gmail.com" },
  { index: 2, dirName: "Profile 8", name: "2(iqbalandimuh)", email: "iqbalandimuh@gmail.com" },
  { index: 3, dirName: "Profile 9", name: "3(overthinkerfacts.tiktok)", email: "overthinkerfact.tiktok@gmail.com" },
  { index: 4, dirName: "Profile 13", name: "4(allow1)", email: "allowmeow1@gmail.com" },
  { index: 5, dirName: "Profile 15", name: "5(allowmeow2)", email: "allowmeow2@gmail.com" },
  { index: 6, dirName: "Profile 16", name: "6(muhammadiqbal)", email: "muhammadiqbal3616@gmail.com" },
  { index: 7, dirName: "Profile 17", name: "7(figma)", email: "figma.iqbalandimuh@gmail.com" },
  { index: 8, dirName: "Profile 18", name: "8(belligerent)", email: "bell1gerentgame@gmail.com" },
  { index: 9, dirName: "Profile 19", name: "9(second)", email: "secondgamingakun@gmail.com" },
  { index: 10, dirName: "Profile 20", name: "10(timitun)", email: "timitun6@gmail.com" },
  { index: 11, dirName: "Profile 22", name: "11(studio)", email: "studioobim@gmail.com" },
];

function getChromeProfilesFromLocalState(): Array<{
  index: number;
  dirName: string;
  name: string;
  email: string;
}> {
  try {
    const localStatePath = path.join(
      process.env.LOCALAPPDATA || "",
      "Google",
      "Chrome",
      "User Data",
      "Local State"
    );

    if (!fs.existsSync(localStatePath)) return [];

    const raw = fs.readFileSync(localStatePath, "utf8");
    const json = JSON.parse(raw);
    const infoCache = json.profile?.info_cache || {};

    const profiles: Array<{
      index: number;
      dirName: string;
      name: string;
      email: string;
    }> = [];

    interface ChromeProfileRecord {
      name?: string;
      user_name?: string;
    }

    for (const [dirName, rawData] of Object.entries(infoCache)) {
      const pData = rawData as ChromeProfileRecord;
      const match = (pData.name || "").match(/(\d+)\((.+?)\)/);
      if (match && match[1]) {
        const num = parseInt(match[1], 10);
        if (num > 0) {
          profiles.push({
            index: num,
            dirName,
            name: pData.name || `Profile ${num}`,
            email: pData.user_name || match[2] || "",
          });
        }
      }
    }

    profiles.sort((a, b) => a.index - b.index);
    return profiles;
  } catch {
    return [];
  }
}

export function calculateCreditStatus(
  credits: number,
  maxCredits: number = 50
): { percentage: number; status: "healthy" | "warning" | "danger" } {
  const percentage = Math.min(100, Math.max(0, Math.round((credits / maxCredits) * 100)));
  let status: "healthy" | "warning" | "danger" = "healthy";
  if (credits < 10) {
    status = "danger";
  } else if (credits < 25) {
    status = "warning";
  }
  return { percentage, status };
}

function readSavedAccountsFromDiskOrMemory(): FlowProfileAccount[] {
  if (Array.isArray(globalThis.__OBIM_FLOW_ACCOUNTS__) && globalThis.__OBIM_FLOW_ACCOUNTS__.length > 0) {
    return globalThis.__OBIM_FLOW_ACCOUNTS__;
  }

  // Prefer tmpdir if modified more recently (e.g., on Vercel Serverless)
  try {
    if (fs.existsSync(TMP_FLOW_ACCOUNTS_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(TMP_FLOW_ACCOUNTS_FILE, "utf8"));
      if (Array.isArray(parsed) && parsed.length > 0) {
        globalThis.__OBIM_FLOW_ACCOUNTS__ = parsed;
        return parsed;
      }
    }
  } catch {
    // Ignore tmp read error
  }

  try {
    if (fs.existsSync(FLOW_ACCOUNTS_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(FLOW_ACCOUNTS_FILE, "utf8"));
      if (Array.isArray(parsed) && parsed.length > 0) {
        globalThis.__OBIM_FLOW_ACCOUNTS__ = parsed;
        return parsed;
      }
    }
  } catch {
    // Ignore repo read error
  }

  return [];
}

export function listFlowProfileAccounts(): FlowProfileAccount[] {
  const chromeProfiles = getChromeProfilesFromLocalState();
  const existing = readSavedAccountsFromDiskOrMemory();
  const existingMap = new Map(existing.map((e) => [e.index, e]));

  const result: FlowProfileAccount[] = [];
  const targetProfiles =
    chromeProfiles.length >= 11
      ? chromeProfiles
      : existing.length >= 11
      ? existing.map((e) => ({
          index: e.index,
          dirName: e.dirName,
          name: e.name,
          email: e.email,
        }))
      : DEFAULT_11_PROFILES;

  for (const cp of targetProfiles) {
    const saved = existingMap.get(cp.index);
    const credits = saved !== undefined ? saved.credits : 50;
    const maxCredits = 50;
    const { percentage, status } = calculateCreditStatus(credits, maxCredits);

    result.push({
      index: cp.index,
      dirName: cp.dirName,
      name: cp.name,
      email: cp.email || saved?.email || "",
      credits,
      maxCredits,
      percentage,
      status,
      lastChecked: saved?.lastChecked || new Date().toISOString(),
      notes: saved?.notes || "",
    });
  }

  result.sort((a, b) => a.index - b.index);
  return result;
}

export function saveFlowProfileAccounts(accounts: FlowProfileAccount[]): void {
  // Recalculate status and percentages before saving
  const sanitized: FlowProfileAccount[] = accounts.map((acc) => {
    const maxCredits = 50;
    const clampedCredits = Math.min(maxCredits, Math.max(0, acc.credits));
    const { percentage, status } = calculateCreditStatus(clampedCredits, maxCredits);
    return {
      ...acc,
      credits: clampedCredits,
      maxCredits,
      percentage,
      status,
      lastChecked: acc.lastChecked || new Date().toISOString(),
    };
  });

  // 1. Always save to in-memory global cache
  globalThis.__OBIM_FLOW_ACCOUNTS__ = sanitized;

  const payload = JSON.stringify(sanitized, null, 2);

  // 2. Save to os.tmpdir() (works on Vercel Serverless & Local)
  try {
    fs.writeFileSync(TMP_FLOW_ACCOUNTS_FILE, payload, "utf8");
  } catch {
    // Non-blocking
  }

  // 3. Try saving to workspace storage/flow-accounts.json (works on Local Dev)
  try {
    const dir = path.dirname(FLOW_ACCOUNTS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(FLOW_ACCOUNTS_FILE, payload, "utf8");
  } catch {
    // Read-only filesystem on Vercel Serverless — safely handled by tmpdir & cloud sync
  }
}

export function updateSingleFlowProfileCredit(
  index: number,
  credits: number,
  notes?: string
): FlowProfileAccount | null {
  const accounts = listFlowProfileAccounts();
  const target = accounts.find((a) => a.index === index);
  if (!target) return null;

  target.credits = Math.min(target.maxCredits || 50, Math.max(0, credits));
  target.lastChecked = new Date().toISOString();
  if (notes !== undefined) target.notes = notes;

  saveFlowProfileAccounts(accounts);
  return target;
}
