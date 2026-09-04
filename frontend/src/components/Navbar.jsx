import { useEffect, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import client, { fileUrl } from "../api/client";
import { useAuth } from "../api/AuthContext";

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [logoPath, setLogoPath] = useState(null);

  useEffect(() => {
    client
      .get("/public/settings")
      .then(({ data }) => setLogoPath(data.site_logo))
      .catch(() => {});
  }, []);

  function handleLogout() {
    logout();
    navigate("/");
  }

  const dashboardPath =
    user?.role === "admin" ? "/admin" : user?.role === "reviewer" ? "/reviewer" : "/dashboard";

  return (
    <nav className="navbar navbar-expand-lg navbar-siahssr sticky-top py-2">
      <div className="container">
        <Link className="navbar-brand d-flex align-items-center" to="/">
          <img
            src={logoPath ? fileUrl(logoPath) : "/logo-site.svg"}
            onError={(e) => (e.currentTarget.src = "/logo-site.svg")}
            alt="SIAHSSR logo"
            height="100"
          />
        </Link>
        <button
          className="navbar-toggler"
          type="button"
          data-bs-toggle="collapse"
          data-bs-target="#mainNav"
        >
          <span className="navbar-toggler-icon" />
        </button>
        <div className="collapse navbar-collapse" id="mainNav">
          <ul className="navbar-nav ms-auto align-items-lg-center gap-lg-2">
            <li className="nav-item"><NavLink className="nav-link" to="/">Home</NavLink></li>
            <li className="nav-item"><NavLink className="nav-link" to="/about">About</NavLink></li>
            <li className="nav-item"><NavLink className="nav-link" to="/journals">Journals</NavLink></li>
            <li className="nav-item"><NavLink className="nav-link" to="/papers">Papers Archive</NavLink></li>
            <li className="nav-item"><NavLink className="nav-link" to="/board">Editorial Board</NavLink></li>
            <li className="nav-item"><NavLink className="nav-link" to="/events">Events</NavLink></li>
            <li className="nav-item"><NavLink className="nav-link" to="/faq">FAQ</NavLink></li>
            <li className="nav-item"><NavLink className="nav-link" to="/contact">Contact</NavLink></li>
            {!user && (
              <>
                <li className="nav-item ms-lg-2">
                  <Link className="btn btn-outline-navy btn-sm" to="/login">Login</Link>
                </li>
                <li className="nav-item">
                  <Link className="btn btn-navy btn-sm" to="/register">Sign up</Link>
                </li>
              </>
            )}
            {user && (
              <>
                <li className="nav-item">
                  <Link className="btn btn-outline-navy btn-sm" to={dashboardPath}>
                    <i className="bi bi-speedometer2 me-1" />
                    {user.name?.split(" ")[0]}
                  </Link>
                </li>
                <li className="nav-item">
                  <button className="btn btn-navy btn-sm" onClick={handleLogout}>Logout</button>
                </li>
              </>
            )}
          </ul>
        </div>
      </div>
    </nav>
  );
}
