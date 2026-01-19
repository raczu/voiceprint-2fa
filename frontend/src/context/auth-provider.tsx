import React, { createContext, useContext, useState, useEffect } from "react";
import { jwtDecode } from "jwt-decode";
import api from "@/lib/api";
import { TokenScope, type AuthStatus, type JWTPayload, type User } from "@/types/auth";
import {
  authResponseSchema,
  voiceEnrollmentSchema,
  type LoginCredentials,
  type RegisterFormValues,
} from "@/schemas/auth";

type ScopeHandler = {
  scope: string;
  status: AuthStatus;
  onMatch?: () => void;
};

const SCOPE_RULES: ScopeHandler[] = [
  {
    scope: TokenScope.FULL_ACCESS,
    status: "AUTHENTICATED",
    onMatch: () => localStorage.removeItem("phrase"),
  },
  {
    scope: TokenScope.TWO_FACTOR_REQUIRED,
    status: "PENDING_2FA",
  },
  {
    scope: TokenScope.ONBOARDING_REQUIRED,
    status: "ONBOARDING_REQUIRED",
  },
];

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  token: string | null;
  status: AuthStatus;
  phrase: string | null;

  login: (credentials: LoginCredentials) => Promise<void>;
  verifyVoice: (file: File) => Promise<void>;

  register: (data: RegisterFormValues) => Promise<void>;
  enrollVoice: (files: File[]) => Promise<void>;

  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem("token"));
  const [phrase, setPhrase] = useState<string | null>(localStorage.getItem("phrase"));
  const [status, setStatus] = useState<AuthStatus>("UNAUTHENTICATED");

  const fetchProfile = async () => {
    try {
      const { data } = await api.get<User>("/api/v1/users/me");
      setUser(data);
    } catch (error) {
      console.error("Failed to fetch profile", error);
      logout();
    }
  };

  const syncStateWithToken = async (newToken: string, newPhrase?: string) => {
    localStorage.setItem("token", newToken);
    setToken(token);

    api.defaults.headers.common["Authorization"] = `Bearer ${newToken}`;

    if (newPhrase) {
      localStorage.setItem("phrase", newPhrase);
      setPhrase(newPhrase);
    }

    try {
      const decoded = jwtDecode<JWTPayload>(newToken);
      const scopes = decoded.scopes || [];
      const matchedRule = SCOPE_RULES.find((rule) => scopes.includes(rule.scope));

      if (matchedRule) {
        setStatus(matchedRule.status);
        if (matchedRule.onMatch) {
          matchedRule.onMatch();
          setPhrase(null);
        }

        if (matchedRule.status === "AUTHENTICATED") {
          await fetchProfile();
        }
      }
    } catch (err) {
      console.error("Failed to decode JWT token", err);
      logout();
    }
  };

  useEffect(() => {
    const storedToken = localStorage.getItem("token");
    if (storedToken) {
      syncStateWithToken(storedToken, phrase || undefined);
    }
  }, []);

  const login = async (credentials: LoginCredentials) => {
    const formData = new FormData();
    formData.append("username", credentials.email);
    formData.append("password", credentials.password);

    const { data } = await api.post("/api/v1/auth/login", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });

    const parsed = authResponseSchema.parse(data);
    await syncStateWithToken(parsed.accessToken, parsed.phrase);
  };

  const verifyVoice = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);

    const { data } = await api.post("/api/v1/auth/login/verify-voice", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });

    const parsed = authResponseSchema.parse(data);
    await syncStateWithToken(parsed.accessToken);
  };

  const register = async (values: RegisterFormValues) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { confirmPassword, ...payload } = values;

    const { data } = await api.post("/api/v1/auth/register", payload);

    const parsed = authResponseSchema.parse(data);
    await syncStateWithToken(parsed.accessToken, parsed.phrase);
  };

  const enrollVoice = async (files: File[]) => {
    const validation = voiceEnrollmentSchema.safeParse({ files });
    if (!validation.success) {
      const msg = validation.error.issues[0]?.message || "Błąd walidacji plików";
      throw new Error(msg);
    }

    const formData = new FormData();
    files.forEach((file) => {
      formData.append("files", file);
    });

    const { data } = await api.post("/api/v1/auth/register/enroll-voice", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });

    const parsed = authResponseSchema.parse(data);
    await syncStateWithToken(parsed.accessToken);
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("phrase");
    delete api.defaults.headers.common["Authorization"];

    setUser(null);
    setToken(null);
    setPhrase(null);
    setStatus("UNAUTHENTICATED");
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: status === "AUTHENTICATED",
        token,
        status,
        phrase,
        login,
        verifyVoice,
        register,
        enrollVoice,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
};
