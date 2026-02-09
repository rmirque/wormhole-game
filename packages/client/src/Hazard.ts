/**
 * Hazard base class and specific hazard types
 * Asteroids, Seeker Drones, Mines, and Nuke
 */
import { Vec2, WORLD_WIDTH, WORLD_HEIGHT, SHIP_MAX_SPEED } from '@wormhole/shared';
import { Ship } from './Ship.js';

// Hazard types
export enum HazardType {
  ASTEROID = 'asteroid',
  SEEKER = 'seeker',
  MINE = 'mine',
  NUKE = 'nuke',
}

// Base hazard interface
export interface Hazard {
  id: number;
  type: HazardType;
  position: Vec2;
  velocity: Vec2;
  radius: number;
  lifetime: number;
  maxLifetime: number;
  active: boolean;
  update(): void;
  collidesWith(shipPosition: Vec2, shipRadius: number): boolean;
  isExpired(): boolean;
}

let hazardIdCounter = 0;

/**
 * Asteroid hazard - spawns at edges, bounces off walls
 */
export class Asteroid implements Hazard {
  id: number;
  type: HazardType = HazardType.ASTEROID;
  position: Vec2;
  velocity: Vec2;
  radius: number;
  lifetime: number;
  maxLifetime: number = 15 * 60; // 15 seconds at 60fps
  active: boolean = true;
  rotation: number = 0;
  rotationSpeed: number;
  isLarge: boolean = false;
  shapeOffsets: number[] = []; // Pre-generated shape offsets for consistent rendering

  constructor(position: Vec2, velocity: Vec2, isLarge: boolean = false) {
    this.id = hazardIdCounter++;
    this.position = position;
    this.velocity = velocity;
    this.isLarge = isLarge;
    this.radius = isLarge ? 35 : 20;
    this.lifetime = this.maxLifetime;
    this.rotation = Math.random() * Math.PI * 2;
    this.rotationSpeed = (Math.random() - 0.5) * 0.1;
    // Generate consistent random shape
    for (let i = 0; i < 8; i++) {
      this.shapeOffsets.push(0.8 + Math.random() * 0.4);
    }
  }

  update(): void {
    if (!this.active) return;

    // Move
    this.position = this.position.add(this.velocity);
    this.rotation += this.rotationSpeed;

    // Bounce off walls
    if (this.position.x < this.radius) {
      this.position.x = this.radius;
      this.velocity.x = Math.abs(this.velocity.x);
    } else if (this.position.x > WORLD_WIDTH - this.radius) {
      this.position.x = WORLD_WIDTH - this.radius;
      this.velocity.x = -Math.abs(this.velocity.x);
    }

    if (this.position.y < this.radius) {
      this.position.y = this.radius;
      this.velocity.y = Math.abs(this.velocity.y);
    } else if (this.position.y > WORLD_HEIGHT - this.radius) {
      this.position.y = WORLD_HEIGHT - this.radius;
      this.velocity.y = -Math.abs(this.velocity.y);
    }

    this.lifetime--;
  }

  collidesWith(shipPosition: Vec2, shipRadius: number): boolean {
    if (!this.active) return false;
    const dist = this.position.sub(shipPosition).length();
    return dist <= this.radius + shipRadius;
  }

  isExpired(): boolean {
    return this.lifetime <= 0;
  }
}

/**
 * Seeker Drone - homes toward player with slight wobble
 */
export class SeekerDrone implements Hazard {
  id: number;
  type: HazardType = HazardType.SEEKER;
  position: Vec2;
  velocity: Vec2;
  radius: number = 12;
  lifetime: number;
  maxLifetime: number = 20 * 60; // 20 seconds at 60fps
  active: boolean = true;
  wobblePhase: number = 0;
  maxSpeed: number;

  constructor(position: Vec2) {
    this.id = hazardIdCounter++;
    this.position = position;
    this.maxSpeed = SHIP_MAX_SPEED * 0.6; // 60% of ship max speed
    this.velocity = Vec2.zero();
    this.lifetime = this.maxLifetime;
    this.wobblePhase = Math.random() * Math.PI * 2;
  }

  private targetShip: Ship | null = null;

  setTarget(ship: Ship): void {
    this.targetShip = ship;
  }

  update(): void {
    if (!this.active) return;
    
    const ship = this.targetShip;
    if (!ship) return;

    this.wobblePhase += 0.1;

    // Calculate direction to player
    const toPlayer = ship.position.sub(this.position);
    const distance = toPlayer.length();

    if (distance > 0) {
      // Normalize and scale to max speed
      let direction = toPlayer.normalize();

      // Add wobble
      const wobbleAmount = 0.3;
      const wobbleX = Math.cos(this.wobblePhase) * wobbleAmount;
      const wobbleY = Math.sin(this.wobblePhase * 1.3) * wobbleAmount;
      direction = new Vec2(direction.x + wobbleX, direction.y + wobbleY).normalize();

      // Set velocity toward player
      this.velocity = direction.mul(this.maxSpeed);
    }

    // Move
    this.position = this.position.add(this.velocity);

    // Screen wrap
    if (this.position.x < 0) this.position.x += WORLD_WIDTH;
    if (this.position.x > WORLD_WIDTH) this.position.x -= WORLD_WIDTH;
    if (this.position.y < 0) this.position.y += WORLD_HEIGHT;
    if (this.position.y > WORLD_HEIGHT) this.position.y -= WORLD_HEIGHT;

    this.lifetime--;
  }

  collidesWith(shipPosition: Vec2, shipRadius: number): boolean {
    if (!this.active) return false;
    const dist = this.position.sub(shipPosition).length();
    return dist <= this.radius + shipRadius;
  }

  isExpired(): boolean {
    return this.lifetime <= 0;
  }
}

/**
 * Mine - stationary, arms after delay, explodes on contact
 */
export class Mine implements Hazard {
  id: number;
  type: HazardType = HazardType.MINE;
  position: Vec2;
  velocity: Vec2 = Vec2.zero();
  radius: number = 10;
  armingRadius: number = 60; // Blast radius
  lifetime: number;
  maxLifetime: number = 30 * 60; // 30 seconds at 60fps
  armingTime: number = 2 * 60; // 2 seconds at 60fps
  active: boolean = true;
  armed: boolean = false;
  blinkPhase: number = 0;

  constructor(position: Vec2) {
    this.id = hazardIdCounter++;
    this.position = position;
    this.lifetime = this.maxLifetime;
  }

  update(): void {
    if (!this.active) return;

    // Arm after delay
    if (!this.armed) {
      this.armingTime--;
      if (this.armingTime <= 0) {
        this.armed = true;
      }
    } else {
      // Blink when armed
      this.blinkPhase += 0.2;
    }

    this.lifetime--;
  }

  collidesWith(shipPosition: Vec2, shipRadius: number): boolean {
    if (!this.active) return false;

    // Check if ship is within blast radius (only when armed)
    if (this.armed) {
      const dist = this.position.sub(shipPosition).length();
      return dist <= this.armingRadius + shipRadius;
    }

    // Check physical collision with mine body (always)
    const dist = this.position.sub(shipPosition).length();
    return dist <= this.radius + shipRadius;
  }

  isExpired(): boolean {
    return this.lifetime <= 0;
  }

  getBlinkAlpha(): number {
    if (!this.armed) return 0;
    return (Math.sin(this.blinkPhase) + 1) / 2 * 0.8 + 0.2;
  }
}

/**
 * Nuke - ultimate weapon, requires full GOLD cargo
 */
export class Nuke implements Hazard {
  id: number;
  type: HazardType = HazardType.NUKE;
  position: Vec2;
  velocity: Vec2 = Vec2.zero();
  radius: number = 0; // Expands
  maxRadius: number = 375; // 75% of 500px grid
  lifetime: number;
  maxLifetime: number;
  countdownTime: number = 5 * 60; // 5 seconds countdown
  detonated: boolean = false;
  explosionTime: number = 0;
  maxExplosionTime: number = 2 * 60; // 2 seconds explosion duration
  active: boolean = true;
  safeZoneRadius: number = 50; // Safe at wormhole center

  constructor(position: Vec2) {
    this.id = hazardIdCounter++;
    this.position = position;
    this.maxLifetime = this.countdownTime + this.maxExplosionTime;
    this.lifetime = this.maxLifetime;
  }

  update(): void {
    if (!this.active) return;

    if (!this.detonated) {
      this.countdownTime--;
      if (this.countdownTime <= 0) {
        this.detonate();
      }
    } else {
      // Expand explosion
      this.explosionTime++;
      const progress = this.explosionTime / this.maxExplosionTime;
      this.radius = this.maxRadius * Math.min(progress * 1.5, 1);

      if (this.explosionTime >= this.maxExplosionTime) {
        this.active = false;
      }
    }

    this.lifetime--;
  }

  detonate(): void {
    this.detonated = true;
    this.explosionTime = 0;
  }

  collidesWith(shipPosition: Vec2, shipRadius: number): boolean {
    if (!this.active || !this.detonated) return false;

    // Check if in safe zone (center)
    const distFromCenter = shipPosition.sub(this.position).length();
    if (distFromCenter <= this.safeZoneRadius) {
      return false; // Safe at wormhole center
    }

    // Check corners (safe zones)
    const corners = [
      new Vec2(0, 0),
      new Vec2(WORLD_WIDTH, 0),
      new Vec2(0, WORLD_HEIGHT),
      new Vec2(WORLD_WIDTH, WORLD_HEIGHT),
    ];

    for (const corner of corners) {
      const distFromCorner = shipPosition.sub(corner).length();
      if (distFromCorner < 80) {
        return false; // Safe in corners
      }
    }

    // Check if in blast radius
    const dist = this.position.sub(shipPosition).length();
    return dist <= this.radius + shipRadius;
  }

  isExpired(): boolean {
    return this.lifetime <= 0;
  }

  getCountdownSeconds(): number {
    return Math.ceil(this.countdownTime / 60);
  }
}

/**
 * Speed Boost Zone - beneficial hazard from GREEN orbs
 */
export class SpeedBoostZone {
  id: number;
  position: Vec2;
  radius: number = 100;
  lifetime: number = 10 * 60; // 10 seconds
  maxLifetime: number = 10 * 60;
  active: boolean = true;
  boostMultiplier: number = 1.5;

  constructor(position: Vec2, isEnhanced: boolean = false) {
    this.id = hazardIdCounter++;
    this.position = position;
    if (isEnhanced) {
      this.radius = 150;
      this.boostMultiplier = 2.0;
      this.lifetime = 15 * 60;
      this.maxLifetime = 15 * 60;
    }
  }

  update(): void {
    this.lifetime--;
    if (this.lifetime <= 0) {
      this.active = false;
    }
  }

  contains(position: Vec2): boolean {
    if (!this.active) return false;
    return this.position.sub(position).length() <= this.radius;
  }

  isExpired(): boolean {
    return this.lifetime <= 0;
  }

  getIntensity(): number {
    return this.lifetime / this.maxLifetime;
  }
}
