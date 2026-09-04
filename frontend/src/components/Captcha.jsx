import { useEffect, useState, useImperativeHandle, forwardRef } from "react";
import client from "../api/client";

/**
 * Lightweight math captcha, no external service/keys required.
 * Fetches a question+signed token from the backend, holds the visitor's
 * answer, and exposes { token, answer } to the parent form via a ref so it
 * can be attached to the submit payload as captchaToken/captchaAnswer.
 * Call `reset()` on the ref after a failed submit to fetch a fresh question.
 */
const Captcha = forwardRef(function Captcha({ label = "Quick check" }, ref) {
  const [question, setQuestion] = useState("");
  const [token, setToken] = useState("");
  const [answer, setAnswer] = useState("");

  function load() {
    setAnswer("");
    client
      .get("/public/captcha")
      .then(({ data }) => {
        setQuestion(data.question);
        setToken(data.token);
      })
      .catch(() => setQuestion(""));
  }

  useEffect(load, []);

  useImperativeHandle(ref, () => ({
    getPayload: () => ({ captchaToken: token, captchaAnswer: answer }),
    reset: load,
  }));

  return (
    <div className="mb-3">
      <label className="form-label small text-muted">
        {label}{question ? `: ${question}` : "…"}
      </label>
      <input
        type="number"
        className="form-control"
        required
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        placeholder="Your answer"
      />
    </div>
  );
});

export default Captcha;
