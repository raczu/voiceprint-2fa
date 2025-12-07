import { Button } from "@/components/ui/button";
import { Trash2, Play } from "lucide-react";
import { formatSecs, formatBytes } from "@/lib/utils";
import type { Recording } from "@/types/recording";

type RecordingsListProps = {
  recordings: Recording[];
  onPlay: (r: Recording) => void;
  onDelete: (id: string) => void;
};

export const RecordingsList: React.FC<RecordingsListProps> = ({ recordings, onPlay, onDelete }) => {
  if (recordings.length === 0) return null;

  return (
    <div className="space-y-2">
      {recordings.map((rec, idx) => (
        <div
          key={rec.id}
          className="flex items-center justify-between gap-3 rounded-lg border bg-card px-3 py-2.5 text-sm hover:bg-accent/50 transition-colors"
        >
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold">
              {idx + 1}
            </span>

            <div className="min-w-0">
              <p className="font-medium truncate">{rec.filename}</p>
              <p className="text-xs text-muted-foreground">
                {formatSecs(rec.duration)} &bull;
                {formatBytes(rec.size)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              size="icon"
              variant="ghost"
              type="button"
              className="h-8 w-8"
              onClick={() => onPlay(rec)}
              aria-label={`Odtwórz ${idx + 1}`}
            >
              <Play className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              type="button"
              className="h-8 w-8 text-destructive hover:bg-destructive/10"
              onClick={() => onDelete(rec.id)}
              aria-label={`Usuń ${idx + 1}`}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default RecordingsList;
