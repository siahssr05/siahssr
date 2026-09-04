import { Navigate } from "react-router-dom";
import { useAuth } from "../api/AuthContext";

export default function ProtectedRoute({ roles, children }) {
  const { user } = useAuth();
  if (!user) {
    const target = roles && roles.length === 1 ? `/login/${roles[0]}` : "/login";
    return <Navigate to={target} replace />;
  }
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}
