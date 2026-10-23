import crypto from "crypto";
import type {
  ContentItemRecord,
  ProjectSettingsSummary,
  VerificationStatus,
} from "@/types/domain";
import {
  LLMContentPlanOutputSchema,
  LLMGeneratedProposalSchema,
  type LLMGeneratedProposal,
} from "@/lib/validation/schemas";

export interface ContentPlanInput {
  settings: ProjectSettingsSummary;
  existingItems: Pick<
    ContentItemRecord,
    "contentCode" | "title" | "topic" | "category"
  >[];
  targetVideoCount: number;
  targetWeekStart: string;
  customThemeHint?: string;
}

export interface ContentPlanResult {
  providerKey: string;
  providerModel: string;
  providerRequestId: string;
  estimatedCostUsd: number;
  proposals: LLMGeneratedProposal[];
}

export interface LLMProvider {
  readonly providerKey: string;
  readonly modelName: string;
  generateContentPlan(input: ContentPlanInput): Promise<ContentPlanResult>;
  regenerateSingleProposal(
    input: ContentPlanInput & { rejectedTitle?: string }
  ): Promise<{
    providerKey: string;
    providerModel: string;
    providerRequestId: string;
    proposal: LLMGeneratedProposal;
  }>;
}

const CURATED_FACT_POOL: LLMGeneratedProposal[] = [
  {
    title: "Kenapa Habis Makan Siang Malah Ngantuk Berat? Ini Penyebabnya",
    category: "Kesehatan & Kebiasaan",
    topic: "Fenomena postprandial somnolence (food coma), lonjakan insulin, dan hormon serotonin-melatonin setelah makan siang",
    hook: "Niatnya makan siang biar punya tenaga buat lanjut kerja, tapi lima belas menit kemudian mata malah berat banget.",
    narration:
      "0-10:\nNiatnya makan siang biar punya tenaga buat lanjut kerja, tapi lima belas menit kemudian mata lo malah berat banget. Padahal semalem tidur lo cukup.\n\n11-20:\nKondisi ini punya nama medis, yaitu postprandial somnolence, atau yang sering kita sebut food coma. Dan ini bukan karena lo pemalas.\n\n21-30:\nSaat lo makan besar—apalagi yang tinggi karbohidrat kayak nasi padang atau mie—tubuh lo langsung memproduksi hormon insulin buat menyerap gula darah.\n\n31-40:\nProses ini memicu asam amino bernama triptofan masuk lebih banyak ke otak. Di dalam otak, triptofan diubah jadi serotonin lalu jadi melatonin, hormon pengatur rasa kantuk.\n\n41-50:\nSelain itu, sistem saraf parasimpatis lo aktif untuk fokus mencerna makanan, memberi sinyal ke tubuh buat istirahat sejenak dan menurunkan kewaspadaan.\n\n51-60:\nApalagi kalau jam makan siang ketemu sama penurunan ritme sirkadian alami tubuh di jam satu sampai jam tiga sore. Kantuknya jadi dobel.\n\n61-70:\nBiar nggak tumbang habis makan siang, kurangi porsi karbo berlebih, tambah protein dan serat, terus jalan kaki ringan lima menit habis makan.\n\n71-90:\nJadi kalau siang ini lo nguap terus di depan layar, itu biokimia tubuh lo lagi kerja keras. Makanan apa yang paling bikin lo auto ngantuk? Tulis di komentar!",
    cta: "Makanan apa yang paling bikin lo auto ngantuk habis makan siang? Tulis di komentar!",
    tiktokCaption:
      "Habis makan siang bukannya seger malah ngantuk berat? Kenalan sama fenomena Food Coma! #ceritaobim #faktaunik #kesehatan #anakmuda #origamistopmotion",
    youtubeDescription:
      "Penjelasan ilmiah tentang postprandial somnolence (food coma) setelah makan siang dan cara mengatasinya. Visual stop-motion origami kertas lipat.",
    instagramCaption:
      "Kenapa habis makan siang mata langsung 5 watt? Ini penjelasan ilmiah di balik Food Coma! #ceritaobim #edukasi #faktaunik",
    targetDurationSeconds: 80,
    factualClaims: [
      "Postprandial somnolence dipicu oleh lonjakan insulin yang memudahkan triptofan masuk ke otak dan membentuk serotonin serta melatonin.",
      "Ritme sirkadian manusia secara alami mengalami penurunan kewaspadaan pada pukul 13.00–15.00 siang.",
    ],
    sourceUrls: [
      "https://my.clevelandclinic.org/health/diseases/food-coma-postprandial-somnolence",
    ],
    verificationStatus: "verified",
  },
  {
    title: "Kenapa Rebahan Seharian di Kasur Malah Bikin Badan Makin Capek?",
    category: "Psikologi & Tubuh",
    topic: "Perbedaan istirahat pasif vs aktif, kekakuan otot, dan gangguan ritme sirkadian saat rebahan seharian",
    hook: "Udah balas dendam rebahan seharian pas weekend, tapi pas bangun badan malah pegel dan kepala pusing.",
    narration:
      "0-10:\nUdah niat balas dendam rebahan seharian di kasur pas libur, tapi sorenya badan lo malah makin pegel dan kepala terasa berat. Kok bisa istirahat malah bikin capek?\n\n11-20:\nDalam psikologi dan fisiologi, rebahan sambil scroll HP berjam-jam itu bukan istirahat yang memulihkan energi, melainkan sedentari pasif berlebih.\n\n21-30:\nSaat lo berbaring terlalu lama tanpa gerak, sirkulasi darah melambat dan suplai oksigen ke jaringan otot ikut menurun. Otot bukannya rileks, malah jadi kaku.\n\n31-40:\nDi saat yang sama, kalau mata lo terus-menerus menatap layar HP, otak lo tetap bekerja memproses ribuan informasi visual dan emosional tanpa henti.\n\n41-50:\nArtinya, fisik lo diam total, tapi otak lo kelelahan kognitif. Ketidakseimbangan inilah yang bikin muncul rasa lemas yang aneh saat lo berdiri.\n\n51-60:\nDitambah lagi, kurang kena cahaya matahari pagi di dalam kamar bikin jam biologis tubuh bingung membedakan waktu aktif dan waktu tidur.\n\n61-70:\nTubuh manusia dirancang buat pulih lewat active recovery—seperti jalan santai, peregangan ringan, atau ngobrol tanpa layar.\n\n71-90:\nJadi kalau lo capek setelah seminggu kerja, tidur cukup tetap perlu, tapi jangan dikurung di kasur seharian. Weekend kemarin lo tim rebahan atau keluar rumah?",
    cta: "Weekend kemarin lo tim rebahan seharian atau jalan keluar? Ceritain di komentar!",
    tiktokCaption:
      "Niatnya istirahat rebahan seharian, kok malah makin remuk badannya? Ini alasannya! #ceritaobim #psikologi #kesehatan #relatable #origamistopmotion",
    youtubeDescription:
      "Mengapa berbaring seharian sambil bermain HP justru memicu kelelahan otot dan kelelahan kognitif.",
    instagramCaption:
      "Rebahan seharian tapi malah makin capek? Ternyata otakmu belum istirahat! #ceritaobim #faktaunik #anakmuda",
    targetDurationSeconds: 80,
    factualClaims: [
      "Berbaring terlalu lama menurunkan sirkulasi darah perifer dan memicu kekakuan otot.",
      "Konsumsi layar berlebih saat berbaring menyebabkan kelelahan kognitif meskipun tubuh tidak bergerak.",
    ],
    sourceUrls: [
      "https://www.health.harvard.edu/Staying-healthy/the-dangers-of-sitting",
    ],
    verificationStatus: "verified",
  },
  {
    title: "Kenapa Dengerin Lagu Sedih Pas Lagi Galau Malah Bikin Tenang?",
    category: "Psikologi Musik",
    topic: "Efek katarsis emosional dan pelepasan hormon prolaktin serta oksitosin saat mendengar musik melankolis",
    hook: "Aneh nggak sih, lagi sedih bukannya muter lagu ceria, kita malah sengaja nyari playlist paling galau.",
    narration:
      "0-10:\nAneh nggak sih, pas hati lagi capek atau sedih, bukannya muter lagu yang ceria, tangan lo malah otomatis nyari playlist paling galau.\n\n11-20:\nSekilas kelihatan kayak nyiksa diri sendiri. Tapi menurut riset psikologi musik, otak lo sebenarnya lagi melakukan mekanisme penyembuhan alami.\n\n21-30:\nSaat lo mendengar lagu sedih yang indah, otak menganggap kesedihan dalam lagu itu sebagai empati tanpa ancaman nyata.\n\n31-40:\nKondisi ini memicu pelepasan hormon prolaktin dan oksitosin—hormon yang sama yang muncul saat seseorang dipeluk atau ditenangkan.\n\n41-50:\nSelain itu, lagu sedih membantu proses katarsis. Emosi yang tadinya numpuk dan susah dijelasin pakai kata-kata akhirnya punya saluran buat keluar.\n\n51-60:\nLo jadi ngerasa dimengerti tanpa harus dihakimi. Otak lo sadar kalau perasaan sedih itu valid dan lo nggak sendirian.\n\n61-70:\nBedanya tipis: selama lagu itu bikin lo lega setelahnya, itu sehat. Tapi kalau lagunya memicu ingatan buruk berulang-ulang, saatnya ganti suasana.\n\n71-90:\nJadi nggak apa-apa kalau malam ini lo butuh satu-dua lagu pelan buat nenangin pikiran. Lagu apa yang paling sering nemenin lo pas lagi capek?",
    cta: "Lagu apa yang paling sering nemenin lo pas lagi capek? Tulis di komentar!",
    tiktokCaption:
      "Kenapa lagu galau malah bikin hati tenang? Ini penjelasan psikologinya! #ceritaobim #psikologi #musik #relatable #origamistopmotion",
    youtubeDescription:
      "Penjelasan ilmiah tentang efek katarsis dan hormon prolaktin saat mendengarkan musik melankolis.",
    instagramCaption:
      "Ternyata dengerin lagu sedih pas lagi capek itu cara otak memeluk diri sendiri. #ceritaobim #psikologi #faktaunik",
    targetDurationSeconds: 80,
    factualClaims: [
      "Studi psikologi musik menunjukkan musik sedih dapat memicu katarsis emosional dan perasaan terhubung secara empatik.",
    ],
    sourceUrls: [
      "https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0110490",
    ],
    verificationStatus: "verified",
  },
  {
    title: "Kenapa Kita Sering Lupa Mau Ngapain Pas Baru Masuk Ruangan?",
    category: "Sains Otak",
    topic: "Fenomena Doorway Effect pada memori kerja (working memory) saat berpindah ruang",
    hook: "Pernah jalan ke dapur dengan penuh yakin, tapi begitu lewat pintu langsung bengong: tadi gue mau ngambil apa ya?",
    narration:
      "0-10:\nPernah nggak lo jalan ke ruangan sebelah dengan penuh yakin, tapi begitu ngelewatin pintu lo langsung bengong: tadi gue ke sini mau ngapain ya?\n\n11-20:\nTenang, lo belum pikun. Dalam ilmu kognitif, kejadian nyebelin ini dikenal dengan nama The Doorway Effect atau Efek Ambang Pintu.\n\n21-30:\nOtak manusia menyimpan rencana jangka pendek di memori kerja yang kapasitasnya terbatas banget, mirip RAM di HP lo.\n\n31-40:\nSaat lo melewati pintu dan masuk ke ruangan baru, otak menganggap pintu itu sebagai batas pergantian bab atau event boundary.\n\n41-50:\nSupaya lo siap menghadapi lingkungan di ruangan yang baru, otak otomatis mengarsipkan dan membersihkan catatan dari ruangan sebelumnya.\n\n51-60:\nAkibatnya, niat awal lo yang tadi disimpan di urutan paling atas tiba-tiba ikut terhapus dari layar utama pikiran lo.\n\n61-70:\nUniknya, begitu lo balik lagi ke ruangan awal, konteks visual di sana sering langsung memancing ingatan itu muncul kembali.\n\n71-90:\nTriknya simpel: sambil jalan melewati pintu, ucapkan tujuan lo pelan-pelan atau bayangkan benda yang mau diambil. Seberapa sering lo kena Doorway Effect ini?",
    cta: "Seberapa sering lo bengong lupa tujuan pas baru buka pintu atau buka HP? Komen di bawah!",
    tiktokCaption:
      "Masuk kamar langsung lupa tadi mau ngambil apa? Kenalan sama Doorway Effect! #ceritaobim #sainsotak #psikologi #relatable #origamistopmotion",
    youtubeDescription:
      "Mengapa melewati pintu sering membuat kita lupa tujuan awal menurut penelitian psikologi kognitif (Doorway Effect).",
    instagramCaption:
      "Bukan pikun! Ini alasan ilmiah kenapa kita sering lupa mau ngapain pas baru pindah ruangan. #ceritaobim #faktaunik",
    targetDurationSeconds: 80,
    factualClaims: [
      "Peneliti dari University of Notre Dame menemukan bahwa melewati pintu bertindak sebagai event boundary yang memperbarui memori kerja.",
    ],
    sourceUrls: [
      "https://news.nd.edu/news/walking-through-doorways-causes-forgetting-new-research-shows/",
    ],
    verificationStatus: "verified",
  },
  {
    title: "Kenapa Belanja Pakai QRIS & Paylater Terasa Nggak Keluar Uang?",
    category: "Psikologi Keuangan",
    topic: "Berkurangnya pain of paying (rasa sakit saat membayar) pada transaksi digital nirsentuh",
    hook: "Bayar lima puluh ribu pakai uang tunai rasanya berat banget, tapi pas scan QRIS kok kayak nggak berasa apa-apa?",
    narration:
      "0-10:\nNgaku deh, ngeluarin uang kertas lima puluh ribu dari dompet rasanya berat banget, tapi pas scan QRIS jumlah yang sama kok enteng banget?\n\n11-20:\nTahunya pas akhir bulan liat mutasi rekening langsung lemes. Dalam ekonomi perilaku, fenomena ini berhubungan sama yang namanya Pain of Paying.\n\n21-30:\nSaat lo bayar pakai uang fisik, otak melihat langsung lembaran uang berpindah tangan dan dompet yang menipis. Ada sinyal kehilangan yang nyata di otak.\n\n31-40:\nRasa nggak nyaman itulah yang sebenarnya jadi rem alami supaya kita mikir dua kali sebelum beli barang yang nggak perlu.\n\n41-50:\nMasalahnya, pembayaran digital bikin proses transaksi jadi terlalu mulus—cuma scan, bunyi bip, selesai dalam dua detik.\n\n51-60:\nKarena nggak ada wujud fisik yang hilang di depan mata, rem alami di bagian insula otak kita jadi nggak aktif. Otak cuma ngerasa dapat barangnya tanpa rasa kehilangan.\n\n61-70:\nBiar saldo nggak bocor halus, pasang batas maksimal harian di aplikasi atau catat pengeluaran harian setiap malam.\n\n71-90:\nKemudahan teknologi memang membantu, asal rem kesadaran kita nggak ikut blong. Lo lebih sering bocor gara-gara jajan kopi atau checkout tengah malam?",
    cta: "Lo lebih sering bocor halus gara-gara scan QRIS jajan atau checkout tengah malam? Tulis di komentar!",
    tiktokCaption:
      "Kenapa scan QRIS berasa gratis sampai liat saldo akhir bulan? Ini psikologi Pain of Paying! #ceritaobim #psikologikeuangan #anakmuda #relatable",
    youtubeDescription:
      "Penjelasan ekonomi perilaku tentang menurunnya Pain of Paying saat menggunakan pembayaran digital QRIS atau kartu.",
    instagramCaption:
      "Scan, bip, tau-tau saldo tipis! Begini cara kerja Pain of Paying di otak kita. #ceritaobim #keuangan #psikologi",
    targetDurationSeconds: 80,
    factualClaims: [
      "Konsep pain of paying dalam ekonomi perilaku menjelaskan bahwa metode pembayaran non-tunai mengurangi friksi psikologis saat berbelanja.",
    ],
    sourceUrls: [
      "https://mitsloan.mit.edu/Ideas-made-to-matter/credit-cards-activate-reward-center-brain",
    ],
    verificationStatus: "verified",
  },
  {
    title: "Kenapa Ide Paling Brilian Justru Muncul Pas Lagi Mandi atau di Kamar Mandi?",
    category: "Sains Otak & Kreativitas",
    topic: "Aktifnya Default Mode Network (DMN) dan pelepasan dopamin saat melakukan aktivitas rutin di kamar mandi",
    hook: "Dicariin ide berjam-jam di depan laptop buntu, eh pas lagi keramas di kamar mandi solusinya malah muncul sendiri.",
    narration:
      "0-10:\nDicariin ide berjam-jam di depan laptop rasanya buntu banget, eh giliran lagi guyur air di kamar mandi, solusinya malah muncul tiba-tiba.\n\n11-20:\nKenapa kamar mandi kayak punya sinyal Wi-Fi khusus buat ide cemerlang? Jawabannya ada pada jaringan otak yang disebut Default Mode Network.\n\n21-30:\nSaat lo maksa fokus di depan meja kerja, bagian otak eksekutif lo tegang dan menyaring pikiran secara kaku, sehingga ide kreatif susah nyambung.\n\n31-40:\nSebaliknya, mandi adalah aktivitas rutin yang kita lakukan secara autopilot tanpa perlu mikir keras.\n\n41-50:\nDi momen santai ditambah air hangat yang nyaman, otak melepaskan dopamin dan mengaktifkan Default Mode Network—mode melamun produktif.\n\n51-60:\nDalam mode ini, bagian-bagian otak yang tadinya jarang ngobrol tiba-tiba saling terhubung bebas dan menyusun potongan masalah yang tadinya buntu.\n\n61-70:\nItulah kenapa banyak penemuan dan solusi hidup justru lahir saat kita berhenti memaksa otak bekerja tegang.\n\n71-90:\nJadi kalau lo lagi mentok ngerjain sesuatu, berhentilah sebentar dan biarkan kepala lo rileks. Ide paling random apa yang pernah muncul pas lo lagi mandi?",
    cta: "Ide paling random apa yang pernah muncul di kepala lo pas lagi di kamar mandi? Komen di bawah!",
    tiktokCaption:
      "Kenapa kamar mandi selalu jadi tempat munculnya ide paling brilian? Ini penjelasan sains otaknya! #ceritaobim #faktaotak #psikologi #origamistopmotion",
    youtubeDescription:
      "Peran Default Mode Network (DMN) dan dopamin yang membuat ide kreatif muncul saat mandi atau berjalan santai.",
    instagramCaption:
      "Depan laptop buntu, masuk kamar mandi langsung dapat solusi! Ini cara kerja Default Mode Network di otakmu. #ceritaobim #faktaunik",
    targetDurationSeconds: 80,
    factualClaims: [
      "Default Mode Network (DMN) di otak aktif saat seseorang melakukan aktivitas rutin ringan, memfasilitasi asosiasi ide kreatif.",
    ],
    sourceUrls: [
      "https://www.nationalgeographic.com/science/article/shower-thoughts-science-creativity-brain",
    ],
    verificationStatus: "verified",
  },
  {
    title: "Kenapa Kita Suka Nunda Tidur Padahal Badan Udah Ngantuk Berat?",
    category: "Psikologi Kebiasaan",
    topic: "Fenomena Revenge Bedtime Procrastination sebagai kompensasi hilangnya waktu bebas di siang hari",
    hook: "Mata udah perih dan besok harus bangun pagi, tapi jempol tetap nolak matiin layar HP sampai jam satu malam.",
    narration:
      "0-10:\nMata lo udah perih, badan udah capek, dan besok harus bangun pagi. Tapi entah kenapa jempol lo tetap nolak matiin HP sampai lewat tengah malam.\n\n11-20:\nDalam psikologi modern, kebiasaan ini punya istilah khusus: Revenge Bedtime Procrastination, alias balas dendam menunda waktu tidur.\n\n21-30:\nIni terjadi bukan karena lo nggak bisa tidur, tapi karena sepanjang pagi sampai sore hidup lo rasanya dikendalikan penuh oleh tugas dan tuntutan orang lain.\n\n31-40:\nBegitu malam tiba dan suasana sepi, otak bawah sadar lo merasa akhirnya punya waktu yang seratus persen milik lo sendiri.\n\n41-50:\nTidur cepat rasanya kayak menyerahkan sisa kebebasan itu dan langsung lompat ke hari kerja besok pagi.\n\n51-60:\nSayangnya, balas dendam ini bikin lo terjebak lingkaran setan: besoknya lo bangun makin lelah, makin stres di siang hari, lalu malamnya balas dendam lagi.\n\n61-70:\nSolusinya bukan cuma maksa merem, tapi sisihkan minimal tiga puluh menit waktu bebas murni buat diri sendiri di sore atau awal malam.\n\n71-90:\nBegitu otak merasa sudah punya me-time yang cukup, ia lebih rela diajak istirahat tepat waktu. Jam berapa lo biasanya baru beneran taruh HP malam-malam?",
    cta: "Jam berapa lo biasanya baru beneran taruh HP pas malam? Ngaku di komentar!",
    tiktokCaption:
      "Ngantuk berat tapi sayang banget kalau langsung tidur? Itu namanya Revenge Bedtime Procrastination! #ceritaobim #psikologi #begadang #relatable",
    youtubeDescription:
      "Penjelasan psikologi di balik Revenge Bedtime Procrastination dan cara menghentikan kebiasaan menunda tidur.",
    instagramCaption:
      "Kenapa kita rela ngorbanin jam tidur demi scroll HP tengah malam? Ini penjelasan psikologinya! #ceritaobim #faktaunik #anakmuda",
    targetDurationSeconds: 80,
    factualClaims: [
      "Revenge bedtime procrastination adalah keputusan menunda tidur tanpa alasan eksternal demi mendapatkan kembali rasa kendali atas waktu pribadi.",
    ],
    sourceUrls: [
      "https://www.sleepfoundation.org/sleep-hygiene/revenge-bedtime-procrastination",
    ],
    verificationStatus: "verified",
  },
];

/**
 * Enforces the PRD verification rule:
 * Any proposal with missing/empty `sourceUrls` or empty `factualClaims`
 * MUST be marked `needs_verification` (never `verified`).
 */
export function sanitizeProposalVerification(
  proposal: LLMGeneratedProposal
): LLMGeneratedProposal {
  const validUrls = (proposal.sourceUrls ?? []).filter((u) => {
    try {
      const parsed = new URL(u);
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
      return false;
    }
  });

  const verificationStatus: VerificationStatus =
    validUrls.length === 0 || proposal.factualClaims.length === 0
      ? "needs_verification"
      : proposal.verificationStatus === "verified"
      ? "verified"
      : "needs_verification";

  return {
    ...proposal,
    sourceUrls: validUrls,
    verificationStatus,
  };
}

/**
 * Validates and repairs raw LLM JSON output against `LLMContentPlanOutputSchema`.
 * Rejects completely malformed output with a clear error message.
 */
export function validateAndSanitizeLLMPlanOutput(
  rawJson: unknown
): LLMGeneratedProposal[] {
  const parsed = LLMContentPlanOutputSchema.safeParse(rawJson);
  if (parsed.success) {
    return parsed.data.proposals.map(sanitizeProposalVerification);
  }

  // Attempt safe repair if rawJson has a `proposals` array where some fields need defaults/trimming
  if (
    rawJson &&
    typeof rawJson === "object" &&
    Array.isArray((rawJson as { proposals?: unknown[] }).proposals)
  ) {
    const rawArr = (rawJson as { proposals: unknown[] }).proposals;
    const repaired: LLMGeneratedProposal[] = [];

    for (const candidate of rawArr) {
      if (!candidate || typeof candidate !== "object") continue;
      const obj = candidate as Record<string, unknown>;
      const validUrls = Array.isArray(obj.sourceUrls)
        ? obj.sourceUrls
            .map((u) => String(u).trim())
            .filter((u) => /^https?:\/\/\S+$/i.test(u))
        : [];

      const singleParsed = LLMGeneratedProposalSchema.safeParse({
        ...obj,
        sourceUrls: validUrls,
        verificationStatus:
          validUrls.length === 0 ? "needs_verification" : obj.verificationStatus,
      });

      if (singleParsed.success) {
        repaired.push(sanitizeProposalVerification(singleParsed.data));
      }
    }

    if (repaired.length > 0) {
      return repaired;
    }
  }

  throw new Error(
    `INVALID_LLM_STRUCTURED_OUTPUT: Output LLM tidak sesuai skema perencanaan (${parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ")})`
  );
}

function buildStorytellingPlanPrompt(input: ContentPlanInput): string {
  const priorTitles = input.existingItems
    .slice(0, 60)
    .map((i) => `- [${i.contentCode}] ${i.title} (${i.topic})`)
    .join("\n");

  return `Kamu adalah Head Content Strategist & Scriptwriter untuk channel video pendek Indonesia @${input.settings.channelName}.
Identitas Visual: ${input.settings.visualStyleGuide}
Karakter & Gaya Bahasa: Bahasa Indonesia percakapan sehari-hari yang akrab ("lo", "pernah nggak lo...", hangat, empatik, cerdas, tidak menggurui, seperti ngobrol sama teman dekat).
Target Audiens: Anak muda & dewasa muda Indonesia (18-34 tahun) di TikTok, YouTube Shorts, dan Instagram Reels.
${input.customThemeHint ? `Fokus Riset & Tren Minggu Ini: ${input.customThemeHint}` : ""}

ANALISIS KONTEN YANG SUDAH ADA (JANGAN mengulang topik di bawah ini, tapi pertahankan DNA gaya bahasanya):
${priorTitles || "(Belum ada konten)"}

TUGAS RISET & PERENCANAAN:
1. Analisis pola masalah sehari-hari, psikologi populer, kesehatan ringan, kebiasaan finansial, dan fenomena sosial/otak yang sedang sangat relevan dengan anak muda Indonesia.
2. Buat tepat ${input.targetVideoCount} konten baru untuk 1 minggu ke depan.
3. WAJIB format bagian "narration" dengan pembagian per 10 detik persis seperti ini:
0-10:
[Kalimat hook pembuka 2 kalimat yang langsung kena ke kehidupan penonton]

11-20:
[Penjelasan awal / istilah ilmiah atau psikologinya]

21-30:
[Cara kerja di otak / tubuh / kehidupan sehari-hari bagian 1]

31-40:
[Cara kerja bagian 2 yang mudah dibayangkan dalam visual origami]

41-50:
[Dampak nyata yang sering tidak disadari]

51-60:
[Contoh situasi sehari-hari yang relatable]

61-70:
[Solusi praktis / langkah sederhana yang bisa langsung dicoba]

71-90:
[Kesimpulan hangat + kalimat pertanyaan interaktif untuk memancing komentar]

Kembalikan HANYA JSON murni dengan skema:
{
  "proposals": [
    {
      "title": "Judul memancing klik & rasa ingin tahu (gaya: Kenapa ...? Ini Penyebabnya)",
      "category": "Kategori singkat",
      "topic": "Penjelasan spesifik sudut pandang topik",
      "hook": "Kalimat pembuka 3 detik pertama",
      "narration": "Narasi lengkap dengan penanda waktu 0-10:, 11-20:, dst. sampai 71-90:",
      "cta": "Pertanyaan penutup pemancing komentar",
      "tiktokCaption": "Deskripsi singkat 2 kalimat + hashtag relevan",
      "youtubeDescription": "Deskripsi YouTube Shorts + hashtag",
      "instagramCaption": "Caption Instagram Reels + hashtag",
      "targetDurationSeconds": 80,
      "factualClaims": ["Klaim fakta ilmiah 1", "Klaim fakta ilmiah 2"],
      "sourceUrls": ["https://..."],
      "verificationStatus": "verified atau needs_verification"
    }
  ]
}
Aturan ketat: Jangan mengarang URL palsu. Jika tidak yakin URL sumbernya, kosongkan array sourceUrls dan isi verificationStatus dengan "needs_verification".`;
}

export class MockLLMProvider implements LLMProvider {
  readonly providerKey = "mock_llm";
  readonly modelName = "ceritaobim-storytelling-pool-v2";

  async generateContentPlan(
    input: ContentPlanInput
  ): Promise<ContentPlanResult> {
    const existingLowerTitles = new Set(
      input.existingItems.map((i) => i.title.toLowerCase())
    );

    const available = CURATED_FACT_POOL.filter(
      (p) => !existingLowerTitles.has(p.title.toLowerCase())
    );
    const pool = available.length > 0 ? available : CURATED_FACT_POOL;

    const selected: LLMGeneratedProposal[] = [];
    for (let i = 0; i < input.targetVideoCount; i++) {
      const base = pool[i % pool.length]!;
      selected.push(
        sanitizeProposalVerification({
          ...base,
          targetDurationSeconds: input.settings.defaultDurationSeconds || 80,
        })
      );
    }

    return {
      providerKey: this.providerKey,
      providerModel: this.modelName,
      providerRequestId: `mock-req-${crypto.randomUUID().slice(0, 8)}`,
      estimatedCostUsd: 0,
      proposals: validateAndSanitizeLLMPlanOutput({ proposals: selected }),
    };
  }

  async regenerateSingleProposal(
    input: ContentPlanInput & { rejectedTitle?: string }
  ) {
    const candidates = CURATED_FACT_POOL.filter(
      (p) => p.title !== input.rejectedTitle
    );
    const chosen =
      candidates[Math.floor(Math.random() * candidates.length)] ??
      CURATED_FACT_POOL[0]!;

    return {
      providerKey: this.providerKey,
      providerModel: this.modelName,
      providerRequestId: `mock-regen-${crypto.randomUUID().slice(0, 8)}`,
      proposal: sanitizeProposalVerification({
        ...chosen,
        targetDurationSeconds: input.settings.defaultDurationSeconds || 80,
      }),
    };
  }
}

export class ClaudeLLMProvider implements LLMProvider {
  readonly providerKey = "claude";
  readonly modelName: string;
  private readonly apiKey: string;

  constructor(apiKey: string, modelName = "claude-3-5-sonnet-latest") {
    this.apiKey = apiKey;
    this.modelName = modelName;
  }

  async generateContentPlan(
    input: ContentPlanInput
  ): Promise<ContentPlanResult> {
    const prompt = buildStorytellingPlanPrompt(input);

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: this.modelName,
        max_tokens: 8192,
        temperature: 0.7,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      throw new Error(
        `CLAUDE_API_ERROR (Status ${response.status}): ${errText.slice(0, 220)}`
      );
    }

    const data = await response.json();
    const rawText: string = data?.content?.[0]?.text ?? "{}";
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    const parsedJson = JSON.parse(jsonMatch ? jsonMatch[0] : rawText);
    const proposals = validateAndSanitizeLLMPlanOutput(parsedJson);

    return {
      providerKey: this.providerKey,
      providerModel: this.modelName,
      providerRequestId: data?.id || `claude-${crypto.randomUUID().slice(0, 8)}`,
      estimatedCostUsd: Number((input.targetVideoCount * 0.008).toFixed(4)),
      proposals,
    };
  }

  async regenerateSingleProposal(
    input: ContentPlanInput & { rejectedTitle?: string }
  ) {
    const res = await this.generateContentPlan({
      ...input,
      targetVideoCount: 1,
      customThemeHint: `${input.customThemeHint || ""} (Jangan gunakan topik: ${
        input.rejectedTitle || ""
      })`.trim(),
    });
    return {
      providerKey: res.providerKey,
      providerModel: res.providerModel,
      providerRequestId: res.providerRequestId,
      proposal: res.proposals[0]!,
    };
  }
}

export class GeminiLLMProvider implements LLMProvider {
  readonly providerKey = "gemini";
  readonly modelName: string;
  private readonly apiKey: string;

  constructor(apiKey: string, modelName = "gemini-3-flash-preview") {
    this.apiKey = apiKey;
    this.modelName =
      modelName === "gemini-2.5-flash" ? "gemini-3-flash-preview" : modelName;
  }

  async generateContentPlan(
    input: ContentPlanInput
  ): Promise<ContentPlanResult> {
    const prompt = buildStorytellingPlanPrompt(input);

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      this.modelName
    )}:generateContent?key=${encodeURIComponent(this.apiKey)}`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.7,
        },
      }),
    });

    if (!response.ok) {
      const errBody = await response.text().catch(() => "");
      throw new Error(
        `LLM_PROVIDER_ERROR (Status ${response.status}): ${errBody.slice(0, 180)}`
      );
    }

    const data = await response.json();
    const parts: Array<{ text?: string }> =
      data?.candidates?.[0]?.content?.parts ?? [];
    const textPart =
      parts.find((p) => typeof p.text === "string" && p.text.includes("{")) ??
      parts[0];
    const rawText = textPart?.text ?? "{}";
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    const parsedJson = JSON.parse(jsonMatch ? jsonMatch[0] : rawText);
    const proposals = validateAndSanitizeLLMPlanOutput(parsedJson);

    return {
      providerKey: this.providerKey,
      providerModel: this.modelName,
      providerRequestId: `gemini-${crypto.randomUUID().slice(0, 8)}`,
      estimatedCostUsd: 0,
      proposals,
    };
  }

  async regenerateSingleProposal(
    input: ContentPlanInput & { rejectedTitle?: string }
  ) {
    const res = await this.generateContentPlan({
      ...input,
      targetVideoCount: 1,
      customThemeHint: `${input.customThemeHint || ""} (Jangan gunakan topik: ${
        input.rejectedTitle || ""
      })`.trim(),
    });
    return {
      providerKey: res.providerKey,
      providerModel: res.providerModel,
      providerRequestId: res.providerRequestId,
      proposal: res.proposals[0]!,
    };
  }
}

export function getActiveLLMProvider(overrideProfileId?: string): LLMProvider {
  const providerKey = (process.env.LLM_PROVIDER || "").trim().toLowerCase();
  let profileGeminiKey = "";
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getActiveProviderProfile } = require("@/lib/providers/account-profiles") as typeof import("@/lib/providers/account-profiles");
    profileGeminiKey = (
      getActiveProviderProfile(overrideProfileId).geminiApiKey || ""
    ).trim();
  } catch {
    profileGeminiKey = "";
  }

  const apiKey = (
    profileGeminiKey ||
    process.env.ANTHROPIC_API_KEY ||
    process.env.CLAUDE_API_KEY ||
    process.env.GEMINI_API_KEY ||
    process.env.LLM_API_KEY ||
    ""
  ).trim();
  const model = (process.env.LLM_MODEL || "").trim();

  // Auto-detect Google AI Studio Gemini API key (starts with AIza or AQ.)
  if (apiKey.startsWith("AIza") || apiKey.startsWith("AQ.")) {
    const geminiModel =
      model && model.startsWith("gemini") ? model : "gemini-3-flash-preview";
    return new GeminiLLMProvider(apiKey, geminiModel);
  }

  // Auto-detect Anthropic Claude API key (starts with sk-ant-)
  if (
    (providerKey === "claude" ||
      providerKey === "anthropic" ||
      apiKey.startsWith("sk-ant-")) &&
    apiKey
  ) {
    const claudeModel =
      model && model.startsWith("claude") ? model : "claude-3-5-sonnet-latest";
    return new ClaudeLLMProvider(apiKey, claudeModel);
  }

  if ((providerKey === "gemini" || profileGeminiKey) && apiKey) {
    const geminiModel =
      model && model.startsWith("gemini") ? model : "gemini-3-flash-preview";
    return new GeminiLLMProvider(apiKey, geminiModel);
  }

  return new MockLLMProvider();
}

