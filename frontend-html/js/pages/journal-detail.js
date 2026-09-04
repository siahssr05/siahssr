const FALLBACK_LOGO = { IJDSSR: "/logo-ijdssr.png", JMRH: "/logo-jmrh.svg" };
const journalId = getParam("id");
const content = document.getElementById("journal-content");

if (!journalId) {
  content.innerHTML = `<p class="text-danger">Missing journal id.</p>`;
} else {
  Promise.all([api.get(`/journals/${journalId}`), api.get("/papers", { journal_id: journalId })])
    .then(([journal, papers]) => {
      const logo = journal.logo_path ? fileUrl(journal.logo_path) : FALLBACK_LOGO[journal.short_name] || "/logo-site.png";
      document.title = `${journal.name} — SIAHSSR`;

      const papersHtml =
        papers.length === 0
          ? `<p class="text-muted">No papers published yet for this journal.</p>`
          : papers
              .map(
                (p) => `
        <a href="/paper-detail.html?id=${p.id}" class="list-group-item list-group-item-action py-3">
          <div class="fw-semibold">${esc(p.title)}</div>
          <div class="small text-muted">${esc(p.author_name)} · Vol. ${esc(p.volume)}, Issue ${esc(p.issue)}</div>
        </a>`
              )
              .join("");

      content.innerHTML = `
        <div class="d-flex align-items-center border-bottom border-3 pb-3 mb-4" style="border-color:#C99B3D;">
          <div class="journal-logo-frame-sm me-3">
            <img src="${esc(logo)}" alt="${esc(journal.short_name)} logo" onerror="this.src='/logo-site.png'" />
          </div>
          <div>
            <h1 class="brand-font mb-0">${esc(journal.name)}</h1>
            <p class="text-muted mb-0">${esc(journal.short_name)}${journal.issn ? ` · ISSN ${esc(journal.issn)}` : ""}</p>
          </div>
        </div>

        <p class="lead">${esc(journal.description)}</p>

        <div class="card-siahssr p-4 mb-4 bg-white">
          <h5 class="brand-font text-gold">Call for Papers </h5>
          <p class="mb-1">${esc(journal.cfp_text)}</p>
          ${journal.cfp_deadline ? `<p class="small text-muted mb-0">Deadline: ${formatDate(journal.cfp_deadline)}</p>` : ""}
          <a href="/submit-paper.html" class="btn btn-navy mt-3 align-self-start">Submit a Paper</a>
        </div>

        <h4 class="brand-font mb-3">Published Papers</h4>
        <div class="list-group">${papersHtml}</div>
      `;
    })
    .catch(() => {
      content.innerHTML = `<p class="text-danger">Journal not found.</p>`;
    });
}
