import crypto from "crypto";
import bcrypt from "bcryptjs";

export class SecurityService {
  /**
   * Generates a 32-byte cryptographically secure random token (64 hex characters).
   */
  static generateSecureToken(): string {
    return crypto.randomBytes(32).toString("hex");
  }

  /**
   * Performs constant-time comparison to prevent timing attacks on token validation.
   */
  static constantTimeCompare(a: string, b: string): boolean {
    if (typeof a !== "string" || typeof b !== "string") {
      return false;
    }
    const bufA = Buffer.from(a, "utf-8");
    const bufB = Buffer.from(b, "utf-8");

    if (bufA.length !== bufB.length) {
      return false;
    }
    return crypto.timingSafeEqual(bufA, bufB);
  }

  /**
   * Hashes a numeric 4-digit or 6-digit PIN securely using bcrypt.
   */
  static async hashPin(pin: string): Promise<string> {
    const saltRounds = 10;
    return bcrypt.hash(pin, saltRounds);
  }

  /**
   * Verifies a plain text PIN against a stored bcrypt hash.
   */
  static async verifyPin(pin: string, hash: string): Promise<boolean> {
    return bcrypt.compare(pin, hash);
  }
}
