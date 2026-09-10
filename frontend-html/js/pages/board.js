// The admin dashboard now has proper Email/Phone fields on the board member
// form — for any member entered (or re-saved) since, m.email/m.phone are the
// real source. Older members added before that field existed may still only
// have the contact info buried inside the free-text designation/affiliation/
// bio paragraph, so as a fallback for those, extractEmail/extractPhone below
// pull a best-effort match out of that text. Either the real field or the
// fallback, the card shows just the person's name plus an email and phone
// number, each on its own labeled line — never the raw paragraph, and either
// line is simply left out when nothing could be found (never shown blank).
function extractEmail(text) {
  // A lookbehind blocks the match from starting mid-word, and a lookahead
  // rejects a match that starts with a run of 4+ digits then a letter (a
  // phone number run straight into an address with no separator, e.g.
  // "Cell:09578779766kannan@..." — those digits aren't part of the real
  // email). Better to find nothing than build a wrong address out of it.
  const m = text.match(
    /(?<![A-Za-z0-9._%+-])(?!\d{4,}[A-Za-z])([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/
  );
  return m ? m[1] : null;
}

function extractPhone(text) {
  // Indian mobile numbers: 10 digits starting 6-9, optional +91/91 prefix.
  // \b on both ends means a number glued directly onto letters with no
  // separator (the same messy pattern as above) simply won't match — left
  // out rather than guessed at.
  const m = text.match(/\b(?:\+?91[-\s]?)?[6-9]\d{9}\b/);
  return m ? m[0] : null;
}

api
  .get("/board")
  .then((members) => {
    if (!members || members.length === 0) return;
    document.getElementById("board-list").innerHTML = members
      .map((m) => {
        const blob = [m.designation, m.affiliation, m.bio].filter(Boolean).join(" ");
        const email = m.email || extractEmail(blob);
        const phone = m.phone || extractPhone(blob);
        return `
      <div class="col-md-6 col-lg-4">
        <div class="card-siahssr p-3 h-100 text-center">
          <img src="${esc(m.photo_path ? fileUrl(m.photo_path) : "/logo-site.png")}" alt="${esc(m.name)}" class="rounded-circle mx-auto mb-2" style="width:88px;height:88px;object-fit:cover;" />
          <h6 class="fw-bold mb-1">${esc(m.name)}</h6>
          ${m.journal_short_name ? `<span class="badge bg-navy mb-2">${esc(m.journal_short_name)} Board</span>` : ""}
          ${m.expertise ? `<p class="small text-gold mb-2">${esc(m.expertise)}</p>` : ""}
          <div class="board-card-details text-start">
            ${email ? `<p class="small mb-1"><strong>Email:</strong> <a href="mailto:${esc(email)}">${esc(email)}</a></p>` : ""}
            ${phone ? `<p class="small mb-0"><strong>Phone Number:</strong> ${esc(phone)}</p>` : ""}
          </div>
        </div>
      </div>`;
      })
      .join("");
  })
  .catch(() => {});
