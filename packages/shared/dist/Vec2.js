/**
 * 2D Vector utility class for physics calculations
 */
export class Vec2 {
    x;
    y;
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }
    /**
     * Create a zero vector
     */
    static zero() {
        return new Vec2(0, 0);
    }
    /**
     * Create a vector from an angle (unit vector)
     */
    static fromAngle(angle) {
        return new Vec2(Math.cos(angle), Math.sin(angle));
    }
    /**
     * Add another vector to this one
     */
    add(other) {
        return new Vec2(this.x + other.x, this.y + other.y);
    }
    /**
     * Subtract another vector from this one
     */
    sub(other) {
        return new Vec2(this.x - other.x, this.y - other.y);
    }
    /**
     * Multiply by a scalar
     */
    mul(scalar) {
        return new Vec2(this.x * scalar, this.y * scalar);
    }
    /**
     * Divide by a scalar
     */
    div(scalar) {
        return new Vec2(this.x / scalar, this.y / scalar);
    }
    /**
     * Get the length (magnitude) of the vector
     */
    length() {
        return Math.sqrt(this.x * this.x + this.y * this.y);
    }
    /**
     * Get the squared length (faster for comparisons)
     */
    lengthSq() {
        return this.x * this.x + this.y * this.y;
    }
    /**
     * Normalize to unit length
     */
    normalize() {
        const len = this.length();
        if (len === 0)
            return new Vec2(0, 0);
        return this.div(len);
    }
    /**
     * Clamp the vector's length to a maximum value
     */
    clamp(maxLength) {
        const len = this.length();
        if (len > maxLength) {
            return this.normalize().mul(maxLength);
        }
        return new Vec2(this.x, this.y);
    }
    /**
     * Linear interpolation between this vector and another
     */
    lerp(other, t) {
        return new Vec2(this.x + (other.x - this.x) * t, this.y + (other.y - this.y) * t);
    }
    /**
     * Create a copy of this vector
     */
    clone() {
        return new Vec2(this.x, this.y);
    }
    /**
     * Dot product with another vector
     */
    dot(other) {
        return this.x * other.x + this.y * other.y;
    }
}
