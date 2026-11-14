// The name on the ranking (user_metadata.display_name), as the sign-in step and Settings save it.
export const NAME_MAX = 24;
export const cleanName = (s: string) => s.trim().replace(/\s+/g, ' ').slice(0, NAME_MAX);
