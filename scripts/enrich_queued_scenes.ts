import fs from "fs";
import path from "path";
import { deriveTopicSceneEntity, deriveHeadlineQuestion } from "../src/features/scenes/topic-entity-enricher";
import { buildProjectAndPartPrompts } from "../src/features/scenes/prompt-generator";
import type { SceneRecord, ContentItemRecord, ProjectSettingsSummary } from "../src/types/domain";

const storePath = path.resolve(__dirname, "..", ".data", "studio-store.json");
const queuePath = path.resolve(__dirname, "..", "storage", "macro", "queue.json");

const defaultSettings: ProjectSettingsSummary = {
  projectName: "Cerita Obim",
  channelName: "Cerita Obim",
  language: "id-ID",
  timezone: "Asia/Jakarta",
  niche: "Sains Makanan & Psikologi Sehari-hari",
  toneGuide: "Santai, bersahabat, edukatif",
  visualStyleGuide:
    "Handmade origami paper stop-motion; setiap karakter, objek, properti, dan latar belakang tampak terbuat dari kertas lipat; tanpa manusia/objek fotorealistik; tanpa subtitle atau teks di dalam video.",
  characterDescription:
    "Obim — Figur anak muda ramah dari lipatan kertas origami bertekstur doff (matte craft paper). Rambut potongan mangkuk/jamur (bowl-cut) dari lipatan kertas biru-hitam gelap berlipit vertikal rapi. Wajah kertas warna krem hangat dengan mata melengkung tersenyum ramah. Memakai kemeja flanel lengan panjang motif kotak-kotak merah-hitam-putih dengan lengan digulung sesiku, celana panjang kertas biru dongker, dan sepatu kertas cokelat tua.",
  characterReferenceAssetIds: [],
  defaultDurationSeconds: 65,
  outputAspectRatio: "9:16",
  outputWidth: 1080,
  outputHeight: 1920,
  noSubtitles: true,
  weeklyVideoTarget: 7,
  dailyBudgetLimit: 10,
  monthlyBudgetLimit: 50,
  maxSceneRetries: 3,
  videoGenerationMode: "semi_manual_flow",
  targetSceneSecondsMin: 8,
  targetSceneSecondsMax: 10,
  targetPlatforms: ["tiktok", "youtube", "instagram"],
};

async function main() {
  console.log("=== ENRICHING SCENES WITH TOPIC ENTITY PROMPTS ===");

  // 1. Enrich .data/studio-store.json
  if (fs.existsSync(storePath)) {
    const store = JSON.parse(fs.readFileSync(storePath, "utf-8"));
    const contentItems: ContentItemRecord[] = store.contentItems || [];
    const scenes: SceneRecord[] = store.scenes || [];

    console.log(`Found ${contentItems.length} content items and ${scenes.length} scenes in studio-store.json`);

    let enrichedCount = 0;

    for (const item of contentItems) {
      const itemScenes = scenes
        .filter((s) => s.contentId === item.id)
        .sort((a, b) => a.sceneIndex - b.sceneIndex);

      if (itemScenes.length === 0) continue;

      const built = buildProjectAndPartPrompts({
        settings: defaultSettings,
        content: item,
        scenes: itemScenes,
      });

      const headline = deriveHeadlineQuestion(item.title, item.topic);

      itemScenes.forEach((sc, idx) => {
        const part = built.partPrompts[idx];
        const entity = deriveTopicSceneEntity({
          contentCode: item.contentCode,
          title: item.title,
          topic: item.topic,
          category: item.category,
          programName: item.programName,
          sceneIndex: sc.sceneIndex,
          totalScenes: itemScenes.length,
          narrationText: sc.narrationText,
          userVisualAction: undefined, // Force use new kinetic visual hook
        });

        sc.visualAction = entity.enrichedVisualAction;
        sc.sfxCue = entity.diegeticSfxCue || sc.sfxCue;
        sc.entityAttributes = {
          role: entity.role,
          roleLabel: entity.roleLabel,
          topicProps: entity.topicProps,
          characterStance: entity.characterStance,
          origamiEnvironment: entity.origamiEnvironment,
          actionChoreography: entity.actionChoreography,
        };
        sc.promptText = part?.promptText || sc.promptText;
        sc.updatedAt = new Date().toISOString();
        enrichedCount++;
      });
    }

    fs.writeFileSync(storePath, JSON.stringify(store, null, 2), "utf-8");
    console.log(`Successfully enriched ${enrichedCount} scenes in studio-store.json!`);
  }

  // 2. Enrich storage/macro/queue.json
  if (fs.existsSync(queuePath)) {
    const queue = JSON.parse(fs.readFileSync(queuePath, "utf-8"));
    if (queue.items && Array.isArray(queue.items)) {
      queue.items.forEach((item: any) => {
        const itemScenes = item.scenes || [];
        const built = buildProjectAndPartPrompts({
          settings: defaultSettings,
          content: item,
          scenes: itemScenes,
        });
        const headline = deriveHeadlineQuestion(item.title, item.category);

        itemScenes.forEach((sc: any, idx: number) => {
          const part = built.partPrompts[idx];
          const entity = deriveTopicSceneEntity({
            contentCode: item.contentCode,
            title: item.title,
            topic: item.category,
            category: item.category,
            programName: item.programName,
            sceneIndex: sc.sceneIndex,
            totalScenes: itemScenes.length,
            narrationText: sc.narrationText,
            userVisualAction: undefined, // Force use new kinetic visual hook
          });

          sc.visualAction = entity.enrichedVisualAction;
          sc.sfxCue = entity.diegeticSfxCue || sc.sfxCue;
          sc.entityAttributes = {
            role: entity.role,
            roleLabel: entity.roleLabel,
            topicProps: entity.topicProps,
            characterStance: entity.characterStance,
            origamiEnvironment: entity.origamiEnvironment,
            actionChoreography: entity.actionChoreography,
          };
          sc.promptText = part?.promptText || sc.promptText;
        });
      });
    }

    if (queue.pendingTasks && Array.isArray(queue.pendingTasks)) {
      queue.pendingTasks.forEach((task: any) => {
        const entity = deriveTopicSceneEntity({
          contentCode: task.contentCode,
          title: task.title,
          topic: task.category,
          category: task.category,
          sceneIndex: task.sceneIndex,
          totalScenes: 3,
          narrationText: task.narrationText,
          userVisualAction: undefined, // Force use new kinetic visual hook
        });

        task.visualAction = entity.enrichedVisualAction;
        task.entityAttributes = {
          role: entity.role,
          roleLabel: entity.roleLabel,
          topicProps: entity.topicProps,
          characterStance: entity.characterStance,
          origamiEnvironment: entity.origamiEnvironment,
          actionChoreography: entity.actionChoreography,
        };
      });
    }

    fs.writeFileSync(queuePath, JSON.stringify(queue, null, 2), "utf-8");
    console.log(`Successfully enriched storage/macro/queue.json!`);
  }

  // 3. Regenerate batches via scripts/build_batches.js
  const { generateBatches } = require("./build_batches.js");
  const batches = generateBatches(3);
  console.log(`Regenerated ${batches.length} batches in pending_batches.json with rich entity attributes!`);
}

main().catch((err) => {
  console.error("Enrichment error:", err);
  process.exit(1);
});
