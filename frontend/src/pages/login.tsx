import { useState } from "react";
import { useAuth } from "@/context/auth-provider";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel, FieldError, FieldDescription } from "@/components/ui/field";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { loginSchema, type LoginCredentials } from "@/schemas/auth";
import { ModeToggle } from "@/components/mode-toggle";

export const LoginPage = () => {
  const { login } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginCredentials>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (credentials: LoginCredentials) => {
    setIsLoading(true);
    try {
      await login(credentials);
    } catch (error) {
      console.error(error);
      toast.error("Nieprawidłowy email lub hasło.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="fixed top-4 right-4 z-50">
        <ModeToggle />
      </div>

      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">Zaloguj się do swojego konta</CardTitle>
          <CardDescription>Wprowadź swoje dane, aby uzyskać dostęp do konta.</CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent>
            <FieldGroup>
              <Field data-invalid={!!errors.email}>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input
                  {...register("email")}
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="ja@przyklad.com"
                  required
                />
                {errors.email && <FieldError>{errors.email.message}</FieldError>}
              </Field>

              <Field data-invalid={!!errors.password}>
                <FieldLabel htmlFor="password">Hasło</FieldLabel>
                <Input
                  {...register("password")}
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                />
                {errors.password && <FieldError>{errors.password.message}</FieldError>}
              </Field>

              <Field>
                <Button className="w-full" type="submit" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Logowanie...
                    </>
                  ) : (
                    "Zaloguj się"
                  )}
                </Button>
                <FieldDescription className="text-center">
                  Nie masz jeszcze konta?{" "}
                  <Link
                    to="/register"
                    className="font-medium underline underline-offset-4 hover:text-primary"
                  >
                    Zarejestruj się
                  </Link>
                </FieldDescription>
              </Field>
            </FieldGroup>
          </CardContent>
        </form>
      </Card>
    </div>
  );
};
