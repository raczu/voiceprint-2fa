import { Link } from "react-router-dom";
import { useAuth } from "@/context/auth-provider";
import { Button } from "@/components/ui/button";
import { ModeToggle } from "@/components/mode-toggle";

export const Home = () => {
  const { status } = useAuth();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="fixed top-4 right-4 z-50">
        <ModeToggle />
      </div>

      <main className="mx-auto max-w-2xl text-center space-y-8">
        <div className="space-y-6">
          <h1 className="text-4xl font-bold tracking-tight lg:text-6xl">voiceprint-2fa</h1>
          <p className="text-xl text-muted-foreground">
            Samo hasło nie wystarczy, a kody SMS bywają irytujące.{" "}
            <br className="hidden md:inline" />
            Połącz tradycyjne logowanie z <strong>biometrią głosową</strong>. Wpisz hasło i powiedz
            frazę &mdash; szybciej, wygodniej i bezpieczniej.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          {status === "AUTHENTICATED" ? (
            <Button className="h-12 px-8 text-lg">
              <Link to="/dashboard">Dashboard</Link>
            </Button>
          ) : (
            <>
              <Button className="h-12 px-8 text-lg min-w-[160px]">
                <Link to="/register">Rozpocznij</Link>
              </Button>

              <Button variant="outline" className="h-12 px-8 text-lg min-w-[160px]">
                <Link to="/login">Zaloguj się</Link>
              </Button>
            </>
          )}
        </div>
      </main>
    </div>
  );
};
