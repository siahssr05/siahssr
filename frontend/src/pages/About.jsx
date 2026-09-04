import { useEffect, useState } from "react";
import client from "../api/client";

export default function About() {
  const [items, setItems] = useState([]);
  const [settings, setSettings] = useState({});
  const [documents, setDocuments] = useState([]);

  useEffect(() => {
    client.get("/public/about-items").then(({ data }) => setItems(data)).catch(() => {});
    client.get("/public/settings").then(({ data }) => setSettings(data)).catch(() => {});
    client.get("/public/documents").then(({ data }) => setDocuments(data)).catch(() => {});
  }, []);

  const coreValues = items.filter((i) => i.section === "core_value");
  const objectives = items.filter((i) => i.section === "objective");
  const mission = items.filter((i) => i.section === "mission");

  return (
    <div className="container py-5">
      <h1 className="brand-font mb-3">About SIAHSSR</h1>
      <p className="lead text-muted">{settings.tagline}</p>

      {settings.vision_text && (
        <div className="card-siahssr p-4 mb-5 bg-navy text-white">
          <h5 className="brand-font text-gold mb-2">Our Vision</h5>
          <p className="mb-0">{settings.vision_text}</p>
        </div>
      )}

      {coreValues.length > 0 && (
        <>
          <h3 className="brand-font mb-3">Core Values</h3>
          <div className="row g-2 mb-5">
            {coreValues.map((v) => (
              <div className="col-md-4 col-6" key={v.id}>
                <div className="card-siahssr p-2 px-3 h-100 d-flex align-items-center">
                  <i className="bi bi-check-circle-fill text-gold me-2" />
                  <span className="small">{v.text}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {mission.length > 0 && (
        <>
          <h3 className="brand-font mb-3">Our Mission</h3>
          <div className="row g-3 mb-5">
            {mission.map((m, i) => (
              <div className="col-md-6" key={m.id}>
                <div className="card-siahssr p-3 d-flex flex-row align-items-start h-100">
                  <span className="badge bg-emerald me-3">{i + 1}</span>
                  <p className="mb-0 small">{m.text}</p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <h3 className="brand-font mb-3">Objectives</h3>
      <div className="row g-3 mb-5">
        {objectives.map((o, i) => (
          <div className="col-md-6" key={o.id}>
            <div className="card-siahssr p-3 d-flex flex-row align-items-start h-100">
              <span className="badge bg-navy me-3">{i + 1}</span>
              <p className="mb-0 small">{o.text}</p>
            </div>
          </div>
        ))}
        {objectives.length === 0 && (
          <p className="text-muted">Objectives will appear here once added by the admin.</p>
        )}
      </div>

      {documents.length > 0 && (
        <>
          <h3 className="brand-font mb-3">Institute Documents</h3>
          <div className="list-group">
            {documents.map((d) => (
              <a
                key={d.id}
                href={`${client.defaults.baseURL}/public/documents/${d.id}/download`}
                className="list-group-item list-group-item-action d-flex justify-content-between align-items-center"
              >
                <span><i className="bi bi-file-earmark-pdf text-gold me-2" />{d.title}</span>
                <i className="bi bi-download" />
              </a>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
