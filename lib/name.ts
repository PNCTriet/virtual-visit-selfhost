export const NAME_MAX_LENGTH = 30;

export const MESSAGES = {
  nameRequired: "Please enter your name.",
  nameTooLong: `Please use ${NAME_MAX_LENGTH} characters or fewer.`,
} as const;

/** Returns an error message, or null when the trimmed name is 1–30 characters. */
export function validateName(raw: string): string | null {
  const name = raw.trim();
  if (!name) return MESSAGES.nameRequired;
  if ([...name].length > NAME_MAX_LENGTH) return MESSAGES.nameTooLong;
  return null;
}
