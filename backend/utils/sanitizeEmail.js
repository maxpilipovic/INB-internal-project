
export function sanitizeEmail(rawEmail) {
  if (!rawEmail || typeof rawEmail !== 'string') return '';

  return rawEmail.trim().toLowerCase();
}
