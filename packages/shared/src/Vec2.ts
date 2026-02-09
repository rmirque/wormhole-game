/**
 * 2D Vector utility class for physics calculations
 */
export class Vec2 {
  constructor(
    public x: number,
    public y: number
  ) {}

  /**
   * Create a zero vector
   */
  static zero(): Vec2 {
    return new Vec2(0, 0);
  }

  /**
   * Create a vector from an angle (unit vector)
   */
  static fromAngle(angle: number): Vec2 {
    return new Vec2(Math.cos(angle), Math.sin(angle));
  }

  /**
   * Add another vector to this one
   */
  add(other: Vec2): Vec2 {
    return new Vec2(this.x + other.x, this.y + other.y);
  }

  /**
   * Subtract another vector from this one
   */
  sub(other: Vec2): Vec2 {
    return new Vec2(this.x - other.x, this.y - other.y);
  }

  /**
   * Multiply by a scalar
   */
  mul(scalar: number): Vec2 {
    return new Vec2(this.x * scalar, this.y * scalar);
  }

  /**
   * Divide by a scalar
   */
  div(scalar: number): Vec2 {
    return new Vec2(this.x / scalar, this.y / scalar);
  }

  /**
   * Get the length (magnitude) of the vector
   */
  length(): number {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  }

  /**
   * Get the squared length (faster for comparisons)
   */
  lengthSq(): number {
    return this.x * this.x + this.y * this.y;
  }

  /**
   * Normalize to unit length
   */
  normalize(): Vec2 {
    const len = this.length();
    if (len === 0) return new Vec2(0, 0);
    return this.div(len);
  }

  /**
   * Clamp the vector's length to a maximum value
   */
  clamp(maxLength: number): Vec2 {
    const len = this.length();
    if (len > maxLength) {
      return this.normalize().mul(maxLength);
    }
    return new Vec2(this.x, this.y);
  }

  /**
   * Linear interpolation between this vector and another
   */
  lerp(other: Vec2, t: number): Vec2 {
    return new Vec2(
      this.x + (other.x - this.x) * t,
      this.y + (other.y - this.y) * t
    );
  }

  /**
   * Create a copy of this vector
   */
  clone(): Vec2 {
    return new Vec2(this.x, this.y);
  }

  /**
   * Dot product with another vector
   */
  dot(other: Vec2): number {
    return this.x * other.x + this.y * other.y;
  }
}