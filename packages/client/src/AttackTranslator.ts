/**
 * Attack Translation Table
 * Converts banked cargo into hazards
 */
import { OrbType } from './Orb.js';
import { Hazard, Asteroid, SeekerDrone, Mine, Nuke, SpeedBoostZone } from './Hazard.js';
import { Ship } from './Ship.js';
import { Vec2, WORLD_WIDTH, WORLD_HEIGHT } from '@wormhole/shared';

// Attack tier definitions
export enum AttackTier {
  TIER_1 = 1,
  TIER_1_5 = 1.5,
  TIER_2 = 2,
  TIER_3 = 3,
  TIER_4 = 4, // NUKE
}

// Attack result from banking
export interface AttackResult {
  hazards: Hazard[];
  boostZones: SpeedBoostZone[];
  tier: AttackTier;
  description: string;
}

/**
 * Analyze cargo and determine what attack to spawn
 */
export function translateCargoToAttack(cargo: OrbType[], ship: Ship, wormholePosition: Vec2): AttackResult {
  const hazards: Hazard[] = [];
  const boostZones: SpeedBoostZone[] = [];

  // Count orbs by type
  const counts: Record<OrbType, number> = {
    [OrbType.RED]: 0,
    [OrbType.BLUE]: 0,
    [OrbType.GREEN]: 0,
    [OrbType.GOLD]: 0,
  };

  for (const orb of cargo) {
    counts[orb]++;
  }

  // Check for NUKE (8 GOLD)
  if (counts[OrbType.GOLD] >= 8) {
    return {
      hazards: [spawnNuke(wormholePosition)],
      boostZones: [],
      tier: AttackTier.TIER_4,
      description: 'NUKE DETONATED!',
    };
  }

  // Check for 4x same color (Mega versions - Tier 3)
  for (const type of [OrbType.RED, OrbType.BLUE, OrbType.GREEN]) {
    if (counts[type] >= 4) {
      return spawnMegaAttack(type, ship, wormholePosition);
    }
  }

  // Check for Chaos Storm (1R + 1B + 1G) - Tier 2
  if (counts[OrbType.RED] >= 1 && counts[OrbType.BLUE] >= 1 && counts[OrbType.GREEN] >= 1) {
    return spawnChaosStorm(ship, wormholePosition);
  }

  // Check for 3x same color (Tier 2)
  for (const type of [OrbType.RED, OrbType.BLUE, OrbType.GREEN]) {
    if (counts[type] >= 3) {
      return spawnTier2Attack(type, ship, wormholePosition);
    }
  }

  // Check for 2x same color (Enhanced Tier 1.5)
  for (const type of [OrbType.RED, OrbType.BLUE, OrbType.GREEN]) {
    if (counts[type] >= 2) {
      return spawnEnhancedAttack(type, ship, wormholePosition);
    }
  }

  // Single orb attacks (Tier 1)
  // Process in priority order: RED, BLUE, GREEN
  if (counts[OrbType.RED] >= 1) {
    return spawnTier1Attack(OrbType.RED, ship, wormholePosition);
  }
  if (counts[OrbType.BLUE] >= 1) {
    return spawnTier1Attack(OrbType.BLUE, ship, wormholePosition);
  }
  if (counts[OrbType.GREEN] >= 1) {
    return spawnTier1Attack(OrbType.GREEN, ship, wormholePosition);
  }

  // Fallback (shouldn't happen)
  return {
    hazards: [],
    boostZones: [],
    tier: AttackTier.TIER_1,
    description: 'Nothing happened...',
  };
}

/**
 * Spawn Tier 1 attack (single orb)
 */
function spawnTier1Attack(type: OrbType, ship: Ship, wormholePosition: Vec2): AttackResult {
  const hazards: Hazard[] = [];
  const boostZones: SpeedBoostZone[] = [];
  let description = '';

  switch (type) {
    case OrbType.RED:
      // 3 Asteroids
      for (let i = 0; i < 3; i++) {
        hazards.push(spawnAsteroid(wormholePosition, false));
      }
      description = '3 Asteroids spawned!';
      break;

    case OrbType.BLUE:
      // 1 Seeker Drone
      hazards.push(spawnSeeker(ship, wormholePosition));
      description = 'Seeker Drone launched!';
      break;

    case OrbType.GREEN:
      // Speed Boost Zone
      boostZones.push(new SpeedBoostZone(wormholePosition, false));
      description = 'Speed Boost Zone created!';
      break;

    default:
      break;
  }

  return {
    hazards,
    boostZones,
    tier: AttackTier.TIER_1,
    description,
  };
}

/**
 * Spawn Enhanced attack (2x same color - Tier 1.5)
 */
function spawnEnhancedAttack(type: OrbType, ship: Ship, wormholePosition: Vec2): AttackResult {
  const hazards: Hazard[] = [];
  const boostZones: SpeedBoostZone[] = [];
  let description = '';

  switch (type) {
    case OrbType.RED:
      // 5 Asteroids (2 large, 3 small)
      for (let i = 0; i < 3; i++) {
        hazards.push(spawnAsteroid(wormholePosition, false));
      }
      for (let i = 0; i < 2; i++) {
        hazards.push(spawnAsteroid(wormholePosition, true));
      }
      description = 'Enhanced Asteroid Swarm!';
      break;

    case OrbType.BLUE:
      // 2 Seeker Drones
      for (let i = 0; i < 2; i++) {
        hazards.push(spawnSeeker(ship, wormholePosition));
      }
      description = 'Twin Seekers launched!';
      break;

    case OrbType.GREEN:
      // Enhanced Speed Boost
      boostZones.push(new SpeedBoostZone(wormholePosition, true));
      description = 'Enhanced Speed Zone!';
      break;

    default:
      break;
  }

  return {
    hazards,
    boostZones,
    tier: AttackTier.TIER_1_5,
    description,
  };
}

/**
 * Spawn Tier 2 attack (3x same color)
 */
function spawnTier2Attack(type: OrbType, ship: Ship, wormholePosition: Vec2): AttackResult {
  const hazards: Hazard[] = [];
  const boostZones: SpeedBoostZone[] = [];
  let description = '';

  switch (type) {
    case OrbType.RED:
      // Asteroid Wall (8 asteroids in a line)
      hazards.push(...spawnAsteroidWall(wormholePosition));
      description = 'ASTEROID WALL!';
      break;

    case OrbType.BLUE:
      // 3 Seeker Drones
      for (let i = 0; i < 3; i++) {
        hazards.push(spawnSeeker(ship, wormholePosition));
      }
      description = 'Seeker Swarm!';
      break;

    case OrbType.GREEN:
      // Mine Field (8 mines)
      for (let i = 0; i < 8; i++) {
        hazards.push(spawnMine(wormholePosition));
      }
      description = 'MINE FIELD deployed!';
      break;

    default:
      break;
  }

  return {
    hazards,
    boostZones,
    tier: AttackTier.TIER_2,
    description,
  };
}

/**
 * Spawn Chaos Storm (1R + 1B + 1G)
 */
function spawnChaosStorm(ship: Ship, wormholePosition: Vec2): AttackResult {
  const hazards: Hazard[] = [];

  // Mixed hazards: 2 asteroids + 1 seeker + 2 mines
  hazards.push(spawnAsteroid(wormholePosition, false));
  hazards.push(spawnAsteroid(wormholePosition, true));
  hazards.push(spawnSeeker(ship, wormholePosition));
  hazards.push(spawnMine(wormholePosition));
  hazards.push(spawnMine(wormholePosition));

  return {
    hazards,
    boostZones: [],
    tier: AttackTier.TIER_2,
    description: 'CHAOS STORM!',
  };
}

/**
 * Spawn Mega attack (4x same color - Tier 3)
 */
function spawnMegaAttack(type: OrbType, ship: Ship, wormholePosition: Vec2): AttackResult {
  const hazards: Hazard[] = [];
  const boostZones: SpeedBoostZone[] = [];
  let description = '';

  switch (type) {
    case OrbType.RED:
      // Mega Asteroid Barrage (12 asteroids, 4 large)
      for (let i = 0; i < 8; i++) {
        hazards.push(spawnAsteroid(wormholePosition, false));
      }
      for (let i = 0; i < 4; i++) {
        hazards.push(spawnAsteroid(wormholePosition, true));
      }
      description = 'MEGA ASTEROID BARRAGE!';
      break;

    case OrbType.BLUE:
      // Mega Seeker Swarm (5 seekers)
      for (let i = 0; i < 5; i++) {
        hazards.push(spawnSeeker(ship, wormholePosition));
      }
      description = 'MEGA SEEKER SWARM!';
      break;

    case OrbType.GREEN:
      // Mega Mine Field + Speed Boost
      for (let i = 0; i < 12; i++) {
        hazards.push(spawnMine(wormholePosition));
      }
      boostZones.push(new SpeedBoostZone(wormholePosition, true));
      description = 'MEGA DEFENSE GRID!';
      break;

    default:
      break;
  }

  return {
    hazards,
    boostZones,
    tier: AttackTier.TIER_3,
    description,
  };
}

// === Spawning Helpers ===

function spawnAsteroid(wormholePosition: Vec2, isLarge: boolean): Asteroid {
  const spawnPos = getRandomEdgePosition(wormholePosition, 200);
  const angle = Math.random() * Math.PI * 2;
  const speed = 1 + Math.random() * 2;
  const velocity = Vec2.fromAngle(angle).mul(speed);
  return new Asteroid(spawnPos, velocity, isLarge);
}

function spawnAsteroidWall(wormholePosition: Vec2): Asteroid[] {
  const asteroids: Asteroid[] = [];
  const spawnEdge = Math.floor(Math.random() * 4); // 0=top, 1=right, 2=bottom, 3=left
  const count = 8;

  let startX = 0, startY = 0;
  let velocity: Vec2;

  switch (spawnEdge) {
    case 0: // Top
      startX = WORLD_WIDTH / 2 - 200;
      startY = 50;
      velocity = new Vec2(0, 2 + Math.random());
      break;
    case 1: // Right
      startX = WORLD_WIDTH - 50;
      startY = WORLD_HEIGHT / 2 - 200;
      velocity = new Vec2(-(2 + Math.random()), 0);
      break;
    case 2: // Bottom
      startX = WORLD_WIDTH / 2 - 200;
      startY = WORLD_HEIGHT - 50;
      velocity = new Vec2(0, -(2 + Math.random()));
      break;
    case 3: // Left
      startX = 50;
      startY = WORLD_HEIGHT / 2 - 200;
      velocity = new Vec2(2 + Math.random(), 0);
      break;
  }

  const spacing = spawnEdge % 2 === 0 ? 60 : 60; // Horizontal or vertical spacing

  for (let i = 0; i < count; i++) {
    const x = spawnEdge % 2 === 0 ? startX + i * spacing : startX;
    const y = spawnEdge % 2 === 1 ? startY + i * spacing : startY;
    asteroids.push(new Asteroid(new Vec2(x, y), velocity.clone(), i % 3 === 0));
  }

  return asteroids;
}

function spawnSeeker(ship: Ship, wormholePosition: Vec2): SeekerDrone {
  const spawnPos = getRandomPosition(wormholePosition, 150);
  const seeker = new SeekerDrone(spawnPos);
  seeker.setTarget(ship);
  return seeker;
}

function spawnMine(wormholePosition: Vec2): Mine {
  const spawnPos = getRandomPosition(wormholePosition, 250);
  return new Mine(spawnPos);
}

function spawnNuke(wormholePosition: Vec2): Nuke {
  return new Nuke(wormholePosition);
}

function getRandomEdgePosition(center: Vec2, minDistance: number): Vec2 {
  const edge = Math.floor(Math.random() * 4);
  let x = 0, y = 0;

  switch (edge) {
    case 0: // Top
      x = Math.random() * WORLD_WIDTH;
      y = 30;
      break;
    case 1: // Right
      x = WORLD_WIDTH - 30;
      y = Math.random() * WORLD_HEIGHT;
      break;
    case 2: // Bottom
      x = Math.random() * WORLD_WIDTH;
      y = WORLD_HEIGHT - 30;
      break;
    case 3: // Left
      x = 30;
      y = Math.random() * WORLD_HEIGHT;
      break;
  }

  return new Vec2(x, y);
}

function getRandomPosition(center: Vec2, minDistance: number): Vec2 {
  const angle = Math.random() * Math.PI * 2;
  const distance = minDistance + Math.random() * 200;
  return new Vec2(
    center.x + Math.cos(angle) * distance,
    center.y + Math.sin(angle) * distance
  );
}
