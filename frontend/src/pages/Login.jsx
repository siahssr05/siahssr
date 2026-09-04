import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../api/AuthContext";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const user = await login(form.email, form.password);

      navigate(
        user.role === "admin"
          ? "/admin"
          : user.role === "reviewer"
          ? "/reviewer"
          : "/dashboard"
      );
    } catch (err) {
      setError(
        err.response?.data?.error ||
          "Something went wrong, try again"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container py-5" style={{ maxWidth: 440 }}>
      <h1 className="brand-font mb-4 text-center">Log In</h1>

      {error && (
        <div className="alert alert-danger">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Email */}
        <div className="mb-3">
          <label className="form-label">Email</label>

          <input
            type="email"
            className="form-control"
            placeholder="Enter your email"
            required
            value={form.email}
            onChange={(e) =>
              setForm({
                ...form,
                email: e.target.value,
              })
            }
          />
        </div>

        {/* Password */}
        <div className="mb-3">
          <label className="form-label">Password</label>

          <div className="position-relative">
            <input
              type={showPassword ? "text" : "password"}
              className="form-control pe-5"
              placeholder="Enter your password"
              required
              value={form.password}
              onChange={(e) =>
                setForm({
                  ...form,
                  password: e.target.value,
                })
              }
            />

            <button
              type="button"
              onClick={() =>
                setShowPassword(!showPassword)
              }
              className="position-absolute top-50 end-0 translate-middle-y border-0 bg-transparent"
              style={{
                cursor: "pointer",
                paddingRight: "12px",
                color: "#6c757d",
              }}
              aria-label={
                showPassword
                  ? "Hide password"
                  : "Show password"
              }
            >
              <i
                className={
                  showPassword
                    ? "bi bi-eye-slash"
                    : "bi bi-eye"
                }
              ></i>
            </button>
          </div>
        </div>

        {/* Links */}
        <div className="d-flex justify-content-between mb-3 small">
          <Link to="/forgot-password">
            Forgot password?
          </Link>

          <Link to="/register">
            Sign up
          </Link>
        </div>

        {/* Login */}
        <button
          type="submit"
          className="btn btn-navy w-100"
          disabled={loading}
        >
          {loading ? "Logging in…" : "Log In"}
        </button>
      </form>
    </div>
  );
}