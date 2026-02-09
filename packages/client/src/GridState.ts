/**
 * GridState - Manages a single grid instance (player or bot)
 * Each grid has its own orbs, hazards, ship, and physics
 */
import { PHYSICS_DT, WORLD_WIDTH, WORLD_HEIGHT, Vec2 } from '@wormhole/shared';
import { Ship, SHIP_COLLISION_RADIUS, MAX_CARGO_SLOTS } from './Ship.js';
import { Wormhole, WORMHOLE_BANKING_RADIUS } from './Wormhole.js';
import { Orb, OrbType, ORB_RADIUS } from './Orb.js';
import { ParticleSystem } from './ParticleSystem.js';
import { Hazard, HazardType, SpeedBoostZone, SeekerDrone } from './Hazard.js';
import { translateCargoToAttack, AttackResult } from './AttackTranslator.js';
import { DEBUG } from './Debug.js';

export type GridOwner = 'player' | 'bot-1' | 'bot-2' | 'bot-3';

export interface GridConfig {
  owner: GridOwner;
  isPlayer: boolean;
  shipColor: string;
  shipStartX: number;
  shipStartY: number;
}

export class GridState {
  // Identity
  owner: GridOwner;
  isPlayer: boolean;
  
  // Entities
  ship: Ship;
  wormhole: Wormhole;
  orbs: Map<number, Orb> = new Map();
  hazards: Hazard[] = [];
  boostZones: SpeedBoostZone[] = [];
  particles: ParticleSystem;
  
  // Timing
  orbSpawnTimer: number = 0;
  nextOrbSpawnTime: number = 3000;
  readonly MAX_ORBS = 12;
  readonly MIN_SPAWN_DISTANCE = 150;
  readonly MIN_EDGE_DISTANCE = 50;
  readonly SPAWN_INTERVAL_MIN = 2000;
  readonly SPAWN_INTERVAL_MAX = 4000;
  
  // Banking
  bankingPulse: number = 0;
  lastAttackResult: AttackResult | null = null;
  attackMessageTimer: number = 0;
  readonly ATTACK_MESSAGE_DURATION = 3 * 60;
  
  // Screen shake
  screenShake: number = 0;
  readonly SCREEN_SHAKE_DECAY = 0.9;
  
  // Game state
  gameOver: boolean = false;
  gameOverTimer: number = 0;
  winner: GridOwner | null = null;
  
  // Event callbacks
  onBankOrbs?: (owner: GridOwner, orbs: OrbType[]) => void;
  onShipDestroyed?: (owner: GridOwner, killer?: GridOwner) => void;
  onKillFeed?: (message: string) => void;

  constructor(config: GridConfig, sharedWormhole?: Wormhole) {
    this.owner = config.owner;
    this.isPlayer = config.isPlayer;
    
    this.ship = new Ship(config.shipStartX, config.shipStartY, config.shipColor);
    this.wormhole = sharedWormhole || new Wormhole();
    this.particles = new ParticleSystem();
  }

  /**
   * Update physics at fixed timestep (60Hz)
   */
  update(): void {
    if (this.gameOver) {
      this.gameOverTimer++;
      this.particles.update();
      return;
    }

    // Update ship
    this.ship.savePreviousState();
    this.ship.update();

    // Update wormhole (if not shared)
    if (this.wormhole) {
      this.wormhole.update();
    }

    // Update orbs
    for (const orb of this.orbs.values()) {
      orb.update();
    }

    // Update hazards
    for (const hazard of this.hazards) {
      hazard.update();
    }

    // Update boost zones
    for (const zone of this.boostZones) {
      zone.update();
    }

    // Update particles
    this.particles.update();

    // Spawn orbs
    this.updateOrbSpawning();

    // Check collisions
    this.checkCollisions();

    // Check speed boost zones
    this.checkBoostZones();

    // Update timers
    if (this.attackMessageTimer > 0) {
      this.attackMessageTimer--;
    }

    // Update banking pulse
    if (!this.ship.isDead && this.wormhole.isInBankingZone(this.ship.position)) {
      this.bankingPulse = Math.min(this.bankingPulse + 0.05, 1);
    } else {
      this.bankingPulse = Math.max(this.bankingPulse - 0.05, 0);
    }

    // Decay screen shake
    this.screenShake *= this.SCREEN_SHAKE_DECAY;
    if (this.screenShake < 0.5) this.screenShake = 0;

    // Clean up expired hazards
    this.hazards = this.hazards.filter(h => !h.isExpired() && h.active);
    this.boostZones = this.boostZones.filter(z => !z.isExpired() && z.active);

    // Check if ship died
    if (this.ship.isDead && !this.gameOver) {
      this.handleGameOver();
    }
  }

  /**
   * Handle bank orbs action
   */
  bankOrbs(): void {
    const inZone = this.wormhole.isInBankingZone(this.ship.position);
    const isEmpty = this.ship.isCargoEmpty();
    DEBUG.logGridState(this.owner, 'bankOrbs', { inZone, isEmpty, cargoCount: this.ship.getCargoCount() });

    if (inZone && !isEmpty) {
      const bankedOrbs = this.ship.clearCargo();
      DEBUG.logGridState(this.owner, 'bankingOrbs', { count: bankedOrbs.length, orbs: bankedOrbs });

      // Create particle effect
      this.particles.createBankingBurst(this.wormhole.position, '#00ffff');

      for (const orbType of bankedOrbs) {
        const color = this.getOrbColor(orbType);
        this.particles.createBurst(this.wormhole.position, color, 5, 2, 3, 25);
      }

      // Notify that orbs were banked (for cross-grid attacks)
      DEBUG.logGridState(this.owner, 'calling onBankOrbs', { callbackExists: !!this.onBankOrbs });
      this.onBankOrbs?.(this.owner, bankedOrbs);

        // Local attack result for display
        const attackResult = translateCargoToAttack(bankedOrbs, this.ship, this.wormhole.position);
        this.lastAttackResult = attackResult;
        this.attackMessageTimer = this.ATTACK_MESSAGE_DURATION;

        // Screen shake
        if (attackResult.tier >= 3) {
          this.screenShake = 20;
        } else if (attackResult.tier >= 2) {
          this.screenShake = 10;
        } else {
          this.screenShake = 5;
        }
      }
    }
  }

  /**
   * Spawn attack hazards (called when another grid banks orbs)
   */
  spawnAttack(attackResult: AttackResult, sourceOwner: GridOwner): void {
    DEBUG.logGridState(this.owner, 'spawnAttack', {
      from: sourceOwner,
      hazardCount: attackResult.hazards.length,
      boostZoneCount: attackResult.boostZones.length,
      description: attackResult.description
    });

    // Set targets for new seekers before adding to hazards
    let seekerCount = 0;
    for (const hazard of attackResult.hazards) {
      if (hazard.type === HazardType.SEEKER) {
        (hazard as SeekerDrone).setTarget(this.ship);
        seekerCount++;
      }
    }

    this.hazards.push(...attackResult.hazards);
    this.boostZones.push(...attackResult.boostZones);

    DEBUG.logGridState(this.owner, 'hazardsAdded', {
      totalHazards: this.hazards.length,
      seekerTargetsSet: seekerCount
    });

    // Show attack message
    const sourceName = sourceOwner === 'player' ? 'Player' : sourceOwner.toUpperCase();
    this.lastAttackResult = {
      ...attackResult,
      description: `${sourceName}: ${attackResult.description}`
    };
    this.attackMessageTimer = this.ATTACK_MESSAGE_DURATION;

    // Screen shake
    if (attackResult.tier >= 3) {
      this.screenShake = 20;
    } else if (attackResult.tier >= 2) {
      this.screenShake = 10;
    } else {
      this.screenShake = 5;
    }
  }

  /**
   * Update orb spawning
   */
  private updateOrbSpawning(): void {
    if (this.orbs.size >= this.MAX_ORBS) return;

    this.orbSpawnTimer += PHYSICS_DT;

    if (this.orbSpawnTimer >= this.nextOrbSpawnTime) {
      this.spawnOrb();
      this.orbSpawnTimer = 0;
      this.nextOrbSpawnTime =
        this.SPAWN_INTERVAL_MIN +
        Math.random() * (this.SPAWN_INTERVAL_MAX - this.SPAWN_INTERVAL_MIN);
    }
  }

  /**
   * Spawn a new orb
   */
  private spawnOrb(): void {
    let attempts = 0;
    const maxAttempts = 50;

    while (attempts < maxAttempts) {
      const x =
        this.MIN_EDGE_DISTANCE +
        Math.random() * (WORLD_WIDTH - this.MIN_EDGE_DISTANCE * 2);
      const y =
        this.MIN_EDGE_DISTANCE +
        Math.random() * (WORLD_HEIGHT - this.MIN_EDGE_DISTANCE * 2);

      const position = new Vec2(x, y);
      const center = new Vec2(WORLD_WIDTH / 2, WORLD_HEIGHT / 2);

      if (position.sub(center).length() >= this.MIN_SPAWN_DISTANCE) {
        let tooClose = false;
        for (const orb of this.orbs.values()) {
          if (position.sub(orb.position).length() < ORB_RADIUS * 3) {
            tooClose = true;
            break;
          }
        }

        if (!tooClose) {
          const orbType = Orb.getRandomType();
          const orb = new Orb(position, orbType);
          this.orbs.set(orb.id, orb);
          return;
        }
      }

      attempts++;
    }
  }

  /**
   * Check collisions
   */
  private checkCollisions(): void {
    // Ship-Orb collisions
    for (const [id, orb] of this.orbs.entries()) {
      if (orb.collidesWith(this.ship.position, SHIP_COLLISION_RADIUS)) {
        if (this.ship.addCargo(orb.type)) {
          const color = this.getOrbColor(orb.type);
          this.particles.createCollectionBurst(orb.position, color);
          this.orbs.delete(id);
        }
      }
    }

    // Ship-Hazard collisions
    if (!this.ship.isInvulnerable()) {
      for (const hazard of this.hazards) {
        if (hazard.collidesWith(this.ship.position, SHIP_COLLISION_RADIUS)) {
          this.handleShipHit(hazard);
          break;
        }
      }
    }
  }

  /**
   * Check boost zones
   */
  private checkBoostZones(): void {
    for (const zone of this.boostZones) {
      if (zone.contains(this.ship.position)) {
        this.ship.applySpeedBoost(zone.boostMultiplier);
      }
    }
  }

  /**
   * Handle ship being hit
   */
  private handleShipHit(hazard: Hazard): void {
    this.particles.createBurst(
      this.ship.position,
      '#ff4400',
      20,
      5,
      8,
      40
    );

    this.screenShake = 15;
    const died = this.ship.takeDamage();

    if (died) {
      this.particles.createBurst(
        this.ship.position,
        '#ff0000',
        50,
        8,
        12,
        80
      );
      
      const killerName = hazard.type === 'seeker' ? 'Seeker Drone' :
                        hazard.type === 'asteroid' ? 'Asteroid' :
                        hazard.type === 'mine' ? 'Mine' :
                        hazard.type === 'nuke' ? 'NUKE' : 'Unknown';
      
      this.onKillFeed?.(`${this.getDisplayName()} was destroyed by ${killerName}`);
      this.onShipDestroyed?.(this.owner);
    }
  }

  /**
   * Handle game over
   */
  private handleGameOver(): void {
    this.gameOver = true;
  }

  /**
   * Mark as winner
   */
  markWinner(): void {
    this.winner = this.owner;
    this.gameOver = true;
  }

  /**
   * Reset grid for new round
   */
  reset(): void {
    this.ship.reset(WORLD_WIDTH / 2, WORLD_HEIGHT / 2 + 200);
    this.hazards = [];
    this.boostZones = [];
    this.orbs.clear();
    this.particles.clear();
    this.gameOver = false;
    this.gameOverTimer = 0;
    this.screenShake = 0;
    this.lastAttackResult = null;
    this.attackMessageTimer = 0;
    this.winner = null;
    this.orbSpawnTimer = 0;
  }

  /**
   * Get display name
   */
  getDisplayName(): string {
    if (this.isPlayer) return 'Player';
    return this.owner.toUpperCase().replace('-', '-');
  }

  /**
   * Get color for orb type
   */
  private getOrbColor(orbType: OrbType): string {
    switch (orbType) {
      case OrbType.RED: return '#ff4444';
      case OrbType.BLUE: return '#4444ff';
      case OrbType.GREEN: return '#44ff44';
      case OrbType.GOLD: return '#ffcc00';
      default: return '#ffffff';
    }
  }
}
