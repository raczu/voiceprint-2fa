import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { PlayIcon, Pause, RotateCcw } from "lucide-react";
import { Progress } from "@/components/ui/progress";

type AudioPlayerProps = {
  src?: string | null;
  className?: string;
  initialDuration?: number | null;
};

export const AudioPlayer: React.FC<AudioPlayerProps> = ({
  src,
  className,
  initialDuration = null,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState<number | null>(initialDuration);

  useEffect(() => {
    if (!src) {
      if (audioRef.current) {
        try {
          audioRef.current.pause();
          audioRef.current.src = "";
        } catch (err: any) {
          console.error(err);
        }
        audioRef.current = null;
      }
      setIsPlaying(false);
      setTime(0);
      setDuration(initialDuration);
      return;
    }

    let p = audioRef.current;
    if (!p) {
      p = new Audio(src);
      audioRef.current = p;
    } else {
      p.src = src;
    }
    p.preload = "metadata";

    const onLoaded = () => {
      setDuration(isFinite(p!.duration) ? p!.duration : null);
    };
    const onTime = () => setTime(p!.currentTime);
    const onEnded = () => setIsPlaying(false);

    p.addEventListener("loadedmetadata", onLoaded);
    p.addEventListener("timeupdate", onTime);
    p.addEventListener("ended", onEnded);

    return () => {
      p.removeEventListener("loadedmetadata", onLoaded);
      p.removeEventListener("timeupdate", onTime);
      p.removeEventListener("ended", onEnded);
    };
  }, [src, initialDuration]);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        try {
          audioRef.current.pause();
          audioRef.current.src = "";
        } catch (err: any) {
          console.error(err);
        }
        audioRef.current = null;
      }
    };
  }, []);

  const toggle = async () => {
    if (!audioRef.current) return;
    try {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        await audioRef.current.play();
        setIsPlaying(true);
      }
    } catch {
      setIsPlaying(false);
    }
  };

  const format = (s: number | null) => {
    if (!s || Number.isNaN(s)) return "--:--";
    const mm = Math.floor(s / 60);
    const ss = Math.floor(s % 60);
    return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
  };

  const rewind = () => {
    if (!audioRef.current) return;
    try {
      audioRef.current.currentTime = 0;
      audioRef.current.pause();
    } catch (err: any) {
      console.error(err);
    }
    setIsPlaying(false);
    setTime(0);
  };

  return (
    <div className={className ?? "w-full"}>
      <div className="flex items-center gap-3">
        <div className="text-md font-mono w-16">{format(time)}</div>
        <div className="flex-1 min-w-0">
          <Progress value={duration ? Math.min(100, (time / duration) * 100) : 0} />
        </div>
        <div className="text-md font-mono w-16 text-right">{format(duration)}</div>
      </div>

      <div className="flex items-center justify-center gap-3 mt-2">
        <Button
          type="button"
          size="icon-lg"
          onClick={toggle}
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? <Pause /> : <PlayIcon />}
        </Button>
        <Button type="button" size="icon-lg" onClick={rewind} aria-label="Rewind to start">
          <RotateCcw />
        </Button>
      </div>
    </div>
  );
};

export default AudioPlayer;
