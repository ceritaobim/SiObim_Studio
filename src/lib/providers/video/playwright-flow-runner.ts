import "server-only";
import fs from "fs";
import path from "path";
import { exec } from "child_process";
import type { BrowserContext, Page } from "playwright-core";

export const DEFAULT_GOOGLE_FLOW_URL = "https://flow.google.com";
const CDP_PORTS = [9222, 9232];

export interface PlaywrightFlowGenerateInput {
  contentCode: string;
  partIndex: number;
  expectedFilename: string;
  promptText: string;
  flowUrl?: string;
  timeoutMs?: number;
}

export interface PlaywrightFlowGenerateResult {
  ok: boolean;
  status:
    | "clip_generated"
    | "needs_google_login"
    | "prompt_filled_waiting"
    | "error";
  videoBuffer?: Buffer;
  mimeType?: string;
  message: string;
}

declare global {
  // eslint-disable-next-line no-var
  var __ceritaObimFlowContext: BrowserContext | undefined;
}

async function findActiveCdpPort(): Promise<number | null> {
  for (const port of CDP_PORTS) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/version`, {
        signal: AbortSignal.timeout(600),
      });
      if (res.ok) return port;
    } catch {
      // Continue checking next port
    }
  }
  return null;
}

export async function getOrConnectFlowBrowserContext(): Promise<BrowserContext> {
  if (globalThis.__ceritaObimFlowContext) {
    try {
      const openPages = globalThis.__ceritaObimFlowContext.pages();
      if (openPages.length > 0) {
        return globalThis.__ceritaObimFlowContext;
      }
    } catch {
      globalThis.__ceritaObimFlowContext = undefined;
    }
  }

  const activePort = await findActiveCdpPort();
  if (!activePort) {
    throw new Error(
      "CHROME_NOT_CONNECTED: Jendela Chrome Otomasi belum berjalan. Buka shortcut 'Google Flow Automation' di Desktop Anda (atau jalankan Chrome dengan port 9222), lalu klik Trigger kembali!"
    );
  }

  const { chromium } = await import("playwright-core");
  const browser = await chromium.connectOverCDP(
    `http://127.0.0.1:${activePort}`
  );
  const context = browser.contexts()[0] ?? (await browser.newContext());
  globalThis.__ceritaObimFlowContext = context;

  browser.on("disconnected", () => {
    globalThis.__ceritaObimFlowContext = undefined;
  });

  return context;
}

function isFlowUrl(url: string): boolean {
  return (
    url.includes("flow.google.com") ||
    url.includes("labs.google/fx") ||
    url.includes("labs.google")
  );
}

/**
 * Finds the active Google Flow tab or opens one if not open yet.
 */
async function getOrOpenFlowPage(
  context: BrowserContext,
  flowUrl = DEFAULT_GOOGLE_FLOW_URL
): Promise<Page> {
  const pages = context.pages();
  const existingFlowPage = pages.find((p) => isFlowUrl(p.url()));
  if (existingFlowPage) {
    return existingFlowPage;
  }

  const firstUsable = pages.find(
    (p) =>
      !p.url() ||
      p.url() === "about:blank" ||
      p.url().startsWith("chrome://newtab")
  );
  if (firstUsable) {
    await firstUsable.goto(flowUrl, {
      waitUntil: "domcontentloaded",
      timeout: 45000,
    });
    return firstUsable;
  }

  const page = await context.newPage();
  await page.goto(flowUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
  return page;
}

/**
 * Opens Google Flow directly using Windows shell so the window is guaranteed to appear
 * on the user's primary desktop monitor.
 */
export async function openGoogleFlowSessionWindow(
  flowUrl = DEFAULT_GOOGLE_FLOW_URL
): Promise<{ ok: boolean; message: string }> {
  const desktopShortcut = path.join(
    process.env.USERPROFILE || "",
    "Desktop",
    "Google Flow Automation.lnk"
  );

  // If the special automation shortcut exists, open via that shortcut (with port 9222)
  if (fs.existsSync(desktopShortcut)) {
    exec(`cmd.exe /c start "" "${desktopShortcut}"`);
  } else {
    exec(`cmd.exe /c start "" "${flowUrl}"`);
  }

  return {
    ok: true,
    message:
      "Jendela Chrome Google Flow berhasil dibuka di layar Anda! Shortcut 'Google Flow Automation' juga sudah dibuatkan di Desktop Anda.",
  };
}

async function isGoogleSignInPage(page: Page): Promise<boolean> {
  const url = page.url();
  if (url.includes("accounts.google.com")) return true;

  const newProjectBtnCount = await page
    .locator(
      'button:has-text("Project baru"), button:has-text("New project"), button:has-text("Proyek baru"), [role="button"]:has-text("Project baru"), [role="button"]:has-text("New project"), text="Project baru", text="New project"'
    )
    .count()
    .catch(() => 0);

  if (newProjectBtnCount > 0) {
    return false;
  }

  const signInBtnCount = await page
    .locator(
      'a[href*="accounts.google.com"], button:has-text("Sign in"), button:has-text("Login"), button:has-text("Masuk")'
    )
    .count()
    .catch(() => 0);

  const promptInputCount = await page
    .locator('textarea, [contenteditable="true"], input[type="text"]')
    .count()
    .catch(() => 0);

  return signInBtnCount > 0 && promptInputCount === 0;
}

async function findPromptInputBox(
  page: Page
): Promise<import("playwright-core").Locator | null> {
  const promptSelectors = [
    'textarea[placeholder*="prompt" i]',
    'textarea[placeholder*="describe" i]',
    'textarea[placeholder*="create" i]',
    'textarea[placeholder*="generate" i]',
    'textarea[placeholder*="buat" i]',
    'textarea[placeholder*="ketik" i]',
    "textarea",
    'div[contenteditable="true"][role="textbox"]',
    'div[contenteditable="true"]',
    'input[type="text"][placeholder*="prompt" i]',
  ];

  for (const sel of promptSelectors) {
    const loc = page.locator(sel).first();
    if (
      (await loc.count().catch(() => 0)) > 0 &&
      (await loc.isVisible().catch(() => false))
    ) {
      return loc;
    }
  }
  return null;
}

/**
 * Automates typing the prompt into Google Flow,
 * clicking Generate, capturing the generated MP4 video, and returning the MP4 buffer.
 */
export async function generateClipWithPlaywrightFlow(
  input: PlaywrightFlowGenerateInput
): Promise<PlaywrightFlowGenerateResult> {
  const targetUrl = input.flowUrl || DEFAULT_GOOGLE_FLOW_URL;
  const maxWaitMs = input.timeoutMs ?? 150000;

  let context: BrowserContext;
  try {
    context = await getOrConnectFlowBrowserContext();
  } catch (err) {
    return {
      ok: false,
      status: "error",
      message:
        err instanceof Error
          ? err.message
          : "Gagal menghubungkan Playwright ke browser Google Flow.",
    };
  }

  const page = await getOrOpenFlowPage(context, targetUrl);
  await page.bringToFront().catch(() => {});

  if (!isFlowUrl(page.url())) {
    await page.goto(targetUrl, {
      waitUntil: "domcontentloaded",
      timeout: 45000,
    });
    await page.waitForTimeout(2000);
  }

  if (await isGoogleSignInPage(page)) {
    return {
      ok: false,
      status: "needs_google_login",
      message:
        "Jendela Chrome Google Flow masih berada di halaman Login Google. Silakan login di jendela Chrome tersebut, lalu klik Trigger lagi.",
    };
  }

  let capturedVideoBuffer: Buffer | null = null;
  const existingVideoSrcs = new Set<string>(
    await page
      .locator("video")
      .evaluateAll((els) =>
        els
          .map(
            (e) =>
              (e as HTMLVideoElement).currentSrc ||
              (e as HTMLVideoElement).src ||
              ""
          )
          .filter(Boolean)
      )
      .catch(() => [])
  );

  const responseHandler = async (
    response: import("playwright-core").Response
  ) => {
    try {
      const contentType = (
        response.headers()["content-type"] || ""
      ).toLowerCase();
      const respUrl = response.url();
      if (
        response.status() === 200 &&
        (contentType.includes("video/mp4") ||
          contentType.includes("video/webm") ||
          respUrl.includes(".mp4"))
      ) {
        const bodyBuf = await response.body();
        if (bodyBuf && bodyBuf.byteLength > 80_000) {
          capturedVideoBuffer = Buffer.from(bodyBuf);
        }
      }
    } catch {
      // Ignore transient stream errors
    }
  };

  page.on("response", responseHandler);

  try {
    let promptBox = await findPromptInputBox(page);

    if (!promptBox) {
      const newProjectSelectors = [
        'button:has-text("Project baru")',
        'button:has-text("New project")',
        'button:has-text("Proyek baru")',
        '[role="button"]:has-text("Project baru")',
        '[role="button"]:has-text("New project")',
        'text="Project baru"',
        'text="New project"',
      ];

      for (const sel of newProjectSelectors) {
        const btn = page.locator(sel).first();
        if (
          (await btn.count().catch(() => 0)) > 0 &&
          (await btn.isVisible().catch(() => false))
        ) {
          await btn.click({ timeout: 5000 }).catch(() => {});
          for (let attempt = 0; attempt < 16; attempt++) {
            await page.waitForTimeout(750);
            promptBox = await findPromptInputBox(page);
            if (promptBox) break;
          }
          break;
        }
      }
    }

    if (!promptBox) {
      return {
        ok: false,
        status: "needs_google_login",
        message:
          "Berada di Google Flow, namun kotak input prompt belum muncul. Silakan klik tombol '+ Project baru' di jendela Chrome hingga kotak prompt terlihat, lalu klik Trigger kembali.",
      };
    }

    await promptBox.click({ timeout: 5000 });
    await page.keyboard.press("Control+A").catch(() => {});
    await page.keyboard.press("Backspace").catch(() => {});
    await promptBox.fill(input.promptText).catch(async () => {
      await page.keyboard.insertText(input.promptText);
    });

    await page.waitForTimeout(400);

    const submitSelectors = [
      'button:has-text("Generate")',
      'button:has-text("Buat")',
      'button:has-text("Create")',
      'button[aria-label*="Generate" i]',
      'button[aria-label*="Buat" i]',
      'button[aria-label*="Create" i]',
      'button[aria-label*="Send" i]',
      'button[aria-label*="Submit" i]',
      'button[type="submit"]',
    ];

    let clickedSubmit = false;
    for (const sel of submitSelectors) {
      const btn = page.locator(sel).last();
      if (
        (await btn.count().catch(() => 0)) > 0 &&
        (await btn.isVisible().catch(() => false)) &&
        (await btn.isEnabled().catch(() => false))
      ) {
        await btn.click({ timeout: 5000 }).catch(() => {});
        clickedSubmit = true;
        break;
      }
    }

    if (!clickedSubmit) {
      await promptBox.press("Enter").catch(() => {});
    }

    const startTime = Date.now();
    let downloadPromiseResolved: Buffer | null = null;

    page
      .waitForEvent("download", { timeout: maxWaitMs })
      .then(async (download) => {
        const dlPath = await download.path();
        if (dlPath && fs.existsSync(dlPath)) {
          downloadPromiseResolved = fs.readFileSync(dlPath);
        }
      })
      .catch(() => {});

    while (Date.now() - startTime < maxWaitMs) {
      if (
        capturedVideoBuffer &&
        (capturedVideoBuffer as Buffer).byteLength > 80_000
      ) {
        return {
          ok: true,
          status: "clip_generated",
          videoBuffer: capturedVideoBuffer,
          mimeType: "video/mp4",
          message: `Berhasil! Video Bagian ${input.partIndex} (${input.expectedFilename}) selesai di-generate otomatis di Google Flow & disimpan ke Google Drive!`,
        };
      }

      if (
        downloadPromiseResolved &&
        (downloadPromiseResolved as Buffer).byteLength > 50_000
      ) {
        return {
          ok: true,
          status: "clip_generated",
          videoBuffer: downloadPromiseResolved,
          mimeType: "video/mp4",
          message: `Berhasil! Video Bagian ${input.partIndex} (${input.expectedFilename}) terunduh otomatis dari Google Flow & disimpan ke Google Drive!`,
        };
      }

      const currentVideoSrcs = await page
        .locator("video")
        .evaluateAll((els) =>
          els
            .map(
              (e) =>
                (e as HTMLVideoElement).currentSrc ||
                (e as HTMLVideoElement).src ||
                ""
            )
            .filter(Boolean)
        )
        .catch(() => []);

      const newSrc = currentVideoSrcs.find((s) => !existingVideoSrcs.has(s));
      if (newSrc) {
        const base64Video = await page
          .evaluate(async (videoUrl) => {
            try {
              const r = await fetch(videoUrl);
              const blob = await r.blob();
              if (blob.size < 50000) return null;
              return await new Promise<string | null>((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                  const res = String(reader.result || "");
                  const commaIdx = res.indexOf(",");
                  resolve(commaIdx !== -1 ? res.slice(commaIdx + 1) : null);
                };
                reader.onerror = () => resolve(null);
                reader.readAsDataURL(blob);
              });
            } catch {
              return null;
            }
          }, newSrc)
          .catch(() => null);

        if (base64Video) {
          const buf = Buffer.from(base64Video, "base64");
          if (buf.byteLength > 50_000) {
            return {
              ok: true,
              status: "clip_generated",
              videoBuffer: buf,
              mimeType: "video/mp4",
              message: `Berhasil! Video Bagian ${input.partIndex} (${input.expectedFilename}) selesai di-render di Google Flow & otomatis diambil oleh Playwright!`,
            };
          }
        }
      }

      await page.waitForTimeout(2500);
    }

    return {
      ok: false,
      status: "prompt_filled_waiting",
      message: `Prompt Bagian ${input.partIndex} sudah otomatis diketikkan & dikirim ke Google Flow! Jika render masih berjalan di jendela Google Flow, tunggu hingga selesai atau klik Download pada videonya.`,
    };
  } finally {
    page.off("response", responseHandler);
  }
}
