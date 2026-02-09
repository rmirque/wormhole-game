/**
 * 2D Vector utility class for physics calculations
 */
export declare class Vec2 {
    x: number;
    y: number;
    constructor(x: number, y: number);
    /**
     * Create a zero vector
     */
    static zero(): Vec2;
    /**
     * Create a vector from an angle (unit vector)
     */
    static fromAngle(angle: number): Vec2;
    /**
     * Add another vector to this one
     */
    add(other: Vec2): Vec2;
    /**
     * Subtract another vector from this one
     */
    sub(other: Vec2): Vec2;
    /**
     * Multiply by a scalar
     */
    mul(scalar: number): Vec2;
    /**
     * Divide by a scalar
     */
    div(scalar: number): Vec2;
    /**
     * Get the length (magnitude) of the vector
     */
    length(): number;
    /**
     * Get the squared length (faster for comparisons)
     */
    lengthSq(): number;
    /**
     * Normalize to unit length
     */
    normalize(): Vec2;
    /**
     * Clamp the vector's length to a maximum value
     */
    clamp(maxLength: number): Vec2;
    /**
     * Linear interpolation between this vector and another
     */
    lerp(other: Vec2, t: number): Vec2;
    /**
     * Create a copy of this vector
     */
    clone(): Vec2;
    /**
     * Dot product with another vector
     */
    dot(other: Vec2): number;
}
