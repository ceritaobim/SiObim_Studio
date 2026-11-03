import { describe, it, expect } from "vitest";
import { getStandardHashtags } from "@/lib/utils/hashtag-helper";
import { formatTelegramHtml, cleanToPlainText, stripContentCodes } from "@/features/telegram/telegram-formatter";

describe("Hashtag & Telegram Formatter Specifications", () => {
  it("generates exactly 3 standard hashtags per video", () => {
    // Test 1: Nasi Goreng
    const tag1 = getStandardHashtags("Rahasia Nasi Goreng Enak Harus Pakai Nasi Sisa?", "nasi goreng");
    expect(tag1).toBe("#CeritaOBIM #SiOBIM #nasigoreng");

    // Test 2: Bawang Merah
    const tag2 = getStandardHashtags("Kenapa Iris Bawang Bikin Kita Nangis?", "bawang");
    expect(tag2).toBe("#CeritaOBIM #SiOBIM #bawang");

    // Test 3: Fallback from Title
    const tag3 = getStandardHashtags("Misteri Deja Vu: Pernah Ngerasa Ini Sebelumnya?");
    expect(tag3).toBe("#CeritaOBIM #SiOBIM #dejavu");

    // Pastikan tepat 3 tanda pagar di setiap string
    expect(tag1.split("#").length - 1).toBe(3);
    expect(tag2.split("#").length - 1).toBe(3);
    expect(tag3.split("#").length - 1).toBe(3);
  });

  it("converts raw markdown headers and asterisks into clean Telegram HTML without raw symbols", () => {
    const raw = `### 📊 Analisis Stok Kita:
*   **Siap Tayang:** 19 Konten
*   **Proses Produksi:** 11 Konten

### 💡 Rekomendasi Jadwal:
1. Konsisten (1 Konten/Hari)`;

    const html = formatTelegramHtml(raw);

    // DILARANG ada simbol header mentah ###
    expect(html).not.toContain("###");
    // DILARANG ada asterisks mentah **
    expect(html).not.toContain("**");
    // List item harus menggunakan bullet •
    expect(html).toContain("• ");
    // Bold harus menggunakan tag <b>
    expect(html).toContain("<b>");
    expect(html).toContain("</b>");
  });

  it("strips technical content codes from text cleanly", () => {
    const textWithCodes = "[CO-2026-001] Rahasia Nasi Goreng Enak Harus Pakai Nasi Sisa?";
    const stripped = stripContentCodes(textWithCodes);
    expect(stripped).not.toContain("CO-2026-001");
    expect(stripped).toBe("Rahasia Nasi Goreng Enak Harus Pakai Nasi Sisa?");
  });

  it("produces pure, clean text in plain text fallback without HTML tags or markdown characters", () => {
    const raw = `### <b>Judul</b>: **Penting!** *italic* \`code\``;
    const plain = cleanToPlainText(raw);
    expect(plain).not.toContain("<");
    expect(plain).not.toContain(">");
    expect(plain).not.toContain("#");
    expect(plain).not.toContain("*");
    expect(plain).not.toContain("`");
    expect(plain).toContain("Judul: Penting! italic code");
  });
});
