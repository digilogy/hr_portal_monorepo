import { Request, Response, NextFunction } from "express";
import { verifyAuthToken } from "@hr-portal/auth";

export interface AuthRequest extends Request {
  user?: {
    id: number;
    email?: string;
    role?: string;
  };
}

export const authenticateJWT = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const token = req.header("Authorization")?.replace("Bearer ", "");

  if (!token) {
    res.status(401).json({ message: "Access denied. No token provided." });
    return;
  }

  try {
    const decoded = verifyAuthToken(token);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(400).json({ message: "Invalid token." });
  }
};

export const authorizeRole = (roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user || !req.user.role || !roles.includes(req.user.role)) {
      res.status(403).json({ message: "Access forbidden. Insufficient permissions." });
      return;
    }
    next();
  };
};
