// Loads the shared navbar/footer into every page's #app-navbar / #app-footer
// placeholders, then wires up the bits that depend on auth state and site
// settings — the vanilla equivalent of React's <Navbar>/<Footer> components
// plus the top-level <SessionTimeoutBanner/> that used to sit above them in
// App.jsx. Runs automatically on DOMContentLoaded; include this script on
// every page after api.js and utils.js.

const WARNING_WINDOW_MS = 5 * 60 * 1000;

function getTokenExpiryMs() {
  try {
    const token = AUTH.getToken();
    if (!token) return null;
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return payload.exp ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

function mountSessionBanner() {
  const user = AUTH.getUser();
  if (!user) return;

  function tick() {
    const expiry = getTokenExpiryMs();
    let banner = document.getElementById("session-timeout-banner");
    if (!expiry) {
      if (banner) banner.remove();
      return;
    }
    const minutesLeft = Math.ceil((expiry - Date.now()) / 60000);
    if (minutesLeft > 5) {
      if (banner) banner.remove();
      return;
    }
    if (minutesLeft <= 0) {
      // Token has actually expired — clear stale local state so the navbar
      // stops claiming the visitor is logged in.
      AUTH.clear();
      if (banner) banner.remove();
      return;
    }
    if (!banner) {
      banner = document.createElement("div");
      banner.id = "session-timeout-banner";
      banner.className = "session-banner";
      document.body.prepend(banner);
    }
    banner.innerHTML = `Your session expires in about ${minutesLeft} minute${minutesLeft === 1 ? "" : "s"}. <button class="btn btn-sm btn-outline-dark" id="session-logout-now">Log out now</button>`;
    banner.querySelector("#session-logout-now").addEventListener("click", async () => {
      await logout();
      window.location.href = "/";
    });
  }

  tick();
  setInterval(tick, 30000);
}

async function mountNavAndFooter() {
  const navSlot = document.getElementById("app-navbar");
  const footerSlot = document.getElementById("app-footer");

  const [navHtml, footerHtml] = await Promise.all([
    navSlot ? fetch("/partials/navbar.html").then((r) => r.text()) : Promise.resolve(""),
    footerSlot ? fetch("/partials/footer.html").then((r) => r.text()) : Promise.resolve(""),
  ]);
  if (navSlot) navSlot.innerHTML = navHtml;
  if (footerSlot) footerSlot.innerHTML = footerHtml;

  // Active-link highlight — each page sets <body data-page="...">
  const activePage = document.body.getAttribute("data-page");
  if (activePage) {
    document.querySelectorAll(`[data-nav="${activePage}"]`).forEach((el) => el.classList.add("active"));
  }

  // Auth-aware nav: only admins ever have a session now (author/reviewer
  // accounts and public login/signup were retired — see submit-paper.html),
  // so this just toggles the admin dashboard link + Logout vs. the guest
  // "Submit a Paper" button and the footer's low-key Admin Login link.
  const user = AUTH.getUser();
  document.querySelectorAll("[data-guest-only]").forEach((el) => (el.style.display = user ? "none" : ""));
  document.querySelectorAll("[data-user-only]").forEach((el) => (el.style.display = user ? "" : "none"));
  if (user) {
    const dashboardPath = "/dashboard-admin.html";
    const dashLink = document.getElementById("navbar-dashboard-link");
    const nameEl = document.getElementById("navbar-user-name");
    if (dashLink) dashLink.href = dashboardPath;
    if (nameEl) nameEl.textContent = (user.name || "").split(" ")[0];
    document.getElementById("navbar-logout-btn")?.addEventListener("click", async () => {
      await logout();
      window.location.href = "/";
    });
  }

  // Site settings: navbar logo, footer subtitle/contact info.
  api
    .get("/public/settings")
    .then((settings) => {
      if (settings.site_logo) {
        const navLogo = document.getElementById("navbar-logo");
        const footLogo = document.getElementById("footer-logo");
        if (navLogo) {
          navLogo.src = fileUrl(settings.site_logo);
          navLogo.onerror = () => (navLogo.src = "/logo-site.png");
        }
        if (footLogo) {
          footLogo.src = fileUrl(settings.site_logo);
          footLogo.onerror = () => (footLogo.src = "/logo-site.png");
        }
      }
      const setText = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value || "";
      };
      setText("footer-subtitle", settings.hero_subtitle);
      setText("footer-phone1", settings.contact_phone_1);
      setText("footer-phone2", settings.contact_phone_2);
      setText("footer-email", settings.contact_email);
      setText("footer-address", settings.contact_address);
    })
    .catch(() => {});

  const yearEl = document.getElementById("footer-year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  mountSessionBanner();
}

document.addEventListener("DOMContentLoaded", mountNavAndFooter);
