/**
 * Topic-Specific Entity Prompting Engine for CeritaObim Studio
 * Transforms each scene into an autonomous, topic-aware visual entity with:
 * 1. Bagian 1: High-Impact Kinetic Visual Hook (Detik 0-3) — Aksi fisik origami ekstrem & memikat, TANPA banner/tulisan kaku.
 * 2. Bagian 2: Deep physical origami science mechanism & breakdown (microscopic paper transformations, cause-and-effect).
 * 3. Bagian 3: Practical insight & interactive debate CTA with audio decaying smoothly into silence.
 */

import type { SceneEntityAttributes, SceneEntityRole } from "@/types/domain";

export interface TopicEntityInput {
  contentCode: string;
  title: string;
  topic?: string;
  category?: string;
  programName?: string;
  sceneIndex: number;
  totalScenes: number;
  narrationText: string;
  userVisualAction?: string;
}

export interface TopicEntityResult {
  role: SceneEntityRole;
  roleLabel: string;
  headlineQuestion: string;
  topicProps: string[];
  characterStance: string;
  origamiEnvironment: string;
  actionChoreography: string;
  diegeticSfxCue: string;
  enrichedVisualAction: string;
  fullEntityPromptBlock: string;
}

/**
 * Formats a clean headline question for reference/metadata.
 */
export function deriveHeadlineQuestion(title: string, topic?: string): string {
  const cleanTitle = (title || "").trim();
  if (cleanTitle.endsWith("?")) {
    return cleanTitle;
  }
  if (/^(kenapa|mengapa|bagaimana|apa|benarkah|siapa|tahukah)/i.test(cleanTitle)) {
    return `${cleanTitle}?`;
  }
  if (topic && /^(kenapa|mengapa|bagaimana|apa|benarkah|siapa|tahukah)/i.test(topic.trim())) {
    return topic.trim().endsWith("?") ? topic.trim() : `${topic.trim()}?`;
  }
  return `Kenapa ${cleanTitle}?`;
}

interface TopicArchetype {
  match: (text: string) => boolean;
  coverProps: string[];
  coverAction: string;
  coverStance: string;
  mechanismProps: string[];
  mechanismAction: string;
  resolutionProps: string[];
  resolutionAction: string;
  sfxHook: string;
  sfxMechanism: string;
  sfxResolution: string;
}

const TOPIC_ARCHETYPES: TopicArchetype[] = [
  // 1. Bawang / Iris Bawang
  {
    match: (t) => t.includes("bawang"),
    coverProps: [
      "Bawang merah kertas lapis lipat 3D yang meletup terbuka",
      "Pisau dapur kertas perak berkecepatan tinggi",
      "Bola-bola air mata kertas biru 3D raksasa meloncat dramatis ke arah kamera",
      "Talenan kayu kertas bergetar di atas meja",
    ],
    coverAction:
      "Aksi kinetik detik ke-0: Obim menghunus pisau perak kertas dan membelah bawang merah kertas dalam satu tebasan kilat! Seketika terjadi efek kejut komikal: gelombang semburan kabut kertas ungu dan bola-bola tetesan air mata kertas biru 3D raksasa meledak meloncat ke arah layar! Obim membelalak kaget lalu meringis menangkis cipratan air mata kertas dengan lengan kemeja flanelnya. Kamera snap-zoom vertikal 9:16 menangkap ekspresi syok kocak Obim tanpa teks/banner apa pun.",
    coverStance:
      "Obim refleks menangkis cipratan air mata kertas dengan satu tangan terlipat, mata menyipit perih dengan mulut menganga terkejut lucu.",
    mechanismProps: [
      "Model mikroskopis sel bawang dari lipatan kertas heksagonal yang retak robek",
      "Pita uap gas kertas warna ungu muda dan putih melayang cepat (gas propanethial S-oxide)",
      "Model anatomi mata lipatan kertas dengan kelenjar air mata kertas",
    ],
    mechanismAction:
      "Kamera macro zoom ke irisan bawang kertas: dinding sel kertas heksagonal robek dan melipat terbuka, melepaskan pita gas kertas ungu bergelombang yang terbang ke arah model mata kertas, memicu kelenjar air mata melipat keluar tetesan kertas.",
    resolutionProps: [
      "Kulkas mini kertas lipat warna biru pastel dengan pintu terbuka",
      "Mangkuk kertas berisi air dingin dan es batu kertas lipat",
      "Irisan bawang kertas rapi tanpa tetesan air mata",
    ],
    resolutionAction:
      "Obim mendemonstrasikan trik memasukkan bawang kertas ke kulkas kertas lipat sebelum diiris. Di sampingnya, Obim mengiris bawang dingin dengan senyum santai tanpa menangis, lalu mengacungkan jempol ke kamera.",
    sfxHook: "Bunyi tebasan pisau kertas tajam 'swish' disusul letupan renyah (1.5 detik), lalu senyap total.",
    sfxMechanism: "Denting lembut 'ting' reaksi kimia kertas (1 detik), fade out ke hening.",
    sfxResolution: "Ketukan kayu ramah 'pop' penutup (1 detik), senyap total.",
  },

  // 2. Nasi Goreng / Nasi Sisa
  {
    match: (t) => t.includes("nasi goreng") || t.includes("nasi sisa") || t.includes("nasi dingin"),
    coverProps: [
      "Wajan kuali hitam matte dari lipatan kertas tebal",
      "Lidah api kertas jingga berkobar dramatis di bawah wajan",
      "Ratusan butiran nasi origami keemasan melayang melambat (bullet-time)",
      "Pita uap asap kertas putih meliuk tinggi",
    ],
    coverAction:
      "Aksi kinetik instan detik ke-0: Obim melempar wajan kuali kertas hitam ke udara dengan kobaran lidah api kertas jingga menyala dramatis! Ratusan butir nasi origami keemasan melayang melambat (bullet-time stop-motion) di udara sebelum jatuh mendarat presisi ke piring kertas. Obim menangkap wajan dengan pose chef kung-fu keren, menatap tajam ke kamera dengan seringai puas dan percaya diri tinggi.",
    coverStance:
      "Obim tersenyum lebar penuh percaya diri memegang gagang wajan dengan pose chef master origami, tatapan fokus ke kamera.",
    mechanismProps: [
      "Komparasi dua mangkuk nasi: nasi lembek menggumpal vs nasi dingin butir terpisah",
      "Diagram ikatan molekul pati (retrogradasi) dari kertas lipat yang mengunci kokoh",
    ],
    mechanismAction:
      "Visual stop-motion memperlihatkan perbedaan: nasi baru matang membentuk gumpalan kertas kusut, sedangkan nasi sisa kemarin yang dingin memiliki struktur lipatan pati kertas kaku dan kokoh, tidak hancur saat diaduk di minyak kertas panas.",
    resolutionProps: [
      "Piring ceper kertas lipat berisi nasi goreng origami komplet",
      "Telur ceplok kertas lipat dan potongan mentimun kertas hijau",
    ],
    resolutionAction:
      "Obim menyajikan piring nasi goreng kertas sempurna dengan tekstur bulir terpisah renyah. Obim tersenyum bangga, menunjuk ke kamera mengajak penonton memilih tim nasi lembek atau tim nasi misah.",
    sfxHook: "Gemuruh wajan beradu dan desis minyak kertas renyah (1.5 detik), lalu hening.",
    sfxMechanism: "Bunyi klik lipatan kertas mengunci kokoh 'klik' (1 detik), fade out senyap.",
    sfxResolution: "Dua ketukan kayu lembut ramah (1 detik), lalu hening.",
  },

  // 3. Mandi / Ide Brilian
  {
    match: (t) => t.includes("mandi") || t.includes("ide brilian") || t.includes("shower"),
    coverProps: [
      "Kepala shower perak kertas dengan kucuran bulir air kertas biru deras",
      "Busa sabun kertas putih menutupi rambut mangkuk Obim",
      "Bohlam kertas kuning raksasa mekar meletup seperti kembang api origami",
      "Pita-pita cahaya kertas kuning berputar dinamis di udara",
    ],
    coverAction:
      "Detik ke-0 langsung aksi: Obim sedang menggosok rambut kertas berbusa sabun di bawah kucuran air kertas deras. Tiba-tiba tubuh Obim membeku kaku, matanya membelalak lebar seolah tersengat wahyu ide! Sebuah bohlam kertas kuning raksasa mendadak MEKAR MELETUP di atas kepalanya seperti kembang api origami, memancarkan pita-pita cahaya kuning berputar dinamis.",
    coverStance:
      "Obim membeku kaget, tangan masih di rambut berbusa sabun, mata membelalak takjub menatap ke atas pada bohlam origami yang meledak terang.",
    mechanismProps: [
      "Diorama otak kertas santai dengan tetesan dopamin kertas merah muda",
      "Roda gigi stres kertas melambat dan berhenti berputar",
      "Jalur ide kertas origami menyala berurutan",
    ],
    mechanismAction:
      "Model otak kertas lipat terbuka memperlihatkan mandi air hangat memicu gelombang alfa dan semburan dopamin kertas, membebaskan pikiran bawah sadar untuk menghubungkan ide-ide kreatif yang sebelumnya macet.",
    resolutionProps: [
      "Obim mengenakan jubah mandi kertas lipat",
      "Buku catatan kecil tahan air dari kertas lipat dan pensil kertas",
    ],
    resolutionAction:
      "Obim yang sudah berganti baju mencatat ide di buku catatan kertas kecil sambil tersenyum ke arah penonton, mengajak berdiskusi ide apa yang pernah muncul di kamar mandi.",
    sfxHook: "Denting 'ting' petir ide nyaring berpadu desau air kertas (1.5 detik), lalu hening total.",
    sfxMechanism: "Denting melodi ide bersih bergaung halus (1 detik), hening total.",
    sfxResolution: "Ketukan kayu penutup ramah (1 detik), senyap total.",
  },

  // 4. Deja Vu
  {
    match: (t) => t.includes("deja vu") || t.includes("pernah ngerasa"),
    coverProps: [
      "Dua pintu kembar origami pastel yang berputar ganjil",
      "Jam dinding kertas berputar melawan arah jarum detik",
      "Siluet dobel kertas Obim berbayang melipat cepat (efek glitch kertas)",
    ],
    coverAction:
      "Aksi instan detik ke-0: Obim melangkah maju lalu mendadak MEMBEKU KAKU di udara! Seluruh diorama ruangan kertas di sekelilingnya mendadak melipat ganda dan bergeser dua lapis (efek visual glitch kertas stop-motion). Obim menoleh patah-patah dengan mata membelalak heran, seolah terjebak di loop waktu origami yang nyata.",
    coverStance:
      "Obim membeku di tengah langkah, kepala miring dengan mata membelalak penuh tanda tanya, tangan terangkat ragu.",
    mechanismProps: [
      "Diagram otak lipatan kertas dengan dua jalur kabel sinyal kertas",
      "Jalur cepat langsung ke memori jangka panjang bypassing persepsi sadar",
    ],
    mechanismAction:
      "Stop-motion memperlihatkan sinyal persepsi kertas yang biasanya melewati jalur sensorik, tiba-tiba mengalami 'glitch' lipatan kecil dan langsung terarsip ke folder memori kertas lama di otak Obim.",
    resolutionProps: [
      "Otak kertas melipat rapi kembali normal",
      "Obim tersenyum meyakinkan penonton",
    ],
    resolutionAction:
      "Obim menjentikkan jari kertasnya dengan senyum lega, menjelaskan bahwa deja vu adalah tanda otak sehat sedang memeriksa arsip memorinya, lalu mengajak penonton curhat deja vu teraneh mereka.",
    sfxHook: "Desau kertas misterius halus bernada rendah berderit (1.5 detik), lalu hening.",
    sfxMechanism: "Denting klik sinkronisasi kertas (1 detik), fade out senyap.",
    sfxResolution: "Ketukan santai penutup ramah (1 detik), senyap total.",
  },

  // 5. Jantung Udang
  {
    match: (t) => t.includes("udang") || t.includes("jantung udang"),
    coverProps: [
      "Model udang besar kertas lipat oranye dengan kap kepala yang terbuka",
      "Jantung merah origami berdenyut cepat memancarkan cahaya kertas merah",
      "Kaca pembesar kertas bergetar di tangan Obim",
    ],
    coverAction:
      "Detik ke-0 langsung aksi: Obim sedang memegang udang origami oranye besar. Tiba-tiba cangkang kepala udang membuka seperti kap mobil sport kertas, memperlihatkan sebuah jantung origami merah menyala yang berdenyut kencang 'deg-deg-deg' di dalam batok kepalanya! Obim melompat mundur kaget dengan mata melotot takjub menatap kepala udang.",
    coverStance:
      "Obim melompat mundur setengah langkah, kaca pembesar terangkat di depan dada, mata terbelalak kaget menunjuk kepala udang.",
    mechanismProps: [
      "Potongan anatomi cephalothorax udang dari kertas lipat bertingkat",
      "Lambung dan organ vital kertas yang terlindung di dalam cangkang kepala",
    ],
    mechanismAction:
      "Cangkang kepala udang kertas terbuka seperti diorama pop-up, memperlihatkan susunan organ vital udang yang semua berkumpul di kepala demi perlindungan cangkang terkerasnya.",
    resolutionProps: [
      "Piring saji udang bakar kertas origami",
      "Obim tersenyum sambil memegang udang kertas ramah",
    ],
    resolutionAction:
      "Obim tersenyum lebar sambil memegang miniatur udang kertas lucu, mengajak penonton yang hobi makan udang untuk komen apakah mereka baru tahu fakta ini.",
    sfxHook: "Detak kertas cepat 'deg-deg-deg' disusul hentakan pop (1.5 detik), lalu hening.",
    sfxMechanism: "Gemerisik lipatan kertas pop-up membuka lembut (1.5 detik), hening.",
    sfxResolution: "Ketukan kayu santai penutup (1 detik), senyap total.",
  },

  // 6. Emas / Ledakan Bintang / Supernova
  {
    match: (t) => t.includes("emas") || t.includes("bintang") || t.includes("supernova"),
    coverProps: [
      "Latar antariksa kertas gelap pekat dengan nebula kertas biru tua",
      "Bintang raksasa origami yang mendadak runtuh lalu MELEDAK dahsyat",
      "Hujan jutaan serpihan meteorit emas kertas berkilau menuju layar",
    ],
    coverAction:
      "Detik ke-0 langsung aksi kosmik: Di ruang hampa kertas pekat, sebuah bintang origami raksasa mendadak mengkerut lalu MELEDAK DASYAT memuntahkan jutaan pecahan emas kertas berkilauan langsung ke arah layar kamera 9:16! Obim melayang mundur melindungi wajahnya sebelum tersenyum takjub melihat debu emas kosmik menghujani diorama.",
    coverStance:
      "Obim melayang mundur dengan tangan terangkat melindungi wajah, mata berbinar memantulkan kilau emas kosmik.",
    mechanismProps: [
      "Dua bintang neutron kertas bertabrakan (kilonova)",
      "Proses fusi nuklir kertas melahirkan unsur emas berat yang menghujani Bumi purba",
    ],
    mechanismAction:
      "Dua bintang kertas berputar kencang lalu bertabrakan, melipat serpihan atom kertas menjadi partikel emas berkilau yang meluncur dan tertanam di lapisan mantel Bumi kertas.",
    resolutionProps: [
      "Cincin emas origami melingkar di jari Obim",
      "Bumi kertas mini berputar anggun",
    ],
    resolutionAction:
      "Obim menatap cincin emas kertas di jarinya dengan rasa kagum kosmik, lalu menatap penonton sambil tersenyum bahwa perhiasan emas kita adalah debu bintang purba.",
    sfxHook: "Dentuman ledakan kosmik kertas 'BOOM' halus lalu hening (1.5 detik).",
    sfxMechanism: "Gemuruh lipatan kertas bergetar lembut lalu mereda senyap (1.5 detik).",
    sfxResolution: "Denting bersih penutup hangat (1 detik), hening total.",
  },

  // 7. Cuci Piring / Minyak
  {
    match: (t) => t.includes("cuci piring") || t.includes("piring berminyak") || t.includes("air panas vs air dingin"),
    coverProps: [
      "Tumpukan piring kertas berlumur minyak kuning licin meluncur cepat",
      "Spons kertas kuning-hijau dengan busa meluap",
      "Semburan air panas kertas putih membersihkan minyak secara instan",
    ],
    coverAction:
      "Detik ke-0 langsung aksi: Tumpukan piring kertas berlumur minyak kuning tebal meluncur cepat hampir jatuh menabrak kamera! Obim dengan gerakan sigap menangkap tumpukan itu, lalu menyemprotkan air panas kertas yang seketika meluruhkan seluruh lapisan minyak kuning seperti sihir stop-motion.",
    coverStance:
      "Obim menahan tumpukan piring dengan pose sigap dinamis, alis terangkat bangga saat minyak kertas luntur bersih.",
    mechanismProps: [
      "Lapisan lemak minyak kertas kuning yang mengeras beku saat kena air dingin",
      "Molekul sabun kertas mengikat lemak dan larut mudah saat disiram air panas",
    ],
    mechanismAction:
      "Split komparasi stop-motion: air dingin kertas membuat lemak membeku kaku seperti lilin kertas, sedangkan air panas melelehkan ikatan lemak sehingga terangkat bersih tanpa sisa.",
    resolutionProps: [
      "Piring putih bersih berkilau tanpa noda minyak",
      "Obim tersenyum puas mengacungkan piring mengilap",
    ],
    resolutionAction:
      "Obim memamerkan piring kertas yang kini kinclong dan bersih sempurna, tersenyum mengajak penonton berbagi kebiasaan cuci piring di rumah.",
    sfxHook: "Gemerisik gesekan piring dan semburan air kertas renyah (1.5 detik), lalu senyap.",
    sfxMechanism: "Desir air kertas mengalir halus mereda (1.5 detik), hening.",
    sfxResolution: "Denting 'ting' kilap piring bersih (1 detik), senyap total.",
  },

  // 8. Suara Hujan / Ngantuk
  {
    match: (t) => t.includes("hujan") || t.includes("ngantuk") || t.includes("pink noise"),
    coverProps: [
      "Kilatan petir kertas putih di balik jendela kamar kertas",
      "Garis-garis hujan kertas biru deras menghantam kaca",
      "Obim ambruk pingsan santai ke kasur empuk kertas",
    ],
    coverAction:
      "Detik ke-0 langsung aksi: Kilatan petir kertas menyala di jendela kamar tidur dan hujan kertas biru menderu lebat. Obim yang tadinya berdiri tegak mendadak lunglai, ambruk menjatuhkan diri ke kasur kertas empuk dan menguap lebar hingga kepalanya tenggelam di bantal lipat, menyebarkan efek visual ngantuk berat yang menular.",
    coverStance:
      "Obim terkulai santai di kasur, mulut menguap lebar dengan mata sayu terpejam nyaman.",
    mechanismProps: [
      "Pita spektrum gelombang frekuensi suara 'pink noise' dari kertas bergelombang halus",
      "Gelombang suara mendadak (klakson kertas) yang teredam oleh frekuensi hujan",
    ],
    mechanismAction:
      "Visual stop-motion memperlihatkan suara hujan kertas memancarkan gelombang suara merata yang menyelimuti seluruh kamar, menenggelamkan suara bising mendadak agar otak tetap tidur lelap.",
    resolutionProps: [
      "Bantal lipat kertas empuk tempat Obim merebahkan kepala",
      "Lampu tidur meja kertas berpendar temaram",
    ],
    resolutionAction:
      "Obim menarik selimut kertasnya dan tersenyum santai, menatap kamera berbisik mengajak penonton yang suka tidur nyenyak pas hujan untuk angkat tangan di kolom komentar.",
    sfxHook: "Gemuruh petir kertas lembut dan deru rintik hujan (1.5 detik), lalu senyap.",
    sfxMechanism: "Desau halus pink noise memudar ke hening (1.5 detik).",
    sfxResolution: "Detik jam dinding santai 'tik... tok...' perlahan lalu senyap total.",
  },

  // 9. Beruang Kutub / Kulit Hitam
  {
    match: (t) => t.includes("beruang kutub") || t.includes("kulitnya hitam"),
    coverProps: [
      "Beruang kutub origami raksasa berbulu putih salju",
      "Bulu putih kertas tersibak lebar menampakkan kulit hitam pekat origami",
      "Obim membeku kaget di samping cakar beruang",
    ],
    coverAction:
      "Detik ke-0 aksi mendadak: Obim mengendap-endap di balik punggung beruang kutub kertas putih raksasa. Obim meniup kuat bulu putih kertasnya hingga tersibak lebar, memperlihatkan kulit hitam pekat origami di dalamnya! Kepala beruang mendadak menoleh pelan ke Obim, dan Obim langsung membeku kaku dengan pose syok lucu.",
    coverStance:
      "Obim membeku di tempat dengan kedua tangan terangkat 'jangan serang', mata membelalak lucu.",
    mechanismProps: [
      "Model tabung bulu rambut beruang kertas transparan berongga (fiber optik alami)",
      "Sinar matahari kertas dipantulkan masuk ke kulit hitam penyerap panas maksimal",
    ],
    mechanismAction:
      "Kamera macro menyorot helai bulu kertas yang sebenarnya bening berongga memantulkan cahaya putih, lalu menyerap radiasi hangat ke kulit hitam origami di bawahnya.",
    resolutionProps: [
      "Beruang kutub kertas sedang santai di atas es",
      "Obim tersenyum kagum sambil membelai beruang kertas",
    ],
    resolutionAction:
      "Obim tersenyum hangat di samping beruang kutub kertas, mengajak penonton berbagi fakta hewan unik lainnya di kolom komentar.",
    sfxHook: "Hembusan angin kutub 'whoosh' dan bunyi langkah salju kertas (1.5 detik), lalu hening.",
    sfxMechanism: "Denting absorbsi hangat halus (1 detik), fade out ke hening.",
    sfxResolution: "Ketukan kayu penutup ramah (1 detik), senyap total.",
  },

  // 10. Nanas / Lidah
  {
    match: (t) => t.includes("nanas") || t.includes("lidah"),
    coverProps: [
      "Potongan buah nanas origami kuning cerah digigit Obim",
      "Lidah kertas merah muda Obim menjulur dengan gerigi-gerigi mini origami",
      "Efek getaran komikal di sekitar mulut Obim",
    ],
    coverAction:
      "Detik ke-0 langsung aksi: Obim melahap sepotong nanas origami kuning dengan rakus. Tiba-tiba di lidah kertasnya muncul ratusan gerigi origami kecil yang bergerak menggelitik balik! Obim menjulurkan lidahnya sambil memegang pipi dengan mata berkedip kaget geli yang sangat ekspresif.",
    coverStance:
      "Obim memegang kedua pipinya dengan lidah terjulur geli, mata berputar kaget lucu.",
    mechanismProps: [
      "Molekul enzim bromelain dari karakter kertas bergigi kecil ramah",
      "Lapisan protein mukosa lidah kertas yang dipecah perlahan oleh enzim",
    ],
    mechanismAction:
      "Enzim bromelain kertas aktif mengurai lapisan protein permukaan lidah kertas, menyebabkan rasa perih menggelitik sementara hingga sel lidah beregenerasi dalam hitungan jam.",
    resolutionProps: [
      "Mangkuk air garam kertas untuk merendam nanas sebelum dimakan",
      "Obim menikmati nanas kertas manis tanpa rasa perih",
    ],
    resolutionAction:
      "Obim mendemonstrasikan trik merendam nanas di air garam kertas, lalu melahap nanas dengan senyum puas dan mengajak penonton curhat apakah sering ngerasa perih pas makan nanas.",
    sfxHook: "Bunyi gigitan renyah kertas 'krip' lalu derit getar lucu (1.5 detik), lalu hening.",
    sfxMechanism: "Denting gelembung reaksi halus (1 detik), fade out senyap.",
    sfxResolution: "Ketukan kayu ramah penutup (1 detik), senyap total.",
  },

  // 11. Lupa Mimpi / Bangun Tidur
  {
    match: (t) => t.includes("mimpi") || t.includes("lupa mimpi"),
    coverProps: [
      "Ranjang tidur kertas tempat Obim melompat bangun mendadak",
      "Awan mimpi origami warna-warni melipat menyusut kabur ke udara",
      "Tangan Obim berusaha meraih puzzle mimpi yang larut lenyap",
    ],
    coverAction:
      "Detik ke-0 langsung aksi: Obim tersentak bangun dari tempat tidur kertasnya dengan mata membelalak panik! Di atas kepalanya, sebuah makhluk mimpi origami berwarna-warni melayang kabur dan menyusut melipat diri menjadi tak kasat mata dalam 2 detik. Obim melompat berusaha menangkapnya tapi terlambat, lalu memegang kepala dengan ekspresi gemas penasaran.",
    coverStance:
      "Obim melompat dari ranjang dengan tangan terentang ke udara, ekspresi gemas 'tadi mimpi apa ya!'.",
    mechanismProps: [
      "Model otak kertas fase tidur REM: neurotransmitter norepinefrin kertas tidak aktif",
      "Pintu arsip memori kertas di hipokampus yang belum sempat terkunci",
    ],
    mechanismAction:
      "Visual stop-motion memperlihatkan arsip memori mimpi tidak sempat distempel ke folder jangka panjang karena zat kimia perekam otak sedang 'off' saat tidur lelap.",
    resolutionProps: [
      "Buku catatan mimpi (dream journal) dan pulpen kertas di meja samping",
      "Obim tersenyum langsung mencatat mimpi begitu melek",
    ],
    resolutionAction:
      "Obim membagikan tips menaruh buku catatan kertas di samping bantal agar mimpi bisa langsung ditulis dalam 5 menit pertama, lalu mengajak penonton cerita mimpi teraneh mereka.",
    sfxHook: "Denting magis awan mimpi origami berdesir lenyap 'whoosh' (1.5 detik), lalu senyap.",
    sfxMechanism: "Gemerisik puzzle kertas bergeser halus (1.5 detik), hening.",
    sfxResolution: "Dua ketukan kayu ramah penutup (1 detik), senyap total.",
  },

  // 12. Teh vs Kopi / Kafein
  {
    match: (t) => t.includes("kopi") || t.includes("teh") || t.includes("fokus"),
    coverProps: [
      "Cangkir kopi hitam kertas raksasa menyemburkan petir origami hitam",
      "Cangkir teh hijau kertas menghembuskan pusaran daun teh zen",
      "Obim berdiri di tengah arena pertarungan dua minuman kertas",
    ],
    coverAction:
      "Detik ke-0 langsung adegan epik: Obim berdiri di antara dua cangkir kertas raksasa yang saling bertarung! Cangkir kopi menyemburkan petir kertas hitam berenergi liar, sementara cangkir teh menghembuskan pusaran daun kertas hijau tenang dan sejuk. Obim menoleh cepat ke kiri dan ke kanan dengan mata waspada mencari mana yang paling bikin fokus.",
    coverStance:
      "Obim berdiri dengan kuda-kuda waspada, tangan menunjuk ke arah cangkir kopi dan cangkir teh, ekspresi penasaran tajam.",
    mechanismProps: [
      "Grafik lonjakan kafein kopi kertas (naik tajam lalu drop) vs kurva teh stabil berkat L-theanine kertas hijau",
    ],
    mechanismAction:
      "Grafik kurva kertas bergerak: kopi memberikan tendangan energi instan tapi cepat lelah, sementara zat L-theanine pada teh membungkus kafein menghasilkan ketenangan fokus jangka panjang.",
    resolutionProps: [
      "Cangkir pilihan sesuai kebutuhan aktivitas kerja/santai",
      "Obim menyesap minuman kertas dengan ekspresi rileks prima",
    ],
    resolutionAction:
      "Obim menikmati minumannya dengan riang, menatap kamera dan mengajak penonton memilih apakah mereka tim kopi hitam garis keras atau tim teh santai.",
    sfxHook: "Sambaran petir kertas 'crackle' berpadu desir daun teh halus (1.5 detik), lalu senyap.",
    sfxMechanism: "Desir aliran energi kertas halus memudar (1.5 detik), senyap.",
    sfxResolution: "Ketukan meja kayu ramah (1 detik), senyap total.",
  },
];

/**
 * Fallback procedural generator for novel topics that don't match predefined archetypes.
 * Guarantees high-impact kinetic visual action WITHOUT text banners!
 */
function buildProceduralArchetype(
  title: string,
  topic: string = "",
  category: string = ""
): TopicArchetype {
  const safeTitle = title.replace(/[?:\/*"<>|]/g, "").trim();

  return {
    match: () => true,
    coverProps: [
      `Model 3D lipatan kertas origami dari subjek utama: "${safeTitle}" yang bergerak kinetik`,
      "Serpihan kertas origami berterbangan dramatis",
      "Pencahayaan stop-motion studio kontras tinggi vertikal 9:16",
    ],
    coverAction: `Aksi kinetik detik ke-0: Obim berinteraksi mendadak dengan model 3D kertas origami "${safeTitle}" yang meletup atau bergerak tak terduga! Obim bereaksi dengan gerakan refleks komikal, mata membelalak takjub, menciptakan misteri visual instan di 3 detik pertama tanpa papan tanda/banner tulisan apa pun.`,
    coverStance:
      "Obim menatap subjek dengan ekspresi penasaran terkejut, tangan refleks menunjuk atau menangkis dengan pose stop-motion dinamis.",
    mechanismProps: [
      "Model anatomi / diagram lipatan kertas origami membelah memperlihatkan bagian dalam",
      "Simulasi stop-motion sebab-akibat dengan transformasi kertas bertekstur",
    ],
    mechanismAction: `Visual stop-motion memperlihatkan transformasi lipatan kertas mendalam yang menjelaskan rahasia ilmiah di balik "${safeTitle}" secara bertahap dan memikat.`,
    resolutionProps: [
      "Properti solusi praktis origami yang rapi dan memuaskan",
      "Diorama akhir yang tertata indah",
    ],
    resolutionAction: `Obim tersenyum bangga memperagakan kesimpulan praktis, menatap kamera vertikal 9:16 dan mengajak penonton berdiskusi di kolom komentar.`,
    sfxHook: "Swish gesekan kertas kinetik cepat dan letupan halus (1.5 detik), lalu senyap.",
    sfxMechanism: "Denting penanda ide lembut dan bersih 'ting' (1 detik), fade out hening.",
    sfxResolution: "Dua ketukan kayu lembut ramah penutup (1 detik), lalu senyap total.",
  };
}

/**
 * Derives comprehensive, autonomous entity attributes for any scene record.
 */
export function deriveTopicSceneEntity(input: TopicEntityInput): TopicEntityResult {
  const {
    title,
    topic = "",
    category = "",
    programName = "",
    sceneIndex,
    totalScenes,
    narrationText,
    userVisualAction,
  } = input;

  const combinedSearch = `${title} ${topic} ${category} ${programName} ${narrationText}`.toLowerCase();
  const headlineQuestion = deriveHeadlineQuestion(title, topic);

  const archetype =
    TOPIC_ARCHETYPES.find((arc) => arc.match(combinedSearch)) ||
    buildProceduralArchetype(title, topic, category);

  // Determine Entity Role based on scene index and total scenes
  let role: SceneEntityRole;
  let roleLabel: string;

  if (sceneIndex === 1) {
    role = "THUMBNAIL_HOOK";
    roleLabel = "HIGH-IMPACT KINETIC HOOK";
  } else if (sceneIndex === totalScenes) {
    role = "DEBATE_CLOSING";
    roleLabel = "RESOLUTION & INTERACTIVE DEBATE CTA";
  } else if (sceneIndex === 2) {
    role = "SCIENCE_MECHANISM";
    roleLabel = "SCIENCE BREAKDOWN & MECHANISM";
  } else {
    role = "PRACTICAL_INSIGHT";
    roleLabel = "PRACTICAL INSIGHT & DEMONSTRATION";
  }

  // Derive scene-specific props, choreography, and SFX
  let topicProps: string[];
  let characterStance: string;
  let actionChoreography: string;
  let diegeticSfxCue: string;
  let origamiEnvironment: string;

  // Environment deduction
  if (
    combinedSearch.includes("dapur") ||
    combinedSearch.includes("masak") ||
    combinedSearch.includes("makan") ||
    combinedSearch.includes("goreng") ||
    combinedSearch.includes("bawang") ||
    combinedSearch.includes("piring") ||
    combinedSearch.includes("kopi") ||
    combinedSearch.includes("teh")
  ) {
    origamiEnvironment =
      "Dapur diorama kertas origami bernuansa kayu hangat dengan ubin kotak-kotak kertas putih dan kompor kertas.";
  } else if (
    combinedSearch.includes("tidur") ||
    combinedSearch.includes("mimpi") ||
    combinedSearch.includes("hujan") ||
    combinedSearch.includes("kamar") ||
    combinedSearch.includes("kasur")
  ) {
    origamiEnvironment =
      "Kamar tidur diorama kertas bernuansa malam hangat, jendela kertas dengan pemandangan lembut, dan ranjang lipat.";
  } else if (
    combinedSearch.includes("bintang") ||
    combinedSearch.includes("antariksa") ||
    combinedSearch.includes("ruang angkasa") ||
    combinedSearch.includes("jam di luar angkasa")
  ) {
    origamiEnvironment =
      "Diorama antariksa lipatan kertas biru malam pekat dengan planet gantung dan bintang origami.";
  } else {
    origamiEnvironment =
      "Studio diorama kertas lipat matte minimalis dengan pencahayaan rim lembut stop-motion berbayang realistis.";
  }

  if (role === "THUMBNAIL_HOOK") {
    topicProps = archetype.coverProps;
    characterStance = archetype.coverStance;
    actionChoreography = archetype.coverAction;
    diegeticSfxCue = archetype.sfxHook;
  } else if (role === "SCIENCE_MECHANISM") {
    topicProps = archetype.mechanismProps;
    characterStance =
      "Obim mengamati atau menunjuk diagram mekanisme kertas dengan ekspresi analitis dan fokus.";
    actionChoreography = archetype.mechanismAction;
    diegeticSfxCue = archetype.sfxMechanism;
  } else {
    topicProps = archetype.resolutionProps;
    characterStance =
      "Obim tersenyum hangat, menghadap ke kamera vertikal 9:16 dengan pose ramah mengajak interaksi.";
    actionChoreography = archetype.resolutionAction;
    diegeticSfxCue = archetype.sfxResolution;
  }

  // Build high-impact enriched visual action string
  const enrichedVisualAction =
    userVisualAction &&
    !userVisualAction.includes("memperagakan adegan untuk segmen") &&
    !userVisualAction.includes("banner") &&
    userVisualAction.length > 30
      ? userVisualAction
      : actionChoreography;

  // Build the complete autonomous entity prompt block — NO BANNERS, NO TEXT!
  const visualHookBlock =
    role === "THUMBNAIL_HOOK"
      ? [
          `  - SPESIFIKASI KINETIC HOOK (DETIK 0-3): Aksi fisik origami langsung di detik pertama (in-media-res)! DILARANG menggunakan papan nama, banner, atau teks kaku yang membosankan. Ciptakan rasa penasaran ekstrem murni lewat pergerakan objek kertas spektakuler, reaksi ekspresi komikal Obim, dan komposisi kamera vertikal 9:16 dinamis.`,
          `  - Aturan Teks: 100% MURNI VISUAL STOP-MOTION KERTAS ORIGAMI (NO text on screen, NO subtitles, NO banners, NO watermark) agar tampak modern, dinamis, dan tidak kaku seperti brosur tua.`,
        ].join("\n")
      : `  - Aturan Teks: 100% stop-motion kertas origami murni tanpa subtitle, tanpa teks layar, tanpa watermark (NO subtitles, NO text on screen).`;

  const fullEntityPromptBlock = [
    `[ENTITY: BAGIAN ${sceneIndex} • ${roleLabel}]`,
    `  - Peran Visual Entity   : ${roleLabel}`,
    `  - Properti Kertas Topik : ${topicProps.join(", ")}`,
    `  - Pose & Ekspresi Obim : ${characterStance}`,
    `  - Koreografi Aksi Kinetik: ${enrichedVisualAction}`,
    `  - Lingkungan Diorama    : ${origamiEnvironment}`,
    visualHookBlock,
    `  - Efek Suara (SFX)      : ${diegeticSfxCue}`,
    `  - Aturan Audio Senyap   : Efek suara berdurasi singkat (1-2 detik) di tengah dan WAJIB memudar senyap ke hening total sebelum durasi klip berakhir agar transisi antar scene mulus sempurna tanpa BGM terpotong.`,
  ].join("\n");

  return {
    role,
    roleLabel,
    headlineQuestion,
    topicProps,
    characterStance,
    origamiEnvironment,
    actionChoreography,
    diegeticSfxCue,
    enrichedVisualAction,
    fullEntityPromptBlock,
  };
}
