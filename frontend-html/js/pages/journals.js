const FALLBACK_LOGO = { IJDSSR: "/logo-ijdssr.png", JMRH: "/logo-jmrh.svg" };

api
  .get("/journals")
  .then((journals) => {
    // With just one journal live, this "Our Journals" listing page is a
    // redundant extra click before reaching the only thing on it — so skip
    // straight to that journal's own page instead. The moment a second
    // journal exists, there's something to actually choose between, and the
    // listing below renders normally again.
    if (journals.length === 1) {
      window.location.replace(`/journal-detail.html?id=${journals[0].id}`);
      return;
    }
    document.getElementById("journals-list").innerHTML = journals
      .map((j) => {
        const logo = j.logo_path ? fileUrl(j.logo_path) : FALLBACK_LOGO[j.short_name] || "/logo-site.png";
        return `
      <div class="col-md-6">
        <div class="card-siahssr p-4 h-100 d-flex flex-column">
          <div class="journal-logo-frame">
            <img src="${esc(logo)}" alt="${esc(j.short_name)} logo" onerror="this.src='${FALLBACK_LOGO[j.short_name] || "/logo-site.png"}'" />
          </div>
          <h4 class="brand-font">${esc(j.name)}</h4>
          <p class="text-muted small mb-2">${esc(j.short_name)}${j.issn ? ` · ISSN ${esc(j.issn)}` : ""}</p>
          <p>${esc(j.description)}</p>
          <p class="small text-muted"></p>
          <a href="/journal-detail.html?id=${j.id}" class="btn btn-navy mt-2 align-self-start">View Journal</a>
        </div>
      </div>`;
      })
      .join("");
  })
  .catch(() => {})
