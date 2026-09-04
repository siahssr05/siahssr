import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import client from "../api/client";
import { useAuth } from "../api/AuthContext";
import useSEO from "../hooks/useSEO";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";

function apaCitation(paper) {
  const year = paper.published_at ? new Date(paper.published_at).getFullYear() : "n.d.";
  const volIssue = paper.volume ? `, ${paper.volume}${paper.issue ? `(${paper.issue})` : ""}` : "";
  const doi = paper.doi ? ` https://doi.org/${paper.doi}` : "";
  return `${paper.author_name} (${year}). ${paper.title}. ${paper.journal_name}${volIssue}.${doi}`;
}

export default function PaperDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [paper, setPaper] = useState(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    client
      .get(`/papers/${id}`)
      .then(({ data }) => setPaper(data))
      .catch((err) => setError(err.response?.data?.error || "Failed to load paper"));
  }, [id]);

  useSEO({
    title: paper ? `${paper.title} — SIAHSSR` : undefined,
    description: paper ? paper.abstract?.slice(0, 200) : undefined,
    jsonLd: paper
      ? {
          "@context": "https://schema.org",
          "@type": "ScholarlyArticle",
          headline: paper.title,
          abstract: paper.abstract,
          author: { "@type": "Person", name: paper.author_name },
          isPartOf: {
            "@type": "Periodical",
            name: paper.journal_name,
            issn: paper.issn || undefined,
          },
          datePublished: paper.published_at || undefined,
          keywords: paper.keywords || undefined,
          ...(paper.doi ? { sameAs: `https://doi.org/${paper.doi}` } : {}),
        }
      : undefined,
  });

  if (error) return <div className="container py-5 text-danger">{error}</div>;
  if (!paper) return <div className="container py-5">Loading…</div>;

  // Download relies on the httpOnly auth cookie set at login (sent automatically by the browser)
  const downloadUrl = `${API_BASE}/api/papers/${id}/download`;
  const bibtexUrl = `${API_BASE}/api/papers/${id}/citation?format=bibtex`;
  const risUrl = `${API_BASE}/api/papers/${id}/citation?format=ris`;

  function copyApa() {
    navigator.clipboard?.writeText(apaCitation(paper)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="container py-5" style={{ maxWidth: 780 }}>
      {/* Letterhead-style header: journal name at top of the paper view */}
      <div className="border-bottom border-3 pb-3 mb-4" style={{ borderColor: "#C99B3D" }}>
        <span className="badge bg-navy mb-2">{paper.short_name}</span>
        <h4 className="brand-font mb-0">{paper.journal_name}</h4>
      </div>

      <h1 className="mb-3" style={{ fontSize: "1.6rem" }}>{paper.title}</h1>
      <p className="text-muted mb-3">
        <Link to={`/authors/${paper.author_id}`} className="text-decoration-none">{paper.author_name}</Link>
        {" "}· Vol. {paper.volume}, Issue {paper.issue}
        {paper.doi && <> · DOI: {paper.doi}</>}
      </p>

      <h6 className="fw-bold">Abstract</h6>
      <p style={{ textAlign: "justify" }}>{paper.abstract}</p>

      {paper.keywords && (
        <>
          <h6 className="fw-bold">Keywords</h6>
          <p>{paper.keywords}</p>
        </>
      )}

      <p className="small text-muted">Published: {paper.published_at ? new Date(paper.published_at).toLocaleDateString() : "—"}</p>

      <div className="d-flex flex-wrap gap-2 mt-2">
        {user ? (
          <a href={downloadUrl} className="btn btn-navy">
            <i className="bi bi-download me-1" /> Download Paper (.docx)
          </a>
        ) : (
          <span className="small text-muted align-self-center">Log in to download the full paper.</span>
        )}
      </div>

      <div className="card-siahssr p-3 mt-4">
        <h6 className="fw-bold mb-2">Cite this paper</h6>
        <p className="small mb-2" style={{ fontFamily: "monospace" }}>{apaCitation(paper)}</p>
        <div className="d-flex flex-wrap gap-2">
          <button className="btn btn-sm btn-outline-navy" onClick={copyApa}>
            <i className="bi bi-clipboard me-1" />{copied ? "Copied!" : "Copy APA"}
          </button>
          <a className="btn btn-sm btn-outline-navy" href={bibtexUrl}>BibTeX</a>
          <a className="btn btn-sm btn-outline-navy" href={risUrl}>RIS</a>
        </div>
      </div>
    </div>
  );
}
