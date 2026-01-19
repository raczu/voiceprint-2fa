import { useAuth } from "@/context/auth-provider";
import { Navigate, Outlet } from "react-router-dom";

export const PublicRoute = () => {
  const { status } = useAuth();

  switch (status) {
    case "UNAUTHENTICATED":
      return <Outlet />;
    case "AUTHENTICATED":
      return <Navigate to="/" replace />;
    case "PENDING_2FA":
      return <Navigate to="/verify-2fa" replace />;
    case "ONBOARDING_REQUIRED":
      return <Navigate to="/complete-profile" replace />;
    default:
      return <Navigate to="/" replace />;
  }
};
