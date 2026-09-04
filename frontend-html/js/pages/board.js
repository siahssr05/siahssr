api
  .get("/board")
  .then((members) => {
    if (!members || members.length === 0) return;
    document.getElementById("board-list").innerHTML = members
      .map(
        (m) => `
      <div class="col-md-4">
        <div class="card-siahssr p-3 text-center h-100">
          <img src="${esc(m.photo_path ? fileUrl(m.photo_path) : "/logo-site.png")}" alt="${esc(m.name)}" class="rounded-circle mx-auto mb-3" style="width:96px;height:96px;object-fit:cover;" />
          <h6 class="fw-bold mb-0">${esc(m.name)}</h6>
          <p class="small text-muted mb-1">${esc(m.designation)}</p>
          <p class="small mb-1">${esc(m.affiliation)}</p>
          ${m.expertise ? `<p class="small text-gold mb-1">${esc(m.expertise)}</p>` : ""}
          ${m.bio ? `<p class="small">${esc(m.bio)}</p>` : ""}
          ${m.journal_short_name ? `<span class="badge bg-navy">${esc(m.journal_short_name)} Board</span>` : ""}
        </div>
      </div>`
      )
      .join("");
  })
  .catch(() => {});
