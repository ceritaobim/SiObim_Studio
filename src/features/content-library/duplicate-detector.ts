import type {
  ContentItemRecord,
  DuplicateTopicWarning,
} from "@/types/domain";

const INDONESIAN_STOPWORDS = new Set([
  "yang",
  "dan",
  "di",
  "ke",
  "dari",
  "ini",
  "itu",
  "untuk",
  "pada",
  "dengan",
  "adalah",
  "atau",
  "dalam",
  "mengapa",
  "kenapa",
  "bagaimana",
  "apa",
  "apakah",
  "saat",
  "bisa",
  "selalu",
  "lebih",
  "karena",
  "oleh",
  "seperti",
  "contoh",
  "demo",
]);

export function tokenizeTopicText(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/\[contoh demo\]/gi, " ")
    .replace(/[^a-z0-9\s]/gi, " ")
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length > 2 && !INDONESIAN_STOPWORDS.has(word));
}

export function calculateTokenSimilarity(a: string, b: string): number {
  const tokensA = new Set(tokenizeTopicText(a));
  const tokensB = new Set(tokenizeTopicText(b));

  if (tokensA.size === 0 || tokensB.size === 0) return 0;

  let intersection = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) {
      intersection++;
    }
  }

  const union = new Set([...tokensA, ...tokensB]).size;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Checks whether a candidate title/topic overlaps with existing non-archived content.
 * Returns warnings without silently deleting or blocking.
 */
export function findDuplicateTopicWarnings(
  candidate: { title: string; topic: string; excludeId?: string; excludeCode?: string },
  existingItems: Pick<
    ContentItemRecord,
    "id" | "contentCode" | "title" | "topic" | "contentStatus"
  >[]
): DuplicateTopicWarning[] {
  const warnings: DuplicateTopicWarning[] = [];
  const candidateCombined = `${candidate.title} ${candidate.topic}`.trim();
  const normalizedTitle = candidate.title.trim().toLowerCase();
  const normalizedTopic = candidate.topic.trim().toLowerCase();

  for (const item of existingItems) {
    if (item.contentStatus === "archived") continue;
    if (candidate.excludeId && item.id === candidate.excludeId) continue;
    if (
      candidate.excludeCode &&
      item.contentCode.toLowerCase() === candidate.excludeCode.toLowerCase()
    ) {
      continue;
    }

    const existingTitleNorm = item.title.trim().toLowerCase();
    const existingTopicNorm = item.topic.trim().toLowerCase();

    if (
      normalizedTitle.length > 0 &&
      (normalizedTitle === existingTitleNorm ||
        normalizedTopic === existingTopicNorm)
    ) {
      warnings.push({
        existingCode: item.contentCode,
        existingTitle: item.title,
        existingTopic: item.topic,
        similarityScore: 1,
        reason: "Judul atau topik sama persis dengan konten yang sudah ada",
      });
      continue;
    }

    const score = calculateTokenSimilarity(
      candidateCombined,
      `${item.title} ${item.topic}`
    );

    if (score >= 0.35) {
      warnings.push({
        existingCode: item.contentCode,
        existingTitle: item.title,
        existingTopic: item.topic,
        similarityScore: Number(score.toFixed(2)),
        reason: `Kemiripan kata kunci topik (${Math.round(score * 100)}%) dengan ${item.contentCode}`,
      });
    }
  }

  return warnings.sort((a, b) => b.similarityScore - a.similarityScore);
}
