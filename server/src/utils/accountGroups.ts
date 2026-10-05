import { z } from 'zod';

/** A group name as sent by the client: trimmed, and blank or null means "no group" */
export const groupNameSchema = z
  .string()
  .trim()
  .max(200)
  .nullable()
  .transform((name) => name || null);

/**
 * The name to store for an account that asks to be in `name`. A group is nothing but the name
 * its accounts share, so a name typed in another case ("visa" for "Visa") takes the spelling
 * the other accounts already use instead of starting a second group next to it.
 */
export function resolveGroupName(
  name: string | null,
  namesInUse: readonly (string | null)[],
): string | null {
  if (name === null) return null;
  const wanted = name.toLowerCase();
  return namesInUse.find((used) => used?.toLowerCase() === wanted) ?? name;
}
