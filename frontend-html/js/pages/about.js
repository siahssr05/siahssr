api
  .get("/public/settings")
  .then((settings) => {
    document.getElementById("about-tagline").textContent = settings.tagline || "";
    if (settings.vision_text) {
      document.getElementById("vision-block").style.display = "";
      document.getElementById("vision-text").textContent = settings.vision_text;
    }
  })
  .catch(() => {});

api
  .get("/public/about-items")
  .then((items) => {
    const coreValues = items.filter((i) => i.section === "core_value");
    const objectives = items.filter((i) => i.section === "objective");
    const mission = items.filter((i) => i.section === "mission");

    if (coreValues.length > 0) {
      document.getElementById("core-values-block").style.display = "";
      document.getElementById("core-values-list").innerHTML = coreValues
        .map(
          (v) => `
        <div class="col-md-4 col-6">
          <div class="card-siahssr p-2 px-3 h-100 d-flex align-items-center">
            <i class="bi bi-check-circle-fill text-gold me-2"></i>
            <span class="small">${esc(v.text)}</span>
          </div>
        </div>`
        )
        .join("");
    }

    if (mission.length > 0) {
      document.getElementById("mission-block").style.display = "";
      document.getElementById("mission-list").innerHTML = mission
        .map(
          (m, i) => `
        <div class="col-md-6">
          <div class="card-siahssr p-3 d-flex flex-row align-items-start h-100">
            <span class="badge bg-emerald me-3">${i + 1}</span>
            <p class="mb-0 small">${esc(m.text)}</p>
          </div>
        </div>`
        )
        .join("");
    }

    const objectivesList = document.getElementById("objectives-list");
    if (objectives.length > 0) {
      objectivesList.innerHTML = objectives
        .map(
          (o, i) => `
        <div class="col-md-6">
          <div class="card-siahssr p-3 d-flex flex-row align-items-start h-100">
            <span class="badge bg-navy me-3">${i + 1}</span>
            <p class="mb-0 small">${esc(o.text)}</p>
          </div>
        </div>`
        )
        .join("");
    }
  })
  .catch(() => {});

api
  .get("/public/documents")
  .then((documents) => {
    if (!documents || documents.length === 0) return;
    document.getElementById("documents-block").style.display = "";
    document.getElementById("documents-list").innerHTML = documents
      .map(
        (d) => `
      <a href="/api/public/documents/${d.id}/download" class="list-group-item list-group-item-action d-flex justify-content-between align-items-center">
        <span><i class="bi bi-file-earmark-word text-gold me-2"></i>${esc(d.title)}</span>
        <i class="bi bi-download"></i>
      </a>`
      )
      .join("");
  })
  .catch(() => {});
