// Turns an uploaded filename like "my-cool_track.mp3" into "my cool track".
export function formatTrackName(filename: string): string {
  return filename
    .replace(/\.mp3$/i, '')
    .replace(/[-_]+/g, ' ')
    .trim();
}
