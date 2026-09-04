import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import client from "../../api/client";
import StatusBadge from "../../components/StatusBadge";

function EditForm({ paper, onDone, onCancel }) {
  const [form, setForm] = useState({ title: paper.title, abstract: paper.abstract, keywords: paper.keywords || "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setSaving(true);
    setError("");
    try {
      await client.put(`/papers/${paper.id}`, form);
      onDone();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to update submission");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card-siahssr p-3 mb-3">
      {error && <div className="alert alert-danger py-2">{error}</div>}
      <div className="mb-2">
        <label className="form-label small text-muted">Title</label>
        <input className="form-control" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
      </div>
      <div className="mb-2">
        <label className="form-label small text-muted">Abstract</label>
        <textarea className="form-control" rows={4} value={form.abstract} onChange={(e) => setForm({ ...form, abstract: e.target.value })} />
      </div>
      <div className="mb-3">
        <label className="form-label small text-muted">Keywords</label>
        <input className="form-control" value={form.keywords} onChange={(e) => setForm({ ...form, keywords: e.target.value })} />
      </div>
      <div className="d-flex gap-2">
        <button className="btn btn-sm btn-navy" disabled={saving} onClick={save}>{saving ? "Saving…" : "Save Changes"}</button>
        <button className="btn btn-sm btn-outline-navy" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

export default function AuthorDashboard() {
  const [papers, setPapers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);

  function load() {
    client.get("/papers/mine").then(({ data }) => setPapers(data)).finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function withdraw(id) {
    const typed = prompt('This withdraws your submission permanently from review. Type "WITHDRAW" to confirm.');
    if (typed !== "WITHDRAW") return;
    await client.patch(`/papers/${id}/withdraw`);
    load();
  }

  return (
    <div className="container py-5">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1 className="brand-font mb-0">My Submissions</h1>
        <Link to="/submit-paper" className="btn btn-navy">Submit New Paper</Link>
      </div>

      {loading && <p>Loading…</p>}
      {!loading && papers.length === 0 && <p className="text-muted">You haven't submitted any papers yet.</p>}

      {papers.map((p) =>
        editingId === p.id ? (
          <EditForm key={p.id} paper={p} onDone={() => { setEditingId(null); load(); }} onCancel={() => setEditingId(null)} />
        ) : null
      )}

      <div className="table-responsive">
        <table className="table align-middle">
          <thead>
            <tr>
              <th>Title</th>
              <th>Journal</th>
              <th>Status</th>
              <th>Submitted</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {papers.map((p) => (
              <tr key={p.id}>
                <td className="fw-semibold">{p.title}</td>
                <td>{p.short_name}</td>
                <td><StatusBadge status={p.status} /></td>
                <td className="small text-muted">{new Date(p.submitted_at).toLocaleDateString()}</td>
                <td className="d-flex gap-1 flex-wrap">
                  {p.receipt_path && (
                    <a href={`${client.defaults.baseURL}/papers/${p.id}/receipt`} target="_blank" rel="noreferrer" className="btn btn-sm btn-outline-navy">
                      Receipt
                    </a>
                  )}
                  {p.status === "submitted" && (
                    <button className="btn btn-sm btn-outline-navy" onClick={() => setEditingId(editingId === p.id ? null : p.id)}>
                      {editingId === p.id ? "Close" : "Edit"}
                    </button>
                  )}
                  {["submitted", "under_review"].includes(p.status) && (
                    <button className="btn btn-sm btn-outline-danger" onClick={() => withdraw(p.id)}>Withdraw</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
