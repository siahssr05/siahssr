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

function eventCardHtml(e) {
  return `
    <div class="card-siahssr p-3 h-100">
      <span class="badge ${TYPE_BADGE[e.event_type] || "bg-secondary"} mb-2 align-self-start">${esc(TYPE_LABELS[e.event_type] || "Event")}</span>
      <h6 class="fw-bold">${esc(e.title)}</h6>
      ${e.event_date ? `<p class="small text-muted mb-1"><i class="bi bi-calendar-event me-1"></i>${new Date(e.event_date).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}</p>` : ""}
      ${e.location ? `<p class="small text-muted mb-1"><i class="bi bi-geo-alt me-1"></i>${esc(e.location)}</p>` : ""}
      ${e.description ? `<p class="small mb-0">${esc(e.description)}</p>` : ""}
    </div>`;
}

api
  .get("/public/events")
  .then((events) => {
    if (!events || events.length === 0) {
      document.getElementById("empty-message").style.display = "";
      return;
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const upcoming = events.filter((e) => e.event_date && new Date(e.event_date) >= today);
    const past = events.filter((e) => !e.event_date || new Date(e.event_date) < today);

    if (upcoming.length > 0) {
      document.getElementById("upcoming-block").style.display = "";
      document.getElementById("upcoming-list").innerHTML = upcoming.map((e) => `<div class="col-md-6 col-lg-4">${eventCardHtml(e)}</div>`).join("");
    }
    if (past.length > 0) {
      document.getElementById("past-block").style.display = "";
      document.getElementById("past-list").innerHTML = past.map((e) => `<div class="col-md-6 col-lg-4">${eventCardHtml(e)}</div>`).join("");
    }
  })
  .catch(() => {});
