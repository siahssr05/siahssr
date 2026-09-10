// Vanilla-JS port of the React build's dashboard/AdminDashboard.jsx.
// Each tab is fetched and rendered fresh whenever it's activated, matching
// the React version's "only the mounted tab fetches" behavior. Pagination
// state for Papers/Users/Audit Log lives in the closures below.

const adminUser = requireRole(["admin"]);

if (adminUser) {
  const TABS = ["Stats", "Analytics", "Submissions", "Papers", "Journals", "Board", "FAQ", "Events", "Notices", "Users", "Messages", "Site Content", "Audit Log"];
  const navEl = document.getElementById("admin-tab-nav");
  const contentEl = document.getElementById("admin-tab-content");
  let currentTab = "Stats";

  const SUBMISSION_STATUS_LABEL = { new: "New", reviewed: "Reviewed", published: "Published", rejected: "Rejected" };

  function renderTabNav() {
    navEl.innerHTML = TABS.map(
      (t) => `<li class="nav-item"><button class="nav-link ${t === currentTab ? "active bg-navy" : ""}" data-tab="${esc(t)}">${esc(t)}</button></li>`
    ).join("");
    navEl.querySelectorAll("[data-tab]").forEach((btn) => {
      btn.addEventListener("click", () => switchTab(btn.getAttribute("data-tab")));
    });
  }

  function switchTab(tab) {
    currentTab = tab;
    renderTabNav();
    renderCurrentTab();
  }

  function renderCurrentTab() {
    contentEl.innerHTML = `<p class="page-loading">Loading…</p>`;
    switch (currentTab) {
      case "Stats": return renderStatsTab();
      case "Analytics": return renderAnalyticsTab();
      case "Submissions": return renderSubmissionsTab(1);
      case "Papers": return renderPapersTab(1);
      case "Journals": return renderJournalsTab();
      case "Board": return renderBoardTab();
      case "FAQ": return renderFaqTab();
      case "Events": return renderEventsTab();
      case "Notices": return renderNoticesTab();
      case "Users": return renderUsersTab(1);
      case "Messages": return renderMessagesTab();
      case "Site Content": return renderSiteContentTab();
      case "Audit Log": return renderAuditLogTab(1);
    }
  }

  // ---------------- STATS ----------------
  function renderStatsTab() {
    api
      .get("/admin/stats")
      .then((stats) => {
        contentEl.innerHTML = `
          <div class="row g-4">
            <div class="col-md-4"><div class="card-siahssr p-4 text-center"><h2 class="brand-font">${stats.total_papers}</h2><p class="text-muted mb-0">Total Papers</p></div></div>
            <div class="col-md-4"><div class="card-siahssr p-4 text-center"><h2 class="brand-font">${stats.total_published}</h2><p class="text-muted mb-0">Published</p></div></div>
            <div class="col-md-4"><div class="card-siahssr p-4 text-center"><h2 class="brand-font">${stats.total_users}</h2><p class="text-muted mb-0">Total Users</p></div></div>
            <div class="col-md-6">
              <div class="card-siahssr p-4">
                <h6 class="fw-bold">By Status</h6>
                ${stats.statusBreakdown.map((s) => `<div class="d-flex justify-content-between border-bottom py-1">${statusBadgeHtml(s.status)}<span>${s.count}</span></div>`).join("")}
              </div>
            </div>
            <div class="col-md-6">
              <div class="card-siahssr p-4">
                <h6 class="fw-bold">By Journal</h6>
                ${stats.byJournal.map((j) => `<div class="d-flex justify-content-between border-bottom py-1"><span>${esc(j.name)}</span><span>${j.paper_count}</span></div>`).join("")}
              </div>
            </div>
          </div>`;
      })
      .catch(() => {
        contentEl.innerHTML = `<p class="text-danger">Failed to load stats.</p>`;
      });
  }

  // ---------------- ANALYTICS ----------------
  function renderAnalyticsTab() {
    api
      .get("/admin/analytics")
      .then((data) => {
        contentEl.innerHTML = `
          <div class="row g-4">
            <div class="col-md-6"><div class="card-siahssr p-4"><h6 class="fw-bold mb-3">Submissions per Month (last 12 months)</h6><div id="chart-submissions"></div></div></div>
            <div class="col-md-6"><div class="card-siahssr p-4"><h6 class="fw-bold mb-3">Published per Month (last 12 months)</h6><div id="chart-published"></div></div></div>
            <div class="col-md-6"><div class="card-siahssr p-4"><h6 class="fw-bold mb-3">Status Breakdown</h6><div id="chart-status"></div></div></div>
            <div class="col-md-6">
              <div class="card-siahssr p-4">
                <h6 class="fw-bold mb-3">By Journal (total / published)</h6>
                ${data.byJournal.map((j) => `<div class="d-flex justify-content-between border-bottom py-1"><span>${esc(j.short_name)}</span><span>${j.total} total · ${j.published || 0} published</span></div>`).join("")}
              </div>
              ${
                data.topReviewers && data.topReviewers.length > 0
                  ? `<div class="card-siahssr p-4 mt-4"><h6 class="fw-bold mb-3">Most Active Reviewers</h6>${data.topReviewers
                      .map((r) => `<div class="d-flex justify-content-between border-bottom py-1"><span>${esc(r.name)}</span><span>${r.reviewed_count}</span></div>`)
                      .join("")}</div>`
                  : ""
              }
            </div>
          </div>`;
        document.getElementById("chart-submissions").innerHTML = renderBarChart(data.monthlySubmissions, "month", "count");
        document.getElementById("chart-published").innerHTML = renderLineChart(data.monthlyPublished, "month", "count");
        document.getElementById("chart-status").innerHTML = renderDonutChart(data.statusBreakdown, "status", "count");
      })
      .catch(() => {
        contentEl.innerHTML = `<p class="text-danger">Failed to load analytics.</p>`;
      });
  }

  // ---------------- SUBMISSIONS (public pay-then-submit paper flow) ----------------
  function renderSubmissionsTab(page, statusFilter = "") {
    Promise.all([api.get("/admin/submissions", { page, status: statusFilter || undefined }), api.get("/journals")])
      .then(([subsRes, journals]) => {
        const journalOptions = (selectedId) =>
          journals.map((j) => `<option value="${j.id}" ${String(j.id) === String(selectedId) ? "selected" : ""}>${esc(j.name)} (${esc(j.short_name)})</option>`).join("");

        const rows = subsRes.rows
          .map((s) => {
            const canPublish = s.status !== "published";
            return `
          <tr>
            <td>
              <div class="fw-semibold">${esc(s.title)}</div>
              <div class="small text-muted">${esc(s.author_name)} · ${esc(s.email)}</div>
            </td>
            <td class="small">${esc(s.journal_name || "—")}</td>
            <td class="small" style="font-family:monospace;">${esc(s.payment_reference || "—")}</td>
            <td>
              <select class="form-select form-select-sm" data-sub-status="${s.id}">
                ${Object.entries(SUBMISSION_STATUS_LABEL)
                  .map(([val, label]) => `<option value="${val}" ${val === s.status ? "selected" : ""}>${label}</option>`)
                  .join("")}
              </select>
            </td>
            <td class="small text-muted">${formatDateTime(s.created_at)}</td>
            <td class="d-flex flex-wrap gap-1">
              <a class="btn btn-sm btn-outline-navy" href="/api/admin/submissions/${s.id}/download" target="_blank" rel="noreferrer">.docx</a>
              ${canPublish ? `<button class="btn btn-sm btn-navy" data-toggle-publish="${s.id}">Publish</button>` : ""}
              <button class="btn btn-sm btn-outline-danger" data-delete-sub="${s.id}">Delete</button>
            </td>
          </tr>
          <tr class="d-none" id="publish-row-${s.id}">
            <td colspan="6">
              <form class="card-siahssr p-3 mb-2" data-publish-form="${s.id}">
                <div class="row g-2">
                  <div class="col-md-6">
                    <label class="form-label small text-muted">Journal</label>
                    <select class="form-select form-select-sm" name="journal_id" required>${journalOptions(s.journal_id)}</select>
                  </div>
                  <div class="col-md-2"><label class="form-label small text-muted">Volume</label><input class="form-control form-control-sm" name="volume" /></div>
                  <div class="col-md-2"><label class="form-label small text-muted">Issue</label><input class="form-control form-control-sm" name="issue" /></div>
                  <div class="col-md-2"><label class="form-label small text-muted">DOI</label><input class="form-control form-control-sm" name="doi" /></div>
                  <div class="col-12"><label class="form-label small text-muted">Abstract</label><textarea class="form-control form-control-sm" name="abstract" rows="3" required></textarea></div>
                  <div class="col-12"><label class="form-label small text-muted">Keywords (comma separated)</label><input class="form-control form-control-sm" name="keywords" /></div>
                  <div class="col-12 d-flex gap-2 mt-1">
                    <button class="btn btn-sm btn-navy" type="submit">Publish as Paper</button>
                    <button class="btn btn-sm btn-outline-navy" type="button" data-cancel-publish="${s.id}">Cancel</button>
                  </div>
                </div>
              </form>
            </td>
          </tr>`;
          })
          .join("");

        contentEl.innerHTML = `
          <div class="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-2">
            <select class="form-select form-select-sm" style="max-width:220px;" id="submissions-status-filter">
              <option value="">All statuses</option>
              ${Object.entries(SUBMISSION_STATUS_LABEL).map(([val, label]) => `<option value="${val}" ${val === statusFilter ? "selected" : ""}>${label}</option>`).join("")}
            </select>
          </div>
          ${subsRes.rows.length === 0 ? `<p class="text-muted">No submissions yet.</p>` : ""}
          <div class="table-responsive">
            <table class="table align-middle">
              <thead><tr><th>Paper</th><th>Journal</th><th>Payment Ref</th><th>Status</th><th>Submitted</th><th>Actions</th></tr></thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
          <div id="submissions-pagination"></div>`;

        renderPagination(document.getElementById("submissions-pagination"), subsRes.page, subsRes.pages, (p) => renderSubmissionsTab(p, statusFilter));

        document.getElementById("submissions-status-filter").addEventListener("change", (e) => renderSubmissionsTab(1, e.target.value));

        contentEl.querySelectorAll("[data-sub-status]").forEach((sel) => {
          sel.addEventListener("change", async (e) => {
            await api.patch(`/admin/submissions/${sel.getAttribute("data-sub-status")}`, { status: e.target.value });
            renderSubmissionsTab(page, statusFilter);
          });
        });
        contentEl.querySelectorAll("[data-toggle-publish]").forEach((btn) => {
          btn.addEventListener("click", () => {
            document.getElementById(`publish-row-${btn.getAttribute("data-toggle-publish")}`).classList.toggle("d-none");
          });
        });
        contentEl.querySelectorAll("[data-cancel-publish]").forEach((btn) => {
          btn.addEventListener("click", () => {
            document.getElementById(`publish-row-${btn.getAttribute("data-cancel-publish")}`).classList.add("d-none");
          });
        });
        contentEl.querySelectorAll("[data-publish-form]").forEach((form) => {
          form.addEventListener("submit", async (e) => {
            e.preventDefault();
            const id = form.getAttribute("data-publish-form");
            const fd = new FormData(form);
            try {
              await api.post(`/admin/submissions/${id}/publish`, Object.fromEntries(fd.entries()));
              renderSubmissionsTab(page, statusFilter);
            } catch (err) {
              alert(err.data?.error || "Failed to publish");
            }
          });
        });
        contentEl.querySelectorAll("[data-delete-sub]").forEach((btn) => {
          btn.addEventListener("click", async () => {
            if (!confirmDestructive("Delete this submission permanently?")) return;
            await api.del(`/admin/submissions/${btn.getAttribute("data-delete-sub")}`);
            renderSubmissionsTab(page, statusFilter);
          });
        });
      })
      .catch(() => {
        contentEl.innerHTML = `<p class="text-danger">Failed to load submissions.</p>`;
      });
  }

  // ---------------- PAPERS ----------------
  function paperEditFormHtml(p, journals, idPrefix) {
    const journalOptions = journals
      .map((j) => `<option value="${j.id}" ${String(j.id) === String(p.journal_id) ? "selected" : ""}>${esc(j.name)} (${esc(j.short_name)})</option>`)
      .join("");
    const statuses = ["submitted", "under_review", "accepted", "rejected", "published", "withdrawn"];
    return `
      <div class="row g-2">
        <div class="col-12"><label class="form-label small text-muted">Title</label><input class="form-control form-control-sm" name="title" value="${esc(p.title || "")}" required /></div>
        <div class="col-md-6"><label class="form-label small text-muted">Author Name</label><input class="form-control form-control-sm" name="author_name" value="${esc(p.author_name || "")}" ${idPrefix === "add" ? "required" : ""} /></div>
        <div class="col-md-6"><label class="form-label small text-muted">Author Designation</label><input class="form-control form-control-sm" name="author_designation" value="${esc(p.author_designation || "")}" /></div>
        <div class="col-md-6"><label class="form-label small text-muted">Institute / Address</label><input class="form-control form-control-sm" name="author_institute" value="${esc(p.author_institute || "")}" /></div>
        <div class="col-md-3"><label class="form-label small text-muted">Author Email</label><input class="form-control form-control-sm" name="author_email" value="${esc(p.author_email || "")}" /></div>
        <div class="col-md-3"><label class="form-label small text-muted">Author Contact</label><input class="form-control form-control-sm" name="author_contact" value="${esc(p.author_contact || "")}" /></div>
        <div class="col-12"><label class="form-label small text-muted">Abstract</label><textarea class="form-control form-control-sm" name="abstract" rows="3">${esc(p.abstract || "")}</textarea></div>
        <div class="col-12"><label class="form-label small text-muted">Keywords</label><input class="form-control form-control-sm" name="keywords" value="${esc(p.keywords || "")}" /></div>
        <div class="col-md-4"><label class="form-label small text-muted">Journal</label><select class="form-select form-select-sm" name="journal_id" required>${journalOptions}</select></div>
        <div class="col-md-2"><label class="form-label small text-muted">Volume</label><input class="form-control form-control-sm" name="volume" value="${esc(p.volume || "")}" /></div>
        <div class="col-md-2"><label class="form-label small text-muted">Issue</label><input class="form-control form-control-sm" name="issue" value="${esc(p.issue || "")}" /></div>
        <div class="col-md-4"><label class="form-label small text-muted">DOI</label><input class="form-control form-control-sm" name="doi" value="${esc(p.doi || "")}" /></div>
        <div class="col-md-4"><label class="form-label small text-muted">Status</label>
          <select class="form-select form-select-sm" name="status">${statuses.map((s) => `<option value="${s}" ${s === p.status ? "selected" : ""}>${STATUS_LABELS[s] || s}</option>`).join("")}</select>
        </div>
        ${idPrefix === "add" ? `<div class="col-md-8"><label class="form-label small text-muted">Article file (.docx or .pdf, optional)</label><input type="file" accept=".docx,.pdf" class="form-control form-control-sm" name="file" /></div>` : ""}
        <div class="col-12 d-flex gap-2 mt-1">
          <button class="btn btn-sm btn-navy" type="submit">${idPrefix === "add" ? "Add Paper" : "Save Changes"}</button>
          ${idPrefix !== "add" ? `<button class="btn btn-sm btn-outline-navy" type="button" data-cancel-edit="${p.id}">Cancel</button>` : ""}
        </div>
      </div>`;
  }

  function renderPapersTab(page) {
    Promise.all([api.get("/admin/papers", { page }), api.get("/journals")])
      .then(([papersRes, journals]) => {
        const rows = papersRes.rows
          .map(
            (p) => `
          <tr>
            <td class="fw-semibold">${esc(p.title)}</td>
            <td>${esc(p.author_name)}</td>
            <td>${esc(p.journal_name)}</td>
            <td>${statusBadgeHtml(p.status)}</td>
            <td class="d-flex flex-wrap gap-1">
              ${p.file_path ? `<a class="btn btn-sm btn-outline-navy" href="/api/papers/${p.id}/download" target="_blank" rel="noreferrer">${(p.original_filename || p.file_path).toLowerCase().endsWith(".pdf") ? ".pdf" : ".docx"}</a>` : ""}
              <button class="btn btn-sm btn-outline-navy" data-toggle-edit="${p.id}">Edit</button>
              ${p.status !== "published" ? `<button class="btn btn-sm btn-navy" data-publish="${p.id}">Publish</button>` : ""}
              <button class="btn btn-sm btn-outline-danger" data-delete-paper="${p.id}">Delete</button>
            </td>
          </tr>
          <tr class="d-none" id="edit-row-${p.id}">
            <td colspan="5"><form class="card-siahssr p-3 mb-2" data-edit-form="${p.id}">${paperEditFormHtml(p, journals, "edit")}</form></td>
          </tr>`
          )
          .join("");

        contentEl.innerHTML = `
          <div class="d-flex justify-content-between align-items-center mb-2">
            <button class="btn btn-sm btn-navy" id="toggle-add-paper"><i class="bi bi-plus-lg me-1"></i>Add Paper</button>
            <a class="btn btn-sm btn-outline-navy" href="/api/admin/export/papers.csv" target="_blank" rel="noreferrer"><i class="bi bi-download me-1"></i>Export CSV</a>
          </div>
          <form class="card-siahssr p-3 mb-3 d-none" id="add-paper-form">${paperEditFormHtml({}, journals, "add")}</form>
          <div class="table-responsive">
            <table class="table align-middle">
              <thead><tr><th>Title</th><th>Author</th><th>Journal</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
          <div id="papers-pagination"></div>`;

        renderPagination(document.getElementById("papers-pagination"), papersRes.page, papersRes.pages, renderPapersTab);

        document.getElementById("toggle-add-paper").addEventListener("click", () => {
          document.getElementById("add-paper-form").classList.toggle("d-none");
        });
        document.getElementById("add-paper-form").addEventListener("submit", async (e) => {
          e.preventDefault();
          const fd = new FormData(e.target);
          try {
            await api.post("/admin/papers", fd);
            renderPapersTab(page);
          } catch (err) {
            alert(err.data?.error || "Failed to add paper");
          }
        });

        contentEl.querySelectorAll("[data-toggle-edit]").forEach((btn) => {
          btn.addEventListener("click", () => {
            document.getElementById(`edit-row-${btn.getAttribute("data-toggle-edit")}`).classList.toggle("d-none");
          });
        });
        contentEl.querySelectorAll("[data-cancel-edit]").forEach((btn) => {
          btn.addEventListener("click", () => {
            document.getElementById(`edit-row-${btn.getAttribute("data-cancel-edit")}`).classList.add("d-none");
          });
        });
        contentEl.querySelectorAll("[data-edit-form]").forEach((form) => {
          form.addEventListener("submit", async (e) => {
            e.preventDefault();
            const id = form.getAttribute("data-edit-form");
            const fd = new FormData(form);
            try {
              await api.put(`/admin/papers/${id}`, Object.fromEntries(fd.entries()));
              renderPapersTab(page);
            } catch (err) {
              alert(err.data?.error || "Failed to update paper");
            }
          });
        });
        contentEl.querySelectorAll("[data-publish]").forEach((btn) => {
          btn.addEventListener("click", async () => {
            const volume = prompt("Volume number:") || "";
            const issue = prompt("Issue number:") || "";
            const doi = prompt("DOI (optional):") || "";
            await api.patch(`/admin/papers/${btn.getAttribute("data-publish")}/publish`, { volume, issue, doi });
            renderPapersTab(page);
          });
        });
        contentEl.querySelectorAll("[data-delete-paper]").forEach((btn) => {
          btn.addEventListener("click", async () => {
            if (!confirmDestructive("Delete this paper permanently?")) return;
            await api.del(`/admin/papers/${btn.getAttribute("data-delete-paper")}`);
            renderPapersTab(page);
          });
        });
      })
      .catch(() => {
        contentEl.innerHTML = `<p class="text-danger">Failed to load papers.</p>`;
      });
  }

  // ---------------- JOURNALS ----------------
  const FALLBACK_LOGO = { IJDSSR: "/logo-ijdssr.png", JMRH: "/logo-jmrh.svg" };

  function journalFormHtml(j, idPrefix) {
    return `
      <div class="col-md-6"><label class="form-label small text-muted">Full name</label><input class="form-control form-control-sm" name="name" placeholder="Full name" value="${esc(j.name || "")}" required /></div>
      <div class="col-md-2"><label class="form-label small text-muted">Short name</label><input class="form-control form-control-sm" name="short_name" placeholder="Short name" value="${esc(j.short_name || "")}" required /></div>
      <div class="col-md-4"><label class="form-label small text-muted">ISSN</label><input class="form-control form-control-sm" name="issn" placeholder="ISSN" value="${esc(j.issn || "")}" /></div>
      <div class="col-12"><label class="form-label small text-muted">Description</label><textarea class="form-control form-control-sm" name="description" placeholder="Description" rows="2">${esc(j.description || "")}</textarea></div>
      <div class="col-md-3"><label class="form-label small text-muted">Current Volume</label><input class="form-control form-control-sm" name="current_volume" value="${esc(j.current_volume || "")}" /></div>
      <div class="col-md-3"><label class="form-label small text-muted">Current Issue</label><input class="form-control form-control-sm" name="current_issue" value="${esc(j.current_issue || "")}" /></div>
      <div class="col-12"><label class="form-label small text-muted">Call for Papers Text</label><textarea class="form-control form-control-sm" name="cfp_text" rows="2">${esc(j.cfp_text || "")}</textarea></div>
      <div class="col-md-4"><label class="form-label small text-muted">CFP Deadline</label><input type="date" class="form-control form-control-sm" name="cfp_deadline" value="${j.cfp_deadline ? esc(String(j.cfp_deadline).slice(0, 10)) : ""}" /></div>
      <div class="col-12 d-flex gap-2 mt-1">
        <button class="btn btn-sm btn-navy" type="submit">${idPrefix === "add" ? "Add Journal" : "Save Changes"}</button>
        ${idPrefix !== "add" ? `<button class="btn btn-sm btn-outline-navy" type="button" data-cancel-edit-journal="${j.id}">Cancel</button>` : ""}
      </div>`;
  }

  function renderJournalsTab() {
    api
      .get("/journals")
      .then((journals) => {
        contentEl.innerHTML = `
          <div class="card-siahssr p-4 mb-4">
            <h6 class="fw-bold mb-3">Add Journal</h6>
            <form id="journal-form" class="row g-2">${journalFormHtml({}, "add")}</form>
          </div>
          <div id="journals-list"></div>`;

        document.getElementById("journals-list").innerHTML = journals
          .map(
            (j) => `
          <div class="card-siahssr p-3 mb-3">
            <div class="d-flex flex-row align-items-center gap-3">
              <div class="journal-logo-frame-xs">
                <img src="${esc(j.logo_path ? fileUrl(j.logo_path) : FALLBACK_LOGO[j.short_name] || "/logo-site.png")}" alt="" />
              </div>
              <div class="flex-grow-1">
                <div class="fw-bold">${esc(j.name)}</div>
                <div class="small text-muted">${esc(j.short_name)} · Vol ${esc(j.current_volume)}, Issue ${esc(j.current_issue)}</div>
              </div>
              <label class="btn btn-sm btn-outline-navy mb-0">
                Change Logo
                <input type="file" accept="image/*" hidden data-logo="${j.id}" />
              </label>
              <button class="btn btn-sm btn-outline-navy" data-toggle-edit-journal="${j.id}">Edit</button>
              <button class="btn btn-sm btn-outline-danger" data-remove-journal="${j.id}">Delete</button>
            </div>
            <form class="d-none row g-2 mt-3 pt-3 border-top" data-edit-journal-form="${j.id}" id="edit-journal-form-${j.id}">${journalFormHtml(j, "edit")}</form>
          </div>`
          )
          .join("");

        document.getElementById("journal-form").addEventListener("submit", async (e) => {
          e.preventDefault();
          const fd = new FormData(e.target);
          try {
            await api.post("/journals", Object.fromEntries(fd.entries()));
            e.target.reset();
            renderJournalsTab();
          } catch (err) {
            alert(err.data?.error || "Failed to add journal");
          }
        });

        contentEl.querySelectorAll("[data-logo]").forEach((input) => {
          input.addEventListener("change", async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const fd = new FormData();
            fd.append("logo", file);
            await api.post(`/journals/${input.getAttribute("data-logo")}/logo`, fd);
            renderJournalsTab();
          });
        });
        contentEl.querySelectorAll("[data-toggle-edit-journal]").forEach((btn) => {
          btn.addEventListener("click", () => {
            document.getElementById(`edit-journal-form-${btn.getAttribute("data-toggle-edit-journal")}`).classList.toggle("d-none");
          });
        });
        contentEl.querySelectorAll("[data-cancel-edit-journal]").forEach((btn) => {
          btn.addEventListener("click", () => {
            document.getElementById(`edit-journal-form-${btn.getAttribute("data-cancel-edit-journal")}`).classList.add("d-none");
          });
        });
        contentEl.querySelectorAll("[data-edit-journal-form]").forEach((form) => {
          form.addEventListener("submit", async (e) => {
            e.preventDefault();
            const id = form.getAttribute("data-edit-journal-form");
            const fd = new FormData(form);
            try {
              await api.put(`/journals/${id}`, Object.fromEntries(fd.entries()));
              renderJournalsTab();
            } catch (err) {
              alert(err.data?.error || "Failed to update journal");
            }
          });
        });
        contentEl.querySelectorAll("[data-remove-journal]").forEach((btn) => {
          btn.addEventListener("click", async () => {
            if (!confirmDestructive("Delete this journal? This also deletes every paper, submission and editorial board entry linked to it. This cannot be undone.")) return;
            try {
              await api.del(`/journals/${btn.getAttribute("data-remove-journal")}`);
              renderJournalsTab();
            } catch (err) {
              alert(err.data?.error || "Failed to delete journal");
            }
          });
        });
      })
      .catch(() => {
        contentEl.innerHTML = `<p class="text-danger">Failed to load journals.</p>`;
      });
  }

  // ---------------- EDITORIAL BOARD ----------------
  function boardMemberFormHtml(m, journals, idPrefix) {
    const journalOptions =
      `<option value="">— none —</option>` +
      journals.map((j) => `<option value="${j.id}" ${String(j.id) === String(m.journal_id) ? "selected" : ""}>${esc(j.name)} (${esc(j.short_name)})</option>`).join("");
    return `
      <div class="row g-2">
        <div class="col-md-4"><label class="form-label small text-muted">Name</label><input class="form-control form-control-sm" name="name" value="${esc(m.name || "")}" required /></div>
        <div class="col-md-4"><label class="form-label small text-muted">Designation</label><input class="form-control form-control-sm" name="designation" value="${esc(m.designation || "")}" /></div>
        <div class="col-md-4"><label class="form-label small text-muted">Affiliation</label><input class="form-control form-control-sm" name="affiliation" value="${esc(m.affiliation || "")}" /></div>
        <div class="col-md-8"><label class="form-label small text-muted">Expertise</label><input class="form-control form-control-sm" name="expertise" value="${esc(m.expertise || "")}" /></div>
        <div class="col-md-4"><label class="form-label small text-muted">Journal</label><select class="form-select form-select-sm" name="journal_id">${journalOptions}</select></div>
        <div class="col-12"><label class="form-label small text-muted">Bio</label><textarea class="form-control form-control-sm" name="bio" rows="2">${esc(m.bio || "")}</textarea></div>
        <div class="col-md-6"><label class="form-label small text-muted">Photo ${idPrefix === "edit" ? "(leave blank to keep current)" : ""}</label><input type="file" accept="image/*" class="form-control form-control-sm" name="photo" /></div>
        <div class="col-12 d-flex gap-2 mt-1">
          <button class="btn btn-sm btn-navy" type="submit">${idPrefix === "add" ? "Add Member" : "Save Changes"}</button>
          ${idPrefix !== "add" ? `<button class="btn btn-sm btn-outline-navy" type="button" data-cancel-edit-member="${m.id}">Cancel</button>` : ""}
        </div>
      </div>`;
  }

  function renderBoardTab() {
    Promise.all([api.get("/board"), api.get("/journals")])
      .then(([members, journals]) => {
        contentEl.innerHTML = `
          <div class="card-siahssr p-4 mb-4">
            <h6 class="fw-bold mb-3">Add Board Member</h6>
            <form id="board-form">${boardMemberFormHtml({}, journals, "add")}</form>
          </div>
          <div id="board-list"></div>`;

        document.getElementById("board-list").innerHTML = members
          .map(
            (m) => `
          <div class="card-siahssr p-3 mb-2">
            <div class="d-flex flex-row align-items-center gap-3">
              <div class="flex-grow-1">
                <div class="fw-bold">${esc(m.name)}</div>
                <div class="small text-muted">${esc(m.designation)} — ${esc(m.affiliation)}</div>
              </div>
              <button class="btn btn-sm btn-outline-navy" data-toggle-edit-member="${m.id}">Edit</button>
              <button class="btn btn-sm btn-outline-danger" data-remove-member="${m.id}">Remove</button>
            </div>
            <form class="d-none mt-3 pt-3 border-top" id="edit-member-form-${m.id}" data-edit-member-form="${m.id}">${boardMemberFormHtml(m, journals, "edit")}</form>
          </div>`
          )
          .join("");

        document.getElementById("board-form").addEventListener("submit", async (e) => {
          e.preventDefault();
          const fd = new FormData(e.target);
          try {
            await api.post("/board", fd);
            renderBoardTab();
          } catch (err) {
            alert(err.data?.error || "Failed to add board member");
          }
        });
        contentEl.querySelectorAll("[data-toggle-edit-member]").forEach((btn) => {
          btn.addEventListener("click", () => {
            document.getElementById(`edit-member-form-${btn.getAttribute("data-toggle-edit-member")}`).classList.toggle("d-none");
          });
        });
        contentEl.querySelectorAll("[data-cancel-edit-member]").forEach((btn) => {
          btn.addEventListener("click", () => {
            document.getElementById(`edit-member-form-${btn.getAttribute("data-cancel-edit-member")}`).classList.add("d-none");
          });
        });
        contentEl.querySelectorAll("[data-edit-member-form]").forEach((form) => {
          form.addEventListener("submit", async (e) => {
            e.preventDefault();
            const id = form.getAttribute("data-edit-member-form");
            const fd = new FormData(form);
            if (fd.get("photo") && fd.get("photo").size === 0) fd.delete("photo");
            try {
              await api.put(`/board/${id}`, fd);
              renderBoardTab();
            } catch (err) {
              alert(err.data?.error || "Failed to update board member");
            }
          });
        });
        contentEl.querySelectorAll("[data-remove-member]").forEach((btn) => {
          btn.addEventListener("click", async () => {
            if (!confirmDestructive("Remove this board member?")) return;
            await api.del(`/board/${btn.getAttribute("data-remove-member")}`);
            renderBoardTab();
          });
        });
      })
      .catch(() => {
        contentEl.innerHTML = `<p class="text-danger">Failed to load board members.</p>`;
      });
  }

  // ---------------- FAQ ----------------
  function faqFormHtml(f, idPrefix) {
    return `
      <div class="col-md-6"><input class="form-control" name="question" placeholder="Question" value="${esc(f.question || "")}" required /></div>
      <div class="col-md-6"><input class="form-control" name="category" placeholder="Category" value="${esc(f.category || "general")}" /></div>
      <div class="col-12"><textarea class="form-control" name="answer" placeholder="Answer" required>${esc(f.answer || "")}</textarea></div>
      <div class="col-12 d-flex gap-2">
        <button class="btn btn-navy" type="submit">${idPrefix === "add" ? "Add FAQ" : "Save Changes"}</button>
        ${idPrefix !== "add" ? `<button class="btn btn-outline-navy" type="button" data-cancel-edit-faq="${f.id}">Cancel</button>` : ""}
      </div>`;
  }

  function renderFaqTab() {
    api
      .get("/faq")
      .then((faqs) => {
        contentEl.innerHTML = `
          <form id="faq-form" class="card-siahssr p-4 mb-4 row g-2">${faqFormHtml({}, "add")}</form>
          <div id="faq-list"></div>`;

        document.getElementById("faq-list").innerHTML = faqs
          .map(
            (f) => `
          <div class="card-siahssr p-3 mb-2">
            <div class="d-flex justify-content-between">
              <strong>${esc(f.question)}</strong>
              <div class="d-flex gap-1">
                <button class="btn btn-sm btn-outline-navy" data-toggle-edit-faq="${f.id}">Edit</button>
                <button class="btn btn-sm btn-outline-danger" data-remove-faq="${f.id}">Delete</button>
              </div>
            </div>
            <p class="small text-muted mb-0">${esc(f.answer)}</p>
            <form class="d-none row g-2 mt-2 pt-2 border-top" data-edit-faq-form="${f.id}" id="edit-faq-form-${f.id}">${faqFormHtml(f, "edit")}</form>
          </div>`
          )
          .join("");

        document.getElementById("faq-form").addEventListener("submit", async (e) => {
          e.preventDefault();
          const fd = new FormData(e.target);
          try {
            await api.post("/faq", Object.fromEntries(fd.entries()));
            renderFaqTab();
          } catch (err) {
            alert(err.data?.error || "Failed to add FAQ");
          }
        });
        contentEl.querySelectorAll("[data-toggle-edit-faq]").forEach((btn) => {
          btn.addEventListener("click", () => {
            document.getElementById(`edit-faq-form-${btn.getAttribute("data-toggle-edit-faq")}`).classList.toggle("d-none");
          });
        });
        contentEl.querySelectorAll("[data-cancel-edit-faq]").forEach((btn) => {
          btn.addEventListener("click", () => {
            document.getElementById(`edit-faq-form-${btn.getAttribute("data-cancel-edit-faq")}`).classList.add("d-none");
          });
        });
        contentEl.querySelectorAll("[data-edit-faq-form]").forEach((form) => {
          form.addEventListener("submit", async (e) => {
            e.preventDefault();
            const id = form.getAttribute("data-edit-faq-form");
            const fd = new FormData(form);
            try {
              await api.put(`/faq/${id}`, Object.fromEntries(fd.entries()));
              renderFaqTab();
            } catch (err) {
              alert(err.data?.error || "Failed to update FAQ");
            }
          });
        });
        contentEl.querySelectorAll("[data-remove-faq]").forEach((btn) => {
          btn.addEventListener("click", async () => {
            if (!confirmDestructive("Delete this FAQ?")) return;
            await api.del(`/faq/${btn.getAttribute("data-remove-faq")}`);
            renderFaqTab();
          });
        });
      })
      .catch(() => {
        contentEl.innerHTML = `<p class="text-danger">Failed to load FAQs.</p>`;
      });
  }

  // ---------------- EVENTS & NEWS ----------------
  const EVENT_TYPES = [
    { value: "conference", label: "Conference" },
    { value: "workshop", label: "Workshop" },
    { value: "training", label: "Training Programme" },
    { value: "seminar", label: "Seminar" },
    { value: "other", label: "Other" },
  ];

  function eventFormHtml(ev, idPrefix) {
    return `
      <div class="col-md-6"><input class="form-control" name="title" placeholder="Title" value="${esc(ev.title || "")}" required /></div>
      <div class="col-md-3">
        <select class="form-select" name="event_type">
          ${EVENT_TYPES.map((t) => `<option value="${t.value}" ${t.value === ev.event_type ? "selected" : ""}>${t.label}</option>`).join("")}
        </select>
      </div>
      <div class="col-md-3"><input type="date" class="form-control" name="event_date" value="${ev.event_date ? esc(String(ev.event_date).slice(0, 10)) : ""}" /></div>
      <div class="col-md-6"><input class="form-control" name="location" placeholder="Location" value="${esc(ev.location || "")}" /></div>
      <div class="col-12"><textarea class="form-control" name="description" placeholder="Description">${esc(ev.description || "")}</textarea></div>
      <div class="col-12 d-flex gap-2">
        <button class="btn btn-navy" type="submit">${idPrefix === "add" ? "Add Event" : "Save Changes"}</button>
        ${idPrefix !== "add" ? `<button class="btn btn-outline-navy" type="button" data-cancel-edit-event="${ev.id}">Cancel</button>` : ""}
      </div>`;
  }

  function renderEventsTab() {
    api
      .get("/admin/events")
      .then((events) => {
        contentEl.innerHTML = `
          <form id="event-form" class="card-siahssr p-4 mb-4 row g-2">${eventFormHtml({}, "add")}</form>
          <div id="events-list"></div>`;

        document.getElementById("events-list").innerHTML = events
          .map(
            (e) => `
          <div class="card-siahssr p-3 mb-2">
            <div class="d-flex flex-row justify-content-between align-items-center">
              <div>
                <div class="fw-bold">${esc(e.title)} <span class="badge bg-navy ms-1">${esc(e.event_type)}</span></div>
                <div class="small text-muted">${e.event_date ? formatDate(e.event_date) : "No date set"}${e.location ? ` · ${esc(e.location)}` : ""}</div>
              </div>
              <div class="d-flex gap-1">
                <button class="btn btn-sm btn-outline-navy" data-toggle-edit-event="${e.id}">Edit</button>
                <button class="btn btn-sm btn-outline-danger" data-remove-event="${e.id}">Delete</button>
              </div>
            </div>
            <form class="d-none row g-2 mt-3 pt-3 border-top" data-edit-event-form="${e.id}" id="edit-event-form-${e.id}">${eventFormHtml(e, "edit")}</form>
          </div>`
          )
          .join("");

        document.getElementById("event-form").addEventListener("submit", async (ev) => {
          ev.preventDefault();
          const fd = new FormData(ev.target);
          try {
            await api.post("/admin/events", Object.fromEntries(fd.entries()));
            ev.target.reset();
            renderEventsTab();
          } catch (err) {
            alert(err.data?.error || "Failed to add event");
          }
        });
        contentEl.querySelectorAll("[data-toggle-edit-event]").forEach((btn) => {
          btn.addEventListener("click", () => {
            document.getElementById(`edit-event-form-${btn.getAttribute("data-toggle-edit-event")}`).classList.toggle("d-none");
          });
        });
        contentEl.querySelectorAll("[data-cancel-edit-event]").forEach((btn) => {
          btn.addEventListener("click", () => {
            document.getElementById(`edit-event-form-${btn.getAttribute("data-cancel-edit-event")}`).classList.add("d-none");
          });
        });
        contentEl.querySelectorAll("[data-edit-event-form]").forEach((form) => {
          form.addEventListener("submit", async (e) => {
            e.preventDefault();
            const id = form.getAttribute("data-edit-event-form");
            const fd = new FormData(form);
            try {
              await api.put(`/admin/events/${id}`, Object.fromEntries(fd.entries()));
              renderEventsTab();
            } catch (err) {
              alert(err.data?.error || "Failed to update event");
            }
          });
        });
        contentEl.querySelectorAll("[data-remove-event]").forEach((btn) => {
          btn.addEventListener("click", async () => {
            if (!confirmDestructive("Delete this event?")) return;
            await api.del(`/admin/events/${btn.getAttribute("data-remove-event")}`);
            renderEventsTab();
          });
        });
      })
      .catch(() => {
        contentEl.innerHTML = `<p class="text-danger">Failed to load events.</p>`;
      });
  }

  // ---------------- NOTICES (homepage notice board) ----------------
  function renderNoticesTab() {
    api
      .get("/admin/notices")
      .then((notices) => {
        contentEl.innerHTML = `
          <form id="notice-form" class="card-siahssr p-4 mb-4 row g-2">
            <div class="col-md-8"><input class="form-control" name="title" placeholder="Notice title" required /></div>
            <div class="col-md-4"><input type="file" accept=".jpg,.jpeg,.png,.webp,.gif" class="form-control" name="image" required /></div>
            <div class="col-12 form-text">Image files only (JPG, PNG, WEBP, GIF), up to 5MB. Shown on the homepage sidebar, newest first.</div>
            <div class="col-12"><button class="btn btn-navy" type="submit">Post Notice</button></div>
          </form>
          <div class="row g-3" id="notices-admin-list"></div>`;

        document.getElementById("notices-admin-list").innerHTML = notices
          .map(
            (n) => `
          <div class="col-md-4 col-sm-6">
            <div class="card-siahssr p-2 h-100 d-flex flex-column">
              <img src="${esc(n.image_path)}" alt="${esc(n.title)}" class="notice-card-img mb-2" style="border-radius:6px;" />
              <div class="fw-semibold small flex-grow-1">${esc(n.title)}</div>
              <div class="small text-muted mb-2">${formatDateTime(n.created_at)}</div>
              <div class="d-flex gap-1">
                <button class="btn btn-sm btn-outline-navy" data-toggle-edit-notice="${n.id}">Edit</button>
                <button class="btn btn-sm btn-outline-danger" data-remove-notice="${n.id}">Delete</button>
              </div>
              <form class="d-none row g-2 mt-2 pt-2 border-top" data-edit-notice-form="${n.id}" id="edit-notice-form-${n.id}">
                <div class="col-12"><input class="form-control form-control-sm" name="title" value="${esc(n.title)}" required /></div>
                <div class="col-12"><input type="file" accept=".jpg,.jpeg,.png,.webp,.gif" class="form-control form-control-sm" name="image" /></div>
                <div class="col-12 form-text">Leave the image blank to keep the current one.</div>
                <div class="col-12 d-flex gap-2">
                  <button class="btn btn-sm btn-navy" type="submit">Save</button>
                  <button class="btn btn-sm btn-outline-navy" type="button" data-cancel-edit-notice="${n.id}">Cancel</button>
                </div>
              </form>
            </div>
          </div>`
          )
          .join("");

        document.getElementById("notice-form").addEventListener("submit", async (e) => {
          e.preventDefault();
          const fd = new FormData(e.target);
          if (!fd.get("title") || !fd.get("image") || fd.get("image").size === 0) return;
          await api.post("/admin/notices", fd);
          renderNoticesTab();
        });
        contentEl.querySelectorAll("[data-toggle-edit-notice]").forEach((btn) => {
          btn.addEventListener("click", () => {
            document.getElementById(`edit-notice-form-${btn.getAttribute("data-toggle-edit-notice")}`).classList.toggle("d-none");
          });
        });
        contentEl.querySelectorAll("[data-cancel-edit-notice]").forEach((btn) => {
          btn.addEventListener("click", () => {
            document.getElementById(`edit-notice-form-${btn.getAttribute("data-cancel-edit-notice")}`).classList.add("d-none");
          });
        });
        contentEl.querySelectorAll("[data-edit-notice-form]").forEach((form) => {
          form.addEventListener("submit", async (e) => {
            e.preventDefault();
            const id = form.getAttribute("data-edit-notice-form");
            const fd = new FormData(form);
            if (fd.get("image") && fd.get("image").size === 0) fd.delete("image");
            try {
              await api.put(`/admin/notices/${id}`, fd);
              renderNoticesTab();
            } catch (err) {
              alert(err.data?.error || "Failed to update notice");
            }
          });
        });
        contentEl.querySelectorAll("[data-remove-notice]").forEach((btn) => {
          btn.addEventListener("click", async () => {
            if (!confirmDestructive("Delete this notice?")) return;
            await api.del(`/admin/notices/${btn.getAttribute("data-remove-notice")}`);
            renderNoticesTab();
          });
        });
      })
      .catch(() => {
        contentEl.innerHTML = `<p class="text-danger">Failed to load notices.</p>`;
      });
  }

  // ---------------- USERS ----------------
  function renderUsersTab(page) {
    api
      .get("/admin/users", { page })
      .then((data) => {
        const rows = data.rows
          .map(
            (u) => `
          <tr>
            <td>${esc(u.name)}</td>
            <td>${esc(u.email)}</td>
            <td class="small text-muted">${esc(u.orcid || "—")}</td>
            <td>
              <select class="form-select form-select-sm" data-role="${u.id}">
                <option value="author" ${u.role === "author" ? "selected" : ""}>Author</option>
                <option value="reviewer" ${u.role === "reviewer" ? "selected" : ""}>Reviewer</option>
                <option value="admin" ${u.role === "admin" ? "selected" : ""}>Admin</option>
              </select>
            </td>
            <td class="small text-muted">${u.last_login ? formatDateTime(u.last_login) : "Never"}</td>
            <td><button class="btn btn-sm btn-outline-danger" data-delete-user="${u.id}" data-name="${esc(u.name)}">Delete</button></td>
          </tr>`
          )
          .join("");

        contentEl.innerHTML = `
          <div class="card-siahssr p-3 mb-3">
            <h6 class="fw-bold mb-2">Add a login</h6>
            <p class="small text-muted mb-3">Public sign-up is off — this site is admin-login-only — so new dashboard logins are created here.</p>
            <form id="add-user-form" class="row g-2">
              <div class="col-md-4"><input class="form-control form-control-sm" name="name" placeholder="Name" required /></div>
              <div class="col-md-4"><input type="email" class="form-control form-control-sm" name="email" placeholder="Email" required /></div>
              <div class="col-md-3"><input type="password" class="form-control form-control-sm" name="password" placeholder="Password" required minlength="6" /></div>
              <div class="col-md-1"><button class="btn btn-navy btn-sm w-100" type="submit">Add</button></div>
            </form>
          </div>
          <div class="d-flex justify-content-end mb-2">
            <a class="btn btn-sm btn-outline-navy" href="/api/admin/export/users.csv" target="_blank" rel="noreferrer"><i class="bi bi-download me-1"></i>Export CSV</a>
          </div>
          <div class="table-responsive">
            <table class="table align-middle">
              <thead><tr><th>Name</th><th>Email</th><th>ORCID</th><th>Role</th><th>Last Login</th><th></th></tr></thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
          <div id="users-pagination"></div>`;

        renderPagination(document.getElementById("users-pagination"), data.page, data.pages, renderUsersTab);

        document.getElementById("add-user-form").addEventListener("submit", async (e) => {
          e.preventDefault();
          const fd = new FormData(e.target);
          try {
            await api.post("/admin/users", Object.fromEntries(fd.entries()));
            e.target.reset();
            renderUsersTab(1);
          } catch (err) {
            alert(err.data?.error || "Failed to add user");
          }
        });

        contentEl.querySelectorAll("[data-role]").forEach((sel) => {
          sel.addEventListener("change", async (e) => {
            await api.patch(`/admin/users/${sel.getAttribute("data-role")}/role`, { role: e.target.value });
            renderUsersTab(page);
          });
        });
        contentEl.querySelectorAll("[data-delete-user]").forEach((btn) => {
          btn.addEventListener("click", async () => {
            const name = btn.getAttribute("data-name");
            if (!confirmDestructive(`Delete user "${name}"? This also deletes their papers.`)) return;
            await api.del(`/admin/users/${btn.getAttribute("data-delete-user")}`);
            renderUsersTab(page);
          });
        });
      })
      .catch(() => {
        contentEl.innerHTML = `<p class="text-danger">Failed to load users.</p>`;
      });
  }

  // ---------------- CONTACT MESSAGES ----------------
  function renderMessagesTab() {
    api
      .get("/admin/contact-messages")
      .then((messages) => {
        contentEl.innerHTML = `
          <div class="d-flex justify-content-end mb-2">
            <a class="btn btn-sm btn-outline-navy" href="/api/admin/export/contact-messages.csv" target="_blank" rel="noreferrer"><i class="bi bi-download me-1"></i>Export CSV</a>
          </div>
          ${messages.length === 0 ? `<p class="text-muted">No messages yet.</p>` : ""}
          <div id="messages-list"></div>`;

        document.getElementById("messages-list").innerHTML = messages
          .map(
            (m) => `
          <div class="card-siahssr p-3 mb-2" style="opacity:${m.is_read ? 0.7 : 1};">
            <div class="d-flex justify-content-between flex-wrap">
              <div>
                <strong>${esc(m.subject || "(no subject)")}</strong>
                <span class="small text-muted ms-2">${esc(m.name)} &lt;${esc(m.email)}&gt;</span>
              </div>
              <div class="d-flex gap-1">
                <button class="btn btn-sm btn-outline-navy" data-toggle-read="${m.id}" data-read="${m.is_read ? 1 : 0}">${m.is_read ? "Mark Unread" : "Mark Read"}</button>
                <button class="btn btn-sm btn-outline-danger" data-remove-message="${m.id}">Delete</button>
              </div>
            </div>
            <p class="small mb-0 mt-2">${esc(m.message)}</p>
            <p class="small text-muted mb-0 mt-1">${formatDateTime(m.created_at)}</p>
          </div>`
          )
          .join("");

        contentEl.querySelectorAll("[data-toggle-read]").forEach((btn) => {
          btn.addEventListener("click", async () => {
            const isRead = btn.getAttribute("data-read") === "1";
            await api.patch(`/admin/contact-messages/${btn.getAttribute("data-toggle-read")}/read`, { is_read: !isRead });
            renderMessagesTab();
          });
        });
        contentEl.querySelectorAll("[data-remove-message]").forEach((btn) => {
          btn.addEventListener("click", async () => {
            if (!confirmDestructive("Delete this message?")) return;
            await api.del(`/admin/contact-messages/${btn.getAttribute("data-remove-message")}`);
            renderMessagesTab();
          });
        });
      })
      .catch(() => {
        contentEl.innerHTML = `<p class="text-danger">Failed to load messages.</p>`;
      });
  }

  // ---------------- AUDIT LOG ----------------
  function renderAuditLogTab(page) {
    api
      .get("/admin/audit-log", { page })
      .then((data) => {
        const rows = data.rows
          .map(
            (l) => `
          <tr>
            <td class="small">${formatDateTime(l.created_at)}</td>
            <td class="small">${esc(l.admin_name || "—")}</td>
            <td class="small">${esc(l.action)}</td>
            <td class="small text-muted" style="max-width:320px;word-break:break-word;">${esc(l.details)}</td>
          </tr>`
          )
          .join("");

        contentEl.innerHTML = `
          <div class="table-responsive">
            <table class="table align-middle table-sm">
              <thead><tr><th>When</th><th>Admin</th><th>Action</th><th>Details</th></tr></thead>
              <tbody>${rows || `<tr><td colspan="4" class="text-muted">No actions logged yet.</td></tr>`}</tbody>
            </table>
          </div>
          <div id="audit-pagination"></div>`;

        renderPagination(document.getElementById("audit-pagination"), data.page, data.pages, renderAuditLogTab);
      })
      .catch(() => {
        contentEl.innerHTML = `<p class="text-danger">Failed to load the audit log.</p>`;
      });
  }

  // ---------------- SITE CONTENT ----------------
  function renderSiteContentTab() {
    const SETTINGS_KEYS = ["hero_title", "tagline", "vision_text", "guidelines_text", "contact_phone_1", "contact_phone_2", "contact_email", "contact_website", "contact_address"];
    const SECTION_LABELS = { core_value: "Core Values", objective: "Objectives", mission: "Mission" };

    Promise.all([api.get("/admin/settings"), api.get("/admin/about-items"), api.get("/admin/announcements"), api.get("/admin/documents")])
      .then(([settings, aboutItems, announcements, documents]) => {
        function itemsFor(section) {
          return aboutItems.filter((i) => i.section === section);
        }

        const settingsFieldsHtml = SETTINGS_KEYS.map((key) => {
          const isTextarea = key === "vision_text" || key === "guidelines_text";
          const value = esc(settings[key] || "");
          const control = isTextarea
            ? `<textarea class="form-control form-control-sm" rows="3" data-setting="${key}">${value}</textarea>`
            : `<input class="form-control form-control-sm" data-setting="${key}" value="${value}" />`;
          return `<div class="mb-2"><label class="form-label small text-muted">${esc(key.replace(/_/g, " "))}</label>${control}</div>`;
        }).join("");

        const sectionsHtml = ["core_value", "objective", "mission"]
          .map(
            (section) => `
          <div class="card-siahssr p-4 mb-4" data-section-card="${section}">
            <h6 class="fw-bold mb-3">${SECTION_LABELS[section]}</h6>
            <div class="d-flex gap-2 mb-3">
              <input class="form-control" data-new-item="${section}" placeholder="New ${SECTION_LABELS[section].toLowerCase().slice(0, -1)}…" />
              <button class="btn btn-navy" data-add-item="${section}">Add</button>
            </div>
            <div style="max-height:220px;overflow-y:auto;" data-item-list="${section}">
              ${itemsFor(section)
                .map((o) => `<div class="d-flex justify-content-between align-items-center border-bottom py-1"><span class="small">${esc(o.text)}</span><span class="d-flex gap-1"><button class="btn btn-sm btn-outline-navy py-0 px-1" data-edit-item="${o.id}" title="Edit">✎</button><button class="btn btn-sm btn-outline-danger py-0 px-2" data-remove-item="${o.id}">×</button></span></div>`)
                .join("")}
            </div>
          </div>`
          )
          .join("");

        contentEl.innerHTML = `
          <div class="row g-4">
            <div class="col-md-6">
              <div class="card-siahssr p-4">
                <h6 class="fw-bold mb-3">Navbar Logo</h6>
                <input type="file" accept="image/*" class="form-control" id="site-logo-input" />
              </div>

              <form id="settings-form" class="card-siahssr p-4 mt-4">
                <h6 class="fw-bold mb-3">Homepage, Vision &amp; Contact Text</h6>
                ${settingsFieldsHtml}
                <button class="btn btn-navy mt-2" type="submit">Save Settings</button>
              </form>

              <div class="card-siahssr p-4 mt-4">
                <h6 class="fw-bold mb-3">Institute Documents</h6>
                <form id="document-form" class="mb-3">
                  <input class="form-control form-control-sm mb-2" name="title" placeholder="Document title" />
                  <input type="file" accept=".docx" class="form-control form-control-sm mb-2" name="file" />
                  <div class="form-text small mb-2">Word (.docx) files only</div>
                  <input type="hidden" name="category" value="institute" />
                  <button class="btn btn-sm btn-navy" type="submit">Upload Document</button>
                </form>
                <div id="documents-list">
                  ${documents.map((d) => `<div class="d-flex justify-content-between border-bottom py-1"><span class="small">${esc(d.title)}</span><button class="btn btn-sm btn-outline-danger" data-remove-doc="${d.id}">×</button></div>`).join("")}
                </div>
              </div>
            </div>

            <div class="col-md-6">
              ${sectionsHtml}
              <div class="card-siahssr p-4">
                <h6 class="fw-bold mb-3">Announcements</h6>
                <form id="announcement-form" class="mb-3">
                  <input class="form-control mb-2" name="title" placeholder="Title" />
                  <textarea class="form-control mb-2" name="content" placeholder="Content"></textarea>
                  <button class="btn btn-navy" type="submit">Add Announcement</button>
                </form>
                <div id="announcements-list">
                  ${announcements
                    .map(
                      (a) => `
                  <div class="border-bottom py-1">
                    <div class="d-flex justify-content-between align-items-center">
                      <span class="small fw-semibold">${esc(a.title)}</span>
                      <span class="d-flex gap-1">
                        <button class="btn btn-sm btn-outline-navy py-0 px-1" data-toggle-edit-announcement="${a.id}" title="Edit">✎</button>
                        <button class="btn btn-sm btn-outline-danger py-0 px-2" data-remove-announcement="${a.id}">×</button>
                      </span>
                    </div>
                    <form class="d-none mt-2 mb-2" data-edit-announcement-form="${a.id}" id="edit-announcement-form-${a.id}">
                      <input class="form-control form-control-sm mb-2" name="title" value="${esc(a.title)}" required />
                      <textarea class="form-control form-control-sm mb-2" name="content">${esc(a.content || "")}</textarea>
                      <div class="d-flex gap-2">
                        <button class="btn btn-sm btn-navy" type="submit">Save</button>
                        <button class="btn btn-sm btn-outline-navy" type="button" data-cancel-edit-announcement="${a.id}">Cancel</button>
                      </div>
                    </form>
                  </div>`
                    )
                    .join("")}
                </div>
              </div>
            </div>
          </div>`;

        document.getElementById("site-logo-input").addEventListener("change", async (e) => {
          const file = e.target.files[0];
          if (!file) return;
          const fd = new FormData();
          fd.append("logo", file);
          await api.post("/admin/settings/logo", fd);
        });

        document.getElementById("settings-form").addEventListener("submit", async (e) => {
          e.preventDefault();
          const payload = {};
          contentEl.querySelectorAll("[data-setting]").forEach((el) => (payload[el.getAttribute("data-setting")] = el.value));
          await api.put("/admin/settings", payload);
          alert("Settings saved");
        });

        contentEl.querySelectorAll("[data-add-item]").forEach((btn) => {
          btn.addEventListener("click", async () => {
            const section = btn.getAttribute("data-add-item");
            const input = contentEl.querySelector(`[data-new-item="${section}"]`);
            const text = input.value;
            if (!text || !text.trim()) return;
            const count = itemsFor(section).length;
            await api.post("/admin/about-items", { section, text, sort_order: count });
            renderSiteContentTab();
          });
        });
        contentEl.querySelectorAll("[data-edit-item]").forEach((btn) => {
          btn.addEventListener("click", async () => {
            const id = btn.getAttribute("data-edit-item");
            const item = aboutItems.find((i) => String(i.id) === id);
            if (!item) return;
            const text = prompt("Edit text:", item.text);
            if (text === null || !text.trim()) return;
            try {
              await api.put(`/admin/about-items/${id}`, { text, sort_order: item.sort_order || 0 });
              renderSiteContentTab();
            } catch (err) {
              alert(err.data?.error || "Failed to update item");
            }
          });
        });
        contentEl.querySelectorAll("[data-remove-item]").forEach((btn) => {
          btn.addEventListener("click", async () => {
            if (!confirmDestructive("Delete this item?")) return;
            await api.del(`/admin/about-items/${btn.getAttribute("data-remove-item")}`);
            renderSiteContentTab();
          });
        });

        document.getElementById("announcement-form").addEventListener("submit", async (e) => {
          e.preventDefault();
          const fd = new FormData(e.target);
          const payload = Object.fromEntries(fd.entries());
          if (!payload.title || !payload.title.trim()) return;
          await api.post("/admin/announcements", payload);
          renderSiteContentTab();
        });
        contentEl.querySelectorAll("[data-toggle-edit-announcement]").forEach((btn) => {
          btn.addEventListener("click", () => {
            document.getElementById(`edit-announcement-form-${btn.getAttribute("data-toggle-edit-announcement")}`).classList.toggle("d-none");
          });
        });
        contentEl.querySelectorAll("[data-cancel-edit-announcement]").forEach((btn) => {
          btn.addEventListener("click", () => {
            document.getElementById(`edit-announcement-form-${btn.getAttribute("data-cancel-edit-announcement")}`).classList.add("d-none");
          });
        });
        contentEl.querySelectorAll("[data-edit-announcement-form]").forEach((form) => {
          form.addEventListener("submit", async (e) => {
            e.preventDefault();
            const id = form.getAttribute("data-edit-announcement-form");
            const fd = new FormData(form);
            const payload = Object.fromEntries(fd.entries());
            if (!payload.title || !payload.title.trim()) return;
            try {
              await api.put(`/admin/announcements/${id}`, payload);
              renderSiteContentTab();
            } catch (err) {
              alert(err.data?.error || "Failed to update announcement");
            }
          });
        });
        contentEl.querySelectorAll("[data-remove-announcement]").forEach((btn) => {
          btn.addEventListener("click", async () => {
            if (!confirmDestructive("Delete this announcement?")) return;
            await api.del(`/admin/announcements/${btn.getAttribute("data-remove-announcement")}`);
            renderSiteContentTab();
          });
        });

        document.getElementById("document-form").addEventListener("submit", async (e) => {
          e.preventDefault();
          const fd = new FormData(e.target);
          if (!fd.get("title") || !fd.get("file") || fd.get("file").size === 0) return;
          await api.post("/admin/documents", fd);
          renderSiteContentTab();
        });
        contentEl.querySelectorAll("[data-remove-doc]").forEach((btn) => {
          btn.addEventListener("click", async () => {
            await api.del(`/admin/documents/${btn.getAttribute("data-remove-doc")}`);
            renderSiteContentTab();
          });
        });
      })
      .catch(() => {
        contentEl.innerHTML = `<p class="text-danger">Failed to load site content.</p>`;
      });
  }

  renderTabNav();
  renderCurrentTab();
}
