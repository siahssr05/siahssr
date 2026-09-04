// Login logic for login-admin.html — the only login this site has (see
// submit-paper.html for how papers get in without an account). Still keyed
// off <body data-role="admin"> / ROLE_LABELS / ROLE_HOME in case another
// role-gated login is ever added back.

const ROLE_LABELS = { admin: "Admin" };
const ROLE_HOME = { admin: "/dashboard-admin.html" };

const role = document.body.getAttribute("data-role");
const label = ROLE_LABELS[role];

document.getElementById("role-login-title").textContent = `${label} Log In`;
document.getElementById("role-login-submit").textContent = `Log In as ${label}`;

document.getElementById("toggle-password").addEventListener("click", () => {
  const input = document.getElementById("password-input");
  const icon = document.getElementById("toggle-password-icon");
  const showing = input.type === "text";
  input.type = showing ? "password" : "text";
  icon.className = showing ? "bi bi-eye" : "bi bi-eye-slash";
});

const form = document.getElementById("role-login-form");
const errorBox = document.getElementById("role-login-error");
const submitBtn = document.getElementById("role-login-submit");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  errorBox.style.display = "none";
  submitBtn.disabled = true;
  submitBtn.textContent = "Logging in…";
  const email = document.getElementById("email-input").value;
  const password = document.getElementById("password-input").value;
  try {
    const user = await login(email, password);
    if (user.role !== role) {
      await logout();
      const actualLabel = ROLE_LABELS[user.role] || user.role;
      errorBox.textContent = `This account is registered as ${actualLabel}, not ${label}. Please use the ${actualLabel} login instead.`;
      errorBox.style.display = "";
      return;
    }
    window.location.href = ROLE_HOME[role];
  } catch (err) {
    errorBox.textContent = err.data?.error || "Something went wrong, try again";
    errorBox.style.display = "";
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = `Log In as ${label}`;
  }
});
