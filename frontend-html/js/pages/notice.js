function noticeCardHtml(n) {
  return `
    <div class="col-md-6 col-lg-4">
      <div class="card-siahssr p-3 h-100">
        <a href="${esc(n.image_path)}" target="_blank" rel="noopener">
          <img src="${esc(n.image_path)}" alt="${esc(n.title)}" class="notice-card-img w-100 mb-2" loading="lazy" />
        </a>
        <p class="fw-bold mb-1">${esc(n.title)}</p>
        <p class="small text-muted mb-0">${formatDate(n.created_at)}</p>
      </div>
    </div>`;
}

api
  .get("/public/notices")
  .then((notices) => {
    if (!notices || notices.length === 0) {
      document.getElementById("empty-message").style.display = "";
      return;
    }
    document.getElementById("notice-grid").innerHTML = notices.map(noticeCardHtml).join("");
  })
  .catch(() => {
    document.getElementById("empty-message").textContent = "Failed to load notices.";
    document.getElementById("empty-message").style.display = "";
  });
