import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import client from "../api/client";

export default function Home() {
  const [settings, setSettings] = useState({});
  const [stats, setStats] = useState(null);
  const [announcements, setAnnouncements] = useState([]);

  useEffect(() => {
    client.get("/public/settings").then(({ data }) => setSettings(data)).catch(() => {});
    client.get("/public/stats").then(({ data }) => setStats(data)).catch(() => {});
    client.get("/public/announcements").then(({ data }) => setAnnouncements(data)).catch(() => {});
  }, []);

  return (
    <div>
      <section className="hero-section py-5">
        <div className="container py-4 text-center">
          <h1 className="fw-bold display-6 mb-3">{settings.hero_title || "Sai Institute of Arts, Humanities and Social Science Research"}</h1>
          <p className="lead">{settings.hero_subtitle}</p>
          <div className="d-flex justify-content-center gap-3 mt-4">
            <Link to="/journals" className="btn btn-light btn-lg text-navy fw-semibold">Explore Journals</Link>
            <Link to="/register" className="btn btn-outline-light btn-lg">Submit a Paper</Link>
          </div>
        </div>
      </section>

      {stats && (
        <section className="container py-5">
          <div className="row text-center g-4">
            <div className="col-md-4">
              <h2 className="brand-font text-navy fw-bold">{stats.total_published}</h2>
              <p className="text-muted">Published Papers</p>
            </div>
            <div className="col-md-4">
              <h2 className="brand-font text-navy fw-bold">{stats.total_journals}</h2>
              <p className="text-muted">Active Journals</p>
            </div>
            <div className="col-md-4">
              <h2 className="brand-font text-navy fw-bold">{stats.total_reviewers}</h2>
              <p className="text-muted">Peer Reviewers</p>
            </div>
          </div>
        </section>
      )}

      {stats?.latestPapers?.length > 0 && (
        <section className="container py-4">
          <h3 className="brand-font mb-4">Recently Published</h3>
          <div className="row g-4">
            {stats.latestPapers.map((p) => (
              <div className="col-md-6" key={p.id}>
                <div className="card-siahssr p-3 h-100">
                  <span className="badge bg-navy mb-2 align-self-start">{p.short_name}</span>
                  <h6 className="fw-bold">
                    <Link className="text-decoration-none text-dark" to={`/papers/${p.id}`}>{p.title}</Link>
                  </h6>
                  <p className="small text-muted mb-0">{p.author_name}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {announcements.length > 0 && (
        <section className="container py-4 mb-4">
          <h3 className="brand-font mb-4">Announcements</h3>
          {announcements.map((a) => (
            <div className="border-start border-3 border-warning ps-3 mb-3" key={a.id}>
              <h6 className="fw-bold mb-1">{a.title}</h6>
              <p className="small text-muted mb-0">{a.content}</p>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
