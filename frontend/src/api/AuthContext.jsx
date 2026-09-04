import { createContext, useContext, useEffect, useState } from "react";
import client from "./client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem("siahssr_user");
    return saved ? JSON.parse(saved) : null;
  });

  useEffect(() => {
    if (user) localStorage.setItem("siahssr_user", JSON.stringify(user));
    else localStorage.removeItem("siahssr_user");
  }, [user]);

  async function login(email, password) {
    const { data } = await client.post("/auth/login", { email, password });
    if (data.token) localStorage.setItem("siahssr_token", data.token);
    setUser(data.user);
    return data.user;
  }

  async function register(payload) {
    const { data } = await client.post("/auth/register", payload);
    return data;
  }

  function logout() {
    client.post("/auth/logout").catch(() => {});
    localStorage.removeItem("siahssr_token");
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
