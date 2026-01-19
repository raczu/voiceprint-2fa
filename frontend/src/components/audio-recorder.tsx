import { useEffect, useRef, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Mic, Square, Save, Play, Pause, Trash2, Loader2 } from "lucide-react";
import { MediaRecorder as ExtendableRecorder, register } from "extendable-media-recorder";
import { connect } from "extendable-media-recorder-wav-encoder";

let isEncoderRegistered = false;
const initEncoder = async () => {
  if (isEncoderRegistered) return;
  try {
    await register(await connect());
    isEncoderRegistered = true;
  } catch (e) {
    console.warn("Encoder init warning:", e);
  }
};

const formatTime = (seconds: number): string => {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
};

const shortUUID = () => Math.random().toString(36).slice(2, 10);

interface AudioRecorderProps {
  onSave: (blob: Blob, filename: string, duration: number) => void;
  onStart?: () => void;
  onStop?: () => void;
  onError: (error: Error) => void;
  className?: string;
}

export const AudioRecorder = ({
  onSave,
  onStart,
  onStop,
  onError,
  className,
}: AudioRecorderProps) => {
  const [isReady, setIsReady] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);

  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const mediaRecorderRef = useRef<ExtendableRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    initEncoder().then(() => setIsReady(true));
  }, []);

  const startRecording = useCallback(async () => {
    if (!isReady) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const recorder = new ExtendableRecorder(stream, { mimeType: "audio/wav" });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstart = () => {
        setIsRecording(true);
        setCurrentTime(0);
        setDuration(0);

        timerRef.current = setInterval(() => {
          setCurrentTime((t) => t + 1);
        }, 1000);

        onStart?.();
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/wav" });
        const url = URL.createObjectURL(blob);
        if (timerRef.current) clearInterval(timerRef.current);

        setRecordedBlob(blob);
        setAudioUrl(url);
        setDuration((prev) => {
          return currentTime;
        });

        setIsRecording(false);
        onStop?.();

        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      };

      recorder.start();
    } catch (err) {
      onError(err instanceof Error ? err : new Error("Brak dostępu do mikrofonu"));
    }
  }, [isReady, onStart, onStop, onError, currentTime]);

  const stopRecording = useCallback(() => {
    setDuration(currentTime);
    mediaRecorderRef.current?.stop();
  }, [currentTime]);

  const togglePlayback = useCallback(() => {
    if (!audioRef.current || !audioUrl) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  }, [audioUrl, isPlaying]);

  const discard = useCallback(() => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setRecordedBlob(null);
    setAudioUrl(null);
    setDuration(0);
    setCurrentTime(0);
    setIsPlaying(false);
  }, [audioUrl]);

  const saveRecording = useCallback(() => {
    if (!recordedBlob) return;
    onSave(recordedBlob, `${shortUUID()}.wav`, duration);
  }, [recordedBlob, onSave, duration]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [audioUrl]);

  if (!isReady) {
    return (
      <div className="flex h-12 w-full items-center justify-center gap-2 rounded-md border bg-muted/20 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Inicjalizacja...
      </div>
    );
  }
  const hasRecording = !!audioUrl;

  return (
    <div className={cn("flex flex-col items-center gap-3", className)}>
      <div className="flex items-center gap-2 font-mono text-sm tabular-nums">
        <span
          className={cn(
            "transition-colors duration-300",
            isRecording ? "text-destructive font-bold animate-pulse" : "text-foreground",
          )}
        >
          {formatTime(currentTime)}
        </span>

        <span className="text-muted-foreground">/</span>

        <span className="text-muted-foreground">
          {isRecording ? "--:--" : formatTime(duration)}
        </span>
      </div>

      <div className="flex items-center gap-2">
        {isRecording ? (
          <Button
            type="button"
            variant="destructive"
            size="icon-lg"
            className="rounded-md"
            onClick={stopRecording}
          >
            <Square className="h-4 w-4 fill-current" />
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="icon-lg"
            className={cn("rounded-md", isRecording && "bg-red-100 border-red-200")}
            onClick={startRecording}
            disabled={hasRecording}
          >
            <Mic className="h-4 w-4" />
          </Button>
        )}

        <Button
          type="button"
          variant="outline"
          size="icon-lg"
          className="rounded-md"
          onClick={togglePlayback}
          disabled={!hasRecording || isRecording}
        >
          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>

        <Button
          type="button"
          variant="outline"
          size="icon-lg"
          className="rounded-md hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30"
          onClick={discard}
          disabled={!hasRecording || isRecording || isPlaying}
        >
          <Trash2 className="h-4 w-4" />
        </Button>

        <Button
          type="button"
          variant="outline"
          size="icon-lg"
          className="rounded-md hover:bg-green-500/10 hover:text-green-600 hover:border-green-600/30"
          onClick={saveRecording}
          disabled={!hasRecording || isRecording}
        >
          <Save className="h-4 w-4" />
        </Button>
      </div>

      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
          onEnded={() => {
            setIsPlaying(false);
            setCurrentTime(0);
          }}
          onPause={() => setIsPlaying(false)}
          onPlay={() => setIsPlaying(true)}
          onLoadedMetadata={(e) => {
            if (isFinite(e.currentTarget.duration)) {
              setDuration(e.currentTarget.duration);
            }
          }}
        />
      )}
    </div>
  );
};
