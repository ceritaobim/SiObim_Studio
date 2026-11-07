import { WORKSTATION_DESK_CENTERS } from "./constants";

export interface AABBCollider {
  id: string;
  label: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface CircleCollider {
  id: string;
  label: string;
  x: number;
  z: number;
  radius: number;
}

// World outer room boundaries (expanded Southward to Z = +23.8 for the spacious Buffer Gallery Wing!)
export const WORLD_BOUNDS = {
  minX: -29.2,
  maxX: 29.2,
  minZ: -16.0,
  maxZ: 23.8,
};

// Build static AABB colliders for all desks, walls, partitions, and furniture
export const STATIC_AABB_COLLIDERS: AABBCollider[] = [
  // 1. All 14 Workstation Desks (each desk is ~2.2 wide x 1.05 deep)
  ...WORKSTATION_DESK_CENTERS.map((d) => ({
    id: `desk-${d.id}`,
    label: `Meja ${d.personName}`,
    minX: d.deskPos[0] - 1.15,
    maxX: d.deskPos[0] + 1.15,
    minZ: d.deskPos[2] - 0.58,
    maxZ: d.deskPos[2] + 0.58,
  })),

  // 2. Conference Table in Studio Naskah (Left Glass Room)
  {
    id: "conf-table",
    label: "Meja Rapat Studio Naskah",
    minX: -22.85,
    maxX: -20.15,
    minZ: -5.95,
    maxZ: 1.95,
  },

  // 3. Glass Room Partition Wall (East side at X = -15.0, with open doorway Z: -3.5 to +1.8)
  {
    id: "glass-wall-north",
    label: "Dinding Kaca Studio Naskah",
    minX: -15.3,
    maxX: -14.7,
    minZ: -17.5,
    maxZ: -3.5,
  },
  {
    id: "glass-wall-south",
    label: "Dinding Kaca Studio Naskah",
    minX: -15.3,
    maxX: -14.7,
    minZ: 1.8,
    maxZ: 8.5,
  },

  // 4. Lounge Wooden Slat Partition (X = 14.5, with open doorway Z: -4.2 to +3.2)
  {
    id: "slat-wall-north",
    label: "Partisi Kayu Warkop Obim",
    minX: 14.2,
    maxX: 14.8,
    minZ: -16.5,
    maxZ: -4.2,
  },
  {
    id: "slat-wall-south",
    label: "Partisi Kayu Warkop Obim",
    minX: 14.2,
    maxX: 14.8,
    minZ: 3.2,
    maxZ: 8.8,
  },

  // 5. Warkop Obim Espresso Bar Counter
  {
    id: "coffee-bar",
    label: "Meja Bar Warkop Obim",
    minX: 18.0,
    maxX: 26.0,
    minZ: -14.0,
    maxZ: -12.1,
  },

  // 6. Grand Lounge Sofa & Coffee Table
  {
    id: "lounge-sofa",
    label: "Sofa Istirahat Lounge",
    minX: 17.3,
    maxX: 25.7,
    minZ: -1.95,
    maxZ: -0.45,
  },
  {
    id: "lounge-coffee-table",
    label: "Meja Kopi Lounge",
    minX: 19.3,
    maxX: 23.7,
    minZ: 0.55,
    maxZ: 2.0,
  },

  // 7. Billiard Table
  {
    id: "billiard-table",
    label: "Meja Biliar Rekreasional",
    minX: 19.1,
    maxX: 23.9,
    minZ: 8.4,
    maxZ: 11.2,
  },

  // 8. Spacious Buffer Wing Side Columns (leaving a massive 20-unit wide open entrance at X: -10 to +10!)
  {
    id: "buffer-pillar-left",
    label: "Pilar Arsitektur Ruang Buffer",
    minX: -22.5,
    maxX: -19.5,
    minZ: 10.5,
    maxZ: 11.3,
  },
  {
    id: "buffer-pillar-right",
    label: "Pilar Arsitektur Ruang Buffer",
    minX: 19.5,
    maxX: 22.5,
    minZ: 10.5,
    maxZ: 11.3,
  },
];

export const STATIC_CIRCLE_COLLIDERS: CircleCollider[] = [
  {
    id: "central-zen-tree",
    label: "Pohon Origami Tengah Kantor",
    x: 0,
    z: -4.5,
    radius: 2.25,
  },
];

/**
 * Checks whether a circular body at (x, z) with given radius intersects any static or dynamic collider.
 */
export function checkBodyCollision(
  x: number,
  z: number,
  playerRadius = 0.44,
  dynamicCircles: CircleCollider[] = []
): { collided: boolean; blockerLabel?: string } {
  // 1. Check outer room walls
  if (
    x - playerRadius < WORLD_BOUNDS.minX ||
    x + playerRadius > WORLD_BOUNDS.maxX ||
    z - playerRadius < WORLD_BOUNDS.minZ ||
    z + playerRadius > WORLD_BOUNDS.maxZ
  ) {
    return { collided: true, blockerLabel: "Dinding Luar Kantor" };
  }

  // 2. Check static AABB colliders (circle-to-AABB intersection)
  for (const box of STATIC_AABB_COLLIDERS) {
    const closestX = Math.max(box.minX, Math.min(x, box.maxX));
    const closestZ = Math.max(box.minZ, Math.min(z, box.maxZ));
    const dx = x - closestX;
    const dz = z - closestZ;
    if (dx * dx + dz * dz < playerRadius * playerRadius) {
      return { collided: true, blockerLabel: box.label };
    }
  }

  // 3. Check static circular colliders
  for (const c of STATIC_CIRCLE_COLLIDERS) {
    const dist = Math.hypot(x - c.x, z - c.z);
    if (dist < playerRadius + c.radius) {
      return { collided: true, blockerLabel: c.label };
    }
  }

  // 4. Check dynamic circular colliders (NPC bodies)
  for (const npc of dynamicCircles) {
    const dist = Math.hypot(x - npc.x, z - npc.z);
    if (dist < playerRadius + npc.radius) {
      return { collided: true, blockerLabel: npc.label };
    }
  }

  return { collided: false };
}

/**
 * Resolves movement from (oldX, oldZ) to (desiredX, desiredZ) with smooth wall/desk sliding.
 * Guarantees the character never clips through desks, walls, or NPCs.
 */
export function resolveBodyBlockCollision(
  oldX: number,
  oldZ: number,
  desiredX: number,
  desiredZ: number,
  dynamicCircles: CircleCollider[] = [],
  playerRadius = 0.44
): {
  x: number;
  z: number;
  blocked: boolean;
  blockerLabel?: string;
} {
  // Fast path: full move is clear
  const fullCheck = checkBodyCollision(desiredX, desiredZ, playerRadius, dynamicCircles);
  if (!fullCheck.collided) {
    return { x: desiredX, z: desiredZ, blocked: false };
  }

  // Try sliding along X axis only
  let finalX = oldX;
  let finalZ = oldZ;
  const xOnlyCheck = checkBodyCollision(desiredX, oldZ, playerRadius, dynamicCircles);
  if (!xOnlyCheck.collided) {
    finalX = desiredX;
  }

  // Try sliding along Z axis only
  const zOnlyCheck = checkBodyCollision(finalX, desiredZ, playerRadius, dynamicCircles);
  if (!zOnlyCheck.collided) {
    finalZ = desiredZ;
  }

  return {
    x: finalX,
    z: finalZ,
    blocked: true,
    blockerLabel: fullCheck.blockerLabel,
  };
}
