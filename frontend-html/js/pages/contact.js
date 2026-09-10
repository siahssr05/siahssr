api
  .get("/public/settings")
  .then((settings) => {
    document.getElementById("contact-phone1").textContent = settings.contact_phone_1 || "";
    document.getElementById("contact-phone2").textContent = settings.contact_phone_2 || "";
    document.getElementById("contact-email").textContent = settings.contact_email || "";
    document.getElementById("contact-address").textContent = settings.contact_address || "";
  })
  .catch(() => {});

const captcha = mountCaptcha(document.getElementById("captcha-slot"));
const form = document.getElementById("contact-form");
const errorBox = document.getElementById("contact-error");
const submitBtn = document.getElementById("contact-submit");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  errorBox.style.display = "none";
  submitBtn.disabled = true;
  submitBtn.textContent = "Sending…";
  const fd = new FormData(form);
  const payload = Object.fromEntries(fd.entries());
  Object.assign(payload, captcha.getPayload());
  try {
    await api.post("/public/contact", payload);
    form.style.display = "none";
    document.getElementById("contact-sent").style.display = "";
  } catch (err) {
    errorBox.textContent = err.data?.error || "Failed to send your message. Please try again.";
    errorBox.style.display = "";
    captcha.reset();
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Send Message";
  }
});
