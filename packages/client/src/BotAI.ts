/**
 * BotAI - AI opponent controller with state machine
 * Four states: COLLECT, BANK, EVADE, FLEE_NUKE
 */
import { Vec2, WORLD_WIDTH, WORLD_HEIGHT, SHIP_THRUST, SHIP_ROTATION_SPEED, SHIP_MAX_SPEED } from '@wormhole/shared';
import { Ship, MAX_CARGO_SLOTS } from './Ship.js';
import { Orb, ORB_RADIUS } from './Orb.js';
import { Wormhole, WORMHOLE_BANKING_RADIUS } from './Wormhole.js';
import { Hazard, HazardType, Nuke } from './Hazard.js';
import { GridState } from './GridState.js';

// Bot difficulty settings
export type Difficulty = 'easy' | 'medium' | 'hard';

export interface BotConfig {
  difficulty: Difficulty;
  reactionDelay: number; // ms
  steeringAccuracy: number; // 0-1
  bankThreshold: number; // 0-1 (percentage of cargo)
  evadeDistance: number; // pixels
  color: string;
}

// Default difficulty settings
export const DIFFICULTY_SETTINGS: Record<Difficulty, Omit<BotConfig, 'color'>> = {
  easy: {
    difficulty: 'easy',
    reactionDelay: 250,
    steeringAccuracy: 0.70,
    bankThreshold: 0.80,
    evadeDistance: 100,
  },
  medium: {
    difficulty: 'medium',
    reactionDelay: 133,
    steeringAccuracy: 0.85,
    bankThreshold: 0.60,
    evadeDistance: 150,
  },
  hard: {
    difficulty: 'hard',
    reactionDelay: 33,
    steeringAccuracy: 0.97,
    bankThreshold: 0.40,
    evadeDistance: 200,
  },
};

// AI States
enum BotState {
  COLLECT = 'collect',
  BANK = 'bank',
  EVADE = 'evade',
  FLEE_NUKE = 'flee_nuke',
}

export class BotAI {
  grid: GridState;
  config: BotConfig;
  
  // State machine
  currentState: BotState = BotState.COLLECT;
  stateTimer: number = 0;
  
  // Reaction delay tracking
  lastDecisionTime: number = 0;
  pendingAction: (() => void) | null = null;
  
  // Target tracking
  targetOrb: Orb | null = null;
  targetPosition: Vec2 | null = null;
  
  // Navigation
  private static readonly CORNERS = [
    new Vec2(50, 50),
    new Vec2(WORLD_WIDTH - 50, 50),
    new Vec2(50, WORLD_HEIGHT - 50),
    new Vec2(WORLD_WIDTH - 50, WORLD_HEIGHT - 50),
  ];

  constructor(grid: GridState, config: BotConfig) {
    this.grid = grid;
    this.config = config;
    this.lastDecisionTime = performance.now();
  }

  /**
   * Update bot AI
   */
  update(): void {
    if (this.grid.ship.isDead || this.grid.gameOver) {
      this.stopShip();
      return;
    }

    const now = performance.now();
    
    // Check state transitions (immediate for threats)
    this.checkStateTransitions();
    
    // Execute state behavior with reaction delay
    if (now - this.lastDecisionTime >= this.config.reactionDelay) {
      this.executeStateBehavior();
      this.lastDecisionTime = now;
    }
    
    // Always apply current thrust/rotation (smooth movement)
    this.applyMovement();
  }

  /**
   * Check and handle state transitions
   */
  private checkStateTransitions(): void {
    const ship = this.grid.ship;
    const hazards = this.grid.hazards;
    const cargoFullness = ship.getCargoCount() / MAX_CARGO_SLOTS;
    
    // Priority 1: FLEE_NUKE - if nuke countdown active
    const nuke = hazards.find(h => h.type === HazardType.NUKE && !(h as Nuke).detonated) as Nuke | undefined;
    if (nuke) {
      if (this.currentState !== BotState.FLEE_NUKE) {
        this.currentState = BotState.FLEE_NUKE;
        this.targetPosition = this.findNearestCorner();
      }
      return;
    }
    
    // Priority 2: EVADE - if hazard nearby
    const nearestHazard = this.findNearestHazard();
    if (nearestHazard && nearestHazard.distance < this.config.evadeDistance) {
      if (this.currentState !== BotState.EVADE) {
        this.currentState = BotState.EVADE;
        this.targetPosition = this.calculateEscapeVector(nearestHazard.hazard);
      }
      return;
    }
    
    // Priority 3: BANK - if cargo >= threshold
    if (cargoFullness >= this.config.bankThreshold) {
      if (this.currentState !== BotState.BANK) {
        this.currentState = BotState.BANK;
        this.targetPosition = this.grid.wormhole.position;
      }
      return;
    }
    
    // Default: COLLECT
    if (this.currentState !== BotState.COLLECT) {
      this.currentState = BotState.COLLECT;
      this.targetOrb = null;
    }
  }

  /**
   * Execute behavior based on current state
   */
  private executeStateBehavior(): void {
    switch (this.currentState) {
      case BotState.COLLECT:
        this.executeCollect();
        break;
      case BotState.BANK:
        this.executeBank();
        break;
      case BotState.EVADE:
        this.executeEvade();
        break;
      case BotState.FLEE_NUKE:
        this.executeFleeNuke();
        break;
    }
  }

  /**
   * COLLECT state: Find nearest orb and steer toward it
   */
  private executeCollect(): void {
    const ship = this.grid.ship;
    
    // Find nearest orb
    let nearestOrb: Orb | null = null;
    let nearestDist = Infinity;
    
    for (const orb of this.grid.orbs.values()) {
      const dist = orb.position.sub(ship.position).length();
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestOrb = orb;
      }
    }
    
    if (nearestOrb) {
      this.targetOrb = nearestOrb;
      this.steerToward(nearestOrb.position);
    } else {
      // No orbs, patrol around center
      const angle = Date.now() / 2000;
      const patrolPos = new Vec2(
        WORLD_WIDTH / 2 + Math.cos(angle) * 300,
        WORLD_HEIGHT / 2 + Math.sin(angle) * 300
      );
      this.steerToward(patrolPos);
    }
  }

  /**
   * BANK state: Steer toward wormhole and bank
   */
  private executeBank(): void {
    const ship = this.grid.ship;
    const wormhole = this.grid.wormhole;
    
    const distToWormhole = ship.position.sub(wormhole.position).length();
    
    if (distToWormhole < WORMHOLE_BANKING_RADIUS) {
      // In banking zone, bank orbs
      this.grid.bankOrbs();
      // Reset state after banking
      this.currentState = BotState.COLLECT;
    } else {
      // Steer toward wormhole
      this.steerToward(wormhole.position);
    }
  }

  /**
   * EVADE state: Calculate escape vector away from threats
   */
  private executeEvade(): void {
    const nearestHazard = this.findNearestHazard();
    
    if (!nearestHazard || nearestHazard.distance > this.config.evadeDistance * 1.5) {
      // Safe now, return to collect
      this.currentState = BotState.COLLECT;
      return;
    }
    
    // Calculate escape direction
    const escapePos = this.calculateEscapeVector(nearestHazard.hazard);
    this.steerToward(escapePos);
  }

  /**
   * FLEE_NUKE state: Fly to nearest corner
   */
  private executeFleeNuke(): void {
    // Check if nuke still active
    const nuke = this.grid.hazards.find(
      h => h.type === HazardType.NUKE && !(h as Nuke).detonated
    ) as Nuke | undefined;
    
    if (!nuke) {
      // Nuke detonated or expired, return to collect
      this.currentState = BotState.COLLECT;
      return;
    }
    
    // Update corner target (nearest one)
    this.targetPosition = this.findNearestCorner();
    
    if (this.targetPosition) {
      const dist = this.grid.ship.position.sub(this.targetPosition).length();
      if (dist < 30) {
        // Reached corner, stop
        this.stopShip();
      } else {
        this.steerToward(this.targetPosition);
      }
    }
  }

  /**
   * Steer ship toward a target position
   */
  private steerToward(target: Vec2): void {
    const ship = this.grid.ship;
    
    // Calculate desired angle
    const toTarget = target.sub(ship.position);
    const desiredAngle = Math.atan2(toTarget.y, toTarget.x);
    
    // Calculate angle difference
    let angleDiff = desiredAngle - ship.angle;
    
    // Normalize to -PI to PI
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
    
    // Apply steering accuracy (imperfect bots)
    const accuracy = this.config.steeringAccuracy;
    const adjustedDiff = angleDiff * accuracy + (Math.random() - 0.5) * 0.1 * (1 - accuracy);
    
    // Set rotation input
    if (Math.abs(adjustedDiff) > 0.1) {
      ship.rotatingLeft = adjustedDiff < 0;
      ship.rotatingRight = adjustedDiff > 0;
    } else {
      ship.rotatingLeft = false;
      ship.rotatingRight = false;
    }
    
    // Thrust when roughly facing target or if far away
    const dist = toTarget.length();
    const angleError = Math.abs(angleDiff);
    
    // Thrust if facing mostly toward target, or if very far
    ship.thrusting = angleError < Math.PI / 3 || dist > 400;
  }

  /**
   * Apply current movement inputs to ship
   */
  private applyMovement(): void {
    // Ship.update() handles the actual physics
    // This method is a placeholder for any additional movement logic
  }

  /**
   * Stop all ship movement
   */
  private stopShip(): void {
    this.grid.ship.thrusting = false;
    this.grid.ship.rotatingLeft = false;
    this.grid.ship.rotatingRight = false;
  }

  /**
   * Find the nearest hazard
   */
  private findNearestHazard(): { hazard: Hazard; distance: number } | null {
    let nearest: Hazard | null = null;
    let nearestDist = Infinity;
    
    for (const hazard of this.grid.hazards) {
      if (!hazard.active) continue;
      
      const dist = hazard.position.sub(this.grid.ship.position).length();
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = hazard;
      }
    }
    
    return nearest ? { hazard: nearest, distance: nearestDist } : null;
  }

  /**
   * Calculate escape vector away from a hazard
   */
  private calculateEscapeVector(hazard: Hazard): Vec2 {
    const ship = this.grid.ship;
    
    // Direction away from hazard
    let away = ship.position.sub(hazard.position);
    
    // If too close to center, add some randomness
    if (away.length() < 10) {
      away = Vec2.fromAngle(Math.random() * Math.PI * 2);
    }
    
    away = away.normalize();
    
    // Target position in escape direction
    return ship.position.add(away.mul(200));
  }

  /**
   * Find the nearest safe corner
   */
  private findNearestCorner(): Vec2 {
    let nearest = BotAI.CORNERS[0];
    let nearestDist = Infinity;
    
    for (const corner of BotAI.CORNERS) {
      const dist = corner.sub(this.grid.ship.position).length();
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = corner;
      }
    }
    
    return nearest;
  }

  /**
   * Get current state name for debugging
   */
  getStateName(): string {
    return this.currentState;
  }
}
