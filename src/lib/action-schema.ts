import { z } from "zod";

/** Shared Zod helpers for freight server actions. */

// Shape-based check: seeded demo ids (e.g. 4444…-4444) are valid Postgres uuids
// but fail Zod's RFC version/variant check.
const UUID_SHAPE =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export const uuidSchema = z.string().trim().regex(UUID_SHAPE, "Invalid id");

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
