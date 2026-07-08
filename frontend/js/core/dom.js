// ---------------------------------------------------------------------------
// DOM utilities shared across the frontend
// ---------------------------------------------------------------------------

/**
 * Escape HTML special characters to prevent XSS.
 * @param {string | null | undefined} s
 * @returns {string}
 */
export function escapeHtml(s) {
  if (s == null) return "";
  const div = document.createElement("div");
  div.textContent = String(s);
  return div.innerHTML;
}
