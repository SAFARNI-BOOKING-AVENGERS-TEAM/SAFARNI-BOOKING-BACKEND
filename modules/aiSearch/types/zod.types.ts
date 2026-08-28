import { z } from "zod";

export const AISearchFlightsSchema = z.object({
  body: z.strictObject({
    prompt: z
      .string()
      .trim()
      .min(5, "Tell SAFARNI what kind of flight you want")
      .max(500, "Search request is too long"),
  }),
});
