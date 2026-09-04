import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import client from "../api/client";

function groupByVolumeIssue(papers) {
  const byJournal = {};
  papers.forEach((p) => {
    const journalKey = p.short_name || "Other";
    byJournal[journalKey] ??= {};
    const volKey = p.volume || "Unspecified Volume";
    byJournal[journalKey][volKey] ??= {};
    const issueKey = p.issue || "Unspecified Issue";
    byJournal[journalKey][volKey][issueKey] ??= [];
    byJournal[journalKey][volKey][issueKey].push(p);
  });
  return byJournal;
}

function PaperCard({ p }) {
  return (
    <div className="card-siahssr p-3 h-100">
      <span className="badge bg-navy mb-2 align-self-start">{p.short_name}</span>
      <h6 className="fw-bold">
        <Link className="text-decoration-none text-dark" to={`/papers/${p.id}`}>{p.title}</Link>
      </h6>
      <p className="small text-muted mb-1">{p.author_name}</p>
      <p className="small mb-0">{p.abstract?.slice(0, 140)}…</p>
    </div>
  );
}

export default function PapersArchive() {
  const [papers, setPapers] = useState([]);
  const [journals, setJournals] = useState([]);
  const [search, setSearch] = useState("");
  const [journalId, setJournalId] = useState("");
  const [mode, setMode] = useState("search"); // "search" | "browse"

  useEffect(() => {
    client.get("/journals").then(({ data }) => setJournals(data)).catch(() => {});
  }, []);

  useEffect(() => {
    const params = {};
    if (search) params.search = search;
    if (journalId) params.journal_id = journalId;
    client.get("/papers", { params }).then(({ data }) => setPapers(data)).catch(() => {});
  }, [search, journalId]);

  const grouped = useMemo(() => groupByVolumeIssue(papers), [papers]);

  return (
    <div className="container py-5">
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-4">
        <h1 className="brand-font mb-0">Papers Archive</h1>
        <div className="btn-group">
          <button className={`btn btn-sm ${mode === "search" ? "btn-navy" : "btn-outline-navy"}`} onClick={() => setMode("search")}>Search</button>
          <button className={`btn btn-sm ${mode === "browse" ? "btn-navy" : "btn-outline-navy"}`} onClick={() => setMode("browse")}>Browse by Volume/Issue</button>
        </div>
      </div>

      <div className="row g-3 mb-4">
        <div className="col-md-8">
          <input
            className="form-control"
            placeholder="Search by title or keyword…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="col-md-4">
          <select className="form-select" value={journalId} onChange={(e) => setJournalId(e.target.value)}>
            <option value="">All Journals</option>
            {journals.map((j) => (
              <option key={j.id} value={j.id}>{j.short_name}</option>
            ))}
          </select>
        </div>
      </div>

      {papers.length === 0 && <p className="text-muted">No published papers found.</p>}

      {mode === "search" && (
        <div className="row g-4">
          {papers.map((p) => (
            <div className="col-md-6" key={p.id}>
              <PaperCard p={p} />
            </div>
          ))}
        </div>
      )}

      {mode === "browse" && (
        <div>
          {Object.entries(grouped).map(([journalName, volumes]) => (
            <div key={journalName} className="mb-5">
              <h3 className="brand-font mb-3">{journalName}</h3>
              {Object.entries(volumes)
                .sort((a, b) => b[0].localeCompare(a[0], undefined, { numeric: true }))
                .map(([volume, issues]) => (
                  <div key={volume} className="mb-4">
                    <h6 className="fw-bold text-gold">Volume {volume}</h6>
                    {Object.entries(issues)
                      .sort((a, b) => b[0].localeCompare(a[0], undefined, { numeric: true }))
                      .map(([issue, list]) => (
                        <div key={issue} className="mb-3 ps-3 border-start border-3" style={{ borderColor: "#e5e0d3" }}>
                          <p className="small text-muted mb-2">Issue {issue} · {list.length} paper{list.length !== 1 ? "s" : ""}</p>
                          <div className="row g-3">
                            {list.map((p) => (
                              <div className="col-md-6" key={p.id}>
                                <PaperCard p={p} />
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                  </div>
                ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
