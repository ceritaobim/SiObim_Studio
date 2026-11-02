import fs from "fs";
import path from "path";
import crypto from "crypto";
import os from "os";
import type {
  AnalyticsSummary,
  AssetRecord,
  BudgetEventType,
  BudgetLedgerRecord,
  ContentAnalyticsRecord,
  ContentBatchRecord,
  ContentItemRecord,
  JobStatus,
  JobStepType,
  PlatformAnalyticsMetrics,
  PlatformName,
  PlatformPublicationRecord,
  PlatformTarget,
  ProductionJobRecord,
  ProjectSettingsSummary,
  ProposalDecision,
  PublishStatus,
  SceneRecord,
  StorageBackendStatus,
  TimestampStatus,
  WeeklyPlanProposal,
  WordAlignmentSpan,
} from "@/types/domain";
import {
  DEFAULT_OWNER_ID,
  DEFAULT_PROJECT_SETTINGS,
} from "@/lib/config/env";
import {
  assertOwnerAccess,
  createServerSupabaseAdminClient,
} from "@/lib/auth/owner-auth";
import {
  ContentItemInputSchema,
  type ContentItemCreateParams,
  type ContentItemInput,
  type ContentItemUpdateInput,
  type CreateBatchRequest,
  type ProjectSettingsInput,
} from "@/lib/validation/schemas";
import {
  getActiveLLMProvider,
  type LLMProvider,
} from "@/lib/providers/llm/llm-provider";
import { findDuplicateTopicWarnings } from "@/features/content-library/duplicate-detector";
import {
  segmentNarrationIntoScenes,
  validateScenesIntegrity,
} from "@/features/scenes/scene-segmenter";
import { evaluateBudgetGuard } from "@/lib/costs/budget-guard";
import {
  buildDeterministicIdempotencyKey,
  transitionProductionJob,
} from "@/lib/jobs/job-runner";
import {
  buildAndValidateAssemblyManifest,
  executeVideoAssembly,
  type AssemblyValidationAndBuildResult,
} from "@/features/assembly/ffmpeg-assembler";

interface LocalStoreData {
  settingsByOwner: Record<string, ProjectSettingsSummary>;
  contentItems: ContentItemRecord[];
  batches: ContentBatchRecord[];
  scenes: SceneRecord[];
  assets: AssetRecord[];
  jobs: ProductionJobRecord[];
  budgetLedger: BudgetLedgerRecord[];
  publications: PlatformPublicationRecord[];
  contentAnalytics: ContentAnalyticsRecord[];
}

const DEFAULT_STORE_PATH = path.join(
  process.cwd(),
  ".data",
  "studio-store.json"
);

function buildInitialDemoItems(ownerId: string): ContentItemRecord[] {
  const now = new Date().toISOString();
  return [
    {
      id: "11111111-1111-4111-8111-111111111001",
      ownerId,
      contentCode: "CO-2026-001",
      title: "Kenapa Temen Makin Dikit Pas Dewasa? Ini Bukan Salah Lo",
      category: "Psikologi & Sosial",
      topic:
        "Socioemotional Selectivity Theory (Laura Carstensen) tentang lingkaran pertemanan yang mengecil namun lebih berkualitas saat dewasa",
      hook: "Kalau temen nongkrong lo makin lama makin dikit, itu bukan tanda lo makin ansos. Justru itu tanda otak lo lagi naik level.",
      narration:
        "Kalau temen nongkrong lo makin lama makin dikit, itu bukan tanda lo makin ansos. Justru itu tanda otak lo lagi naik level. Coba inget lagi. Dulu pas sekolah atau awal kuliah, ngumpulin orang buat nongkrong sampai pagi tuh gampang banget. Sekarang? Bales chat grup aja rasanya capek. Terus lo mikir, 'Apa gue yang berubah? Atau temen gue yang pada sombong?' Tenang, lo normal kok. Ada penjelasan ilmiahnya, namanya Socioemotional Selectivity Theory dari psikolog Laura Carstensen. Intinya gini: makin dewasa, kita makin sadar kalau waktu dan energi itu terbatas. Jadi otak kita mulai milih, mana hubungan yang beneran ngasih rasa tenang dan dukungan, mana yang cuma basa-basi dan ngabisin tenaga. Makanya lingkaran pertemanan mengecil, tapi biasanya kualitasnya malah naik. Apalagi energi lo udah banyak kesedot buat kerjaan, cicilan, dan mikirin masa depan. Wajar kalau lo lebih milih nongkrong sama dua orang yang sefrekuensi, atau me-time di kamar sambil baca buku self-improvement, daripada kumpul dua puluh orang tapi isinya basa-basi doang. Jadi stop ngerasa bersalah cuma karena jarang keluar. Temen yang dikit itu bukan kekurangan, itu hasil seleksi. Nah, jujur ya, temen tongkrongan yang beneran nyambung sama lo sekarang tinggal berapa orang? Tulis angkanya di komen!",
      cta: "Nah, jujur ya, temen tongkrongan yang beneran nyambung sama lo sekarang tinggal berapa orang? Tulis angkanya di komen!",
      tiktokCaption:
        "Circle pertemanan mengecil bukan tanda lo ansos, tapi proses wajar saat dewasa. Yuk pahami alasannya dari sisi psikologi. Temen nongkrong lo sisa berapa orang? Tulis di komen! #ceritaobim #psikologi #pertemanan #dewasa #origamistopmotion",
      youtubeDescription:
        "Circle pertemanan mengecil bukan tanda lo ansos, tapi proses wajar saat dewasa berdasarkan Socioemotional Selectivity Theory dari psikolog Laura Carstensen.",
      instagramCaption:
        "Circle pertemanan mengecil bukan tanda lo ansos, tapi proses wajar saat dewasa. Yuk pahami alasannya dari sisi psikologi. Temen nongkrong lo sisa berapa orang? Tulis di komen! #ceritaobim #psikologi #selfimprovement",
      notes:
        "Week 1 — Hari 1 (19:00 WIB) | Segmen: 0-10, 11-20, 21-30, 31-40, 41-50, 51-60, 61-70, 71-80, 81-83",
      targetDurationSeconds: 83,
      factualClaims: [
        "Socioemotional Selectivity Theory dikemukakan oleh psikolog Stanford Laura Carstensen tentang seleksi hubungan sosial seiring bertambahnya usia.",
      ],
      sourceUrls: [
        "https://en.wikipedia.org/wiki/Socioemotional_selectivity_theory",
      ],
      verificationStatus: "verified",
      contentStatus: "ready_to_publish",
      sourceBatchId: null,
      isDemo: false,
      publishedAt: "Hari 1 - 19:00 WIB",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "11111111-1111-4111-8111-111111111002",
      ownerId,
      contentCode: "CO-2026-002",
      title: "Masuk Angin Itu Penyakit Beneran atau Cuma Sugesti?",
      category: "Kesehatan & Medis",
      topic:
        "Penjelasan ilmiah di balik istilah masuk angin, vasodilatasi pembuluh darah tepi saat kerokan, efek plasebo, dan tradisi cao gio di Vietnam",
      hook: "Ada satu penyakit yang nggak ada di buku kedokteran, tapi hampir semua orang Indonesia pernah kena. Namanya... masuk angin.",
      narration:
        "Ada satu penyakit yang nggak ada di buku kedokteran, tapi hampir semua orang Indonesia pernah kena. Namanya... masuk angin. Coba tanya dokter luar negeri soal 'kemasukan angin', mereka bakal bingung. Soalnya itu bukan diagnosis medis, itu istilah budaya. Yang lo rasain, kayak pegel, mual, kembung, dan pusing, biasanya gabungan dari badan kecapekan, asam lambung naik, telat makan, atau infeksi virus ringan. Terus kenapa abis dikerok rasanya enakan? Ada penjelasan ilmiahnya. Kerokan bikin pembuluh darah kecil di kulit melebar, jadi aliran darah di area itu naik dan badan terasa hangat serta lebih rileks. Ditambah efek harapan dari otak, atau yang disebut efek plasebo: pas lo yakin bakal enakan, rasa nggak nyamannya ikut turun. Serunya, di Vietnam ada tradisi mirip lho, namanya 'cao gio', artinya mengerok angin. Tapi catet ya, kerokan cuma bantu terasa lebih enak, bukan nyembuhin penyebabnya. Kalau demam tinggi atau sesak napas, tetep periksa ke dokter. Buat pertolongan pertama yang praktis, sedia minyak angin roll-on di tas aja, hangatnya lumayan bikin nyaman. Nah, sekarang pilih satu: kalau lagi masuk angin, lo tim kerokan sampai merah, atau tim minum obat warung? Jawab di komen!",
      cta: "Nah, sekarang pilih satu: kalau lagi masuk angin, lo tim kerokan sampai merah, atau tim minum obat warung? Jawab di komen!",
      tiktokCaption:
        "Masuk angin nggak ada di buku kedokteran, tapi hampir semua orang Indonesia pernah kena. Ini penjelasan ringan di balik kerokan. Lo tim kerokan atau tim obat warung? Jawab di komen! #masukangin #kerokan #faktamedis #edukasi #indonesia",
      youtubeDescription:
        "Masuk angin nggak ada di buku kedokteran, tapi hampir semua orang Indonesia pernah kena. Ini penjelasan ringan di balik kerokan dan tradisi cao gio.",
      instagramCaption:
        "Masuk angin nggak ada di buku kedokteran, tapi hampir semua orang Indonesia pernah kena. Lo tim kerokan atau tim obat warung? Jawab di komen! #masukangin #kerokan #faktamedis #edukasi #indonesia",
      notes:
        "Week 1 — Hari 2 (19:00 WIB) | Segmen: 0-10, 11-20, 21-30, 31-40, 41-50, 51-60, 61-70, 71-81",
      targetDurationSeconds: 81,
      factualClaims: [
        "Kerokan memicu pelebaran pembuluh darah kapiler (vasodilatasi) di permukaan kulit dan memiliki padanan tradisi cao gio di Vietnam.",
      ],
      sourceUrls: ["https://en.wikipedia.org/wiki/Gua_sha"],
      verificationStatus: "verified",
      contentStatus: "script_approved",
      sourceBatchId: null,
      isDemo: false,
      publishedAt: "Hari 2 - 19:00 WIB",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "11111111-1111-4111-8111-111111111003",
      ownerId,
      contentCode: "CO-2026-003",
      title: "Kenapa Jam 2 Pagi Otak Lo Malah Overthinking?",
      category: "Psikologi & Kesehatan Mental",
      topic:
        "Penyebab ilmiah overthinking saat malam hari (hilangnya distraksi siang dan reaktivitas pusat cemas saat kelelahan) serta teknik brain dump sebelum tidur",
      hook: "Jam 2 pagi, otak lo mendadak ngajak rapat soal masa depan, padahal siang tadi lo ngantuk berat. Ini bukan kebetulan.",
      narration:
        "Jam 2 pagi, otak lo mendadak ngajak rapat soal masa depan, padahal siang tadi lo ngantuk berat. Ini bukan kebetulan. Siang hari lo nguap terus, tapi begitu kepala nempel bantal, tiba-tiba kepikiran cicilan, kerjaan, jodoh, sampai aib memalukan lima tahun lalu. Kesel banget kan? Ini ada penjelasan ilmiahnya, dan lo nggak sendirian. Pertama, pas siang otak lo sibuk banget sama notif, kerjaan, dan orang sekitar, jadi pikiran-pikiran yang ganjel itu ketunda. Begitu malam sunyi dan nggak ada distraksi, pikiran itu akhirnya dapet panggung. Kedua, pas lo kurang tidur, bagian otak yang bertugas nenangin emosi jadi kurang kuat, sementara bagian pemicu cemas jadi lebih reaktif. Hasilnya, masalah kecil kerasa gede banget. Padahal biasanya, setelah tidur cukup, banyak hal jadi nggak sebesar tadi malam. Trik simpel: tulis semua isi kepala lo di catatan sebelum tidur, biar otak ngerasa udah 'dicatat' dan nggak perlu nyimpen sendirian. Terus redupin ruangan, pakai lampu tidur remang yang hangat, karena cahaya redup bantu tubuh siap buat tidur. Jadi kalau jam 2 pagi lo overthinking, itu bukan tanda lo lemah, itu otak lo lagi kelelahan. Sekarang cerita dong, hal paling random apa yang lo pikirin semalem? Tulis di komen!",
      cta: "Sekarang cerita dong, hal paling random apa yang lo pikirin semalem? Tulis di komen!",
      tiktokCaption:
        "Siang ngantuk berat, tapi pas mau tidur otak malah rapat soal masa depan. Ini penjelasan ilmiahnya plus trik simpel biar lebih tenang. Hal paling random yang lo pikirin semalem apa? Cerita di komen! #overthinking #susahtidur #psikologi #kesehatanmental #jam2pagi",
      youtubeDescription:
        "Siang ngantuk berat, tapi pas mau tidur otak malah rapat soal masa depan. Ini penjelasan ilmiahnya plus trik simpel biar lebih tenang.",
      instagramCaption:
        "Siang ngantuk berat, tapi pas mau tidur otak malah rapat soal masa depan. Hal paling random yang lo pikirin semalem apa? Cerita di komen! #overthinking #susahtidur #psikologi #kesehatanmental #jam2pagi",
      notes:
        "Week 1 — Hari 3 (19:00 WIB) | Segmen: 0-10 (Scene 1) s.d. 71-80 (Scene 8) • Konsep art stop motion origami vertikal tanpa subtitle",
      targetDurationSeconds: 80,
      factualClaims: [
        "Kurang tidur menurunkan regulasi korteks prefrontal terhadap amigdala sehingga respons kecemasan meningkat di malam hari.",
      ],
      sourceUrls: ["https://en.wikipedia.org/wiki/Sleep_and_emotions"],
      verificationStatus: "verified",
      contentStatus: "script_approved",
      sourceBatchId: null,
      isDemo: false,
      publishedAt: "Hari 3 - 19:00 WIB",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "11111111-1111-4111-8111-111111111004",
      ownerId,
      contentCode: "CO-2026-004",
      title: "Gaji Naik Tapi Tetep Kurang? Ini Namanya Lifestyle Creep",
      category: "Keuangan & Psikologi",
      topic:
        "Fenomena Lifestyle Creep (inflasi gaya hidup) dan Hedonic Adaptation saat penghasilan meningkat serta cara mengeremnya",
      hook: "Gaji lo naik, tapi saldo tanggal 27 tetep tipis, dan itu bukan semata karena lo boros.",
      narration:
        "Gaji lo naik, tapi saldo tanggal 27 tetep tipis, dan itu bukan semata karena lo boros. Coba inget, dulu pas awal kerja gaji pas-pasan, tapi lo tetep bisa hidup. Sekarang gaji udah lebih gede, kok rasanya malah kurang terus? Di dunia finansial, ini namanya Lifestyle Creep, alias gaya hidup yang diam-diam ikut naik tiap penghasilan naik. Ada penjelasan psikologisnya, namanya hedonic adaptation. Otak kita itu gampang banget terbiasa. Awalnya kopi susu 40 ribu terasa spesial. Beberapa minggu kemudian jadi biasa aja, dan lo butuh yang lebih lagi biar tetep ngerasa senang. Jadi standar hidup naik, tapi kebahagiaannya nggak ikut naik. Dulu ngopi sachet tiga ribu cukup, sekarang minimal kopi susu. Dulu tas kain cukup, sekarang pengen yang branded. Kalau nggak ada rem, gaji naik berapa kali lipat pun tetep abis. Solusinya gampang. Catat pengeluaran tiap hari di buku planner keuangan, dan begitu gajian, sisihin tabungan duluan sebelum belanja. Bukan buat pelit, tapi biar kerja keras lo nggak cuma numpang lewat. Nah, sekarang jujur ya, gaji lo bulan ini paling banyak habis buat jajan apa? Tulis di komen, aman kok, kita nggak saling ngejudge!",
      cta: "Nah, sekarang jujur ya, gaji lo bulan ini paling banyak habis buat jajan apa? Tulis di komen, aman kok, kita nggak saling ngejudge!",
      tiktokCaption:
        "Gaji udah naik tapi saldo tanggal 27 tetep tipis? Bisa jadi lo kena lifestyle creep. Ini penjelasan dan cara ngeremnya. Gaji lo bulan ini paling banyak habis buat jajan apa? Tulis di komen! #lifestylecreep #keuangan #gaji #financialplanning #uangbulanan",
      youtubeDescription:
        "Gaji udah naik tapi saldo tanggal 27 tetep tipis? Bisa jadi lo kena lifestyle creep dan hedonic adaptation. Ini penjelasan dan cara ngeremnya.",
      instagramCaption:
        "Gaji udah naik tapi saldo tanggal 27 tetep tipis? Bisa jadi lo kena lifestyle creep. Gaji lo bulan ini paling banyak habis buat jajan apa? Tulis di komen! #lifestylecreep #keuangan #gaji #financialplanning #uangbulanan",
      notes:
        "Week 1 — Hari 4 (19:00 WIB) | Segmen: 0-10 s.d. 71-76 (8 Scene)",
      targetDurationSeconds: 76,
      factualClaims: [
        "Lifestyle creep (lifestyle inflation) didorong oleh hedonic adaptation di mana manusia cepat terbiasa dengan peningkatan standar konsumsi.",
      ],
      sourceUrls: ["https://en.wikipedia.org/wiki/Lifestyle_creep"],
      verificationStatus: "verified",
      contentStatus: "script_approved",
      sourceBatchId: null,
      isDemo: false,
      publishedAt: "Hari 4 - 19:00 WIB",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "11111111-1111-4111-8111-111111111005",
      ownerId,
      contentCode: "CO-2026-005",
      title: "Kenapa Pas Stres Malah Pengen Ngemil Pedas?",
      category: "Psikologi & Biologi",
      topic:
        "Mekanisme Emotional Eating akibat hormon kortisol, pelepasan dopamin dari makanan gurih, dan pelepasan endorfin dari sensasi pedas",
      hook: "Tangan lo otomatis nyari seblak pas stres itu bukan karena lo rakus, tapi karena otak lo lagi minta tolong.",
      narration:
        "Tangan lo otomatis nyari seblak pas stres itu bukan karena lo rakus, tapi karena otak lo lagi minta tolong. Habis dimarahin bos atau pusing mikirin tugas, perut sebenernya nggak laper-laper amat, tapi mulut rasanya gatel pengen ngunyah. Dan anehnya, pas makan, rasa suntuk dan kesel itu sedikit memudar. Tenang, ini normal banget, namanya Emotional Eating. Penjelasan ilmiahnya gini. Pas stres, tubuh ngeluarin hormon kortisol, dan hormon ini bisa bikin nafsu makan naik, apalagi buat makanan yang gurih, manis, atau tinggi kalori. Terus, makanan enak mengaktifkan jalur penghargaan di otak yang ngelepas dopamin, si zat rasa senang. Kalau makanan pedas, ada bonus lagi: sensasi panasnya bikin tubuh ngeluarin endorfin, zat yang bikin lega. Makanya ngemil basreng pedas kerasa kayak pahlawan pas lagi suntuk. Tapi ingat, itu cuma pereda sementara, stresnya sendiri belum hilang. Jadi boleh sesekali, asal porsinya dijaga. Dan coba tarik napas dalam lima kali dulu sebelum ngunyah. Siapa tahu ternyata lo bukan laper, cuma butuh jeda. Sekarang pilih satu, snack pelarian wajib lo kalau lagi pusing itu apa? Basreng, seblak, atau es krim? Komen di bawah!",
      cta: "Sekarang pilih satu, snack pelarian wajib lo kalau lagi pusing itu apa? Basreng, seblak, atau es krim? Komen di bawah!",
      tiktokCaption:
        "Tangan otomatis nyari seblak atau basreng pas stres? Itu bukan karena lo rakus, ada penjelasan ilmiahnya. Snack pelarian lo kalau lagi pusing apa? Komen di bawah! #emotionaleating #stres #basreng #seblak #psikologi",
      youtubeDescription:
        "Tangan otomatis nyari seblak atau basreng pas stres? Itu bukan karena lo rakus, ada penjelasan ilmiahnya tentang kortisol, dopamin, dan endorfin.",
      instagramCaption:
        "Tangan otomatis nyari seblak atau basreng pas stres? Snack pelarian lo kalau lagi pusing apa? Komen di bawah! #emotionaleating #stres #basreng #seblak #psikologi",
      notes: "Week 1 — Hari 5 (19:00 WIB) | Durasi target ~78 detik",
      targetDurationSeconds: 78,
      factualClaims: [
        "Stres memicu sekresi kortisol yang meningkatkan keinginan konsumsi makanan padat kalori (emotional eating), sedangkan sensasi pedas kapsaisin memicu pelepasan endorfin.",
      ],
      sourceUrls: ["https://en.wikipedia.org/wiki/Emotional_eating"],
      verificationStatus: "verified",
      contentStatus: "script_approved",
      sourceBatchId: null,
      isDemo: false,
      publishedAt: "Hari 5 - 19:00 WIB",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "11111111-1111-4111-8111-111111111006",
      ownerId,
      contentCode: "CO-2026-006",
      title: "Umur 24 Tapi Punggung Udah Kayak 54? Ini Penyebabnya",
      category: "Kesehatan & Ergonomi",
      topic:
        "Tekanan bantalan tulang belakang saat duduk membungkuk berjam-jam, fenomena tech neck akibat menunduk ke layar, dan pencegahannya",
      hook: "Punggung lo bisa jadi lebih tua dari umur lo, dan penyebabnya mungkin lagi lo duduki sekarang.",
      narration:
        "Punggung lo bisa jadi lebih tua dari umur lo, dan penyebabnya mungkin lagi lo duduki sekarang. Umur baru 24, tapi tiap bangun dari kursi bunyi kretek-kretek? Siapa di sini yang kerja atau kuliah duduk berjam-jam natap laptop? Ini ada penjelasan ilmiahnya. Pas lo duduk, apalagi sambil bungkuk, tekanan di bantalan antar tulang belakang bisa lebih besar dibanding pas berdiri tegak. Otot punggung dan pinggul juga jadi pasif, aliran darahnya melambat, makanya badan terasa kaku dan pegel. Belum lagi kebiasaan nunduk ke layar. Kepala manusia beratnya sekitar lima kilo, tapi pas leher menunduk, beban yang ditahan leher bisa berlipat-lipat. Lama-lama, leher maju ke depan dan postur jadi bungkuk, yang sering disebut tech neck atau nerd neck. Kabar baiknya, ini bisa dicegah. Pertama, bangun dan gerak sebentar tiap 30 sampai 60 menit, cukup jalan ke dispenser. Kedua, atur layar sejajar mata. Ketiga, bantu postur lo pakai bantal duduk orthopedi biar punggung lebih terjaga. Tulang belakang lo cuma satu seumur hidup, jadi rawat dari sekarang. Nah, sekarang jujur, lo lagi nonton ini dengan posisi duduk gimana? Tegak, miring, atau udah kayak huruf C? Ngaku di komen!",
      cta: "Nah, sekarang jujur, lo lagi nonton ini dengan posisi duduk gimana? Tegak, miring, atau udah kayak huruf C? Ngaku di komen!",
      tiktokCaption:
        "Duduk berjam-jam diam-diam bikin punggung dan leher lo kerja ekstra. Ini penjelasan ringan dan cara nyegahnya. Lo lagi duduk dengan posisi apa sekarang? Ngaku di komen! #punggung #postur #pekerjakantoran #kesehatan #ergonomis",
      youtubeDescription:
        "Duduk berjam-jam diam-diam bikin punggung dan leher lo kerja ekstra (tech neck). Ini penjelasan ringan dan cara nyegahnya.",
      instagramCaption:
        "Duduk berjam-jam diam-diam bikin punggung dan leher lo kerja ekstra. Lo lagi duduk dengan posisi apa sekarang? Ngaku di komen! #punggung #postur #pekerjakantoran #kesehatan #ergonomis",
      notes: "Week 1 — Hari 6 (19:00 WIB) | Durasi target ~78 detik",
      targetDurationSeconds: 78,
      factualClaims: [
        "Menundukkan kepala (forward head posture / tech neck) meningkatkan beban mekanis pada tulang belakang leher secara signifikan dibanding posisi netral.",
      ],
      sourceUrls: ["https://en.wikipedia.org/wiki/Forward_head_posture"],
      verificationStatus: "verified",
      contentStatus: "script_approved",
      sourceBatchId: null,
      isDemo: false,
      publishedAt: "Hari 6 - 19:00 WIB",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "11111111-1111-4111-8111-111111111007",
      ownerId,
      contentCode: "CO-2026-007",
      title: "Lagi FOMO Liat Temen Sukses? Lo Cuma Liat Trailer-nya",
      category: "Psikologi & Pengembangan Diri",
      topic:
        "Penjelasan FOMO melalui Social Comparison Theory (Leon Festinger) di media sosial serta prinsip dikotomi kendali dalam Stoikisme (Filosofi Teras)",
      hook: "Lo nggak ketinggalan dalam hidup, lo cuma lagi ngeliat trailer hidup orang lain.",
      narration:
        "Lo nggak ketinggalan dalam hidup, lo cuma lagi ngeliat trailer hidup orang lain. Pernah nggak sih lo scroll story IG, terus ada temen yang udah nikah mewah, ada yang beli mobil, ada yang liburan ke Eropa? Terus lo ngehela napas, 'Kok hidup gue gini-gini aja ya?' Tenang, itu manusiawi banget, namanya FOMO, Fear of Missing Out. Penjelasan ilmiahnya ada di teori perbandingan sosial dari psikolog Leon Festinger. Intinya, manusia otomatis menilai dirinya dengan membandingkan diri ke orang lain. Masalahnya, di media sosial, yang lo bandingin cuma bagian terbaik dari hidup orang. Kita liat trailer-nya, tapi nggak pernah liat behind the scene-nya: capek, nangis, bahkan utang. Jadi ini nggak adil. Lo bandingin hidup lo yang utuh sama highlight orang lain. Terus gimana? Salah satu ajaran Stoikisme, filosofi dari Yunani kuno, adalah fokus ke hal yang bisa kita kendalikan, yaitu usaha dan sikap kita, bukan pencapaian orang lain. Kalau lo penasaran, buku Filosofi Teras ngebahas ini dengan bahasa yang ringan banget. Kesuksesan orang lain bukan berarti lo gagal. Lo punya jalur dan zona waktu sendiri. Nah, sekarang kita rayain yang kecil. Pencapaian sekecil apa pun yang paling lo banggain minggu ini apa? Tulis di komen biar kita saling support!",
      cta: "Pencapaian sekecil apa pun yang paling lo banggain minggu ini apa? Tulis di komen biar kita saling support!",
      tiktokCaption:
        "Scroll story IG terus ngerasa hidup ketinggalan? Ini penjelasan psikologi di balik FOMO dan cara ngadepinnya. Pencapaian kecil yang paling lo banggain minggu ini apa? Tulis di komen! #fomo #mentalhealth #stoicism #filosofiteras #selfimprovement",
      youtubeDescription:
        "Scroll story IG terus ngerasa hidup ketinggalan? Ini penjelasan psikologi Social Comparison Theory (Leon Festinger) di balik FOMO dan cara menghadapinya dengan Stoikisme.",
      instagramCaption:
        "Scroll story IG terus ngerasa hidup ketinggalan? Pencapaian kecil yang paling lo banggain minggu ini apa? Tulis di komen! #fomo #mentalhealth #stoicism #filosofiteras #selfimprovement",
      notes: "Week 1 — Hari 7 (19:00 WIB) | Durasi target ~80 detik",
      targetDurationSeconds: 80,
      factualClaims: [
        "Social Comparison Theory dikemukakan oleh psikolog sosial Leon Festinger (1954) mengenai kecenderungan manusia mengevaluasi diri melalui perbandingan sosial.",
      ],
      sourceUrls: ["https://en.wikipedia.org/wiki/Social_comparison_theory"],
      verificationStatus: "verified",
      contentStatus: "script_approved",
      sourceBatchId: null,
      isDemo: false,
      publishedAt: "Hari 7 - 19:00 WIB",
      createdAt: now,
      updatedAt: now,
    },
  ];
}

function buildInitialWeek1Scenes(items: ContentItemRecord[]): SceneRecord[] {
  const manualSegmentsByCode: Record<
    string,
    { startMs: number; endMs: number; text: string }[]
  > = {
    "CO-2026-001": [
      {
        startMs: 0,
        endMs: 10000,
        text: "Kalau temen nongkrong lo makin lama makin dikit, itu bukan tanda lo makin ansos. Justru itu tanda otak lo lagi naik level. Coba inget lagi.",
      },
      {
        startMs: 10000,
        endMs: 20000,
        text: "Dulu pas sekolah atau awal kuliah, ngumpulin orang buat nongkrong sampai pagi tuh gampang banget. Sekarang? Bales chat grup aja rasanya capek. Terus lo mikir, 'Apa gue yang berubah?",
      },
      {
        startMs: 20000,
        endMs: 30000,
        text: "Atau temen gue yang pada sombong?' Tenang, lo normal kok. Ada penjelasan ilmiahnya, namanya Socioemotional Selectivity Theory",
      },
      {
        startMs: 30000,
        endMs: 40000,
        text: "dari psikolog Laura Carstensen. Intinya gini: makin dewasa, kita makin sadar kalau waktu dan energi itu terbatas. Jadi otak kita mulai milih,",
      },
      {
        startMs: 40000,
        endMs: 50000,
        text: "mana hubungan yang beneran ngasih rasa tenang dan dukungan, mana yang cuma basa-basi dan ngabisin tenaga. Makanya lingkaran pertemanan mengecil,",
      },
      {
        startMs: 50000,
        endMs: 60000,
        text: "tapi biasanya kualitasnya malah naik. Apalagi energi lo udah banyak kesedot buat kerjaan, cicilan, dan mikirin masa depan. Wajar kalau lo lebih milih nongkrong",
      },
      {
        startMs: 60000,
        endMs: 70000,
        text: "sama dua orang yang sefrekuensi, atau me-time di kamar sambil baca buku self-improvement, daripada kumpul dua puluh orang tapi isinya basa-basi doang. Jadi stop",
      },
      {
        startMs: 70000,
        endMs: 80000,
        text: "ngerasa bersalah cuma karena jarang keluar. Temen yang dikit itu bukan kekurangan, itu hasil seleksi. Nah, jujur ya, temen tongkrongan yang beneran nyambung sama lo",
      },
      {
        startMs: 80000,
        endMs: 83000,
        text: "sekarang tinggal berapa orang? Tulis angkanya di komen!",
      },
    ],
    "CO-2026-002": [
      {
        startMs: 0,
        endMs: 10000,
        text: "Ada satu penyakit yang nggak ada di buku kedokteran, tapi hampir semua orang Indonesia pernah kena. Namanya... masuk angin. Coba tanya dokter luar negeri",
      },
      {
        startMs: 10000,
        endMs: 20000,
        text: "soal 'kemasukan angin', mereka bakal bingung. Soalnya itu bukan diagnosis medis, itu istilah budaya. Yang lo rasain, kayak pegel, mual,",
      },
      {
        startMs: 20000,
        endMs: 30000,
        text: "kembung, dan pusing, biasanya gabungan dari badan kecapekan, asam lambung naik, telat makan, atau infeksi virus ringan. Terus kenapa abis dikerok",
      },
      {
        startMs: 30000,
        endMs: 40000,
        text: "rasanya enakan? Ada penjelasan ilmiahnya. Kerokan bikin pembuluh darah kecil di kulit melebar, jadi aliran darah di area itu naik dan badan terasa hangat",
      },
      {
        startMs: 40000,
        endMs: 50000,
        text: "serta lebih rileks. Ditambah efek harapan dari otak, atau yang disebut efek plasebo: pas lo yakin bakal enakan, rasa nggak nyamannya ikut turun.",
      },
      {
        startMs: 50000,
        endMs: 60000,
        text: "Serunya, di Vietnam ada tradisi mirip lho, namanya 'cao gio', artinya mengerok angin. Tapi catet ya, kerokan cuma bantu terasa lebih enak,",
      },
      {
        startMs: 60000,
        endMs: 70000,
        text: "bukan nyembuhin penyebabnya. Kalau demam tinggi atau sesak napas, tetep periksa ke dokter. Buat pertolongan pertama yang praktis, sedia minyak angin roll-on di tas aja,",
      },
      {
        startMs: 70000,
        endMs: 81000,
        text: "hangatnya lumayan bikin nyaman. Nah, sekarang pilih satu: kalau lagi masuk angin, lo tim kerokan sampai merah, atau tim minum obat warung? Jawab di komen!",
      },
    ],
    "CO-2026-003": [
      {
        startMs: 0,
        endMs: 10000,
        text: "Jam 2 pagi, otak lo mendadak ngajak rapat soal masa depan, padahal siang tadi lo ngantuk berat. Ini bukan kebetulan. Siang hari lo nguap terus,",
      },
      {
        startMs: 10000,
        endMs: 20000,
        text: "tapi begitu kepala nempel bantal, tiba-tiba kepikiran cicilan, kerjaan, jodoh, sampai aib memalukan lima tahun lalu. Kesel banget kan? Ini ada penjelasan ilmiahnya,",
      },
      {
        startMs: 20000,
        endMs: 30000,
        text: "dan lo nggak sendirian. Pertama, pas siang otak lo sibuk banget sama notif, kerjaan, dan orang sekitar, jadi pikiran-pikiran yang ganjel",
      },
      {
        startMs: 30000,
        endMs: 40000,
        text: "itu ketunda. Begitu malam sunyi dan nggak ada distraksi, pikiran itu akhirnya dapet panggung. Kedua, pas lo kurang tidur, bagian otak yang bertugas nenangin emosi",
      },
      {
        startMs: 40000,
        endMs: 50000,
        text: "jadi kurang kuat, sementara bagian pemicu cemas jadi lebih reaktif. Hasilnya, masalah kecil kerasa gede banget. Padahal biasanya,",
      },
      {
        startMs: 50000,
        endMs: 60000,
        text: "setelah tidur cukup, banyak hal jadi nggak sebesar tadi malam. Trik simpel: tulis semua isi kepala lo di catatan sebelum tidur, biar otak ngerasa udah 'dicatat'",
      },
      {
        startMs: 60000,
        endMs: 70000,
        text: "dan nggak perlu nyimpen sendirian. Terus redupin ruangan, pakai lampu tidur remang yang hangat, karena cahaya redup bantu tubuh siap buat tidur.",
      },
      {
        startMs: 70000,
        endMs: 80000,
        text: "Jadi kalau jam 2 pagi lo overthinking, itu bukan tanda lo lemah, itu otak lo lagi kelelahan. Sekarang cerita dong, hal paling random apa yang lo pikirin semalem? Tulis di komen!",
      },
    ],
    "CO-2026-004": [
      {
        startMs: 0,
        endMs: 10000,
        text: "Gaji lo naik, tapi saldo tanggal 27 tetep tipis, dan itu bukan semata karena lo boros. Coba inget, dulu pas awal kerja gaji pas-pasan,",
      },
      {
        startMs: 10000,
        endMs: 20000,
        text: "tapi lo tetep bisa hidup. Sekarang gaji udah lebih gede, kok rasanya malah kurang terus? Di dunia finansial, ini namanya Lifestyle Creep,",
      },
      {
        startMs: 20000,
        endMs: 30000,
        text: "alias gaya hidup yang diam-diam ikut naik tiap penghasilan naik. Ada penjelasan psikologisnya, namanya hedonic adaptation. Otak kita itu gampang banget terbiasa.",
      },
      {
        startMs: 30000,
        endMs: 40000,
        text: "Awalnya kopi susu 40 ribu terasa spesial. Beberapa minggu kemudian jadi biasa aja, dan lo butuh yang lebih lagi biar tetep ngerasa senang.",
      },
      {
        startMs: 40000,
        endMs: 50000,
        text: "Jadi standar hidup naik, tapi kebahagiaannya nggak ikut naik. Dulu ngopi sachet tiga ribu cukup, sekarang minimal kopi susu. Dulu tas kain cukup, sekarang pengen yang branded.",
      },
      {
        startMs: 50000,
        endMs: 60000,
        text: "Kalau nggak ada rem, gaji naik berapa kali lipat pun tetep abis. Solusinya gampang. Catat pengeluaran tiap hari di buku planner keuangan,",
      },
      {
        startMs: 60000,
        endMs: 70000,
        text: "dan begitu gajian, sisihin tabungan duluan sebelum belanja. Bukan buat pelit, tapi biar kerja keras lo nggak cuma numpang lewat. Nah, sekarang jujur ya, gaji lo bulan ini",
      },
      {
        startMs: 70000,
        endMs: 76000,
        text: "paling banyak habis buat jajan apa? Tulis di komen, aman kok, kita nggak saling ngejudge!",
      },
    ],
  };

  const now = new Date().toISOString();
  const allScenes: SceneRecord[] = [];

  for (const item of items) {
    const manualList = manualSegmentsByCode[item.contentCode];
    if (manualList) {
      manualList.forEach((seg, idx) => {
        const sceneIndex = idx + 1;
        const durationMs = seg.endMs - seg.startMs;
        allScenes.push({
          id: crypto.randomUUID(),
          contentId: item.id,
          sceneIndex,
          startMs: seg.startMs,
          endMs: seg.endMs,
          durationMs,
          narrationText: seg.text,
          visualAction: `Karakter utama origami dan properti kertas lipat memvisualisasikan adegan: "${seg.text.slice(
            0,
            90
          )}..." dalam diorama kertas bertekstur.`,
          cameraDirection:
            sceneIndex === 1
              ? "Close-up ke medium shot vertikal 9:16"
              : "Transisi lipatan kertas halus (stop-motion 9:16)",
          continuityNotes:
            sceneIndex === 1
              ? "Adegan pembuka diorama kertas origami."
              : `Melanjutkan visual dari Scene #${sceneIndex - 1}.`,
          promptText: "",
          expectedFilename: `${item.contentCode}_SCENE_${String(
            sceneIndex
          ).padStart(3, "0")}.mp4`,
          timestampStatus: "manually_adjusted",
          sceneStatus: "segmented",
          durationFlag:
            durationMs < 6000
              ? "too_short"
              : durationMs > 10000
              ? "too_long"
              : "ok",
          uploadedClipAssetId: null,
          createdAt: now,
          updatedAt: now,
        });
      });
    } else {
      const autoScenes = segmentNarrationIntoScenes({
        contentId: item.id,
        contentCode: item.contentCode,
        narrationText: item.narration,
        timestampStatus: "estimated",
        totalAudioDurationMs: item.targetDurationSeconds * 1000,
        minSceneSeconds: 6,
        maxSceneSeconds: 10,
      });
      allScenes.push(...autoScenes);
    }
  }

  return allScenes;
}

export function buildInitialAnalytics(
  items: ContentItemRecord[],
  ownerId: string
): ContentAnalyticsRecord[] {
  const map: Record<
    string,
    {
      youtube?: PlatformAnalyticsMetrics;
      tiktok?: PlatformAnalyticsMetrics;
      instagram?: PlatformAnalyticsMetrics;
      ai?: ContentAnalyticsRecord["aiHookEvaluation"];
    }
  > = {
    "CO-2026-001": {
      youtube: { views: 7, watchTimeHours: 0.0, subscribersGained: 0, ctrPercentage: 3.0 },
      tiktok: { views: 260 },
      instagram: { views: 115, likes: 2, saves: 1, shares: 1 },
      ai: {
        hookStrength: "moderate",
        topicCategory: "Psikologi & Pertemanan",
        keySuccessFactor: "Topik circle pertemanan resonate kuat di TikTok (260 views)",
        actionableAdvice: "Persingkat durasi pembuka dan sorot langsung rasa bersalah saat circle mengecil.",
      },
    },
    "CO-2026-002": {
      youtube: { views: 1770, watchTimeHours: 13.3, subscribersGained: 2, ctrPercentage: 0.5 },
      tiktok: { views: 279 },
      instagram: { views: 1300, likes: 79, nonFollowerPercentage: 99.8 },
      ai: {
        hookStrength: "viral",
        topicCategory: "Fakta Medis & Kebiasaan",
        keySuccessFactor: "Membahas mitos lokal 'Masuk Angin' membuat 99.8% penonton non-follower berhenti scrolling",
        actionableAdvice: "Replikasi tema mitos kesehatan Indonesia lainnya seperti kerokan atau sendi kretek.",
      },
    },
    "CO-2026-003": {
      youtube: { views: 1665, watchTimeHours: 7.9, subscribersGained: 6, ctrPercentage: 7.6 },
      tiktok: { views: 237 },
      instagram: { views: 141, likes: 4 },
      ai: {
        hookStrength: "viral",
        topicCategory: "Pola Tidur & Relatable",
        keySuccessFactor: "Konversi subscriber tertinggi (+6 subscriber di YouTube Shorts sendirian)",
        actionableAdvice: "Gunakan kontras 'Siang vs Malam' sebagai hook visual di frame pembuka.",
      },
    },
    "CO-2026-004": {
      youtube: { views: 6, watchTimeHours: 0.0, ctrPercentage: 2.9 },
      tiktok: { views: 211 },
      instagram: { views: 110, likes: 2 },
      ai: {
        hookStrength: "moderate",
        topicCategory: "Finansial & Kebiasaan",
        keySuccessFactor: "Topik Lifestyle Creep stabil di 200+ TikTok views tapi tertahan batch awal YouTube",
        actionableAdvice: "Gunakan istilah sehari-hari dibanding bahasa Inggris: 'Gaji naik tapi saldo tipis'.",
      },
    },
    "CO-2026-005": {
      youtube: { views: 1, watchTimeHours: 0.0 },
      tiktok: { views: 237 },
      instagram: { views: 141, likes: 4 },
      ai: {
        hookStrength: "strong",
        topicCategory: "Kuliner & Kebiasaan",
        keySuccessFactor: "Visual mangkuk seblak beruap kertas origami sangat disukai di Instagram",
        actionableAdvice: "Ganti judul YouTube jadi lebih padat di 20 karakter pertama.",
      },
    },
    "CO-2026-006": {
      youtube: { views: 1305, watchTimeHours: 6.6, subscribersGained: 3, ctrPercentage: 3.7 },
      tiktok: { views: 661 },
      instagram: { views: 4 },
      ai: {
        hookStrength: "viral",
        topicCategory: "Kesehatan Tulang & Postur",
        keySuccessFactor: "Topik tulang bungkuk adalah pemenang tertinggi di TikTok (661 views)",
        actionableAdvice: "Elemen panah merah dan model tulang origami sangat efektif menahan retensi.",
      },
    },
    "CO-2026-007": {
      youtube: { views: 1172, watchTimeHours: 4.5, subscribersGained: 2, ctrPercentage: 2.6 },
      tiktok: { views: 211 },
      instagram: { views: 115, likes: 2 },
      ai: {
        hookStrength: "strong",
        topicCategory: "Mindset & Self-Improvement",
        keySuccessFactor: "Topik FOMO berhasil tembus 1.1k views di YouTube",
        actionableAdvice: "Perbanyak narasi penenang kecemasan bagi generasi muda.",
      },
    },
    "CO-2026-008": {
      youtube: { views: 5, watchTimeHours: 0.0 },
      tiktok: { views: 223 },
      instagram: { views: 137, likes: 8 },
      ai: {
        hookStrength: "strong",
        topicCategory: "Biologi Tubuh & Tidur",
        keySuccessFactor: "Interaksi stabil di Instagram (8 likes/saves)",
        actionableAdvice: "Tunggu 3-5 hari untuk evaluasi batch Shorts YouTube.",
      },
    },
  };

  const now = new Date().toISOString();
  return items.map((item) => {
    const seed = map[item.contentCode] || {};
    const ytViews = seed.youtube?.views ?? 0;
    const ttViews = seed.tiktok?.views ?? 0;
    const igViews = seed.instagram?.views ?? 0;
    const totalViews = ytViews + ttViews + igViews;
    const totalInteractions =
      (seed.youtube?.likes ?? 0) +
      (seed.tiktok?.likes ?? 0) +
      (seed.instagram?.likes ?? 0) +
      (seed.instagram?.shares ?? 0) +
      (seed.instagram?.saves ?? 0);

    let topPlatform: PlatformTarget = "youtube";
    if (ttViews > ytViews && ttViews > igViews) topPlatform = "tiktok";
    else if (igViews > ytViews && igViews > ttViews) topPlatform = "instagram";

    return {
      id: crypto.randomUUID(),
      contentId: item.id,
      ownerId,
      youtube: seed.youtube,
      tiktok: seed.tiktok,
      instagram: seed.instagram,
      totalViews,
      totalInteractions,
      topPlatform,
      aiHookEvaluation: seed.ai,
      createdAt: now,
      updatedAt: now,
    };
  });
}

const storeCacheByPath = new Map<string, { data: LocalStoreData; mtime: number }>();

function readLocalStore(storePath = DEFAULT_STORE_PATH): LocalStoreData {
  const normPath = path.resolve(storePath);
  try {
    if (fs.existsSync(normPath)) {
      const stats = fs.statSync(normPath);
      const cached = storeCacheByPath.get(normPath);
      if (cached && stats.mtimeMs === cached.mtime) {
        return cached.data;
      }
      const raw = fs.readFileSync(normPath, "utf8");
      const parsed = JSON.parse(raw) as Partial<LocalStoreData>;
      if (
        parsed &&
        parsed.settingsByOwner &&
        Array.isArray(parsed.contentItems)
      ) {
        const contentAnalytics =
          Array.isArray(parsed.contentAnalytics) &&
          parsed.contentAnalytics.length > 0
            ? parsed.contentAnalytics
            : buildInitialAnalytics(parsed.contentItems, DEFAULT_OWNER_ID);

        const loaded: LocalStoreData = {
          settingsByOwner: parsed.settingsByOwner,
          contentItems: parsed.contentItems,
          batches: Array.isArray(parsed.batches) ? parsed.batches : [],
          scenes: Array.isArray(parsed.scenes) ? parsed.scenes : [],
          assets: Array.isArray(parsed.assets) ? parsed.assets : [],
          jobs: Array.isArray(parsed.jobs) ? parsed.jobs : [],
          budgetLedger: Array.isArray(parsed.budgetLedger)
            ? parsed.budgetLedger
            : [],
          publications: Array.isArray(parsed.publications)
            ? parsed.publications
            : [],
          contentAnalytics,
        };
        storeCacheByPath.set(normPath, { data: loaded, mtime: stats.mtimeMs });
        return loaded;
      }
    }
  } catch {
    // Initialize fresh store if missing or corrupted
  }

  const isTestOrTemp = normPath !== path.resolve(DEFAULT_STORE_PATH);
  const initialItems = isTestOrTemp ? buildInitialDemoItems(DEFAULT_OWNER_ID) : [];
  const initialScenes = isTestOrTemp ? buildInitialWeek1Scenes(initialItems) : [];
  const initialAnalytics = isTestOrTemp ? buildInitialAnalytics(initialItems, DEFAULT_OWNER_ID) : [];

  const initial: LocalStoreData = {
    settingsByOwner: {
      [DEFAULT_OWNER_ID]: {
        ...DEFAULT_PROJECT_SETTINGS,
        ownerId: DEFAULT_OWNER_ID,
        googleSheetUrl: "",
        googleSheetWebAppUrl: "",
        updatedAt: new Date().toISOString(),
      },
    },
    contentItems: initialItems,
    batches: [],
    scenes: initialScenes,
    assets: [],
    jobs: [],
    budgetLedger: [],
    publications: [],
    contentAnalytics: initialAnalytics,
  };
  writeLocalStore(initial, normPath);
  try {
    const mtime = fs.existsSync(normPath) ? fs.statSync(normPath).mtimeMs : Date.now();
    storeCacheByPath.set(normPath, { data: initial, mtime });
  } catch {
    storeCacheByPath.set(normPath, { data: initial, mtime: Date.now() });
  }
  return initial;
}

// In-memory TTL cache for server-side repository queries
interface RepoCacheEntry<T> {
  data: T;
  expiresAt: number;
}
const repoMemoryCache = new Map<string, RepoCacheEntry<unknown>>();

export function getFromRepoCache<T>(key: string): T | null {
  const entry = repoMemoryCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    repoMemoryCache.delete(key);
    return null;
  }
  return entry.data as T;
}

export function setToRepoCache<T>(key: string, data: T, ttlMs = 15000): void {
  repoMemoryCache.set(key, {
    data,
    expiresAt: Date.now() + ttlMs,
  });
}

export function clearRepoCache(keyPrefix?: string): void {
  if (!keyPrefix) {
    repoMemoryCache.clear();
    return;
  }
  for (const k of repoMemoryCache.keys()) {
    if (k.startsWith(keyPrefix)) {
      repoMemoryCache.delete(k);
    }
  }
}

function writeLocalStore(
  data: LocalStoreData,
  storePath = DEFAULT_STORE_PATH
): void {
  const normPath = path.resolve(storePath);
  try {
    const dir = path.dirname(normPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(normPath, JSON.stringify(data, null, 2), "utf8");
    try {
      const mtime = fs.statSync(normPath).mtimeMs;
      storeCacheByPath.set(normPath, { data, mtime });
    } catch {
      storeCacheByPath.set(normPath, { data, mtime: Date.now() });
    }
  } catch {
    // In serverless environments like Vercel, the local root file system is read-only.
    // Suppress filesystem write errors so operations on Supabase still succeed smoothly.
  }
  clearRepoCache();
}

function mapSupabaseSettingsRow(
  row: Record<string, unknown>,
  localFallback?: ProjectSettingsSummary
): ProjectSettingsSummary {
  return {
    id: String(row.id ?? ""),
    ownerId: String(row.owner_id ?? DEFAULT_OWNER_ID),
    projectName: String(
      row.project_name ?? DEFAULT_PROJECT_SETTINGS.projectName
    ),
    channelName: String(
      row.channel_name ?? DEFAULT_PROJECT_SETTINGS.channelName
    ),
    language: String(row.language ?? DEFAULT_PROJECT_SETTINGS.language),
    timezone: String(row.timezone ?? DEFAULT_PROJECT_SETTINGS.timezone),
    niche: String(row.niche ?? DEFAULT_PROJECT_SETTINGS.niche),
    toneGuide: String(row.tone_guide ?? DEFAULT_PROJECT_SETTINGS.toneGuide),
    visualStyleGuide: String(
      row.visual_style_guide ?? DEFAULT_PROJECT_SETTINGS.visualStyleGuide
    ),
    characterDescription: String(
      row.character_description ?? DEFAULT_PROJECT_SETTINGS.characterDescription
    ),
    characterReferenceAssetIds: Array.isArray(row.character_reference_asset_ids)
      ? (row.character_reference_asset_ids as string[])
      : [],
    defaultDurationSeconds: Number(
      row.default_duration_seconds ??
        DEFAULT_PROJECT_SETTINGS.defaultDurationSeconds
    ),
    targetSceneSecondsMin: Number(
      row.target_scene_seconds_min ??
        DEFAULT_PROJECT_SETTINGS.targetSceneSecondsMin
    ),
    targetSceneSecondsMax: Number(
      row.target_scene_seconds_max ??
        DEFAULT_PROJECT_SETTINGS.targetSceneSecondsMax
    ),
    outputAspectRatio: "9:16",
    outputWidth: Number(row.output_width ?? 1080),
    outputHeight: Number(row.output_height ?? 1920),
    noSubtitles: Boolean(row.no_subtitles ?? true),
    weeklyVideoTarget: Number(
      row.weekly_video_target ?? DEFAULT_PROJECT_SETTINGS.weeklyVideoTarget
    ),
    dailyBudgetLimit: Number(
      row.daily_budget_limit ?? DEFAULT_PROJECT_SETTINGS.dailyBudgetLimit
    ),
    monthlyBudgetLimit: Number(
      row.monthly_budget_limit ?? DEFAULT_PROJECT_SETTINGS.monthlyBudgetLimit
    ),
    maxSceneRetries: Number(
      row.max_scene_retries ?? DEFAULT_PROJECT_SETTINGS.maxSceneRetries
    ),
    videoGenerationMode:
      row.video_generation_mode === "api_provider"
        ? "api_provider"
        : "semi_manual_flow",
    targetPlatforms: Array.isArray(row.target_platforms)
      ? (row.target_platforms as ProjectSettingsSummary["targetPlatforms"])
      : ["tiktok", "youtube", "instagram"],
    googleSheetUrl: localFallback?.googleSheetUrl ?? "",
    googleSheetWebAppUrl: localFallback?.googleSheetWebAppUrl ?? "",
    updatedAt: row.updated_at ? String(row.updated_at) : undefined,
  };
}

function mapSupabaseContentRow(
  row: Record<string, unknown>
): ContentItemRecord {
  return {
    id: String(row.id),
    ownerId: String(row.owner_id),
    contentCode: String(row.content_code),
    title: String(row.title),
    category: String(row.category ?? "Sains & Keingintahuan"),
    topic: String(row.topic ?? ""),
    hook: String(row.hook ?? ""),
    narration: String(row.narration ?? ""),
    cta: String(row.cta ?? ""),
    tiktokCaption: String(row.tiktok_caption ?? ""),
    youtubeDescription: String(row.youtube_description ?? ""),
    instagramCaption: String(row.instagram_caption ?? ""),
    notes: String(row.notes ?? ""),
    targetDurationSeconds: Number(row.target_duration_seconds ?? 70),
    factualClaims: Array.isArray(row.factual_claims)
      ? (row.factual_claims as string[])
      : [],
    sourceUrls: Array.isArray(row.source_urls)
      ? (row.source_urls as string[])
      : [],
    verificationStatus: (row.verification_status ??
      "needs_verification") as ContentItemRecord["verificationStatus"],
    contentStatus: (row.content_status ??
      "idea") as ContentItemRecord["contentStatus"],
    sourceBatchId: row.source_batch_id ? String(row.source_batch_id) : null,
    isDemo: Boolean(row.is_demo ?? false),
    scheduledPublishAt: row.scheduled_publish_at
      ? String(row.scheduled_publish_at)
      : null,
    publishedAt: row.published_at ? String(row.published_at) : null,
    createdAt: String(row.created_at ?? new Date().toISOString()),
    updatedAt: String(row.updated_at ?? new Date().toISOString()),
  };
}

function mapSupabaseBatchRow(
  row: Record<string, unknown>
): ContentBatchRecord {
  const snapshot =
    row.settings_snapshot && typeof row.settings_snapshot === "object"
      ? (row.settings_snapshot as Record<string, unknown>)
      : {};
  const proposals = Array.isArray(snapshot.proposals)
    ? (snapshot.proposals as WeeklyPlanProposal[])
    : [];

  return {
    id: String(row.id),
    ownerId: String(row.owner_id),
    batchName: String(row.batch_name ?? "Batch Mingguan"),
    targetWeekStart: String(row.target_week_start ?? ""),
    targetVideoCount: Number(row.target_video_count ?? 2),
    status: (row.status ??
      "planning_ready") as ContentBatchRecord["status"],
    providerKey: String(snapshot.providerKey ?? "mock_llm"),
    providerModel: String(
      snapshot.providerModel ?? "ceritaobim-structured-mock-v1"
    ),
    providerRequestId: snapshot.providerRequestId
      ? String(snapshot.providerRequestId)
      : null,
    estimatedTotalCost: Number(row.estimated_total_cost ?? 0),
    actualTotalCost:
      row.actual_total_cost !== null && row.actual_total_cost !== undefined
        ? Number(row.actual_total_cost)
        : null,
    proposals,
    lastError: snapshot.lastError ? String(snapshot.lastError) : null,
    createdAt: String(row.created_at ?? new Date().toISOString()),
    startedAt: row.started_at ? String(row.started_at) : null,
    completedAt: row.completed_at ? String(row.completed_at) : null,
  };
}

function mapSupabaseSceneRow(
  row: Record<string, unknown>,
  contentCode = "CO-2026-001",
  minSec = 6,
  maxSec = 10
): SceneRecord {
  const sceneIndex = Number(row.scene_index ?? 1);
  const startMs = Number(row.start_ms ?? 0);
  const endMs = Number(row.end_ms ?? 1000);
  const durationMs = endMs - startMs;
  const meta =
    row.source_alignment_metadata &&
    typeof row.source_alignment_metadata === "object"
      ? (row.source_alignment_metadata as Record<string, unknown>)
      : {};

  const paddedIdx = String(sceneIndex).padStart(3, "0");
  const expectedFilename = String(
    meta.expectedFilename ??
      `${contentCode.toUpperCase()}_SCENE_${paddedIdx}.mp4`
  );

  const durationFlag: SceneRecord["durationFlag"] =
    durationMs < minSec * 1000
      ? "too_short"
      : durationMs > maxSec * 1000
      ? "too_long"
      : "ok";

  return {
    id: String(row.id),
    contentId: String(row.content_id),
    sceneIndex,
    startMs,
    endMs,
    durationMs,
    narrationText: String(row.narration_text ?? ""),
    visualAction: String(row.visual_action ?? ""),
    cameraDirection: String(row.camera_direction ?? ""),
    continuityNotes: String(row.continuity_notes ?? ""),
    promptText: String(row.prompt_text ?? ""),
    expectedFilename,
    timestampStatus: (row.timestamp_status ??
      "estimated") as SceneRecord["timestampStatus"],
    sceneStatus: (row.scene_status ??
      "segmented") as SceneRecord["sceneStatus"],
    durationFlag,
    uploadedClipAssetId: meta.uploadedClipAssetId
      ? String(meta.uploadedClipAssetId)
      : null,
    createdAt: String(row.created_at ?? new Date().toISOString()),
    updatedAt: String(row.updated_at ?? new Date().toISOString()),
  };
}

export async function getStorageBackendStatus(): Promise<StorageBackendStatus> {
  const supabase = createServerSupabaseAdminClient();
  if (!supabase) {
    return {
      mode: "local_file_fallback",
      supabaseConfigured: false,
      supabaseTableReady: false,
      message:
        "Kredensial Supabase belum terdeteksi. Menggunakan penyimpanan persisten lokal (.data/studio-store.json).",
    };
  }

  try {
    const { error } = await supabase
      .from("project_settings")
      .select("id")
      .limit(1);

    if (error) {
      return {
        mode: "local_file_fallback",
        supabaseConfigured: true,
        supabaseTableReady: false,
        message: `Supabase terhubung, tetapi tabel belum dimigrasikan (${error.message}). Jalankan supabase/migrations/0001_initial_schema.sql di SQL Editor Supabase. Sementara itu data disimpan di .data/studio-store.json.`,
      };
    }

    return {
      mode: "supabase_postgres",
      supabaseConfigured: true,
      supabaseTableReady: true,
      message:
        "Terhubung penuh ke database PostgreSQL Supabase (project_settings, content_items, scenes & assets siap).",
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return {
      mode: "local_file_fallback",
      supabaseConfigured: true,
      supabaseTableReady: false,
      message: `Gagal menghubungi Supabase (${msg}). Menggunakan penyimpanan lokal (.data/studio-store.json).`,
    };
  }
}

export async function getProjectSettings(
  ownerId = DEFAULT_OWNER_ID,
  options?: { storePath?: string; forceLocal?: boolean }
): Promise<ProjectSettingsSummary> {
  const cacheKey = `settings_${ownerId}`;
  if (!options?.forceLocal && !options?.storePath) {
    const cached = getFromRepoCache<ProjectSettingsSummary>(cacheKey);
    if (cached) return cached;
  }

  const store = readLocalStore(options?.storePath);
  const localSettings = store.settingsByOwner[ownerId];

  let resolved: ProjectSettingsSummary | null = null;

  if (!options?.forceLocal) {
    const supabase = createServerSupabaseAdminClient();
    if (supabase) {
      const { data, error } = await supabase
        .from("project_settings")
        .select("*")
        .eq("owner_id", ownerId)
        .maybeSingle();

      if (!error && data) {
        resolved = mapSupabaseSettingsRow(
          data as Record<string, unknown>,
          localSettings
        );
      } else if (!error && !data) {
        const defaultRow = {
          owner_id: ownerId,
          project_name: DEFAULT_PROJECT_SETTINGS.projectName,
          channel_name: DEFAULT_PROJECT_SETTINGS.channelName,
          language: DEFAULT_PROJECT_SETTINGS.language,
          timezone: DEFAULT_PROJECT_SETTINGS.timezone,
          niche: DEFAULT_PROJECT_SETTINGS.niche,
          tone_guide: DEFAULT_PROJECT_SETTINGS.toneGuide,
          visual_style_guide: DEFAULT_PROJECT_SETTINGS.visualStyleGuide,
          character_description: DEFAULT_PROJECT_SETTINGS.characterDescription,
          default_duration_seconds:
            DEFAULT_PROJECT_SETTINGS.defaultDurationSeconds,
          target_scene_seconds_min:
            DEFAULT_PROJECT_SETTINGS.targetSceneSecondsMin,
          target_scene_seconds_max:
            DEFAULT_PROJECT_SETTINGS.targetSceneSecondsMax,
          output_aspect_ratio: DEFAULT_PROJECT_SETTINGS.outputAspectRatio,
          output_width: DEFAULT_PROJECT_SETTINGS.outputWidth,
          output_height: DEFAULT_PROJECT_SETTINGS.outputHeight,
          no_subtitles: DEFAULT_PROJECT_SETTINGS.noSubtitles,
          weekly_video_target: DEFAULT_PROJECT_SETTINGS.weeklyVideoTarget,
          daily_budget_limit: DEFAULT_PROJECT_SETTINGS.dailyBudgetLimit,
          monthly_budget_limit: DEFAULT_PROJECT_SETTINGS.monthlyBudgetLimit,
          max_scene_retries: DEFAULT_PROJECT_SETTINGS.maxSceneRetries,
          video_generation_mode: DEFAULT_PROJECT_SETTINGS.videoGenerationMode,
          target_platforms: DEFAULT_PROJECT_SETTINGS.targetPlatforms,
        };
        const { data: inserted, error: insertError } = await supabase
          .from("project_settings")
          .insert(defaultRow)
          .select("*")
          .single();

        if (!insertError && inserted) {
          resolved = mapSupabaseSettingsRow(
            inserted as Record<string, unknown>,
            localSettings
          );
        }
      }
    }
  }

  if (!resolved) {
    if (localSettings) {
      resolved = localSettings;
    } else {
      const created: ProjectSettingsSummary = {
        ...DEFAULT_PROJECT_SETTINGS,
        ownerId,
        googleSheetUrl: "",
        googleSheetWebAppUrl: "",
        updatedAt: new Date().toISOString(),
      };
      store.settingsByOwner[ownerId] = created;
      writeLocalStore(store, options?.storePath);
      resolved = created;
    }
  }

  if (!options?.forceLocal && !options?.storePath && resolved) {
    setToRepoCache(cacheKey, resolved, 30000);
  }
  return resolved;
}

export async function saveProjectSettings(
  ownerId: string,
  input: ProjectSettingsInput,
  options?: { storePath?: string; forceLocal?: boolean }
): Promise<ProjectSettingsSummary> {
  const store = readLocalStore(options?.storePath);
  const current = store.settingsByOwner[ownerId] ?? DEFAULT_PROJECT_SETTINGS;
  const updatedLocal: ProjectSettingsSummary = {
    ...current,
    ...input,
    ownerId,
    googleSheetUrl: input.googleSheetUrl ?? current.googleSheetUrl ?? "",
    googleSheetWebAppUrl:
      input.googleSheetWebAppUrl ?? current.googleSheetWebAppUrl ?? "",
    updatedAt: new Date().toISOString(),
  };
  store.settingsByOwner[ownerId] = updatedLocal;
  writeLocalStore(store, options?.storePath);

  if (!options?.forceLocal) {
    const supabase = createServerSupabaseAdminClient();
    if (supabase) {
      const payload = {
        owner_id: ownerId,
        project_name: input.projectName,
        channel_name: input.channelName,
        language: input.language,
        timezone: input.timezone,
        niche: input.niche,
        tone_guide: input.toneGuide,
        visual_style_guide: input.visualStyleGuide,
        character_description: input.characterDescription,
        default_duration_seconds: input.defaultDurationSeconds,
        target_scene_seconds_min: input.targetSceneSecondsMin,
        target_scene_seconds_max: input.targetSceneSecondsMax,
        output_aspect_ratio: input.outputAspectRatio,
        output_width: input.outputWidth,
        output_height: input.outputHeight,
        no_subtitles: input.noSubtitles,
        weekly_video_target: input.weeklyVideoTarget,
        daily_budget_limit: input.dailyBudgetLimit,
        monthly_budget_limit: input.monthlyBudgetLimit,
        max_scene_retries: input.maxSceneRetries,
        video_generation_mode: input.videoGenerationMode,
        target_platforms: input.targetPlatforms,
      };

      const { data, error } = await supabase
        .from("project_settings")
        .upsert(payload, { onConflict: "owner_id" })
        .select("*")
        .single();

      if (!error && data) {
        return mapSupabaseSettingsRow(
          data as Record<string, unknown>,
          updatedLocal
        );
      }
    }
  }

  return updatedLocal;
}

export async function listContentItems(
  ownerId = DEFAULT_OWNER_ID,
  options?: {
    storePath?: string;
    forceLocal?: boolean;
    includeArchived?: boolean;
  }
): Promise<ContentItemRecord[]> {
  const cacheKey = `content_items_${ownerId}_${options?.includeArchived ? "all" : "active"}`;
  if (!options?.forceLocal && !options?.storePath) {
    const cached = getFromRepoCache<ContentItemRecord[]>(cacheKey);
    if (cached) return cached;
  }

  if (!options?.forceLocal) {
    const supabase = createServerSupabaseAdminClient();
    if (supabase) {
      let query = supabase
        .from("content_items")
        .select("*")
        .eq("owner_id", ownerId)
        .order("content_code", { ascending: true });

      if (!options?.includeArchived) {
        query = query.neq("content_status", "archived");
      }

      const { data, error } = await query;
      if (!error && Array.isArray(data)) {
        const hasOnlyLegacyDemo =
          data.length > 0 &&
          data.every(
            (r) =>
              Boolean((r as Record<string, unknown>).is_demo) ||
              String((r as Record<string, unknown>).title ?? "").startsWith(
                "[CONTOH DEMO]"
              )
          );

        if (hasOnlyLegacyDemo) {
          await supabase
            .from("content_items")
            .delete()
            .eq("owner_id", ownerId)
            .eq("is_demo", true);
          return [];
        }

        if (data.length === 0) {
          return [];
        }
        const supabaseMapped = data.map((r) =>
          mapSupabaseContentRow(r as Record<string, unknown>)
        );

        // Ensure any items saved in local store (e.g. Week 2+) that failed earlier Supabase insert are synced up
        const localStore = readLocalStore(options?.storePath);
        const supabaseCodes = new Set(
          supabaseMapped.map((i) => i.contentCode.toUpperCase())
        );
        const missingInSupabase = localStore.contentItems.filter(
          (i) =>
            i.ownerId === ownerId &&
            !i.isDemo &&
            !supabaseCodes.has(i.contentCode.toUpperCase())
        );

        if (missingInSupabase.length > 0) {
          const rowsToSync = missingInSupabase.map((d) => ({
            id: d.id,
            owner_id: ownerId,
            content_code: d.contentCode,
            title: d.title,
            category: d.category,
            topic: d.topic,
            hook: d.hook,
            narration: d.narration,
            cta: d.cta,
            tiktok_caption: d.tiktokCaption,
            youtube_description: d.youtubeDescription,
            instagram_caption: d.instagramCaption,
            notes: d.notes,
            target_duration_seconds: d.targetDurationSeconds,
            factual_claims: d.factualClaims,
            source_urls: d.sourceUrls,
            verification_status: d.verificationStatus,
            content_status: d.contentStatus,
            is_demo: false,
          }));
          await supabase
            .from("content_items")
            .upsert(rowsToSync, { onConflict: "owner_id,content_code" });

          const finalResult = [
            ...supabaseMapped,
            ...missingInSupabase,
          ].sort((a, b) => a.contentCode.localeCompare(b.contentCode));
          if (!options?.forceLocal && !options?.storePath) {
            setToRepoCache(cacheKey, finalResult, 15000);
          }
          return finalResult;
        }

        if (!options?.forceLocal && !options?.storePath) {
          setToRepoCache(cacheKey, supabaseMapped, 15000);
        }
        return supabaseMapped;
      }
    }
  }

  const store = readLocalStore(options?.storePath);
  const localResult = store.contentItems
    .filter((item) => item.ownerId === ownerId)
    .filter((item) =>
      options?.includeArchived ? true : item.contentStatus !== "archived"
    )
    .sort((a, b) => a.contentCode.localeCompare(b.contentCode));

  if (!options?.forceLocal && !options?.storePath) {
    setToRepoCache(cacheKey, localResult, 15000);
  }
  return localResult;
}

export function generateNextContentCode(
  existingItems: Pick<ContentItemRecord, "contentCode">[],
  offset = 0
): string {
  const year = new Date().getFullYear();
  let maxNumber = 0;

  for (const item of existingItems) {
    const match = item.contentCode.match(/(\d+)$/);
    if (match?.[1]) {
      const num = parseInt(match[1], 10);
      if (!Number.isNaN(num) && num > maxNumber) {
        maxNumber = num;
      }
    }
  }

  const nextNum = String(maxNumber + 1 + offset).padStart(3, "0");
  return `CO-${year}-${nextNum}`;
}

export async function createContentItem(
  ownerId: string,
  rawInput: ContentItemCreateParams,
  options?: { storePath?: string; forceLocal?: boolean }
): Promise<ContentItemRecord> {
  const input: ContentItemInput = ContentItemInputSchema.parse(rawInput);
  const safeVerificationStatus =
    input.sourceUrls.length === 0 && input.verificationStatus === "verified"
      ? "needs_verification"
      : input.verificationStatus;

  if (!options?.forceLocal) {
    const supabase = createServerSupabaseAdminClient();
    if (supabase) {
      let safeCode = input.contentCode.toUpperCase();
      const { data: existing } = await supabase
        .from("content_items")
        .select("id, content_code")
        .eq("owner_id", ownerId)
        .ilike("content_code", safeCode)
        .maybeSingle();

      if (existing) {
        const allCurrent = await listContentItems(ownerId, {
          ...options,
          includeArchived: true,
        });
        safeCode = generateNextContentCode(allCurrent, 0);
      }

      const isValidIsoTimestamp =
        input.publishedAt &&
        !Number.isNaN(Date.parse(input.publishedAt)) &&
        /^\d{4}-\d{2}-\d{2}/.test(input.publishedAt);

      const payload = {
        owner_id: ownerId,
        content_code: safeCode,
        title: input.title,
        category: input.category,
        topic: input.topic,
        hook: input.hook,
        narration: input.narration,
        cta: input.cta,
        tiktok_caption: input.tiktokCaption,
        youtube_description: input.youtubeDescription,
        instagram_caption: input.instagramCaption,
        notes: input.notes,
        target_duration_seconds: input.targetDurationSeconds,
        factual_claims: input.factualClaims,
        source_urls: input.sourceUrls,
        verification_status: safeVerificationStatus,
        content_status: input.contentStatus,
        source_batch_id: input.sourceBatchId ?? null,
        is_demo: Boolean(input.isDemo),
        scheduled_publish_at: input.scheduledPublishAt ?? null,
        published_at: isValidIsoTimestamp ? input.publishedAt : null,
      };

      const { data, error } = await supabase
        .from("content_items")
        .insert(payload)
        .select("*")
        .single();

      if (!error && data) {
        const mapped = mapSupabaseContentRow(data as Record<string, unknown>);
        // Also mirror to local store so local & Supabase stay in sync
        const store = readLocalStore(options?.storePath);
        store.contentItems = [
          ...store.contentItems.filter(
            (i) =>
              i.id !== mapped.id &&
              i.contentCode.toUpperCase() !== mapped.contentCode.toUpperCase()
          ),
          mapped,
        ];
        writeLocalStore(store, options?.storePath);
        return mapped;
      }
    }
  }

  const store = readLocalStore(options?.storePath);
  const codeConflict = store.contentItems.find(
    (item) =>
      item.ownerId === ownerId &&
      item.contentCode.toUpperCase() === input.contentCode.toUpperCase()
  );

  if (codeConflict && options?.forceLocal) {
    throw new Error(
      `DUPLICATE_CONTENT_CODE: Kode konten "${input.contentCode}" sudah terdaftar. Gunakan kode baru agar tidak menimpa konten lama.`
    );
  }

  const now = new Date().toISOString();
  const record: ContentItemRecord = {
    id: codeConflict?.id ?? crypto.randomUUID(),
    ownerId,
    contentCode: input.contentCode.toUpperCase(),
    title: input.title,
    category: input.category,
    topic: input.topic,
    hook: input.hook,
    narration: input.narration,
    cta: input.cta,
    tiktokCaption: input.tiktokCaption,
    youtubeDescription: input.youtubeDescription,
    instagramCaption: input.instagramCaption,
    notes: input.notes,
    targetDurationSeconds: input.targetDurationSeconds,
    factualClaims: input.factualClaims,
    sourceUrls: input.sourceUrls,
    verificationStatus: safeVerificationStatus,
    contentStatus: input.contentStatus,
    sourceBatchId: input.sourceBatchId ?? null,
    isDemo: Boolean(input.isDemo),
    scheduledPublishAt: input.scheduledPublishAt ?? null,
    publishedAt: input.publishedAt ?? null,
    createdAt: codeConflict?.createdAt ?? now,
    updatedAt: now,
  };

  store.contentItems = [
    ...store.contentItems.filter(
      (i) => i.contentCode.toUpperCase() !== record.contentCode.toUpperCase()
    ),
    record,
  ];
  writeLocalStore(store, options?.storePath);
  return record;
}

export async function updateContentItem(
  ownerId: string,
  input: ContentItemUpdateInput,
  options?: { storePath?: string; forceLocal?: boolean }
): Promise<ContentItemRecord> {
  if (!options?.forceLocal) {
    const supabase = createServerSupabaseAdminClient();
    if (supabase) {
      const { data: existing, error: fetchError } = await supabase
        .from("content_items")
        .select("*")
        .eq("id", input.id)
        .maybeSingle();

      if (!fetchError && existing) {
        const mappedExisting = mapSupabaseContentRow(
          existing as Record<string, unknown>
        );
        assertOwnerAccess(mappedExisting.ownerId, ownerId);

        const nextSourceUrls = input.sourceUrls ?? mappedExisting.sourceUrls;
        const requestedVerification =
          input.verificationStatus ?? mappedExisting.verificationStatus;
        const safeVerification =
          nextSourceUrls.length === 0 && requestedVerification === "verified"
            ? "needs_verification"
            : requestedVerification;

        const updatePayload: Record<string, unknown> = {
          title: input.title ?? mappedExisting.title,
          category: input.category ?? mappedExisting.category,
          topic: input.topic ?? mappedExisting.topic,
          hook: input.hook ?? mappedExisting.hook,
          narration: input.narration ?? mappedExisting.narration,
          cta: input.cta ?? mappedExisting.cta,
          tiktok_caption: input.tiktokCaption ?? mappedExisting.tiktokCaption,
          youtube_description:
            input.youtubeDescription ?? mappedExisting.youtubeDescription,
          instagram_caption:
            input.instagramCaption ?? mappedExisting.instagramCaption,
          notes: input.notes ?? mappedExisting.notes,
          target_duration_seconds:
            input.targetDurationSeconds ?? mappedExisting.targetDurationSeconds,
          factual_claims: input.factualClaims ?? mappedExisting.factualClaims,
          source_urls: nextSourceUrls,
          verification_status: safeVerification,
          content_status: input.contentStatus ?? mappedExisting.contentStatus,
        };

        if (input.scheduledPublishAt !== undefined) {
          updatePayload.scheduled_publish_at = input.scheduledPublishAt;
        }
        if (input.publishedAt !== undefined) {
          updatePayload.published_at = input.publishedAt;
        }

        const { data: updated, error: updateError } = await supabase
          .from("content_items")
          .update(updatePayload)
          .eq("id", input.id)
          .eq("owner_id", ownerId)
          .select("*")
          .single();

        if (!updateError && updated) {
          return mapSupabaseContentRow(updated as Record<string, unknown>);
        }
      }
    }
  }

  const store = readLocalStore(options?.storePath);
  const idx = store.contentItems.findIndex((i) => i.id === input.id);
  if (idx === -1) {
    throw new Error("NOT_FOUND: Konten tidak ditemukan.");
  }

  const target = store.contentItems[idx]!;
  assertOwnerAccess(target.ownerId, ownerId);

  const nextSourceUrls = input.sourceUrls ?? target.sourceUrls;
  const requestedVerification =
    input.verificationStatus ?? target.verificationStatus;
  const safeVerification =
    nextSourceUrls.length === 0 && requestedVerification === "verified"
      ? "needs_verification"
      : requestedVerification;

  const updated: ContentItemRecord = {
    ...target,
    title: input.title ?? target.title,
    category: input.category ?? target.category,
    topic: input.topic ?? target.topic,
    hook: input.hook ?? target.hook,
    narration: input.narration ?? target.narration,
    cta: input.cta ?? target.cta,
    tiktokCaption: input.tiktokCaption ?? target.tiktokCaption,
    youtubeDescription: input.youtubeDescription ?? target.youtubeDescription,
    instagramCaption: input.instagramCaption ?? target.instagramCaption,
    notes: input.notes ?? target.notes,
    targetDurationSeconds:
      input.targetDurationSeconds ?? target.targetDurationSeconds,
    factualClaims: input.factualClaims ?? target.factualClaims,
    sourceUrls: nextSourceUrls,
    verificationStatus: safeVerification,
    contentStatus: input.contentStatus ?? target.contentStatus,
    scheduledPublishAt:
      input.scheduledPublishAt !== undefined
        ? input.scheduledPublishAt
        : target.scheduledPublishAt,
    publishedAt:
      input.publishedAt !== undefined ? input.publishedAt : target.publishedAt,
    updatedAt: new Date().toISOString(),
  };

  store.contentItems[idx] = updated;
  writeLocalStore(store, options?.storePath);
  return updated;
}

export async function appendImportedContentItems(
  ownerId: string,
  itemsToAppend: ContentItemCreateParams[],
  options?: { storePath?: string; forceLocal?: boolean }
): Promise<{ insertedCount: number; skippedConflicts: string[] }> {
  let insertedCount = 0;
  const skippedConflicts: string[] = [];

  for (const item of itemsToAppend) {
    try {
      await createContentItem(ownerId, item, options);
      insertedCount++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("DUPLICATE_CONTENT_CODE")) {
        skippedConflicts.push(item.contentCode);
      } else {
        throw err;
      }
    }
  }

  return { insertedCount, skippedConflicts };
}

// =============================================================================
// Milestone 2 — Weekly Content Batches & LLM Planning Workflow
// =============================================================================

export async function listContentBatches(
  ownerId = DEFAULT_OWNER_ID,
  options?: { storePath?: string; forceLocal?: boolean }
): Promise<ContentBatchRecord[]> {
  if (!options?.forceLocal) {
    const supabase = createServerSupabaseAdminClient();
    if (supabase) {
      const { data, error } = await supabase
        .from("content_batches")
        .select("*")
        .eq("owner_id", ownerId)
        .order("created_at", { ascending: false });

      if (!error && Array.isArray(data)) {
        return data.map((row) =>
          mapSupabaseBatchRow(row as Record<string, unknown>)
        );
      }
    }
  }

  const store = readLocalStore(options?.storePath);
  return store.batches
    .filter((b) => b.ownerId === ownerId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function createAndGenerateWeeklyBatch(
  ownerId: string,
  input: CreateBatchRequest,
  options?: {
    storePath?: string;
    forceLocal?: boolean;
    llmProvider?: LLMProvider;
  }
): Promise<ContentBatchRecord> {
  const settings = await getProjectSettings(ownerId, options);
  const existingItems = await listContentItems(ownerId, {
    ...options,
    includeArchived: true,
  });

  const provider = options?.llmProvider ?? getActiveLLMProvider();
  const planResult = await provider.generateContentPlan({
    settings,
    existingItems,
    targetVideoCount: input.targetVideoCount,
    targetWeekStart: input.targetWeekStart,
    customThemeHint: input.customThemeHint,
  });

  const proposals: WeeklyPlanProposal[] = planResult.proposals.map((p, idx) => {
    const suggestedCode = generateNextContentCode(existingItems, idx);
    const duplicateWarnings = findDuplicateTopicWarnings(
      {
        title: p.title,
        topic: p.topic,
        excludeCode: suggestedCode,
      },
      existingItems
    );

    return {
      proposalId: crypto.randomUUID(),
      suggestedCode,
      title: p.title,
      category: p.category,
      topic: p.topic,
      hook: p.hook,
      narration: p.narration,
      cta: p.cta,
      tiktokCaption: p.tiktokCaption,
      youtubeDescription: p.youtubeDescription,
      instagramCaption: p.instagramCaption,
      targetDurationSeconds: p.targetDurationSeconds,
      factualClaims: p.factualClaims,
      sourceUrls: p.sourceUrls,
      verificationStatus: p.verificationStatus,
      decision: "pending",
      duplicateWarnings,
      committedContentId: null,
    };
  });

  const now = new Date().toISOString();
  const batchRecord: ContentBatchRecord = {
    id: crypto.randomUUID(),
    ownerId,
    batchName: input.batchName,
    targetWeekStart: input.targetWeekStart,
    targetVideoCount: input.targetVideoCount,
    status: "planning_ready",
    providerKey: planResult.providerKey,
    providerModel: planResult.providerModel,
    providerRequestId: planResult.providerRequestId,
    estimatedTotalCost: planResult.estimatedCostUsd,
    actualTotalCost: null,
    proposals,
    lastError: null,
    createdAt: now,
    startedAt: now,
    completedAt: null,
  };

  if (!options?.forceLocal) {
    const supabase = createServerSupabaseAdminClient();
    if (supabase) {
      const { data, error } = await supabase
        .from("content_batches")
        .insert({
          id: batchRecord.id,
          owner_id: ownerId,
          batch_name: batchRecord.batchName,
          target_week_start: batchRecord.targetWeekStart,
          target_video_count: batchRecord.targetVideoCount,
          status: batchRecord.status,
          estimated_total_cost: batchRecord.estimatedTotalCost,
          settings_snapshot: {
            settings,
            providerKey: batchRecord.providerKey,
            providerModel: batchRecord.providerModel,
            providerRequestId: batchRecord.providerRequestId,
            proposals: batchRecord.proposals,
          },
          started_at: now,
        })
        .select("*")
        .single();

      if (!error && data) {
        return mapSupabaseBatchRow(data as Record<string, unknown>);
      }
    }
  }

  const store = readLocalStore(options?.storePath);
  store.batches.unshift(batchRecord);
  writeLocalStore(store, options?.storePath);
  return batchRecord;
}

export async function updateBatchProposal(
  ownerId: string,
  params: {
    batchId: string;
    proposalId: string;
    decision?: ProposalDecision;
    title?: string;
    topic?: string;
    hook?: string;
    narration?: string;
    cta?: string;
    sourceUrls?: string[];
    factualClaims?: string[];
    regenerate?: boolean;
  },
  options?: {
    storePath?: string;
    forceLocal?: boolean;
    llmProvider?: LLMProvider;
  }
): Promise<ContentBatchRecord> {
  const batches = await listContentBatches(ownerId, options);
  const targetBatch = batches.find((b) => b.id === params.batchId);
  if (!targetBatch) {
    throw new Error("BATCH_NOT_FOUND: Batch tidak ditemukan.");
  }
  assertOwnerAccess(targetBatch.ownerId, ownerId);

  const existingItems = await listContentItems(ownerId, {
    ...options,
    includeArchived: true,
  });
  const settings = await getProjectSettings(ownerId, options);

  const updatedProposals: WeeklyPlanProposal[] = [];
  for (const prop of targetBatch.proposals) {
    if (prop.proposalId !== params.proposalId) {
      updatedProposals.push(prop);
      continue;
    }

    if (params.regenerate) {
      const provider = options?.llmProvider ?? getActiveLLMProvider();
      const regen = await provider.regenerateSingleProposal({
        settings,
        existingItems,
        targetVideoCount: 1,
        targetWeekStart: targetBatch.targetWeekStart,
        rejectedTitle: prop.title,
      });

      const dupWarnings = findDuplicateTopicWarnings(
        {
          title: regen.proposal.title,
          topic: regen.proposal.topic,
          excludeCode: prop.suggestedCode,
        },
        existingItems
      );

      updatedProposals.push({
        ...prop,
        ...regen.proposal,
        decision: "pending",
        duplicateWarnings: dupWarnings,
      });
      continue;
    }

    const nextUrls = params.sourceUrls ?? prop.sourceUrls;
    const nextClaims = params.factualClaims ?? prop.factualClaims;
    const nextTitle = params.title ?? prop.title;
    const nextTopic = params.topic ?? prop.topic;

    const dupWarnings = findDuplicateTopicWarnings(
      {
        title: nextTitle,
        topic: nextTopic,
        excludeCode: prop.suggestedCode,
      },
      existingItems
    );

    updatedProposals.push({
      ...prop,
      title: nextTitle,
      topic: nextTopic,
      hook: params.hook ?? prop.hook,
      narration: params.narration ?? prop.narration,
      cta: params.cta ?? prop.cta,
      sourceUrls: nextUrls,
      factualClaims: nextClaims,
      verificationStatus:
        nextUrls.length > 0 && nextClaims.length > 0
          ? "verified"
          : "needs_verification",
      decision: params.decision ?? prop.decision,
      duplicateWarnings: dupWarnings,
    });
  }

  const updatedBatch: ContentBatchRecord = {
    ...targetBatch,
    proposals: updatedProposals,
  };

  await persistBatchState(ownerId, updatedBatch, settings, options);
  return updatedBatch;
}

export async function commitApprovedBatchProposals(
  ownerId: string,
  batchId: string,
  options?: {
    storePath?: string;
    forceLocal?: boolean;
    commitAll?: boolean;
    targetWeekNumber?: number;
  }
): Promise<{
  batch: ContentBatchRecord;
  appendedItems: ContentItemRecord[];
}> {
  const batches = await listContentBatches(ownerId, options);
  const targetBatch = batches.find((b) => b.id === batchId);
  if (!targetBatch) {
    throw new Error("BATCH_NOT_FOUND: Batch tidak ditemukan.");
  }
  assertOwnerAccess(targetBatch.ownerId, ownerId);

  const settings = await getProjectSettings(ownerId, options);
  const appendedItems: ContentItemRecord[] = [];
  const updatedProposals: WeeklyPlanProposal[] = [];
  const year = new Date().getFullYear() || 2026;

  // Determine target week number from options or batchName (e.g. "Content Plan — Week 3")
  const batchWeekMatch = targetBatch.batchName.match(/Week\s*(\d+)/i);
  const requestedWeekNum =
    options?.targetWeekNumber ??
    (batchWeekMatch?.[1] ? parseInt(batchWeekMatch[1], 10) : null);

  let daySlotIndex = 0;

  for (const prop of targetBatch.proposals) {
    const shouldCommit =
      !prop.committedContentId &&
      (options?.commitAll
        ? prop.decision !== "rejected"
        : prop.decision === "approved");

    if (!shouldCommit) {
      updatedProposals.push(prop);
      continue;
    }

    const allCurrentItems = await listContentItems(ownerId, {
      ...options,
      includeArchived: true,
    });

    const itemsPerWeek = 21;
    let desiredCode: string;
    if (requestedWeekNum && requestedWeekNum >= 1) {
      const targetSeq = (requestedWeekNum - 1) * itemsPerWeek + daySlotIndex + 1;
      desiredCode = `CO-${year}-${String(targetSeq).padStart(3, "0")}`;
      // If this exact slot code already exists, find the next free code in or after this week
      const slotExists = allCurrentItems.some(
        (i) => i.contentCode.toUpperCase() === desiredCode.toUpperCase()
      );
      if (slotExists) {
        desiredCode = generateNextContentCode(allCurrentItems, 0);
      }
    } else {
      const codeExists = allCurrentItems.some(
        (i) => i.contentCode.toUpperCase() === prop.suggestedCode.toUpperCase()
      );
      desiredCode = codeExists
        ? generateNextContentCode(allCurrentItems, 0)
        : prop.suggestedCode;
    }

    daySlotIndex++;

    const seqMatch = desiredCode.match(/(\d+)$/);
    const seqNum = seqMatch?.[1]
      ? parseInt(seqMatch[1], 10)
      : allCurrentItems.length + 1;
    const posInWeek = (seqNum - 1) % itemsPerWeek;
    const dayInWeek = Math.floor(posInWeek / 3) + 1;
    const programSlot = (posInWeek % 3) + 1;
    const weekNumber =
      requestedWeekNum ?? Math.max(1, Math.ceil(seqNum / itemsPerWeek));

    const created = await createContentItem(
      ownerId,
      {
        contentCode: desiredCode,
        title: prop.title,
        category: prop.category,
        topic: prop.topic,
        hook: prop.hook,
        narration: prop.narration,
        cta: prop.cta,
        tiktokCaption: prop.tiktokCaption,
        youtubeDescription: prop.youtubeDescription,
        instagramCaption: prop.instagramCaption,
        notes: `Dibuat dari Batch: ${targetBatch.batchName} (${targetBatch.providerKey}/${targetBatch.providerModel})`,
        targetDurationSeconds: prop.targetDurationSeconds,
        factualClaims: prop.factualClaims,
        sourceUrls: prop.sourceUrls,
        verificationStatus: prop.verificationStatus,
        contentStatus: "script_approved",
        sourceBatchId: targetBatch.id,
        isDemo: false,
        scheduledPublishAt: prop.scheduledPublishAt ?? null,
        publishedAt: `Week ${weekNumber} • Hari ${dayInWeek} (P${programSlot}) - 19:00 WIB`,
      },
      options
    );

    // Also pre-segment narration into ~8 scenes of 10 seconds so Video menu immediately has the 8 rows
    try {
      const autoScenes = segmentNarrationIntoScenes({
        contentId: created.id,
        contentCode: created.contentCode,
        narrationText: created.narration,
        timestampStatus: "estimated",
        totalAudioDurationMs: (created.targetDurationSeconds || 80) * 1000,
        minSceneSeconds: settings.targetSceneSecondsMin,
        maxSceneSeconds: settings.targetSceneSecondsMax,
      });
      await saveScenesForContent(ownerId, created.id, autoScenes, options);
    } catch {
      // Non-fatal if scene segmentation fails
    }

    appendedItems.push(created);
    updatedProposals.push({
      ...prop,
      decision: "approved",
      suggestedCode: created.contentCode,
      committedContentId: created.id,
    });
  }

  const updatedBatch: ContentBatchRecord = {
    ...targetBatch,
    status: "approved",
    proposals: updatedProposals,
    completedAt: new Date().toISOString(),
  };

  await persistBatchState(ownerId, updatedBatch, settings, options);
  return { batch: updatedBatch, appendedItems };
}

async function persistBatchState(
  ownerId: string,
  batch: ContentBatchRecord,
  settings: ProjectSettingsSummary,
  options?: { storePath?: string; forceLocal?: boolean }
) {
  if (!options?.forceLocal) {
    const supabase = createServerSupabaseAdminClient();
    if (supabase) {
      const { error } = await supabase
        .from("content_batches")
        .update({
          status: batch.status,
          completed_at: batch.completedAt,
          settings_snapshot: {
            settings,
            providerKey: batch.providerKey,
            providerModel: batch.providerModel,
            providerRequestId: batch.providerRequestId,
            proposals: batch.proposals,
          },
        })
        .eq("id", batch.id)
        .eq("owner_id", ownerId);

      if (!error) return;
    }
  }

  const store = readLocalStore(options?.storePath);
  const idx = store.batches.findIndex((b) => b.id === batch.id);
  if (idx >= 0) {
    store.batches[idx] = batch;
  } else {
    store.batches.unshift(batch);
  }
  writeLocalStore(store, options?.storePath);
}

// =============================================================================
// Milestone 3 — Voice Assets, Alignment & Scene Segmentation Persistence
// =============================================================================

export async function listAllScenesGroupedByContent(
  ownerId: string,
  options?: { storePath?: string; forceLocal?: boolean }
): Promise<Record<string, SceneRecord[]>> {
  const cacheKey = `all_scenes_grouped_${ownerId}`;
  if (!options?.forceLocal && !options?.storePath) {
    const cached = getFromRepoCache<Record<string, SceneRecord[]>>(cacheKey);
    if (cached) return cached;
  }

  const [items, settings] = await Promise.all([
    listContentItems(ownerId, { ...options, includeArchived: true }),
    getProjectSettings(ownerId, options),
  ]);
  const itemsById = new Map(items.map((i) => [i.id, i]));
  const grouped: Record<string, SceneRecord[]> = {};
  for (const item of items) {
    grouped[item.id] = [];
  }

  if (!options?.forceLocal) {
    const supabase = createServerSupabaseAdminClient();
    if (supabase) {
      const { data, error } = await supabase
        .from("scenes")
        .select("*")
        .order("scene_index", { ascending: true });

      if (!error && Array.isArray(data)) {
        for (const r of data) {
          const row = r as Record<string, unknown>;
          const contentId = String(row.content_id ?? "");
          const content = itemsById.get(contentId);
          if (content) {
            const mapped = mapSupabaseSceneRow(
              row,
              content.contentCode,
              settings.targetSceneSecondsMin,
              settings.targetSceneSecondsMax
            );
            if (!grouped[contentId]) {
              grouped[contentId] = [];
            }
            grouped[contentId]!.push(mapped);
          }
        }
        if (!options?.storePath) {
          setToRepoCache(cacheKey, grouped, 15000);
        }
        return grouped;
      }
    }
  }

  const store = readLocalStore(options?.storePath);
  for (const sc of store.scenes) {
    if (!grouped[sc.contentId]) {
      grouped[sc.contentId] = [];
    }
    grouped[sc.contentId]!.push(sc);
  }
  for (const key of Object.keys(grouped)) {
    grouped[key]!.sort((a, b) => a.sceneIndex - b.sceneIndex);
  }

  if (!options?.forceLocal && !options?.storePath) {
    setToRepoCache(cacheKey, grouped, 15000);
  }
  return grouped;
}

export async function listScenesForContent(
  ownerId: string,
  contentId: string,
  options?: { storePath?: string; forceLocal?: boolean }
): Promise<SceneRecord[]> {
  const items = await listContentItems(ownerId, {
    ...options,
    includeArchived: true,
  });
  const content = items.find((i) => i.id === contentId);
  if (!content) {
    return [];
  }
  assertOwnerAccess(content.ownerId, ownerId);
  const settings = await getProjectSettings(ownerId, options);

  if (!options?.forceLocal) {
    const supabase = createServerSupabaseAdminClient();
    if (supabase) {
      const { data, error } = await supabase
        .from("scenes")
        .select("*")
        .eq("content_id", contentId)
        .order("scene_index", { ascending: true });

      if (!error && Array.isArray(data) && data.length > 0) {
        return data.map((r) =>
          mapSupabaseSceneRow(
            r as Record<string, unknown>,
            content.contentCode,
            settings.targetSceneSecondsMin,
            settings.targetSceneSecondsMax
          )
        );
      }
    }
  }

  const store = readLocalStore(options?.storePath);
  return store.scenes
    .filter((s) => s.contentId === contentId)
    .sort((a, b) => a.sceneIndex - b.sceneIndex);
}

export async function listAssetsForContent(
  ownerId: string,
  contentId?: string,
  options?: { storePath?: string; forceLocal?: boolean }
): Promise<AssetRecord[]> {
  const cacheKey = `assets_${ownerId}_${contentId || "all"}`;
  if (!options?.forceLocal && !options?.storePath) {
    const cached = getFromRepoCache<AssetRecord[]>(cacheKey);
    if (cached) return cached;
  }

  if (!options?.forceLocal) {
    const supabase = createServerSupabaseAdminClient();
    if (supabase) {
      let query = supabase
        .from("assets")
        .select("*")
        .eq("owner_id", ownerId)
        .order("created_at", { ascending: false });

      if (contentId) {
        query = query.eq("content_id", contentId);
      }

      const { data, error } = await query;
      if (!error && Array.isArray(data)) {
        const mappedAssets = data.map((row) => {
          const durationMs =
            row.duration_ms !== null && row.duration_ms !== undefined
              ? Number(row.duration_ms)
              : null;

          return {
            id: String(row.id),
            ownerId: String(row.owner_id),
            contentId: row.content_id ? String(row.content_id) : null,
            sceneId: row.scene_id ? String(row.scene_id) : null,
            assetType: row.asset_type as AssetRecord["assetType"],
            storagePath: String(row.storage_path),
            originalFilename: String(row.original_filename),
            mimeType: String(row.mime_type),
            sizeBytes: Number(row.size_bytes ?? 0),
            durationMs,
            width: row.width ? Number(row.width) : null,
            height: row.height ? Number(row.height) : null,
            checksum: String(row.checksum ?? ""),
            metadata:
              row.metadata && typeof row.metadata === "object"
                ? (row.metadata as Record<string, unknown>)
                : {},
            createdAt: String(row.created_at ?? new Date().toISOString()),
          };
        });

        if (!options?.storePath) {
          setToRepoCache(cacheKey, mappedAssets, 15000);
        }
        return mappedAssets;
      }
    }
  }

  const store = readLocalStore(options?.storePath);
  const localAssets = store.assets
    .filter((a) => a.ownerId === ownerId)
    .filter((a) => (contentId ? a.contentId === contentId : true))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  if (!options?.forceLocal && !options?.storePath) {
    setToRepoCache(cacheKey, localAssets, 15000);
  }
  return localAssets;
}

export async function saveVoiceAssetAndSegmentScenes(
  ownerId: string,
  params: {
    contentId: string;
    audioBuffer?: Buffer;
    originalFilename: string;
    mimeType: string;
    durationMs: number;
    providerKey: string;
    providerModel: string;
    voiceId?: string;
    providerRequestId?: string;
    wordSpans?: WordAlignmentSpan[];
    timestampStatus: TimestampStatus;
  },
  options?: { storePath?: string; forceLocal?: boolean }
): Promise<{
  voiceAsset: AssetRecord;
  scenes: SceneRecord[];
  validationReport: ReturnType<typeof validateScenesIntegrity>;
}> {
  const items = await listContentItems(ownerId, {
    ...options,
    includeArchived: true,
  });
  const content = items.find((i) => i.id === params.contentId);
  if (!content) {
    throw new Error("CONTENT_NOT_FOUND: Konten tidak ditemukan.");
  }
  assertOwnerAccess(content.ownerId, ownerId);

  const settings = await getProjectSettings(ownerId, options);
  const checksum = params.audioBuffer
    ? crypto.createHash("sha256").update(params.audioBuffer).digest("hex").slice(0, 16)
    : "metadata-only";

  // Save audio file locally in media directory so it can be previewed
  const baseDir = process.env.VERCEL
    ? path.join(os.tmpdir(), "cerita-obim-data")
    : options?.storePath
    ? path.dirname(options.storePath)
    : path.join(process.cwd(), ".data");
  const mediaDir = path.join(baseDir, "media");
  try {
    if (!fs.existsSync(mediaDir)) {
      fs.mkdirSync(mediaDir, { recursive: true });
    }
  } catch {
    // Suppress filesystem errors in readonly environments
  }
  const safeName = `${content.contentCode}_VOICE_${Date.now()}_${params.originalFilename.replace(
    /[^a-zA-Z0-9._-]/g,
    "_"
  )}`;
  const localFilePath = path.join(mediaDir, safeName);
  try {
    if (params.audioBuffer) {
      fs.writeFileSync(localFilePath, params.audioBuffer);
    }
  } catch {
    // Suppress filesystem errors in readonly environments
  }

  const now = new Date().toISOString();
  const voiceAsset: AssetRecord = {
    id: crypto.randomUUID(),
    ownerId,
    contentId: content.id,
    sceneId: null,
    assetType: "voice_audio",
    storagePath: localFilePath,
    originalFilename: params.originalFilename,
    mimeType: params.mimeType,
    sizeBytes: params.audioBuffer ? params.audioBuffer.byteLength : 0,
    durationMs: params.durationMs,
    width: null,
    height: null,
    checksum,
    metadata: {
      providerKey: params.providerKey,
      providerModel: params.providerModel,
      voiceId: params.voiceId ?? "",
      providerRequestId: params.providerRequestId ?? "",
      timestampStatus: params.timestampStatus,
    },
    createdAt: now,
  };

  let segmentedScenes: SceneRecord[] = [];
  try {
    const { transcribeAndSegmentAudioFile } = await import(
      "@/lib/providers/tts/audio-transcriber"
    );
    const transcribed = await transcribeAndSegmentAudioFile({
      contentId: content.id,
      contentCode: content.contentCode,
      fallbackNarrationText: content.narration,
      audioBuffer: params.audioBuffer,
      audioFilePath: localFilePath,
      mimeType: params.mimeType,
      totalDurationMs: params.durationMs,
    });
    segmentedScenes = transcribed.scenes;
  } catch {
    segmentedScenes = segmentNarrationIntoScenes({
      contentId: content.id,
      contentCode: content.contentCode,
      narrationText: content.narration,
      wordSpans: params.wordSpans,
      timestampStatus: params.timestampStatus,
      totalAudioDurationMs: params.durationMs,
      minSceneSeconds: settings.targetSceneSecondsMin,
      maxSceneSeconds: Math.min(9, settings.targetSceneSecondsMax),
    });
  }

  // Immediately generate Project Prompt & Per-Bagian Prompts for all transcribed parts
  try {
    const { buildPromptsForScenes } = await import(
      "@/features/scenes/prompt-generator"
    );
    const { buildActiveCharactersPromptSummary } = await import(
      "@/lib/characters/character-store"
    );
    const characterRosterSummary = buildActiveCharactersPromptSummary();
    segmentedScenes = buildPromptsForScenes({
      settings,
      content,
      scenes: segmentedScenes,
      characterRosterSummary,
    });
  } catch {
    // keep segmentedScenes
  }

  const validationReport = validateScenesIntegrity(
    content.narration,
    segmentedScenes,
    settings.targetSceneSecondsMin,
    settings.targetSceneSecondsMax
  );

  await saveScenesForContent(ownerId, content.id, segmentedScenes, options);

  // Auto-upload generated audio (.wav/.mp3) + Transcript & Prompt Pack (.txt) to Google Drive folder
  const webAppUrl = (
    settings.googleSheetWebAppUrl ||
    process.env.GOOGLE_SHEETS_WEBHOOK_URL ||
    ""
  ).trim();

  if (webAppUrl && params.audioBuffer && params.audioBuffer.byteLength > 0) {
    try {
      const { uploadContentFilesToGoogleDriveWebApp } = await import(
        "@/features/content-library/google-sheets-sync"
      );
      const { exportPromptPackAsTxt } = await import(
        "@/features/scenes/prompt-generator"
      );

      const promptTxt = exportPromptPackAsTxt(content, segmentedScenes);
      const gdriveResult = await uploadContentFilesToGoogleDriveWebApp({
        webAppUrlOrId: webAppUrl,
        item: content,
        files: [
          {
            filename: params.originalFilename,
            mimeType: params.mimeType,
            base64Data: params.audioBuffer.toString("base64"),
          },
          {
            filename: `${content.contentCode}_TRANSKRIP_DAN_PROMPT.txt`,
            mimeType: "text/plain",
            base64Data: Buffer.from(promptTxt, "utf-8").toString("base64"),
          },
        ],
      });

      voiceAsset.metadata = {
        ...voiceAsset.metadata,
        gdriveUploaded: gdriveResult.uploaded,
        gdriveNeedsScriptUpdate: Boolean(gdriveResult.needsAppsScriptUpdate),
        gdriveFolderPath: gdriveResult.folderPath,
        gdriveDayFolderUrl: gdriveResult.dayFolderUrl ?? "",
        gdriveFileUrl: gdriveResult.uploadedFiles?.[0]?.fileUrl ?? "",
        gdriveMessage: gdriveResult.message,
        gdriveSyncedAt: new Date().toISOString(),
      };
    } catch (err) {
      voiceAsset.metadata = {
        ...voiceAsset.metadata,
        gdriveUploaded: false,
        gdriveFolderPath: "",
        gdriveMessage:
          err instanceof Error
            ? err.message
            : "Gagal mengunggah audio otomatis ke Google Drive.",
      };
    }
  }

  // Persist voiceAsset
  if (!options?.forceLocal) {
    const supabase = createServerSupabaseAdminClient();
    if (supabase) {
      await supabase.from("assets").insert({
        id: voiceAsset.id,
        owner_id: ownerId,
        content_id: content.id,
        asset_type: voiceAsset.assetType,
        storage_path: voiceAsset.storagePath,
        original_filename: voiceAsset.originalFilename,
        mime_type: voiceAsset.mimeType,
        size_bytes: voiceAsset.sizeBytes,
        duration_ms: voiceAsset.durationMs,
        checksum: voiceAsset.checksum,
        metadata: voiceAsset.metadata,
      });
    }
  }

  const store = readLocalStore(options?.storePath);
  store.assets.unshift(voiceAsset);
  writeLocalStore(store, options?.storePath);

  const actualAudioDurationSeconds = Math.max(
    10,
    Math.round(params.durationMs / 1000)
  );

  await updateContentItem(
    ownerId,
    {
      id: content.id,
      contentStatus: "in_production",
      targetDurationSeconds: actualAudioDurationSeconds,
    },
    options
  );

  return {
    voiceAsset,
    scenes: segmentedScenes,
    validationReport,
  };
}

export async function syncContentAudioToGoogleDrive(
  ownerId: string,
  contentId: string,
  options?: { storePath?: string; forceLocal?: boolean }
): Promise<{
  voiceAsset: AssetRecord;
  uploaded: boolean;
  needsAppsScriptUpdate?: boolean;
  folderPath: string;
  dayFolderUrl?: string;
  message: string;
}> {
  const items = await listContentItems(ownerId, {
    ...options,
    includeArchived: true,
  });
  const content = items.find((i) => i.id === contentId);
  if (!content) {
    throw new Error("CONTENT_NOT_FOUND: Konten tidak ditemukan.");
  }
  assertOwnerAccess(content.ownerId, ownerId);

  const settings = await getProjectSettings(ownerId, options);
  const webAppUrl = (
    settings.googleSheetWebAppUrl ||
    process.env.GOOGLE_SHEETS_WEBHOOK_URL ||
    ""
  ).trim();

  if (!webAppUrl) {
    throw new Error(
      "GDRIVE_WEBAPP_MISSING: URL Web App Google Apps Script belum diatur di Content Library."
    );
  }

  const assets = await listAssetsForContent(ownerId, contentId, options);
  const voiceAsset = assets.find((a) => a.assetType === "voice_audio");
  if (!voiceAsset || !voiceAsset.storagePath || !fs.existsSync(voiceAsset.storagePath)) {
    throw new Error(
      "VOICE_ASSET_NOT_FOUND: File audio belum tersedia di disk untuk konten ini."
    );
  }

  const audioBuffer = fs.readFileSync(voiceAsset.storagePath);
  const scenes = await listScenesForContent(ownerId, contentId, options);

  const { uploadContentFilesToGoogleDriveWebApp } = await import(
    "@/features/content-library/google-sheets-sync"
  );
  const { exportPromptPackAsTxt } = await import(
    "@/features/scenes/prompt-generator"
  );

  const filesToUpload = [
    {
      filename:
        voiceAsset.originalFilename || `${content.contentCode}_VOICE.wav`,
      mimeType: voiceAsset.mimeType || "audio/wav",
      base64Data: audioBuffer.toString("base64"),
    },
  ];

  if (scenes.length > 0) {
    const promptTxt = exportPromptPackAsTxt(content, scenes);
    filesToUpload.push({
      filename: `${content.contentCode}_TRANSKRIP_DAN_PROMPT.txt`,
      mimeType: "text/plain",
      base64Data: Buffer.from(promptTxt, "utf-8").toString("base64"),
    });
  }

  const gdriveResult = await uploadContentFilesToGoogleDriveWebApp({
    webAppUrlOrId: webAppUrl,
    item: content,
    files: filesToUpload,
  });

  const updatedMetadata = {
    ...voiceAsset.metadata,
    gdriveUploaded: gdriveResult.uploaded,
    gdriveNeedsScriptUpdate: Boolean(gdriveResult.needsAppsScriptUpdate),
    gdriveFolderPath: gdriveResult.folderPath,
    gdriveDayFolderUrl: gdriveResult.dayFolderUrl ?? "",
    gdriveFileUrl: gdriveResult.uploadedFiles?.[0]?.fileUrl ?? "",
    gdriveMessage: gdriveResult.message,
    gdriveSyncedAt: new Date().toISOString(),
  };

  const store = readLocalStore(options?.storePath);
  const targetIdx = store.assets.findIndex((a) => a.id === voiceAsset.id);
  if (targetIdx !== -1 && store.assets[targetIdx]) {
    store.assets[targetIdx] = {
      ...store.assets[targetIdx]!,
      metadata: updatedMetadata,
    };
    writeLocalStore(store, options?.storePath);
  }

  const updatedVoiceAsset: AssetRecord = {
    ...voiceAsset,
    metadata: updatedMetadata,
  };

  return {
    voiceAsset: updatedVoiceAsset,
    uploaded: gdriveResult.uploaded,
    needsAppsScriptUpdate: gdriveResult.needsAppsScriptUpdate,
    folderPath: gdriveResult.folderPath,
    dayFolderUrl: gdriveResult.dayFolderUrl,
    message: gdriveResult.message,
  };
}

export async function syncContentVideosToGoogleDrive(
  ownerId: string,
  contentId: string,
  options?: { storePath?: string; forceLocal?: boolean }
): Promise<{
  assets: AssetRecord[];
  uploaded: boolean;
  needsAppsScriptUpdate?: boolean;
  folderPath: string;
  dayFolderUrl?: string;
  message: string;
  uploadedCount: number;
}> {
  const items = await listContentItems(ownerId, {
    ...options,
    includeArchived: true,
  });
  const content = items.find((i) => i.id === contentId);
  if (!content) {
    throw new Error("CONTENT_NOT_FOUND: Konten tidak ditemukan.");
  }
  assertOwnerAccess(content.ownerId, ownerId);

  const settings = await getProjectSettings(ownerId, options);
  const webAppUrl = (
    settings.googleSheetWebAppUrl ||
    process.env.GOOGLE_SHEETS_WEBHOOK_URL ||
    ""
  ).trim();

  if (!webAppUrl) {
    throw new Error(
      "GDRIVE_WEBAPP_MISSING: URL Web App Google Apps Script belum diatur di Content Library."
    );
  }

  const allAssets = await listAssetsForContent(ownerId, contentId, options);
  const videoAssets = allAssets.filter(
    (a) =>
      (a.assetType === "scene_video" || a.assetType === "final_video") &&
      Boolean(a.storagePath) &&
      fs.existsSync(a.storagePath)
  );

  if (videoAssets.length === 0) {
    return {
      assets: allAssets,
      uploaded: false,
      folderPath: "",
      message: "Belum ada file video klip atau 00Final yang siap diunggah ke Google Drive.",
      uploadedCount: 0,
    };
  }

  const { uploadContentFilesToGoogleDriveWebApp } = await import(
    "@/features/content-library/google-sheets-sync"
  );

  const store = readLocalStore(options?.storePath);
  const updatedAssets: AssetRecord[] = [];
  let successCount = 0;
  let lastFolderPath = "";
  let lastDayFolderUrl = "";
  let needsScriptUpdate = false;

  for (const asset of videoAssets) {
    try {
      const buf = fs.readFileSync(asset.storagePath);
      const gdriveResult = await uploadContentFilesToGoogleDriveWebApp({
        webAppUrlOrId: webAppUrl,
        item: content,
        files: [
          {
            filename: asset.originalFilename,
            mimeType: asset.mimeType || "video/mp4",
            base64Data: buf.toString("base64"),
          },
        ],
      });

      lastFolderPath = gdriveResult.folderPath;
      if (gdriveResult.dayFolderUrl) {
        lastDayFolderUrl = gdriveResult.dayFolderUrl;
      }
      if (gdriveResult.needsAppsScriptUpdate) {
        needsScriptUpdate = true;
      }
      if (gdriveResult.uploaded) {
        successCount++;
      }

      const fileResult = gdriveResult.uploadedFiles?.[0];
      const updatedMetadata = {
        ...asset.metadata,
        gdriveUploaded: gdriveResult.uploaded,
        gdriveNeedsScriptUpdate: Boolean(gdriveResult.needsAppsScriptUpdate),
        gdriveFolderPath: gdriveResult.folderPath,
        gdriveDayFolderUrl: gdriveResult.dayFolderUrl ?? "",
        gdriveFileUrl: fileResult?.fileUrl || gdriveResult.dayFolderUrl || "",
        gdriveMessage: gdriveResult.message,
        gdriveSyncedAt: new Date().toISOString(),
      };

      const targetIdx = store.assets.findIndex((a) => a.id === asset.id);
      if (targetIdx !== -1 && store.assets[targetIdx]) {
        store.assets[targetIdx] = {
          ...store.assets[targetIdx]!,
          metadata: updatedMetadata,
        };
      }
      updatedAssets.push({
        ...asset,
        metadata: updatedMetadata,
      });
    } catch {
      updatedAssets.push(asset);
    }
  }

  writeLocalStore(store, options?.storePath);

  return {
    assets: updatedAssets,
    uploaded: successCount > 0,
    needsAppsScriptUpdate: needsScriptUpdate,
    folderPath: lastFolderPath,
    dayFolderUrl: lastDayFolderUrl,
    message: `Berhasil mengunggah ${successCount} dari ${videoAssets.length} file video ke Google Drive.`,
    uploadedCount: successCount,
  };
}

export async function saveScenesForContent(
  ownerId: string,
  contentId: string,
  scenes: SceneRecord[],
  options?: { storePath?: string; forceLocal?: boolean }
): Promise<SceneRecord[]> {
  const items = await listContentItems(ownerId, {
    ...options,
    includeArchived: true,
  });
  const content = items.find((i) => i.id === contentId);
  if (!content) {
    throw new Error("CONTENT_NOT_FOUND: Konten tidak ditemukan.");
  }
  assertOwnerAccess(content.ownerId, ownerId);

  if (!options?.forceLocal) {
    const supabase = createServerSupabaseAdminClient();
    if (supabase) {
      await supabase.from("scenes").delete().eq("content_id", contentId);
      const rows = scenes.map((sc) => ({
        id: sc.id,
        content_id: contentId,
        scene_index: sc.sceneIndex,
        start_ms: sc.startMs,
        end_ms: sc.endMs,
        narration_text: sc.narrationText,
        visual_action: sc.visualAction,
        camera_direction: sc.cameraDirection,
        continuity_notes: sc.continuityNotes,
        prompt_text: sc.promptText,
        timestamp_status: sc.timestampStatus,
        scene_status: sc.sceneStatus,
        source_alignment_metadata: {
          expectedFilename: sc.expectedFilename,
          uploadedClipAssetId: sc.uploadedClipAssetId ?? null,
        },
      }));
      await supabase.from("scenes").insert(rows);
    }
  }

  const store = readLocalStore(options?.storePath);
  store.scenes = [
    ...store.scenes.filter((s) => s.contentId !== contentId),
    ...scenes,
  ];
  writeLocalStore(store, options?.storePath);
  return scenes;
}

export async function adjustSceneTimestampsAndText(
  ownerId: string,
  params: {
    contentId: string;
    sceneId: string;
    startMs: number;
    endMs: number;
    narrationText: string;
    visualAction?: string;
    cameraDirection?: string;
  },
  options?: { storePath?: string; forceLocal?: boolean }
) {
  const scenes = await listScenesForContent(ownerId, params.contentId, options);
  const settings = await getProjectSettings(ownerId, options);
  const items = await listContentItems(ownerId, {
    ...options,
    includeArchived: true,
  });
  const content = items.find((i) => i.id === params.contentId);
  if (!content) {
    throw new Error("CONTENT_NOT_FOUND: Konten tidak ditemukan.");
  }

  const targetIdx = scenes.findIndex((sc) => sc.id === params.sceneId);
  if (targetIdx === -1) {
    throw new Error("SCENE_NOT_FOUND: Scene tidak ditemukan.");
  }

  if (params.startMs < 0 || params.endMs <= params.startMs) {
    throw new Error(
      "Batas timestamp tidak valid: Waktu selesai harus lebih besar dari waktu mulai."
    );
  }

  const updatedScenes = scenes.map((sc) => ({ ...sc }));
  const target = { ...updatedScenes[targetIdx]! };
  const origStartMs = target.startMs;
  const origEndMs = target.endMs;

  // For scenes after the first, if startMs was not explicitly altered beyond threshold,
  // snap strictly to previous scene's endMs to avoid fractional millisecond drift
  if (targetIdx > 0) {
    if (params.startMs !== origStartMs && Math.abs(params.startMs - origStartMs) > 100) {
      target.startMs = params.startMs;
      const prev = { ...updatedScenes[targetIdx - 1]! };
      prev.endMs = target.startMs;
      if (prev.endMs <= prev.startMs) {
        prev.startMs = Math.max(0, prev.endMs - 1000);
      }
      prev.durationMs = prev.endMs - prev.startMs;
      prev.updatedAt = new Date().toISOString();
      updatedScenes[targetIdx - 1] = prev;
    } else {
      target.startMs = updatedScenes[targetIdx - 1]!.endMs;
    }
  } else {
    target.startMs = Math.max(0, params.startMs);
  }

  target.endMs = params.endMs;
  if (target.endMs <= target.startMs) {
    throw new Error(
      `Batas timestamp tidak valid: Waktu selesai (${(target.endMs / 1000).toFixed(1)}s) harus lebih besar dari waktu mulai (${(target.startMs / 1000).toFixed(1)}s).`
    );
  }

  target.durationMs = target.endMs - target.startMs;
  target.narrationText = params.narrationText || target.narrationText;
  target.visualAction = params.visualAction ?? target.visualAction;
  target.cameraDirection = params.cameraDirection ?? target.cameraDirection;
  target.timestampStatus = "manually_adjusted" as const;
  target.updatedAt = new Date().toISOString();
  updatedScenes[targetIdx] = target;

  // 1. Cascade forward if endMs changed: ALL subsequent scenes shift while preserving original duration
  if (params.endMs !== origEndMs && targetIdx + 1 < updatedScenes.length) {
    for (let j = targetIdx + 1; j < updatedScenes.length; j++) {
      const prevScene = updatedScenes[j - 1]!;
      const currScene = { ...updatedScenes[j]! };
      const origDuration = Math.max(
        1000,
        currScene.durationMs || (currScene.endMs - currScene.startMs)
      );
      currScene.startMs = prevScene.endMs;
      currScene.endMs = currScene.startMs + origDuration;
      currScene.durationMs = origDuration;
      currScene.timestampStatus = "manually_adjusted";
      currScene.updatedAt = new Date().toISOString();
      updatedScenes[j] = currScene;
    }
  }

  // 2. Cascade backward if startMs was explicitly changed backward
  if (params.startMs !== origStartMs && targetIdx > 0 && Math.abs(params.startMs - origStartMs) > 100) {
    for (let j = targetIdx - 1; j > 0; j--) {
      if (updatedScenes[j]!.startMs < updatedScenes[j - 1]!.endMs) {
        const dur = Math.max(1000, updatedScenes[j - 1]!.durationMs || 2000);
        const cascaded = { ...updatedScenes[j - 1]! };
        cascaded.endMs = updatedScenes[j]!.startMs;
        cascaded.startMs = Math.max(0, cascaded.endMs - dur);
        cascaded.durationMs = cascaded.endMs - cascaded.startMs;
        cascaded.updatedAt = new Date().toISOString();
        updatedScenes[j - 1] = cascaded;
      }
    }
  }

  // Recalculate duration flags
  for (const sc of updatedScenes) {
    const durationMs = sc.endMs - sc.startMs;
    sc.durationMs = durationMs;
    sc.durationFlag =
      durationMs < settings.targetSceneSecondsMin * 1000
        ? "too_short"
        : durationMs > settings.targetSceneSecondsMax * 1000
        ? "too_long"
        : "ok";
  }

  // Validate timestamps ordering & positive durations
  for (let i = 0; i < updatedScenes.length; i++) {
    const sc = updatedScenes[i]!;
    if (sc.startMs < 0 || sc.endMs <= sc.startMs) {
      throw new Error(
        `SCENE_VALIDATION_FAILED: Scene #${sc.sceneIndex} memiliki durasi tidak valid (${sc.startMs}ms - ${sc.endMs}ms).`
      );
    }
    if (i > 0) {
      const prev = updatedScenes[i - 1]!;
      if (sc.startMs < prev.endMs) {
        throw new Error(
          `SCENE_VALIDATION_FAILED: Scene #${sc.sceneIndex} tumpang tindih dengan Scene #${prev.sceneIndex} (${sc.startMs}ms < ${prev.endMs}ms).`
        );
      }
    }
  }

  const validationReport = validateScenesIntegrity(
    content.narration,
    updatedScenes,
    settings.targetSceneSecondsMin,
    settings.targetSceneSecondsMax
  );

  await saveScenesForContent(ownerId, params.contentId, updatedScenes, options);
  return {
    scene: updatedScenes[targetIdx],
    scenes: updatedScenes,
    validationReport,
  };
}

// =============================================================================
// Milestone 4 — Scene Prompts & Semi-Manual Google Flow Clip Ingestion
// =============================================================================

export async function generateAndSaveScenePrompts(
  ownerId: string,
  contentId: string,
  options?: {
    storePath?: string;
    forceLocal?: boolean;
    retranscribeAudio?: boolean;
  }
): Promise<SceneRecord[]> {
  const { buildPromptsForScenes } = await import(
    "@/features/scenes/prompt-generator"
  );
  const items = await listContentItems(ownerId, {
    ...options,
    includeArchived: true,
  });
  const content = items.find((i) => i.id === contentId);
  if (!content) {
    throw new Error("CONTENT_NOT_FOUND: Konten tidak ditemukan.");
  }
  assertOwnerAccess(content.ownerId, ownerId);

  const settings = await getProjectSettings(ownerId, options);
  const assets = await listAssetsForContent(ownerId, contentId, options);
  const latestVoiceAsset = assets.find((a) => a.assetType === "voice_audio");
  let scenes = await listScenesForContent(ownerId, contentId, options);

  const hasOverTenSecondsPart = scenes.some(
    (sc) => Math.round((sc.endMs - sc.startMs) / 1000) > 10
  );
  const hasFragmentedParts = scenes.some(
    (sc, idx) => idx < scenes.length - 1 && Math.round((sc.endMs - sc.startMs) / 1000) < 8
  );
  const shouldTranscribeFromAudio =
    Boolean(latestVoiceAsset?.storagePath) &&
    (Boolean(options?.retranscribeAudio) ||
      scenes.length === 0 ||
      hasOverTenSecondsPart ||
      hasFragmentedParts ||
      scenes.every((sc) => sc.timestampStatus === "estimated"));

  if (shouldTranscribeFromAudio && latestVoiceAsset?.storagePath) {
    try {
      const { transcribeAndSegmentAudioFile } = await import(
        "@/lib/providers/tts/audio-transcriber"
      );
      const transcribed = await transcribeAndSegmentAudioFile({
        contentId: content.id,
        contentCode: content.contentCode,
        fallbackNarrationText: content.narration,
        audioFilePath: latestVoiceAsset.storagePath,
        mimeType: latestVoiceAsset.mimeType || "audio/wav",
        totalDurationMs:
          latestVoiceAsset.durationMs || content.targetDurationSeconds * 1000,
      });

      // Preserve any already uploaded clip bindings by sceneIndex
      const prevByIndex = new Map(scenes.map((s) => [s.sceneIndex, s]));
      scenes = transcribed.scenes.map((sc) => {
        const prev = prevByIndex.get(sc.sceneIndex);
        if (prev?.uploadedClipAssetId) {
          return {
            ...sc,
            id: prev.id,
            uploadedClipAssetId: prev.uploadedClipAssetId,
            sceneStatus: prev.sceneStatus,
          };
        }
        return sc;
      });
    } catch {
      // Fallback to existing scenes or deterministic segmentation below
    }
  }

  // If scenes still haven't been segmented yet or were fragmented, segment strictly targeting 10s spans
  if (scenes.length === 0 || hasOverTenSecondsPart || hasFragmentedParts) {
    const fallbackDurationMs =
      latestVoiceAsset?.durationMs || content.targetDurationSeconds * 1000;
    scenes = segmentNarrationIntoScenes({
      contentId: content.id,
      contentCode: content.contentCode,
      narrationText: content.narration,
      timestampStatus: "estimated",
      totalAudioDurationMs: fallbackDurationMs,
      minSceneSeconds: 8,
      maxSceneSeconds: 10,
    });
  }

  // Re-link any existing scene_video assets so prompt regenerations never lose uploaded clip bindings
  const existingSceneClips = assets.filter((a) => a.assetType === "scene_video");
  if (existingSceneClips.length > 0) {
    scenes = scenes.map((sc) => {
      if (sc.uploadedClipAssetId) return sc;
      const matched = existingSceneClips.find(
        (a) =>
          a.sceneId === sc.id ||
          a.originalFilename === `Bagian ${sc.sceneIndex}.mp4` ||
          (a.metadata as Record<string, unknown> | undefined)?.partIndex ===
            sc.sceneIndex ||
          a.originalFilename.includes(`_Bagian_0${sc.sceneIndex}`) ||
          a.originalFilename.includes(`SCENE_00${sc.sceneIndex}`)
      );
      if (matched) {
        return {
          ...sc,
          uploadedClipAssetId: matched.id,
          sceneStatus: "clip_uploaded" as const,
        };
      }
      return sc;
    });
  }

  let characterRosterSummary = "";
  try {
    const { buildActiveCharactersPromptSummary } = await import(
      "@/lib/characters/character-store"
    );
    characterRosterSummary = buildActiveCharactersPromptSummary();
  } catch {
    characterRosterSummary = "";
  }

  const withPrompts = buildPromptsForScenes({
    settings,
    content,
    scenes,
    characterRosterSummary,
  });

  await saveScenesForContent(ownerId, contentId, withPrompts, options);
  return withPrompts;
}

export async function saveUploadedSceneClip(
  ownerId: string,
  params: {
    contentId: string;
    sceneId: string | null;
    originalFilename: string;
    mimeType: string;
    clipBuffer: Buffer;
    replaceExistingForScene?: boolean;
  },
  options?: { storePath?: string; forceLocal?: boolean }
): Promise<{
  asset: AssetRecord;
  scenes: SceneRecord[];
}> {
  const items = await listContentItems(ownerId, {
    ...options,
    includeArchived: true,
  });
  const content = items.find((i) => i.id === params.contentId);
  if (!content) {
    throw new Error("CONTENT_NOT_FOUND: Konten tidak ditemukan.");
  }
  assertOwnerAccess(content.ownerId, ownerId);

  const baseDir = process.env.VERCEL
    ? path.join(os.tmpdir(), "cerita-obim-data")
    : options?.storePath
    ? path.dirname(options.storePath)
    : path.join(process.cwd(), ".data");
  const mediaDir = path.join(baseDir, "media");
  try {
    if (!fs.existsSync(mediaDir)) {
      fs.mkdirSync(mediaDir, { recursive: true });
    }
  } catch {
    // Suppress filesystem errors in readonly environments
  }

  const existingScenes = await listScenesForContent(ownerId, content.id, options);
  const targetScene = params.sceneId
    ? existingScenes.find((s) => s.id === params.sceneId)
    : null;

  // Enforce automatic renaming to "Bagian X.mp4"
  const partNumber = targetScene ? targetScene.sceneIndex : null;
  const canonicalPartFilename =
    partNumber !== null
      ? `Bagian ${partNumber}.mp4`
      : params.originalFilename;

  const safeName =
    partNumber !== null
      ? `${content.contentCode}_Bagian_${String(partNumber).padStart(2, "0")}.mp4`
      : `${content.contentCode}_CLIP_${Date.now()}_${params.originalFilename.replace(
          /[^a-zA-Z0-9._-]/g,
          "_"
        )}`;
  const localFilePath = path.join(mediaDir, safeName);
  try {
    fs.writeFileSync(localFilePath, params.clipBuffer);
  } catch {
    // Suppress filesystem errors in readonly environments
  }

  const checksum = crypto
    .createHash("sha256")
    .update(params.clipBuffer)
    .digest("hex")
    .slice(0, 16);

  let probedDurationMs: number | null = null;
  try {
    const directBin = path.join(
      process.cwd(),
      "node_modules",
      "ffmpeg-static",
      process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg"
    );
    let staticFfmpeg: string | null = fs.existsSync(directBin) ? directBin : null;
    if (!staticFfmpeg) {
      try {
        const mod = await import("ffmpeg-static");
        staticFfmpeg = (mod as { default?: string }).default || (mod as unknown as string);
      } catch {
        // fallback
      }
    }
    if (staticFfmpeg && fs.existsSync(staticFfmpeg)) {
      const { spawnSync } = await import("child_process");
      const probe = spawnSync(staticFfmpeg, ["-i", localFilePath], {
        encoding: "utf8",
        timeout: 4000,
      });
      const match = (probe.stderr || "").match(
        /Duration: (\d{2}):(\d{2}):(\d{2})\.(\d{2})/
      );
      if (match && match[1] && match[2] && match[3] && match[4]) {
        const hours = parseInt(match[1], 10);
        const mins = parseInt(match[2], 10);
        const secs = parseFloat(`${match[3]}.${match[4]}`);
        probedDurationMs = Math.round((hours * 3600 + mins * 60 + secs) * 1000);
      }
    }
  } catch {
    // ignore
  }

  const asset: AssetRecord = {
    id: crypto.randomUUID(),
    ownerId,
    contentId: content.id,
    sceneId: params.sceneId,
    assetType: "scene_video",
    storagePath: localFilePath,
    originalFilename: canonicalPartFilename,
    mimeType: params.mimeType || "video/mp4",
    sizeBytes: params.clipBuffer.byteLength,
    durationMs: probedDurationMs,
    width: 1080,
    height: 1920,
    checksum,
    metadata: {
      sourceMode: "semi_manual_flow",
      rawUploadedFilename: params.originalFilename,
      renamedToPartName: canonicalPartFilename,
      partIndex: partNumber,
    },
    createdAt: new Date().toISOString(),
  };

  // Auto-upload the MP4 scene clip into the content item's Google Drive folder
  try {
    const settings = await getProjectSettings(ownerId, options);
    const webAppUrl = (
      settings.googleSheetWebAppUrl ||
      process.env.GOOGLE_SHEETS_WEBHOOK_URL ||
      ""
    ).trim();
    if (webAppUrl && params.clipBuffer.byteLength > 0) {
      const gdriveFilename = canonicalPartFilename;

      const { uploadContentFilesToGoogleDriveWebApp } = await import(
        "@/features/content-library/google-sheets-sync"
      );
      const gdriveRes = await uploadContentFilesToGoogleDriveWebApp({
        webAppUrlOrId: webAppUrl,
        item: content,
        files: [
          {
            filename: gdriveFilename,
            mimeType: params.mimeType || "video/mp4",
            base64Data: params.clipBuffer.toString("base64"),
          },
        ],
      });
      asset.metadata = {
        ...asset.metadata,
        gdriveUploaded: gdriveRes.uploaded,
        gdriveFolderPath: gdriveRes.folderPath,
        gdriveDayFolderUrl: gdriveRes.dayFolderUrl ?? "",
        gdriveFileUrl: gdriveRes.uploadedFiles?.[0]?.fileUrl ?? "",
        gdriveMessage: gdriveRes.message,
      };
    }
  } catch {
    // Keep local save even if Google Drive upload fails
  }

  const store = readLocalStore(options?.storePath);
  if (params.replaceExistingForScene && params.sceneId) {
    store.assets = store.assets.filter(
      (a) =>
        !(
          a.contentId === content.id &&
          a.assetType === "scene_video" &&
          a.sceneId === params.sceneId
        )
    );
  }
  store.assets.unshift(asset);
  writeLocalStore(store, options?.storePath);

  if (!options?.forceLocal) {
    const supabase = createServerSupabaseAdminClient();
    if (supabase) {
      if (params.replaceExistingForScene && params.sceneId) {
        await supabase
          .from("assets")
          .delete()
          .eq("content_id", content.id)
          .eq("asset_type", "scene_video")
          .eq("scene_id", params.sceneId);
      }
      await supabase.from("assets").insert({
        id: asset.id,
        owner_id: ownerId,
        content_id: content.id,
        scene_id: params.sceneId,
        asset_type: asset.assetType,
        storage_path: asset.storagePath,
        original_filename: asset.originalFilename,
        mime_type: asset.mimeType,
        size_bytes: asset.sizeBytes,
        width: asset.width,
        height: asset.height,
        checksum: asset.checksum,
        metadata: asset.metadata,
      });
    }
  }

  let scenes = await listScenesForContent(ownerId, content.id, options);
  if (params.sceneId) {
    scenes = scenes.map((sc) =>
      sc.id === params.sceneId
        ? {
            ...sc,
            uploadedClipAssetId: asset.id,
            sceneStatus: "clip_uploaded" as const,
            updatedAt: new Date().toISOString(),
          }
        : sc
    );
    await saveScenesForContent(ownerId, content.id, scenes, options);
  }

  return { asset, scenes };
}

// =============================================================================
// Milestone 5 — Durable Job Queue, Budget Ledger, and Video Assembly Persistence
// =============================================================================

export async function listProductionJobs(
  ownerId = DEFAULT_OWNER_ID,
  contentId?: string,
  options?: { storePath?: string; forceLocal?: boolean }
): Promise<ProductionJobRecord[]> {
  if (!options?.forceLocal) {
    const supabase = createServerSupabaseAdminClient();
    if (supabase) {
      let query = supabase
        .from("production_jobs")
        .select("*")
        .eq("owner_id", ownerId)
        .order("created_at", { ascending: false });

      if (contentId) {
        query = query.eq("content_id", contentId);
      }

      const { data, error } = await query;
      if (!error && Array.isArray(data)) {
        return data.map((row) => ({
          id: String(row.id),
          ownerId: String(row.owner_id),
          batchId: row.batch_id ? String(row.batch_id) : null,
          contentId: row.content_id ? String(row.content_id) : null,
          sceneId: row.scene_id ? String(row.scene_id) : null,
          jobType: row.job_type as JobStepType,
          status: row.status as JobStatus,
          idempotencyKey: String(row.idempotency_key ?? ""),
          inputHash: String(row.input_hash ?? ""),
          providerKey: String(row.provider_key ?? "mock"),
          providerModel: String(row.provider_model ?? ""),
          providerRequestId: String(row.provider_request_id ?? ""),
          attemptCount: Number(row.attempt_count ?? 0),
          maxAttempts: Number(row.max_attempts ?? 3),
          progressPercent: Number(row.progress_percent ?? 0),
          estimatedCost: Number(row.estimated_cost ?? 0),
          actualCost:
            row.actual_cost !== null && row.actual_cost !== undefined
              ? Number(row.actual_cost)
              : null,
          costUnit: "USD",
          outputAssetIds: Array.isArray(row.output_asset_ids)
            ? (row.output_asset_ids as string[])
            : [],
          startedAt: row.started_at ? String(row.started_at) : null,
          finishedAt: row.finished_at ? String(row.finished_at) : null,
          errorCode: row.error_code ? String(row.error_code) : null,
          safeErrorMessage: row.safe_error_message
            ? String(row.safe_error_message)
            : null,
          retryable: Boolean(row.retryable ?? true),
          createdAt: String(row.created_at ?? new Date().toISOString()),
          updatedAt: String(row.updated_at ?? new Date().toISOString()),
        }));
      }
    }
  }

  const store = readLocalStore(options?.storePath);
  return store.jobs
    .filter((j) => j.ownerId === ownerId)
    .filter((j) => (contentId ? j.contentId === contentId : true))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function saveProductionJob(
  ownerId: string,
  job: ProductionJobRecord,
  options?: { storePath?: string; forceLocal?: boolean }
): Promise<ProductionJobRecord> {
  assertOwnerAccess(job.ownerId, ownerId);

  if (!options?.forceLocal) {
    const supabase = createServerSupabaseAdminClient();
    if (supabase) {
      await supabase.from("production_jobs").upsert(
        {
          id: job.id,
          owner_id: ownerId,
          batch_id: job.batchId,
          content_id: job.contentId,
          scene_id: job.sceneId,
          job_type: job.jobType,
          status: job.status,
          idempotency_key: job.idempotencyKey,
          input_hash: job.inputHash,
          provider_key: job.providerKey,
          provider_model: job.providerModel,
          provider_request_id: job.providerRequestId,
          attempt_count: job.attemptCount,
          max_attempts: job.maxAttempts,
          progress_percent: job.progressPercent,
          estimated_cost: job.estimatedCost,
          actual_cost: job.actualCost,
          cost_unit: job.costUnit,
          output_asset_ids: job.outputAssetIds,
          started_at: job.startedAt,
          finished_at: job.finishedAt,
          error_code: job.errorCode,
          safe_error_message: job.safeErrorMessage,
          retryable: job.retryable,
        },
        { onConflict: "id" }
      );
    }
  }

  const store = readLocalStore(options?.storePath);
  const idx = store.jobs.findIndex((j) => j.id === job.id);
  if (idx >= 0) {
    store.jobs[idx] = job;
  } else {
    store.jobs.unshift(job);
  }
  writeLocalStore(store, options?.storePath);
  return job;
}

export async function listBudgetLedger(
  ownerId = DEFAULT_OWNER_ID,
  options?: { storePath?: string; forceLocal?: boolean }
): Promise<BudgetLedgerRecord[]> {
  if (!options?.forceLocal) {
    const supabase = createServerSupabaseAdminClient();
    if (supabase) {
      const { data, error } = await supabase
        .from("budget_ledger")
        .select("*")
        .eq("owner_id", ownerId)
        .order("occurred_at", { ascending: false });

      if (!error && Array.isArray(data)) {
        return data.map((row) => ({
          id: String(row.id),
          ownerId: String(row.owner_id),
          batchId: row.batch_id ? String(row.batch_id) : null,
          contentId: row.content_id ? String(row.content_id) : null,
          jobId: row.job_id ? String(row.job_id) : null,
          providerKey: String(row.provider_key ?? "manual"),
          eventType: row.event_type as BudgetEventType,
          amount: Number(row.amount ?? 0),
          unit: (row.unit as BudgetLedgerRecord["unit"]) || "USD",
          notes: String(row.notes ?? ""),
          occurredAt: String(row.occurred_at ?? new Date().toISOString()),
        }));
      }
    }
  }

  const store = readLocalStore(options?.storePath);
  return store.budgetLedger
    .filter((entry) => entry.ownerId === ownerId)
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
}

export async function addBudgetLedgerEntry(
  ownerId: string,
  params: {
    batchId?: string | null;
    contentId?: string | null;
    jobId?: string | null;
    providerKey: string;
    eventType: BudgetEventType;
    amount: number;
    unit?: "USD" | "CREDITS" | "CHARACTERS" | "SECONDS";
    notes: string;
    occurredAt?: string;
  },
  options?: { storePath?: string; forceLocal?: boolean }
): Promise<BudgetLedgerRecord> {
  const entry: BudgetLedgerRecord = {
    id: crypto.randomUUID(),
    ownerId,
    batchId: params.batchId ?? null,
    contentId: params.contentId ?? null,
    jobId: params.jobId ?? null,
    providerKey: params.providerKey,
    eventType: params.eventType,
    amount: Number(params.amount.toFixed(4)),
    unit: params.unit ?? "USD",
    notes: params.notes,
    occurredAt: params.occurredAt ?? new Date().toISOString(),
  };

  if (!options?.forceLocal) {
    const supabase = createServerSupabaseAdminClient();
    if (supabase) {
      await supabase.from("budget_ledger").insert({
        id: entry.id,
        owner_id: ownerId,
        batch_id: entry.batchId,
        content_id: entry.contentId,
        job_id: entry.jobId,
        provider_key: entry.providerKey,
        event_type: entry.eventType,
        amount: entry.amount,
        unit: entry.unit,
        notes: entry.notes,
        occurred_at: entry.occurredAt,
      });
    }
  }

  const store = readLocalStore(options?.storePath);
  store.budgetLedger.unshift(entry);
  writeLocalStore(store, options?.storePath);
  return entry;
}

/**
 * Enqueues or reuses an idempotent ProductionJobRecord, checks the Budget Guard before running
 * paid steps, and transitions the job safely without repeating already-succeeded paid work.
 */
export async function enqueueOrGetIdempotentJob(
  ownerId: string,
  params: {
    contentId: string;
    batchId?: string | null;
    sceneId?: string | null;
    jobType: JobStepType;
    inputSignature: string;
    providerKey: string;
    providerModel: string;
    estimatedCostUsd: number;
    maxAttempts?: number;
  },
  options?: { storePath?: string; forceLocal?: boolean }
): Promise<{
  job: ProductionJobRecord;
  alreadySucceeded: boolean;
  budgetBlockedReason: string | null;
}> {
  const { idempotencyKey, inputHash } = buildDeterministicIdempotencyKey({
    ownerId,
    contentId: params.contentId,
    jobType: params.jobType,
    inputSignature: params.inputSignature,
  });

  const existingJobs = await listProductionJobs(
    ownerId,
    params.contentId,
    options
  );
  const existing = existingJobs.find(
    (j) => j.idempotencyKey === idempotencyKey
  );

  // Idempotency guarantee: if already succeeded and has output assets, never re-execute paid work
  if (
    existing &&
    existing.status === "succeeded" &&
    existing.outputAssetIds.length > 0
  ) {
    return {
      job: existing,
      alreadySucceeded: true,
      budgetBlockedReason: null,
    };
  }

  const settings = await getProjectSettings(ownerId, options);
  const ledger = await listBudgetLedger(ownerId, options);
  const guard = evaluateBudgetGuard({
    settings,
    ledgerEntries: ledger,
    requestedAmountUsd: params.estimatedCostUsd,
  });

  const now = new Date().toISOString();
  const baseJob: ProductionJobRecord = existing ?? {
    id: crypto.randomUUID(),
    ownerId,
    batchId: params.batchId ?? null,
    contentId: params.contentId,
    sceneId: params.sceneId ?? null,
    jobType: params.jobType,
    status: "queued",
    idempotencyKey,
    inputHash,
    providerKey: params.providerKey,
    providerModel: params.providerModel,
    providerRequestId: "",
    attemptCount: 0,
    maxAttempts: params.maxAttempts ?? Math.max(1, settings.maxSceneRetries + 1),
    progressPercent: 0,
    estimatedCost: params.estimatedCostUsd,
    actualCost: null,
    costUnit: "USD",
    outputAssetIds: [],
    startedAt: null,
    finishedAt: null,
    errorCode: null,
    safeErrorMessage: null,
    retryable: true,
    createdAt: now,
    updatedAt: now,
  };

  if (!guard.allowed) {
    const pausedJob = transitionProductionJob(baseJob, "paused", {
      errorCode: "BUDGET_CAP_REACHED",
      safeErrorMessage: guard.reason,
    });
    await saveProductionJob(ownerId, pausedJob, options);
    return {
      job: pausedJob,
      alreadySucceeded: false,
      budgetBlockedReason: guard.reason,
    };
  }

  await saveProductionJob(ownerId, baseJob, options);
  return {
    job: baseJob,
    alreadySucceeded: false,
    budgetBlockedReason: null,
  };
}

export async function controlProductionJob(
  ownerId: string,
  params: {
    jobId: string;
    action: "pause" | "resume" | "cancel" | "retry";
  },
  options?: { storePath?: string; forceLocal?: boolean }
): Promise<ProductionJobRecord> {
  const allJobs = await listProductionJobs(ownerId, undefined, options);
  const target = allJobs.find((j) => j.id === params.jobId);
  if (!target) {
    throw new Error("JOB_NOT_FOUND: Job tidak ditemukan.");
  }
  assertOwnerAccess(target.ownerId, ownerId);

  if (params.action === "pause") {
    const next = transitionProductionJob(target, "paused");
    return saveProductionJob(ownerId, next, options);
  }

  if (params.action === "cancel") {
    const next = transitionProductionJob(target, "cancelled");
    return saveProductionJob(ownerId, next, options);
  }

  // resume or retry -> transition back to queued if allowed
  if (target.status === "succeeded" && target.outputAssetIds.length > 0) {
    // Idempotent no-op for already succeeded jobs with output assets
    return target;
  }

  const queued = transitionProductionJob(target, "queued", {
    errorCode: null,
    safeErrorMessage: null,
  });
  return saveProductionJob(ownerId, queued, options);
}

/**
 * Validates scene clips & voice audio, runs durable FFmpeg 9:16 master assembly,
 * persists the `final_video` and `assembly_log` assets, updates the job record,
 * and marks content as `ready_to_publish`.
 */
export async function runContentVideoAssembly(
  ownerId: string,
  contentId: string,
  options?: { storePath?: string; forceLocal?: boolean; forceReassemble?: boolean }
): Promise<{
  job: ProductionJobRecord;
  finalVideoAsset: AssetRecord;
  assemblyLogAsset: AssetRecord;
  assemblyResult: AssemblyValidationAndBuildResult;
}> {
  const items = await listContentItems(ownerId, {
    ...options,
    includeArchived: true,
  });
  const content = items.find((i) => i.id === contentId);
  if (!content) {
    throw new Error("CONTENT_NOT_FOUND: Konten tidak ditemukan.");
  }
  assertOwnerAccess(content.ownerId, ownerId);

  const settings = await getProjectSettings(ownerId, options);
  const scenes = await listScenesForContent(ownerId, contentId, options);
  const assets = await listAssetsForContent(ownerId, contentId, options);

  // Validate manifest first (throws clear error if clips or voice are missing/duplicated)
  const manifest = buildAndValidateAssemblyManifest({
    contentId: content.id,
    contentCode: content.contentCode,
    settings,
    scenes,
    assets,
  });

  const signature = JSON.stringify({
    contentCode: content.contentCode,
    voiceAssetId: manifest.voiceAudioAssetId,
    clips: manifest.orderedScenes.map((s) => ({
      idx: s.sceneIndex,
      clipId: s.clipAssetId,
    })),
  });

  const { job: initialJob, alreadySucceeded } =
    await enqueueOrGetIdempotentJob(
      ownerId,
      {
        contentId: content.id,
        jobType: "assemble_video",
        inputSignature: signature,
        providerKey: "ffmpeg-worker",
        providerModel: "libx264-9x16-1080x1920",
        estimatedCostUsd: 0,
      },
      options
    );

  const mediaDir = path.join(
    options?.storePath
      ? path.dirname(options.storePath)
      : path.join(process.cwd(), ".data"),
    "media"
  );

  if (alreadySucceeded && !options?.forceReassemble) {
    const existingFinalVideo = assets.find(
      (a) => a.assetType === "final_video"
    );
    const existingLog = assets.find((a) => a.assetType === "assembly_log");
    if (existingFinalVideo && existingLog) {
      const isValid = (() => {
        try {
          if (
            !fs.existsSync(existingFinalVideo.storagePath) ||
            fs.statSync(existingFinalVideo.storagePath).size < 100000
          ) {
            return false;
          }
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const { spawnSync } = require("child_process");
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const ffmpegStatic = require("ffmpeg-static");
          const probe = spawnSync(ffmpegStatic || "ffmpeg", ["-i", existingFinalVideo.storagePath], {
            encoding: "utf8",
            timeout: 3000,
          });
          const text = probe.stderr || "";
          return text.includes("Video:") && !text.includes("moov atom not found") && !text.includes("Invalid data");
        } catch {
          return false;
        }
      })();

      if (isValid) {
        const outputBuffer = fs.readFileSync(existingFinalVideo.storagePath);
        return {
          job: initialJob,
          finalVideoAsset: existingFinalVideo,
          assemblyLogAsset: existingLog,
          assemblyResult: {
            manifest,
            executionMode: "ffmpeg_binary",
            outputFilePath: existingFinalVideo.storagePath,
            outputBuffer,
            logText: "Menggunakan video master 9:16 tervalidasi yang sudah ada.",
          },
        };
      }
      const outputFilename = `${content.contentCode.toUpperCase()}_MASTER_9x16.mp4`;
      const assemblyResult = executeVideoAssembly(manifest, mediaDir, outputFilename);
      return {
        job: initialJob,
        finalVideoAsset: existingFinalVideo,
        assemblyLogAsset: existingLog,
        assemblyResult,
      };
    }
  }

  const runningJob = transitionProductionJob(initialJob, "running", {
    progressPercent: 45,
    providerRequestId: `ffmpeg-${Date.now()}`,
  });
  await saveProductionJob(ownerId, runningJob, options);

  try {
    const outputFilename = `${content.contentCode.toUpperCase()}_MASTER_9x16.mp4`;
    const assemblyResult = executeVideoAssembly(manifest, mediaDir, outputFilename);
    const safeTitle = (content.title || "").replace(/[?:/*"<>|\\]/g, "").trim();
    const finalFilename = `final-${safeTitle}.mp4`;

    // Also save local copies for convenience (00Final.mp4 and final-[Judul].mp4)
    try {
      fs.copyFileSync(
        assemblyResult.outputFilePath,
        path.join(mediaDir, "00Final.mp4")
      );
      fs.copyFileSync(
        assemblyResult.outputFilePath,
        path.join(mediaDir, finalFilename)
      );
      const ownerFinalDir = path.resolve(process.cwd(), "00.FolderOwner", "VIDEO_FINAL_MASTER");
      if (!fs.existsSync(ownerFinalDir)) fs.mkdirSync(ownerFinalDir, { recursive: true });
      fs.copyFileSync(assemblyResult.outputFilePath, path.join(ownerFinalDir, finalFilename));
    } catch {
      // ignore
    }
    const now = new Date().toISOString();

    const finalVideoAsset: AssetRecord = {
      id: crypto.randomUUID(),
      ownerId,
      contentId: content.id,
      sceneId: null,
      assetType: "final_video",
      storagePath: assemblyResult.outputFilePath,
      originalFilename: finalFilename,
      mimeType: "video/mp4",
      sizeBytes: assemblyResult.outputBuffer.byteLength,
      durationMs: manifest.totalExpectedVideoDurationMs,
      width: manifest.outputWidth,
      height: manifest.outputHeight,
      checksum: crypto
        .createHash("sha256")
        .update(assemblyResult.outputBuffer)
        .digest("hex")
        .slice(0, 16),
      metadata: {
        aspectRatio: manifest.outputAspectRatio,
        fps: manifest.fps,
        videoCodec: manifest.videoCodec,
        audioCodec: manifest.audioCodec,
        noSubtitles: manifest.noSubtitles,
        noWatermark: manifest.noWatermark,
        executionMode: assemblyResult.executionMode,
        durationWarning: manifest.durationWarning,
        sceneCount: manifest.orderedScenes.length,
      },
      createdAt: now,
    };

    // Auto-upload final video directly to the content folder on Google Drive
    try {
      const settings = await getProjectSettings(ownerId, options);
      const webAppUrl = (
        settings.googleSheetWebAppUrl ||
        process.env.GOOGLE_SHEETS_WEBHOOK_URL ||
        ""
      ).trim();
      if (webAppUrl && assemblyResult.outputBuffer.byteLength > 0) {
        const { uploadContentFilesToGoogleDriveWebApp } = await import(
          "@/features/content-library/google-sheets-sync"
        );
        const gdriveRes = await uploadContentFilesToGoogleDriveWebApp({
          webAppUrlOrId: webAppUrl,
          item: content,
          files: [
            {
              filename: finalFilename,
              mimeType: "video/mp4",
              base64Data: assemblyResult.outputBuffer.toString("base64"),
            },
          ],
        });
        finalVideoAsset.metadata = {
          ...finalVideoAsset.metadata,
          gdriveUploaded: gdriveRes.uploaded,
          gdriveFolderPath: gdriveRes.folderPath,
          gdriveDayFolderUrl: gdriveRes.dayFolderUrl ?? "",
          gdriveFileUrl: gdriveRes.uploadedFiles?.[0]?.fileUrl ?? "",
          gdriveMessage: gdriveRes.message,
        };
      }
    } catch {
      // Keep local master file even if Google Drive upload encounters network error
    }

    const logFilePath = path.join(
      mediaDir,
      `${content.contentCode.toUpperCase()}_ASSEMBLY_LOG.txt`
    );
    fs.writeFileSync(logFilePath, assemblyResult.logText, "utf8");

    const assemblyLogAsset: AssetRecord = {
      id: crypto.randomUUID(),
      ownerId,
      contentId: content.id,
      sceneId: null,
      assetType: "assembly_log",
      storagePath: logFilePath,
      originalFilename: path.basename(logFilePath),
      mimeType: "text/plain",
      sizeBytes: Buffer.byteLength(assemblyResult.logText, "utf8"),
      durationMs: null,
      width: null,
      height: null,
      checksum: crypto
        .createHash("sha256")
        .update(assemblyResult.logText)
        .digest("hex")
        .slice(0, 16),
      metadata: {
        ffmpegArgs: manifest.ffmpegArgs,
        logText: assemblyResult.logText,
      },
      createdAt: now,
    };

    // Persist assets
    const store = readLocalStore(options?.storePath);
    store.assets = store.assets.filter(
      (a) =>
        !(
          a.contentId === content.id &&
          (a.assetType === "final_video" || a.assetType === "assembly_log")
        )
    );
    store.assets.unshift(finalVideoAsset, assemblyLogAsset);
    writeLocalStore(store, options?.storePath);

    if (!options?.forceLocal) {
      const supabase = createServerSupabaseAdminClient();
      if (supabase) {
        await supabase
          .from("assets")
          .delete()
          .eq("content_id", content.id)
          .in("asset_type", ["final_video", "assembly_log"]);
        await supabase.from("assets").insert([
          {
            id: finalVideoAsset.id,
            owner_id: ownerId,
            content_id: content.id,
            asset_type: finalVideoAsset.assetType,
            storage_path: finalVideoAsset.storagePath,
            original_filename: finalVideoAsset.originalFilename,
            mime_type: finalVideoAsset.mimeType,
            size_bytes: finalVideoAsset.sizeBytes,
            duration_ms: finalVideoAsset.durationMs,
            width: finalVideoAsset.width,
            height: finalVideoAsset.height,
            checksum: finalVideoAsset.checksum,
            metadata: finalVideoAsset.metadata,
          },
          {
            id: assemblyLogAsset.id,
            owner_id: ownerId,
            content_id: content.id,
            asset_type: assemblyLogAsset.assetType,
            storage_path: assemblyLogAsset.storagePath,
            original_filename: assemblyLogAsset.originalFilename,
            mime_type: assemblyLogAsset.mimeType,
            size_bytes: assemblyLogAsset.sizeBytes,
            checksum: assemblyLogAsset.checksum,
            metadata: assemblyLogAsset.metadata,
          },
        ]);
      }
    }

    const succeededJob = transitionProductionJob(runningJob, "succeeded", {
      progressPercent: 100,
      actualCost: 0,
      outputAssetIds: [finalVideoAsset.id, assemblyLogAsset.id],
    });
    await saveProductionJob(ownerId, succeededJob, options);

    await updateContentItem(
      ownerId,
      { id: content.id, contentStatus: "ready_to_publish" },
      options
    );

    return {
      job: succeededJob,
      finalVideoAsset,
      assemblyLogAsset,
      assemblyResult,
    };
  } catch (err) {
    const safeMsg =
      err instanceof Error ? err.message : "Gagal merakit video akhir.";
    const failedJob = transitionProductionJob(runningJob, "failed", {
      errorCode: "FFMPEG_ASSEMBLY_ERROR",
      safeErrorMessage: safeMsg,
    });
    await saveProductionJob(ownerId, failedJob, options);
    throw err;
  }
}

// =============================================================================
// Milestone 6 — Platform Publications & Full Project Export
// =============================================================================

function buildDefaultChecklist(platform: PlatformName): Record<string, boolean> {
  if (platform === "tiktok") {
    return {
      videoMaster9x16Uploaded: false,
      captionAndHashtagsCopied: false,
      coverFrameSelected: false,
      soundCopyrightChecked: false,
    };
  }
  if (platform === "youtube") {
    return {
      videoMaster9x16Uploaded: false,
      titleAndDescriptionCopied: false,
      notMadeForKidsSelected: false,
      visibilityScheduledOrPublic: false,
    };
  }
  return {
    videoMaster9x16Uploaded: false,
    captionCopied: false,
    shareToFeedEnabled: false,
    coverFrameAdjusted: false,
  };
}

export async function listOrInitializePublications(
  ownerId: string,
  contentId?: string,
  options?: { storePath?: string; forceLocal?: boolean }
): Promise<PlatformPublicationRecord[]> {
  const cacheKey = `pubs_${ownerId}_${contentId || "all"}`;
  if (!options?.forceLocal && !options?.storePath) {
    const cached = getFromRepoCache<PlatformPublicationRecord[]>(cacheKey);
    if (cached) return cached;
  }

  const items = await listContentItems(ownerId, {
    ...options,
    includeArchived: false,
  });
  const targetItems = contentId
    ? items.filter((i) => i.id === contentId)
    : items;

  const store = readLocalStore(options?.storePath);
  const platforms: PlatformName[] = ["tiktok", "youtube", "instagram"];
  let mutated = false;

  for (const item of targetItems) {
    const assets = store.assets.filter((a) => a.contentId === item.id);
    const finalVideo = assets.find((a) => a.assetType === "final_video");

    for (const platform of platforms) {
      const existing = store.publications.find(
        (p) => p.contentId === item.id && p.platform === platform
      );
      if (!existing) {
        const now = new Date().toISOString();
        const hashtags =
          "#ceritaobim #faktaunik #faktasains #origamistopmotion #edukasishorts";
        const record: PlatformPublicationRecord = {
          id: crypto.randomUUID(),
          contentId: item.id,
          platform,
          ExportAssetId: finalVideo?.id ?? null,
          titleOrHook:
            platform === "youtube"
              ? `${item.title.replace(/^\[CONTOH DEMO\]\s*/i, "")} #Shorts`
              : item.hook,
          captionText:
            platform === "tiktok"
              ? item.tiktokCaption || `${item.hook}\n\n${item.cta}`
              : platform === "youtube"
              ? item.youtubeDescription || `${item.hook}\n\n${item.narration}`
              : item.instagramCaption || `${item.hook}\n\n${item.cta}`,
          hashtags,
          ctaText: item.cta,
          checklist: buildDefaultChecklist(platform),
          scheduledAt: null,
          publishStatus:
            finalVideo || item.contentStatus === "ready_to_publish"
              ? "ready_for_manual_upload"
              : "draft",
          publishedAt: null,
          externalPostUrl: "",
          notes: "",
          createdAt: now,
          updatedAt: now,
        };
        store.publications.push(record);
        mutated = true;
      } else if (finalVideo && !existing.ExportAssetId) {
        existing.ExportAssetId = finalVideo.id;
        if (existing.publishStatus === "draft") {
          existing.publishStatus = "ready_for_manual_upload";
        }
        mutated = true;
      }
    }
  }

  if (mutated) {
    writeLocalStore(store, options?.storePath);
  }

  const result = store.publications.filter((p) =>
    contentId
      ? p.contentId === contentId
      : targetItems.some((i) => i.id === p.contentId)
  );

  if (!options?.forceLocal && !options?.storePath) {
    setToRepoCache(cacheKey, result, 15000);
  }
  return result;
}

export async function updatePlatformPublication(
  ownerId: string,
  params: {
    publicationId: string;
    titleOrHook?: string;
    captionText?: string;
    hashtags?: string;
    ctaText?: string;
    checklist?: Record<string, boolean>;
    scheduledAt?: string | null;
    publishStatus?: PublishStatus;
    externalPostUrl?: string;
    notes?: string;
  },
  options?: { storePath?: string; forceLocal?: boolean }
): Promise<PlatformPublicationRecord> {
  const store = readLocalStore(options?.storePath);
  const idx = store.publications.findIndex(
    (p) => p.id === params.publicationId
  );
  if (idx === -1) {
    throw new Error("PUBLICATION_NOT_FOUND: Paket publikasi tidak ditemukan.");
  }

  const target = store.publications[idx]!;
  const content = store.contentItems.find((c) => c.id === target.contentId);
  if (content) {
    assertOwnerAccess(content.ownerId, ownerId);
  }

  const now = new Date().toISOString();
  const nextStatus = params.publishStatus ?? target.publishStatus;
  const publishedAt =
    nextStatus === "published"
      ? target.publishedAt ?? now
      : nextStatus === "draft" || nextStatus === "ready_for_manual_upload"
      ? null
      : target.publishedAt;

  const updated: PlatformPublicationRecord = {
    ...target,
    titleOrHook: params.titleOrHook ?? target.titleOrHook,
    captionText: params.captionText ?? target.captionText,
    hashtags: params.hashtags ?? target.hashtags,
    ctaText: params.ctaText ?? target.ctaText,
    checklist: params.checklist ?? target.checklist,
    scheduledAt:
      params.scheduledAt !== undefined ? params.scheduledAt : target.scheduledAt,
    publishStatus: nextStatus,
    publishedAt,
    externalPostUrl: params.externalPostUrl ?? target.externalPostUrl,
    notes: params.notes ?? target.notes,
    updatedAt: now,
  };

  store.publications[idx] = updated;
  writeLocalStore(store, options?.storePath);

  if (!options?.forceLocal) {
    const supabase = createServerSupabaseAdminClient();
    if (supabase) {
      await supabase.from("platform_publications").upsert(
        {
          id: updated.id,
          content_id: updated.contentId,
          platform: updated.platform,
          export_asset_id: updated.ExportAssetId,
          title_or_hook: updated.titleOrHook,
          caption_text: updated.captionText,
          hashtags: updated.hashtags,
          cta_text: updated.ctaText,
          checklist: updated.checklist,
          scheduled_at: updated.scheduledAt,
          publish_status: updated.publishStatus,
          published_at: updated.publishedAt,
          external_post_url: updated.externalPostUrl,
          notes: updated.notes,
        },
        { onConflict: "content_id,platform" }
      );
    }
  }

  // If all 3 platforms for this content are marked published, mark content_item as published
  const allForContent = store.publications.filter(
    (p) => p.contentId === updated.contentId
  );
  if (
    allForContent.length >= 3 &&
    allForContent.every((p) => p.publishStatus === "published")
  ) {
    await updateContentItem(
      ownerId,
      { id: updated.contentId, contentStatus: "published" },
      options
    );
  }

  return updated;
}

export async function exportFullProjectJson(
  ownerId = DEFAULT_OWNER_ID,
  options?: { storePath?: string; forceLocal?: boolean }
) {
  const settings = await getProjectSettings(ownerId, options);
  const contentItems = await listContentItems(ownerId, {
    ...options,
    includeArchived: true,
  });
  const batches = await listContentBatches(ownerId, options);
  const jobs = await listProductionJobs(ownerId, undefined, options);
  const budgetLedger = await listBudgetLedger(ownerId, options);
  const publications = await listOrInitializePublications(
    ownerId,
    undefined,
    options
  );
  const store = readLocalStore(options?.storePath);

  return {
    exportedAt: new Date().toISOString(),
    studioVersion: "1.0.0",
    ownerId,
    settings,
    contentItems,
    batches,
    scenes: store.scenes.filter((s) =>
      contentItems.some((c) => c.id === s.contentId)
    ),
    assets: store.assets.filter((a) => a.ownerId === ownerId),
    jobs,
    budgetLedger,
    publications,
    contentAnalytics: store.contentAnalytics,
  };
}

// ---------------------------------------------------------------------------
// Cross-Platform Content Analytics Service
// ---------------------------------------------------------------------------

export async function listContentAnalytics(
  ownerId = DEFAULT_OWNER_ID,
  options?: { storePath?: string; forceLocal?: boolean }
): Promise<ContentAnalyticsRecord[]> {
  const store = readLocalStore(options?.storePath);
  const items = await listContentItems(ownerId, options);

  // Ensure every content item has an analytics record
  const existingMap = new Map(store.contentAnalytics.map((a) => [a.contentId, a]));
  let hasChanges = false;
  const now = new Date().toISOString();

  for (const item of items) {
    if (!existingMap.has(item.id)) {
      const newRec: ContentAnalyticsRecord = {
        id: crypto.randomUUID(),
        contentId: item.id,
        ownerId,
        youtube: undefined,
        tiktok: undefined,
        instagram: undefined,
        totalViews: 0,
        totalInteractions: 0,
        topPlatform: "youtube",
        createdAt: now,
        updatedAt: now,
      };
      store.contentAnalytics.push(newRec);
      existingMap.set(item.id, newRec);
      hasChanges = true;
    }
  }

  if (hasChanges) {
    writeLocalStore(store, options?.storePath);
  }

  return store.contentAnalytics.filter((a) => a.ownerId === ownerId);
}

export async function upsertContentAnalytics(
  ownerId = DEFAULT_OWNER_ID,
  input: {
    contentId: string;
    youtube?: Partial<PlatformAnalyticsMetrics>;
    tiktok?: Partial<PlatformAnalyticsMetrics>;
    instagram?: Partial<PlatformAnalyticsMetrics>;
    aiHookEvaluation?: ContentAnalyticsRecord["aiHookEvaluation"];
  },
  options?: { storePath?: string; forceLocal?: boolean }
): Promise<ContentAnalyticsRecord> {
  const store = readLocalStore(options?.storePath);
  const now = new Date().toISOString();

  let existing = store.contentAnalytics.find(
    (a) => a.contentId === input.contentId && a.ownerId === ownerId
  );

  const mergedYoutube = input.youtube !== undefined
    ? {
        views: input.youtube.views ?? existing?.youtube?.views ?? 0,
        watchTimeHours: input.youtube.watchTimeHours ?? existing?.youtube?.watchTimeHours ?? 0,
        averagePercentageViewed: input.youtube.averagePercentageViewed ?? existing?.youtube?.averagePercentageViewed,
        ctrPercentage: input.youtube.ctrPercentage ?? existing?.youtube?.ctrPercentage,
        subscribersGained: input.youtube.subscribersGained ?? existing?.youtube?.subscribersGained,
        likes: input.youtube.likes ?? existing?.youtube?.likes,
        comments: input.youtube.comments ?? existing?.youtube?.comments,
        shares: input.youtube.shares ?? existing?.youtube?.shares,
        lastUpdated: now,
      }
    : existing?.youtube;

  const mergedTiktok = input.tiktok !== undefined
    ? {
        views: input.tiktok.views ?? existing?.tiktok?.views ?? 0,
        averageWatchTimeSeconds: input.tiktok.averageWatchTimeSeconds ?? existing?.tiktok?.averageWatchTimeSeconds,
        averagePercentageViewed: input.tiktok.averagePercentageViewed ?? existing?.tiktok?.averagePercentageViewed,
        likes: input.tiktok.likes ?? existing?.tiktok?.likes,
        comments: input.tiktok.comments ?? existing?.tiktok?.comments,
        shares: input.tiktok.shares ?? existing?.tiktok?.shares,
        saves: input.tiktok.saves ?? existing?.tiktok?.saves,
        lastUpdated: now,
      }
    : existing?.tiktok;

  const mergedInstagram = input.instagram !== undefined
    ? {
        views: input.instagram.views ?? existing?.instagram?.views ?? 0,
        reach: input.instagram.reach ?? existing?.instagram?.reach,
        nonFollowerPercentage: input.instagram.nonFollowerPercentage ?? existing?.instagram?.nonFollowerPercentage,
        averageWatchTimeSeconds: input.instagram.averageWatchTimeSeconds ?? existing?.instagram?.averageWatchTimeSeconds,
        likes: input.instagram.likes ?? existing?.instagram?.likes,
        comments: input.instagram.comments ?? existing?.instagram?.comments,
        shares: input.instagram.shares ?? existing?.instagram?.shares,
        saves: input.instagram.saves ?? existing?.instagram?.saves,
        lastUpdated: now,
      }
    : existing?.instagram;

  const ytViews = mergedYoutube?.views ?? 0;
  const ttViews = mergedTiktok?.views ?? 0;
  const igViews = mergedInstagram?.views ?? 0;
  const totalViews = ytViews + ttViews + igViews;

  const totalInteractions =
    (mergedYoutube?.likes ?? 0) +
    (mergedYoutube?.comments ?? 0) +
    (mergedYoutube?.shares ?? 0) +
    (mergedTiktok?.likes ?? 0) +
    (mergedTiktok?.comments ?? 0) +
    (mergedTiktok?.shares ?? 0) +
    (mergedTiktok?.saves ?? 0) +
    (mergedInstagram?.likes ?? 0) +
    (mergedInstagram?.comments ?? 0) +
    (mergedInstagram?.shares ?? 0) +
    (mergedInstagram?.saves ?? 0);

  let topPlatform: PlatformTarget = "youtube";
  if (ttViews > ytViews && ttViews > igViews) topPlatform = "tiktok";
  else if (igViews > ytViews && igViews > ttViews) topPlatform = "instagram";

  if (existing) {
    existing.youtube = mergedYoutube;
    existing.tiktok = mergedTiktok;
    existing.instagram = mergedInstagram;
    existing.totalViews = totalViews;
    existing.totalInteractions = totalInteractions;
    existing.topPlatform = topPlatform;
    if (input.aiHookEvaluation) {
      existing.aiHookEvaluation = input.aiHookEvaluation;
    }
    existing.updatedAt = now;
  } else {
    existing = {
      id: crypto.randomUUID(),
      contentId: input.contentId,
      ownerId,
      youtube: mergedYoutube,
      tiktok: mergedTiktok,
      instagram: mergedInstagram,
      totalViews,
      totalInteractions,
      topPlatform,
      aiHookEvaluation: input.aiHookEvaluation,
      createdAt: now,
      updatedAt: now,
    };
    store.contentAnalytics.push(existing);
  }

  writeLocalStore(store, options?.storePath);
  return existing;
}

export async function getAnalyticsSummary(
  ownerId = DEFAULT_OWNER_ID,
  options?: { storePath?: string; forceLocal?: boolean }
): Promise<AnalyticsSummary> {
  const analyticsList = await listContentAnalytics(ownerId, options);
  const items = await listContentItems(ownerId, options);
  const itemMap = new Map(items.map((i) => [i.id, i]));

  let totalYoutubeViews = 0;
  let totalTiktokViews = 0;
  let totalInstagramViews = 0;
  let totalWatchTimeHours = 0;
  let totalInteractions = 0;
  let totalSubscribersGained = 0;

  let topRecord: ContentAnalyticsRecord | null = null;

  for (const a of analyticsList) {
    const yViews = a.youtube?.views ?? 0;
    const tViews = a.tiktok?.views ?? 0;
    const iViews = a.instagram?.views ?? 0;

    totalYoutubeViews += yViews;
    totalTiktokViews += tViews;
    totalInstagramViews += iViews;

    totalWatchTimeHours += a.youtube?.watchTimeHours ?? 0;
    totalInteractions += a.totalInteractions;
    totalSubscribersGained += a.youtube?.subscribersGained ?? 0;

    if (!topRecord || a.totalViews > topRecord.totalViews) {
      topRecord = a;
    }
  }

  const totalViews = totalYoutubeViews + totalTiktokViews + totalInstagramViews;

  let topPerformingContent: AnalyticsSummary["topPerformingContent"] = null;
  if (topRecord && topRecord.totalViews > 0) {
    const item = itemMap.get(topRecord.contentId);
    if (item) {
      topPerformingContent = {
        contentCode: item.contentCode,
        title: item.title,
        totalViews: topRecord.totalViews,
        platform: topRecord.topPlatform ?? "youtube",
      };
    }
  }

  return {
    totalViews,
    totalYoutubeViews,
    totalTiktokViews,
    totalInstagramViews,
    totalWatchTimeHours: Number(totalWatchTimeHours.toFixed(1)),
    totalInteractions,
    totalSubscribersGained,
    topPerformingContent,
  };
}



