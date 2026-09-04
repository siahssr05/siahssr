import { Link } from "react-router-dom";

export default function LoginChoice() {
  return (
    <div className="container py-5" style={{ maxWidth: 480 }}>
      <h1 className="brand-font mb-2 text-center">Log In</h1>
      <p className="text-muted text-center mb-4">Choose how you'd like to log in.</p>

      <div className="d-grid gap-3">
        <Link to="/login/author" className="card-siahssr p-4 text-decoration-none text-dark">
          <h5 className="brand-font mb-1"><i className="bi bi-pencil-square me-2 text-gold" />Author Login</h5>
          <p className="small text-muted mb-0">Submit papers and track your review status.</p>
        </Link>
        <Link to="/login/reviewer" className="card-siahssr p-4 text-decoration-none text-dark">
          <h5 className="brand-font mb-1"><i className="bi bi-clipboard-check me-2 text-gold" />Reviewer Login</h5>
          <p className="small text-muted mb-0">Review papers assigned to you.</p>
        </Link>
        <Link to="/login/admin" className="card-siahssr p-4 text-decoration-none text-dark">
          <h5 className="brand-font mb-1"><i className="bi bi-shield-lock me-2 text-gold" />Admin Login</h5>
          <p className="small text-muted mb-0">Manage the site, journals, and content.</p>
        </Link>
      </div>

      <p className="text-center small mt-4 mb-0">
        Don't have an account? <Link to="/register">Sign up</Link>
      </p>
    </div>
  );
}
