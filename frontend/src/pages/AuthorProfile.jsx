import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import client from "../api/client";

export default function AuthorProfile() {
  const { id } = useParams();
  const [author, setAuthor] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    client
      .get(`/public/authors/${id}`)
      .then(({ data }) => setAuthor(data))
      .catch((err) => setError(err.response?.data?.error || "Author not found"));
  }, [id]);

  if (error) return <div className="container py-5 text-danger">{error}</div>;
  if (!author) return <div className="container py-5">Loading…</div>;

  return (
    <div className="container py-5" style={{ maxWidth: 720 }}>
      <h1 className="brand-font mb-1">{author.name}</h1>
      {author.affiliation && <p className="text-muted mb-1">{author.affiliation}</p>}
      {author.orcid && (
        <p className="small mb-4">
          <i className="bi bi-person-badge me-1 text-gold" />
          <a href={`https://orcid.org/${author.orcid}`} target="_blank" rel="noreferrer">{author.orcid}</a>
        </p>
      )}

      <h5 className="brand-font mb-3">Published Papers ({author.papers.length})</h5>
      {author.papers.length === 0 && <p className="text-muted">No published papers yet.</p>}
      <div className="row g-3">
        {author.papers.map((p) => (
          <div className="col-12" key={p.id}>
            <div className="card-siahssr p-3">
              <span className="badge bg-navy mb-2 align-self-start">{p.short_name}</span>
              <h6 className="fw-bold mb-1">
                <Link className="text-decoration-none text-dark" to={`/papers/${p.id}`}>{p.title}</Link>
              </h6>
              <p className="small text-muted mb-0">
                Vol. {p.volume}, Issue {p.issue} · {p.published_at ? new Date(p.published_at).toLocaleDateString() : ""}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
