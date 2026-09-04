import { useEffect, useState } from "react";
import client from "../api/client";

export default function FAQ() {
  const [faqs, setFaqs] = useState([]);

  useEffect(() => {
    client.get("/faq").then(({ data }) => setFaqs(data)).catch(() => {});
  }, []);

  const grouped = faqs.reduce((acc, f) => {
    (acc[f.category] = acc[f.category] || []).push(f);
    return acc;
  }, {});

  return (
    <div className="container py-5" style={{ maxWidth: 760 }}>
      <h1 className="brand-font mb-4">Frequently Asked Questions</h1>
      {Object.keys(grouped).length === 0 && <p className="text-muted">FAQs will appear here once added.</p>}
      {Object.entries(grouped).map(([category, items]) => (
        <div key={category} className="mb-4">
          <h5 className="brand-font text-gold text-capitalize mb-3">{category}</h5>
          <div className="accordion" id={`acc-${category}`}>
            {items.map((f, i) => (
              <div className="accordion-item" key={f.id}>
                <h2 className="accordion-header">
                  <button className="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target={`#faq-${f.id}`}>
                    {f.question}
                  </button>
                </h2>
                <div id={`faq-${f.id}`} className="accordion-collapse collapse" data-bs-parent={`#acc-${category}`}>
                  <div className="accordion-body">{f.answer}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
