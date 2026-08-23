// Turns an uploaded filename like "my_cool - track.mp3" into "my cool - track".
// Hyphens are left as-is (they're often intentional, e.g. "Artist - Title").
export function formatTrackName(filename: string): string {
  return filename
    .replace(/\.mp3$/i, '')
    .replace(/_+/g, ' ')
    .trim();
}
