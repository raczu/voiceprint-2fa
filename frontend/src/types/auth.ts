export type AuthStatus =
  | "UNAUTHENTICATED"
  | "PENDING_2FA"
  | "ONBOARDING_REQUIRED"
  | "AUTHENTICATED";

export const TokenScope = {
  FULL_ACCESS: "auth:full",
  TWO_FACTOR_REQUIRED: "2fa:required",
  ONBOARDING_REQUIRED: "onboarding:required",
} as const;

export interface JWTPayload {
  sub: string;
  scopes: string[];
  exp: number;
  iat: number;
}

export interface User {
  id: string;
  name: string;
  surname: string;
  email: string;
  username: string;
}
