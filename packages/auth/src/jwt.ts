import jwt from "jsonwebtoken";
import { env } from "@hr-portal/config";

const JWT_SECRET = env.JWT_SECRET;
const SETUP_SECRET = env.JWT_SECRET + "_setup";

export interface AuthTokenPayload {
  id: number;
  email: string;
  role: string;
}

export function signAuthToken(payload: AuthTokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "24h" });
}

export function verifyAuthToken(token: string): AuthTokenPayload {
  return jwt.verify(token, JWT_SECRET) as AuthTokenPayload;
}

export function verifyLegacySetupToken(token: string): { email: string } {
  return jwt.verify(token, SETUP_SECRET) as { email: string };
}
