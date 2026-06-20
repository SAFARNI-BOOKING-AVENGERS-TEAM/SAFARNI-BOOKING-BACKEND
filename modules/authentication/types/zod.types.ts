import { z } from "zod";

export const UserSchema = z.object({
  name: z.string().min(2, "Name too short"),

  email: z
    .string({ message: "Email is required" })
    .email("Please provide a valid email address"),

  password: z
    .string({ message: "Password is required" })
    .min(8, "Password must be at least 8 characters"),

  isVerified: z.boolean().default(false),
});

export const resetPasswordRequestSchema = z.object({
  body: z.object({
    email: UserSchema.shape.email,
  }),
});

export const resetPasswordConfirmSchema = z.object({
  params: z.object({
    token: z.string().min(10, "Invalid or expired token"),
  }),
  body: z
    .object({
      password: UserSchema.shape.password,
      confirmPassword: z
        .string({ message: "Confirm password is required" })
        .min(1, "Please confirm your password"),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: "Passwords do not match",
      path: ["confirmPassword"],
    }),
});

export const LoginSchema = z.object({
  body: z.strictObject({
    email: UserSchema.shape.email,
    password: UserSchema.shape.password,
  }),
});
