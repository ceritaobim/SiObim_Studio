/**
 * CeritaObim Studio — Telegram Message Formatter
 *
 * Mengonversi format teks dari AI / generator menjadi format HTML resmi
 * yang didukung oleh Telegram Bot API.
 * Menghilangkan total simbol markdown mentah (###, ####, **, ***) dan kode teknis (CO-2026-xxx)
 * sehingga tampilan di HP Telegram bersih, elegan, dan profesional.
 */

/**
 * Membersihkan kode ID teknis (seperti CO-2026-001 atau [CO-2026-012])
 * agar sesuai permintaan CEO: cukup judul saja tanpa menampilkan ID konten.
 */
export function stripContentCodes(text: string): string {
  if (!text) return "";
  return text
    .replace(/\[?CO-\d{4}-\d{3}\]?\s*[:\-–]?\s*/gi, "")
    .replace(/\bCO-\d{4}-\d{3}\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * Format teks ke HTML Telegram yang 100% valid tanpa pernah menghasilkan
 * tag tumpang tindih (cross-nesting) yang menyebabkan error "can't parse entities".
 */
export function formatTelegramHtml(text: string): string {
  if (!text) return "";

  let res = text;

  // 1. Bersihkan tag aksi internal [ACTION:...]
  res = res.replace(/\[ACTION:[A-Z_]+:?.*?\]/gi, "");

  // 2. Bersihkan kode teknis ID jika ada dalam format [CO-2026-xxx] atau CO-2026-xxx:
  res = res.replace(/\[CO-\d{4}-\d{3}\]\s*[:\-–]?\s*/gi, "");
  res = res.replace(/CO-\d{4}-\d{3}:\s*/gi, "");

  // 3. Normalisasi list bullet points TERLEBIH DAHULU sebelum parsing bold/italic
  //    Contoh: "*   **Teks:**" -> "• **Teks:**"
  res = res.replace(/^[ \t]*[*+-][ \t]+/gm, "• ");

  // 4. Konversi Markdown Headers (###, ##, #) menjadi <b>Judul</b>
  res = res.replace(/^[ \t]*#{1,6}[ \t]+(.*)$/gm, "<b>$1</b>");

  // 5. Konversi Bold: **teks** menjadi <b>teks</b>
  res = res.replace(/\*\*\*(.*?)\*\*\*/g, "<b><i>$1</i></b>");
  res = res.replace(/\*\*(.*?)\*\*/g, "<b>$1</b>");

  // 6. Konversi Italic: *teks* atau _teks_ (yang bukan di dalam kata)
  res = res.replace(/(?<=^|[\s(])\*([^*\n]+)\*(?=$|[\s),.!?])/gm, "<i>$1</i>");
  res = res.replace(/(?<=^|[\s(])_([^_\n]+)_(?=$|[\s),.!?])/gm, "<i>$1</i>");

  // 7. Konversi inline code: `code` menjadi <code>code</code>
  res = res.replace(/`([^`]+)`/g, "<code>$1</code>");

  // 8. Sanitasi tag yang tidak diizinkan oleh Telegram
  //    Daftar tag resmi Telegram: b, strong, i, em, u, ins, s, strike, del, a, code, pre, blockquote
  res = res.replace(/<(?!(?:\/?(?:b|strong|i|em|u|ins|s|strike|del|a|code|pre|blockquote)\b))/gi, "&lt;");

  // 9. Bersihkan sisa-sisa simbol markdown mentah yang lolos
  res = res.replace(/^[ \t]*#{1,6}\s*/gm, "");
  res = res.replace(/\*{2,}/g, "");

  // 10. Rapikan jarak spasi dan newline berlebih
  res = res.replace(/\n{3,}/g, "\n\n");

  return res.trim();
}

/**
 * Fallback Plain Text Cleaner: Jika pengiriman HTML tetap gagal,
 * buat teks polos yang 100% bersih tanpa simbol #, *, atau tag HTML.
 */
export function cleanToPlainText(text: string): string {
  if (!text) return "";
  return text
    .replace(/\[ACTION:[A-Z_]+:?.*?\]/gi, "")
    .replace(/<[^>]+>/g, "") // buang tag html
    .replace(/^[ \t]*#{1,6}[ \t]*/gm, "") // buang header #
    .replace(/\*{1,3}/g, "") // buang asterisks
    .replace(/_{1,2}/g, "") // buang underscore
    .replace(/`{1,3}/g, "") // buang backtick
    .replace(/\[CO-\d{4}-\d{3}\]\s*[:\-–]?\s*/gi, "")
    .replace(/CO-\d{4}-\d{3}:\s*/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
