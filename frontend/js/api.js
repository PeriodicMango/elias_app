// ---------------------------------------------------------------------------
// Elias API client
// ---------------------------------------------------------------------------
// Configurable BASE URL (for Capacitor cross-origin: set window.__ELIAS_API__).
// JWT token fallback: if cookie auth fails (cross-origin), uses token from
// localStorage set by /api/auth/token.
// ---------------------------------------------------------------------------

const BASE = window.__ELIAS_API__ ?? "";

// -----------------------------------------------------------------------
// Auth helpers
// -----------------------------------------------------------------------

/**
 * Read the auth token from localStorage.
 * Set by the OAuth callback handoff or /api/auth/token endpoint.
 * @returns {string | null}
 */
function getToken() {
  try {
    return localStorage.getItem("elias-auth-token");
  } catch {
    return null;
  }
}

/**
 * Build headers with optional JWT fallback.
 * @returns {Record<string, string>}
 */
function authHeaders() {
  const token = getToken();
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

function handleAuthError() {
  // Clear stale token
  try { localStorage.removeItem("elias-auth-token"); } catch {}
  const app = document.getElementById("app-view");
  const login = document.getElementById("login-view");
  if (app) app.classList.add("hidden");
  if (login) login.classList.remove("hidden");
}

// -----------------------------------------------------------------------
// HTTP wrappers
// -----------------------------------------------------------------------

/**
 * Core request function. All verb helpers delegate to this.
 * @param {string} method
 * @param {string} path
 * @param {object} [body]
 * @returns {Promise<any>}
 */
async function request(method, path, body) {
  const options = {
    method,
    headers: authHeaders(),
    credentials: "include",
  };
  if (body !== undefined) options.body = JSON.stringify(body);

  const res = await fetch(BASE + path, options);
  if (res.status === 401) {
    handleAuthError();
    throw new Error("Unauthorized");
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

async function getJSON(path) {
  return request("GET", path);
}

async function postJSON(path, body) {
  return request("POST", path, body);
}

async function putJSON(path, body) {
  return request("PUT", path, body);
}

async function deleteJSON(path, body) {
  return request("DELETE", path, body);
}

export { deleteJSON, getJSON, postJSON, putJSON };
