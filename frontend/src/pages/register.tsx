import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link } from "react-router-dom";
import { useAuth } from "@/context/auth-provider";
import { registerSchema, type RegisterFormValues } from "@/schemas/auth";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel, FieldError, FieldDescription } from "@/components/ui/field";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { ModeToggle } from "@/components/mode-toggle";

export const RegisterPage = () => {
  const { register: registerUser } = useAuth();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: "",
      email: "",
      name: "",
      surname: "",
      password: "",
      confirmPassword: "",
    },
  });

  const onSubmit = async (data: RegisterFormValues) => {
    try {
      await registerUser(data);
      toast.success("Konto utworzone pomyślnie!", {
        description: "Przygotuj się do nagrania próbki głosu.",
        duration: 4000,
      });
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="fixed top-4 right-4 z-50">
        <ModeToggle />
      </div>

      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Utwórz konto</CardTitle>
          <CardDescription>
            Wprowadź swoje dane, aby rozpocząć. W kolejnym kroku skonfigurujesz biometrię głosową.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)}>
            <FieldGroup>
              <div className="grid grid-cols-2 gap-4">
                <Field data-invalid={!!errors.name}>
                  <FieldLabel htmlFor="name">Imię</FieldLabel>
                  <Input {...register("name")} id="name" required />
                  {errors.name && <FieldError>{errors.name.message}</FieldError>}
                </Field>
                <Field data-invalid={!!errors.surname}>
                  <FieldLabel htmlFor="surname">Nazwisko</FieldLabel>
                  <Input {...register("surname")} id="surname" required />
                  {errors.surname && <FieldError>{errors.surname.message}</FieldError>}
                </Field>
              </div>

              <Field data-invalid={!!errors.username}>
                <FieldLabel htmlFor="username">Nazwa użytkownika</FieldLabel>
                <Input {...register("username")} id="username" required />
                <FieldDescription>Unikalna nazwa użytkownika (min. 4 znaki).</FieldDescription>
                {errors.username && <FieldError>{errors.username.message}</FieldError>}
              </Field>

              <Field data-invalid={!!errors.email}>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input {...register("email")} type="email" id="email" required />
                <FieldDescription>Wykorzystywany do logowania.</FieldDescription>
                {errors.email && <FieldError>{errors.email.message}</FieldError>}
              </Field>

              <Field data-invalid={!!errors.password}>
                <FieldLabel htmlFor="password">Hasło</FieldLabel>
                <Input {...register("password")} type="password" id="password" required />
                <FieldDescription>
                  Min. 8 znaków, w tym wielka litera, cyfra i znak specjalny.
                </FieldDescription>
                {errors.password && <FieldError>{errors.password.message}</FieldError>}
              </Field>

              <Field data-invalid={!!errors.confirmPassword}>
                <FieldLabel htmlFor="confirmPassword">Powtórz hasło</FieldLabel>
                <Input
                  {...register("confirmPassword")}
                  type="password"
                  id="confirmPassword"
                  required
                />
                <FieldDescription>Wpisz ponownie hasło, aby je potwierdzić.</FieldDescription>
                {errors.confirmPassword && (
                  <FieldError>{errors.confirmPassword.message}</FieldError>
                )}
              </Field>

              <Field>
                <Button type="submit" className="w-full mt-4" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Przetwarzanie...
                    </>
                  ) : (
                    "Dalej"
                  )}
                </Button>
                <FieldDescription className="text-center">
                  Masz już konto?{" "}
                  <Link to="/login" className="underline">
                    Zaloguj się
                  </Link>
                </FieldDescription>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
