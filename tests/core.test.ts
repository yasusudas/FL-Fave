import { describe, it, expect } from "vitest";
import {
  aggregate,
  pairMatches,
  combine,
  bins,
  modes,
  recommend,
  type Transient,
} from "@/lib/analysis";
import {
  validTarget,
  manufacturers,
  DB_INFO,
  APP_VERSION,
} from "@/data/cameras";
import { isCandidate, extensions } from "@/data/formats";
import { exportResult, importResult, csv } from "@/lib/transfer";
import type { Target, Lens, Result, Shot } from "@/lib/types";
const target: Target = {
  manufacturerId: "fujifilm",
  sensorProfileId: "aps",
  mountId: "fuji-x",
};
const record = (name: string, metadata: Shot, dir = "photos"): Transient => ({
  name,
  relativePath: dir + "/" + name,
  metadata,
});
const metadata = {
  make: "FUJIFILM",
  model: "X-T5",
  focal: 23,
  timestamp: "2026:09:10 12:00:00",
};
const input = [
  record("a.raf", metadata),
  record("a.jpg", metadata),
  record("a_edited.jpg", metadata),
  record("b.jpg", { make: "SONY", model: "ILCE-7M4", focal: 50 }),
  record("c.jpg", {
    make: "Unknown",
    model: "Thing",
    focal: 10,
    equivalent: 99,
  }),
  record("missing.png", {}),
  record("bad.jpg", { error: true }),
];
const analysis = aggregate(input, target);
function result(): Result {
  const combined = combine(
    analysis.cameraAggregates,
    analysis.selectedCameraKeys,
  );
  const values = modes(combined.equivalent);
  return {
    id: "test",
    analyzedAt: "2026-09-10T00:00:00.000Z",
    appVersion: APP_VERSION,
    cameraDb: DB_INFO,
    lensDb: DB_INFO,
    targetCamera: target,
    analysis: structuredClone(analysis),
    modalValues: values,
    recommendationsSnapshot: recommend(values, target),
  };
}
const l = (
  id: string,
  focal: number,
  price: number | null,
  extra: Partial<Lens> = {},
): Lens => ({
  id,
  name: id,
  focal,
  price,
  manufacturerId: "fujifilm",
  mountId: "fuji-x",
  sensors: ["aps"],
  aperture: 2,
  status: "current",
  firstParty: true,
  prime: true,
  priceType: price ? "official" : null,
  priceUpdatedAt: price ? "2026-09-10" : null,
  url: "https://example.com/lens",
  ...extra,
});
describe("discovery", () => {
  it.each([
    "root/a.jpg",
    "root/a/b/c.JPG",
    "root/旅行/作品.heic",
    "root/a.cr3",
    "root/a.psb",
    "root/a.jxl",
    "root/a.avif",
  ])("includes normal descendant %s", (p) =>
    expect(isCandidate(p.split("/").at(-1)!, p)).toBe(true),
  );
  it.each([
    "root/.hidden/a.jpg",
    "root/._a.jpg",
    "root/.a.jpg",
    "root/Thumbs.db",
    "root/a.mp4",
    "root/a.r3d",
  ])("excludes %s", (p) =>
    expect(isCandidate(p.split("/").at(-1)!, p)).toBe(false),
  );
  it("includes all required still-image families", () => {
    for (const e of [
      "dng",
      "cr2",
      "cr3",
      "nef",
      "arw",
      "raf",
      "x3f",
      "avif",
      "heif",
      "heic",
      "hif",
      "tiff",
      "tif",
      "jpeg",
      "jpg",
      "jxl",
      "psd",
      "psb",
      "png",
      "webp",
    ])
      expect(extensions.has(e)).toBe(true);
  });
});
describe("deduplication and conversion", () => {
  it("merges exact RAW+JPEG but keeps derivative", () => {
    expect(analysis.stats).toEqual({
      detected: 7,
      pairs: 1,
      shots: 6,
      success: 4,
      missing: 1,
      errors: 1,
    });
  });
  it("uses EXIF then camera DB then selected sensor", () => {
    const a = aggregate(
      [
        record("a.jpg", { ...metadata, equivalent: 36 }),
        record("b.jpg", metadata),
        record("c.jpg", { focal: 23 }),
      ],
      target,
    );
    expect(
      combine(a.cameraAggregates, a.selectedCameraKeys).equivalent,
    ).toEqual({ "35": 2, "36": 1 });
  });
  it("uses each known sensor when mixed", () =>
    expect(
      combine(analysis.cameraAggregates, analysis.selectedCameraKeys)
        .equivalent,
    ).toEqual({ "35": 2, "50": 1, "99": 1 }));
  it("does not infer actual from equivalent", () =>
    expect(
      aggregate([record("a.jpg", { equivalent: 35 })], target).stats.missing,
    ).toBe(1));
  it.each([0, -1, NaN, Infinity])("rejects invalid focal %s", (f) =>
    expect(
      aggregate([record("a.jpg", { focal: f })], target).stats.missing,
    ).toBe(1),
  );
  it("rounds halves up after conversion", () => {
    const a = aggregate(
      [
        record("a.jpg", { focal: 32.7 }),
        record("b.jpg", { focal: 33.4 }),
        record("c.jpg", { focal: 23 }),
      ],
      target,
    );
    const c = combine(a.cameraAggregates, a.selectedCameraKeys);
    expect(c.actual).toEqual({ "23": 1, "33": 2 });
    expect(c.equivalent).toEqual({ "35": 1, "49": 1, "50": 1 });
  });
  it("does not merge folders or one-to-many ambiguity", () => {
    expect(
      aggregate(
        [record("a.raf", metadata, "x"), record("a.jpg", metadata, "y")],
        target,
      ).stats.pairs,
    ).toBe(0);
    expect(
      aggregate(
        [
          record("a.raf", metadata),
          record("a.jpg", metadata),
          record("a.JPG", metadata),
        ],
        target,
      ).stats.pairs,
    ).toBe(0);
  });
  it.each(["make", "model", "timestamp", "focal"] as const)(
    "requires pairing field %s",
    (field) => {
      expect(pairMatches(metadata, { ...metadata, [field]: undefined })).toBe(
        false,
      );
    },
  );
  it("compares available subsecond precision conservatively", () => {
    expect(
      pairMatches(
        { ...metadata, subsecond: "10" },
        { ...metadata, subsecond: "100" },
      ),
    ).toBe(true);
    expect(
      pairMatches(
        { ...metadata, subsecond: "10" },
        { ...metadata, subsecond: "11" },
      ),
    ).toBe(false);
    expect(pairMatches(metadata, { ...metadata, subsecond: "11" })).toBe(true);
  });
  it("allows make alias normalization", () =>
    expect(
      pairMatches(
        { ...metadata, make: "NIKON CORPORATION" },
        { ...metadata, make: "Nikon" },
      ),
    ).toBe(true));
});
describe("histograms and recommendation", () => {
  it("includes zero bins and all tied modes", () => {
    expect(bins({ "35": 2, "38": 2 }, 4).map((b) => b.count)).toEqual([
      2, 0, 0, 2,
    ]);
    expect(modes({ "35": 2, "38": 2, "50": 1 })).toEqual([35, 38]);
  });
  it("recombines selected groups and supports empty filters", () => {
    const key = analysis.cameraAggregates.find(
      (g) => g.model === "ILCE-7M4",
    )!.key;
    expect(combine(analysis.cameraAggregates, [key]).equivalent).toEqual({
      "50": 1,
    });
    expect(combine(analysis.cameraAggregates, []).stats.success).toBe(0);
  });
  it("converts equivalent mode to target actual and ranks distance then price", () => {
    const r = recommend([60], target, [
      l("expensive", 35, 900),
      l("cheap", 45, 100),
      l("far", 50, 10),
    ])[0];
    expect(r.targetActual).toBe(40);
    expect(r.choices.map((c) => c.lens.id)).toEqual([
      "cheap",
      "expensive",
      "far",
    ]);
  });
  it("chooses cheapest representative and keeps distinct focal lengths", () => {
    const r = recommend([50], target, [
      l("a", 35, 200),
      l("b", 35, 100),
      l("unknown", 35, null),
      l("c", 23, 300),
      l("d", 50, 400),
    ])[0];
    expect(r.choices[0].lens.id).toBe("b");
    expect(r.choices[0].alternatives.map((l) => l.id)).toEqual([
      "a",
      "unknown",
    ]);
    expect(new Set(r.choices.map((c) => c.lens.focal)).size).toBe(3);
  });
  it("filters third party, wrong mount/sensor, zoom and discontinued", () => {
    expect(
      recommend([50], target, [
        l("a", 35, 100, { firstParty: false }),
        l("b", 35, 100, { mountId: "l" }),
        l("c", 35, 100, { sensors: ["ff"] }),
        l("d", 35, 100, { prime: false }),
        l("e", 35, 100, { status: "discontinued" }),
        l("f", 35, 100, { manufacturerId: "sony" }),
      ])[0].choices,
    ).toHaveLength(0);
  });
  it.each([0, 1, 2, 3, 4])(
    "shows only up to 3 available focal groups: %i",
    (n) =>
      expect(
        recommend(
          [50],
          target,
          Array.from({ length: n }, (_, i) => l("x" + i, 20 + i, 100)),
        )[0].choices,
      ).toHaveLength(Math.min(n, 3)),
  );
  it("separates discontinued exact rounded target", () => {
    expect(
      recommend([52], target, [l("old", 35, 20, { status: "discontinued" })])[0]
        .discontinued,
    ).toHaveLength(1);
  });
  it("creates separate section for every tied mode", () =>
    expect(recommend([35, 50, 85], target).map((g) => g.equivalent)).toEqual([
      35, 50, 85,
    ]));
  it("offers all nine manufacturers and valid progressive targets", () => {
    expect(manufacturers).toHaveLength(9);
    expect(validTarget(target)).toBe(true);
    expect(validTarget({ ...target, mountId: "fuji-g" })).toBe(false);
  });
});
describe("private portable results", () => {
  it("roundtrips with active state and snapshots", () => {
    const r = result(),
      s = importResult(exportResult(r));
    expect(s.analysis).toEqual(r.analysis);
    expect(s.recommendationsSnapshot).toEqual(r.recommendationsSnapshot);
  });
  it("contains no per-photo fields", () => {
    const text = exportResult(result());
    for (const s of [
      "a.raf",
      "relativePath",
      "timestamp",
      "GPS",
      "DateTimeOriginal",
    ])
      expect(text).not.toContain(s);
  });
  it("rejects unknown newer version", () =>
    expect(() => importResult('{"formatVersion":2}')).toThrow(
      "新しいバージョン",
    ));
  it("rejects invalid/extra fields, mismatched statistics and prototype keys", () => {
    for (const mutate of [
      (d: any) => {
        d.photos = [];
      },
      (d: any) => {
        d.analysis.stats.success++;
      },
      (d: any) => {
        d.analysis.cameraAggregates[0].actual = { __proto__: 3 };
      },
      (d: any) => {
        d.analysis.selectedCameraKeys = ["wrong"];
      },
    ]) {
      const d = JSON.parse(exportResult(result()));
      mutate(d);
      expect(() => importResult(JSON.stringify(d))).toThrow();
    }
  });
  it("rejects malformed JSON", () =>
    expect(() => importResult("not json")).toThrow());
  it("CSV has both distributions, union range, zero rows and only fractions", () => {
    const text = csv(result()),
      lines = text.trim().split("\n");
    expect(lines[0]).toBe(
      "focal_length_mm,actual_count,actual_ratio,equivalent_35mm_count,equivalent_35mm_ratio",
    );
    expect(lines[1].split(",")[0]).toBe("10");
    expect(lines.at(-1)?.split(",")[0]).toBe("99");
    expect(lines.find((l) => l.startsWith("34,"))).toBe("34,0,0,0,0");
    expect(text).not.toContain("FUJIFILM");
  });
});
