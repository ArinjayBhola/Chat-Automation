/**
 * Input sanitization for user-supplied text before it is stored or sent to a
 * model. We intentionally keep message content as plain text (the UI renders it
 * as text, not HTML), so the job here is to strip control characters, normalize
 * whitespace, and cap length — not to allow any markup through.
 */

const MAX_MESSAGE_LENGTH = 8000;

// Strip C0/C1 control chars except tab (09), newline (0A), carriage return (0D).
// Built from escape sequences so no literal control bytes live in source.
const CONTROL_CHARS = new RegExp(
  "[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\u007F-\\u009F]",
  "g",
);

export function sanitizeMessage(input: string): string {
  return input
    .replace(CONTROL_CHARS, "")
    .replace(/\r\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n") // collapse excessive blank lines
    .trim()
    .slice(0, MAX_MESSAGE_LENGTH);
}

/** Sanitize a single-line value (e.g. an edited approval field). */
export function sanitizeLine(input: string): string {
  return input.replace(CONTROL_CHARS, "").replace(/\s+/g, " ").trim();
}
