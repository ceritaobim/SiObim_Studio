/**
 * CeritaObim Studio — Telegram Message Formatter
 *
 * Mengonversi format Markdown standar (seperti dari Gemini AI) menjadi
 * format HTML resmi yang didukung penuh oleh Telegram Bot API.
 * Menghilangkan simbol raw seperti '###', '####', '**', dan '*' sehingga
 * pesan tampil bersih, profesional, dan mudah dibaca di layar HP.
 */

export function formatTelegramHtml(text: string): string {
  if (!text) return "";

  let res = text;

  // 1. Bersihkan tag action seperti [ACTION:...] agar tidak terlihat oleh user
  res = res.replace(/\[ACTION:[A-Z_]+:?.*?\]/gi, "");

  // 2. Normalisasi tag Markdown Headers (###, ##, #, ####) menjadi <b>Judul</b>
  //    Contoh: "### Analisis Stok Kita:" -> "<b>Analisis Stok Kita:</b>"
  res = res.replace(/^[ \t]*#{1,6}[ \t]+(.*)$/gm, "<b>$1</b>");

  // 3. Konversi Bold: **teks** menjadi <b>teks</b>
  res = res.replace(/\*\*(.*?)\*\*/g, "<b>$1</b>");

  // 4. Konversi Italic yang menggunakan _teks_ atau *teks*
  res = res.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, "<i>$1</i>");
  res = res.replace(/(?<!_)_([^_\n]+)_(?!_)/g, "<i>$1</i>");

  // 5. Konversi Bullet point (* item atau - item) menjadi simbol bullet rapi (• item)
  res = res.replace(/^[ \t]*[*+-][ \t]+/gm, "• ");

  // 6. Konversi inline code: `code` menjadi <code>code</code>
  res = res.replace(/`([^`]+)`/g, "<code>$1</code>");

  // 7. Sanitasi tag HTML yang tidak didukung Telegram agar parser Telegram tidak crash
  //    Tag yang didukung: b, strong, i, em, u, ins, s, strike, del, a, code, pre, blockquote, tg-spoiler
  //    Ganti karakter < yang bukan bagian dari tag yang diizinkan dengan &lt;
  res = res.replace(/<(?!(?:\/?(?:b|strong|i|em|u|ins|s|strike|del|a|code|pre|blockquote|tg-spoiler)\b))/gi, "&lt;");
  //    Ganti karakter > yang berdiri sendiri dengan &gt;
  res = res.replace(/(?<!(?:<|\/)(?:b|strong|i|em|u|ins|s|strike|del|a|code|pre|blockquote|tg-spoiler)[^>]*)>(?![^<]*>)/gi, "&gt;");

  // 8. Rapikan newline ganda berlebihan
  res = res.replace(/\n{3,}/g, "\n\n");

  return res.trim();
}
