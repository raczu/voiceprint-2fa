import { z } from "zod";

const USERNAME_REGEX = /^\w{4,}$/;

const PASSWORD_REGEX = /^(?=.*?[A-Z])(?=.*?[a-z])(?=.*?[0-9])(?=.*?[#?!@$%^&*-]).{8,}$/;

export const loginSchema = z.object({
  email: z.email(),
  password: z.string(),
});

export const registerSchema = z
  .object({
    name: z.string().min(2, "Imię musi mieć min. 2 znaki"),
    surname: z.string().min(2, "Nazwisko musi mieć min. 2 znaki"),
    username: z.string().regex(USERNAME_REGEX, {
      message: "Login musi mieć min. 4 znaki i zawierać tylko litery, cyfry lub _",
    }),
    email: z.email("Nieprawidłowy format adresu email"),
    password: z.string().min(8, "Hasło musi mieć min. 8 znaków").regex(PASSWORD_REGEX, {
      message:
        "Hasło musi zawierać przynajmniej: dużą i małą literę, cyfrę oraz znak specjalny (#?!@$%^&*-)",
    }),
    confirmPassword: z.string().min(1, "Potwierdzenie hasła jest wymagane"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Hasła muszą być identyczne",
    path: ["confirmPassword"],
  });

export type LoginCredentials = z.infer<typeof loginSchema>;
export type RegisterFormValues = z.infer<typeof registerSchema>;
export type RegisterPayload = Omit<RegisterFormValues, "confirmPassword">;

const authResponseRaw = z.object({
  access_token: z.string(),
  token_type: z.string(),
  phrase: z.string().optional().nullable(),
});

export const authResponseSchema = authResponseRaw.transform((data) => ({
  accessToken: data.access_token,
  tokenType: data.token_type,
  phrase: data.phrase ?? undefined,
}));

export type AuthResponse = z.infer<typeof authResponseSchema>;

export const voiceEnrollmentSchema = z.object({
  files: z
    .array(z.instanceof(File), { message: "Wymagana jest lista plików audio" })
    .min(3, "Utworzenie próbki głosu wymaga min. 3 nagrań"),
});

export type VoiceEnrollmentPayload = z.infer<typeof voiceEnrollmentSchema>;
