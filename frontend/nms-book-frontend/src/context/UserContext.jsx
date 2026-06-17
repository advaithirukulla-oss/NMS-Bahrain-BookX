/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import API, { clearStoredSession, getStoredSession, isTokenExpired, storeSession } from "../api/api";
import { DEMO_USER } from "../data/DemoData";

const UserContext = createContext(null);

export function UserProvider({ children }) {
  const [session, setSession] = useState(() => {
    const storedSession = getStoredSession();
    if (storedSession?.token && isTokenExpired(storedSession.token)) {
      clearStoredSession();
      return null;
    }
    return storedSession;
  });
  const [demoMode, setDemoMode] = useState(false);

  useEffect(() => {
    const handleUnauthorized = () => setSession(null);

    window.addEventListener("auth:unauthorized", handleUnauthorized);
    return () => window.removeEventListener("auth:unauthorized", handleUnauthorized);
  }, []);

  const login = useCallback(async (email, password) => {
    const response = await API.post("/login", { email, password });
    const nextSession = {
      token: response.data.access_token,
      user: response.data.user,
    };

    storeSession(nextSession);
    setSession(nextSession);
    return nextSession.user;
  }, []);

  const logout = useCallback(() => {
    clearStoredSession();
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    setSession(null);
    setDemoMode(false);
  }, []);

  const startDemo = useCallback(() => {
    clearStoredSession();
    setDemoMode(true);
    setSession({ token: null, user: DEMO_USER });
  }, []);

  const toggleDemoMode = useCallback(() => {
    setDemoMode((current) => {
      if (!current) return true;

      const storedSession = getStoredSession();
      if (storedSession?.token && storedSession?.user) {
        setSession(storedSession);
      }

      return false;
    });
  }, []);

  const updateUser = useCallback((updates) => {
    setSession((currentSession) => {
      if (!currentSession) return currentSession;

      const nextSession = {
        ...currentSession,
        user: { ...currentSession.user, ...updates },
      };

      if (nextSession.token) {
        storeSession(nextSession);
      }
      return nextSession;
    });
  }, []);

  const value = useMemo(
    () => ({
      user: session?.user ?? null,
      token: session?.token ?? null,
      isAuthenticated: Boolean(session?.user && (session?.token || demoMode)),
      demoMode,
      login,
      logout,
      startDemo,
      toggleDemoMode,
      updateUser,
    }),
    [demoMode, login, logout, session, startDemo, toggleDemoMode, updateUser],
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser() {
  const context = useContext(UserContext);

  if (!context) {
    throw new Error("useUser must be used inside UserProvider.");
  }

  return context;
}
