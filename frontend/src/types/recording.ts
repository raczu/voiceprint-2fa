export type Recording = {
  id: string;
  filename: string;
  blob: Blob;
  url: string;
  size: number;
  duration?: number;
};
