// Board member designation/affiliation/bio are free-text fields the admin
// pastes in from a CV or Word doc, so they often arrive as one long run-on
// string — sometimes with the original line breaks collapsed into runs of
// spaces. To keep this from rendering as one dense paragraph on the public
// page, boardText() escapes the text (same as esc()) and then, cosmetically,
// turns runs of 2+ whitespace characters into line breaks and turns any
// email address into a clickable mailto: link. Nothing here touches the
// stored data — it's display-only formatting.
function boardText(raw) {
  if (!raw) return "";
  let html = esc(raw).trim();
  html = html.replace(/ {2,}/g, "<br>");
  // Only linkify an email that isn't glued directly onto other text — a
  // lookbehind blocks the match from starting mid-word, and a lookahead
  // additionally rejects a match that starts with a run of 4+ digits then a
  // letter (a phone number run straight into an address with no separator,
  // e.g. "Cell:09578779766kannan@..." — the digits aren't part of the real
  // email). Both are display-safety nets: better to leave messy text as
  // plain text than build a wrong mailto link out of it.
  html = html.replace(
    /(?<![A-Za-z0-9._%+-])(?!\d{4,}[A-Za-z])([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/g,
    '<a href="mailto:$1">$1</a>'
  );
  return html;
}

api
  .get("/board")
  .then((members) => {
    if (!members || members.length === 0) return;
    document.getElementById("board-list").innerHTML = members
      .map(
        (m) => `
      <div class="col-md-6 col-lg-6 col-xl-4">
        <div class="card-siahssr p-3 h-100">
          <div class="text-center mb-3">
            <img src="${esc(m.photo_path ? fileUrl(m.photo_path) : "/logo-site.png")}" alt="${esc(m.name)}" class="rounded-circle mx-auto mb-2" style="width:88px;height:88px;object-fit:cover;" />
            <h6 class="fw-bold mb-0">${esc(m.name)}</h6>
            ${m.journal_short_name ? `<span class="badge bg-navy mt-2">${esc(m.journal_short_name)} Board</span>` : ""}
          </div>
          <div class="board-card-details">
            ${m.designation ? `<p class="small text-muted mb-2">${boardText(m.designation)}</p>` : ""}
            ${m.affiliation ? `<p class="small mb-2">${boardText(m.affiliation)}</p>` : ""}
            ${m.expertise ? `<p class="small text-gold mb-2"><strong>Expertise:</strong> ${boardText(m.expertise)}</p>` : ""}
            ${m.bio ? `<p class="small mb-0">${boardText(m.bio)}</p>` : ""}
          </div>
        </div>
      </div>`
      )
      .join("");
  })
  .catch(() => {});
