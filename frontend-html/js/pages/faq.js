api
  .get("/faq")
  .then((faqs) => {
    if (!faqs || faqs.length === 0) return;
    const grouped = faqs.reduce((acc, f) => {
      (acc[f.category] = acc[f.category] || []).push(f);
      return acc;
    }, {});

    document.getElementById("faq-list").innerHTML = Object.entries(grouped)
      .map(([category, items]) => {
        const accordionId = `acc-${esc(category).replace(/[^a-z0-9]/gi, "")}`;
        const itemsHtml = items
          .map(
            (f) => `
          <div class="accordion-item">
            <h2 class="accordion-header">
              <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#faq-${f.id}">${esc(f.question)}</button>
            </h2>
            <div id="faq-${f.id}" class="accordion-collapse collapse" data-bs-parent="#${accordionId}">
              <div class="accordion-body">${esc(f.answer)}</div>
            </div>
          </div>`
          )
          .join("");
        return `
        <div class="mb-4">
          <h5 class="brand-font text-gold text-capitalize mb-3">${esc(category)}</h5>
          <div class="accordion" id="${accordionId}">${itemsHtml}</div>
        </div>`;
      })
      .join("");
  })
  .catch(() => {});
