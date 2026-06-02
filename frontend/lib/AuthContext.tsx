"use client";

import React, { createContext, useContext, useEffect, useState, useMemo } from "react";
import Keycloak, { KeycloakProfile } from "keycloak-js";
import { setAuthToken, loginUser, logoutUser } from "@/services/api";

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: KeycloakProfile | null;
  token: string | null;
  login: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const [keycloakInstance, setKeycloakInstance] = useState<Keycloak | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<KeycloakProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    // Only run in client browser
    if (typeof window === "undefined") return;

    const url = process.env.NEXT_PUBLIC_KEYCLOAK_URL ?? "http://localhost:8080";
    const realm = process.env.NEXT_PUBLIC_KEYCLOAK_REALM ?? "myrealm";
    const clientId = process.env.NEXT_PUBLIC_KEYCLOAK_CLIENT_ID ?? "myclient";

    const kc = new Keycloak({
      url,
      realm,
      clientId,
    });

    kc.init({
      checkLoginIframe: false,
      pkceMethod: "S256",
    })
      .then((authenticated) => {
        setKeycloakInstance(kc);
        setIsAuthenticated(authenticated);
        if (authenticated && kc.token) {
          setToken(kc.token);
          setAuthToken(kc.token);
          
          // Sync login event to backend database
          loginUser().catch((err) => {
            console.error("Failed to sync login event on backend", err);
          });

          kc.loadUserInfo()
            .then((userInfo: any) => {
              setUser({
                id: userInfo.sub,
                username: userInfo.preferred_username,
                email: userInfo.email,
                firstName: userInfo.given_name || userInfo.name,
                lastName: userInfo.family_name,
              });
            })
            .catch((err) => {
              console.error("Failed to load user info", err);
            });
        }
        setIsLoading(false);
      })
      .catch((err) => {
        console.error("Failed to initialize Keycloak", err);
        setIsLoading(false);
      });
  }, []);

  // Set up token refreshing
  useEffect(() => {
    if (!keycloakInstance || !isAuthenticated) return;

    const interval = setInterval(() => {
      keycloakInstance
        .updateToken(70) // refresh if token is valid for less than 70s
        .then((refreshed) => {
          if (refreshed && keycloakInstance.token) {
            setToken(keycloakInstance.token);
            setAuthToken(keycloakInstance.token);
          }
        })
        .catch((err) => {
          console.error("Failed to refresh token", err);
          // Force logout on token refresh failure
          logout();
        });
    }, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, [keycloakInstance, isAuthenticated]);

  const login = () => {
    if (keycloakInstance) {
      keycloakInstance.login({ prompt: "login" });
    }
  };

  const logout = async () => {
    if (keycloakInstance) {
      try {
        await logoutUser();
      } catch (err) {
        console.error("Failed to sync logout event on backend", err);
      }
      setAuthToken(null);
      keycloakInstance.logout({
        redirectUri: window.location.origin,
      });
    }
  };

  const contextValue = useMemo(() => ({
    isAuthenticated,
    isLoading,
    user,
    token,
    login,
    logout,
  }), [isAuthenticated, isLoading, user, token]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
