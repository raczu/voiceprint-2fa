import { useState, useCallback, useEffect } from "react";
import { useAuth } from "@/context/auth-provider";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Field, FieldLabel, FieldGroup } from "@/components/ui/field";
import { AudioRecorder } from "@/components/audio-recorder";
import { RecordingsList } from "@/components/recordings-list";
import { toast } from "sonner";
import { Info, Loader2 } from "lucide-react";
import type { Recording } from "@/types/recording";
import { ModeToggle } from "@/components/mode-toggle";

export const VerifyVoicePage = () => {
  const { verifyVoice, phrase, logout } = useAuth();

  const [recording, setRecording] = useState<Recording | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSaveRecording = useCallback(
    (blob: Blob, _originalName: string, duration: number) => {
      if (recording) {
        URL.revokeObjectURL(recording.url);
      }

      const newRecording: Recording = {
        id: crypto.randomUUID(),
        filename: "weryfikacja.wav",
        blob,
        url: URL.createObjectURL(blob),
        size: blob.size,
        duration,
      };

      setRecording(newRecording);
    },
    [recording],
  );

  const handleDeleteRecording = useCallback(() => {
    if (recording) {
      URL.revokeObjectURL(recording.url);
      setRecording(null);
    }
  }, [recording]);

  const handlePlayRecording = useCallback((rec: Recording) => {
    const audio = new Audio(rec.url);
    audio.play().catch((err) => toast.error("Błąd odtwarzania: " + err.message));
  }, []);

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recording) return;

    setIsSubmitting(true);
    try {
      const file = new File([recording.blob], "verify.wav", { type: "audio/wav" });
      await verifyVoice(file);
      toast.success("Tożsamość została potwierdzona.");
    } catch (error: any) {
      console.error(error);
      toast.error("Weryfikacja nie powiodła się. Spróbuj ponownie.");
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    return () => {
      if (recording) URL.revokeObjectURL(recording.url);
    };
  }, [recording]);

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="fixed top-4 right-4 z-50">
        <ModeToggle />
      </div>

      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Weryfikacja tożsamości</CardTitle>
          <CardDescription>
            Potwierdź swoją tożsamość, nagrywając frazę poniżej jeden raz.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleFormSubmit}>
            <FieldGroup>
              <Field>
                {phrase ? (
                  <div className="rounded-md border bg-muted/30 p-6 text-center">
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
                      Naciśnij mikrofon i powiedz:
                    </p>
                    <p className="text-md font-medium text-foreground leading-relaxed">
                      "{phrase}"
                    </p>
                  </div>
                ) : (
                  <div className="flex h-20 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Ładowanie frazy...
                  </div>
                )}
              </Field>

              <Field>
                <FieldLabel className="mb-2 block">
                  {recording ? "Nagranie" : "Rejestrator"}
                </FieldLabel>

                {!recording ? (
                  <div className="animate-in fade-in zoom-in-95 duration-300">
                    <AudioRecorder
                      onSave={handleSaveRecording}
                      onError={(e) => toast.error(e.message)}
                      className="w-full border-none bg-transparent shadow-none p-0"
                    />
                  </div>
                ) : (
                  <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <RecordingsList
                      recordings={[recording]}
                      onPlay={handlePlayRecording}
                      onDelete={handleDeleteRecording}
                    />
                  </div>
                )}
              </Field>

              <div className="flex gap-3 rounded-md bg-muted/50 p-3 text-xs text-muted-foreground mt-2">
                <Info className="mt-1 h-4 w-4 shrink-0 opacity-70" />
                <p className="leading-relaxed">
                  Analiza biometryczna porównuje Twój głos z wcześniej zarejestrowanym wzorcem
                  podczas rejestracji.
                </p>
              </div>

              <Field>
                <Button className="w-full" type="submit" disabled={!recording || isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Weryfikacja...
                    </>
                  ) : (
                    "Zweryfikuj"
                  )}
                </Button>

                <Button variant="outline" className="w-full" onClick={logout} type="button">
                  Anuluj
                </Button>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
