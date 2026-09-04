import { useEffect, useState } from "react";
import client from "../../api/client";
import StatusBadge from "../../components/StatusBadge";
import { BarChart, LineChart, DonutChart } from "../../components/charts/MiniCharts";

const TABS = [
  "Stats", "Analytics", "Papers", "Journals", "Board", "FAQ", "Events",
  "Users", "Messages", "Site Content", "Audit Log",
];

// Type-to-confirm safeguard for destructive actions — a plain confirm()
// dialog is too easy to click through by habit.
function confirmDestructive(message, expectedWord = "DELETE") {
  const typed = prompt(`${message}\n\nType "${expectedWord}" to confirm.`);
  return typed === expectedWord;
}

function PageControls({ page, pages, onChange }) {
  if (pages <= 1) return null;
  return (
    <div className="d-flex justify-content-center align-items-center gap-3 mt-3">
      <button className="btn btn-sm btn-outline-navy" disabled={page <= 1} onClick={() => onChange(page - 1)}>Previous</button>
      <span className="small text-muted">Page {page} of {pages}</span>
      <button className="btn btn-sm btn-outline-navy" disabled={page >= pages} onClick={() => onChange(page + 1)}>Next</button>
    </div>
  );
}

export default function AdminDashboard() {
  const [tab, setTab] = useState("Stats");

  return (
    <div className="container py-5">
      <h1 className="brand-font mb-4">Admin Dashboard</h1>
      <ul className="nav nav-pills mb-4 flex-wrap gap-2">
        {TABS.map((t) => (
          <li className="nav-item" key={t}>
            <button
              className={`nav-link ${tab === t ? "active bg-navy" : ""}`}
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          </li>
        ))}
      </ul>

      {tab === "Stats" && <StatsPanel />}
      {tab === "Analytics" && <AnalyticsPanel />}
      {tab === "Papers" && <PapersPanel />}
      {tab === "Journals" && <JournalsPanel />}
      {tab === "Board" && <BoardPanel />}
      {tab === "FAQ" && <FaqPanel />}
      {tab === "Events" && <EventsPanel />}
      {tab === "Users" && <UsersPanel />}
      {tab === "Messages" && <MessagesPanel />}
      {tab === "Site Content" && <SiteContentPanel />}
      {tab === "Audit Log" && <AuditLogPanel />}
    </div>
  );
}

// ---------------- ANALYTICS ----------------
function AnalyticsPanel() {
  const [data, setData] = useState(null);
  useEffect(() => {
    client.get("/admin/analytics").then(({ data }) => setData(data)).catch(() => {});
  }, []);
  if (!data) return <p>Loading…</p>;

  return (
    <div className="row g-4">
      <div className="col-md-6">
        <div className="card-siahssr p-4">
          <h6 className="fw-bold mb-3">Submissions per Month (last 12 months)</h6>
          <BarChart data={data.monthlySubmissions} labelKey="month" valueKey="count" />
        </div>
      </div>
      <div className="col-md-6">
        <div className="card-siahssr p-4">
          <h6 className="fw-bold mb-3">Published per Month (last 12 months)</h6>
          <LineChart data={data.monthlyPublished} labelKey="month" valueKey="count" />
        </div>
      </div>
      <div className="col-md-6">
        <div className="card-siahssr p-4">
          <h6 className="fw-bold mb-3">Status Breakdown</h6>
          <DonutChart data={data.statusBreakdown} labelKey="status" valueKey="count" />
        </div>
      </div>
      <div className="col-md-6">
        <div className="card-siahssr p-4">
          <h6 className="fw-bold mb-3">By Journal (total / published)</h6>
          {data.byJournal.map((j) => (
            <div key={j.short_name} className="d-flex justify-content-between border-bottom py-1">
              <span>{j.short_name}</span>
              <span>{j.total} total · {j.published || 0} published</span>
            </div>
          ))}
        </div>
        {data.topReviewers?.length > 0 && (
          <div className="card-siahssr p-4 mt-4">
            <h6 className="fw-bold mb-3">Most Active Reviewers</h6>
            {data.topReviewers.map((r) => (
              <div key={r.name} className="d-flex justify-content-between border-bottom py-1">
                <span>{r.name}</span><span>{r.reviewed_count}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------- EVENTS & NEWS ----------------
function EventsPanel() {
  const [events, setEvents] = useState([]);
  const [form, setForm] = useState({ title: "", description: "", event_type: "conference", event_date: "", location: "" });

  function load() {
    client.get("/admin/events").then(({ data }) => setEvents(data)).catch(() => {});
  }
  useEffect(load, []);

  async function addEvent(e) {
    e.preventDefault();
    if (!form.title.trim()) return;
    await client.post("/admin/events", form);
    setForm({ title: "", description: "", event_type: "conference", event_date: "", location: "" });
    load();
  }

  async function remove(id) {
    if (!confirmDestructive("Delete this event?")) return;
    await client.delete(`/admin/events/${id}`);
    load();
  }

  return (
    <div>
      <form onSubmit={addEvent} className="card-siahssr p-4 mb-4 row g-2">
        <div className="col-md-6"><input className="form-control" placeholder="Title" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
        <div className="col-md-3">
          <select className="form-select" value={form.event_type} onChange={(e) => setForm({ ...form, event_type: e.target.value })}>
            <option value="conference">Conference</option>
            <option value="workshop">Workshop</option>
            <option value="training">Training Programme</option>
            <option value="seminar">Seminar</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div className="col-md-3"><input type="date" className="form-control" value={form.event_date} onChange={(e) => setForm({ ...form, event_date: e.target.value })} /></div>
        <div className="col-md-6"><input className="form-control" placeholder="Location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></div>
        <div className="col-12"><textarea className="form-control" placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
        <div className="col-12"><button className="btn btn-navy">Add Event</button></div>
      </form>
      {events.map((e) => (
        <div className="card-siahssr p-3 mb-2 d-flex flex-row justify-content-between align-items-center" key={e.id}>
          <div>
            <div className="fw-bold">{e.title} <span className="badge bg-navy ms-1">{e.event_type}</span></div>
            <div className="small text-muted">{e.event_date ? new Date(e.event_date).toLocaleDateString() : "No date set"}{e.location ? ` · ${e.location}` : ""}</div>
          </div>
          <button className="btn btn-sm btn-outline-danger" onClick={() => remove(e.id)}>Delete</button>
        </div>
      ))}
    </div>
  );
}

// ---------------- CONTACT MESSAGES ----------------
function MessagesPanel() {
  const [messages, setMessages] = useState([]);

  function load() {
    client.get("/admin/contact-messages").then(({ data }) => setMessages(data)).catch(() => {});
  }
  useEffect(load, []);

  async function toggleRead(id, is_read) {
    await client.patch(`/admin/contact-messages/${id}/read`, { is_read: !is_read });
    load();
  }
  async function remove(id) {
    if (!confirmDestructive("Delete this message?")) return;
    await client.delete(`/admin/contact-messages/${id}`);
    load();
  }

  return (
    <div>
      <div className="d-flex justify-content-end mb-2">
        <a className="btn btn-sm btn-outline-navy" href={`${client.defaults.baseURL}/admin/export/contact-messages.csv`} target="_blank" rel="noreferrer">
          <i className="bi bi-download me-1" />Export CSV
        </a>
      </div>
      {messages.length === 0 && <p className="text-muted">No messages yet.</p>}
      {messages.map((m) => (
        <div className="card-siahssr p-3 mb-2" key={m.id} style={{ opacity: m.is_read ? 0.7 : 1 }}>
          <div className="d-flex justify-content-between flex-wrap">
            <div>
              <strong>{m.subject || "(no subject)"}</strong>
              <span className="small text-muted ms-2">{m.name} &lt;{m.email}&gt;</span>
            </div>
            <div className="d-flex gap-1">
              <button className="btn btn-sm btn-outline-navy" onClick={() => toggleRead(m.id, m.is_read)}>
                {m.is_read ? "Mark Unread" : "Mark Read"}
              </button>
              <button className="btn btn-sm btn-outline-danger" onClick={() => remove(m.id)}>Delete</button>
            </div>
          </div>
          <p className="small mb-0 mt-2">{m.message}</p>
          <p className="small text-muted mb-0 mt-1">{new Date(m.created_at).toLocaleString()}</p>
        </div>
      ))}
    </div>
  );
}

// ---------------- AUDIT LOG ----------------
function AuditLogPanel() {
  const [logs, setLogs] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);

  useEffect(() => {
    client.get("/admin/audit-log", { params: { page } }).then(({ data }) => {
      setLogs(data.rows);
      setPages(data.pages);
    }).catch(() => {});
  }, [page]);

  return (
    <div>
      <div className="table-responsive">
        <table className="table align-middle table-sm">
          <thead><tr><th>When</th><th>Admin</th><th>Action</th><th>Details</th></tr></thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id}>
                <td className="small">{new Date(l.created_at).toLocaleString()}</td>
                <td className="small">{l.admin_name || "—"}</td>
                <td className="small">{l.action}</td>
                <td className="small text-muted" style={{ maxWidth: 320, wordBreak: "break-word" }}>{l.details}</td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr><td colSpan={4} className="text-muted">No actions logged yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <PageControls page={page} pages={pages} onChange={setPage} />
    </div>
  );
}

// ---------------- STATS ----------------
function StatsPanel() {
  const [stats, setStats] = useState(null);
  useEffect(() => {
    client.get("/admin/stats").then(({ data }) => setStats(data)).catch(() => {});
  }, []);
  if (!stats) return <p>Loading…</p>;
  return (
    <div className="row g-4">
      <div className="col-md-4"><div className="card-siahssr p-4 text-center"><h2 className="brand-font">{stats.total_papers}</h2><p className="text-muted mb-0">Total Papers</p></div></div>
      <div className="col-md-4"><div className="card-siahssr p-4 text-center"><h2 className="brand-font">{stats.total_published}</h2><p className="text-muted mb-0">Published</p></div></div>
      <div className="col-md-4"><div className="card-siahssr p-4 text-center"><h2 className="brand-font">{stats.total_users}</h2><p className="text-muted mb-0">Total Users</p></div></div>
      <div className="col-md-6">
        <div className="card-siahssr p-4">
          <h6 className="fw-bold">By Status</h6>
          {stats.statusBreakdown.map((s) => (
            <div key={s.status} className="d-flex justify-content-between border-bottom py-1">
              <StatusBadge status={s.status} /><span>{s.count}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="col-md-6">
        <div className="card-siahssr p-4">
          <h6 className="fw-bold">By Journal</h6>
          {stats.byJournal.map((j) => (
            <div key={j.name} className="d-flex justify-content-between border-bottom py-1">
              <span>{j.name}</span><span>{j.paper_count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------- PAPERS ----------------
const REVIEWER_STATUS_LABEL = { pending: "Awaiting response", accepted: "Accepted", declined: "Declined" };

function PapersPanel() {
  const [papers, setPapers] = useState([]);
  const [reviewers, setReviewers] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);

  function load() {
    client.get("/admin/papers", { params: { page } }).then(({ data }) => {
      setPapers(data.rows);
      setPages(data.pages);
    }).catch(() => {});
    // limit=100 covers realistic reviewer counts for one institute; this dropdown
    // needs the full reviewer list, not just one page of /admin/users.
    client.get("/admin/users", { params: { limit: 100 } }).then(({ data }) => setReviewers(data.rows.filter((u) => u.role === "reviewer"))).catch(() => {});
  }
  useEffect(load, [page]);

  async function assignReviewer(id, reviewer_id) {
    if (!reviewer_id) return;
    await client.patch(`/admin/papers/${id}/assign-reviewer`, { reviewer_id });
    load();
  }

  async function publish(id) {
    const volume = prompt("Volume number:") || "";
    const issue = prompt("Issue number:") || "";
    const doi = prompt("DOI (optional):") || "";
    await client.patch(`/admin/papers/${id}/publish`, { volume, issue, doi });
    load();
  }

  async function remove(id) {
    if (!confirmDestructive("Delete this paper permanently?")) return;
    await client.delete(`/admin/papers/${id}`);
    load();
  }

  return (
    <div>
      <div className="d-flex justify-content-end mb-2">
        <a className="btn btn-sm btn-outline-navy" href={`${client.defaults.baseURL}/admin/export/papers.csv`} target="_blank" rel="noreferrer">
          <i className="bi bi-download me-1" />Export CSV
        </a>
      </div>
      <div className="table-responsive">
        <table className="table align-middle">
          <thead><tr><th>Title</th><th>Author</th><th>Journal</th><th>Status</th><th>Reviewer</th><th>Actions</th></tr></thead>
          <tbody>
            {papers.map((p) => (
              <tr key={p.id}>
                <td className="fw-semibold">{p.title}</td>
                <td>{p.author_name}</td>
                <td>{p.journal_name}</td>
                <td><StatusBadge status={p.status} /></td>
                <td>
                  <select className="form-select form-select-sm" defaultValue="" onChange={(e) => assignReviewer(p.id, e.target.value)}>
                    <option value="">{p.reviewer_id ? "Reassign…" : "Assign…"}</option>
                    {reviewers.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                  {p.reviewer_status && (
                    <div className="small text-muted mt-1">{REVIEWER_STATUS_LABEL[p.reviewer_status] || p.reviewer_status}</div>
                  )}
                </td>
                <td className="d-flex gap-1">
                  <a className="btn btn-sm btn-outline-navy" href={`${client.defaults.baseURL}/papers/${p.id}/download`} target="_blank" rel="noreferrer">.docx</a>
                  <button className="btn btn-sm btn-navy" onClick={() => publish(p.id)}>Publish</button>
                  <button className="btn btn-sm btn-outline-danger" onClick={() => remove(p.id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <PageControls page={page} pages={pages} onChange={setPage} />
    </div>
  );
}

// ---------------- JOURNALS ----------------
const FALLBACK_LOGO = { IJDSSR: "/logo-ijdssr.svg", JMRH: "/logo-jmrh.svg" };

function JournalsPanel() {
  const [journals, setJournals] = useState([]);
  const [form, setForm] = useState({ name: "", short_name: "", description: "", cfp_text: "" });

  function load() {
    client.get("/journals").then(({ data }) => setJournals(data)).catch(() => {});
  }
  useEffect(load, []);

  async function createJournal(e) {
    e.preventDefault();
    await client.post("/journals", form);
    setForm({ name: "", short_name: "", description: "", cfp_text: "" });
    load();
  }

  async function uploadLogo(id, file) {
    const fd = new FormData();
    fd.append("logo", file);
    await client.post(`/journals/${id}/logo`, fd, { headers: { "Content-Type": "multipart/form-data" } });
    load();
  }

  return (
    <div>
      <div className="card-siahssr p-4 mb-4">
        <h6 className="fw-bold mb-3">Add Journal</h6>
        <form onSubmit={createJournal} className="row g-2">
          <div className="col-md-6"><input className="form-control" placeholder="Full name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div className="col-md-2"><input className="form-control" placeholder="Short name" required value={form.short_name} onChange={(e) => setForm({ ...form, short_name: e.target.value })} /></div>
          <div className="col-md-4"><input className="form-control" placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div className="col-12"><button className="btn btn-navy">Add Journal</button></div>
        </form>
      </div>

      {journals.map((j) => (
        <div className="card-siahssr p-3 mb-3 d-flex flex-row align-items-center gap-3" key={j.id}>
          <img src={j.logo_path ? `${client.defaults.baseURL.replace("/api", "")}${j.logo_path}` : (FALLBACK_LOGO[j.short_name] || "/logo-site.svg")} height="40" alt="" />
          <div className="flex-grow-1">
            <div className="fw-bold">{j.name}</div>
            <div className="small text-muted">{j.short_name} · Vol {j.current_volume}, Issue {j.current_issue}</div>
          </div>
          <label className="btn btn-sm btn-outline-navy mb-0">
            Change Logo
            <input type="file" accept="image/*" hidden onChange={(e) => uploadLogo(j.id, e.target.files[0])} />
          </label>
        </div>
      ))}
    </div>
  );
}

// ---------------- EDITORIAL BOARD ----------------
function BoardPanel() {
  const [members, setMembers] = useState([]);
  const [form, setForm] = useState({ name: "", designation: "", affiliation: "", bio: "", expertise: "" });
  const [photo, setPhoto] = useState(null);

  function load() {
    client.get("/board").then(({ data }) => setMembers(data)).catch(() => {});
  }
  useEffect(load, []);

  async function addMember(e) {
    e.preventDefault();
    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => fd.append(k, v));
    if (photo) fd.append("photo", photo);
    await client.post("/board", fd, { headers: { "Content-Type": "multipart/form-data" } });
    setForm({ name: "", designation: "", affiliation: "", bio: "", expertise: "" });
    setPhoto(null);
    load();
  }

  async function remove(id) {
    if (!confirm("Remove this board member?")) return;
    await client.delete(`/board/${id}`);
    load();
  }

  return (
    <div>
      <div className="card-siahssr p-4 mb-4">
        <h6 className="fw-bold mb-3">Add Board Member</h6>
        <form onSubmit={addMember} className="row g-2">
          <div className="col-md-4"><input className="form-control" placeholder="Name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div className="col-md-4"><input className="form-control" placeholder="Designation" value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} /></div>
          <div className="col-md-4"><input className="form-control" placeholder="Affiliation" value={form.affiliation} onChange={(e) => setForm({ ...form, affiliation: e.target.value })} /></div>
          <div className="col-md-8"><input className="form-control" placeholder="Expertise" value={form.expertise} onChange={(e) => setForm({ ...form, expertise: e.target.value })} /></div>
          <div className="col-md-4"><input type="file" accept="image/*" className="form-control" onChange={(e) => setPhoto(e.target.files[0])} /></div>
          <div className="col-12"><button className="btn btn-navy">Add Member</button></div>
        </form>
      </div>
      {members.map((m) => (
        <div className="card-siahssr p-3 mb-2 d-flex flex-row align-items-center gap-3" key={m.id}>
          <div className="flex-grow-1">
            <div className="fw-bold">{m.name}</div>
            <div className="small text-muted">{m.designation} — {m.affiliation}</div>
          </div>
          <button className="btn btn-sm btn-outline-danger" onClick={() => remove(m.id)}>Remove</button>
        </div>
      ))}
    </div>
  );
}

// ---------------- FAQ ----------------
function FaqPanel() {
  const [faqs, setFaqs] = useState([]);
  const [form, setForm] = useState({ question: "", answer: "", category: "general" });

  function load() {
    client.get("/faq").then(({ data }) => setFaqs(data)).catch(() => {});
  }
  useEffect(load, []);

  async function addFaq(e) {
    e.preventDefault();
    await client.post("/faq", form);
    setForm({ question: "", answer: "", category: "general" });
    load();
  }

  async function remove(id) {
    await client.delete(`/faq/${id}`);
    load();
  }

  return (
    <div>
      <form onSubmit={addFaq} className="card-siahssr p-4 mb-4 row g-2">
        <div className="col-md-6"><input className="form-control" placeholder="Question" required value={form.question} onChange={(e) => setForm({ ...form, question: e.target.value })} /></div>
        <div className="col-md-6"><input className="form-control" placeholder="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></div>
        <div className="col-12"><textarea className="form-control" placeholder="Answer" required value={form.answer} onChange={(e) => setForm({ ...form, answer: e.target.value })} /></div>
        <div className="col-12"><button className="btn btn-navy">Add FAQ</button></div>
      </form>
      {faqs.map((f) => (
        <div className="card-siahssr p-3 mb-2" key={f.id}>
          <div className="d-flex justify-content-between">
            <strong>{f.question}</strong>
            <button className="btn btn-sm btn-outline-danger" onClick={() => remove(f.id)}>Delete</button>
          </div>
          <p className="small text-muted mb-0">{f.answer}</p>
        </div>
      ))}
    </div>
  );
}

// ---------------- USERS ----------------
function UsersPanel() {
  const [users, setUsers] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);

  function load() {
    client.get("/admin/users", { params: { page } }).then(({ data }) => {
      setUsers(data.rows);
      setPages(data.pages);
    }).catch(() => {});
  }
  useEffect(load, [page]);

  async function changeRole(id, role) {
    await client.patch(`/admin/users/${id}/role`, { role });
    load();
  }
  async function remove(id, name) {
    if (!confirmDestructive(`Delete user "${name}"? This also deletes their papers.`)) return;
    await client.delete(`/admin/users/${id}`);
    load();
  }

  return (
    <div>
      <div className="d-flex justify-content-end mb-2">
        <a className="btn btn-sm btn-outline-navy" href={`${client.defaults.baseURL}/admin/export/users.csv`} target="_blank" rel="noreferrer">
          <i className="bi bi-download me-1" />Export CSV
        </a>
      </div>
      <div className="table-responsive">
        <table className="table align-middle">
          <thead><tr><th>Name</th><th>Email</th><th>ORCID</th><th>Role</th><th>Verified</th><th>Last Login</th><th></th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.name}</td>
                <td>{u.email}</td>
                <td className="small text-muted">{u.orcid || "—"}</td>
                <td>
                  <select className="form-select form-select-sm" value={u.role} onChange={(e) => changeRole(u.id, e.target.value)}>
                    <option value="author">Author</option>
                    <option value="reviewer">Reviewer</option>
                    <option value="admin">Admin</option>
                  </select>
                </td>
                <td>{u.is_verified ? "Yes" : "No"}</td>
                <td className="small text-muted">{u.last_login ? new Date(u.last_login).toLocaleString() : "Never"}</td>
                <td><button className="btn btn-sm btn-outline-danger" onClick={() => remove(u.id, u.name)}>Delete</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <PageControls page={page} pages={pages} onChange={setPage} />
    </div>
  );
}

// ---------------- SITE CONTENT (settings, logo, about-items, documents, announcements) ----------------
function SiteContentPanel() {
  const [settings, setSettings] = useState({});
  const [aboutItems, setAboutItems] = useState([]);
  const [newItem, setNewItem] = useState({ core_value: "", objective: "", mission: "" });
  const [announcements, setAnnouncements] = useState([]);
  const [newAnnouncement, setNewAnnouncement] = useState({ title: "", content: "" });
  const [documents, setDocuments] = useState([]);
  const [docForm, setDocForm] = useState({ title: "", category: "institute" });
  const [docFile, setDocFile] = useState(null);

  function load() {
    client.get("/admin/settings").then(({ data }) => setSettings(data)).catch(() => {});
    client.get("/admin/about-items").then(({ data }) => setAboutItems(data)).catch(() => {});
    client.get("/admin/announcements").then(({ data }) => setAnnouncements(data)).catch(() => {});
    client.get("/admin/documents").then(({ data }) => setDocuments(data)).catch(() => {});
  }
  useEffect(load, []);

  async function saveSettings(e) {
    e.preventDefault();
    await client.put("/admin/settings", settings);
    alert("Settings saved");
  }

  async function uploadSiteLogo(file) {
    const fd = new FormData();
    fd.append("logo", file);
    await client.post("/admin/settings/logo", fd, { headers: { "Content-Type": "multipart/form-data" } });
    load();
  }

  async function addItem(section) {
    const text = newItem[section];
    if (!text || !text.trim()) return;
    const count = aboutItems.filter((i) => i.section === section).length;
    await client.post("/admin/about-items", { section, text, sort_order: count });
    setNewItem({ ...newItem, [section]: "" });
    load();
  }
  async function removeItem(id) {
    await client.delete(`/admin/about-items/${id}`);
    load();
  }

  async function addAnnouncement(e) {
    e.preventDefault();
    if (!newAnnouncement.title.trim()) return;
    await client.post("/admin/announcements", newAnnouncement);
    setNewAnnouncement({ title: "", content: "" });
    load();
  }
  async function removeAnnouncement(id) {
    await client.delete(`/admin/announcements/${id}`);
    load();
  }

  async function uploadDocument(e) {
    e.preventDefault();
    if (!docForm.title || !docFile) return;
    const fd = new FormData();
    fd.append("title", docForm.title);
    fd.append("category", docForm.category);
    fd.append("file", docFile);
    await client.post("/admin/documents", fd, { headers: { "Content-Type": "multipart/form-data" } });
    setDocForm({ title: "", category: "institute" });
    setDocFile(null);
    load();
  }
  async function removeDocument(id) {
    await client.delete(`/admin/documents/${id}`);
    load();
  }

  function itemsFor(section) {
    return aboutItems.filter((i) => i.section === section);
  }

  const SECTION_LABELS = { core_value: "Core Values", objective: "Objectives", mission: "Mission" };

  return (
    <div className="row g-4">
      <div className="col-md-6">
        <div className="card-siahssr p-4">
          <h6 className="fw-bold mb-3">Navbar Logo</h6>
          <input type="file" accept="image/*" className="form-control" onChange={(e) => uploadSiteLogo(e.target.files[0])} />
        </div>

        <form onSubmit={saveSettings} className="card-siahssr p-4 mt-4">
          <h6 className="fw-bold mb-3">Homepage, Vision & Contact Text</h6>
          {["hero_title", "tagline", "vision_text", "guidelines_text", "contact_phone_1", "contact_phone_2", "contact_email", "contact_website", "contact_address"].map((key) => (
            <div className="mb-2" key={key}>
              <label className="form-label small text-muted">{key.replace(/_/g, " ")}</label>
              {key === "vision_text" || key === "guidelines_text" ? (
                <textarea
                  className="form-control form-control-sm"
                  rows={3}
                  value={settings[key] || ""}
                  onChange={(e) => setSettings({ ...settings, [key]: e.target.value })}
                />
              ) : (
                <input
                  className="form-control form-control-sm"
                  value={settings[key] || ""}
                  onChange={(e) => setSettings({ ...settings, [key]: e.target.value })}
                />
              )}
            </div>
          ))}
          <button className="btn btn-navy mt-2">Save Settings</button>
        </form>

        <div className="card-siahssr p-4 mt-4">
          <h6 className="fw-bold mb-3">Institute Documents</h6>
          <form onSubmit={uploadDocument} className="mb-3">
            <input className="form-control form-control-sm mb-2" placeholder="Document title" value={docForm.title} onChange={(e) => setDocForm({ ...docForm, title: e.target.value })} />
            <input type="file" accept=".pdf,.doc,.docx" className="form-control form-control-sm mb-2" onChange={(e) => setDocFile(e.target.files[0])} />
            <button className="btn btn-sm btn-navy">Upload Document</button>
          </form>
          {documents.map((d) => (
            <div key={d.id} className="d-flex justify-content-between border-bottom py-1">
              <span className="small">{d.title}</span>
              <button className="btn btn-sm btn-outline-danger" onClick={() => removeDocument(d.id)}>×</button>
            </div>
          ))}
        </div>
      </div>

      <div className="col-md-6">
        {["core_value", "objective", "mission"].map((section) => (
          <div className="card-siahssr p-4 mb-4" key={section}>
            <h6 className="fw-bold mb-3">{SECTION_LABELS[section]}</h6>
            <div className="d-flex gap-2 mb-3">
              <input
                className="form-control"
                placeholder={`New ${SECTION_LABELS[section].toLowerCase().slice(0, -1)}…`}
                value={newItem[section]}
                onChange={(e) => setNewItem({ ...newItem, [section]: e.target.value })}
              />
              <button className="btn btn-navy" onClick={() => addItem(section)}>Add</button>
            </div>
            <div style={{ maxHeight: 180, overflowY: "auto" }}>
              {itemsFor(section).map((o) => (
                <div key={o.id} className="d-flex justify-content-between border-bottom py-1">
                  <span className="small">{o.text}</span>
                  <button className="btn btn-sm btn-outline-danger" onClick={() => removeItem(o.id)}>×</button>
                </div>
              ))}
            </div>
          </div>
        ))}

        <div className="card-siahssr p-4">
          <h6 className="fw-bold mb-3">Announcements</h6>
          <form onSubmit={addAnnouncement} className="mb-3">
            <input className="form-control mb-2" placeholder="Title" value={newAnnouncement.title} onChange={(e) => setNewAnnouncement({ ...newAnnouncement, title: e.target.value })} />
            <textarea className="form-control mb-2" placeholder="Content" value={newAnnouncement.content} onChange={(e) => setNewAnnouncement({ ...newAnnouncement, content: e.target.value })} />
            <button className="btn btn-navy">Add Announcement</button>
          </form>
          {announcements.map((a) => (
            <div key={a.id} className="d-flex justify-content-between border-bottom py-1">
              <span className="small fw-semibold">{a.title}</span>
              <button className="btn btn-sm btn-outline-danger" onClick={() => removeAnnouncement(a.id)}>×</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
