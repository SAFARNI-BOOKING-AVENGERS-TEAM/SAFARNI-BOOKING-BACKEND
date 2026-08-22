import { superRefine, z } from "zod";

export const UserSchema = z.object({
  name: z.string().trim().min(2, "Name too short").max(50, "Name too long"),

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

export const RegisterSchema = z.object({
  body: z.strictObject({
    name: UserSchema.shape.name,
    email: UserSchema.shape.email,
    password: UserSchema.shape.password,
  }),
});

export const LoginSchema = z.object({
  body: z.strictObject({
    email: UserSchema.shape.email,
    password: UserSchema.shape.password,
  }),
});

export const verifyEmailSchema = z.object({
  params: z.object({
    token: z.string().min(10, "Invalid or expired token"),
  }),
});
// Additional schemas for service provider management
// Add Service Provider Schema
export const addServiceProviderSchema = z.object({
  body: z.strictObject({
    name: UserSchema.shape.name,
    email: UserSchema.shape.email,
    password: UserSchema.shape.password,
    service: z.enum(["flights", "cars", "hotels"], {
      message: "Service is required",
    }),
  }),
});
 

// Update Service Provider Schema
export const updateServiceProviderSchema = z.object({
  params: z.object({
    id: z.string()
  }),
  body: z.strictObject({
    name: UserSchema.shape.name,
    email: UserSchema.shape.email,
    service: z.enum(["flights", "cars", "hotels"], {
      message: "Service is required",
    }),
  }),
});
// Patch Update Service Provider Schema
export const patchUpdateServiceProviderSchema = z.object({
  params: z.object({
    id: z.string()
  }),
  body: z.strictObject({
    name: UserSchema.shape.name.optional(),
    email: UserSchema.shape.email.optional(),
    service: z.enum(["flights", "cars", "hotels"], {
      message: "Service is required",
    }).optional(),
  }),
});
//get service provider by service schema
export const getServiceProviderByServiceSchema = z.object({
  query: z.object({
    service: z.enum(["flights", "cars", "hotels"], {
      message: "Service is required",
    }),
  }),
});