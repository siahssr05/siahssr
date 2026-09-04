import { useState } from "react";
import client from "../api/client";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    const { data } = await client.post("/auth/forgot-password", { email });
    setMessage(data.message);
  }

  return (
    <div className="container py-5" style={{ maxWidth: 420 }}>
      <h1 className="brand-font mb-4 text-center">Forgot Password</h1>
      {message ? (
        <p className="text-center">{message}</p>
      ) : (
        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label className="form-label">Email</label>
            <input type="email" className="form-control" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <button className="btn btn-navy w-100">Send Reset Link</button>
        </form>
      )}
    </div>
  );
}
