import { useEffect, useState } from "react";
import { useAuth } from "../api/AuthContext";

// Reads the 'exp' claim out of the JWT (base64-decoded client-side, not
// re-verified — this is only a UI convenience, the server independently
// enforces the real expiry on every request) and warns a few minutes before
// the session lapses, so a logged-in admin/author/reviewer isn't surprised
// mid-task by suddenly being logged out.
const WARNING_WINDOW_MS = 5 * 60 * 1000;

function getTokenExpiry() {
  try {
    const token = localStorage.getItem("siahssr_token");
    if (!token) return null;
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return payload.exp ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

export default function SessionTimeoutBanner() {
  const { user, logout } = useAuth();
  const [minutesLeft, setMinutesLeft] = useState(null);

  useEffect(() => {
    if (!user) {
      setMinutesLeft(null);
      return;
    }
    const check = () => {
      const exp = getTokenExpiry();
      if (!exp) return setMinutesLeft(null);
      const msLeft = exp - Date.now();
      setMinutesLeft(msLeft > 0 && msLeft <= WARNING_WINDOW_MS ? Math.ceil(msLeft / 60000) : null);
    };
    check();
    const interval = setInterval(check, 30000);
    return () => clearInterval(interval);
  }, [user]);

  if (!user || minutesLeft === null) return null;

  return (
    <div className="alert alert-warning py-2 px-3 mb-0 rounded-0 text-center small" role="alert">
      Your session expires in about {minutesLeft} minute{minutesLeft !== 1 ? "s" : ""}.{" "}
      <button className="btn btn-sm btn-outline-dark ms-2 py-0" onClick={logout}>Log out now</button>
    </div>
  );
}
