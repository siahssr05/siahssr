// Small shared helpers used across every page's JS. Kept dependency-free —
// same "no npm install required" constraint the React build's hand-rolled
// captcha/charts followed.

const STATUS_LABELS = {
  submitted: "Submitted",
  under_review: "Under Review",
  accepted: "Accepted",
  rejected: "Rejected",
  published: "Published",
  withdrawn: "Withdrawn",
};

// Every page below builds markup with template strings and innerHTML instead
// of React's auto-escaping JSX, so any dynamic/DB-sourced text MUST be passed
// through esc() before landing in a template — titles, names, messages, FAQ
// text, admin-entered content, all of it.
function esc(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function statusBadgeHtml(status) {
  return `<span class="badge badge-status-${esc(status)}">${esc(STATUS_LABELS[status] || status)}</span>`;
}

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString();
}

function formatDateTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

function getParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

function debounce(fn, wait) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

// Type-to-confirm safeguard for destructive admin actions — a plain confirm()
// dialog is too easy to click through by habit. Mirrors the React build.
function confirmDestructive(message, expectedWord = "DELETE") {
  const typed = prompt(`${message}\n\nType "${expectedWord}" to confirm.`);
  return typed === expectedWord;
}

// Renders Previous/Page N of M/Next controls into `container` and calls
// onChange(newPage) when either button is pressed. No-ops when there's only
// one page, matching the React PageControls component.
function renderPagination(container, page, pages, onChange) {
  if (!container) return;
  if (pages <= 1) {
    container.innerHTML = "";
    return;
  }
  container.innerHTML = `
    <div class="pagination-controls">
      <button class="btn btn-sm btn-outline-navy" data-prev ${page <= 1 ? "disabled" : ""}>Previous</button>
      <span class="small text-muted">Page ${page} of ${pages}</span>
      <button class="btn btn-sm btn-outline-navy" data-next ${page >= pages ? "disabled" : ""}>Next</button>
    </div>`;
  container.querySelector("[data-prev]")?.addEventListener("click", () => onChange(page - 1));
  container.querySelector("[data-next]")?.addEventListener("click", () => onChange(page + 1));
}

// Sets document.title + a couple of meta tags + optional JSON-LD for pages
// whose content (and therefore title) is only known after a fetch resolves
// (paper-detail, author-profile). Static pages just hardcode <title> in HTML
// and don't need this.
function setSEO({ title, description, jsonLd } = {}) {
  if (title) document.title = title;

  function upsertMeta(attr, key, content) {
    if (!content) return;
    let tag = document.querySelector(`meta[${attr}="${key}"]`);
    if (!tag) {
      tag = document.createElement("meta");
      tag.setAttribute(attr, key);
      document.head.appendChild(tag);
    }
    tag.setAttribute("content", content);
  }

  upsertMeta("name", "description", description);
  upsertMeta("property", "og:title", title);
  upsertMeta("property", "og:description", description);

  if (jsonLd) {
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.textContent = JSON.stringify(jsonLd);
    document.head.appendChild(script);
  }
}

function groupByVolumeIssue(papers) {
  const byJournal = {};
  papers.forEach((p) => {
    const journalKey = p.short_name || "Other";
    byJournal[journalKey] ??= {};
    const volKey = p.volume || "Unspecified Volume";
    byJournal[journalKey][volKey] ??= {};
    const issueKey = p.issue || "Unspecified Issue";
    byJournal[journalKey][volKey][issueKey] ??= [];
    byJournal[journalKey][volKey][issueKey].push(p);
  });
  return byJournal;
}
