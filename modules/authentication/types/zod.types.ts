import { z } from "zod";

const nameSchema = z.string().trim().min(2, "Name too short").max(100, "Name too long");
const emailSchema = z.string().trim().email("Please provide a valid email address").transform((value) => value.toLowerCase());
const passwordSchema = z
  .string({ message: "Password is required" })
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password is too long")
  .regex(/[a-z]/, "Password must contain a lowercase letter")
  .regex(/[A-Z]/, "Password must contain an uppercase letter")
  .regex(/[0-9]/, "Password must contain a number");
const providerTypeSchema = z.enum(["travel", "telecom", "both"]);

export const signupSchema = z.object({
  body: z.strictObject({
    name: nameSchema,
    email: emailSchema,
    password: passwordSchema,
  }),
});

export const resetPasswordRequestSchema = z.object({
  body: z.strictObject({ email: emailSchema }),
});

export const resetPasswordConfirmSchema = z.object({
  params: z.object({ token: z.string().min(32, "Invalid or expired token") }),
  body: z
    .strictObject({
      password: passwordSchema,
      confirmPassword: z.string().min(1, "Please confirm your password"),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: "Passwords do not match",
      path: ["confirmPassword"],
    }),
});

export const LoginSchema = z.object({
  body: z.strictObject({ email: emailSchema, password: z.string().min(1) }),
});

export const verifyEmailSchema = z.object({
  params: z.object({ token: z.string().min(32, "Invalid or expired token") }),
});

export const addServiceProviderSchema = z.object({
  body: z.strictObject({
    name: nameSchema,
    email: emailSchema,
    password: passwordSchema,
    providerType: providerTypeSchema,
  }),
});

export const updateServiceProviderSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.strictObject({
    name: nameSchema,
    email: emailSchema,
    providerType: providerTypeSchema,
  }),
});

export const patchUpdateServiceProviderSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z
    .strictObject({
      name: nameSchema.optional(),
      email: emailSchema.optional(),
      providerType: providerTypeSchema.optional(),
    })
    .refine((body) => Object.keys(body).length > 0, "At least one field is required"),
});
