import { useEffect, useState } from "react";
import client from "../api/client";

const TYPE_LABELS = {
  conference: "Conference",
  workshop: "Workshop",
  training: "Training Programme",
  seminar: "Seminar",
  other: "Event",
};

const TYPE_BADGE = {
  conference: "bg-navy",
  workshop: "bg-emerald",
  training: "bg-emerald",
  seminar: "bg-navy",
  other: "bg-secondary",
};

export default function Events() {
  const [events, setEvents] = useState([]);

  useEffect(() => {
    client.get("/public/events").then(({ data }) => setEvents(data)).catch(() => {});
  }, []);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const upcoming = events.filter((e) => e.event_date && new Date(e.event_date) >= today);
  const past = events.filter((e) => !e.event_date || new Date(e.event_date) < today);

  function EventCard({ e }) {
    return (
      <div className="card-siahssr p-3 h-100">
        <span className={`badge ${TYPE_BADGE[e.event_type] || "bg-secondary"} mb-2 align-self-start`}>
          {TYPE_LABELS[e.event_type] || "Event"}
        </span>
        <h6 className="fw-bold">{e.title}</h6>
        {e.event_date && (
          <p className="small text-muted mb-1">
            <i className="bi bi-calendar-event me-1" />
            {new Date(e.event_date).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}
          </p>
        )}
        {e.location && (
          <p className="small text-muted mb-1"><i className="bi bi-geo-alt me-1" />{e.location}</p>
        )}
        {e.description && <p className="small mb-0">{e.description}</p>}
      </div>
    );
  }

  return (
    <div className="container py-5">
      <h1 className="brand-font mb-4">Events &amp; News</h1>
      <p className="text-muted mb-5">Conferences, workshops, seminars, and training programmes from the institute.</p>

      {events.length === 0 && <p className="text-muted">No events posted yet.</p>}

      {upcoming.length > 0 && (
        <>
          <h4 className="brand-font mb-3">Upcoming</h4>
          <div className="row g-4 mb-5">
            {upcoming.map((e) => (
              <div className="col-md-6 col-lg-4" key={e.id}><EventCard e={e} /></div>
            ))}
          </div>
        </>
      )}

      {past.length > 0 && (
        <>
          <h4 className="brand-font mb-3">Past &amp; Ongoing</h4>
          <div className="row g-4">
            {past.map((e) => (
              <div className="col-md-6 col-lg-4" key={e.id}><EventCard e={e} /></div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
