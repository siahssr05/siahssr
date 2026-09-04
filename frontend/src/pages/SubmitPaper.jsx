import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import client from "../api/client";
import Captcha from "../components/Captcha";

export default function SubmitPaper() {
  const navigate = useNavigate();
  const [journals, setJournals] = useState([]);
  const [form, setForm] = useState({ title: "", abstract: "", keywords: "", journal_id: "" });
  const [file, setFile] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const captchaRef = useRef(null);

  useEffect(() => {
    client.get("/journals").then(({ data }) => setJournals(data)).catch(() => {});
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!file) {
      setError("Please attach your paper as a Word (.docx) file");
      return;
    }
    const isDocxType =
      file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    const isDocxExt = file.name.toLowerCase().endsWith(".docx");
    if (!isDocxType || !isDocxExt) {
      setError("Only Word (.docx) files are allowed");
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setError("File size must be less than 15MB");
      return;
    }
    setLoading(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      const { captchaToken, captchaAnswer } = captchaRef.current.getPayload();
      fd.append("captchaToken", captchaToken);
      fd.append("captchaAnswer", captchaAnswer);
      fd.append("file", file);
      const { data } = await client.post("/papers", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setResult(data);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to submit paper");
      captchaRef.current.reset();
    } finally {
      setLoading(false);
    }
  }

  if (result) {
    return (
      <div className="container py-5 text-center" style={{ maxWidth: 480 }}>
        <h2 className="brand-font mb-3">Submission Received</h2>
        <p>{result.message}</p>
        <a href={`${client.defaults.baseURL}${result.receiptUrl}`} className="btn btn-navy mt-2" target="_blank" rel="noreferrer">
          Download Submission Receipt (PDF)
        </a>
        <div className="mt-3">
          <button className="btn btn-outline-navy" onClick={() => navigate("/dashboard")}>Go to Dashboard</button>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-5" style={{ maxWidth: 640 }}>
      <h1 className="brand-font mb-4">Submit a Paper</h1>
      {error && <div className="alert alert-danger">{error}</div>}
      <form onSubmit={handleSubmit}>
        <div className="mb-3">
          <label className="form-label">Journal</label>
          <select className="form-select" required value={form.journal_id} onChange={(e) => setForm({ ...form, journal_id: e.target.value })}>
            <option value="">Select a journal…</option>
            {journals.map((j) => (
              <option key={j.id} value={j.id}>{j.name} ({j.short_name})</option>
            ))}
          </select>
        </div>
        <div className="mb-3">
          <label className="form-label">Title</label>
          <input className="form-control" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </div>
        <div className="mb-3">
          <label className="form-label">Abstract</label>
          <textarea className="form-control" rows={5} required value={form.abstract} onChange={(e) => setForm({ ...form, abstract: e.target.value })} />
        </div>
        <div className="mb-3">
          <label className="form-label">Keywords (comma separated)</label>
          <input className="form-control" value={form.keywords} onChange={(e) => setForm({ ...form, keywords: e.target.value })} />
        </div>
        <div className="mb-3">
          <label className="form-label">Paper File (Word .docx only, max 15MB)</label>
          <input type="file" accept=".docx" className="form-control" required onChange={(e) => setFile(e.target.files[0])} />
        </div>
        <Captcha ref={captchaRef} />
        <button className="btn btn-navy w-100" disabled={loading}>{loading ? "Submitting…" : "Submit Paper"}</button>
      </form>
    </div>
  );
}
