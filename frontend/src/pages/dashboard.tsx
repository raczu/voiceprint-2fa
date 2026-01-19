import { useAuth } from "@/context/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Field, FieldLabel, FieldGroup } from "@/components/ui/field";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ModeToggle } from "@/components/mode-toggle";

export const DashboardPage = () => {
  const { user, isAuthenticated, logout } = useAuth();

  if (!isAuthenticated || !user) return null;
  const initials = `${user.name?.[0] || ""}${user.surname?.[0] || ""}`.toUpperCase();

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="fixed top-4 right-4 z-50">
        <ModeToggle />
      </div>

      <Card className="w-full max-w-sm">
        <CardHeader className="flex flex-col items-center gap-4 pb-6 pt-8">
          <Avatar className="h-24 w-24 border border-border shadow-sm">
            <AvatarFallback className="text-3xl font-medium bg-secondary text-secondary-foreground">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="text-center space-y-1">
            <h2 className="text-xl font-bold text-foreground">
              {user.name} {user.surname}
            </h2>
            <p className="text-sm font-medium text-muted-foreground">@{user.username}</p>
          </div>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field>
              <FieldLabel>Imię</FieldLabel>
              <Input readOnly value={user.name} />
            </Field>

            <Field>
              <FieldLabel>Nazwisko</FieldLabel>
              <Input readOnly value={user.surname} />
            </Field>

            <Field>
              <FieldLabel>Email</FieldLabel>
              <Input readOnly value={user.email} />
            </Field>

            <Field>
              <Button variant="destructive" className="w-full" onClick={logout}>
                Wyloguj się
              </Button>
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>
    </div>
  );
};
