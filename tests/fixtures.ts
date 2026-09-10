// Generated metadata-only test containers. No personal photos or metadata.
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
export async function modernFormats() {
  const source = () =>
    sharp({
      create: { width: 4, height: 4, channels: 3, background: "#dddddd" },
    }).withExif({
      IFD0: {
        Make: "FUJIFILM",
        Model: "X-T5",
        Artist: "PRIVATE-TEST-NAME",
        Copyright: "PRIVATE-TEST-COPYRIGHT",
      },
      IFD2: { FocalLength: "23/1", DateTimeOriginal: "2026:09:10 12:00:00" },
    });
  const tags = (
    await sharp(await source().jpeg().toBuffer()).metadata()
  ).exif!.subarray(6);
  // Minimal uncompressed, 1x1 RGB PSB with an EXIF image-resource block.
  const header = Buffer.alloc(26);
  header.write("8BPS");
  header.writeUInt16BE(2, 4);
  header.writeUInt16BE(3, 12);
  header.writeUInt32BE(1, 14);
  header.writeUInt32BE(1, 18);
  header.writeUInt16BE(8, 22);
  header.writeUInt16BE(3, 24);
  const resource = Buffer.alloc(12);
  resource.write("8BIM");
  resource.writeUInt16BE(0x0422, 4);
  resource.writeUInt32BE(tags.length, 8);
  const payload = Buffer.concat([
    resource,
    tags,
    Buffer.alloc(tags.length % 2),
  ]);
  const size = Buffer.alloc(4);
  size.writeUInt32BE(payload.length);
  return [
    {
      name: "sample.avif",
      mimeType: "image/avif",
      buffer: await source().avif().toBuffer(),
    },
    {
      name: "sample.png",
      mimeType: "image/png",
      buffer: await source().png().toBuffer(),
    },
    {
      name: "sample.webp",
      mimeType: "image/webp",
      buffer: await source().webp().toBuffer(),
    },
    {
      name: "sample.psb",
      mimeType: "image/vnd.adobe.photoshop",
      buffer: Buffer.concat([
        header,
        Buffer.alloc(4),
        size,
        payload,
        Buffer.alloc(13),
      ]),
    },
  ];
}
export function tiff(
  focal: number | null = 23,
  make = "FUJIFILM",
  model = "X-T5",
  eq?: number,
) {
  const strings = [make + "\0", model + "\0", "2026:09:10 12:00:00\0"];
  const tags = [0x010f, 0x0110, 0x9003];
  const n = 3 + (focal === null ? 0 : 1) + (eq === undefined ? 0 : 1);
  const base = 8 + 2 + n * 12 + 4;
  const buf = Buffer.alloc(
    base + strings.reduce((s, t) => s + Buffer.byteLength(t), 0) + 8,
  );
  buf.write("II");
  buf.writeUInt16LE(42, 2);
  buf.writeUInt32LE(8, 4);
  buf.writeUInt16LE(n, 8);
  let offset = base;
  strings.forEach((text, i) => {
    let p = 10 + i * 12;
    buf.writeUInt16LE(tags[i], p);
    buf.writeUInt16LE(2, p + 2);
    buf.writeUInt32LE(Buffer.byteLength(text), p + 4);
    if (Buffer.byteLength(text) <= 4) buf.write(text, p + 8);
    else {
      buf.writeUInt32LE(offset, p + 8);
      buf.write(text, offset);
      offset += Buffer.byteLength(text);
    }
  });
  let i = 3;
  if (focal !== null) {
    let p = 10 + i++ * 12;
    buf.writeUInt16LE(0x920a, p);
    buf.writeUInt16LE(5, p + 2);
    buf.writeUInt32LE(1, p + 4);
    buf.writeUInt32LE(offset, p + 8);
    buf.writeUInt32LE(Math.round(focal * 10), offset);
    buf.writeUInt32LE(10, offset + 4);
  }
  if (eq !== undefined) {
    let p = 10 + i * 12;
    buf.writeUInt16LE(0xa405, p);
    buf.writeUInt16LE(3, p + 2);
    buf.writeUInt32LE(1, p + 4);
    buf.writeUInt16LE(eq, p + 8);
  }
  return buf;
}
export function jpeg(
  focal: number | null = 23,
  make = "FUJIFILM",
  model = "X-T5",
  eq?: number,
) {
  const exif = Buffer.concat([
    Buffer.from("Exif\0\0"),
    tiff(focal, make, model, eq),
  ]);
  const length = Buffer.alloc(2);
  length.writeUInt16BE(exif.length + 2);
  return Buffer.concat([
    Buffer.from([0xff, 0xd8, 0xff, 0xe1]),
    length,
    exif,
    Buffer.from([0xff, 0xd9]),
  ]);
}
export async function createTree(root: string) {
  await fs.mkdir(path.join(root, "nested", "deeper"), { recursive: true });
  await fs.mkdir(path.join(root, ".hidden"), { recursive: true });
  await Promise.all([
    fs.writeFile(path.join(root, "pair.dng"), tiff()),
    fs.writeFile(path.join(root, "pair.jpg"), jpeg()),
    fs.writeFile(path.join(root, "pair_edited.jpg"), jpeg()),
    fs.writeFile(
      path.join(root, "nested", "deeper", "sony.jpg"),
      jpeg(50, "SONY", "ILCE-7M4"),
    ),
    fs.writeFile(path.join(root, "missing.jpg"), jpeg(null)),
    fs.writeFile(path.join(root, "broken.jpg"), "invalid image"),
    fs.writeFile(path.join(root, ".hidden", "ignored.jpg"), jpeg(999)),
    fs.writeFile(path.join(root, "._ignored.jpg"), jpeg(999)),
    fs.writeFile(path.join(root, "video.mp4"), "ignore"),
  ]);
  return root;
}
