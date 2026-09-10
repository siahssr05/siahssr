function apaCitation(paper) {
  const year = paper.published_at ? new Date(paper.published_at).getFullYear() : "n.d.";
  const volIssue = paper.volume ? `, ${paper.volume}${paper.issue ? `(${paper.issue})` : ""}` : "";
  const doi = paper.doi ? ` https://doi.org/${paper.doi}` : "";
  return `${paper.author_name} (${year}). ${paper.title}. ${paper.journal_name}${volIssue}.${doi}`;
}

const paperId = getParam("id");
const content = document.getElementById("paper-content");

if (!paperId) {
  content.innerHTML = `<p class="text-danger">Missing paper id.</p>`;
} else {
  api
    .get(`/papers/${paperId}`)
    .then((paper) => {
      const citation = apaCitation(paper);

      setSEO({
        title: `${paper.title} — SIAHSSR`,
        description: (paper.abstract || "").slice(0, 200),
        jsonLd: {
          "@context": "https://schema.org",
          "@type": "ScholarlyArticle",
          headline: paper.title,
          abstract: paper.abstract,
          author: { "@type": "Person", name: paper.author_name },
          isPartOf: { "@type": "Periodical", name: paper.journal_name, issn: paper.issn || undefined },
          datePublished: paper.published_at || undefined,
          keywords: paper.keywords || undefined,
          ...(paper.doi ? { sameAs: `https://doi.org/${paper.doi}` } : {}),
        },
      });

      const authorLine = [paper.author_designation, paper.author_institute].filter(Boolean).map(esc).join(" · ");

      content.innerHTML = `
        <p class="d-none d-print-block small text-muted mb-4">SIAHSSR — Sai Institute of Arts, Humanities and Social Science Research</p>

        <div class="border-bottom border-3 pb-3 mb-4 d-flex justify-content-between align-items-start" style="border-color:#C99B3D;">
          <div>
            <span class="badge bg-navy mb-2">${esc(paper.short_name)}</span>
            <h4 class="brand-font mb-0">${esc(paper.journal_name)}</h4>
          </div>
          <button class="btn btn-sm btn-outline-navy d-print-none" id="print-paper" title="Print this page">
            <i class="bi bi-printer me-1"></i>Print
          </button>
        </div>

        <h1 class="mb-3" style="font-size:1.6rem;">${esc(paper.title)}</h1>

        <div class="card-siahssr p-3 mb-4 bg-white">
          <p class="fw-semibold mb-1">${esc(paper.author_name)}</p>
          ${authorLine ? `<p class="small text-muted mb-2">${authorLine}</p>` : ""}
          <div class="d-flex flex-wrap gap-3 small text-muted">
            <span><i class="bi bi-journal-bookmark me-1"></i>Vol. ${esc(paper.volume) || "—"}, Issue ${esc(paper.issue) || "—"}</span>
            ${paper.doi ? `<span><i class="bi bi-link-45deg me-1"></i>DOI: ${esc(paper.doi)}</span>` : ""}
            <span><i class="bi bi-calendar3 me-1"></i>Published: ${paper.published_at ? formatDate(paper.published_at) : "—"}</span>
          </div>
        </div>

        <div class="d-flex flex-wrap gap-2 mb-4 d-print-none">
          ${paper.file_path ? `<a href="/api/papers/${paper.id}/download" class="btn btn-navy"><i class="bi bi-download me-1"></i> Download Paper (${(paper.original_filename || paper.file_path).toLowerCase().endsWith(".pdf") ? ".pdf" : ".docx"})</a>` : ""}
        </div>

        <h6 class="fw-bold">Abstract</h6>
        <p style="text-align:justify;">${esc(paper.abstract) || "<span class=\"text-muted\">No abstract available.</span>"}</p>

        ${paper.keywords ? `<h6 class="fw-bold">Keywords</h6><p>${esc(paper.keywords)}</p>` : ""}

        <div class="card-siahssr p-3 mt-4">
          <h6 class="fw-bold mb-2">Cite this paper</h6>
          <p class="small mb-2" style="font-family:monospace;">${esc(citation)}</p>
          <div class="d-flex flex-wrap gap-2 d-print-none">
            <button class="btn btn-sm btn-outline-navy" id="copy-apa"><i class="bi bi-clipboard me-1"></i>Copy APA</button>
            <a class="btn btn-sm btn-outline-navy" href="/api/papers/${paper.id}/citation?format=bibtex">BibTeX</a>
            <a class="btn btn-sm btn-outline-navy" href="/api/papers/${paper.id}/citation?format=ris">RIS</a>
          </div>
        </div>

        <div class="mt-4 d-print-none" id="related-papers-section" style="display:none;">
          <h6 class="fw-bold mb-3">More from ${esc(paper.short_name)}</h6>
          <div class="row g-3" id="related-papers-list"></div>
        </div>
      `;

      document.getElementById("copy-apa").addEventListener("click", (e) => {
        navigator.clipboard?.writeText(citation).then(() => {
          e.target.textContent = "Copied!";
          setTimeout(() => (e.target.innerHTML = '<i class="bi bi-clipboard me-1"></i>Copy APA'), 2000);
        });
      });
      document.getElementById("print-paper").addEventListener("click", () => window.print());

      // Related papers — a few other published papers from the same journal.
      api
        .get("/papers", { journal_id: paper.journal_id })
        .then((papers) => {
          const related = papers.filter((p) => p.id !== paper.id).slice(0, 3);
          if (related.length === 0) return;
          document.getElementById("related-papers-section").style.display = "";
          document.getElementById("related-papers-list").innerHTML = related
            .map(
              (p) => `
            <div class="col-md-4">
              <a href="/paper-detail.html?id=${p.id}" class="card-siahssr p-3 h-100 text-decoration-none text-dark d-block">
                <p class="small text-muted mb-1">${p.published_at ? formatDate(p.published_at) : ""}</p>
                <p class="fw-semibold mb-0" style="font-size:0.92rem;">${esc(p.title)}</p>
              </a>
            </div>`
            )
            .join("");
        })
        .catch(() => {});
    })
    .catch((err) => {
      content.innerHTML = `<p class="text-danger">${esc(err.data?.error || "Failed to load paper")}</p>`;
    });
}
