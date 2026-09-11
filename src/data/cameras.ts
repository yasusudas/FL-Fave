export const DB_INFO = { version: "2026.09.11.1", updatedAt: "2026-09-11" };
export const APP_VERSION = "1.0.0";
export const sensors = [
  { id: "ff", name: "フルサイズ", crop: 1 },
  { id: "aps", name: "APS-C（1.5×）", crop: 1.5 },
  { id: "canon-aps", name: "APS-C（1.6×）", crop: 1.6 },
  { id: "mft", name: "マイクロフォーサーズ", crop: 2 },
  { id: "gfx", name: "中判 44 × 33 mm", crop: 0.79 },
  { id: "aps-h", name: "APS-H", crop: 1.3 },
];
export const manufacturers = [
  {
    id: "sony",
    name: "SONY",
    aliases: ["sony", "sony corporation"],
    systems: [
      { sensor: "ff", mounts: ["sony-e", "sony-a"] },
      { sensor: "aps", mounts: ["sony-e", "sony-a"] },
    ],
  },
  {
    id: "canon",
    name: "Canon",
    aliases: ["canon"],
    systems: [
      { sensor: "ff", mounts: ["canon-rf", "canon-ef"] },
      { sensor: "canon-aps", mounts: ["canon-rf", "canon-ef", "canon-efm"] },
    ],
  },
  {
    id: "nikon",
    name: "Nikon",
    aliases: ["nikon", "nikon corporation"],
    systems: [
      { sensor: "ff", mounts: ["nikon-z", "nikon-f"] },
      { sensor: "aps", mounts: ["nikon-z", "nikon-f"] },
    ],
  },
  {
    id: "fujifilm",
    name: "FUJIFILM",
    aliases: ["fujifilm", "fuji photo film co., ltd."],
    systems: [
      { sensor: "aps", mounts: ["fuji-x"] },
      { sensor: "gfx", mounts: ["fuji-g"] },
    ],
  },
  {
    id: "om",
    name: "OM SYSTEM / OLYMPUS",
    aliases: [
      "om digital solutions",
      "om digital solutions corporation",
      "olympus",
      "olympus corporation",
      "olympus imaging corp.",
    ],
    systems: [{ sensor: "mft", mounts: ["mft"] }],
  },
  {
    id: "panasonic",
    name: "Panasonic / LUMIX",
    aliases: ["panasonic", "panasonic corporation", "lumix"],
    systems: [
      { sensor: "ff", mounts: ["l"] },
      { sensor: "mft", mounts: ["mft"] },
    ],
  },
  {
    id: "pentax",
    name: "PENTAX / RICOH",
    aliases: [
      "pentax",
      "ricoh",
      "ricoh imaging company, ltd.",
      "pentax ricoh imaging co., ltd.",
      "pentax corporation",
    ],
    systems: [
      { sensor: "ff", mounts: ["pentax-k"] },
      { sensor: "aps", mounts: ["pentax-k"] },
      { sensor: "gfx", mounts: ["pentax-645"] },
    ],
  },
  {
    id: "leica",
    name: "Leica",
    aliases: ["leica", "leica camera ag"],
    systems: [
      { sensor: "ff", mounts: ["l", "leica-m"] },
      { sensor: "aps", mounts: ["l"] },
    ],
  },
  {
    id: "sigma",
    name: "SIGMA",
    aliases: ["sigma", "sigma corporation"],
    systems: [
      { sensor: "ff", mounts: ["l"] },
      { sensor: "aps", mounts: ["sigma-sa"] },
      { sensor: "aps-h", mounts: ["sigma-sa"] },
    ],
  },
];
export const mounts: Record<string, string> = {
  "sony-e": "Eマウント",
  "sony-a": "Aマウント",
  "canon-rf": "RFマウント",
  "canon-ef": "EFマウント",
  "canon-efm": "EF-Mマウント",
  "nikon-z": "Zマウント",
  "nikon-f": "Fマウント",
  "fuji-x": "Xマウント",
  "fuji-g": "Gマウント",
  mft: "マイクロフォーサーズ",
  l: "Lマウント",
  "pentax-k": "Kマウント",
  "pentax-645": "645マウント",
  "leica-m": "Mマウント",
  "sigma-sa": "SAマウント",
};
export const normalize = (s: string = "") =>
  s.trim().replace(/\s+/g, " ").toLowerCase();
export function manufacturerFor(make: string = "") {
  return manufacturers.find((m) => m.aliases.includes(normalize(make)));
}
export const cropFor = (id: string) =>
  sensors.find((s) => s.id === id)?.crop ?? 1;
export function validTarget(t: {
  manufacturerId: string;
  sensorProfileId: string;
  mountId: string;
}) {
  return !!manufacturers
    .find((m) => m.id === t.manufacturerId)
    ?.systems.some(
      (s) => s.sensor === t.sensorProfileId && s.mounts.includes(t.mountId),
    );
}
type Camera = {
  manufacturerId: string;
  model: string;
  aliases: string[];
  sensorProfileId: string;
  mountId: string;
  cropFactor: number;
};
const group = (
  manufacturerId: string,
  sensorProfileId: string,
  mountId: string,
  models: string[],
): Camera[] =>
  models.map((model) => ({
    manufacturerId,
    model,
    aliases: [model],
    sensorProfileId,
    mountId,
    cropFactor: cropFor(sensorProfileId),
  }));
export const cameras: Camera[] = [
  ...group("sony", "ff", "sony-e", [
    "ILCE-7M2",
    "ILCE-7M3",
    "ILCE-7M4",
    "ILCE-7RM3",
    "ILCE-7RM4",
    "ILCE-7RM5",
    "ILCE-7SM3",
    "ILCE-7C",
    "ILCE-7CM2",
    "ILCE-7CR",
    "ILCE-1",
    "ILCE-9",
    "ILCE-9M2",
    "ILCE-9M3",
  ]),
  ...group("sony", "aps", "sony-e", [
    "ILCE-6000",
    "ILCE-6100",
    "ILCE-6300",
    "ILCE-6400",
    "ILCE-6500",
    "ILCE-6600",
    "ILCE-6700",
    "ZV-E10",
    "ZV-E10M2",
  ]),
  ...group("canon", "ff", "canon-rf", [
    "Canon EOS R",
    "Canon EOS RP",
    "Canon EOS R3",
    "Canon EOS R5",
    "Canon EOS R5 Mark II",
    "Canon EOS R6",
    "Canon EOS R6 Mark II",
    "Canon EOS R8",
    "Canon EOS R1",
  ]),
  ...group("canon", "canon-aps", "canon-rf", [
    "Canon EOS R7",
    "Canon EOS R10",
    "Canon EOS R50",
    "Canon EOS R100",
  ]),
  ...group("canon", "ff", "canon-ef", [
    "Canon EOS 5D Mark II",
    "Canon EOS 5D Mark III",
    "Canon EOS 5D Mark IV",
    "Canon EOS 6D",
    "Canon EOS 6D Mark II",
  ]),
  ...group("canon", "canon-aps", "canon-ef", [
    "Canon EOS 80D",
    "Canon EOS 90D",
    "Canon EOS 7D Mark II",
  ]),
  ...group("nikon", "ff", "nikon-z", [
    "NIKON Z 5",
    "NIKON Z 6",
    "NIKON Z 6_2",
    "NIKON Z 6_3",
    "NIKON Z 7",
    "NIKON Z 7_2",
    "NIKON Z 8",
    "NIKON Z 9",
    "NIKON Z f",
  ]),
  ...group("nikon", "aps", "nikon-z", [
    "NIKON Z 50",
    "NIKON Z 50_2",
    "NIKON Z fc",
    "NIKON Z 30",
  ]),
  ...group("nikon", "ff", "nikon-f", [
    "NIKON D750",
    "NIKON D780",
    "NIKON D800",
    "NIKON D810",
    "NIKON D850",
  ]),
  ...group("nikon", "aps", "nikon-f", [
    "NIKON D500",
    "NIKON D7500",
    "NIKON D5600",
  ]),
  ...group("fujifilm", "aps", "fuji-x", [
    "X-T1",
    "X-T2",
    "X-T3",
    "X-T4",
    "X-T5",
    "X-T20",
    "X-T30",
    "X-T30 II",
    "X-T50",
    "X-S10",
    "X-S20",
    "X-H1",
    "X-H2",
    "X-H2S",
    "X-Pro2",
    "X-Pro3",
    "X-E3",
    "X-E4",
    "X-M5",
  ]),
  ...group("fujifilm", "aps", "fixed", ["X100V", "X100VI"]),
  ...group("fujifilm", "gfx", "fuji-g", [
    "GFX 50S",
    "GFX 50S II",
    "GFX 50R",
    "GFX 100",
    "GFX100",
    "GFX100S",
    "GFX100 II",
    "GFX100S II",
  ]),
  ...group("om", "mft", "mft", [
    "OM-1",
    "OM-1MarkII",
    "OM-3",
    "OM-5",
    "E-M1",
    "E-M1MarkII",
    "E-M1MarkIII",
    "E-M1X",
    "E-M5MarkII",
    "E-M5MarkIII",
    "E-M10MarkIV",
    "PEN-F",
  ]),
  ...group("panasonic", "ff", "l", [
    "DC-S5",
    "DC-S5M2",
    "DC-S5M2X",
    "DC-S1",
    "DC-S1R",
    "DC-S1H",
    "DC-S9",
  ]),
  ...group("panasonic", "mft", "mft", [
    "DC-GH5",
    "DC-GH6",
    "DC-GH7",
    "DC-G9",
    "DC-G9M2",
    "DMC-GX7",
    "DC-GX9",
    "DMC-GX8",
  ]),
  ...group("pentax", "ff", "pentax-k", ["PENTAX K-1", "PENTAX K-1 Mark II"]),
  ...group("pentax", "aps", "pentax-k", [
    "PENTAX K-3",
    "PENTAX K-3 II",
    "PENTAX K-3 Mark III",
    "PENTAX K-70",
    "PENTAX KF",
    "PENTAX KP",
  ]),
  ...group("pentax", "gfx", "pentax-645", ["PENTAX 645Z", "PENTAX 645D"]),
  ...group("leica", "ff", "l", [
    "LEICA SL (Typ 601)",
    "LEICA SL2",
    "LEICA SL2-S",
    "LEICA SL3",
  ]),
  ...group("leica", "ff", "leica-m", ["LEICA M10", "LEICA M11", "LEICA M11-P"]),
  ...group("leica", "aps", "l", ["LEICA CL", "LEICA TL2"]),
  ...group("sigma", "ff", "l", ["SIGMA fp", "SIGMA fp L", "fp", "fp L"]),
  ...group("sigma", "aps", "sigma-sa", ["sd Quattro"]),
  ...group("sigma", "aps-h", "sigma-sa", ["sd Quattro H"]),
];
export function findCamera(make?: string, model?: string) {
  const m = manufacturerFor(make);
  return cameras.find(
    (c) =>
      c.manufacturerId === m?.id &&
      c.aliases.some((a) => normalize(a) === normalize(model)),
  );
}
