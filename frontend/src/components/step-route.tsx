import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/context/auth-provider";
import { type AuthStatus } from "@/types/auth";

interface StepRouteProps {
  requiredStatus: AuthStatus;
}

export const StepRoute = ({ requiredStatus }: StepRouteProps) => {
  const { status } = useAuth();
  if (status === requiredStatus) {
    return <Outlet />;
  }

  switch (status) {
    case "AUTHENTICATED":
      return <Navigate to="/" replace />;
    case "PENDING_2FA":
      return <Navigate to="/verify-2fa" replace />;
    case "ONBOARDING_REQUIRED":
      return <Navigate to="/complete-profile" replace />;
    case "UNAUTHENTICATED":
    default:
      return <Navigate to="/login" replace />;
  }
};
