import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { TestRecorder } from "@/pages/test-recoder.tsx";
import { ThemeProvider } from "@/context/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/context/auth-provider";
import { ProtectedRoute } from "@/components/private-route";
import { PublicRoute } from "@/components/public-route";
import { LoginPage } from "@/pages/login.tsx";
import { RegisterPage } from "@/pages/register.tsx";
import { VerifyVoicePage } from "@/pages/verify-voice.tsx";
import { EnrollVoicePage } from "@/pages/enroll-voice.tsx";
import { StepRoute } from "@/components/step-route.tsx";
import { Home } from "@/pages/home.tsx";
import { DashboardPage } from "@/pages/dashboard";

function App() {
  const environment = import.meta.env.ENVIRONMENT || import.meta.env.MODE;
  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <Toaster position="bottom-right" />
      <Router>
        <AuthProvider>
          <Routes>
            <Route element={<PublicRoute />}>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
            </Route>

            <Route path="/" element={<Home />} />

            {environment === "development" && (
              <Route path="/test-recorder" element={<TestRecorder />} />
            )}

            <Route element={<StepRoute requiredStatus="PENDING_2FA" />}>
              <Route path="/verify-2fa" element={<VerifyVoicePage />} />
            </Route>

            <Route element={<StepRoute requiredStatus="ONBOARDING_REQUIRED" />}>
              <Route path="/complete-profile" element={<EnrollVoicePage />} />
            </Route>

            <Route element={<ProtectedRoute />}>
              <Route path="/dashboard" element={<DashboardPage />} />
            </Route>
          </Routes>
        </AuthProvider>
      </Router>
    </ThemeProvider>
  );
}

export default App;
