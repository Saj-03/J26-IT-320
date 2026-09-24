import { createContext, useContext, useEffect, useState } from "react";
import api, { tokenStore } from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tokenStore.get()) return setLoading(false);
    api.get("/auth/me")
      .then((r) => setUser(r.data))
      .catch((err) => { if (err.response?.status === 401) tokenStore.clear(); })
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password, remember = true) => {
    const form = new URLSearchParams({ username: email.trim(), password });
    const { data } = await api.post("/auth/login", form);
    tokenStore.set(data.access_token, remember);
    const me = await api.get("/auth/me");
    setUser(me.data);
  };

  const register = async (form) => {
    await api.post("/auth/register", form);
    await login(form.email, form.password, true);
  };

  const logout = () => { tokenStore.clear(); setUser(null); };

  return <AuthContext.Provider value={{ user, loading, login, register, logout }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
