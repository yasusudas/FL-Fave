import { mkdir, copyFile, readFile, writeFile } from "node:fs/promises";
await mkdir("public/parser", { recursive: true });
await mkdir(".generated", { recursive: true });
await copyFile(
  "node_modules/@6over3/zeroperl-ts/dist/esm/zeroperl.wasm",
  "public/parser/zeroperl.wasm",
);
// zeroperl-ts 1.0.10 only recognizes window/document as browsers. Workers have neither.
// Patch just this environment test, with an assertion so upgrades cannot silently break it.
const original = await readFile(
  "node_modules/@6over3/zeroperl-ts/dist/esm/index.js",
  "utf8",
);
const before = 'function Ee(){return typeof window<"u"&&typeof document<"u"}';
if (!original.includes(before))
  throw new Error(
    "Review zeroperl worker environment patch after dependency upgrade",
  );
await writeFile(
  ".generated/zeroperl-browser.js",
  original.replace(
    before,
    'function Ee(){return (typeof window<"u"&&typeof document<"u")||typeof WorkerGlobalScope<"u"}',
  ),
);
