import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../api/AuthContext";

const ROLE_LABELS = { author: "Author", reviewer: "Reviewer", admin: "Admin" };
const ROLE_HOME = { author: "/dashboard", reviewer: "/reviewer", admin: "/admin" };

/**
 * Shared login form for a specific role. Rejects login if the account's
 * actual role doesn't match this page — an author can't log in through the
 * reviewer page and vice versa, even with correct credentials.
 */
export default function RoleLogin({ role }) {
  const { login, logout } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const label = ROLE_LABELS[role];

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const user = await login(form.email, form.password);
      if (user.role !== role) {
        logout();
        setError(
          `This account is registered as ${ROLE_LABELS[user.role] || user.role}, not ${label}. ` +
            `Please use the ${ROLE_LABELS[user.role] || user.role} login instead.`
        );
        return;
      }
      navigate(ROLE_HOME[role]);
    } catch (err) {
      setError(err.response?.data?.error || "Something went wrong, try again");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container py-5" style={{ maxWidth: 440 }}>
      <h1 className="brand-font mb-1 text-center">{label} Log In</h1>
      <p className="text-muted text-center small mb-4">
        Not a {label.toLowerCase()}?{" "}
        <Link to="/login">Choose a different login</Link>
      </p>
      {error && <div className="alert alert-danger">{error}</div>}
      <form onSubmit={handleSubmit}>
        <div className="mb-3">
          <label className="form-label">Email</label>
          <input
            type="email"
            className="form-control"
            required
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </div>
        <div className="mb-3">
          <label className="form-label">Password</label>
          <div className="position-relative">
            <input
              type={showPassword ? "text" : "password"}
              className="form-control pe-5"
              required
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="position-absolute top-50 end-0 translate-middle-y border-0 bg-transparent"
              style={{ cursor: "pointer", paddingRight: "12px", color: "#6c757d" }}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              <i className={showPassword ? "bi bi-eye-slash" : "bi bi-eye"}></i>
            </button>
          </div>
        </div>
        <div className="d-flex justify-content-between mb-3 small">
          <Link to="/forgot-password">Forgot password?</Link>
          {role !== "admin" && <Link to="/register">Sign up</Link>}
        </div>
        <button className="btn btn-navy w-100" disabled={loading}>
          {loading ? "Logging in…" : `Log In as ${label}`}
        </button>
      </form>
    </div>
  );
}
