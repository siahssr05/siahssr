import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../api/AuthContext";
import Captcha from "../components/Captcha";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "author", affiliation: "", orcid: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const captchaRef = useRef(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await register({ ...form, ...captchaRef.current.getPayload() });
      setMessage(data.message);
    } catch (err) {
      setError(err.response?.data?.error || "Something went wrong, try again");
      captchaRef.current.reset();
    } finally {
      setLoading(false);
    }
  }

  if (message) {
    return (
      <div className="container py-5 text-center" style={{ maxWidth: 480 }}>
        <h2 className="brand-font mb-3">Almost there</h2>
        <p>{message}</p>
        <Link to="/login" className="btn btn-navy mt-2">Go to Login</Link>
      </div>
    );
  }

  return (
    <div className="container py-5" style={{ maxWidth: 480 }}>
      <h1 className="brand-font mb-4 text-center">Create an Account</h1>
      {error && <div className="alert alert-danger">{error}</div>}
      <form onSubmit={handleSubmit}>
        <div className="mb-3">
          <label className="form-label">Full Name</label>
          <input className="form-control" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div className="mb-3">
          <label className="form-label">Email</label>
          <input type="email" className="form-control" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
        <div className="mb-3">
          <label className="form-label">Affiliation</label>
          <input className="form-control" value={form.affiliation} onChange={(e) => setForm({ ...form, affiliation: e.target.value })} />
        </div>
        <div className="mb-3">
          <label className="form-label">ORCID <span className="text-muted small">(optional)</span></label>
          <input
            className="form-control"
            placeholder="0000-0000-0000-0000"
            pattern="\d{4}-\d{4}-\d{4}-\d{3}[\dX]"
            title="Format: 0000-0000-0000-0000"
            value={form.orcid}
            onChange={(e) => setForm({ ...form, orcid: e.target.value })}
          />
        </div>
        <div className="mb-3">
          <label className="form-label">I am a</label>
          <select className="form-select" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            <option value="author">Author</option>
            <option value="reviewer">Reviewer</option>
          </select>
        </div>
        <div className="mb-3">
          <label className="form-label">Password</label>
          <div className="position-relative">
            <input
              type={showPassword ? "text" : "password"}
              className="form-control pe-5"
              required
              minLength={6}
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
        <Captcha ref={captchaRef} />
        <button className="btn btn-navy w-100" disabled={loading}>{loading ? "Creating…" : "Create Account"}</button>
        <p className="small text-center mt-3">Already have an account? <Link to="/login">Log in</Link></p>
      </form>
    </div>
  );
}
