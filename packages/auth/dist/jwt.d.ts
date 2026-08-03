export interface AuthTokenPayload {
    id: number;
    email: string;
    role: string;
}
export declare function signAuthToken(payload: AuthTokenPayload): string;
export declare function verifyAuthToken(token: string): AuthTokenPayload;
export declare function verifyLegacySetupToken(token: string): {
    email: string;
};
//# sourceMappingURL=jwt.d.ts.map