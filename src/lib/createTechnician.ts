import { z } from "zod";
import { MIN_PASSWORD_LENGTH } from "@/lib/passwordRules";

export const MIN_TECH_PASSWORD_LENGTH = MIN_PASSWORD_LENGTH;

export const createTechnicianBodySchema = z
  .object({
    name: z.string().trim().min(1, "Name is required"),
    phone: z.string().trim().min(1, "Phone is required"),
    email: z
      .string()
      .trim()
      .email("Valid email is required")
      .transform((e) => e.toLowerCase()),
    password: z.string().min(MIN_TECH_PASSWORD_LENGTH).optional(),
    generatePassword: z.boolean().optional(),
    vehicle: z.string().trim().optional(),
  })
  .superRefine((val, ctx) => {
    const hasPassword = Boolean(val.password);
    const generate = val.generatePassword === true || (!hasPassword && val.generatePassword !== false);
    if (!hasPassword && !generate) {
      ctx.addIssue({
        code: "custom",
        message: "Provide a temporary password or generate one",
        path: ["password"],
      });
    }
  });

export type CreateTechnicianBody = z.infer<typeof createTechnicianBodySchema>;

export function shouldGenerateTechnicianPassword(body: {
  password?: string;
  generatePassword?: boolean;
}): boolean {
  if (body.generatePassword === true) return true;
  if (body.password && body.password.length >= MIN_TECH_PASSWORD_LENGTH) {
    return false;
  }
  return body.generatePassword !== false;
}
