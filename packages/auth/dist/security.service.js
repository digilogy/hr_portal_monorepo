"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SecurityService = void 0;
const crypto_1 = __importDefault(require("crypto"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
class SecurityService {
    /**
     * Generates a 32-byte cryptographically secure random token (64 hex characters).
     */
    static generateSecureToken() {
        return crypto_1.default.randomBytes(32).toString("hex");
    }
    /**
     * Performs constant-time comparison to prevent timing attacks on token validation.
     */
    static constantTimeCompare(a, b) {
        if (typeof a !== "string" || typeof b !== "string") {
            return false;
        }
        const bufA = Buffer.from(a, "utf-8");
        const bufB = Buffer.from(b, "utf-8");
        if (bufA.length !== bufB.length) {
            return false;
        }
        return crypto_1.default.timingSafeEqual(bufA, bufB);
    }
    /**
     * Hashes a numeric 4-digit or 6-digit PIN securely using bcrypt.
     */
    static async hashPin(pin) {
        const saltRounds = 10;
        return bcryptjs_1.default.hash(pin, saltRounds);
    }
    /**
     * Verifies a plain text PIN against a stored bcrypt hash.
     */
    static async verifyPin(pin, hash) {
        return bcryptjs_1.default.compare(pin, hash);
    }
}
exports.SecurityService = SecurityService;
//# sourceMappingURL=security.service.js.map