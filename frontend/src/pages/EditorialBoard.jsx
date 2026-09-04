import { useEffect, useState } from "react";
import client, { fileUrl } from "../api/client";

export default function EditorialBoard() {
  const [members, setMembers] = useState([]);

  useEffect(() => {
    client.get("/board").then(({ data }) => setMembers(data)).catch(() => {});
  }, []);

  return (
    <div className="container py-5">
      <h1 className="brand-font mb-4">Editorial Board</h1>
      {members.length === 0 && <p className="text-muted">Board member details will appear here once added.</p>}
      <div className="row g-4">
        {members.map((m) => (
          <div className="col-md-4" key={m.id}>
            <div className="card-siahssr p-3 text-center h-100">
              <img
                src={m.photo_path ? fileUrl(m.photo_path) : "/logo-site.svg"}
                alt={m.name}
                className="rounded-circle mx-auto mb-3"
                style={{ width: 96, height: 96, objectFit: "cover" }}
              />
              <h6 className="fw-bold mb-0">{m.name}</h6>
              <p className="small text-muted mb-1">{m.designation}</p>
              <p className="small mb-1">{m.affiliation}</p>
              {m.expertise && <p className="small text-gold mb-1">{m.expertise}</p>}
              {m.bio && <p className="small">{m.bio}</p>}
              {m.journal_short_name && <span className="badge bg-navy">{m.journal_short_name} Board</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
