import React from "react";
import { Button } from "@/components/ui/button";
import { Trash2, Play, Download } from "lucide-react";
import type { Recording } from "@/types/recording";

const formatTime = (seconds?: number) => {
  if (typeof seconds !== "number") return "--:--";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
};

const formatSize = (bytes: number) => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
};

type RecordingsListProps = {
  recordings: Recording[];
  onPlay: (r: Recording) => void;
  onDelete: (id: string) => void;
  onDownload?: (r: Recording) => void;
};

export const RecordingsList: React.FC<RecordingsListProps> = ({
  recordings,
  onPlay,
  onDelete,
  onDownload,
}) => {
  if (recordings.length === 0) {
    return (
      <div className="flex h-16 w-full items-center justify-center rounded-md border border-dashed border-muted-foreground/20 bg-muted/5 text-sm text-muted-foreground/60">
        Oczekiwanie na nagrania...
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {recordings.map((rec, idx) => (
        <div
          key={rec.id}
          className="flex items-center justify-between gap-4 rounded-lg border bg-card p-3 shadow-sm"
        >
          <div className="flex items-center gap-4 min-w-0 flex-1">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-secondary text-secondary-foreground font-mono text-sm font-medium">
              {idx + 1}
            </div>

            <div className="min-w-0 flex flex-col justify-center">
              <p className="font-medium text-foreground truncate text-sm mb-0.5">{rec.filename}</p>
              <p className="text-xs text-muted-foreground font-mono">
                {formatTime(rec.duration)} • {formatSize(rec.size)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-9 w-9 rounded-md text-foreground hover:bg-primary/10 hover:text-primary"
              onClick={() => onPlay(rec)}
              title="Odsłuchaj"
            >
              <Play className="h-4 w-4 fill-current" />
            </Button>

            {onDownload && (
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-9 w-9 rounded-md text-foreground hover:bg-muted"
                onClick={() => onDownload(rec)}
                title="Pobierz"
              >
                <Download className="h-4 w-4" />
              </Button>
            )}

            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-9 w-9 rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              onClick={() => onDelete(rec.id)}
              title="Usuń"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
};
