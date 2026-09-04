let currentMode = "search"; // "search" | "browse"
let currentSearch = "";
let currentJournalId = "";

function paperCardHtml(p) {
  return `
    <div class="card-siahssr p-3 h-100">
      <span class="badge bg-navy mb-2 align-self-start">${esc(p.short_name)}</span>
      <h6 class="fw-bold"><a class="text-decoration-none text-dark" href="/paper-detail.html?id=${p.id}">${esc(p.title)}</a></h6>
      <p class="small text-muted mb-1">${esc(p.author_name)}</p>
      <p class="small mb-0">${esc((p.abstract || "").slice(0, 140))}…</p>
    </div>`;
}

function renderSearchView(papers) {
  document.getElementById("search-view").innerHTML = papers.map((p) => `<div class="col-md-6">${paperCardHtml(p)}</div>`).join("");
}

function renderBrowseView(papers) {
  const grouped = groupByVolumeIssue(papers);
  const html = Object.entries(grouped)
    .map(([journalName, volumes]) => {
      const volumesHtml = Object.entries(volumes)
        .sort((a, b) => b[0].localeCompare(a[0], undefined, { numeric: true }))
        .map(([volume, issues]) => {
          const issuesHtml = Object.entries(issues)
            .sort((a, b) => b[0].localeCompare(a[0], undefined, { numeric: true }))
            .map(([issue, list]) => {
              const cards = list.map((p) => `<div class="col-md-6">${paperCardHtml(p)}</div>`).join("");
              return `
              <div class="mb-3 ps-3 border-start border-3" style="border-color:#e5e0d3;">
                <p class="small text-muted mb-2">Issue ${esc(issue)} · ${list.length} paper${list.length !== 1 ? "s" : ""}</p>
                <div class="row g-3">${cards}</div>
              </div>`;
            })
            .join("");
          return `<div class="mb-4"><h6 class="fw-bold text-gold">Volume ${esc(volume)}</h6>${issuesHtml}</div>`;
        })
        .join("");
      return `<div class="mb-5"><h3 class="brand-font mb-3">${esc(journalName)}</h3>${volumesHtml}</div>`;
    })
    .join("");
  document.getElementById("browse-view").innerHTML = html;
}

function setMode(mode) {
  currentMode = mode;
  document.getElementById("mode-search").className = `btn btn-sm ${mode === "search" ? "btn-navy" : "btn-outline-navy"}`;
  document.getElementById("mode-browse").className = `btn btn-sm ${mode === "browse" ? "btn-navy" : "btn-outline-navy"}`;
  document.getElementById("search-view").style.display = mode === "search" ? "" : "none";
  document.getElementById("browse-view").style.display = mode === "browse" ? "" : "none";
}

function loadPapers() {
  const params = {};
  if (currentSearch) params.search = currentSearch;
  if (currentJournalId) params.journal_id = currentJournalId;
  api
    .get("/papers", params)
    .then((papers) => {
      document.getElementById("empty-message").style.display = papers.length === 0 ? "" : "none";
      renderSearchView(papers);
      renderBrowseView(papers);
    })
    .catch(() => {});
}

document.getElementById("mode-search").addEventListener("click", () => setMode("search"));
document.getElementById("mode-browse").addEventListener("click", () => setMode("browse"));
document.getElementById("search-input").addEventListener(
  "input",
  debounce((e) => {
    currentSearch = e.target.value;
    loadPapers();
  }, 300)
);
document.getElementById("journal-filter").addEventListener("change", (e) => {
  currentJournalId = e.target.value;
  loadPapers();
});

api
  .get("/journals")
  .then((journals) => {
    const select = document.getElementById("journal-filter");
    journals.forEach((j) => {
      const opt = document.createElement("option");
      opt.value = j.id;
      opt.textContent = j.short_name;
      select.appendChild(opt);
    });
  })
  .catch(() => {});

const initialSearch = getParam("search");
if (initialSearch) {
  currentSearch = initialSearch;
  document.getElementById("search-input").value = initialSearch;
}

setMode("search");
loadPapers();
