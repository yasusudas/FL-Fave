import { z } from "zod";
import { combine, modes } from "./analysis";
import type { Result } from "./types";
// Strict schemas prevent per-photo fields or unexpected payloads being persisted on import.
const count = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const histogram = z
  .record(z.string().regex(/^\d+$/), count)
  .refine(
    (h) =>
      Object.keys(h).every(
        (k) => Number.isSafeInteger(Number(k)) && Number(k) <= 1_000_000,
      ),
    "焦点距離の範囲が不正です",
  );
const stats = z
  .object({
    detected: count,
    pairs: count,
    shots: count,
    success: count,
    missing: count,
    errors: count,
  })
  .strict()
  .refine(
    (s) =>
      s.success + s.missing + s.errors === s.shots &&
      s.detected - s.pairs === s.shots,
    "撮影数の整合性がありません",
  );
const version = z
  .object({ version: z.string().max(100), updatedAt: z.string().max(100) })
  .strict();
const target = z
  .object({
    manufacturerId: z.string().max(100),
    sensorProfileId: z.string().max(100),
    mountId: z.string().max(100),
  })
  .strict();
const lens = z
  .object({
    id: z.string().max(200),
    manufacturerId: z.string().max(100),
    name: z.string().max(300),
    mountId: z.string().max(100),
    focal: z.number().positive().finite(),
    aperture: z.number().positive().finite(),
    status: z.enum(["current", "discontinued"]),
    sensors: z.array(z.string().max(100)).max(20),
    firstParty: z.boolean(),
    prime: z.boolean(),
    price: z.number().nonnegative().nullable(),
    priceType: z.enum(["official", "street"]).nullable(),
    priceUpdatedAt: z.string().max(100).nullable(),
    url: z.url().refine((s) => s.startsWith("https://")),
  })
  .strict();
const recommendation = z
  .object({
    equivalent: count,
    targetActual: z.number().nonnegative().finite(),
    choices: z
      .array(z.object({ lens, alternatives: z.array(lens).max(100) }).strict())
      .max(3),
    discontinued: z.array(lens).max(100),
  })
  .strict();
const aggregate = z
  .object({
    key: z.string().max(400),
    manufacturer: z.string().max(200),
    model: z.string().max(200),
    match: z.enum(["matched", "unregistered", "unknown"]),
    sensorProfileId: z.string().max(100),
    cropFactor: z.number().positive().finite(),
    sources: z
      .object({ exif: count, database: count, fallback: count })
      .strict(),
    actual: histogram,
    equivalent: histogram,
    stats,
  })
  .strict()
  .refine(
    (g) =>
      [g.actual, g.equivalent].every(
        (h) => Object.values(h).reduce((a, b) => a + b, 0) === g.stats.success,
      ) &&
      Object.values(g.sources).reduce((a, b) => a + b, 0) === g.stats.success,
    "ヒストグラムと撮影数が一致しません",
  );
const schema = z
  .object({
    format: z.literal("fl-fave"),
    formatVersion: z.literal(1),
    appVersion: z.string().max(100),
    exportedAt: z.iso.datetime(),
    analyzedAt: z.iso.datetime().optional(),
    cameraDb: version,
    lensDb: version,
    targetCamera: target,
    analysis: z
      .object({
        stats,
        cameraAggregates: z.array(aggregate).max(10000),
        selectedCameraKeys: z.array(z.string().max(400)).max(10000),
      })
      .strict(),
    recommendationsSnapshot: z.array(recommendation),
  })
  .strict();
export function exportResult(r: Result) {
  return JSON.stringify(
    {
      format: "fl-fave",
      formatVersion: 1,
      appVersion: r.appVersion,
      exportedAt: new Date().toISOString(),
      analyzedAt: r.analyzedAt,
      cameraDb: r.cameraDb,
      lensDb: r.lensDb,
      targetCamera: r.targetCamera,
      analysis: r.analysis,
      recommendationsSnapshot: r.recommendationsSnapshot,
    },
    null,
    2,
  );
}
export function importResult(source: string): Result {
  let raw: unknown;
  try {
    raw = JSON.parse(source);
  } catch {
    throw new Error("JSONとして読み込めないファイルです。");
  }
  if (
    raw &&
    typeof raw === "object" &&
    "formatVersion" in raw &&
    typeof raw.formatVersion === "number" &&
    raw.formatVersion > 1
  )
    throw new Error(
      "このファイルは新しいバージョンのFL-Faveで作成されています。",
    );
  const parsed = schema.safeParse(raw);
  if (!parsed.success)
    throw new Error("FL-Fave形式または集計データが不正です。");
  const d = parsed.data;
  const keys = d.analysis.cameraAggregates.map((g) => g.key);
  if (
    new Set(keys).size !== keys.length ||
    new Set(d.analysis.selectedCameraKeys).size !==
      d.analysis.selectedCameraKeys.length ||
    d.analysis.selectedCameraKeys.some((k) => !keys.includes(k))
  )
    throw new Error("カメラの選択情報が不正です。");
  const all = combine(d.analysis.cameraAggregates, keys);
  if (
    (Object.keys(all.stats) as (keyof typeof all.stats)[]).some(
      (k) => all.stats[k] !== d.analysis.stats[k],
    ) ||
    !all.stats.success
  )
    throw new Error("解析件数が一致しません。");
  const current = combine(
    d.analysis.cameraAggregates,
    d.analysis.selectedCameraKeys,
  );
  const modalValues = modes(current.equivalent);
  if (
    JSON.stringify(d.recommendationsSnapshot.map((r) => r.equivalent)) !==
    JSON.stringify(modalValues)
  )
    throw new Error("最頻値と推薦スナップショットが一致しません。");
  return {
    id: crypto.randomUUID(),
    analyzedAt: d.analyzedAt ?? d.exportedAt,
    appVersion: d.appVersion,
    cameraDb: d.cameraDb,
    lensDb: d.lensDb,
    targetCamera: d.targetCamera,
    analysis: d.analysis,
    recommendationsSnapshot: d.recommendationsSnapshot,
    modalValues,
  };
}
export function csv(r: Result) {
  const a = combine(r.analysis.cameraAggregates, r.analysis.selectedCameraKeys);
  const keys = [...Object.keys(a.actual), ...Object.keys(a.equivalent)].map(
    Number,
  );
  const header =
    "focal_length_mm,actual_count,actual_ratio,equivalent_35mm_count,equivalent_35mm_ratio";
  if (!keys.length) return header + "\n";
  const rows = [header];
  for (let i = Math.min(...keys); i <= Math.max(...keys); i++) {
    const x = a.actual[i] ?? 0,
      y = a.equivalent[i] ?? 0;
    rows.push(
      [
        i,
        x,
        a.stats.success ? x / a.stats.success : 0,
        y,
        a.stats.success ? y / a.stats.success : 0,
      ].join(","),
    );
  }
  return rows.join("\n") + "\n";
}
export function download(contents: string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
