// Public, no-account paper submission: pay via UPI, self-declare the
// payment (checkbox + reference number — there's no payment gateway wired
// up, so this is a manual/self-declared confirmation admin verifies before
// review), then fill in the 7 fields and attach the .docx.

api
  .get("/journals")
  .then((journals) => {
    const select = document.getElementById("journal-select");
    journals.forEach((j) => {
      const opt = document.createElement("option");
      opt.value = j.id;
      opt.textContent = `${j.name} (${j.short_name})`;
      select.appendChild(opt);
    });
  })
  .catch(() => {});

document.getElementById("copy-upi").addEventListener("click", (e) => {
  navigator.clipboard?.writeText("sreeparanthaman-5@okicici").then(() => {
    const btn = e.currentTarget;
    const original = btn.innerHTML;
    btn.innerHTML = '<i class="bi bi-check2"></i>';
    setTimeout(() => (btn.innerHTML = original), 1500);
  });
});

const referenceInput = document.getElementById("payment-reference");
const confirmCheckbox = document.getElementById("payment-confirmed");
const fieldset = document.getElementById("submit-fieldset");
const stepConfirm = document.getElementById("step-confirm");

function updateGate() {
  const unlocked = confirmCheckbox.checked && referenceInput.value.trim().length > 0;
  fieldset.disabled = !unlocked;
  stepConfirm.classList.toggle("step-done", unlocked);
}
referenceInput.addEventListener("input", updateGate);
confirmCheckbox.addEventListener("change", updateGate);

const captcha = mountCaptcha(document.getElementById("captcha-slot"));
const form = document.getElementById("submit-form");
const errorBox = document.getElementById("submit-error");
const submitBtn = document.getElementById("submit-btn");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  errorBox.style.display = "none";

  if (!confirmCheckbox.checked || !referenceInput.value.trim()) {
    errorBox.textContent = "Please confirm your payment and enter the UPI transaction/reference number first";
    errorBox.style.display = "";
    return;
  }

  const file = document.getElementById("paper-file-input").files[0];
  if (!file) {
    errorBox.textContent = "Please attach your article as a Word (.docx) file";
    errorBox.style.display = "";
    return;
  }
  const isDocxType = file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  const isDocxExt = file.name.toLowerCase().endsWith(".docx");
  if (!isDocxType || !isDocxExt) {
    errorBox.textContent = "Only Word (.docx) files are allowed";
    errorBox.style.display = "";
    return;
  }
  if (file.size > 15 * 1024 * 1024) {
    errorBox.textContent = "File size must be less than 15MB";
    errorBox.style.display = "";
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = "Submitting…";
  try {
    const fd = new FormData(form);
    fd.append("payment_reference", referenceInput.value.trim());
    const { captchaToken, captchaAnswer } = captcha.getPayload();
    fd.append("captchaToken", captchaToken);
    fd.append("captchaAnswer", captchaAnswer);
    fd.append("file", file);
    const data = await api.post("/public/submit", fd);

    document.getElementById("submit-form-wrap").style.display = "none";
    const resultBlock = document.getElementById("submit-result");
    resultBlock.style.display = "";
    document.getElementById("submit-result-message").textContent = data.message;
  } catch (err) {
    errorBox.textContent = err.data?.error || "Failed to submit your paper";
    errorBox.style.display = "";
    captcha.reset();
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Submit Paper";
  }
});
