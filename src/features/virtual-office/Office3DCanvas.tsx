"use client";

import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { BufferSchedulePosterItem, LightingMode, OfficeMember } from "./types";
import {
  AvatarRig,
  buildOfficeScene,
  createAvatarMesh,
  createBufferCinemaPosterTexture,
  createCitySkylineTexture,
} from "./office-scene-builder";
import { resolveBodyBlockCollision, CircleCollider } from "./collision-map";
import { BUFFER_POSTER_WORLD_COORDS, DEFAULT_BUFFER_POSTERS } from "./constants";

interface Office3DCanvasProps {
  members: OfficeMember[];
  selectedMemberId: string | null;
  lightingMode: LightingMode;
  cameraFollowPlayer: boolean; // True = Third-Person Game Mode!
  activeSpeechBubbles: Record<string, { text: string; expiresAt: number }>;
  virtualMoveInput: { dx: number; dz: number; sprint: boolean };
  bufferPosters?: BufferSchedulePosterItem[];
  onSelectMember: (member: OfficeMember) => void;
  onSelectBufferPoster?: (poster: BufferSchedulePosterItem) => void;
  onPropInteract?: (propId: string, message: string) => void;
  targetCamera: {
    position: [number, number, number];
    target: [number, number, number];
  } | null;
  onCameraTransitionDone?: () => void;
}

interface ProjectedNametag {
  id: string;
  name: string;
  role: string;
  status: string;
  credits: number;
  isLead: boolean;
  isPlayer?: boolean;
  isWalking: boolean;
  speechBubble?: string;
  x: number;
  y: number;
  member?: OfficeMember;
}

export interface NearbyInteractionTarget {
  type: "member" | "prop" | "buffer-poster";
  id: string;
  label: string;
  sublabel: string;
  member?: OfficeMember;
  poster?: BufferSchedulePosterItem;
}

export function Office3DCanvas({
  members,
  selectedMemberId,
  lightingMode,
  cameraFollowPlayer,
  activeSpeechBubbles,
  virtualMoveInput,
  bufferPosters = DEFAULT_BUFFER_POSTERS,
  onSelectMember,
  onSelectBufferPoster,
  onPropInteract,
  targetCamera,
  onCameraTransitionDone,
}: Office3DCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [nametags, setNametags] = useState<ProjectedNametag[]>([]);
  const [nearbyTarget, setNearbyTarget] = useState<NearbyInteractionTarget | null>(
    null
  );
  const [collisionNotice, setCollisionNotice] = useState<string | null>(null);

  // Mutable refs for 60fps loop
  const membersRef = useRef<OfficeMember[]>(members);
  useEffect(() => {
    membersRef.current = members;
  }, [members]);

  const bufferPostersRef = useRef<BufferSchedulePosterItem[]>(bufferPosters);
  const posterMeshesRef = useRef<THREE.Mesh[]>([]);

  useEffect(() => {
    bufferPostersRef.current = bufferPosters;
    // Dynamically update 3D Neon Poster Textures in Buffer Cinema Corridor
    if (posterMeshesRef.current.length > 0) {
      bufferPosters.forEach((poster, idx) => {
        const mesh = posterMeshesRef.current[idx];
        if (mesh) {
          const mat = mesh.material as THREE.MeshBasicMaterial;
          if (mat.map) mat.map.dispose();
          mat.map = createBufferCinemaPosterTexture(poster);
          mat.needsUpdate = true;
        }
      });
    }
  }, [bufferPosters]);

  const bubblesRef = useRef(activeSpeechBubbles);
  useEffect(() => {
    bubblesRef.current = activeSpeechBubbles;
  }, [activeSpeechBubbles]);

  const followPlayerRef = useRef(cameraFollowPlayer);
  useEffect(() => {
    followPlayerRef.current = cameraFollowPlayer;
    if (cameraFollowPlayer) {
      isTransitioningCamera.current = false;
    }
  }, [cameraFollowPlayer]);

  const virtualMoveRef = useRef(virtualMoveInput);
  useEffect(() => {
    virtualMoveRef.current = virtualMoveInput;
  }, [virtualMoveInput]);

  const selectedIdRef = useRef<string | null>(selectedMemberId);
  useEffect(() => {
    selectedIdRef.current = selectedMemberId;
  }, [selectedMemberId]);

  const onSelectMemberRef = useRef(onSelectMember);
  useEffect(() => {
    onSelectMemberRef.current = onSelectMember;
  }, [onSelectMember]);

  const onSelectBufferPosterRef = useRef(onSelectBufferPoster);
  useEffect(() => {
    onSelectBufferPosterRef.current = onSelectBufferPoster;
  }, [onSelectBufferPoster]);

  const onPropInteractRef = useRef(onPropInteract);
  useEffect(() => {
    onPropInteractRef.current = onPropInteract;
  }, [onPropInteract]);

  const nearbyTargetRef = useRef<NearbyInteractionTarget | null>(null);

  // Active interaction animation state (CEO + NPC greeting/talking gesture)
  const interactionAnimRef = useRef<{
    targetId: string;
    targetPos: [number, number, number];
    expiresAt: number;
  } | null>(null);

  // Third-person camera yaw angle (in radians) behind CEO Obim
  const thirdPersonYawRef = useRef<number>(0);

  // Three.js scene objects
  const sceneRef = useRef<THREE.Scene | null>(null);
  const ambientLightRef = useRef<THREE.AmbientLight | null>(null);
  const sunLightRef = useRef<THREE.DirectionalLight | null>(null);
  const cityBackdropRef = useRef<THREE.Mesh | null>(null);
  const rigsRef = useRef<Map<string, AvatarRig>>(new Map());
  const playerRigRef = useRef<AvatarRig | null>(null);
  const playerTargetDestRef = useRef<THREE.Vector3 | null>(null);
  const billiardBallsRef = useRef<
    Array<{ mesh: THREE.Mesh; vx: number; vz: number }>
  >([]);

  // Smooth camera transition targets
  const lerpTargetPos = useRef<THREE.Vector3>(new THREE.Vector3(0, 26, 26));
  const lerpLookAt = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, 0));
  const isTransitioningCamera = useRef<boolean>(false);

  useEffect(() => {
    if (targetCamera) {
      lerpTargetPos.current.set(...targetCamera.position);
      lerpLookAt.current.set(...targetCamera.target);
      isTransitioningCamera.current = true;
    }
  }, [targetCamera]);

  // Update lighting mode (Day / Sunset / Night)
  useEffect(() => {
    const scene = sceneRef.current;
    const ambient = ambientLightRef.current;
    const sun = sunLightRef.current;
    const backdrop = cityBackdropRef.current;
    if (!scene || !ambient || !sun || !backdrop) return;

    if (lightingMode === "day") {
      scene.background = new THREE.Color(0xdfd9ce);
      ambient.color.setHex(0xfff7ed);
      ambient.intensity = 1.25;
      sun.color.setHex(0xffedd5);
      sun.intensity = 1.85;
    } else if (lightingMode === "sunset") {
      scene.background = new THREE.Color(0x2a1829);
      ambient.color.setHex(0xfed7aa);
      ambient.intensity = 0.95;
      sun.color.setHex(0xf97316);
      sun.intensity = 2.1;
    } else {
      scene.background = new THREE.Color(0x090d16);
      ambient.color.setHex(0x93c5fd);
      ambient.intensity = 0.65;
      sun.color.setHex(0x38bdf8);
      sun.intensity = 0.9;
    }

    const mat = backdrop.material as THREE.MeshBasicMaterial;
    mat.map = createCitySkylineTexture(lightingMode);
    mat.needsUpdate = true;
  }, [lightingMode]);

  // Trigger interaction with nearby NPC, Buffer Poster, or Prop (with 3D interaction animation!)
  const triggerInteractWithTarget = (target: NearbyInteractionTarget) => {
    if (target.type === "member" && target.member) {
      const mCoord =
        target.member.status === "resting"
          ? target.member.loungePosition
          : target.member.deskPosition;
      interactionAnimRef.current = {
        targetId: target.member.id,
        targetPos: mCoord,
        expiresAt: performance.now() + 6000,
      };
      onSelectMemberRef.current(target.member);
      return;
    }

    if (target.type === "buffer-poster" && target.poster) {
      interactionAnimRef.current = {
        targetId: target.id,
        targetPos: target.poster.worldPosition,
        expiresAt: performance.now() + 3500,
      };
      onSelectBufferPosterRef.current?.(target.poster);
      return;
    }

    if (target.type === "prop") {
      interactionAnimRef.current = {
        targetId: target.id,
        targetPos: [0, 0, 0],
        expiresAt: performance.now() + 2800,
      };
      if (target.id === "billiard-table") {
        billiardBallsRef.current.forEach((b) => {
          b.vx = (Math.random() - 0.5) * 4.8;
          b.vz = (Math.random() - 0.5) * 3.5;
        });
        onPropInteractRef.current?.(
          target.id,
          "🎱 Break Shot! CEO Obim menyodok bola biliar di Lounge Warkop Obim."
        );
      } else if (target.id === "coffee-machine") {
        if (playerRigRef.current) {
          playerRigRef.current.coffeeMugGroup.visible = true;
        }
        onPropInteractRef.current?.(
          target.id,
          "☕ CEO Obim mengambil secangkir Kopi Susu Gula Aren hangat dari Warkop Obim!"
        );
      } else if (target.id === "server-rack") {
        onPropInteractRef.current?.(
          target.id,
          "🖥️ Server Render Farm: 11 Node Playwright & Bot Telegram tersinkronisasi penuh (41°C)."
        );
      } else if (target.id === "lounge-tv") {
        onPropInteractRef.current?.(
          target.id,
          "📺 Smart TV Monitoring: Menampilkan analitik live TikTok, Shorts & Reels."
        );
      } else if (target.id === "exit-door") {
        onPropInteractRef.current?.(
          target.id,
          "🚪 Membuka Pintu Keluar... Kembali ke Website Studio!"
        );
      }
    }
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // 1. SCENE
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xdfd9ce);
    sceneRef.current = scene;

    // 2. CAMERA
    const aspect = container.clientWidth / (container.clientHeight || 1);
    const camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 220);
    camera.position.set(0, 3.2, -3.5);
    camera.lookAt(0, 1.3, 2.0);

    // 3. RENDERER
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.06;

    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    // 4. ORBIT CONTROLS (Used when in Top-Down / Free Camera Mode)
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.maxPolarAngle = Math.PI / 2.05;
    controls.minDistance = 2.2;
    controls.maxDistance = 80;
    controls.target.set(0, 1.2, 0.8);

    // 5. LIGHTING
    const ambientLight = new THREE.AmbientLight(0xfff7ed, 1.25);
    scene.add(ambientLight);
    ambientLightRef.current = ambientLight;

    const sunLight = new THREE.DirectionalLight(0xffedd5, 1.85);
    sunLight.position.set(-14, 34, -24);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 5;
    sunLight.shadow.camera.far = 95;
    sunLight.shadow.camera.left = -35;
    sunLight.shadow.camera.right = 35;
    sunLight.shadow.camera.top = 26;
    sunLight.shadow.camera.bottom = -26;
    sunLight.shadow.bias = -0.0005;
    scene.add(sunLight);
    sunLightRef.current = sunLight;

    const loungeWarmLight = new THREE.PointLight(0xfbbf24, 1.4, 24);
    loungeWarmLight.position.set(21.5, 5.5, -2.0);
    scene.add(loungeWarmLight);

    const scriptRoomLight = new THREE.PointLight(0xe0f2fe, 1.1, 22);
    scriptRoomLight.position.set(-21.5, 5.5, -2.0);
    scene.add(scriptRoomLight);

    // Buffer Cinema Corridor Neon Ambient Lighting
    const bufferCinemaLight = new THREE.PointLight(0x38bdf8, 1.6, 22);
    bufferCinemaLight.position.set(0, 4.2, 14.2);
    scene.add(bufferCinemaLight);

    // 6. BUILD SPACIOUS 62x36 OFFICE ENVIRONMENT + BUFFER CINEMA CORRIDOR
    const {
      cityBackdropMesh,
      billiardBalls,
      serverLeds,
      bufferPosterMeshes,
    } = buildOfficeScene(scene);
    cityBackdropRef.current = cityBackdropMesh;
    billiardBallsRef.current = billiardBalls.map((mesh) => ({ mesh, vx: 0, vz: 0 }));
    posterMeshesRef.current = bufferPosterMeshes;

    // 7. BUILD NPC CHARACTER RIGS
    const rigMap = new Map<string, AvatarRig>();
    membersRef.current.forEach((m) => {
      const { group, rig } = createAvatarMesh(m);
      scene.add(group);
      rigMap.set(m.id, rig);
    });
    rigsRef.current = rigMap;

    // 8. BUILD PLAYABLE CEO CHARACTER ("CEO Obim")
    const playerProfile: OfficeMember = {
      id: "player-ceo",
      name: "CEO Obim (YOU)",
      role: "Owner & Studio Director",
      teamId: "executive",
      teamName: "Executive",
      isLead: true,
      gender: "male",
      credits: 999,
      maxCredits: 999,
      status: "standby",
      avatarStyle: "director",
      color: "#991b1b",
      innerShirtColor: "#ffffff",
      hairColor: "#09090b",
      deskPosition: [0, 0, 5.8],
      loungePosition: [0, 0, 5.8],
      currentPosition: [0, 0, 5.8],
      facingAngle: 0,
      loungeFacingAngle: 0,
    };
    const { group: playerGroup, rig: playerRig } = createAvatarMesh(playerProfile);
    playerGroup.position.set(0, 0, 5.8);
    playerRig.bodyPivot.position.y = 0.25;
    const playerRingMat = playerRig.haloRing.material as THREE.MeshBasicMaterial;
    playerRingMat.color.setHex(0x10b981);
    playerRingMat.opacity = 0.85;
    scene.add(playerGroup);
    playerRigRef.current = playerRig;

    // Floor Click-to-Move Destination Marker Ring
    const destMarkerGeo = new THREE.RingGeometry(0.32, 0.46, 24);
    const destMarkerMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0,
    });
    const destMarkerMesh = new THREE.Mesh(destMarkerGeo, destMarkerMat);
    destMarkerMesh.rotation.x = -Math.PI / 2;
    destMarkerMesh.position.y = 0.03;
    scene.add(destMarkerMesh);

    // 9. KEYBOARD CONTROLS & THIRD-PERSON MOUSE LOOK
    const keysPressed = new Set<string>();

    const isInputFocused = () => {
      const el = document.activeElement;
      if (!el) return false;
      const tag = el.tagName.toLowerCase();
      return tag === "input" || tag === "textarea" || tag === "select";
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isInputFocused()) return;

      if (
        [
          "KeyW",
          "KeyA",
          "KeyS",
          "KeyD",
          "KeyQ",
          "KeyE",
          "ArrowUp",
          "ArrowDown",
          "ArrowLeft",
          "ArrowRight",
          "ShiftLeft",
          "ShiftRight",
        ].includes(e.code)
      ) {
        if (e.code !== "KeyE") {
          keysPressed.add(e.code);
          playerTargetDestRef.current = null;
          isTransitioningCamera.current = false;
        }
      }

      // Press [E] or [Space] to interact with nearby NPC, Buffer Poster, or Prop!
      if ((e.code === "KeyE" || e.code === "Space") && nearbyTargetRef.current) {
        e.preventDefault();
        triggerInteractWithTarget(nearbyTargetRef.current);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.delete(e.code);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    // Mouse Drag in Third-Person Mode rotates camera yaw around player
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let pointerDownPos = { x: 0, y: 0 };
    let isDraggingThirdPerson = false;
    let lastMouseX = 0;

    const handleMouseDown = (e: MouseEvent) => {
      pointerDownPos = { x: e.clientX, y: e.clientY };
      lastMouseX = e.clientX;
      if (followPlayerRef.current) {
        isDraggingThirdPerson = true;
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingThirdPerson && followPlayerRef.current) {
        const dx = e.clientX - lastMouseX;
        lastMouseX = e.clientX;
        thirdPersonYawRef.current -= dx * 0.0065;
      }
    };

    const handleMouseUp = () => {
      isDraggingThirdPerson = false;
    };

    const handleClick = (event: MouseEvent) => {
      const dragDist = Math.hypot(
        event.clientX - pointerDownPos.x,
        event.clientY - pointerDownPos.y
      );
      if (dragDist > 6) return;

      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);

      const intersects = raycaster.intersectObjects(scene.children, true);
      for (const hit of intersects) {
        let obj: THREE.Object3D | null = hit.object;
        while (obj) {
          if (obj.userData?.memberId && obj.userData.memberId !== "player-ceo") {
            const found = membersRef.current.find(
              (m) => m.id === obj!.userData.memberId
            );
            if (found) {
              triggerInteractWithTarget({
                type: "member",
                id: found.id,
                label: found.name,
                sublabel: found.role,
                member: found,
              });
              return;
            }
          }
          if (obj.userData?.interactiveProp === "buffer-poster") {
            const slotIdx = Number(obj.userData.bufferPosterSlot ?? 0);
            const poster = bufferPostersRef.current[slotIdx];
            if (poster) {
              triggerInteractWithTarget({
                type: "buffer-poster",
                id: `buffer-poster-${poster.slotIndex}`,
                label: `Poster Buffer #${poster.slotIndex}: ${poster.code}`,
                sublabel: poster.scheduleLabel,
                poster,
              });
              return;
            }
          }
          if (obj.userData?.interactiveProp) {
            const propType = obj.userData.interactiveProp as string;
            triggerInteractWithTarget({
              type: "prop",
              id: propType,
              label: obj.userData.label || propType,
              sublabel: "Properti Interaktif",
            });
            return;
          }
          obj = obj.parent;
        }
      }

      // If user clicked the floor, set Click-to-Move target for Playable CEO!
      const floorHit = intersects.find(
        (h) =>
          h.object instanceof THREE.Mesh &&
          h.point.y < 0.15 &&
          Math.abs(h.point.x) < 29.2 &&
          h.point.z > -16.2 &&
          h.point.z < 24.2
      );
      if (floorHit) {
        playerTargetDestRef.current = new THREE.Vector3(
          floorHit.point.x,
          0,
          floorHit.point.z
        );
        destMarkerMesh.position.set(floorHit.point.x, 0.03, floorHit.point.z);
        destMarkerMat.opacity = 0.85;
      }
    };

    renderer.domElement.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    renderer.domElement.addEventListener("click", handleClick);

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight || 1;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", handleResize);

    // 10. 60 FPS GAME LOOP
    let animId: number;
    const clock = new THREE.Clock();
    let lastBlockToastTime = 0;

    const INTERACTIVE_PROPS_COORDS: Array<{
      id: string;
      label: string;
      sublabel: string;
      pos: [number, number];
    }> = [
      {
        id: "coffee-machine",
        label: "Mesin Espresso Warkop Obim",
        sublabel: "Seduh Kopi Hangat",
        pos: [21.0, -13.0],
      },
      {
        id: "billiard-table",
        label: "Meja Biliar Lounge",
        sublabel: "Main Break Shot Biliar",
        pos: [21.5, 9.8],
      },
      {
        id: "server-rack",
        label: "Server Render Farm Obim",
        sublabel: "Cek Node Playwright & FFmpeg",
        pos: [-13.2, 8.2],
      },
      {
        id: "lounge-tv",
        label: "Smart TV Monitoring",
        sublabel: "Cek Performa Views Buffer",
        pos: [29.0, 0],
      },
      {
        id: "exit-door",
        label: "🚪 Pintu Keluar ke Website Studio",
        sublabel: "Kembali ke Halaman Pengaturan / Dashboard Studio",
        pos: [-19.2, 13.5],
      },
    ];

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const delta = Math.min(clock.getDelta(), 0.1);
      const elapsed = clock.getElapsedTime();
      const nowPerf = performance.now();

      // Build dynamic circle colliders from all NPC current positions for Body-Block
      const npcCircles: CircleCollider[] = [];
      rigsRef.current.forEach((npcRig, npcId) => {
        npcCircles.push({
          id: npcId,
          label: `Karakter Tim (${npcId})`,
          x: npcRig.root.position.x,
          z: npcRig.root.position.z,
          radius: 0.48,
        });
      });

      // ======================================================================
      // A. PLAYABLE CEO MOVEMENT + BODY-BLOCK COLLISION + INTERACTION ANIM
      // ======================================================================
      const pRig = playerRigRef.current;
      let playerMoved = false;
      const isSprinting =
        keysPressed.has("ShiftLeft") ||
        keysPressed.has("ShiftRight") ||
        virtualMoveRef.current.sprint;

      if (pRig) {
        let inputForward = 0;
        let inputRight = 0;

        if (keysPressed.has("KeyW") || keysPressed.has("ArrowUp")) inputForward += 1;
        if (keysPressed.has("KeyS") || keysPressed.has("ArrowDown")) inputForward -= 1;
        if (keysPressed.has("KeyD") || keysPressed.has("ArrowRight")) inputRight += 1;
        if (keysPressed.has("KeyA") || keysPressed.has("ArrowLeft")) inputRight -= 1;

        // Combine with virtual D-pad input if used
        if (Math.abs(virtualMoveRef.current.dz) > 0.05) {
          // Virtual D-pad up sends dz = -1, down sends dz = +1
          inputForward += -virtualMoveRef.current.dz;
        }
        if (Math.abs(virtualMoveRef.current.dx) > 0.05) {
          inputRight += virtualMoveRef.current.dx;
        }

        let moveVecX = 0;
        let moveVecZ = 0;

        if (Math.abs(inputForward) > 0.01 || Math.abs(inputRight) > 0.01) {
          // In Third-Person Game Mode, A/D also gently steers the camera yaw while moving!
          if (followPlayerRef.current && Math.abs(inputRight) > 0.01) {
            thirdPersonYawRef.current -= inputRight * delta * 1.85;
          }

          const camForward = new THREE.Vector3();
          camera.getWorldDirection(camForward);
          camForward.y = 0;
          camForward.normalize();

          const camRight = new THREE.Vector3(-camForward.z, 0, camForward.x);

          const combined = new THREE.Vector3()
            .addScaledVector(camForward, inputForward)
            .addScaledVector(camRight, inputRight)
            .normalize();

          const speed = (isSprinting ? 10.2 : 6.0) * delta;
          moveVecX = combined.x * speed;
          moveVecZ = combined.z * speed;
          playerMoved = true;
          destMarkerMat.opacity = 0;
          interactionAnimRef.current = null;
        } else if (playerTargetDestRef.current) {
          const dx = playerTargetDestRef.current.x - pRig.root.position.x;
          const dz = playerTargetDestRef.current.z - pRig.root.position.z;
          const dist = Math.hypot(dx, dz);
          if (dist > 0.18) {
            const speed = Math.min(dist, 6.8 * delta);
            moveVecX = (dx / dist) * speed;
            moveVecZ = (dz / dist) * speed;
            playerMoved = true;
            destMarkerMesh.scale.setScalar(1 + Math.sin(elapsed * 8) * 0.15);
          } else {
            playerTargetDestRef.current = null;
            destMarkerMat.opacity = 0;
          }
        }

        if (playerMoved) {
          const oldX = pRig.root.position.x;
          const oldZ = pRig.root.position.z;
          const desiredX = oldX + moveVecX;
          const desiredZ = oldZ + moveVecZ;

          // BODY-BLOCK COLLISION SOLVER (Prevents walking through desks, walls, or NPCs!)
          const resolved = resolveBodyBlockCollision(
            oldX,
            oldZ,
            desiredX,
            desiredZ,
            npcCircles,
            0.44
          );

          pRig.root.position.x = resolved.x;
          pRig.root.position.z = resolved.z;

          if (resolved.blocked && resolved.blockerLabel && nowPerf - lastBlockToastTime > 1200) {
            lastBlockToastTime = nowPerf;
            setCollisionNotice(`🛡️ Body Block: Tertahan oleh ${resolved.blockerLabel}`);
            // If click-to-move hit an obstacle and couldn't advance, cancel click target
            if (
              playerTargetDestRef.current &&
              Math.hypot(resolved.x - oldX, resolved.z - oldZ) < 0.005
            ) {
              playerTargetDestRef.current = null;
              destMarkerMat.opacity = 0;
            }
          }

          // Smoothly rotate player toward movement direction
          const targetAngle = Math.atan2(moveVecX, moveVecZ);
          pRig.root.rotation.y = targetAngle;

          // Animate Player Walk / Sprint Cycle
          const cycleFreq = isSprinting ? 15 : 10.5;
          const walkCycle = elapsed * cycleFreq;
          const swingAmp = isSprinting ? 0.85 : 0.62;

          pRig.bodyPivot.position.y = 0.25 + Math.abs(Math.sin(walkCycle)) * 0.06;
          pRig.torsoGroup.rotation.x = isSprinting ? 0.16 : 0.08;
          pRig.headGroup.rotation.set(0, Math.sin(walkCycle * 0.5) * 0.06, 0);

          pRig.leftLegGroup.rotation.x = Math.sin(walkCycle) * swingAmp;
          pRig.rightLegGroup.rotation.x = -Math.sin(walkCycle) * swingAmp;
          pRig.leftLowerLegGroup.rotation.x = Math.max(0, -Math.cos(walkCycle) * 0.55);
          pRig.rightLowerLegGroup.rotation.x = Math.max(0, Math.cos(walkCycle) * 0.55);

          pRig.leftArmGroup.rotation.set(-Math.sin(walkCycle) * swingAmp * 0.85, 0, 0);
          pRig.rightArmGroup.rotation.set(Math.sin(walkCycle) * swingAmp * 0.85, 0, 0);
          pRig.leftForearmGroup.rotation.x = -0.45;
          pRig.rightForearmGroup.rotation.x = -0.45;
        } else {
          // Check if CEO Obim is currently in an active Interaction / Conversation Animation!
          const activeInteract =
            interactionAnimRef.current && interactionAnimRef.current.expiresAt > nowPerf
              ? interactionAnimRef.current
              : null;

          if (activeInteract) {
            // Turn CEO Obim to face the person/poster they are interacting with
            const [tx, , tz] = activeInteract.targetPos;
            if (tx !== 0 || tz !== 0) {
              pRig.root.rotation.y = Math.atan2(
                tx - pRig.root.position.x,
                tz - pRig.root.position.z
              );
            }

            // Expressive Greeting Wave & Conversation Gesture!
            pRig.bodyPivot.position.y = 0.25 + Math.sin(elapsed * 4) * 0.015;
            pRig.torsoGroup.rotation.x = 0.06 + Math.sin(elapsed * 3.5) * 0.03;
            pRig.headGroup.rotation.x = Math.sin(elapsed * 6) * 0.09; // Nodding
            pRig.headGroup.rotation.y = Math.cos(elapsed * 3) * 0.08;

            // Right arm raised waving / gesturing
            pRig.rightArmGroup.rotation.set(
              -1.25 + Math.sin(elapsed * 7) * 0.22,
              -0.2,
              -0.25 + Math.cos(elapsed * 9) * 0.18
            );
            pRig.rightForearmGroup.rotation.x = -0.85 + Math.sin(elapsed * 9) * 0.25;

            // Left arm conversational gesture
            pRig.leftArmGroup.rotation.set(
              -0.55 + Math.cos(elapsed * 5) * 0.18,
              0.15,
              0.12
            );
            pRig.leftForearmGroup.rotation.x = -0.65;
          } else {
            // Standing Idle Animation
            pRig.bodyPivot.position.y = 0.25 + Math.sin(elapsed * 2.5) * 0.012;
            pRig.torsoGroup.rotation.x = Math.sin(elapsed * 2.0) * 0.015;
            pRig.leftLegGroup.rotation.x = 0;
            pRig.rightLegGroup.rotation.x = 0;
            pRig.leftLowerLegGroup.rotation.x = 0;
            pRig.rightLowerLegGroup.rotation.x = 0;

            pRig.leftArmGroup.rotation.set(0, 0, 0.08);
            pRig.leftForearmGroup.rotation.x = -0.18;

            if (pRig.coffeeMugGroup.visible) {
              const sip = Math.pow(Math.max(0, Math.sin(elapsed * 0.9)), 4);
              pRig.rightArmGroup.rotation.set(-0.4 - sip * 0.5, -sip * 0.2, -0.08);
              pRig.rightForearmGroup.rotation.x = -0.7 - sip * 0.7;
            } else {
              pRig.rightArmGroup.rotation.set(0, 0, -0.08);
              pRig.rightForearmGroup.rotation.x = -0.18;
            }

            pRig.headGroup.rotation.y = Math.sin(elapsed * 1.1) * 0.18;
            pRig.headGroup.rotation.x = Math.cos(elapsed * 1.6) * 0.03;
          }
        }

        // Pulse player emerald aura ring
        const pScale = 1 + Math.sin(elapsed * 5) * 0.1;
        pRig.haloRing.scale.set(pScale, pScale, pScale);
      }

      // ======================================================================
      // B. TRUE THIRD-PERSON GAME CAMERA vs. TOP-DOWN OVERVIEW CAMERA
      // ======================================================================
      if (isTransitioningCamera.current) {
        controls.enabled = true;
        camera.position.lerp(lerpTargetPos.current, delta * 4.5);
        controls.target.lerp(lerpLookAt.current, delta * 4.5);

        if (
          camera.position.distanceTo(lerpTargetPos.current) < 0.16 &&
          controls.target.distanceTo(lerpLookAt.current) < 0.16
        ) {
          isTransitioningCamera.current = false;
          onCameraTransitionDone?.();
        }
        controls.update();
      } else if (followPlayerRef.current && pRig) {
        // TRUE THIRD-PERSON OVER-THE-SHOULDER CAMERA (Like a 3D RPG Game!)
        controls.enabled = false;
        const px = pRig.root.position.x;
        const pz = pRig.root.position.z;
        const yaw = thirdPersonYawRef.current;

        // Camera sits 4.3 units behind the player at eye/shoulder elevation (y = 2.45)
        const camDist = 4.3;
        const camHeight = 2.45;
        const desiredCamPos = new THREE.Vector3(
          px - Math.sin(yaw) * camDist,
          camHeight,
          pz - Math.cos(yaw) * camDist
        );

        // Look ahead of the player at chest/head height (y = 1.42)
        const desiredLookAt = new THREE.Vector3(
          px + Math.sin(yaw) * 3.2,
          1.42,
          pz + Math.cos(yaw) * 3.2
        );

        camera.position.lerp(desiredCamPos, Math.min(1, delta * 9.5));
        controls.target.lerp(desiredLookAt, Math.min(1, delta * 11.0));
        camera.lookAt(controls.target);
      } else {
        controls.enabled = true;
        controls.update();
      }

      // ======================================================================
      // C. BILLIARD BALLS & SERVER LEDS
      // ======================================================================
      billiardBallsRef.current.forEach((b) => {
        if (Math.abs(b.vx) > 0.01 || Math.abs(b.vz) > 0.01) {
          b.mesh.position.x += b.vx * delta;
          b.mesh.position.z += b.vz * delta;
          if (Math.abs(b.mesh.position.x) > 1.95) {
            b.mesh.position.x = Math.sign(b.mesh.position.x) * 1.95;
            b.vx *= -0.75;
          }
          if (Math.abs(b.mesh.position.z) > 0.88) {
            b.mesh.position.z = Math.sign(b.mesh.position.z) * 0.88;
            b.vz *= -0.75;
          }
          b.vx *= 0.96;
          b.vz *= 0.96;
        }
      });

      serverLeds.forEach((led, idx) => {
        const mat = led.material as THREE.MeshBasicMaterial;
        const pulse = Math.sin(elapsed * (5 + idx * 1.7)) > 0;
        mat.color.setHex(pulse ? 0x10b981 : 0x0284c7);
      });

      // ======================================================================
      // D. NPC ANIMATIONS + PROXIMITY DETECTION (NPCs, Buffer Posters, Props)
      // ======================================================================
      const projectedList: ProjectedNametag[] = [];
      const width = container.clientWidth;
      const height = container.clientHeight;
      const nowMs = Date.now();

      let closestTarget: NearbyInteractionTarget | null = null;
      let closestDist = 3.4;

      const playerPos = pRig ? pRig.root.position : new THREE.Vector3(0, 0, 0);

      membersRef.current.forEach((m) => {
        const rig = rigMap.get(m.id);
        if (!rig) return;

        const isResting = m.status === "resting";
        const targetCoord = isResting ? m.loungePosition : m.deskPosition;
        const desiredFacing = isResting ? m.loungeFacingAngle : m.facingAngle;

        const dx = targetCoord[0] - rig.root.position.x;
        const dz = targetCoord[2] - rig.root.position.z;
        const dist = Math.hypot(dx, dz);
        const t = elapsed + rig.phaseOffset;

        const distToPlayer = Math.hypot(
          rig.root.position.x - playerPos.x,
          rig.root.position.z - playerPos.z
        );
        if (distToPlayer < closestDist) {
          closestDist = distToPlayer;
          closestTarget = {
            type: "member",
            id: m.id,
            label: m.name,
            sublabel: m.role,
            member: m,
          };
        }

        let isWalking = false;

        if (dist > 0.1) {
          isWalking = true;
          const walkSpeed = 4.6;
          const step = Math.min(dist, walkSpeed * delta);
          rig.root.position.x += (dx / dist) * step;
          rig.root.position.z += (dz / dist) * step;
          rig.root.rotation.y = Math.atan2(dx, dz);

          const walkCycle = elapsed * 10 + rig.phaseOffset;
          rig.bodyPivot.position.y = 0.25 + Math.abs(Math.sin(walkCycle)) * 0.05;
          rig.torsoGroup.rotation.x = 0.08;
          rig.headGroup.rotation.set(0, Math.sin(walkCycle * 0.5) * 0.08, 0);

          rig.leftLegGroup.rotation.x = Math.sin(walkCycle) * 0.65;
          rig.rightLegGroup.rotation.x = -Math.sin(walkCycle) * 0.65;
          rig.leftLowerLegGroup.rotation.x = Math.max(0, -Math.cos(walkCycle) * 0.5);
          rig.rightLowerLegGroup.rotation.x = Math.max(0, Math.cos(walkCycle) * 0.5);

          rig.leftArmGroup.rotation.set(-Math.sin(walkCycle) * 0.5, 0, 0);
          rig.rightArmGroup.rotation.set(Math.sin(walkCycle) * 0.5, 0, 0);
          rig.leftForearmGroup.rotation.x = -0.35;
          rig.rightForearmGroup.rotation.x = -0.35;
          rig.coffeeMugGroup.visible = false;
        } else {
          rig.root.position.set(targetCoord[0], targetCoord[1], targetCoord[2]);
          rig.root.rotation.y = desiredFacing;

          const isTalkingToPlayer =
            m.id === selectedIdRef.current ||
            (interactionAnimRef.current?.targetId === m.id &&
              interactionAnimRef.current.expiresAt > nowPerf);

          if (isTalkingToPlayer) {
            // NPC Interactive Greeting & Conversation Animation when talking to CEO Obim!
            rig.bodyPivot.position.y = -0.02 + Math.sin(elapsed * 4) * 0.015;
            rig.torsoGroup.rotation.x = 0.04;
            const angleToPlayer =
              Math.atan2(
                playerPos.x - rig.root.position.x,
                playerPos.z - rig.root.position.z
              ) - rig.root.rotation.y;
            rig.headGroup.rotation.y = Math.max(-0.75, Math.min(0.75, angleToPlayer));
            rig.headGroup.rotation.x = Math.sin(elapsed * 6.5) * 0.08;

            // Enthusiastic right hand wave / talking gesture
            rig.rightArmGroup.rotation.set(
              -1.15 + Math.sin(elapsed * 7.5) * 0.25,
              -0.18,
              -0.2 + Math.cos(elapsed * 8.5) * 0.15
            );
            rig.rightForearmGroup.rotation.x = -0.75 + Math.sin(elapsed * 8.5) * 0.2;
          } else if (isResting) {
            rig.bodyPivot.position.y = -0.08;
            rig.torsoGroup.rotation.x = -0.16 + Math.sin(t * 1.5) * 0.02;

            rig.leftLegGroup.rotation.x = -Math.PI / 2.15;
            rig.rightLegGroup.rotation.x = -Math.PI / 2.15;
            rig.leftLowerLegGroup.rotation.x = Math.PI / 2.3;
            rig.rightLowerLegGroup.rotation.x = Math.PI / 2.3;

            rig.leftArmGroup.rotation.set(-0.25, 0, 0.15);
            rig.leftForearmGroup.rotation.x = -0.65;

            rig.coffeeMugGroup.visible = true;
            const sipWave = Math.max(0, Math.sin(t * 0.85));
            const sipLift = Math.pow(sipWave, 4);
            rig.rightArmGroup.rotation.set(
              -0.45 - sipLift * 0.55,
              -sipLift * 0.25,
              -0.1
            );
            rig.rightForearmGroup.rotation.x = -0.85 - sipLift * 0.75;

            rig.headGroup.rotation.y = Math.sin(t * 0.9) * 0.28 * (1 - sipLift);
            rig.headGroup.rotation.x = -sipLift * 0.18 + Math.cos(t * 1.3) * 0.04;
          } else {
            rig.bodyPivot.position.y = -0.02;
            rig.torsoGroup.rotation.x = 0.06 + Math.sin(t * 2.0) * 0.015;

            rig.leftLegGroup.rotation.x = -Math.PI / 2;
            rig.rightLegGroup.rotation.x = -Math.PI / 2;
            rig.leftLowerLegGroup.rotation.x = Math.PI / 2;
            rig.rightLowerLegGroup.rotation.x = Math.PI / 2;

            rig.coffeeMugGroup.visible = false;
            const typeL = Math.sin(elapsed * 13 + rig.phaseOffset) * 0.11;
            const typeR = Math.cos(elapsed * 13 + rig.phaseOffset) * 0.11;

            rig.leftArmGroup.rotation.set(-0.58 + typeL * 0.3, 0.12, 0.05);
            rig.rightArmGroup.rotation.set(-0.58 + typeR * 0.3, -0.12, -0.05);
            rig.leftForearmGroup.rotation.x = -0.82 + typeL;
            rig.rightForearmGroup.rotation.x = -0.82 + typeR;

            rig.headGroup.rotation.y = Math.sin(t * 1.35) * 0.22;
            rig.headGroup.rotation.x = 0.05 + Math.sin(t * 2.7) * 0.045;
          }

          if (distToPlayer < 3.5 && !isTalkingToPlayer) {
            const angleToPlayer =
              Math.atan2(
                playerPos.x - rig.root.position.x,
                playerPos.z - rig.root.position.z
              ) - rig.root.rotation.y;
            const clampedYaw = Math.max(-0.65, Math.min(0.65, angleToPlayer));
            rig.headGroup.rotation.y = clampedYaw;
          }
        }

        // Halo ring highlight
        const ringMat = rig.haloRing.material as THREE.MeshBasicMaterial;
        const isClosest = closestTarget?.id === m.id;
        if (m.id === selectedIdRef.current || isClosest) {
          const pulse = 1 + Math.sin(elapsed * 6) * 0.15;
          rig.haloRing.scale.set(pulse, pulse, pulse);
          ringMat.color.setHex(0xfbbf24);
          ringMat.opacity = 0.95;
        } else {
          rig.haloRing.scale.set(1, 1, 1);
          ringMat.color.setHex(
            isResting ? 0xf43f5e : m.isLead ? 0xf59e0b : 0x38bdf8
          );
          ringMat.opacity = 0.3;
        }

        const bubbleEntry = bubblesRef.current[m.id];
        const activeBubbleText =
          bubbleEntry && bubbleEntry.expiresAt > nowMs
            ? bubbleEntry.text
            : undefined;

        // Only project 2D screen coordinates when an NPC has an active speech bubble!
        // Permanent NPC identification is placed on physical 3D Desk Nameplates & proximity bar.
        if (activeBubbleText) {
          const headWorldPos = new THREE.Vector3();
          rig.headGroup.getWorldPosition(headWorldPos);
          headWorldPos.y += 0.52;
          headWorldPos.project(camera);

          if (headWorldPos.z < 1) {
            const sx = (headWorldPos.x * 0.5 + 0.5) * width;
            const sy = (-(headWorldPos.y * 0.5) + 0.5) * height;

            if (sx >= -60 && sx <= width + 60 && sy >= -60 && sy <= height + 60) {
              projectedList.push({
                id: m.id,
                name: m.name,
                role: m.role,
                status: m.status,
                credits: m.credits,
                isLead: m.isLead,
                isWalking,
                speechBubble: activeBubbleText,
                x: sx,
                y: sy,
                member: m,
              });
            }
          }
        }
      });

      // Check proximity to the 8 Buffer Gallery Schedule Posters!
      bufferPostersRef.current.forEach((poster, idx) => {
        const coords = BUFFER_POSTER_WORLD_COORDS[idx] ?? poster.worldPosition;
        const dPoster = Math.hypot(
          coords[0] - playerPos.x,
          coords[2] - 1.2 - playerPos.z
        );
        if (dPoster < closestDist) {
          closestDist = dPoster;
          closestTarget = {
            type: "buffer-poster",
            id: `buffer-poster-${poster.slotIndex}`,
            label: `Poster Buffer #${poster.slotIndex} (${poster.code})`,
            sublabel: `${poster.scheduleLabel} — ${poster.title.slice(0, 32)}...`,
            poster,
          };
        }
      });

      // Check proximity to interactive office props
      INTERACTIVE_PROPS_COORDS.forEach((prop) => {
        const dProp = Math.hypot(
          prop.pos[0] - playerPos.x,
          prop.pos[1] - playerPos.z
        );
        if (dProp < closestDist) {
          closestDist = dProp;
          closestTarget = {
            type: "prop",
            id: prop.id,
            label: prop.label,
            sublabel: prop.sublabel,
          };
        }
      });

      const finalClosest = closestTarget as NearbyInteractionTarget | null;
      if (nearbyTargetRef.current?.id !== finalClosest?.id) {
        nearbyTargetRef.current = finalClosest;
        setNearbyTarget(finalClosest);
      }

      setNametags((prev) =>
        prev.length === 0 && projectedList.length === 0 ? prev : projectedList
      );
      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      renderer.domElement.removeEventListener("mousedown", handleMouseDown);
      renderer.domElement.removeEventListener("click", handleClick);
      renderer.dispose();
      if (container) container.innerHTML = "";
    };
  }, [onCameraTransitionDone]);

  // Clear collision notice after 1.8s
  useEffect(() => {
    if (!collisionNotice) return;
    const t = setTimeout(() => setCollisionNotice(null), 1800);
    return () => clearTimeout(t);
  }, [collisionNotice]);

  return (
    <div className="relative w-full h-full overflow-hidden select-none">
      {/* 3D WebGL Viewport */}
      <div
        ref={containerRef}
        className="w-full h-full cursor-grab active:cursor-grabbing"
      />

      {/* TRANSIENT LIVE TELEGRAM SPEECH BUBBLES ONLY (No Permanent Floating Nametags) */}
      {nametags.length > 0 && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {nametags.map((tag) => (
            <div
              key={tag.id}
              style={{
                transform: `translate(-50%, -100%) translate(${tag.x}px, ${tag.y}px)`,
              }}
              onClick={(e) => {
                e.stopPropagation();
                if (tag.member) onSelectMember(tag.member);
              }}
              className="absolute pointer-events-auto cursor-pointer flex flex-col items-center text-center z-30"
            >
              {tag.speechBubble && (
                <div className="mb-1 px-3 py-1.5 rounded-xl bg-white/95 text-slate-900 text-[11px] font-semibold shadow-md border border-slate-200 max-w-[220px]">
                  <span className="block text-[9px] font-extrabold text-amber-700 uppercase tracking-wider mb-0.5">
                    {tag.name}
                  </span>
                  {tag.speechBubble}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* BODY-BLOCK COLLISION FEEDBACK PILL */}
      {collisionNotice && (
        <div className="fixed top-28 left-1/2 -translate-x-1/2 z-40 pointer-events-none px-3.5 py-1 rounded-full bg-rose-950/90 border border-rose-500/50 text-rose-200 text-[11px] font-bold shadow-lg">
          {collisionNotice}
        </div>
      )}

      {/* PROXIMITY INTERACTION PROMPT BAR (Bottom-Center, Game RPG Style) */}
      {nearbyTarget && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 pointer-events-auto">
          <button
            onClick={() => triggerInteractWithTarget(nearbyTarget)}
            className="flex items-center gap-3 px-5 py-2.5 rounded-2xl bg-slate-950/90 hover:bg-slate-900 backdrop-blur-md border-2 border-amber-400/80 shadow-[0_0_25px_rgba(251,191,36,0.35)] text-left transition transform hover:scale-105 active:scale-95 cursor-pointer"
          >
            <span className="flex items-center justify-center w-8 h-8 rounded-xl bg-amber-400 text-slate-950 font-black text-sm shadow">
              E
            </span>
            <div>
              <p className="text-xs font-extrabold text-white">
                {nearbyTarget.type === "member"
                  ? `Ajak Bicara ${nearbyTarget.label}`
                  : nearbyTarget.type === "buffer-poster"
                  ? `🎞️ Lihat Jadwal Buffer: ${nearbyTarget.label}`
                  : `Gunakan ${nearbyTarget.label}`}
              </p>
              <p className="text-[10px] text-amber-300 font-semibold">
                {nearbyTarget.sublabel} • Tekan [E] atau Klik di sini
              </p>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}
