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
  // ==========================================
  // PROGRAM 1: Ke Dapur Yuk! (Kuliner & Makanan)
  // ==========================================
  {
    title: "Kenapa Bawang Merah Bikin Mata Perih dan Nangis?",
    programName: "Ke Dapur Yuk!",
    category: "Sains Makanan & Dapur",
    topic: "Reaksi enzim alliinase dan gas syn-propanethial-S-oxide saat mengiris sel bawang merah",
    hook: "Tiap kali iris bawang merah di dapur, mata lo pasti langsung perih terus banjir air mata.",
    narration:
      "0-10:\nTiap kali iris bawang merah di dapur, mata lo pasti langsung perih terus banjir air mata. Ke Dapur Yuk!\n\n11-20:\nSaat sel bawang terpotong, enzim alliinase bereaksi membentuk gas syn-propanethial-S-oxide. Gas ini menyatu dengan lapisan air mata menghasilkan asam sulfat encer.\n\n21-28:\nOtak langsung memerintahkan kelenjar air mata membanjiri mata buat membilas asam itu. Trik jitunya: dinginkan bawang di kulkas sebelum diiris!",
    cta: "Pernah punya trik sendiri biar nggak nangis pas iris bawang? Tulis di komentar!",
    tiktokCaption:
      "Kenapa iris bawang merah bikin nangis sesenggukan? Ini reaksi kimia di balik air mata bawang! #ceritaobim #kedapuryuk #faktamakanan #origamistopmotion",
    youtubeDescription:
      "Penjelasan kimia tentang enzim alliinase dan gas syn-propanethial-S-oxide pada bawang merah. Program: Ke Dapur Yuk! Visual origami stop-motion.",
    instagramCaption:
      "Bukan cengeng! Ini alasan ilmiah kenapa mata langsung perih pas ngiris bawang di dapur. #ceritaobim #kedapuryuk #faktaunik",
    targetDurationSeconds: 28,
    factualClaims: [
      "Enzim alliinase dan asam amino sulfoksida pada bawang bereaksi membentuk gas syn-propanethial-S-oxide saat sel terpotong.",
    ],
    sourceUrls: [
      "https://www.loc.gov/everyday-mysteries/chemistry/item/why-does-chopping-an-onion-make-you-cry/",
    ],
    verificationStatus: "verified",
  },
  {
    title: "Kenapa Nasi Dingin Lebih Rendah Kalori dari Nasi Panas?",
    programName: "Ke Dapur Yuk!",
    category: "Nutrisi & Sains Pangan",
    topic: "Proses retrogradasi pati dan pembentukan resistant starch pada nasi yang didinginkan",
    hook: "Nasi yang udah didinginkan semalaman ternyata kalorinya lebih rendah daripada pas baru matang.",
    narration:
      "0-10:\nNasi yang udah didinginkan semalaman ternyata kalorinya lebih rendah daripada pas baru matang. Ke Dapur Yuk!\n\n11-20:\nSaat nasi dingin, molekul patinya mengalami proses retrogradasi menjadi pati resisten. Pati jenis ini kebal terhadap enzim pencernaan usus halus kita.\n\n21-28:\nArtinya karbohidratnya tidak diserap jadi gula, melainkan jadi prebiotik bagi bakteri baik usus. Kamu tim nasi anget pulen atau nasi dingin?",
    cta: "Kamu tim nasi hangat pulen atau nasi dingin yang lebih rendah kalori? Komen di bawah!",
    tiktokCaption:
      "Makan nasi dingin ternyata kalorinya lebih rendah loh! Kok bisa? Simak penjelasannya! #ceritaobim #kedapuryuk #dietsehat #faktagizi #origamistopmotion",
    youtubeDescription:
      "Proses ilmiah pembentukan resistant starch pada nasi putih dingin dan manfaatnya untuk kalori tubuh. Program: Ke Dapur Yuk!",
    instagramCaption:
      "Nasi dingin vs nasi panas: mana yang lebih ramah buat diet? Cek faktanya di Ke Dapur Yuk! #ceritaobim #kedapuryuk #nutrisi",
    targetDurationSeconds: 28,
    factualClaims: [
      "Pendinginan nasi matang selama 12–24 jam pada suhu 4°C memicu retrogradasi pati menjadi resistant starch tipe 3 yang menurunkan penyerapan kalori hingga 10–15%.",
    ],
    sourceUrls: [
      "https://www.acs.org/pressroom/newsreleases/2015/march/rice.html",
    ],
    verificationStatus: "verified",
  },
  {
    title: "Kenapa Daging Sate Berubah Cokelat dan Harum Banget?",
    programName: "Ke Dapur Yuk!",
    category: "Teknik Memasak & Sains",
    topic: "Reaksi Maillard antara asam amino dan gula pereduksi pada daging yang dipanggang di atas arang",
    hook: "Aroma sate yang lagi dibakar di atas arang tuh baunya bikin auto lapar seketika.",
    narration:
      "0-10:\nAroma sate yang lagi dibakar di atas arang tuh baunya bikin auto lapar seketika. Ke Dapur Yuk!\n\n11-20:\nIni bukan sihir bumbu rahasia, tapi Reaksi Maillard. Asam amino daging bereaksi dengan gula pereduksi saat terkena panas api di atas 140 derajat Celcius.\n\n21-28:\nReaksi kimia ini melahirkan ratusan molekul volatil baru yang gurih dengan warna cokelat karamel yang menggoda selera. Sate ayam atau sate kambing favoritmu?",
    cta: "Lebih suka aroma sate ayam manis atau sate kambing gurih? Tulis di komentar!",
    tiktokCaption:
      "Aroma wangi sate bakar dari mana asalnya? Kenalan sama Reaksi Maillard di dapur! #ceritaobim #kedapuryuk #kulinerindonesia #sainsmakanan",
    youtubeDescription:
      "Sains di balik aroma sate panggang dan reaksi kimia Maillard pada daging olahan. Program: Ke Dapur Yuk!",
    instagramCaption:
      "Bikin ngiler! Ini reaksi kimia yang bikin daging sate bakar harum dan gurih luar biasa. #ceritaobim #kedapuryuk #kuliner",
    targetDurationSeconds: 28,
    factualClaims: [
      "Reaksi Maillard terjadi pada suhu 140–165°C antara gugus amino asam amino dan gugus karbonil gula pereduksi menghasilkan senyawa aroma melanoidin.",
    ],
    sourceUrls: [
      "https://www.sciencedirect.com/topics/food-science/maillard-reaction",
    ],
    verificationStatus: "verified",
  },
  {
    title: "Rahasia Tempe: Kenapa Kedelai Bisa Jadi Superfood Padat?",
    programName: "Ke Dapur Yuk!",
    category: "Kuliner Tradisional & Fermentasi",
    topic: "Peran miselium jamur Rhizopus oligosporus dalam fermentasi kedelai menjadi tempe bernutrisi tinggi",
    hook: "Kedelai mentah itu keras dan susah dicerna, tapi pas jadi tempe teksturnya empuk dan nutrisinya melonjak.",
    narration:
      "0-10:\nKedelai mentah itu keras dan susah dicerna, tapi pas jadi tempe teksturnya empuk dan nutrisinya melonjak. Ke Dapur Yuk!\n\n11-20:\nRahasia ada pada kapang Rhizopus oligosporus. Benang putih miseliumnya merajut biji kedelai jadi satu blok padat sekaligus memecah asam fitat dan protein kompleks.\n\n21-28:\nFermentasi asli warisan leluhur Nusantara ini bikin protein tempe bahkan lebih gampang diserap tubuh dibanding kedelai rebus biasa. Bangga punya tempe!",
    cta: "Menu olahan tempe favoritmu apa nih: tempe mendoan atau orek tempe? Tulis di komentar!",
    tiktokCaption:
      "Warisan superfood asli Indonesia! Kenapa tempe jauh lebih bergizi daripada kedelai biasa? #ceritaobim #kedapuryuk #tempe #kulinerindonesia",
    youtubeDescription:
      "Rahasia mikrobiologi di balik fermentasi tempe tradisional Indonesia dan kapang Rhizopus. Program: Ke Dapur Yuk!",
    instagramCaption:
      "Dari biji keras jadi superfood dunia! Ini keajaiban fermentasi tempe asli Indonesia. #ceritaobim #kedapuryuk #faktaunik",
    targetDurationSeconds: 28,
    factualClaims: [
      "Fermentasi Rhizopus oligosporus mendegradasi asam fitat kedelai dan meningkatkan ketersediaan hayati zat besi, seng, serta protein.",
    ],
    sourceUrls: ["https://fdc.nal.usda.gov/"],
    verificationStatus: "verified",
  },
  {
    title: "Kenapa Coto Makassar Punya Kuah Gurih yang Kental Alami?",
    programName: "Ke Dapur Yuk!",
    category: "Kuliner Daerah & Sejarah",
    topic: "Penggunaan kacang tanah sangrai giling dan air tajin beras dalam kuah tradisional Coto Makassar",
    hook: "Kuah Coto Makassar itu kental gurih dan punya rempah yang sangat khas dan pekat.",
    narration:
      "0-10:\nKuah Coto Makassar itu kental gurih dan punya rempah yang sangat khas dan pekat. Ke Dapur Yuk!\n\n11-20:\nKekentalan legendaris ini bukan berasal dari santan kelapa, melainkan kacang tanah sangrai yang digiling halus bersama rebusan air tajin cucian beras dan 40 jenis rempah pappare.\n\n21-28:\nLemak nabati kacang beremulsi sempurna dengan kaldu daging sapi, melahirkan cita rasa gurih otentik sejak abad ke-16. Kamu wajib coba pakai ketupat daun pandan!",
    cta: "Udah pernah cobain Coto Makassar otentik pakai ketupat? Tulis pengalamanmu di komentar!",
    tiktokCaption:
      "Kuah kental Coto Makassar ternyata bukan dari santan kelapa loh! Mau tahu rahasianya? #ceritaobim #kedapuryuk #cotomakassar #kulinerdaerah",
    youtubeDescription:
      "Asal-usul kekentalan dan rempah pappare pada kuah Coto Makassar tradisional. Program: Ke Dapur Yuk!",
    instagramCaption:
      "Bukan santan! Ini rahasia kuah Coto Makassar yang gurih kental sejak abad ke-16. #ceritaobim #kedapuryuk #makanannusantara",
    targetDurationSeconds: 28,
    factualClaims: [
      "Resep tradisional Coto Makassar menggunakan kacang tanah sangrai yang digiling halus dan air tajin beras untuk mengentalkan kuah tanpa santan.",
    ],
    sourceUrls: ["https://id.wikipedia.org/wiki/Coto_Makassar"],
    verificationStatus: "verified",
  },
  {
    title: "Kenapa Kopi Tubruk Terasa Lebih Tebal dan Pekat di Lidah?",
    programName: "Ke Dapur Yuk!",
    category: "Minuman & Sains Kopi",
    topic: "Pelarutan minyak alami cafestol dan kahweol pada seduhan kopi tubruk tanpa saringan kertas",
    hook: "Beda sama kopi saring biasa, kopi tubruk punya rasa pekat dan lapisan minyak gurih di atasnya.",
    narration:
      "0-10:\nBeda sama kopi saring biasa, kopi tubruk punya rasa pekat dan lapisan minyak gurih di atasnya. Ke Dapur Yuk!\n\n11-20:\nKertas filter biasa menyerap senyawa lipid kopi seperti cafestol dan kahweol. Karena tubruk diseduh langsung dengan air mendidih tanpa filter, minyak aromatiknya ikut larut utuh.\n\n21-28:\nInilah yang memberikan sensasi 'body' atau kekentalan tebal di lidah dan aroma yang tertinggal lama. Minum kopi tubruk kamu pakai gula atau kopi pahit?",
    cta: "Kopi tubruk kamu tim pakai gula manis atau kopi hitam pahit mantap? Komen di bawah!",
    tiktokCaption:
      "Kenapa kopi tubruk rasanya jauh lebih 'nendang' di lidah? Ini penjelasannya! #ceritaobim #kedapuryuk #kopitubruk #sainskopi",
    youtubeDescription:
      "Penjelasan sains di balik sensasi body pekat dan minyak alami kopi tubruk tanpa saringan kertas. Program: Ke Dapur Yuk!",
    instagramCaption:
      "Minyak berkilau di atas kopi tubruk itu apa sih? Yuk kenalan sama cafestol di Ke Dapur Yuk! #ceritaobim #kedapuryuk #kopi",
    targetDurationSeconds: 28,
    factualClaims: [
      "Penyeduhan kopi tanpa saringan kertas (unfiltered coffee) meloloskan senyawa diterpen cafestol dan kahweol yang memperkaya body dan aroma.",
    ],
    sourceUrls: ["https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6488344/"],
    verificationStatus: "verified",
  },
  {
    title: "Kenapa Cabai Bikin Mulut Pedas Tapi Es Teh Manis Nggak Nolong?",
    programName: "Ke Dapur Yuk!",
    category: "Biologi Rasa & Dapur",
    topic: "Sifat hidrofobik molekul capsaicin dan efektivitas protein kasein pada susu sebagai penawar pedas",
    hook: "Pas kepedesan sambal, refleks kita pasti buru-buru minum es teh manis, tapi pedasnya nggak ilang.",
    narration:
      "0-10:\nPas kepedesan sambal, refleks kita pasti minum es teh manis, tapi pedasnya kok nggak ilang juga? Ke Dapur Yuk!\n\n11-20:\nSensasi pedas dipicu zat kimia capsaicin yang bersifat non-polar alias larut dalam lemak, bukan air. Es teh manis cuma menyapu permukaan lidah sesaat.\n\n21-28:\nPenawar aslinya adalah susu atau es krim! Protein kasein pada susu bertindak seperti sabun alami yang mengikat dan mengangkat capsaicin dari reseptor lidah.",
    cta: "Kalau kepedesan sambal level dewa, biasanya kamu minum apa buat redain? Tulis di komentar!",
    tiktokCaption:
      "Kepedesan sambal minum es teh manis malah makin nyiksa? Ini trik ilmiah redain pedas! #ceritaobim #kedapuryuk #pedas #faktasains",
    youtubeDescription:
      "Mengapa air es tidak menghilangkan pedas capsaicin dan mengapa kasein susu adalah penawar terbaik. Program: Ke Dapur Yuk!",
    instagramCaption:
      "Jangan minum es teh pas kepedesan! Ini penjelasan molekul capsaicin di lidah kita. #ceritaobim #kedapuryuk #kuliner",
    targetDurationSeconds: 28,
    factualClaims: [
      "Capsaicin adalah senyawa lipofilik yang tidak larut dalam air dingin; kasein pada produk susu mengikat capsaicin dan membersihkannya dari reseptor TRPV1.",
    ],
    sourceUrls: [
      "https://www.acs.org/education/resources/highschool/chemmatters/past-issues/2013-2014/december-2013/peppers.html",
    ],
    verificationStatus: "verified",
  },

  // ==========================================
  // PROGRAM 2: Kepikiran Aja (Psikologi & Pertanyaan Sebelum Tidur)
  // ==========================================
  {
    title: "Kenapa Kita Suka Kepikiran Percakapan Lama Pas Mau Tidur?",
    programName: "Kepikiran Aja",
    category: "Psikologi & Otak",
    topic: "Fenomena rumination dan aktifnya Default Mode Network (DMN) saat rangsangan eksternal minim di malam hari",
    hook: "Pas badan udah rebahan di kasur dan lampu mati, tiba-tiba otak muter ulang kejadian memalukan lima tahun lalu.",
    narration:
      "0-10:\nPas badan udah rebahan di kasur dan lampu mati, tiba-tiba otak muter ulang kejadian memalukan lima tahun lalu. Kepikiran Aja...\n\n11-20:\nIni namanya fenomena rumination. Saat rangsangan lingkungan berkurang di malam hari, Default Mode Network di otak aktif dan mulai membedah arsip ingatan sosial masa lalu.\n\n21-28:\nOtak lo cuma lagi berusaha belajar agar kesalahan itu nggak terulang lagi. Jadi tenang, orang lain juga udah lama lupa kejadian itu kok.",
    cta: "Kejadian memalukan apa yang paling sering muter di kepala lo pas mau tidur? Tulis di komentar!",
    tiktokCaption:
      "Lagi mau tidur malah kepikiran obrolan canggung masa lalu? Ini penjelasan psikologinya! #ceritaobim #kepikiranaja #psikologi #relatable #origamistopmotion",
    youtubeDescription:
      "Mengapa otak mengulang memori sosial canggung sebelum tidur (rumination & Default Mode Network). Program: Kepikiran Aja.",
    instagramCaption:
      "Lampu mati, mata merem, otak malah muter bioskop rasa bersalah. Tenang, lo nggak sendirian! #ceritaobim #kepikiranaja #faktaunik",
    targetDurationSeconds: 28,
    factualClaims: [
      "Aktivitas Default Mode Network (DMN) meningkat saat istirahat pasif tanpa tugas kognitif eksternal, memicu ingatan otobiografis dan evaluasi diri.",
    ],
    sourceUrls: ["https://www.psychologytoday.com/us/basics/rumination"],
    verificationStatus: "verified",
  },
  {
    title: "Kenapa Kita Merasa Semua Orang Lagi Ngeliatin Kita?",
    programName: "Kepikiran Aja",
    category: "Psikologi Sosial",
    topic: "Fenomena Spotlight Effect dan bias egosentris dalam interaksi sosial sehari-hari",
    hook: "Lagi jalan sendirian terus kepeleset dikit, rasanya satu ruangan langsung ngeliatin dan ngetawain.",
    narration:
      "0-10:\nLagi jalan sendirian terus kepeleset dikit, rasanya seisi ruangan langsung ngeliatin dan ngetawain. Kepikiran Aja...\n\n11-20:\nDalam psikologi, ini disebut Spotlight Effect. Kita cenderung melebih-lebihkan seberapa banyak orang lain memperhatikan penampilan atau kesalahan kecil kita.\n\n21-28:\nFaktanya, sebagian besar orang terlalu sibuk memikirkan rasa cemas diri mereka sendiri. Jadi rileks, sorotan panggung itu cuma ada di kepala kita.",
    cta: "Pernah ngerasa disorot seisi ruangan gara-gara hal sepele? Ceritain di komentar!",
    tiktokCaption:
      "Semua orang merhatiin kesalahan kecil kita? Nggak juga kok! Kenalan sama Spotlight Effect! #ceritaobim #kepikiranaja #psikologi #overthinking",
    youtubeDescription:
      "Penjelasan ilmiah tentang bias egosentris dan Spotlight Effect menurut psikolog Thomas Gilovich. Program: Kepikiran Aja.",
    instagramCaption:
      "Stop overthinking! Ternyata orang lain nggak sefokus itu merhatiin kecanggungan kita. #ceritaobim #kepikiranaja #selfimprovement",
    targetDurationSeconds: 28,
    factualClaims: [
      "Penelitian Thomas Gilovich dari Cornell University menunjukkan manusia melebih-lebihkan perhatian orang lain terhadap diri mereka hingga 50%.",
    ],
    sourceUrls: ["https://www.apa.org/monitor/oct05/spotlight"],
    verificationStatus: "verified",
  },
  {
    title: "Kenapa Tugas yang Super Gampang Malah Paling Sering Ditunda?",
    programName: "Kepikiran Aja",
    category: "Kebiasaan & Perilaku",
    topic: "Regulasi emosi jangka pendek dan persepsi kebosanan otak terhadap tugas-tugas mikro",
    hook: "Cuma butuh balas satu chat singkat atau rapihin meja, tapi bisa kita tunda sampai tiga hari.",
    narration:
      "0-10:\nCuma butuh balas satu chat singkat atau rapihin meja, tapi bisa kita tunda sampai tiga hari. Kepikiran Aja...\n\n11-20:\nPenundaan ini bukan karena malas fisik, melainkan masalah regulasi emosi. Otak menganggap tugas sepele itu membosankan dan tidak memberi lonjakan dopamin instan.\n\n21-28:\nTerapkan aturan dua menit: kalau tugas bisa beres dalam dua menit, langsung selesaikan saat itu juga tanpa berpikir. Apa tugas kecil yang lagi kamu tunda?",
    cta: "Apa satu tugas super sepele yang lagi lo tunda dari kemarin? Ngaku di komentar!",
    tiktokCaption:
      "Kenapa tugas 2 menit rasanya lebih berat dari lari maraton? Ini trik mengatasinya! #ceritaobim #kepikiranaja #procrastination #psikologi",
    youtubeDescription:
      "Sains di balik penundaan tugas mikro (prokrastinasi emosional) dan cara mengatasinya. Program: Kepikiran Aja.",
    instagramCaption:
      "Cuma bales chat doang tapi ditunda berhari-hari? Otakmu sedang bermasalah dengan regulasi emosi! #ceritaobim #kepikiranaja #produktivitas",
    targetDurationSeconds: 28,
    factualClaims: [
      "Prokrastinasi dipicu oleh kegagalan regulasi emosi jangka pendek (mood repair) terhadap stres atau kebosanan tugas, bukan kelemahan manajemen waktu.",
    ],
    sourceUrls: [
      "https://www.psychologicalscience.org/observer/why-wait-the-science-behind-procrastination",
    ],
    verificationStatus: "verified",
  },
  {
    title: "Kenapa Ide Cemerlang Malah Sering Muncul Pas Lagi Mandi?",
    programName: "Kepikiran Aja",
    category: "Sains Kreativitas",
    topic: "Aktivitas motorik autopilot, pelepasan dopamin, dan asosiasi bebas di kamar mandi",
    hook: "Mikir di depan laptop berjam-jam buntu, tapi pas lagi keramas air hangat tiba-tiba solusinya ketemu.",
    narration:
      "0-10:\nMikir di depan laptop berjam-jam buntu, tapi pas lagi keramas air hangat tiba-tiba solusinya ketemu. Kepikiran Aja...\n\n11-20:\nSaat mandi, tubuh rileks dan otak melepaskan hormon dopamin. Aktivitas motorik autopilot membiarkan pikiran melamun tanpa sensor ketat korteks prefrontal.\n\n21-28:\nMomen eureka terjadi saat fokus kita melonggar, membiarkan ide-ide acak terhubung bebas. Jadi kalau lagi buntu, istirahatkan kepalamu sejenak!",
    cta: "Ide paling random apa yang pernah tiba-tiba muncul di kepala lo pas lagi mandi? Tulis di komen!",
    tiktokCaption:
      "Kenapa kamar mandi tempat terbaik nyari ide brilian? Ini penjelasan ilmiahnya! #ceritaobim #kepikiranaja #kreativitas #otakmanusia",
    youtubeDescription:
      "Mengapa momen eureka sering terjadi saat mandi atau melamun rileks. Program: Kepikiran Aja.",
    instagramCaption:
      "Laptop ditutup, ide malah meluap di kamar mandi! Ini cara kerja dopamin saat relaksasi. #ceritaobim #kepikiranaja #inspirasi",
    targetDurationSeconds: 28,
    factualClaims: [
      "Kondisi rileks saat mandi meningkatkan pelepasan dopamin yang memfasilitasi divergensi kognitif dan pembentukan asosiasi kreatif baru.",
    ],
    sourceUrls: [
      "https://www.scientificamerican.com/article/why-do-we-get-our-best-ideas-in-the-shower/",
    ],
    verificationStatus: "verified",
  },
  {
    title: "Kenapa Suara Rekaman Sendiri Terdengar Asing dan Bikin Malu?",
    programName: "Kepikiran Aja",
    category: "Persepsi & Suara",
    topic: "Perbedaan konduksi tulang vs konduksi udara saat mendengarkan pita suara sendiri",
    hook: "Pernah denger pesan suara sendiri di WhatsApp terus mikir: ih, suara gue kok aneh banget gini?",
    narration:
      "0-10:\nPernah denger pesan suara sendiri di WhatsApp terus mikir: ih, suara gue kok aneh banget gini? Kepikiran Aja...\n\n11-20:\nSaat bicara langsung, kita mendengar suara lewat dua jalur: getaran udara dan konduksi tulang tengkorak yang mempertebal nada bass. Mic rekaman hanya menangkap konduksi udara murni.\n\n21-28:\nSuara rekaman itu sebenarnya suara asli yang didengar teman-temanmu setiap hari. Tenang, cuma kamu yang merasa aneh, orang lain sudah terbiasa kok!",
    cta: "Siapa yang paling benci denger voice note rekaman suara sendiri? Ngacung di komentar!",
    tiktokCaption:
      "Kenapa suara rekaman HP beda jauh sama yang kita dengar di kepala? Ini rahasianya! #ceritaobim #kepikiranaja #faktatubuh #suara",
    youtubeDescription:
      "Fisiologi di balik perbedaan suara internal tulang tengkorak dan suara rekaman mikrofon. Program: Kepikiran Aja.",
    instagramCaption:
      "Denger suara rekaman sendiri auto tutup telinga? Ini penjelasan konduksi tulang di kepala kita. #ceritaobim #kepikiranaja #faktaunik",
    targetDurationSeconds: 28,
    factualClaims: [
      "Konduksi getaran tulang kranial menambah frekuensi rendah pada persepsi suara internal yang tidak ada pada transmisi suara konduksi udara murni.",
    ],
    sourceUrls: [
      "https://www.scientificamerican.com/article/why-does-my-voice-sound-different-on-a-recording/",
    ],
    verificationStatus: "verified",
  },
  {
    title: "Kenapa Kalau Dilarang Mikirin Sesuatu, Malah Tambah Kepikiran?",
    programName: "Kepikiran Aja",
    category: "Psikologi Pikiran",
    topic: "Teori proses ironis (Ironic Process Theory / White Bear Effect) dalam penekanan pikiran",
    hook: "Jangan bayangkan gajah warna pink sekarang! Pasti di kepala kamu barusan langsung muncul gambar gajah pink itu.",
    narration:
      "0-10:\nJangan bayangkan gajah warna pink sekarang! Pasti di kepala kamu barusan langsung muncul gambar gajah pink itu kan? Kepikiran Aja...\n\n11-20:\nIni disebut Teori Proses Ironis. Saat kita memaksa otak menekan suatu pikiran, alam bawah sadar terus memantau apakah pikiran itu muncul, yang ironisnya justru memanggilnya kembali.\n\n21-28:\nCara terbaik mengatasinya bukan melawannya, tapi mengalihkan perhatian ke hal lain yang lebih menarik. Jangan dilawan, biarkan pikiran itu lewat begitu saja!",
    cta: "Pikiran random apa yang paling susah ilang kalau lagi lo tahan-tahan? Ceritain di komentar!",
    tiktokCaption:
      "Makin dilarang makin kepikiran? Kenalan sama Ironic Process Theory di otak kita! #ceritaobim #kepikiranaja #psikologi #overthinking",
    youtubeDescription:
      "Mengapa menekan pikiran justru memicu White Bear Effect menurut Daniel Wegner. Program: Kepikiran Aja.",
    instagramCaption:
      "Jangan dipikirin! Eh malah kepikiran terus. Ini trik psikologi mengatasinya. #ceritaobim #kepikiranaja #mindset",
    targetDurationSeconds: 28,
    factualClaims: [
      "Ironic process theory dari psikolog Daniel Wegner menyatakan proses pemantauan bawah sadar saat penekanan pikiran meningkatkan aksesibilitas pikiran tersebut.",
    ],
    sourceUrls: ["https://en.wikipedia.org/wiki/Ironic_process_theory"],
    verificationStatus: "verified",
  },
  {
    title: "Kenapa Ruang Baru Bikin Kita Tiba-tiba Lupa Mau Ambil Apa?",
    programName: "Kepikiran Aja",
    category: "Sains Memori",
    topic: "Event boundary effect pada memori kerja jangka pendek saat melewati pintu (The Doorway Effect)",
    hook: "Jalan dari kamar ke dapur, tapi pas nyampe depan kulkas tiba-tiba bengong: gue tadi mau ngapain ya?",
    narration:
      "0-10:\nJalan dari kamar ke dapur, tapi pas nyampe depan kulkas tiba-tiba bengong: gue tadi mau ngapain ya? Kepikiran Aja...\n\n11-20:\nFenomena ini dikenal sebagai Doorway Effect. Otak menganggap pintu atau batas ruangan sebagai penanda akhir sebuah bab peristiwa, lalu mereset memori kerja jangka pendek kita.\n\n21-28:\nUntuk mengingatnya lagi, coba jalan balik ke ruangan tempat ide itu pertama kali muncul. Pemicu visual di sana bakal membangkitkan ingatanmu seketika!",
    cta: "Seberapa sering lo kena efek bengong lupa tujuan pas baru buka pintu? Komen di bawah!",
    tiktokCaption:
      "Masuk ruangan langsung amnesia sesaat? Itu bukan pikun, tapi Doorway Effect! #ceritaobim #kepikiranaja #sainsotak #relatable",
    youtubeDescription:
      "Penelitian University of Notre Dame tentang ambang pintu sebagai pemisah peristiwa memori kerja. Program: Kepikiran Aja.",
    instagramCaption:
      "Bukan gejala pikun! Pintu kamar ternyata tombol reset kecil buat memori kerja otak kita. #ceritaobim #kepikiranaja #faktaunik",
    targetDurationSeconds: 28,
    factualClaims: [
      "Peneliti kognitif Gabriel Radvansky membuktikan bahwa melintasi batas fisik lingkungan (event boundary) memicu pembaruan representasi memori kerja.",
    ],
    sourceUrls: [
      "https://news.nd.edu/news/walking-through-doorways-causes-forgetting-new-research-shows/",
    ],
    verificationStatus: "verified",
  },

  // ==========================================
  // PROGRAM 3: Eh, Ternyata! (Fakta Sains, Mitos vs Fakta, Sejarah)
  // ==========================================
  {
    title: "Kenapa Es Batu Mengapung di Air, Padahal Benda Padat Lain Tenggelam?",
    programName: "Eh, Ternyata!",
    category: "Fisika Alam & Sains",
    topic: "Anomali air dan kisi kristal heksagonal es yang menurunkan massa jenis zat padat",
    hook: "Hampir semua benda padat di alam semesta bakal tenggelam di cairan asalnya, kecuali es batu.",
    narration:
      "0-10:\nHampir semua benda padat di alam semesta bakal tenggelam di cairan asalnya, kecuali es batu. Eh, Ternyata!\n\n11-20:\nAir punya sifat anomali unik. Saat membeku di bawah empat derajat Celcius, molekul air membentuk kisi heksagonal berongga yang membuat volumenya mengembang dan massa jenisnya turun.\n\n21-28:\nEs batu jadi sembilan persen lebih ringan dari air cair di sekitarnya. Berkat anomali inilah biota laut kutub tetap bisa hidup di bawah danau yang membeku!",
    cta: "Bayangkan kalau es batu tenggelam ke dasar, apa yang bakal terjadi sama laut kita? Tulis di komentar!",
    tiktokCaption:
      "Zat padat kok bisa ngapung di cairannya sendiri? Kenalan sama anomali air! #ceritaobim #ehternyata #sainsfisika #faktaunik",
    youtubeDescription:
      "Penjelasan fisika mengapa es batu memiliki massa jenis lebih rendah daripada air cair karena struktur kisi heksagonal. Program: Eh, Ternyata!",
    instagramCaption:
      "Satu-satunya benda padat yang nolak tenggelam! Ini keajaiban molekul air di bumi. #ceritaobim #ehternyata #sains",
    targetDurationSeconds: 28,
    factualClaims: [
      "Ikatan hidrogen pada es membentuk struktur kisi heksagonal terbuka yang memiliki kerapatan ~0,917 g/cm³ dibandingkan air cair ~1,00 g/cm³.",
    ],
    sourceUrls: [
      "https://www.usgs.gov/special-topics/water-science-school/science/water-density",
    ],
    verificationStatus: "verified",
  },
  {
    title: "Mitos Makan Kangkung Bikin Ngantuk: Beneran atau Sugesti?",
    programName: "Eh, Ternyata!",
    category: "Mitos vs Fakta",
    topic: "Mitos sedatif kangkung versus beban karbohidrat nasi putih pada rasa kantuk",
    hook: "Banyak yang bilang kalau habis makan tumis kangkung pasti langsung nguap dan pengin tidur.",
    narration:
      "0-10:\nBanyak yang bilang kalau habis makan tumis kangkung pasti langsung nguap dan pengin tidur. Eh, Ternyata!\n\n11-20:\nKangkung memang mengandung mineral kalium dan triptofan, tapi kadarnya sangat kecil untuk menimbulkan efek kantuk instan. Penyebab ngantuk sebenarnya adalah sepiring nasi putihnya!\n\n21-28:\nLonjakan gula darah dari porsi karbohidrat nasi itulah biang kerok rasa lemas setelah makan. Jadi kangkung selama ini cuma jadi kambing hitam yang lezat!",
    cta: "Jujur, kamu selama ini percaya kangkung bikin ngantuk nggak? Tulis di komentar!",
    tiktokCaption:
      "Kangkung bikin ngantuk cuma mitos? Siapa yang sering nyalahin kangkung habis makan siang? #ceritaobim #ehternyata #mitosvsfakta #kesehatan",
    youtubeDescription:
      "Mengupas mitos efek sedatif kangkung vs kenyataan lonjakan indeks glikemik nasi putih. Program: Eh, Ternyata!",
    instagramCaption:
      "Kasihan kangkung disalahin terus! Ini alasan asli kenapa habis makan kangkung mata jadi 5 watt. #ceritaobim #ehternyata #fakta",
    targetDurationSeconds: 28,
    factualClaims: [
      "Kandungan triptofan dan mineral kalium dalam porsi standar kangkung tidak cukup untuk memicu efek sedatif farmakologis.",
    ],
    sourceUrls: [
      "https://hellosehat.com/nutrisi/fakta-gizi/apakah-kangkung-bikin-ngantuk/",
    ],
    verificationStatus: "verified",
  },
  {
    title: "Kenapa Kertas Origami Nggak Mudah Robek Saat Dilipat Berkali-kali?",
    programName: "Eh, Ternyata!",
    category: "Teknologi Bahan & Kerajinan",
    topic: "Karakteristik serat panjang washi (kozo) dan kekuatan tarik kertas origami tradisional",
    hook: "Kertas koran kalau dilipat bolak-balik gampang sobek, tapi kertas origami tetap kuat dan presisi.",
    narration:
      "0-10:\nKertas koran kalau dilipat bolak-balik gampang sobek, tapi kertas origami tetap kuat dan presisi. Eh, Ternyata!\n\n11-20:\nKertas origami tradisional menggunakan serat kulit pohon murbei (kozo) yang panjang dan saling bertaut erat, tanpa pemutih kimia keras yang merusak ikatan serat selulosa.\n\n21-28:\nAnyaman serat panjang ini mendistribusikan tekanan lipatan tanpa patah. Makanya karya seni origami Obim bisa berdiri kokoh dan tahan lama!",
    cta: "Pernah bikin origami apa aja pas masih kecil? Bunga, burung, atau katak loncat? Tulis di komen!",
    tiktokCaption:
      "Kenapa kertas origami bisa dilipat ratusan kali tanpa sobek? Ini rahasia seratnya! #ceritaobim #ehternyata #origami #origamistopmotion",
    youtubeDescription:
      "Sains material di balik kekuatan serat panjang washi pada kertas seni origami tradisional. Program: Eh, Ternyata!",
    instagramCaption:
      "Bukan sembarang kertas! Ini rahasia di balik kuatnya lipatan kertas origami Si Obim. #ceritaobim #ehternyata #kerajinan",
    targetDurationSeconds: 28,
    factualClaims: [
      "Kertas washi tradisional memanfaatkan serat bast panjang tanaman Broussonetia papyrifera (kozo) yang memiliki kekuatan tarik dan fleksibilitas lipatan tinggi.",
    ],
    sourceUrls: ["https://en.wikipedia.org/wiki/Origami_paper"],
    verificationStatus: "verified",
  },
  {
    title: "Kenapa Kucing Selalu Bisa Mendarat dengan Kakinya?",
    programName: "Eh, Ternyata!",
    category: "Fisika Tubuh & Hewan",
    topic: "Refleks meluruskan tubuh kucing (cat righting reflex) dan hukum konservasi momentum sudut",
    hook: "Kucing jatuh dalam posisi terbalik, tapi selalu sukses mendarat mulus pakai keempat kakinya.",
    narration:
      "0-10:\nKucing jatuh dalam posisi terbalik, tapi selalu sukses mendarat mulus pakai keempat kakinya. Eh, Ternyata!\n\n11-20:\nKucing punya refleks bawaan sejak umur 3 minggu berkat tulang selangka yang lentur dan tulang punggung yang super fleksibel, dipandu sistem keseimbangan di telinga dalamnya.\n\n21-28:\nSecara cerdik, kucing memutar tubuh bagian depan dan belakang ke arah berlawanan, mematuhi hukum fisika konservasi momentum sudut. Mendarat selalu mulus!",
    cta: "Pernah liat langsung kucing mendarat akrobatik dari tempat tinggi? Tulis di komentar!",
    tiktokCaption:
      "Fisika di balik pendaratan sempurna kucing! Kok bisa selalu mendarat pakai kaki? #ceritaobim #ehternyata #kucing #sainsfisika",
    youtubeDescription:
      "Penjelasan biomekanika dan fisika momentum sudut pada Cat Righting Reflex. Program: Eh, Ternyata!",
    instagramCaption:
      "Pintar fisika tanpa sekolah! Ini rahasia kucing selalu mendarat selamat dari ketinggian. #ceritaobim #ehternyata #hewanunik",
    targetDurationSeconds: 28,
    factualClaims: [
      "Cat righting reflex memungkinkan kucing memutar sumbu tubuh tanpa momentum sudut eksternal menggunakan rotasi diferensial tulang belakang.",
    ],
    sourceUrls: ["https://en.wikipedia.org/wiki/Cat_righting_reflex"],
    verificationStatus: "verified",
  },
  {
    title: "Kenapa Menelan Permen Karet Nggak Bikin Nempel di Usus 7 Tahun?",
    programName: "Eh, Ternyata!",
    category: "Mitos vs Fakta",
    topic: "Pencernaan permen karet dan motilitas usus manusia (gerakan peristaltik)",
    hook: "Waktu kecil sering ditakut-takutin kalau nelan permen karet bakal nempel di usus selama tujuh tahun.",
    narration:
      "0-10:\nWaktu kecil sering ditakut-takutin kalau nelan permen karet bakal nempel di usus selama tujuh tahun. Eh, Ternyata!\n\n11-20:\nBasis karet permen karet sintetis memang tidak bisa dipecah oleh enzim lambung kita. Namun saluran cerna memiliki gerakan peristaltik yang terus mendorong isi perut ke hilir.\n\n21-28:\nPermen karet akan keluar utuh secara alami bersama sisa makanan lain dalam waktu 24 sampai 48 jam. Mitos tujuh tahun itu terbukti hoaks belaka!",
    cta: "Waktu kecil pernah nggak sengaja nelan permen karet terus panik nggak bisa tidur? Ngaku di komentar!",
    tiktokCaption:
      "Mitos permen karet nempel 7 tahun di perut akhirnya terbongkar! Jangan panik lagi! #ceritaobim #ehternyata #mitosfakta #kesehatan",
    youtubeDescription:
      "Fakta medis tentang motilitas pencernaan permen karet sintetis menurut Mayo Clinic. Program: Eh, Ternyata!",
    instagramCaption:
      "Mitos legendaris masa kecil akhirnya runtuh! Ini yang terjadi kalau kita nelen permen karet. #ceritaobim #ehternyata #faktaunik",
    targetDurationSeconds: 28,
    factualClaims: [
      "Meskipun basis gom elastomer tidak larut air, gerakan peristaltik usus normal mengeluarkannya dari tubuh dalam beberapa hari.",
    ],
    sourceUrls: [
      "https://www.mayoclinic.org/healthy-lifestyle/childrens-health/expert-answers/swallowed-gum/faq-20058462",
    ],
    verificationStatus: "verified",
  },
  {
    title: "Kenapa Warna Langit Berubah Jingga Pas Matahari Terbenam?",
    programName: "Eh, Ternyata!",
    category: "Fisika Optik & Alam",
    topic: "Hamburan Rayleigh cahaya matahari pada ketebalan atmosfer saat senja",
    hook: "Langit siang hari warnanya biru cerah, tapi pas senja tiba-tiba berubah jadi oranye jingga yang dramatis.",
    narration:
      "0-10:\nLangit siang hari warnanya biru cerah, tapi pas senja tiba-tiba berubah jadi oranye jingga yang dramatis. Eh, Ternyata!\n\n11-20:\nFenomena optik ini disebut Hamburan Rayleigh. Saat matahari mendekati ufuk barat, sinarnya harus menembus lapisan atmosfer yang jauh lebih tebal dibanding waktu siang.\n\n21-28:\nCahaya biru bergelombang pendek habis tersebar ke mana-mana, menyisakan cahaya merah dan jingga bergelombang panjang yang langsung memanjakan mata kita!",
    cta: "Siapa di sini yang paling suka berburu pemandangan senja sunset? Tag temenmu di komentar!",
    tiktokCaption:
      "Kenapa langit senja warnanya selalu jingga keemasan? Ini rahasia fisika optiknya! #ceritaobim #ehternyata #senja #sainsalam",
    youtubeDescription:
      "Prinsip hamburan gelombang optik Rayleigh yang memunculkan warna merah jingga saat matahari terbit dan terbenam. Program: Eh, Ternyata!",
    instagramCaption:
      "Bukan sekadar romantis! Ada rumus fisika di balik indahnya langit jingga waktu senja. #ceritaobim #ehternyata #keindahanalam",
    targetDurationSeconds: 28,
    factualClaims: [
      "Hamburan Rayleigh berbanding terbalik dengan pangkat empat panjang gelombang; jalur atmosfer yang lebih panjang saat matahari rendah menyaring spektrum biru.",
    ],
    sourceUrls: [
      "https://www.metoffice.gov.uk/weather/learn-about/weather/optical-effects/why-is-the-sky-blue",
    ],
    verificationStatus: "verified",
  },
  {
    title: "Kenapa Garam Bisa Bikin Makanan Manis Terasa Jauh Lebih Manis?",
    programName: "Eh, Ternyata!",
    category: "Sains Rasa & Lidah",
    topic: "Aktivasi sensor glukosa SGLT1 oleh ion natrium pada sel reseptor lidah",
    hook: "Coba tabur sedikit garam halus ke atas potongan semangka atau kue cokelat, manisnya bakal meledak di lidah.",
    narration:
      "0-10:\nCoba tabur sedikit garam halus ke atas potongan semangka atau kue cokelat, manisnya bakal meledak di lidah. Eh, Ternyata!\n\n11-20:\nReseptor lidah kita punya transporter glukosa bernama SGLT1 yang membutuhkan ion natrium dari garam agar aktif mengangkut molekul gula ke dalam sel rasa manis.\n\n21-28:\nSejumput garam bukan membuat makanan jadi asin, melainkan membuka kunci sensor manis di otak dua kali lebih tajam. Rahasia chef kue terungkap!",
    cta: "Udah pernah coba makan buah semangka atau nanas pakai taburan garam belum? Rasanya juara loh!",
    tiktokCaption:
      "Kue manis kok dikasih garam? Ternyata ini rahasia lidah biar rasa manisnya meledak! #ceritaobim #ehternyata #sainsmakanan #trikdapur",
    youtubeDescription:
      "Penemuan ilmiah tentang transporter natrium-glukosa SGLT1 pada indera pengecap manusia. Program: Eh, Ternyata!",
    instagramCaption:
      "Bukan bikin asin! Taburan garam tipis justru melipatgandakan rasa manis di lidah kita. #ceritaobim #ehternyata #faktamakanan",
    targetDurationSeconds: 28,
    factualClaims: [
      "Transporter natrium-glukosa SGLT1 pada sel pengecap rasa manis memerlukan kation natrium untuk mentranslokasi glukosa dan memicu depolarisasi reseptor.",
    ],
    sourceUrls: ["https://www.pnas.org/doi/10.1073/pnas.1011508108"],
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

  return `Kamu adalah Head Content Strategist & Scriptwriter untuk channel video vertikal pendek Indonesia @${input.settings.channelName}.
Identitas Visual: ${input.settings.visualStyleGuide}
Karakter & Gaya Bahasa: Bahasa Indonesia santai dan akrab ("lo", "kamu", hangat, empatik, cerdas, tidak menggurui, seperti ngobrol santai).
Target Audiens: Generasi muda Indonesia (TikTok, YouTube Shorts, Instagram Reels).
Target Durasi: 15–30 detik per video (rata-rata 28 detik). Pembagian narasi terbagi 3 bagian waktu.
${input.customThemeHint ? `Fokus Riset & Tema Tambahan: ${input.customThemeHint}` : ""}

TIGA PROGRAM RESMI SI OBIM (Wajib gunakan salah satu program ini untuk setiap video):
1. "Ke Dapur Yuk!" (Kuliner, Dapur, Sains Makanan, Asal Usul Kuliner Nusantara)
2. "Kepikiran Aja" (Pertanyaan sebelum tidur, kebiasaan manusia, psikologi populer, fenomena sosial)
3. "Eh, Ternyata!" (Fakta sains tak terduga, mitos vs fakta, sejarah penemuan, fenomena alam)

Jika menghasilkan batch harian (3 video) atau mingguan (21 video), buat urutan bergantian secara berimbang:
Konten 1: Ke Dapur Yuk! -> Konten 2: Kepikiran Aja -> Konten 3: Eh, Ternyata!

ANALISIS KONTEN YANG SUDAH ADA (JANGAN menduplikasi topik ini):
${priorTitles || "(Belum ada konten)"}

TUGAS RISET & PERENCANAAN:
1. Buat tepat ${input.targetVideoCount} konten baru untuk pipeline produksi.
2. WAJIB format bagian "narration" ringkas dan padat (15–30 detik, 3 bagian persis):
0-10:
[Kalimat hook pembuka 2 kalimat yang memancing rasa penasaran, lalu diakhiri dengan penyebutan identitas nama program, contoh: "Ke Dapur Yuk!", "Kepikiran Aja...", atau "Eh, Ternyata!"]

11-20:
[Penjelasan inti 1 ide utama secara gamblang, sains sederhana atau fakta yang langsung menjawab hook]

21-28:
[Kesimpulan ringkas, implikasi nyata sehari-hari, dan kalimat tanya penutup yang memancing komentar penonton]

Kembalikan HANYA JSON murni dengan skema:
{
  "proposals": [
    {
      "title": "Judul memancing klik & rasa ingin tahu",
      "programName": "Ke Dapur Yuk!" | "Kepikiran Aja" | "Eh, Ternyata!",
      "category": "Kategori singkat",
      "topic": "Penjelasan spesifik sudut pandang topik",
      "hook": "Kalimat pembuka 3 detik pertama",
      "narration": "Narasi lengkap 15-30 detik dengan penanda waktu 0-10:, 11-20:, dan 21-28:",
      "cta": "Pertanyaan penutup pemancing komentar",
      "tiktokCaption": "Deskripsi singkat 2 kalimat + hashtag relevan",
      "youtubeDescription": "Deskripsi YouTube Shorts + hashtag",
      "instagramCaption": "Caption Instagram Reels + hashtag",
      "targetDurationSeconds": 28,
      "factualClaims": ["Klaim fakta ilmiah yang bisa diverifikasi"],
      "sourceUrls": ["https://..."],
      "verificationStatus": "verified"
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

