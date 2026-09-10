// Development-only download. This script is never bundled into the application.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";
const manifest = JSON.parse(
  await readFile("tests/reference/manifest.json", "utf8"),
);
const directory = path.join(tmpdir(), "fl-fave-fixtures");
await mkdir(directory, { recursive: true });
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
for (const [name, hash] of Object.entries(manifest.files)) {
  const destination = path.join(directory, name);
  try {
    if (digest(await readFile(destination)) === hash) continue;
  } catch {}
  const url = `https://raw.githubusercontent.com/exiftool/exiftool/${manifest.commit}/t/images/${name}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (digest(bytes) !== hash)
    throw new Error(`${name}: fixture checksum mismatch`);
  await writeFile(destination, bytes);
}
console.log(
  `Verified ${Object.keys(manifest.files).length} public ExifTool fixtures in ${directory}`,
);
