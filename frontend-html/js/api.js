// Thin fetch wrapper + auth state helpers — the vanilla-JS equivalent of the
// old React build's api/client.js + api/AuthContext.jsx combined.
//
// The frontend and API now share one origin (Express serves this folder AND
// /api/*), so the httpOnly login cookie is sent automatically on every
// request — no CORS config needed. We still keep a copy of the JWT and the
// logged-in user's profile in localStorage:
//   - it lets every page render "logged in as X" instantly without an extra
//     round trip on load,
//   - it lets the session-timeout banner (partials.js) decode the token's
//     expiry client-side,
//   - and it's sent as a Bearer header as a harmless fallback, matching what
//     the backend's requireAuth middleware already accepts.

const AUTH = {
  getUser() {
    try {
      return JSON.parse(localStorage.getItem("siahssr_user") || "null");
    } catch {
      return null;
    }
  },
  setUser(user) {
    if (user) localStorage.setItem("siahssr_user", JSON.stringify(user));
    else localStorage.removeItem("siahssr_user");
  },
  getToken() {
    return localStorage.getItem("siahssr_token");
  },
  setToken(token) {
    if (token) localStorage.setItem("siahssr_token", token);
    else localStorage.removeItem("siahssr_token");
  },
  clear() {
    AUTH.setUser(null);
    AUTH.setToken(null);
  },
};

function toQueryString(params) {
  if (!params) return "";
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") sp.set(key, value);
  });
  const s = sp.toString();
  return s ? `?${s}` : "";
}

async function apiFetch(path, opts = {}) {
  const headers = Object.assign({}, opts.headers);
  const token = AUTH.getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const isFormData = opts.body instanceof FormData;
  if (opts.body !== undefined && !isFormData && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`/api${path}`, {
    method: opts.method || "GET",
    headers,
    body: opts.body,
    credentials: "include",
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    /* empty body — fine for e.g. 204s */
  }

  if (!res.ok) {
    if (res.status === 401) AUTH.clear();
    const err = new Error((data && data.error) || `Request failed (${res.status})`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

const api = {
  get: (path, params) => apiFetch(`${path}${toQueryString(params)}`),
  post: (path, body) => apiFetch(path, { method: "POST", body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body) }),
  put: (path, body) => apiFetch(path, { method: "PUT", body: body === undefined ? undefined : JSON.stringify(body) }),
  patch: (path, body) => apiFetch(path, { method: "PATCH", body: body === undefined ? undefined : JSON.stringify(body) }),
  del: (path) => apiFetch(path, { method: "DELETE" }),
};

// Uploaded files (papers, logos, photos, receipts) are served at /uploads/...
// straight off this same origin now, so a stored path is already a usable URL.
function fileUrl(path) {
  return path || null;
}

async function login(email, password) {
  const data = await api.post("/auth/login", { email, password });
  if (data.token) AUTH.setToken(data.token);
  AUTH.setUser(data.user);
  return data.user;
}

async function logout() {
  try {
    await api.post("/auth/logout");
  } catch {
    /* best-effort — clear local state regardless */
  }
  AUTH.clear();
}

// Call at the top of any page that requires login. Redirects immediately and
// returns null if the visitor shouldn't be here; callers should bail out
// (`return;`) when this returns null so the rest of the page never renders.
function requireRole(roles) {
  const user = AUTH.getUser();
  if (!user) {
    const target = roles && roles.length === 1 ? `login-${roles[0]}.html` : "login.html";
    window.location.replace(target);
    return null;
  }
  if (roles && !roles.includes(user.role)) {
    window.location.replace("/");
    return null;
  }
  return user;
}
