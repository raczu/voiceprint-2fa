import { useEffect, useRef, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Mic, StopCircle, Save, Play, Pause, Trash2 } from "lucide-react";
import { MediaRecorder, register } from "extendable-media-recorder";
import { connect } from "extendable-media-recorder-wav-encoder";

await register(await connect());

type RecorderState = "idle" | "requesting" | "recording" | "paused" | "playing";

interface AudioRecorderProps {
  onSave: (blob: Blob, filename: string, duration: number) => void;
  onStart?: () => void;
  onStop?: () => void;
  onError: (error: Error) => void;
  className?: string;
}

const formatTime = (seconds: number): string => {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
};

const shortUUID = () => {
  const uuid =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID().split("-")[0]
      : Math.random().toString(36).slice(2, 10);
  return uuid;
};

export const AudioRecorder: React.FC<AudioRecorderProps> = ({
  onSave,
  onStart,
  onStop,
  onError,
  className,
}) => {
  const [state, setState] = useState<RecorderState>("idle");
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const [recordingTime, setRecordingTime] = useState(0);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [duration, setDuration] = useState<number | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const startRecording = useCallback(async () => {
    try {
      setState("requesting");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const recorder = new MediaRecorder(stream, { mimeType: "audio/wav" });
      chunksRef.current = [];

      recorder.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);

      recorder.onstart = () => {
        setState("recording");
        setRecordingTime(0);
        timerRef.current = setInterval(() => {
          setRecordingTime((t) => t + 1);
        }, 1000);
        onStart?.();
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/wav" });
        const url = URL.createObjectURL(blob);
        setRecordedBlob(blob);
        setAudioUrl(url);
        setDuration(recordingTime);
        setState("paused");
        onStop?.();
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
    } catch (err) {
      onError(err instanceof Error ? err : new Error("Microphone access denied"));
      setState("idle");
    }
  }, [onStart, onStop, onError, recordingTime]);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    timerRef.current && clearInterval(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const discard = useCallback(() => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setRecordedBlob(null);
    setAudioUrl(null);
    setDuration(null);
    setPlaybackTime(0);
    setRecordingTime(0);
    setState("idle");
    audioRef.current = null;
  }, [audioUrl]);

  const saveRecording = useCallback(() => {
    if (!recordedBlob) return;
    onSave(recordedBlob, `${shortUUID()}.wav`, duration ?? 0);
  }, [recordedBlob, onSave]);

  const togglePlayback = useCallback(() => {
    if (!audioRef.current || !audioUrl) return;

    if (audioRef.current.paused) {
      audioRef.current.play();
      setState("playing");
    } else {
      audioRef.current.pause();
      setState("paused");
    }
  }, [audioUrl]);

  useEffect(() => {
    if (!audioUrl) return;

    const audio = new Audio(audioUrl);
    audioRef.current = audio;

    const updateTime = () => setPlaybackTime(Math.floor(audio.currentTime));
    const onEnded = () => setState("paused");
    const onLoaded = () => {
      if (isFinite(audio.duration)) setDuration(Math.floor(audio.duration));
    };

    audio.addEventListener("timeupdate", updateTime);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("loadedmetadata", onLoaded);

    return () => {
      audio.removeEventListener("timeupdate", updateTime);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("loadedmetadata", onLoaded);
      audio.pause();
      audio.src = "";
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  useEffect(() => {
    return () => {
      timerRef.current && clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  const currentTime = state === "recording" ? recordingTime : playbackTime;
  const isRecording = state === "recording";
  const hasRecording = !!audioUrl;
  const isPlaying = state === "playing";

  return (
    <div className={cn("flex flex-col items-center gap-3", className)}>
      <div className="font-mono text-md tabular-nums tracking-wider">
        <span className={isRecording ? "text-destructive" : ""}>{formatTime(currentTime)}</span>
        {duration !== null && !isRecording && (
          <>
            <span className="mx-3 opacity-50">/</span>
            <span className="text-md opacity-70">{formatTime(duration)}</span>
          </>
        )}
      </div>

      <div className="flex items-center gap-3">
        {isRecording ? (
          <Button size="icon-lg" type="button" variant="destructive" onClick={stopRecording}>
            <StopCircle />
          </Button>
        ) : (
          <Button
            size="icon-lg"
            type="button"
            onClick={startRecording}
            disabled={state === "requesting"}
          >
            <Mic />
          </Button>
        )}

        <Button size="icon-lg" type="button" onClick={togglePlayback} disabled={!hasRecording}>
          {isPlaying ? <Pause /> : <Play />}
        </Button>

        <Button
          size="icon-lg"
          type="button"
          variant="destructive"
          onClick={discard}
          disabled={isRecording || !hasRecording}
        >
          <Trash2 />
        </Button>

        <Button
          size="icon-lg"
          type="button"
          variant="default"
          onClick={saveRecording}
          disabled={!hasRecording || isRecording}
        >
          <Save />
        </Button>
      </div>

      {audioUrl && <audio src={audioUrl} preload="metadata" />}
    </div>
  );
};
