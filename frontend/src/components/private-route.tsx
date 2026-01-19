import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/context/auth-provider";

export const ProtectedRoute = () => {
  const { status } = useAuth();
  const location = useLocation();

  switch (status) {
    case "AUTHENTICATED":
      return <Outlet />;
    case "PENDING_2FA":
      return <Navigate to="/verify-2fa" replace />;
    case "ONBOARDING_REQUIRED":
      return <Navigate to="/complete-profile" replace />;
    case "UNAUTHENTICATED":
    default:
      return <Navigate to="/login" state={{ from: location }} replace />;
  }
};
