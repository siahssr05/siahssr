document.getElementById("forgot-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = new FormData(e.target).get("email");
  const data = await api.post("/auth/forgot-password", { email });
  e.target.style.display = "none";
  const messageEl = document.getElementById("forgot-message");
  messageEl.textContent = data.message;
  messageEl.style.display = "";
});
