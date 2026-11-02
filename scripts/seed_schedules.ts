import fs from "fs";
import path from "path";

const storePath = path.resolve(".data/studio-store.json");
if (!fs.existsSync(storePath)) {
  console.log("No studio-store.json found.");
  process.exit(0);
}

const raw = fs.readFileSync(storePath, "utf8");
const store = JSON.parse(raw);

// Start schedule tomorrow: 2026-10-31 19:00 WIB (UTC+7)
const startDate = new Date(Date.UTC(2026, 9, 31, 12, 0, 0)); // 12:00 UTC = 19:00 WIB

store.contentItems = store.contentItems.map((item: any, idx: number) => {
  const itemDate = new Date(startDate.getTime() + idx * 24 * 60 * 60 * 1000);
  const year = itemDate.getUTCFullYear();
  const month = String(itemDate.getUTCMonth() + 1).padStart(2, "0");
  const day = String(itemDate.getUTCDate()).padStart(2, "0");
  // 19:00 WIB is 12:00 UTC
  const scheduledIso = `${year}-${month}-${day}T19:00:00+07:00`;
  return {
    ...item,
    scheduledPublishAt: item.scheduledPublishAt || scheduledIso,
  };
});

fs.writeFileSync(storePath, JSON.stringify(store, null, 2), "utf8");
console.log("Updated", store.contentItems.length, "items with scheduledPublishAt");
console.log("First item:", store.contentItems[0].contentCode, store.contentItems[0].scheduledPublishAt);
console.log("Second item:", store.contentItems[1].contentCode, store.contentItems[1].scheduledPublishAt);
