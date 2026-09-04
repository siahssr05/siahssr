import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import client from "../api/client";

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const [status, setStatus] = useState("checking");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const token = params.get("token");
    if (!token) {
      setStatus("error");
      setMessage("Missing verification token.");
      return;
    }
    client
      .get(`/auth/verify/${token}`)
      .then(({ data }) => {
        setStatus("success");
        setMessage(data.message);
      })
      .catch((err) => {
        setStatus("error");
        setMessage(err.response?.data?.error || "Verification failed.");
      });
  }, [params]);

  return (
    <div className="container py-5 text-center" style={{ maxWidth: 480 }}>
      <h1 className="brand-font mb-3">Email Verification</h1>
      {status === "checking" && <p>Verifying…</p>}
      {status !== "checking" && <p className={status === "error" ? "text-danger" : ""}>{message}</p>}
      {status === "success" && <Link to="/login" className="btn btn-navy mt-2">Go to Login</Link>}
    </div>
  );
}
