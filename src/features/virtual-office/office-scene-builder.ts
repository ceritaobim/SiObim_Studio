import * as THREE from "three";
import { BufferSchedulePosterItem, OfficeMember } from "./types";
import {
  WORKSTATION_DESK_CENTERS,
  LOUNGE_SEATS,
  LOUNGE_FACING_ANGLES,
  DEFAULT_BUFFER_POSTERS,
  BUFFER_POSTER_WORLD_COORDS,
} from "./constants";

export interface AvatarRig {
  root: THREE.Group;
  bodyPivot: THREE.Group;
  torsoGroup: THREE.Group;
  headGroup: THREE.Group;
  leftArmGroup: THREE.Group;
  rightArmGroup: THREE.Group;
  leftForearmGroup: THREE.Group;
  rightForearmGroup: THREE.Group;
  leftLegGroup: THREE.Group;
  rightLegGroup: THREE.Group;
  leftLowerLegGroup: THREE.Group;
  rightLowerLegGroup: THREE.Group;
  coffeeMugGroup: THREE.Group;
  haloRing: THREE.Mesh;
  phaseOffset: number;
}

/**
 * Procedural herringbone oak parquet texture for the spacious 62x36 floor
 */
function createWoodParquetTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");

  if (ctx) {
    ctx.fillStyle = "#d9b991";
    ctx.fillRect(0, 0, 512, 512);

    const tileW = 64;
    const tileH = 32;
    const colors = ["#cfa97e", "#d8b58b", "#c59e72", "#e0c097", "#cba578"];

    for (let y = 0; y < 512; y += tileH) {
      for (let x = 0; x < 512; x += tileW) {
        const offset = (y / tileH) % 2 === 0 ? 0 : tileW / 2;
        const colorIdx = Math.abs(Math.sin(x * 12.9898 + y * 78.233)) * colors.length;
        ctx.fillStyle = colors[Math.floor(colorIdx) % colors.length] ?? "#d8b58b";
        ctx.fillRect((x + offset) % 512, y, tileW - 2, tileH - 2);

        ctx.strokeStyle = "rgba(65, 42, 18, 0.14)";
        ctx.lineWidth = 1;
        ctx.strokeRect((x + offset) % 512, y, tileW - 2, tileH - 2);
      }
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(11, 7);
  return texture;
}

/**
 * Procedural video editing timeline & code screen texture for dual monitors
 */
function createMonitorScreenTexture(isLead: boolean = false): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");

  if (ctx) {
    // Dark IDE / NLE background
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, 256, 128);

    // Top bar
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(0, 0, 256, 16);

    // Preview window (9:16 vertical short video preview in center-right)
    ctx.fillStyle = "#0284c7";
    ctx.fillRect(180, 22, 56, 52);
    ctx.fillStyle = "#38bdf8";
    ctx.fillRect(196, 32, 24, 32);

    // Timeline tracks at bottom
    const trackColors = isLead
      ? ["#f59e0b", "#10b981", "#38bdf8", "#a855f7"]
      : ["#38bdf8", "#818cf8", "#34d399", "#fbbf24"];

    for (let t = 0; t < 4; t++) {
      const y = 82 + t * 10;
      ctx.fillStyle = "#1e293b";
      ctx.fillRect(10, y, 236, 7);

      let cx = 14 + (t * 17) % 30;
      while (cx < 220) {
        const w = 18 + ((cx * 7) % 35);
        ctx.fillStyle = trackColors[t % trackColors.length] ?? "#38bdf8";
        ctx.fillRect(cx, y + 1, Math.min(w, 235 - cx), 5);
        cx += w + 6;
      }
    }

    // Playhead line
    ctx.strokeStyle = "#f43f5e";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(110, 78);
    ctx.lineTo(110, 124);
    ctx.stroke();

    // Left panel script lines
    ctx.fillStyle = "#94a3b8";
    for (let l = 0; l < 5; l++) {
      ctx.fillRect(12, 24 + l * 10, 80 + ((l * 29) % 60), 4);
    }
  }

  return new THREE.CanvasTexture(canvas);
}

/**
 * Creates city skyline backdrop texture for the panoramic window
 */
export function createCitySkylineTexture(mode: "day" | "sunset" | "night" = "day"): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");

  if (ctx) {
    const skyGrad = ctx.createLinearGradient(0, 0, 0, 512);
    if (mode === "day") {
      skyGrad.addColorStop(0, "#60a5fa");
      skyGrad.addColorStop(0.6, "#bae6fd");
      skyGrad.addColorStop(1, "#fef3c7");
    } else if (mode === "sunset") {
      skyGrad.addColorStop(0, "#311042");
      skyGrad.addColorStop(0.45, "#9d174d");
      skyGrad.addColorStop(0.75, "#f97316");
      skyGrad.addColorStop(1, "#fde047");
    } else {
      skyGrad.addColorStop(0, "#020617");
      skyGrad.addColorStop(0.6, "#0f172a");
      skyGrad.addColorStop(1, "#1e1b4b");
    }
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, 1024, 512);

    // Sun / Moon glow
    const sunGrad = ctx.createRadialGradient(720, 220, 10, 720, 220, 170);
    if (mode === "night") {
      sunGrad.addColorStop(0, "rgba(224, 242, 254, 0.95)");
      sunGrad.addColorStop(0.3, "rgba(56, 189, 248, 0.25)");
      sunGrad.addColorStop(1, "rgba(15, 23, 42, 0)");
    } else {
      sunGrad.addColorStop(0, "rgba(255, 251, 235, 0.95)");
      sunGrad.addColorStop(0.5, "rgba(253, 186, 116, 0.4)");
      sunGrad.addColorStop(1, "rgba(255, 255, 255, 0)");
    }
    ctx.fillStyle = sunGrad;
    ctx.beginPath();
    ctx.arc(720, 220, 170, 0, Math.PI * 2);
    ctx.fill();

    // Distant silhouette towers
    ctx.fillStyle =
      mode === "night"
        ? "rgba(15, 23, 42, 0.9)"
        : mode === "sunset"
        ? "rgba(88, 28, 135, 0.65)"
        : "rgba(148, 163, 184, 0.6)";
    for (let i = 0; i < 42; i++) {
      const w = 22 + ((i * 19) % 34);
      const h = 90 + ((i * 37) % 150);
      const x = i * 25;
      ctx.fillRect(x, 512 - h, w, h);
    }

    // Foreground high-rise buildings
    const bldgColor =
      mode === "night"
        ? "#090d16"
        : mode === "sunset"
        ? "#2e1065"
        : "#475569";

    for (let i = 0; i < 28; i++) {
      const w = 32 + ((i * 23) % 40);
      const h = 130 + ((i * 53) % 210);
      const x = i * 37;
      ctx.fillStyle = bldgColor;
      ctx.fillRect(x, 512 - h, w, h);

      // Lit windows
      ctx.fillStyle =
        mode === "night"
          ? "rgba(253, 224, 71, 0.75)"
          : mode === "sunset"
          ? "rgba(254, 215, 170, 0.65)"
          : "rgba(255, 255, 255, 0.45)";
      for (let wy = 512 - h + 14; wy < 500; wy += 12) {
        for (let wx = x + 5; wx < x + w - 5; wx += 9) {
          if ((wx + wy * 3) % 5 !== 0) {
            ctx.fillRect(wx, wy, 4, 6);
          }
        }
      }
    }
  }

  return new THREE.CanvasTexture(canvas);
}

/**
 * High-res Anime Face Texture (expressive eyes, iris shine, eyebrows, blush, smile)
 */
function createAnimeFaceTexture(hairHex: string, gender: "male" | "female"): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");

  if (ctx) {
    // Warm anime skin base
    ctx.fillStyle = "#ffe4d6";
    ctx.fillRect(0, 0, 256, 256);

    // Soft cheek blush
    const blushL = ctx.createRadialGradient(68, 156, 2, 68, 156, 24);
    blushL.addColorStop(0, "rgba(251, 113, 133, 0.38)");
    blushL.addColorStop(1, "rgba(251, 113, 133, 0)");
    ctx.fillStyle = blushL;
    ctx.fillRect(40, 130, 60, 50);

    const blushR = ctx.createRadialGradient(188, 156, 2, 188, 156, 24);
    blushR.addColorStop(0, "rgba(251, 113, 133, 0.38)");
    blushR.addColorStop(1, "rgba(251, 113, 133, 0)");
    ctx.fillStyle = blushR;
    ctx.fillRect(160, 130, 60, 50);

    // Eyebrows
    ctx.strokeStyle = hairHex;
    ctx.lineWidth = gender === "male" ? 6 : 4;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(58, 96);
    ctx.quadraticCurveTo(80, 88, 100, 95);
    ctx.moveTo(156, 95);
    ctx.quadraticCurveTo(176, 88, 198, 96);
    ctx.stroke();

    // Eyes (Left & Right)
    const drawAnimeEye = (cx: number, cy: number) => {
      // Sclera (white)
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.ellipse(cx, cy, 20, gender === "female" ? 22 : 17, 0, 0, Math.PI * 2);
      ctx.fill();

      // Iris gradient
      const irisGrad = ctx.createLinearGradient(cx, cy - 16, cx, cy + 16);
      if (gender === "female") {
        irisGrad.addColorStop(0, "#1e1b4b");
        irisGrad.addColorStop(0.5, "#4338ca");
        irisGrad.addColorStop(1, "#93c5fd");
      } else {
        irisGrad.addColorStop(0, "#1c1917");
        irisGrad.addColorStop(0.5, "#44403c");
        irisGrad.addColorStop(1, "#a8a29e");
      }
      ctx.fillStyle = irisGrad;
      ctx.beginPath();
      ctx.ellipse(cx, cy + 1, 13, gender === "female" ? 16 : 13, 0, 0, Math.PI * 2);
      ctx.fill();

      // Pupil
      ctx.fillStyle = "#09090b";
      ctx.beginPath();
      ctx.arc(cx, cy + 2, 6, 0, Math.PI * 2);
      ctx.fill();

      // Main white specular highlight
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(cx - 5, cy - 5, 4.5, 0, Math.PI * 2);
      ctx.fill();

      // Secondary small highlight
      ctx.beginPath();
      ctx.arc(cx + 5, cy + 6, 2.2, 0, Math.PI * 2);
      ctx.fill();

      // Upper thick eyelash arch
      ctx.strokeStyle = "#09090b";
      ctx.lineWidth = gender === "female" ? 6.5 : 5.5;
      ctx.beginPath();
      ctx.arc(cx, cy + 2, 20, Math.PI * 1.12, Math.PI * 1.88);
      ctx.stroke();
    };

    drawAnimeEye(80, 124);
    drawAnimeEye(176, 124);

    // Subtle anime nose
    ctx.fillStyle = "rgba(180, 110, 90, 0.45)";
    ctx.beginPath();
    ctx.moveTo(128, 148);
    ctx.lineTo(124, 158);
    ctx.lineTo(130, 159);
    ctx.fill();

    // Gentle confident smile
    ctx.strokeStyle = "#be123c";
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.arc(128, 168, 12, 0.18 * Math.PI, 0.82 * Math.PI);
    ctx.stroke();
  }

  return new THREE.CanvasTexture(canvas);
}

/**
 * Creates a Realistic Modern Gallery Poster Texture (NO neon, NO black background!):
 * - Warm off-white museum matboard (passe-partout) #faf8f5
 * - Clean editorial header badge (#01, #02...) & status tag
 * - Crisp 9:16 Origami Paper Stop-Motion illustration print in the center
 * - Clean architectural schedule & title plaque at the bottom
 */
export function createBufferCinemaPosterTexture(
  poster: BufferSchedulePosterItem
): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 820;
  const ctx = canvas.getContext("2d");

  if (ctx) {
    // 1. Warm Ivory / Off-White Museum Matboard Background (#faf8f5)
    ctx.fillStyle = "#faf8f5";
    ctx.fillRect(0, 0, 512, 820);

    // Subtle inner matboard bevel border
    ctx.strokeStyle = "#e2ddd5";
    ctx.lineWidth = 4;
    ctx.strokeRect(26, 26, 460, 768);

    // 2. Top Editorial Sequence Number & Code Header
    ctx.fillStyle = "#1e293b";
    ctx.font = "800 26px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`#${poster.badgeNumber}`, 46, 68);

    ctx.fillStyle = "#64748b";
    ctx.font = "600 18px monospace";
    ctx.fillText(poster.code, 108, 67);

    // Status Pill on Top-Right
    const statusLabel =
      poster.status === "scheduled"
        ? "TERJADWAL"
        : poster.status === "ready"
        ? "SIAP TAYANG"
        : "PUBLISHED";
    const pillBg =
      poster.status === "scheduled"
        ? "#e0f2fe"
        : poster.status === "ready"
        ? "#fef3c7"
        : "#d1fae5";
    const pillText =
      poster.status === "scheduled"
        ? "#0369a1"
        : poster.status === "ready"
        ? "#b45309"
        : "#047857";

    ctx.fillStyle = pillBg;
    ctx.fillRect(318, 42, 148, 34);
    ctx.fillStyle = pillText;
    ctx.font = "bold 16px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(statusLabel, 392, 65);

    // 3. Central 9:16 Editorial Poster Print (x: 46..466, y: 92..592)
    const px = 46;
    const py = 92;
    const pw = 420;
    const ph = 500;

    const palettes: Array<[string, string, string]> = [
      ["#1e3a8a", "#3b82f6", "#fde68a"],
      ["#134e4a", "#14b8a6", "#fed7aa"],
      ["#312e81", "#6366f1", "#fde047"],
      ["#7c2d12", "#ea580c", "#fef08a"],
      ["#1e293b", "#475569", "#bae6fd"],
      ["#14532d", "#22c55e", "#fef3c7"],
    ];
    const pal = palettes[(poster.slotIndex - 1) % palettes.length] ?? palettes[0]!;
    const artGrad = ctx.createLinearGradient(px, py, px, py + ph);
    artGrad.addColorStop(0, pal[0]);
    artGrad.addColorStop(0.7, pal[1]);
    artGrad.addColorStop(1, "#0f172a");
    ctx.fillStyle = artGrad;
    ctx.fillRect(px, py, pw, ph);

    // Warm paper sun & folded origami mountains inside print
    ctx.save();
    ctx.beginPath();
    ctx.arc(256, py + 185, 68, 0, Math.PI * 2);
    ctx.fillStyle = pal[2];
    ctx.fill();

    // Layered paper mountains
    ctx.fillStyle = "rgba(255, 255, 255, 0.22)";
    ctx.beginPath();
    ctx.moveTo(px, py + ph);
    ctx.lineTo(px + 140, py + 250);
    ctx.lineTo(px + 290, py + ph);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "rgba(255, 255, 255, 0.32)";
    ctx.beginPath();
    ctx.moveTo(px + 140, py + ph);
    ctx.lineTo(px + 300, py + 220);
    ctx.lineTo(px + pw, py + ph);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Subtle inner frame border around artwork
    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 2;
    ctx.strokeRect(px, py, pw, ph);

    // Platform tag at bottom of artwork
    ctx.fillStyle = "rgba(15, 23, 42, 0.78)";
    ctx.fillRect(px, py + ph - 44, pw, 44);
    ctx.fillStyle = "#f8fafc";
    ctx.font = "600 16px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`BUFFER PUBLISHER  •  ${poster.platforms.join(" / ")}`, 256, py + ph - 16);

    // 4. Clean Realistic Gallery Schedule & Title Plaque Below Print (y: 625..780)
    ctx.textAlign = "center";
    ctx.fillStyle = "#0284c7";
    ctx.font = "bold 20px sans-serif";
    ctx.fillText(`🗓️ Jadwal Tayang: ${poster.scheduleLabel}`, 256, 634);

    // Wrapped Title in clean dark charcoal (#0f172a)
    ctx.fillStyle = "#0f172a";
    ctx.font = "800 22px sans-serif";

    const allWords = poster.title.split(/\s+/);
    const lines: string[] = [];
    let currentLine = "";
    for (const w of allWords) {
      const test = currentLine ? `${currentLine} ${w}` : w;
      if (test.length > 26 && currentLine) {
        lines.push(currentLine);
        currentLine = w;
      } else {
        currentLine = test;
      }
    }
    if (currentLine) lines.push(currentLine);

    lines.slice(0, 3).forEach((line, idx) => {
      ctx.fillText(line, 256, 676 + idx * 30);
    });
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

/**
 * Creates a physical 3D Desk Nameplate (Papan Nama Meja) sitting on a character's desk
 * so we don't need floating HTML text over every NPC's head!
 */
function createDeskNameplateMesh(
  personName: string,
  personRole: string,
  isLead: boolean = false
): THREE.Group {
  const group = new THREE.Group();

  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 140;
  const ctx = canvas.getContext("2d");

  if (ctx) {
    // Sleek dark walnut / brushed brass nameplate background
    ctx.fillStyle = isLead ? "#291d12" : "#1e293b";
    ctx.fillRect(0, 0, 512, 140);

    // Warm brass/silver border
    ctx.strokeStyle = isLead ? "#f59e0b" : "#94a3b8";
    ctx.lineWidth = 6;
    ctx.strokeRect(6, 6, 500, 128);

    // Person Name
    ctx.fillStyle = isLead ? "#fef08a" : "#f8fafc";
    ctx.font = "bold 40px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(personName, 256, 64);

    // Person Role
    ctx.fillStyle = isLead ? "#fbbf24" : "#bae6fd";
    ctx.font = "600 24px sans-serif";
    ctx.fillText(personRole, 256, 106);
  }

  const tex = new THREE.CanvasTexture(canvas);
  const blockMat = new THREE.MeshStandardMaterial({
    color: isLead ? 0x451a03 : 0x1e293b,
    roughness: 0.35,
    metalness: 0.3,
  });

  // Wedge block body
  const baseBlock = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.21, 0.1), blockMat);
  baseBlock.position.y = 0.105;
  baseBlock.castShadow = true;
  group.add(baseBlock);

  // Front & Back readable plaque faces
  const faceMat = new THREE.MeshBasicMaterial({ map: tex });
  const frontPlane = new THREE.Mesh(new THREE.PlaneGeometry(0.76, 0.19), faceMat);
  frontPlane.position.set(0, 0.105, -0.052);
  frontPlane.rotation.y = Math.PI; // Facing North (-Z) toward visitors
  group.add(frontPlane);

  const backPlane = new THREE.Mesh(new THREE.PlaneGeometry(0.76, 0.19), faceMat);
  backPlane.position.set(0, 0.105, 0.052);
  group.add(backPlane);

  return group;
}

export function buildOfficeScene(scene: THREE.Scene): {
  cityBackdropMesh: THREE.Mesh;
  billiardBalls: THREE.Mesh[];
  tvScreenMesh: THREE.Mesh;
  serverLeds: THREE.Mesh[];
  bufferPosterMeshes: THREE.Mesh[];
} {
  const billiardBalls: THREE.Mesh[] = [];
  const serverLeds: THREE.Mesh[] = [];
  const bufferPosterMeshes: THREE.Mesh[] = [];

  // ============================================================================
  // 1. SPACIOUS FLOOR (64 x 46 units, covering Z = -19 to +27) & ZONE RUGS
  // ============================================================================
  const floorGeo = new THREE.PlaneGeometry(64, 46);
  const floorMat = new THREE.MeshStandardMaterial({
    map: createWoodParquetTexture(),
    roughness: 0.42,
    metalness: 0.05,
  });
  const floorMesh = new THREE.Mesh(floorGeo, floorMat);
  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.position.set(0, 0, 3.5);
  floorMesh.receiveShadow = true;
  scene.add(floorMesh);

  // Baseboard / Floor Trim
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x27272a, roughness: 0.5 });
  const floorBase = new THREE.Mesh(new THREE.BoxGeometry(64.4, 0.35, 46.4), trimMat);
  floorBase.position.set(0, -0.18, 3.5);
  scene.add(floorBase);

  // Rug 1: Soft Warm Rug in Studio Naskah (Left Wing)
  const scriptRug = new THREE.Mesh(
    new THREE.BoxGeometry(8.5, 0.03, 12.5),
    new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.9 })
  );
  scriptRug.position.set(-21.5, 0.015, -2.0);
  scriptRug.receiveShadow = true;
  scene.add(scriptRug);

  // Rug 2: Plush Cream Lounge Carpet in Warkop Obim (Right Wing)
  const loungeRug = new THREE.Mesh(
    new THREE.BoxGeometry(11.5, 0.03, 9.5),
    new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.92 })
  );
  loungeRug.position.set(21.5, 0.015, 0.8);
  loungeRug.receiveShadow = true;
  scene.add(loungeRug);

  // Rug 3: Spacious Warm Limestone Gallery Carpet in Ruangan Buffer (South Wing)
  const bufferGalleryRug = new THREE.Mesh(
    new THREE.BoxGeometry(40.0, 0.03, 12.5),
    new THREE.MeshStandardMaterial({ color: 0xf1ede4, roughness: 0.85 })
  );
  bufferGalleryRug.position.set(0, 0.015, 18.2);
  bufferGalleryRug.receiveShadow = true;
  scene.add(bufferGalleryRug);

  // ============================================================================
  // 2. ARCHITECTURAL PERIMETER WALLS & PANORAMIC SKYLINE WINDOW
  // ============================================================================
  const wallMat = new THREE.MeshStandardMaterial({
    color: 0xf5f3ef,
    roughness: 0.75,
  });

  // North Back Wall Left & Right sections
  const backWallLeft = new THREE.Mesh(new THREE.BoxGeometry(18, 7.5, 0.5), wallMat);
  backWallLeft.position.set(-23.0, 3.75, -18.0);
  backWallLeft.receiveShadow = true;
  scene.add(backWallLeft);

  const backWallRight = new THREE.Mesh(new THREE.BoxGeometry(18, 7.5, 0.5), wallMat);
  backWallRight.position.set(23.0, 3.75, -18.0);
  backWallRight.receiveShadow = true;
  scene.add(backWallRight);

  // Center Panoramic City Window (28 units wide!)
  const windowFrameMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.3, metalness: 0.4 });
  const windowGlassMat = new THREE.MeshPhysicalMaterial({
    color: 0xe0f2fe,
    transparent: true,
    opacity: 0.22,
    roughness: 0.05,
    metalness: 0.1,
  });

  const cityBackdropMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(32, 8.5),
    new THREE.MeshBasicMaterial({ map: createCitySkylineTexture("day") })
  );
  cityBackdropMesh.position.set(0, 4.1, -18.6);
  scene.add(cityBackdropMesh);

  const windowGlass = new THREE.Mesh(new THREE.PlaneGeometry(28, 6.6), windowGlassMat);
  windowGlass.position.set(0, 3.9, -17.9);
  scene.add(windowGlass);

  // Window vertical mullions
  for (let x = -14; x <= 14; x += 4.0) {
    const mullion = new THREE.Mesh(new THREE.BoxGeometry(0.16, 6.8, 0.3), windowFrameMat);
    mullion.position.set(x, 3.9, -17.85);
    scene.add(mullion);
  }
  const windowSill = new THREE.Mesh(new THREE.BoxGeometry(28.4, 0.6, 0.7), windowFrameMat);
  windowSill.position.set(0, 0.4, -17.85);
  scene.add(windowSill);

  const windowHeader = new THREE.Mesh(new THREE.BoxGeometry(28.4, 0.5, 0.7), windowFrameMat);
  windowHeader.position.set(0, 7.25, -17.85);
  scene.add(windowHeader);

  // West Wall (Left, covering full 46-unit length)
  const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.5, 7.5, 46.4), wallMat);
  leftWall.position.set(-31.5, 3.75, 3.5);
  scene.add(leftWall);

  // East Wall (Right, covering full 46-unit length)
  const rightWall = new THREE.Mesh(new THREE.BoxGeometry(0.5, 7.5, 46.4), wallMat);
  rightWall.position.set(31.5, 3.75, 3.5);
  scene.add(rightWall);

  // ============================================================================
  // 3. WING 1: STUDIO PRODUSER & PENULIS NASKAH (Glass Room Left, X = -31 to -15)
  // ============================================================================
  const glassPartitionMat = new THREE.MeshPhysicalMaterial({
    color: 0xbae6fd,
    transparent: true,
    opacity: 0.28,
    roughness: 0.08,
    metalness: 0.1,
  });

  // Glass Wall North Segment
  const glassWallN = new THREE.Mesh(new THREE.BoxGeometry(0.12, 5.2, 14), glassPartitionMat);
  glassWallN.position.set(-15.0, 2.6, -10.8);
  scene.add(glassWallN);

  // Glass Wall South Segment (leaving wide doorway at Z = -2 to +2)
  const glassWallS = new THREE.Mesh(new THREE.BoxGeometry(0.12, 5.2, 15), glassPartitionMat);
  glassWallS.position.set(-15.0, 2.6, 9.5);
  scene.add(glassWallS);

  // Black Aluminum Glass Frames
  [-17.8, -10.8, -3.8, 2.0, 9.5, 17.0].forEach((fz) => {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.2, 5.3, 0.2), windowFrameMat);
    post.position.set(-15.0, 2.65, fz);
    scene.add(post);
  });
  const glassTopBeam = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.18, 35.2), windowFrameMat);
  glassTopBeam.position.set(-15.0, 5.25, -0.4);
  scene.add(glassTopBeam);

  // Kanban Storyboard Whiteboard on West Wall
  const whiteboardFrame = new THREE.Mesh(
    new THREE.BoxGeometry(0.15, 3.4, 7.5),
    new THREE.MeshStandardMaterial({ color: 0x334155 })
  );
  whiteboardFrame.position.set(-30.65, 3.3, -2.0);
  scene.add(whiteboardFrame);

  const whiteboardSurface = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 3.1, 7.2),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 })
  );
  whiteboardSurface.position.set(-30.6, 3.3, -2.0);
  scene.add(whiteboardSurface);

  // Sticky Notes on Kanban Board
  const noteColors = [0xfef08a, 0xbfdbfe, 0xbbf7d0, 0xfbcfe8, 0xfed7aa];
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 6; col++) {
      const note = new THREE.Mesh(
        new THREE.PlaneGeometry(0.42, 0.42),
        new THREE.MeshBasicMaterial({ color: noteColors[(row * 6 + col) % noteColors.length] ?? 0xfef08a })
      );
      note.rotation.y = Math.PI / 2;
      note.position.set(-30.52, 2.4 + row * 0.75, -4.5 + col * 1.0);
      scene.add(note);
    }
  }

  // Executive Scriptwriting Conference Table at [-21.5, 0, -2.0] (Width 2.2, Length 7.6)
  // Table edges: X from -22.6 to -20.4, Z from -5.8 to +1.8
  const confTableTop = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 0.12, 7.6),
    new THREE.MeshStandardMaterial({ color: 0x3e2723, roughness: 0.35 })
  );
  confTableTop.position.set(-21.5, 0.76, -2.0);
  confTableTop.castShadow = true;
  confTableTop.receiveShadow = true;
  scene.add(confTableTop);

  // Center table cable inlay
  const tableInlay = new THREE.Mesh(
    new THREE.BoxGeometry(0.35, 0.13, 5.6),
    new THREE.MeshStandardMaterial({ color: 0x18181b, metalness: 0.5 })
  );
  tableInlay.position.set(-21.5, 0.76, -2.0);
  scene.add(tableInlay);

  // Conference table legs
  [
    [-22.2, 0.38, -5.0],
    [-20.8, 0.38, -5.0],
    [-22.2, 0.38, 1.0],
    [-20.8, 0.38, 1.0],
  ].forEach(([lx = 0, ly = 0, lz = 0]) => {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.76, 12), windowFrameMat);
    leg.position.set(lx, ly, lz);
    scene.add(leg);
  });

  // Helper to build an Executive Ergonomic Swivel Chair (placed cleanly outside table!)
  function createErgonomicChair(
    x: number,
    z: number,
    facingAngle: number,
    cushionColor: number = 0x1e293b
  ) {
    const chair = new THREE.Group();
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x27272a, metalness: 0.6, roughness: 0.3 });
    const fabricMat = new THREE.MeshStandardMaterial({ color: cushionColor, roughness: 0.65 });

    // 5-star caster base
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 0.34), metalMat);
      bar.position.set(Math.sin(a) * 0.15, 0.06, Math.cos(a) * 0.15);
      bar.rotation.y = a;
      chair.add(bar);
    }

    // Gas cylinder
    const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.38, 10), metalMat);
    cyl.position.y = 0.24;
    chair.add(cyl);

    // Seat cushion at y = 0.44
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.09, 0.54), fabricMat);
    seat.position.y = 0.44;
    seat.castShadow = true;
    chair.add(seat);

    // Contoured backrest (behind the character's back -> local negative Z when facing +Z)
    const backrest = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.62, 0.08), fabricMat);
    backrest.position.set(0, 0.78, -0.24);
    backrest.castShadow = true;
    chair.add(backrest);

    // Armrests
    [-0.29, 0.29].forEach((ax) => {
      const support = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.22, 0.04), metalMat);
      support.position.set(ax, 0.55, -0.05);
      chair.add(support);

      const pad = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.04, 0.32), metalMat);
      pad.position.set(ax, 0.66, 0.02);
      chair.add(pad);
    });

    chair.position.set(x, 0, z);
    chair.rotation.y = facingAngle;
    scene.add(chair);
  }

  // Chairs around the Conference Table in Studio Naskah
  createErgonomicChair(-21.5, -6.65, 0, 0x312e81); // Head of table (Kak Fajar)
  createErgonomicChair(-23.45, -3.5, Math.PI / 2, 0x475569); // Left 1 (Sarah Ideasi)
  createErgonomicChair(-23.45, 0.2, Math.PI / 2, 0x475569); // Left 2 (Dimas Origami)
  createErgonomicChair(-19.55, -3.5, -Math.PI / 2, 0x475569); // Right 1 (Guest chair)
  createErgonomicChair(-19.55, 0.2, -Math.PI / 2, 0x475569); // Right 2 (Guest chair)

  // Laptops & Physical 3D Desk Nameplates on the Conference Table in front of the 3 writers
  const laptopMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.7, roughness: 0.25 });
  [
    { x: -21.5, z: -5.3, rot: 0, name: "👑 Kak Fajar", role: "PIC Produser Naskah", isLead: true },
    { x: -22.25, z: -3.5, rot: Math.PI / 2, name: "Sarah Ideasi", role: "Penulis Riset Sains", isLead: false },
    { x: -22.25, z: 0.2, rot: Math.PI / 2, name: "Dimas Origami", role: "Prompt Architect", isLead: false },
  ].forEach((lp) => {
    const lGroup = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.02, 0.3), laptopMat);
    lGroup.add(base);
    const lid = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.28, 0.02), laptopMat);
    lid.position.set(0, 0.14, -0.14);
    lid.rotation.x = -0.25;
    lGroup.add(lid);
    lGroup.position.set(lp.x, 0.83, lp.z);
    lGroup.rotation.y = lp.rot + Math.PI;
    scene.add(lGroup);

    // Physical 3D Desk Nameplate on the Conference Table
    const plaque = createDeskNameplateMesh(lp.name, lp.role, lp.isLead);
    plaque.position.set(
      lp.rot === 0 ? lp.x : lp.x + 0.48,
      0.82,
      lp.rot === 0 ? lp.z + 0.45 : lp.z
    );
    plaque.rotation.y = lp.rot;
    scene.add(plaque);
  });

  // ============================================================================
  // 4. WING 2 & 3: WORKSTATION DESKS (11 Video Profiles + 1 PIC + 2 QC)
  // ============================================================================
  const deskWoodMat = new THREE.MeshStandardMaterial({ color: 0xd4a373, roughness: 0.45 });
  const leadDeskWoodMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.35 });
  const deskFrameMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.4, metalness: 0.5 });
  const monitorMat = new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.2 });
  const regularScreenTex = createMonitorScreenTexture(false);
  const leadScreenTex = createMonitorScreenTexture(true);

  WORKSTATION_DESK_CENTERS.forEach((ws) => {
    const deskGroup = new THREE.Group();
    const [dx, dy, dz] = ws.deskPos;
    const isLead = Boolean(ws.isLeadDesk);

    // Tabletop at y = 0.76 (width 2.3, depth 0.88)
    const top = new THREE.Mesh(
      new THREE.BoxGeometry(2.3, 0.07, 0.88),
      isLead ? leadDeskWoodMat : deskWoodMat
    );
    top.position.y = 0.76;
    top.castShadow = true;
    top.receiveShadow = true;
    deskGroup.add(top);

    // Physical 3D Desk Nameplate sitting on front-left of each desk!
    const deskPlaque = createDeskNameplateMesh(ws.personName, ws.personRole, isLead);
    deskPlaque.position.set(-0.72, 0.8, -0.35);
    deskGroup.add(deskPlaque);

    // Desk mat
    const matPad = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 0.01, 0.42),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8 })
    );
    matPad.position.set(0, 0.8, 0.16);
    deskGroup.add(matPad);

    // Sturdy Steel Frame Legs (at edges X = -1.05 and +1.05, leaving full legroom in center!)
    [-1.05, 1.05].forEach((lx) => {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.75, 0.82), deskFrameMat);
      leg.position.set(lx, 0.375, 0);
      leg.castShadow = true;
      deskGroup.add(leg);
    });

    // Dual Widescreen Monitors angled toward the user sitting at +Z
    const sMat = new THREE.MeshBasicMaterial({
      map: isLead ? leadScreenTex : regularScreenTex,
    });

    [-0.44, 0.44].forEach((mx, idx) => {
      const mPanel = new THREE.Group();
      const bezel = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.48, 0.04), monitorMat);
      mPanel.add(bezel);

      const display = new THREE.Mesh(new THREE.PlaneGeometry(0.78, 0.44), sMat);
      display.position.z = 0.022;
      mPanel.add(display);

      mPanel.position.set(mx, 1.12, -0.18);
      mPanel.rotation.y = idx === 0 ? 0.16 : -0.16;
      deskGroup.add(mPanel);

      const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.3, 8), deskFrameMat);
      stand.position.set(mx, 0.9, -0.22);
      deskGroup.add(stand);
    });

    // Mechanical Keyboard & Mouse (positioned on the front half of the desk so hands reach them!)
    const keyboard = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.02, 0.15),
      new THREE.MeshStandardMaterial({ color: 0x334155 })
    );
    keyboard.position.set(-0.08, 0.81, 0.18);
    deskGroup.add(keyboard);

    const mouse = new THREE.Mesh(
      new THREE.BoxGeometry(0.07, 0.02, 0.11),
      new THREE.MeshStandardMaterial({ color: 0x475569 })
    );
    mouse.position.set(0.28, 0.81, 0.18);
    deskGroup.add(mouse);

    // PC Tower with glowing LED on right side of desk
    const pcTower = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.48, 0.46), monitorMat);
    pcTower.position.set(0.92, 1.03, -0.1);
    deskGroup.add(pcTower);

    const pcGlow = new THREE.Mesh(
      new THREE.BoxGeometry(0.02, 0.36, 0.36),
      new THREE.MeshBasicMaterial({ color: isLead ? 0xf59e0b : 0x38bdf8 })
    );
    pcGlow.position.set(0.79, 1.03, -0.1);
    deskGroup.add(pcGlow);

    deskGroup.position.set(dx, dy, dz);
    deskGroup.rotation.y = ws.rotation;
    scene.add(deskGroup);

    // Build Ergonomic Swivel Chair at ws.chairPos (0.85 units behind the desk center!)
    createErgonomicChair(
      ws.chairPos[0],
      ws.chairPos[2],
      Math.PI, // Facing North toward the desk
      isLead ? 0xb45309 : 0x1e293b
    );
  });

  // ============================================================================
  // 5. CENTERPIECE: ORIGAMI ZEN TREE & BENCH AT [0, 0, -4.5]
  // ============================================================================
  const treeGroup = new THREE.Group();
  treeGroup.position.set(0, 0, -4.5);

  const planterBase = new THREE.Mesh(
    new THREE.CylinderGeometry(1.7, 1.9, 0.65, 24),
    new THREE.MeshStandardMaterial({ color: 0x292524, roughness: 0.6 })
  );
  planterBase.position.y = 0.325;
  planterBase.castShadow = true;
  treeGroup.add(planterBase);

  const benchSeat = new THREE.Mesh(
    new THREE.CylinderGeometry(2.25, 2.25, 0.12, 24),
    new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.4 })
  );
  benchSeat.position.y = 0.58;
  treeGroup.add(benchSeat);

  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.24, 0.38, 2.8, 10),
    new THREE.MeshStandardMaterial({ color: 0x5c3a21, roughness: 0.8 })
  );
  trunk.position.y = 1.9;
  treeGroup.add(trunk);

  const foliageMat = new THREE.MeshStandardMaterial({
    color: 0x15803d,
    flatShading: true,
    roughness: 0.65,
  });
  [
    { pos: [0, 3.6, 0], r: 1.5 },
    { pos: [0.8, 4.1, 0.3], r: 1.15 },
    { pos: [-0.8, 3.8, -0.4], r: 1.1 },
    { pos: [0, 4.6, -0.2], r: 1.0 },
  ].forEach(({ pos: [fx = 0, fy = 0, fz = 0], r }) => {
    const f = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), foliageMat);
    f.position.set(fx, fy, fz);
    f.castShadow = true;
    treeGroup.add(f);
  });

  scene.add(treeGroup);

  // ============================================================================
  // 6. WING 4: WARKOP OBIM & GRAND LOUNGE ISTIRAHAT (Right Wing, X = +14.5 to +30)
  // ============================================================================
  const woodSlatMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.55 });
  for (let z = -16.5; z <= 15.5; z += 0.65) {
    if (z > -4.5 && z < 3.5) continue; // Wide 8-unit open archway into Lounge!
    const slat = new THREE.Mesh(new THREE.BoxGeometry(0.16, 5.4, 0.22), woodSlatMat);
    slat.position.set(14.5, 2.7, z);
    slat.castShadow = true;
    scene.add(slat);
  }

  // WARKOP OBIM Coffee Bar Counter at [22.0, 0, -13.0] (Interactive!)
  const barGroup = new THREE.Group();
  barGroup.position.set(22.0, 0, -13.0);
  barGroup.userData = { interactiveProp: "coffee-machine", label: "Mesin Kopi Warkop Obim" };

  const barCounter = new THREE.Mesh(
    new THREE.BoxGeometry(7.5, 1.15, 1.4),
    new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.4 })
  );
  barCounter.position.y = 0.575;
  barCounter.castShadow = true;
  barGroup.add(barCounter);

  const barWoodTop = new THREE.Mesh(
    new THREE.BoxGeometry(7.8, 0.1, 1.6),
    new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.3 })
  );
  barWoodTop.position.y = 1.2;
  barGroup.add(barWoodTop);

  // Professional Dual-Group Espresso Machine
  const espressoBody = new THREE.Mesh(
    new THREE.BoxGeometry(1.3, 0.75, 0.7),
    new THREE.MeshStandardMaterial({ color: 0xe4e4e7, metalness: 0.85, roughness: 0.15 })
  );
  espressoBody.position.set(-1.2, 1.62, 0);
  barGroup.add(espressoBody);

  scene.add(barGroup);

  // Backlit "WARKOP OBIM ☕" Sign on North Wall above coffee bar
  const signCanvas = document.createElement("canvas");
  signCanvas.width = 512;
  signCanvas.height = 128;
  const sCtx = signCanvas.getContext("2d");
  if (sCtx) {
    sCtx.fillStyle = "#18181b";
    sCtx.fillRect(0, 0, 512, 128);
    sCtx.strokeStyle = "#f59e0b";
    sCtx.lineWidth = 6;
    sCtx.strokeRect(8, 8, 496, 112);
    sCtx.fillStyle = "#fbbf24";
    sCtx.font = "bold 46px sans-serif";
    sCtx.textAlign = "center";
    sCtx.fillText("WARKOP OBIM ☕", 256, 78);
  }
  const warkopSign = new THREE.Mesh(
    new THREE.PlaneGeometry(5.2, 1.3),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(signCanvas) })
  );
  warkopSign.position.set(22.0, 4.5, -17.65);
  scene.add(warkopSign);

  // Build the 11 Lounge Seats matching LOUNGE_SEATS so resting characters sit naturally!
  const chairLeatherMat = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.55 });
  const sofaVelvetMat = new THREE.MeshStandardMaterial({ color: 0x065f46, roughness: 0.7 });

  // Grand Green Velvet Sofa for seats 4, 5, 6, 7 (at Z = -1.2, X from 17.2 to 25.8)
  const grandSofaGroup = new THREE.Group();
  const sofaSeatBase = new THREE.Mesh(new THREE.BoxGeometry(8.8, 0.42, 1.3), sofaVelvetMat);
  sofaSeatBase.position.set(21.5, 0.25, -1.2);
  sofaSeatBase.castShadow = true;
  grandSofaGroup.add(sofaSeatBase);

  const sofaBackrest = new THREE.Mesh(new THREE.BoxGeometry(8.8, 0.85, 0.32), sofaVelvetMat);
  sofaBackrest.position.set(21.5, 0.65, -1.75);
  grandSofaGroup.add(sofaBackrest);

  [-4.3, 4.3].forEach((armX) => {
    const sofaArm = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.65, 1.35), sofaVelvetMat);
    sofaArm.position.set(21.5 + armX, 0.48, -1.2);
    grandSofaGroup.add(sofaArm);
  });
  scene.add(grandSofaGroup);

  // Low Marble Coffee Table in front of the Grand Sofa (at Z = 1.3 — plenty of legroom!)
  const coffeeTable = new THREE.Mesh(
    new THREE.BoxGeometry(4.6, 0.42, 1.4),
    new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.2 })
  );
  coffeeTable.position.set(21.5, 0.22, 1.3);
  coffeeTable.castShadow = true;
  scene.add(coffeeTable);

  // Individual Leather Lounge Armchairs for seats 0..3 (Z = -6.5) and seats 8..10 (Z = 4.2)
  function createLoungeArmchair(x: number, z: number, facingAngle: number) {
    const chair = new THREE.Group();
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.36, 0.9), chairLeatherMat);
    seat.position.y = 0.26;
    seat.castShadow = true;
    chair.add(seat);

    const back = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.72, 0.22), chairLeatherMat);
    back.position.set(0, 0.62, -0.36);
    chair.add(back);

    [-0.46, 0.46].forEach((ax) => {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.52, 0.88), chairLeatherMat);
      arm.position.set(ax, 0.46, 0);
      chair.add(arm);
    });

    chair.position.set(x, 0, z);
    chair.rotation.y = facingAngle;
    scene.add(chair);
  }

  [0, 1, 2, 3, 8, 9, 10].forEach((idx) => {
    const pos = LOUNGE_SEATS[idx];
    const rot = LOUNGE_FACING_ANGLES[idx] ?? 0;
    if (pos) {
      createLoungeArmchair(pos[0], pos[2], rot);
    }
  });

  // Extra armchairs for PICs if they ever rest
  createLoungeArmchair(26.5, -2.5, -Math.PI / 2);
  createLoungeArmchair(26.5, 1.5, -Math.PI / 2);

  // Interactive Billiard Table at [21.5, 0, 9.8]
  const billiardGroup = new THREE.Group();
  billiardGroup.position.set(21.5, 0, 9.8);
  billiardGroup.userData = { interactiveProp: "billiard-table", label: "Meja Biliar Lounge" };

  const bWoodMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.4 });
  const bFeltMat = new THREE.MeshStandardMaterial({ color: 0x059669, roughness: 0.85 });

  const bBody = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.28, 2.6), bWoodMat);
  bBody.position.y = 0.78;
  bBody.castShadow = true;
  billiardGroup.add(bBody);

  const bFelt = new THREE.Mesh(new THREE.BoxGeometry(4.3, 0.05, 2.1), bFeltMat);
  bFelt.position.y = 0.93;
  billiardGroup.add(bFelt);

  [
    [-2.0, 0.39, -1.0],
    [2.0, 0.39, -1.0],
    [-2.0, 0.39, 1.0],
    [2.0, 0.39, 1.0],
  ].forEach(([bx = 0, by = 0, bz = 0]) => {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.1, 0.78, 10), bWoodMat);
    leg.position.set(bx, by, bz);
    billiardGroup.add(leg);
  });

  // Billiard balls on the felt (can scatter when clicked!)
  const ballColors = [0xffffff, 0xfacc15, 0x2563eb, 0xdc2626, 0x9333ea, 0xf97316, 0x16a34a, 0x18181b];
  ballColors.forEach((bc, bi) => {
    const ball = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 12, 12),
      new THREE.MeshStandardMaterial({ color: bc, roughness: 0.15, metalness: 0.1 })
    );
    ball.position.set(-1.0 + (bi % 4) * 0.55, 1.02, -0.35 + Math.floor(bi / 4) * 0.45);
    billiardGroup.add(ball);
    billiardBalls.push(ball);
  });

  scene.add(billiardGroup);

  // Giant Wall Media TV on East Wall (X = 30.6, Z = 0)
  const tvGroup = new THREE.Group();
  tvGroup.position.set(30.6, 3.6, 0);
  tvGroup.userData = { interactiveProp: "lounge-tv", label: "Smart TV Monitoring Obim" };

  const tvBezel = new THREE.Mesh(
    new THREE.BoxGeometry(0.14, 3.2, 5.8),
    new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.2 })
  );
  tvGroup.add(tvBezel);

  const tvScreenMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.06, 2.95, 5.5),
    new THREE.MeshBasicMaterial({ map: createMonitorScreenTexture(true) })
  );
  tvScreenMesh.position.x = -0.06;
  tvGroup.add(tvScreenMesh);
  scene.add(tvGroup);

  // ============================================================================
  // 7. INTERACTIVE SERVER RACK & DECORATIVE PLANTS
  // ============================================================================
  const serverGroup = new THREE.Group();
  serverGroup.position.set(-13.2, 0, 8.2);
  serverGroup.userData = { interactiveProp: "server-rack", label: "Server Render Farm Obim" };

  const rackChassis = new THREE.Mesh(
    new THREE.BoxGeometry(1.4, 2.8, 1.2),
    new THREE.MeshStandardMaterial({ color: 0x18181b, metalness: 0.6, roughness: 0.3 })
  );
  rackChassis.position.y = 1.4;
  rackChassis.castShadow = true;
  serverGroup.add(rackChassis);

  for (let s = 0; s < 6; s++) {
    const led = new THREE.Mesh(
      new THREE.BoxGeometry(0.85, 0.08, 0.04),
      new THREE.MeshBasicMaterial({ color: s % 2 === 0 ? 0x10b981 : 0x38bdf8 })
    );
    led.position.set(0, 0.6 + s * 0.36, 0.61);
    serverGroup.add(led);
    serverLeds.push(led);
  }
  scene.add(serverGroup);

  // Indoor Potted Plants around the spacious studio
  function createPottedPlant(x: number, z: number, scale: number = 1.0) {
    const plant = new THREE.Group();
    const pot = new THREE.Mesh(
      new THREE.CylinderGeometry(0.42, 0.3, 0.75, 14),
      new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.3 })
    );
    pot.position.y = 0.375;
    pot.castShadow = true;
    plant.add(pot);

    const leafMat = new THREE.MeshStandardMaterial({
      color: 0x15803d,
      roughness: 0.45,
      flatShading: true,
    });
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.95, 5), leafMat);
      leaf.position.set(Math.cos(angle) * 0.18, 1.0, Math.sin(angle) * 0.18);
      leaf.rotation.x = Math.sin(angle) * 0.38;
      leaf.rotation.z = -Math.cos(angle) * 0.38;
      plant.add(leaf);
    }

    plant.scale.set(scale, scale, scale);
    plant.position.set(x, 0, z);
    scene.add(plant);
  }

  createPottedPlant(-14.2, -15.5, 1.3);
  createPottedPlant(13.5, -15.5, 1.3);
  createPottedPlant(-29.2, -15.5, 1.2);
  createPottedPlant(-29.2, 14.5, 1.2);
  createPottedPlant(29.0, -15.5, 1.3);
  createPottedPlant(29.0, 14.5, 1.4);
  createPottedPlant(13.5, 5.5, 1.1);

  // ============================================================================
  // 8. RUANGAN BUFFER (PUBLISHER) — SPACIOUS REALISTIC EXHIBITION GALLERY WING
  // ============================================================================
  const galleryWallMat = new THREE.MeshStandardMaterial({
    color: 0xf5f3ef,
    roughness: 0.78,
  });
  const walnutWoodMat = new THREE.MeshStandardMaterial({
    color: 0x3f271d,
    roughness: 0.55,
  });
  const warmBrassMat = new THREE.MeshStandardMaterial({
    color: 0xb48a3e,
    roughness: 0.35,
    metalness: 0.65,
  });

  // Spacious Woven Gallery Rug Runner (X: -19.5 to +19.5, Z: 14.5 to 23.8)
  const galleryRug = new THREE.Mesh(
    new THREE.BoxGeometry(39.0, 0.03, 9.2),
    new THREE.MeshStandardMaterial({ color: 0xe6e1d6, roughness: 0.92 })
  );
  galleryRug.position.set(0, 0.015, 19.2);
  galleryRug.receiveShadow = true;
  scene.add(galleryRug);

  // Subtle Walnut Wood Floor Border Trim around Gallery Rug
  [14.6, 23.8].forEach((tz) => {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(39.0, 0.035, 0.12), walnutWoodMat);
    strip.position.set(0, 0.018, tz);
    scene.add(strip);
  });

  // South Architectural Gallery Wall (Wide 46m exhibition wall at Z = 25.0)
  const bufferSouthWall = new THREE.Mesh(
    new THREE.BoxGeometry(46.0, 5.2, 0.4),
    galleryWallMat
  );
  bufferSouthWall.position.set(0, 2.6, 25.0);
  bufferSouthWall.receiveShadow = true;
  scene.add(bufferSouthWall);

  // Walnut Wood Lower Wainscoting & Baseboard along the South Gallery Wall
  const southWainscot = new THREE.Mesh(
    new THREE.BoxGeometry(45.8, 0.85, 0.44),
    walnutWoodMat
  );
  southWainscot.position.set(0, 0.425, 24.98);
  scene.add(southWainscot);

  // West & East Side Gallery Walls (X = -22.8 and +22.8, Z: 15.0 to 25.0)
  const bufferWestWall = new THREE.Mesh(
    new THREE.BoxGeometry(0.4, 5.2, 10.2),
    galleryWallMat
  );
  bufferWestWall.position.set(-22.8, 2.6, 20.0);
  scene.add(bufferWestWall);

  const bufferEastWall = new THREE.Mesh(
    new THREE.BoxGeometry(0.4, 5.2, 10.2),
    galleryWallMat
  );
  bufferEastWall.position.set(22.8, 2.6, 20.0);
  scene.add(bufferEastWall);

  // Open Architectural Timber Portal Columns & Header Beam at Z = 14.8 (Wide 22m open entrance)
  [-11.5, 11.5].forEach((px) => {
    const column = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 4.8, 0.55),
      walnutWoodMat
    );
    column.position.set(px, 2.4, 14.8);
    column.castShadow = true;
    scene.add(column);
  });

  const galleryHeaderBeam = new THREE.Mesh(
    new THREE.BoxGeometry(23.6, 0.78, 0.48),
    walnutWoodMat
  );
  galleryHeaderBeam.position.set(0, 4.45, 14.8);
  scene.add(galleryHeaderBeam);

  // Realistic Architectural Wood & Brass Signage Plaque ("BUFFER PUBLISHER • GALERI JADWAL TAYANG")
  const gallerySignCanvas = document.createElement("canvas");
  gallerySignCanvas.width = 1024;
  gallerySignCanvas.height = 160;
  const gsCtx = gallerySignCanvas.getContext("2d");
  if (gsCtx) {
    gsCtx.fillStyle = "#2c1d16";
    gsCtx.fillRect(0, 0, 1024, 160);
    gsCtx.strokeStyle = "#c8a96e";
    gsCtx.lineWidth = 6;
    gsCtx.strokeRect(10, 10, 1004, 140);

    gsCtx.fillStyle = "#f8fafc";
    gsCtx.font = "800 38px sans-serif";
    gsCtx.textAlign = "center";
    gsCtx.fillText("BUFFER PUBLISHER  •  GALERI JADWAL TAYANG", 512, 95);
  }
  const gallerySignTex = new THREE.CanvasTexture(gallerySignCanvas);
  const gallerySignFront = new THREE.Mesh(
    new THREE.PlaneGeometry(11.5, 0.68),
    new THREE.MeshBasicMaterial({ map: gallerySignTex })
  );
  gallerySignFront.position.set(0, 4.45, 14.55);
  gallerySignFront.rotation.y = Math.PI; // Facing North toward the studio
  scene.add(gallerySignFront);

  const gallerySignBack = new THREE.Mesh(
    new THREE.PlaneGeometry(11.5, 0.68),
    new THREE.MeshBasicMaterial({ map: gallerySignTex })
  );
  gallerySignBack.position.set(0, 4.45, 15.05);
  scene.add(gallerySignBack);

  // 8 Spacious Realistic Walnut-Framed Schedule Poster Boards along the South Gallery Wall
  DEFAULT_BUFFER_POSTERS.forEach((poster, idx) => {
    const coords = BUFFER_POSTER_WORLD_COORDS[idx] ?? [0, 2.45, 24.5];

    // Realistic Walnut Wood Exhibition Frame
    const frameMesh = new THREE.Mesh(
      new THREE.BoxGeometry(3.05, 4.35, 0.12),
      walnutWoodMat
    );
    frameMesh.position.set(coords[0], coords[1], coords[2]);
    frameMesh.castShadow = true;
    scene.add(frameMesh);

    // Warm Brass Inner Accent Trim
    const brassTrim = new THREE.Mesh(
      new THREE.BoxGeometry(2.86, 4.16, 0.13),
      warmBrassMat
    );
    brassTrim.position.set(coords[0], coords[1], coords[2] - 0.005);
    scene.add(brassTrim);

    // Realistic Matte Poster Display Plane facing North (Math.PI) into the Gallery
    const posterMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(2.78, 4.08),
      new THREE.MeshBasicMaterial({
        map: createBufferCinemaPosterTexture(poster),
      })
    );
    posterMesh.position.set(coords[0], coords[1], coords[2] - 0.075);
    posterMesh.rotation.y = Math.PI;
    posterMesh.userData = {
      interactiveProp: "buffer-poster",
      bufferPosterSlot: idx,
      label: `Poster Jadwal Buffer #${idx + 1}`,
    };
    scene.add(posterMesh);
    bufferPosterMeshes.push(posterMesh);

    // Realistic Overhead Gallery Picture Lamp Fixture
    const lampArm = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.08, 0.45),
      warmBrassMat
    );
    lampArm.position.set(coords[0], 4.75, coords[2] - 0.2);
    scene.add(lampArm);

    const lampHood = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 0.09, 0.16),
      warmBrassMat
    );
    lampHood.position.set(coords[0], 4.72, coords[2] - 0.4);
    scene.add(lampHood);
  });

  // Realistic Wooden Gallery Information Board on East Wall ("Jadwal Tayang Otomatis • Publisher: Buffer")
  const infoSignCanvas = document.createElement("canvas");
  infoSignCanvas.width = 512;
  infoSignCanvas.height = 512;
  const nCtx = infoSignCanvas.getContext("2d");
  if (nCtx) {
    nCtx.fillStyle = "#faf8f5";
    nCtx.fillRect(0, 0, 512, 512);
    nCtx.strokeStyle = "#3f271d";
    nCtx.lineWidth = 18;
    nCtx.strokeRect(9, 9, 494, 494);
    nCtx.strokeStyle = "#c8a96e";
    nCtx.lineWidth = 4;
    nCtx.strokeRect(28, 28, 456, 456);

    nCtx.fillStyle = "#78716c";
    nCtx.font = "bold 22px sans-serif";
    nCtx.textAlign = "center";
    nCtx.fillText("DIVISI DISTRIBUSI & PUBLISHER", 256, 110);

    nCtx.fillStyle = "#1c1917";
    nCtx.font = "900 44px sans-serif";
    nCtx.fillText("BUFFER STUDIO", 256, 185);

    nCtx.fillStyle = "#d6d3d1";
    nCtx.fillRect(96, 220, 320, 3);

    nCtx.fillStyle = "#44403c";
    nCtx.font = "600 28px sans-serif";
    nCtx.fillText("Jadwal tayang tersinkronisasi", 256, 285);
    nCtx.fillText("otomatis dengan antrian", 256, 325);
    nCtx.fillText("TikTok, Shorts & Reels.", 256, 365);

    nCtx.fillStyle = "#b45309";
    nCtx.font = "bold 22px sans-serif";
    nCtx.fillText("KLIK POSTER UNTUK DETAIL", 256, 435);
  }
  const infoSignMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(2.6, 2.6),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(infoSignCanvas) })
  );
  infoSignMesh.position.set(22.55, 2.45, 19.5);
  infoSignMesh.rotation.y = -Math.PI / 2; // Facing West into Gallery
  scene.add(infoSignMesh);

  // ============================================================================
  // 9. PINTU KELUAR UTAMA STUDIO (INTERACTIVE EXIT DOOR -> KEMBALI KE WEBSITE STUDIO)
  // ============================================================================
  const exitDoorGroup = new THREE.Group();
  exitDoorGroup.position.set(-19.2, 0, 14.75);
  exitDoorGroup.userData = {
    interactiveProp: "exit-door",
    label: "Pintu Keluar ke Website Studio",
  };

  // Surrounding Architectural Wall & Walnut Door Frame
  const exitWallBack = new THREE.Mesh(
    new THREE.BoxGeometry(6.8, 5.2, 0.38),
    galleryWallMat
  );
  exitWallBack.position.set(0, 2.6, 0);
  exitWallBack.receiveShadow = true;
  exitDoorGroup.add(exitWallBack);

  const doorOuterFrame = new THREE.Mesh(
    new THREE.BoxGeometry(3.4, 4.1, 0.46),
    walnutWoodMat
  );
  doorOuterFrame.position.set(0, 2.05, -0.02);
  doorOuterFrame.castShadow = true;
  exitDoorGroup.add(doorOuterFrame);

  // Double Walnut & Frosted Glass Door Leaves
  const doorGlassMat = new THREE.MeshPhysicalMaterial({
    color: 0xe2e8f0,
    roughness: 0.2,
    transmission: 0.35,
    transparent: true,
    opacity: 0.88,
  });

  [-0.76, 0.76].forEach((dx) => {
    const leafWood = new THREE.Mesh(
      new THREE.BoxGeometry(1.46, 3.85, 0.5),
      new THREE.MeshStandardMaterial({ color: 0x4a2e21, roughness: 0.5 })
    );
    leafWood.position.set(dx, 1.93, -0.03);
    leafWood.userData = {
      interactiveProp: "exit-door",
      label: "Pintu Keluar ke Website Studio",
    };
    exitDoorGroup.add(leafWood);

    const leafGlass = new THREE.Mesh(
      new THREE.BoxGeometry(1.05, 2.45, 0.52),
      doorGlassMat
    );
    leafGlass.position.set(dx, 2.25, -0.04);
    leafGlass.userData = {
      interactiveProp: "exit-door",
      label: "Pintu Keluar ke Website Studio",
    };
    exitDoorGroup.add(leafGlass);

    // Brass Push Bar Handle
    const handleX = dx < 0 ? dx + 0.52 : dx - 0.52;
    const brassHandle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.03, 0.75, 12),
      warmBrassMat
    );
    brassHandle.position.set(handleX, 1.75, -0.32);
    brassHandle.userData = {
      interactiveProp: "exit-door",
      label: "Pintu Keluar ke Website Studio",
    };
    exitDoorGroup.add(brassHandle);
  });

  // Overhead Architectural Exit Sign Plaque ("🚪 PINTU KELUAR • WEBSITE STUDIO")
  const exitSignCanvas = document.createElement("canvas");
  exitSignCanvas.width = 768;
  exitSignCanvas.height = 160;
  const exCtx = exitSignCanvas.getContext("2d");
  if (exCtx) {
    exCtx.fillStyle = "#14532d";
    exCtx.fillRect(0, 0, 768, 160);
    exCtx.strokeStyle = "#f8fafc";
    exCtx.lineWidth = 8;
    exCtx.strokeRect(12, 12, 744, 136);

    exCtx.fillStyle = "#ffffff";
    exCtx.font = "900 38px sans-serif";
    exCtx.textAlign = "center";
    exCtx.fillText("🚪 PINTU KELUAR • WEB STUDIO", 384, 82);

    exCtx.fillStyle = "#bbf7d0";
    exCtx.font = "bold 22px sans-serif";
    exCtx.fillText("DEKATI & TEKAN [E] ATAU KLIK UNTUK KELUAR", 384, 124);
  }
  const exitSignMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(3.5, 0.72),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(exitSignCanvas) })
  );
  exitSignMesh.position.set(0, 4.48, -0.26);
  exitSignMesh.rotation.y = Math.PI; // Facing North toward the studio floor
  exitSignMesh.userData = {
    interactiveProp: "exit-door",
    label: "Pintu Keluar ke Website Studio",
  };
  exitDoorGroup.add(exitSignMesh);

  // Welcome / Exit Floor Mat in front of the door (North side at Z = 13.45)
  const exitMatMesh = new THREE.Mesh(
    new THREE.BoxGeometry(3.4, 0.03, 1.6),
    new THREE.MeshStandardMaterial({ color: 0x292524, roughness: 0.9 })
  );
  exitMatMesh.position.set(0, 0.015, -1.25);
  exitMatMesh.userData = {
    interactiveProp: "exit-door",
    label: "Pintu Keluar ke Website Studio",
  };
  exitDoorGroup.add(exitMatMesh);

  // Subtle Brass Floor Ring Indicator on the mat
  const exitRing = new THREE.Mesh(
    new THREE.RingGeometry(0.65, 0.78, 32),
    new THREE.MeshBasicMaterial({
      color: 0x10b981,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.75,
    })
  );
  exitRing.rotation.x = -Math.PI / 2;
  exitRing.position.set(0, 0.035, -1.25);
  exitDoorGroup.add(exitRing);

  scene.add(exitDoorGroup);

  return {
    cityBackdropMesh,
    billiardBalls,
    tvScreenMesh,
    serverLeds,
    bufferPosterMeshes,
  };
}

/**
 * Builds an articulated Anime/Stylized 3D Character matching the user's reference images:
 * - Expressive anime face texture
 * - Sculpted tousled hair (male) or bob-cut hair with bangs & ear stud (female)
 * - Open overshirt/jacket over inner crew-neck tee
 * - Hanging neck lanyard with staff ID card badge on chest
 * - Articulated arms (with wristwatch) & legs (cargo pants + two-tone sneakers)
 * - Returns both the root THREE.Group and the AvatarRig for 60fps idle/walk animations
 */
export function createAvatarMesh(member: OfficeMember): {
  group: THREE.Group;
  rig: AvatarRig;
} {
  const root = new THREE.Group();
  root.name = `avatar-${member.id}`;
  root.userData = {
    memberId: member.id,
    isClickable: true,
  };

  // Materials
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xffe4d6, roughness: 0.55 });
  const hairMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(member.hairColor),
    roughness: 0.45,
  });
  const jacketMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(member.color),
    roughness: 0.6,
  });
  const innerShirtMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(member.innerShirtColor),
    roughness: 0.65,
  });
  const pantsMat = new THREE.MeshStandardMaterial({
    color: member.gender === "female" ? 0x334155 : 0x18181b,
    roughness: 0.7,
  });
  const sneakerWhiteMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.4 });
  const sneakerAccentMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5 });

  // Body pivot adjusts height between sitting and walking
  const bodyPivot = new THREE.Group();
  root.add(bodyPivot);

  // ============================================================================
  // 1. TORSO (Inner Tee + Open Work Jacket / Overshirt + Lanyard ID Card)
  // ============================================================================
  const torsoGroup = new THREE.Group();
  torsoGroup.position.y = 0.78;
  bodyPivot.add(torsoGroup);

  // Inner crew-neck T-shirt core
  const innerTorso = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.5, 0.22), innerShirtMat);
  innerTorso.castShadow = true;
  torsoGroup.add(innerTorso);

  // Open Overshirt / Jacket Back & Left/Right Front Panels
  const jacketBack = new THREE.Mesh(new THREE.BoxGeometry(0.41, 0.51, 0.06), jacketMat);
  jacketBack.position.z = -0.09;
  torsoGroup.add(jacketBack);

  [-0.13, 0.13].forEach((jx) => {
    const frontPanel = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.51, 0.24), jacketMat);
    frontPanel.position.set(jx, 0, 0.01);
    frontPanel.castShadow = true;
    torsoGroup.add(frontPanel);

    // Collar lapel
    const lapel = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, 0.04), jacketMat);
    lapel.position.set(jx * 0.75, 0.21, 0.12);
    lapel.rotation.z = jx < 0 ? -0.3 : 0.3;
    torsoGroup.add(lapel);
  });

  // Neck Lanyard Strap + Staff ID Badge Card (Matching Male Reference Image!)
  const lanyardMat = new THREE.MeshStandardMaterial({ color: 0x09090b });
  [-0.045, 0.045].forEach((lx) => {
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.24, 0.015), lanyardMat);
    strap.position.set(lx, 0.12, 0.12);
    strap.rotation.z = lx < 0 ? -0.18 : 0.18;
    torsoGroup.add(strap);
  });

  const idBadgeCase = new THREE.Mesh(
    new THREE.BoxGeometry(0.085, 0.115, 0.018),
    new THREE.MeshStandardMaterial({ color: 0x18181b })
  );
  idBadgeCase.position.set(0, -0.03, 0.125);
  torsoGroup.add(idBadgeCase);

  const idBadgeCard = new THREE.Mesh(
    new THREE.PlaneGeometry(0.065, 0.085),
    new THREE.MeshBasicMaterial({ color: member.isLead ? 0xfbbf24 : 0x38bdf8 })
  );
  idBadgeCard.position.set(0, -0.03, 0.136);
  torsoGroup.add(idBadgeCard);

  // Neck
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.085, 0.14, 12), skinMat);
  neck.position.y = 0.3;
  torsoGroup.add(neck);

  // ============================================================================
  // 2. HEAD & ANIME HAIR (Male Tousled Spikes vs Female Bob Cut)
  // ============================================================================
  const headGroup = new THREE.Group();
  headGroup.position.y = 0.52;
  torsoGroup.add(headGroup);

  // Head sphere slightly sculpted (radius 0.218 prevents z-fighting with curved face cylinder)
  const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.218, 20, 20), skinMat);
  headMesh.scale.set(1.0, 1.06, 0.95);
  headMesh.castShadow = true;
  headGroup.add(headMesh);

  // Curved Anime Face Front Plane facing +Z
  const faceTex = createAnimeFaceTexture(member.hairColor, member.gender);
  const faceMat = new THREE.MeshBasicMaterial({
    map: faceTex,
    transparent: true,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const faceGeo = new THREE.CylinderGeometry(
    0.232,
    0.222,
    0.28,
    18,
    1,
    true,
    -Math.PI / 3.2,
    (Math.PI * 2) / 3.2
  );
  const faceMesh = new THREE.Mesh(faceGeo, faceMat);
  faceMesh.position.set(0, -0.01, 0.015);
  headGroup.add(faceMesh);

  // Ears
  [-0.22, 0.22].forEach((ex) => {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), skinMat);
    ear.position.set(ex, -0.01, 0);
    headGroup.add(ear);
  });

  // Hair Cap Base
  const hairCap = new THREE.Mesh(
    new THREE.SphereGeometry(0.245, 18, 18, 0, Math.PI * 2, 0, Math.PI * 0.62),
    hairMat
  );
  hairCap.position.set(0, 0.03, -0.01);
  hairCap.castShadow = true;
  headGroup.add(hairCap);

  if (member.gender === "female") {
    // Female Bob-Cut Side Locks & Back (Matching Reference Image 1)
    [-0.19, 0.19].forEach((hx) => {
      const bobSide = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.34, 0.24), hairMat);
      bobSide.position.set(hx, -0.04, 0.02);
      bobSide.rotation.z = hx < 0 ? 0.12 : -0.12;
      headGroup.add(bobSide);
    });

    const bobBack = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.32, 0.12), hairMat);
    bobBack.position.set(0, -0.04, -0.18);
    headGroup.add(bobBack);

    // Front Bangs
    [-0.1, 0, 0.1].forEach((bx, bi) => {
      const bang = new THREE.Mesh(new THREE.ConeGeometry(0.065, 0.18, 5), hairMat);
      bang.position.set(bx, 0.14, 0.21);
      bang.rotation.x = Math.PI + 0.22;
      bang.rotation.z = (bi - 1) * 0.15;
      headGroup.add(bang);
    });

    // Cute Gold Earring Stud on Right Ear (Matching Reference Image 1)
    const earring = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.032, 0),
      new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.8, roughness: 0.2 })
    );
    earring.position.set(-0.23, -0.07, 0.03);
    headGroup.add(earring);
  } else {
    // Male Tousled Anime Hair Locks & Center-Parted Bangs (Matching Reference Image 2)
    const spikeConfigs = [
      { pos: [-0.09, 0.14, 0.21], rot: [Math.PI + 0.25, 0, -0.25], s: 1.0 },
      { pos: [0.09, 0.14, 0.21], rot: [Math.PI + 0.25, 0, 0.25], s: 1.0 },
      { pos: [-0.18, 0.09, 0.14], rot: [Math.PI + 0.1, 0, -0.45], s: 0.9 },
      { pos: [0.18, 0.09, 0.14], rot: [Math.PI + 0.1, 0, 0.45], s: 0.9 },
      { pos: [0, 0.26, 0.02], rot: [-0.3, 0, 0.2], s: 1.1 },
      { pos: [-0.14, 0.23, -0.05], rot: [-0.2, 0, 0.5], s: 1.0 },
      { pos: [0.14, 0.23, -0.05], rot: [-0.2, 0, -0.5], s: 1.0 },
    ];
    spikeConfigs.forEach(({ pos: [sx = 0, sy = 0, sz = 0], rot: [rx = 0, ry = 0, rz = 0], s }) => {
      const lock = new THREE.Mesh(new THREE.ConeGeometry(0.07 * s, 0.2 * s, 5), hairMat);
      lock.position.set(sx, sy, sz);
      lock.rotation.set(rx, ry, rz);
      headGroup.add(lock);
    });
  }

  // Subtle Gold Crown Beacon for Team Leads (PIC)
  if (member.isLead) {
    const crown = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.07, 0.07, 6),
      new THREE.MeshStandardMaterial({
        color: 0xfbbf24,
        metalness: 0.85,
        roughness: 0.15,
        emissive: 0xf59e0b,
        emissiveIntensity: 0.35,
      })
    );
    crown.position.y = 0.32;
    headGroup.add(crown);
  }

  // ============================================================================
  // 3. ARTICULATED ARMS, FOREARMS, HANDS & WRISTWATCH
  // ============================================================================
  function buildArm(isLeft: boolean) {
    const armGroup = new THREE.Group();
    armGroup.position.set(isLeft ? -0.25 : 0.25, 0.2, 0);

    // Rolled Jacket Upper Sleeve
    const upperSleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.062, 0.24, 10), jacketMat);
    upperSleeve.position.y = -0.1;
    upperSleeve.castShadow = true;
    armGroup.add(upperSleeve);

    // Rolled Cuff Ring
    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.072, 0.045, 10), jacketMat);
    cuff.position.y = -0.21;
    armGroup.add(cuff);

    // Forearm Pivot at Elbow
    const forearmGroup = new THREE.Group();
    forearmGroup.position.y = -0.22;
    armGroup.add(forearmGroup);

    const forearm = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.044, 0.22, 10), skinMat);
    forearm.position.y = -0.1;
    forearmGroup.add(forearm);

    // Wristwatch on Left Wrist (Matching Reference Image 2!)
    if (isLeft) {
      const watch = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.05, 0.03, 12),
        new THREE.MeshStandardMaterial({ color: 0x09090b, metalness: 0.7 })
      );
      watch.position.y = -0.18;
      forearmGroup.add(watch);
    }

    // Hand
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 10), skinMat);
    hand.position.y = -0.22;
    forearmGroup.add(hand);

    return { armGroup, forearmGroup };
  }

  const leftArm = buildArm(true);
  const rightArm = buildArm(false);
  torsoGroup.add(leftArm.armGroup);
  torsoGroup.add(rightArm.armGroup);

  // Coffee Mug attached to Right Hand (visible when resting in Lounge!)
  const coffeeMugGroup = new THREE.Group();
  const mugCup = new THREE.Mesh(
    new THREE.CylinderGeometry(0.045, 0.038, 0.09, 12),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 })
  );
  coffeeMugGroup.add(mugCup);
  const coffeeLiquid = new THREE.Mesh(
    new THREE.CircleGeometry(0.04, 10),
    new THREE.MeshBasicMaterial({ color: 0x451a03 })
  );
  coffeeLiquid.rotation.x = -Math.PI / 2;
  coffeeLiquid.position.y = 0.046;
  coffeeMugGroup.add(coffeeLiquid);

  coffeeMugGroup.position.set(0, -0.24, 0.05);
  coffeeMugGroup.visible = member.status === "resting";
  rightArm.forearmGroup.add(coffeeMugGroup);

  // ============================================================================
  // 4. ARTICULATED LEGS (Cargo Pants + Two-Tone Sneakers)
  // ============================================================================
  function buildLeg(isLeft: boolean) {
    const legGroup = new THREE.Group();
    legGroup.position.set(isLeft ? -0.11 : 0.11, 0.52, 0);

    // Upper Thigh
    const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.34, 0.16), pantsMat);
    thigh.position.y = -0.16;
    thigh.castShadow = true;
    legGroup.add(thigh);

    // Cargo Side Pocket Detail (Matching Reference Image 2!)
    const pocket = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.13, 0.11), pantsMat);
    pocket.position.set(isLeft ? -0.085 : 0.085, -0.16, 0);
    legGroup.add(pocket);

    // Knee Pivot / Lower Leg
    const lowerLegGroup = new THREE.Group();
    lowerLegGroup.position.y = -0.32;
    legGroup.add(lowerLegGroup);

    const shin = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.32, 0.15), pantsMat);
    shin.position.y = -0.15;
    shin.castShadow = true;
    lowerLegGroup.add(shin);

    // Chunky Two-Tone Sneaker
    const shoeGroup = new THREE.Group();
    shoeGroup.position.set(0, -0.31, 0.04);

    const sole = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.04, 0.25), sneakerWhiteMat);
    shoeGroup.add(sole);

    const upperShoe = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.06, 0.22), sneakerAccentMat);
    upperShoe.position.set(0, 0.04, -0.01);
    shoeGroup.add(upperShoe);

    const toeCap = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.045, 0.09), sneakerWhiteMat);
    toeCap.position.set(0, 0.035, 0.08);
    shoeGroup.add(toeCap);

    lowerLegGroup.add(shoeGroup);

    return { legGroup, lowerLegGroup };
  }

  const leftLeg = buildLeg(true);
  const rightLeg = buildLeg(false);
  bodyPivot.add(leftLeg.legGroup);
  bodyPivot.add(rightLeg.legGroup);

  // Subtle floor selection ring
  const ringGeo = new THREE.RingGeometry(0.55, 0.68, 28);
  const ringMat = new THREE.MeshBasicMaterial({
    color: member.status === "resting" ? 0xf43f5e : 0x38bdf8,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.45,
  });
  const haloRing = new THREE.Mesh(ringGeo, ringMat);
  haloRing.rotation.x = -Math.PI / 2;
  haloRing.position.y = 0.02;
  haloRing.name = "halo-ring";
  root.add(haloRing);

  // Position character at initial location
  root.position.set(...member.currentPosition);
  root.rotation.y =
    member.status === "resting" ? member.loungeFacingAngle : member.facingAngle;

  const rig: AvatarRig = {
    root,
    bodyPivot,
    torsoGroup,
    headGroup,
    leftArmGroup: leftArm.armGroup,
    rightArmGroup: rightArm.armGroup,
    leftForearmGroup: leftArm.forearmGroup,
    rightForearmGroup: rightArm.forearmGroup,
    leftLegGroup: leftLeg.legGroup,
    rightLegGroup: rightLeg.legGroup,
    leftLowerLegGroup: leftLeg.lowerLegGroup,
    rightLowerLegGroup: rightLeg.lowerLegGroup,
    coffeeMugGroup,
    haloRing,
    phaseOffset:
      Math.abs(member.id.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0)) * 0.73,
  };

  return { group: root, rig };
}
