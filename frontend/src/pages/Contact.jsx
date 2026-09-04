import { useEffect, useRef, useState } from "react";
import client from "../api/client";
import Captcha from "../components/Captcha";

export default function Contact() {
  const [settings, setSettings] = useState({});
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const captchaRef = useRef(null);

  useEffect(() => {
    client.get("/public/settings").then(({ data }) => setSettings(data)).catch(() => {});
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await client.post("/public/contact", { ...form, ...captchaRef.current.getPayload() });
      setSent(true);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to send your message. Please try again.");
      captchaRef.current.reset();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container py-5" style={{ maxWidth: 900 }}>
      <h1 className="brand-font mb-4">Contact Us</h1>
      <div className="row g-4">
        <div className="col-md-5">
          <div className="card-siahssr p-4 h-100">
            <p><i className="bi bi-telephone me-2 text-gold" />{settings.contact_phone_1}</p>
            <p><i className="bi bi-telephone me-2 text-gold" />{settings.contact_phone_2}</p>
            <p><i className="bi bi-envelope me-2 text-gold" />{settings.contact_email}</p>
            <p><i className="bi bi-globe me-2 text-gold" /><a href={settings.contact_website} target="_blank" rel="noreferrer">{settings.contact_website}</a></p>
            <p className="mb-0"><i className="bi bi-geo-alt me-2 text-gold" />{settings.contact_address}</p>
          </div>
        </div>

        <div className="col-md-7">
          <div className="card-siahssr p-4">
            <h5 className="fw-bold mb-3">Send Us a Message</h5>
            {sent ? (
              <p className="mb-0">Thanks for reaching out — we'll get back to you soon.</p>
            ) : (
              <form onSubmit={handleSubmit}>
                {error && <div className="alert alert-danger">{error}</div>}
                <div className="row g-2">
                  <div className="col-md-6 mb-3">
                    <label className="form-label">Name</label>
                    <input className="form-control" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                  </div>
                  <div className="col-md-6 mb-3">
                    <label className="form-label">Email</label>
                    <input type="email" className="form-control" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                  </div>
                </div>
                <div className="mb-3">
                  <label className="form-label">Subject</label>
                  <input className="form-control" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
                </div>
                <div className="mb-3">
                  <label className="form-label">Message</label>
                  <textarea className="form-control" rows={4} required value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
                </div>
                <Captcha ref={captchaRef} />
                <button className="btn btn-navy" disabled={loading}>{loading ? "Sending…" : "Send Message"}</button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
