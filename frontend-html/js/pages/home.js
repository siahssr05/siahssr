api
  .get("/public/settings")
  .then((settings) => {
    if (settings.hero_title) document.getElementById("hero-title").textContent = settings.hero_title;
    const subtitleEl = document.getElementById("hero-subtitle");
    if (subtitleEl) subtitleEl.textContent = settings.hero_subtitle || "";
  })
  .catch(() => {});

api
  .get("/public/stats")
  .then((stats) => {
    document.getElementById("stats-section").style.display = "";
    document.getElementById("stat-published").textContent = stats.total_published;
    document.getElementById("stat-journals").textContent = stats.total_journals;
    document.getElementById("stat-reviewers").textContent = stats.total_reviewers;
    document.getElementById("stat-authors").textContent = stats.total_authors;
    document.getElementById("stat-board").textContent = stats.total_board_members;

    if (stats.latestPapers && stats.latestPapers.length > 0) {
      document.getElementById("latest-section").style.display = "";
      document.getElementById("latest-papers").innerHTML = stats.latestPapers
        .map(
          (p) => `
        <div class="col-md-6">
          <div class="card-siahssr p-3 h-100">
            <span class="badge bg-navy mb-2 align-self-start">${esc(p.short_name)}</span>
            <h6 class="fw-bold"><a class="text-decoration-none text-dark" href="/paper-detail.html?id=${p.id}">${esc(p.title)}</a></h6>
            <p class="small text-muted mb-0">${esc(p.author_name)}</p>
          </div>
        </div>`
        )
        .join("");
    }
  })
  .catch(() => {});

api
  .get("/public/announcements")
  .then((announcements) => {
    if (!announcements || announcements.length === 0) return;
    document.getElementById("announcements-section").style.display = "";
    document.getElementById("announcements-list").innerHTML = announcements
      .map(
        (a) => `
      <div class="border-start border-3 border-warning ps-3 mb-3">
        <h6 class="fw-bold mb-1">${esc(a.title)}</h6>
        <p class="small text-muted mb-0">${esc(a.content)}</p>
      </div>`
      )
      .join("");
  })
  .catch(() => {});

api
  .get("/public/notices")
  .then((notices) => {
    if (!notices || notices.length === 0) return;
    document.getElementById("notice-board").style.display = "";
    document.getElementById("notice-list").innerHTML = notices
      .map(
        (n) => `
      <div class="notice-card mb-3">
        <a href="${esc(n.image_path)}" target="_blank" rel="noopener">
          <img src="${esc(n.image_path)}" alt="${esc(n.title)}" class="notice-card-img" loading="lazy" />
        </a>
        <div class="notice-card-body">
          <p class="notice-card-title mb-1">${esc(n.title)}</p>
          <p class="notice-card-date mb-0">${formatDate(n.created_at)}</p>
        </div>
      </div>`
      )
      .join("");
  })
  .catch(() => {});
