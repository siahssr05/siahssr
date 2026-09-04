import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import client, { fileUrl } from "../api/client";

const FALLBACK_LOGO = { IJDSSR: "/logo-ijdssr.svg", JMRH: "/logo-jmrh.svg" };

export default function Journals() {
  const [journals, setJournals] = useState([]);

  useEffect(() => {
    client.get("/journals").then(({ data }) => setJournals(data)).catch(() => {});
  }, []);

  return (
    <div className="container py-5">
      <h1 className="brand-font mb-4">Our Journals</h1>
      <div className="row g-4">
        {journals.map((j) => (
          <div className="col-md-6" key={j.id}>
            <div className="card-siahssr p-4 h-100">
              <img
                src={j.logo_path ? fileUrl(j.logo_path) : FALLBACK_LOGO[j.short_name] || "/logo-site.svg"}
                onError={(e) => (e.currentTarget.src = FALLBACK_LOGO[j.short_name] || "/logo-site.svg")}
                alt={`${j.short_name} logo`}
                height="56"
                className="mb-3"
              />
              <h4 className="brand-font">{j.name}</h4>
              <p className="text-muted small mb-2">{j.short_name}{j.issn ? ` · ISSN ${j.issn}` : ""}</p>
              <p>{j.description}</p>
              <p className="small text-muted">Current: Vol. {j.current_volume}, Issue {j.current_issue}</p>
              <Link to={`/journals/${j.id}`} className="btn btn-navy mt-2 align-self-start">
                View Journal
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
