api
  .get("/public/settings")
  .then((settings) => {
    document.getElementById("guidelines-text").textContent = settings.guidelines_text || "";
  })
  .catch(() => {});
