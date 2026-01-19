import { useState, useCallback, useEffect } from "react";
import { useAuth } from "@/context/auth-provider";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Field, FieldLabel, FieldGroup } from "@/components/ui/field";
import { AudioRecorder } from "@/components/audio-recorder";
import { RecordingsList } from "@/components/recordings-list";
import { toast } from "sonner";
import { Loader2, Info } from "lucide-react";
import type { Recording } from "@/types/recording";
import { ModeToggle } from "@/components/mode-toggle";

const MIN_RECORDINGS = 3;

export const EnrollVoicePage = () => {
  const { enrollVoice, phrase, logout } = useAuth();
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSaveRecording = useCallback(
    (blob: Blob, _originalName: string, duration: number) => {
      const nextIndex = recordings.length + 1;
      const cleanFilename = `probka-${nextIndex}.wav`;

      const newRecording: Recording = {
        id: crypto.randomUUID(),
        filename: cleanFilename,
        blob,
        url: URL.createObjectURL(blob),
        size: blob.size,
        duration,
      };

      setRecordings((prev) => [newRecording, ...prev]);
    },
    [recordings.length],
  );

  const handleDeleteRecording = useCallback((id: string) => {
    setRecordings((prev) => {
      const target = prev.find((r) => r.id === id);
      if (target) URL.revokeObjectURL(target.url);
      return prev.filter((r) => r.id !== id);
    });
  }, []);

  const handlePlayRecording = useCallback((rec: Recording) => {
    const audio = new Audio(rec.url);
    audio.play().catch((err) => toast.error(err.message));
  }, []);

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (recordings.length < MIN_RECORDINGS) return;

    setIsSubmitting(true);
    try {
      const files = recordings.map((rec, i) => {
        return new File([rec.blob], `sample_${i}.wav`, { type: "audio/wav" });
      });

      await enrollVoice(files);
      toast.success("Profil głosowy został utworzony.");
    } catch (error) {
      console.error(error);
      toast.error("Wystąpił błąd podczas wysyłania.");
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    return () => recordings.forEach((r) => URL.revokeObjectURL(r.url));
  }, [recordings]);

  const progress = Math.min((recordings.length / MIN_RECORDINGS) * 100, 100);
  const isReady = recordings.length >= MIN_RECORDINGS;

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="fixed top-4 right-4 z-50">
        <ModeToggle />
      </div>

      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Utwórz profil głosowy</CardTitle>
          <CardDescription>
            Dokończ rejestrację swojego konta. Aby umożliwić weryfikację głosową podczas logowania,
            nagraj wyświetloną poniżej frazę.
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
                <div className="flex items-center justify-between mb-2">
                  <FieldLabel>Status nagrań</FieldLabel>
                  <span
                    className={
                      isReady ? "text-green-600 text-sm font-medium" : "text-muted-foreground"
                    }
                  >
                    {isReady ? "Gotowe" : `${recordings.length} z ${MIN_RECORDINGS}`}
                  </span>
                </div>

                <div className="h-2 w-full rounded-full bg-secondary overflow-hidden mb-4">
                  <div
                    className={`h-full transition-all duration-500 ease-out ${isReady ? "bg-green-600" : "bg-primary"}`}
                    style={{ width: `${progress}%` }}
                  />
                </div>

                <AudioRecorder
                  onSave={handleSaveRecording}
                  onError={(e) => toast.error(e.message)}
                  className="w-full border-none bg-transparent shadow-none p-0"
                />
              </Field>

              <Field>
                <FieldLabel className="mb-2 block">Twoje nagrania</FieldLabel>
                <RecordingsList
                  recordings={recordings}
                  onPlay={handlePlayRecording}
                  onDelete={handleDeleteRecording}
                />
              </Field>

              <div className="flex gap-3 rounded-md bg-muted/50 p-3 text-xs text-muted-foreground mt-2">
                <Info className="mt-1 h-4 w-4 shrink-0 opacity-70" />
                <p className="leading-relaxed">
                  Twoje nagrania są wykorzystywane <strong>wyłącznie</strong> do weryfikacji
                  tożsamości. Nie są udostępniane podmiotom trzecim.
                </p>
              </div>

              <Field>
                <Button className="w-full" type="submit" disabled={!isReady || isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Przetwarzanie...
                    </>
                  ) : (
                    "Utwórz"
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
