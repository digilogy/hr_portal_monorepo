import { z } from "zod";

export const requestAccessSchema = z.object({
  email: z.string().min(1),
});

export const verifyTokenQuerySchema = z.object({
  token: z.string().min(1),
});

export const setupPinSchema = z.object({
  token: z.string().min(1),
  pin: z.string().min(1),
});

export const loginSchema = z.object({
  email: z.string().min(1),
  pin: z.string().min(1),
});

export const forgotPinSchema = z.object({
  email: z.string().min(1),
});
