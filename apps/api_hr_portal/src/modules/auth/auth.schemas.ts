import { z } from "zod";

export const requestAccessSchema = z.object({
  email: z.string().email().max(100),
});

export const verifyTokenQuerySchema = z.object({
  token: z.string().min(1).max(255),
});

export const setupPinSchema = z.object({
  token: z.string().min(1).max(255),
  pin: z.string().min(4).max(6),
});

export const loginSchema = z.object({
  email: z.string().email().max(100),
  pin: z.string().min(1).max(6),
});

export const forgotPinSchema = z.object({
  email: z.string().email().max(100),
});
