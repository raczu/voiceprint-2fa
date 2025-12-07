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
import { useCallback, useEffect, useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RecordingsList } from "@/components/recordings-list";
import { toast } from "sonner";
import type { Recording } from "@/types/recording";
import api from "@/lib/api";

const PHRASE = "Jeśli masz wybierać między jednym złem a drugim, lepiej nie wybierać wcale.";
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
        headers: { 'Content-Type': 'multipart/form-data' },
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
        headers: { 'Content-Type': 'multipart/form-data' },
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

  const playRecording = useCallback((rec: Recording) => new Audio(rec.url).play(), []);
  const deleteRecording = useCallback((id: string) => {
    setRecordings((prev) => {
      const rec = prev.find((r) => r.id === id);
      if (rec) URL.revokeObjectURL(rec.url);
      return prev.filter((r) => r.id !== id);
    });
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

                <Field>
                  <FieldLabel htmlFor="phrase">Fraza do nagrania</FieldLabel>
                  <Textarea
                    id="phrase"
                    value={PHRASE}
                    readOnly
                    rows={3}
                    className="cursor-default resize-none"
                    aria-describedby="phrase-description"
                  />
                  <FieldDescription id="phrase-description">
                    Wypowiedzenie tej frazy powinno zająć minimum 3 sekundy.
                  </FieldDescription>
                </Field>

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

                <div className="space-y-3">
                  <FieldLabel>Zapisane nagrania</FieldLabel>
                  <RecordingsList
                    recordings={recordings}
                    onPlay={playRecording}
                    onDelete={deleteRecording}
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
