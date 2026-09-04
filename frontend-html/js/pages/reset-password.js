document.getElementById("reset-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const errorBox = document.getElementById("reset-error");
  errorBox.style.display = "none";
  const newPassword = new FormData(e.target).get("newPassword");
  try {
    const data = await api.post("/auth/reset-password", { token: getParam("token"), newPassword });
    e.target.style.display = "none";
    const messageEl = document.getElementById("reset-message");
    messageEl.textContent = data.message;
    messageEl.style.display = "";
    setTimeout(() => (window.location.href = "/login-admin.html"), 1500);
  } catch (err) {
    errorBox.textContent = err.data?.error || "Something went wrong";
    errorBox.style.display = "";
  }
});
