import { z } from "zod";

/** Shared Zod helpers for freight server actions. */

/** UUID-shaped ids (accepts demo seed ids that are not strict RFC-4122 variants). */
export const uuidSchema = z
  .string()
  .trim()
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    "Invalid id",
  );

export const optionalUuid = z
  .string()
  .trim()
  .transform((v) => (v ? v : null))
  .pipe(z.union([uuidSchema, z.null()]));

export const moneyAmount = z.coerce.number().finite().min(0, "Amount must be ≥ 0");

export const nonEmptyString = (label: string, max = 500) =>
  z.string().trim().min(1, `${label} is required`).max(max);

export function formString(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export function parseForm<T extends z.ZodTypeAny>(
  schema: T,
  data: unknown,
): z.infer<T> {
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join("; ");
    throw new Error(msg || "Invalid input");
  }
  return parsed.data;
}
