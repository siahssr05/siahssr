const jwt = require("jsonwebtoken");

function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  const token = header && header.startsWith("Bearer ") ? header.split(" ")[1] : req.cookies?.token;

  if (!token) return res.status(401).json({ error: "Not authenticated" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id, role, name, email }
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired session" });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: "You do not have permission to do this" });
    }
    next();
  };
}

// Like requireAuth, but for routes a signed-out visitor is also allowed to
// hit (e.g. downloading a paper that's already public) — a route using this
// still needs its own handler-level check for anything that should stay
// restricted (ownership, reviewer/admin-only, etc.), because req.user may be
// undefined here. If a token IS present it's still verified normally; only a
// missing token is let through instead of rejected with 401.
function optionalAuth(req, res, next) {
  const header = req.headers.authorization;
  const token = header && header.startsWith("Bearer ") ? header.split(" ")[1] : req.cookies?.token;

  if (!token) return next();

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    // An expired/invalid token on an optional-auth route shouldn't block a
    // guest from reaching public content — just proceed without req.user.
  }
  next();
}

module.exports = { requireAuth, requireRole, optionalAuth };
