import { z } from "zod";

export const saveDaySchema = z.object({
  date: z.string().min(1),
  slots: z.array(z.unknown()),
});
