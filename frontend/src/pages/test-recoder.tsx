import { AudioRecorder } from "@/components/audio-recorder.tsx";
import { ModeToggle } from "@/components/mode-toggle";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useCallback, useEffect, useState, useRef } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
  FieldSeparator,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RecordingsList } from "@/components/recordings-list";
import { toast } from "sonner";
import type { Recording } from "@/types/recording";
import api from "@/lib/api";

const SHORT_PHRASE = "Zło to zło.";
const LONG_PHRASE =
  "Błędy też się dla mnie liczą. Nie wykreślam ich ani z życia, ani z pamięci. I nigdy nie winię za nie innych.";
const MIN_RECORDINGS = 3;

const schema = z.object({
  username: z
    .string()
    .min(4, "Nazwa użytkownika musi mieć minimum 4 znaki")
    .regex(/^\w+$/, {
      message: "Nazwa użytkownika może zawierać tylko litery, cyfry i podkreślenia",
    })
    .trim(),
});

type FormData = z.infer<typeof schema>;

export const TestRecorder = () => {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    watch,
    formState: { errors },
    trigger,
    reset,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { username: "" },
  });

  const username = watch("username");
  const hasEnoughRecordings = recordings.length >= MIN_RECORDINGS;

  const onEnroll = async () => {
    const isValid = await trigger("username");
    if (!isValid) return;

    setIsSubmitting(true);
    const fd = new FormData();
    recordings.forEach((r) => {
      const file = new File([r.blob], r.filename, { type: r.blob.type });
      fd.append("files", file);
    });

    try {
      const res = await api.post(`/api/v1/private/enroll/${username}`, fd, {
        transformRequest: (data) => data,
        headers: { "Content-Type": "multipart/form-data" },
      });
      console.log(`[ENROLL] ${res.status}`);
      if (res.status === 201) {
        toast.success("Pomyślnie utworzono próbkę głosu!");
      }
      reset();
      setRecordings([]);
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const onVerify = async () => {
    const isValid = await trigger("username");
    if (!isValid) return;

    setIsSubmitting(true);
    const fd = new FormData();
    const recording = recordings[0];
    const file = new File([recording.blob], recording.filename, {
      type: recording.blob.type,
    });
    fd.append("file", file);

    try {
      const res = await api.post(`/api/v1/private/verify/${username}`, fd, {
        transformRequest: (data) => data,
        headers: { "Content-Type": "multipart/form-data" },
      });
      console.log(`[VERIFY] ${res.status}`);
      if (res.status === 200) {
        toast.success("Weryfikacja powiodła się!");
      } else if (res.status === 401) {
        toast.error("Weryfikacja nie powiodła się!");
      }
      reset();
      setRecordings([]);
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const addRecording = useCallback((blob: Blob, filename: string, initialDuration?: number) => {
    const id = crypto.randomUUID();
    const url = URL.createObjectURL(blob);
    const newRec: Recording = {
      id,
      filename,
      blob,
      url,
      size: blob.size,
      duration: initialDuration,
    };
    setRecordings((prev) => [newRec, ...prev]);

    const audio = new Audio(url);
    audio.addEventListener(
      "loadedmetadata",
      () => {
        setRecordings((prev) =>
          prev.map((r) =>
            r.id === id ? { ...r, duration: audio.duration || initialDuration } : r,
          ),
        );
      },
      { once: true },
    );
  }, []);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const handleFilesUpload = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;
    const arr = Array.from(files);
    const wavs = arr.filter((f) => {
      const name = f.name.toLowerCase();
      const isWav = name.endsWith(".wav") || f.type === "audio/wav";
      if (!isWav) toast.error(`${f.name}: tylko format .wav jest obsługiwany`);
      return isWav;
    });

    wavs.forEach((f) => {
      const id = crypto.randomUUID();
      const url = URL.createObjectURL(f);
      const newRec: Recording = {
        id,
        filename: f.name,
        blob: f,
        url,
        size: f.size,
        duration: undefined,
      };
      setRecordings((prev) => [newRec, ...prev]);

      const audio = new Audio(url);
      audio.addEventListener(
        "loadedmetadata",
        () => {
          setRecordings((prev) =>
            prev.map((r) => (r.id === id ? { ...r, duration: audio.duration } : r)),
          );
        },
        { once: true },
      );
    });
  }, []);

  const playRecording = useCallback((rec: Recording) => new Audio(rec.url).play(), []);
  const deleteRecording = useCallback((id: string) => {
    setRecordings((prev) => {
      const rec = prev.find((r) => r.id === id);
      if (rec) URL.revokeObjectURL(rec.url);
      return prev.filter((r) => r.id !== id);
    });
  }, []);

  const downloadRecording = useCallback((rec: Recording) => {
    try {
      const url = rec.url ?? URL.createObjectURL(rec.blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = rec.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      if (!rec.url) URL.revokeObjectURL(url);
    } catch (err) {
      console.error("download failed", err);
    }
  }, []);

  useEffect(() => {
    return () => recordings.forEach((r) => URL.revokeObjectURL(r.url));
  }, []);

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="fixed top-4 right-4 z-50">
        <ModeToggle />
      </div>

      <div className="w-full max-w-sm">
        <Card>
          <CardHeader>
            <CardTitle>Uwierzytelnianie głosowe</CardTitle>
            <CardDescription>
              Utwórz nową próbkę lub zweryfikuj swój głos poprzez analizę biometryczną.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form>
              <FieldGroup>
                <Field data-invalid={!!errors.username}>
                  <FieldLabel htmlFor="username">Nazwa użytkownika</FieldLabel>
                  <Input {...register("username")} id="username" aria-invalid={!!errors.username} />
                  <FieldDescription>Wprowadź swoją unikalną nazwę użytkownika.</FieldDescription>
                  {errors.username && <FieldError>{errors.username.message}</FieldError>}
                </Field>

                <FieldSet>
                  <FieldLegend>Frazy do nagrania</FieldLegend>
                  <FieldDescription>
                    W celu utworzenia próbki głosu lub jej weryfikacji wybierz jedną z poniższych
                    fraz do nagrania.
                  </FieldDescription>
                  <Field>
                    <FieldLabel htmlFor="short-phrase">Krótka fraza do nagrania</FieldLabel>
                    <Textarea
                      id="short-phrase"
                      value={SHORT_PHRASE}
                      readOnly
                      rows={1}
                      className="cursor-default resize-none"
                      aria-describedby="short-phrase-description"
                    />
                    <FieldDescription id="short-phrase-description">
                      Wypowiedzenie tej frazy powinno zająć od 1-2 sekund.
                    </FieldDescription>
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="long-phrase">Długa fraza do nagrania</FieldLabel>
                    <Textarea
                      id="long-phrase"
                      value={LONG_PHRASE}
                      readOnly
                      rows={3}
                      className="cursor-default resize-none"
                      aria-describedby="long-phrase-description"
                    />
                    <FieldDescription id="long-phrase-description">
                      Wypowiedzenie tej frazy powinno zająć od 5-10 sekund.
                    </FieldDescription>
                  </Field>
                </FieldSet>

                <div className="space-y-3">
                  <FieldLabel htmlFor="recorder">Rejestrator</FieldLabel>
                  <AudioRecorder
                    onSave={(b, f, d) => addRecording(b, f, d)}
                    onError={(err) => toast.error(err.message)}
                  />
                  <FieldDescription>
                    Nagraj swój głos, a następnie odtwórz lub usuń nagrania według potrzeb.
                  </FieldDescription>
                </div>

                <FieldSeparator className="*:data-[slot=field-separator-content]:bg-card">
                  lub wykorzystaj gotowe nagrania
                </FieldSeparator>

                <div className="space-y-3">
                  <Input
                    ref={fileInputRef}
                    id="upload"
                    type="file"
                    multiple
                    accept="audio/wav, .wav"
                    className="hidden"
                    onChange={(e) => handleFilesUpload(e.target.files)}
                  />

                  <div className="flex justify-center">
                    <Button
                      className="w-full max-w-sm"
                      variant="outline"
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      Prześlij pliki
                    </Button>
                  </div>
                </div>

                <div className="space-y-3">
                  <FieldLabel>Zapisane nagrania</FieldLabel>
                  <RecordingsList
                    recordings={recordings}
                    onPlay={playRecording}
                    onDelete={deleteRecording}
                    onDownload={downloadRecording}
                  />
                  <FieldDescription>
                    Utworzenie próbki głosu wymaga co najmniej trzech nagrań.
                  </FieldDescription>
                </div>
              </FieldGroup>
            </form>
          </CardContent>
          <CardFooter>
            <Field orientation="horizontal">
              <Button
                type="submit"
                disabled={!username || !hasEnoughRecordings || isSubmitting}
                onClick={onEnroll}
              >
                Uwtórz
              </Button>
              <Button
                type="submit"
                variant="outline"
                disabled={recordings.length === 0 || isSubmitting || !username}
                onClick={onVerify}
              >
                Zweryfikuj
              </Button>
            </Field>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};
