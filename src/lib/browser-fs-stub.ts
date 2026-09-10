export function readFile(): never {
  throw new Error(
    "Node filesystem is unavailable in this browser-only application.",
  );
}
