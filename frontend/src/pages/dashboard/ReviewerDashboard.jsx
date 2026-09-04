import { useEffect, useState } from "react";
import client from "../../api/client";
import StatusBadge from "../../components/StatusBadge";

const CRITERIA = [
  { key: "score_originality", label: "Originality" },
  { key: "score_methodology", label: "Methodology" },
  { key: "score_clarity", label: "Clarity" },
  { key: "score_significance", label: "Significance" },
];

function ScoreInput({ value, onChange }) {
  return (
    <select className="form-select form-select-sm" style={{ width: 70 }} value={value ?? ""} onChange={(e) => onChange(e.target.value)}>
      <option value="">–</option>
      {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
    </select>
  );
}

export default function ReviewerDashboard() {
  const [papers, setPapers] = useState([]);
  const [comments, setComments] = useState({});
  const [scores, setScores] = useState({});

  function load() {
    client.get("/papers/assigned").then(({ data }) => setPapers(data)).catch(() => {});
  }
  useEffect(load, []);

  async function respond(id, response) {
    await client.patch(`/papers/${id}/reviewer-response`, { response });
    load();
  }

  async function updateStatus(id, status) {
    const paperScores = scores[id] || {};
    await client.patch(`/papers/${id}/review`, {
      status,
      review_comments: comments[id] || "",
      ...paperScores,
    });
    load();
  }

  function setScore(paperId, key, value) {
    setScores((prev) => ({ ...prev, [paperId]: { ...prev[paperId], [key]: value } }));
  }

  const pending = papers.filter((p) => p.reviewer_status === "pending");
  const active = papers.filter((p) => p.reviewer_status === "accepted");

  return (
    <div className="container py-5">
      <h1 className="brand-font mb-4">Reviewer Dashboard</h1>

      {pending.length > 0 && (
        <>
          <h5 className="brand-font mb-3">Awaiting Your Response</h5>
          {pending.map((p) => (
            <div className="card-siahssr p-4 mb-3" key={p.id}>
              <h6 className="fw-bold">{p.title}</h6>
              <p className="small text-muted">{p.journal_name}</p>
              <p style={{ textAlign: "justify" }}>{p.abstract}</p>
              <div className="d-flex gap-2">
                <button className="btn btn-sm btn-navy" onClick={() => respond(p.id, "accepted")}>Accept Review</button>
                <button className="btn btn-sm btn-outline-danger" onClick={() => respond(p.id, "declined")}>Decline</button>
              </div>
            </div>
          ))}
        </>
      )}

      <h5 className="brand-font mb-3 mt-4">Active Reviews</h5>
      {active.length === 0 && <p className="text-muted">No papers currently in review.</p>}
      {active.map((p) => (
        <div className="card-siahssr p-4 mb-3" key={p.id}>
          <div className="d-flex justify-content-between">
            <h5 className="fw-bold">{p.title}</h5>
            <StatusBadge status={p.status} />
          </div>
          <p className="small text-muted">{p.journal_name}</p>
          <p style={{ textAlign: "justify" }}>{p.abstract}</p>
          <a href={`${client.defaults.baseURL}/papers/${p.id}/download`} className="btn btn-sm btn-outline-navy mb-3" target="_blank" rel="noreferrer">
            Download Paper (.docx)
          </a>

          <div className="row g-2 mb-3">
            {CRITERIA.map((c) => (
              <div className="col-auto d-flex align-items-center gap-2" key={c.key}>
                <label className="small text-muted mb-0">{c.label}</label>
                <ScoreInput
                  value={scores[p.id]?.[c.key] ?? p[c.key]}
                  onChange={(v) => setScore(p.id, c.key, v)}
                />
              </div>
            ))}
          </div>

          <textarea
            className="form-control mb-2"
            placeholder="Review comments…"
            defaultValue={p.review_comments || ""}
            onChange={(e) => setComments({ ...comments, [p.id]: e.target.value })}
          />
          <div className="d-flex gap-2">
            <button className="btn btn-sm btn-navy" onClick={() => updateStatus(p.id, "accepted")}>Accept Paper</button>
            <button className="btn btn-sm btn-outline-navy" onClick={() => updateStatus(p.id, "under_review")}>Save (Keep Under Review)</button>
            <button className="btn btn-sm btn-outline-danger" onClick={() => updateStatus(p.id, "rejected")}>Reject</button>
          </div>
        </div>
      ))}
    </div>
  );
}
