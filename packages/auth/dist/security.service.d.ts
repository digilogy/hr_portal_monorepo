export declare class SecurityService {
    /**
     * Generates a 32-byte cryptographically secure random token (64 hex characters).
     */
    static generateSecureToken(): string;
    /**
     * Performs constant-time comparison to prevent timing attacks on token validation.
     */
    static constantTimeCompare(a: string, b: string): boolean;
    /**
     * Hashes a numeric 4-digit or 6-digit PIN securely using bcrypt.
     */
    static hashPin(pin: string): Promise<string>;
    /**
     * Verifies a plain text PIN against a stored bcrypt hash.
     */
    static verifyPin(pin: string, hash: string): Promise<boolean>;
}
//# sourceMappingURL=security.service.d.ts.map