import fs from "fs";
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

const FLOW_ACCOUNTS_FILE = path.join(
  process.cwd(),
  "storage",
  "flow-accounts.json"
);

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

export function listFlowProfileAccounts(): FlowProfileAccount[] {
  const chromeProfiles = getChromeProfilesFromLocalState();

  let existing: FlowProfileAccount[] = [];
  if (fs.existsSync(FLOW_ACCOUNTS_FILE)) {
    try {
      existing = JSON.parse(fs.readFileSync(FLOW_ACCOUNTS_FILE, "utf8"));
    } catch {
      existing = [];
    }
  }

  const existingMap = new Map(existing.map((e) => [e.index, e]));

  // Merge Chrome profiles with saved credit data
  const result: FlowProfileAccount[] = [];
  const targetProfiles = chromeProfiles.length > 0
    ? chromeProfiles
    : Array.from({ length: 10 }, (_, i) => ({
        index: i + 1,
        dirName: `Profile ${i + 1}`,
        name: `Profil ${i + 1}`,
        email: `profil${i + 1}@gmail.com`,
      }));

  for (const cp of targetProfiles) {
    const saved = existingMap.get(cp.index);
    const credits = saved ? saved.credits : 50;
    const maxCredits = 50;
    const { percentage, status } = calculateCreditStatus(credits, maxCredits);

    result.push({
      index: cp.index,
      dirName: cp.dirName,
      name: cp.name,
      email: cp.email || (saved?.email || ""),
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
  const dir = path.dirname(FLOW_ACCOUNTS_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Recalculate status and percentages before saving
  const sanitized = accounts.map((acc) => {
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

  fs.writeFileSync(FLOW_ACCOUNTS_FILE, JSON.stringify(sanitized, null, 2), "utf8");
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
