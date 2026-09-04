import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import client, { fileUrl } from "../api/client";

export default function Footer() {
  const [settings, setSettings] = useState({});

  useEffect(() => {
    client.get("/public/settings").then(({ data }) => setSettings(data)).catch(() => {});
  }, []);

  return (
    <footer className="site-footer pt-5 pb-4 mt-5">
      <div className="container">
        <div className="row g-4">
          <div className="col-md-4">
            <img
              src={settings.site_logo ? fileUrl(settings.site_logo) : "/logo-site.svg"}
              onError={(e) => (e.currentTarget.src = "/logo-site.svg")}
              alt="SIAHSSR"
              height="140"
              className="mb-2"
            />
            <p className="small mb-0">{settings.hero_subtitle}</p>
          </div>
          <div className="col-md-4">
            <h6 className="text-gold brand-font">Quick Links</h6>
            <ul className="list-unstyled small">
              <li><Link className="text-decoration-none text-light" to="/journals">Journals</Link></li>
              <li><Link className="text-decoration-none text-light" to="/papers">Papers Archive</Link></li>
              <li><Link className="text-decoration-none text-light" to="/board">Editorial Board</Link></li>
              <li><Link className="text-decoration-none text-light" to="/events">Events</Link></li>
              <li><Link className="text-decoration-none text-light" to="/guidelines">Author Guidelines</Link></li>
              <li><Link className="text-decoration-none text-light" to="/faq">FAQ</Link></li>
            </ul>
          </div>
          <div className="col-md-4">
            <h6 className="text-gold brand-font">Contact</h6>
            <ul className="list-unstyled small">
              <li><i className="bi bi-telephone me-2" />{settings.contact_phone_1}</li>
              <li><i className="bi bi-telephone me-2" />{settings.contact_phone_2}</li>
              <li><i className="bi bi-envelope me-2" />{settings.contact_email}</li>
              <li><i className="bi bi-globe me-2" /><a className="text-light text-decoration-none" href={settings.contact_website} target="_blank" rel="noreferrer">{settings.contact_website}</a></li>
              <li><i className="bi bi-geo-alt me-2" />{settings.contact_address}</li>
            </ul>
          </div>
        </div>
        <hr className="border-secondary mt-4" />
        <p className="small text-center mb-0">&copy; {new Date().getFullYear()} SIAHSSR — All rights reserved.</p>
      </div>
    </footer>
  );
}
