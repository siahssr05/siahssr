// Dependency-free math captcha widget (vanilla-JS port of components/Captcha.jsx).
// Mounts into any container element and returns { getPayload, reset }, so a
// form's submit handler can spread getPayload() into its request body and
// call reset() after a failed submit to fetch a fresh question — same
// contract the React version exposed via a ref.

function mountCaptcha(container, label = "Quick check") {
  let token = "";

  container.innerHTML = `
    <div class="mb-3">
      <label class="form-label small text-muted">${esc(label)}: <span data-captcha-q>…</span></label>
      <input type="number" class="form-control" required data-captcha-answer placeholder="Your answer" />
    </div>`;

  const qEl = container.querySelector("[data-captcha-q]");
  const answerEl = container.querySelector("[data-captcha-answer]");

  function load() {
    answerEl.value = "";
    qEl.textContent = "…";
    api
      .get("/public/captcha")
      .then((data) => {
        token = data.token;
        qEl.textContent = data.question;
      })
      .catch(() => {
        qEl.textContent = "unavailable — refresh the page";
      });
  }

  load();

  return {
    getPayload: () => ({ captchaToken: token, captchaAnswer: answerEl.value }),
    reset: load,
  };
}
