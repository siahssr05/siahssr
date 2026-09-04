import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import client, { fileUrl } from "../api/client";

const FALLBACK_LOGO = { IJDSSR: "/logo-ijdssr.svg", JMRH: "/logo-jmrh.svg" };

export default function JournalDetail() {
  const { id } = useParams();
  const [journal, setJournal] = useState(null);
  const [papers, setPapers] = useState([]);

  useEffect(() => {
    client.get(`/journals/${id}`).then(({ data }) => setJournal(data)).catch(() => {});
    client.get("/papers", { params: { journal_id: id } }).then(({ data }) => setPapers(data)).catch(() => {});
  }, [id]);

  if (!journal) return <div className="container py-5">Loading…</div>;

  const logo = journal.logo_path ? fileUrl(journal.logo_path) : FALLBACK_LOGO[journal.short_name] || "/logo-site.svg";

  return (
    <div className="container py-5">
      {/* Journal letterhead: logo + name at the top of every journal page */}
      <div className="d-flex align-items-center border-bottom border-3 pb-3 mb-4" style={{ borderColor: "#C99B3D" }}>
        <img src={logo} onError={(e) => (e.currentTarget.src = "/logo-site.svg")} alt={`${journal.short_name} logo`} height="60" className="me-3" />
        <div>
          <h1 className="brand-font mb-0">{journal.name}</h1>
          <p className="text-muted mb-0">{journal.short_name}{journal.issn ? ` · ISSN ${journal.issn}` : ""}</p>
        </div>
      </div>

      <p className="lead">{journal.description}</p>

      <div className="card-siahssr p-4 mb-4 bg-white">
        <h5 className="brand-font text-gold">Call for Papers — Vol. {journal.current_volume}, Issue {journal.current_issue}</h5>
        <p className="mb-1">{journal.cfp_text}</p>
        {journal.cfp_deadline && <p className="small text-muted mb-0">Deadline: {new Date(journal.cfp_deadline).toLocaleDateString()}</p>}
        <Link to="/register" className="btn btn-navy mt-3 align-self-start">Submit a Paper</Link>
      </div>

      <h4 className="brand-font mb-3">Published Papers</h4>
      {papers.length === 0 && <p className="text-muted">No papers published yet for this journal.</p>}
      <div className="list-group">
        {papers.map((p) => (
          <Link key={p.id} to={`/papers/${p.id}`} className="list-group-item list-group-item-action py-3">
            <div className="fw-semibold">{p.title}</div>
            <div className="small text-muted">{p.author_name} · Vol. {p.volume}, Issue {p.issue}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
