import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import client from "../api/client";

export default function Guidelines() {
  const [settings, setSettings] = useState({});

  useEffect(() => {
    client.get("/public/settings").then(({ data }) => setSettings(data)).catch(() => {});
  }, []);

  return (
    <div className="container py-5" style={{ maxWidth: 760 }}>
      <h1 className="brand-font mb-4">Author Guidelines</h1>
      <div className="card-siahssr p-4">
        <p style={{ whiteSpace: "pre-line", textAlign: "justify" }}>{settings.guidelines_text}</p>
      </div>
      <div className="text-center mt-4">
        <Link to="/register" className="btn btn-navy">Create an Author Account</Link>
      </div>
    </div>
  );
}
