export type Target = { manufacturerId: string; sensorProfileId: string; mountId: string };
export type Histogram = Record<string, number>;
export type Stats = { detected: number; pairs: number; shots: number; success: number; missing: number; errors: number };
export type CameraAggregate = {
  key: string; manufacturer: string; model: string; match: 'matched'|'unregistered'|'unknown';
  sensorProfileId: string; cropFactor: number; sources: { exif: number; database: number; fallback: number };
  actual: Histogram; equivalent: Histogram; stats: Stats;
};
export type Lens = { id: string; manufacturerId: string; name: string; mountId: string; focal: number; aperture: number; status: 'current'|'discontinued'; sensors: string[]; firstParty: boolean; prime: boolean; price: number|null; priceType: 'official'|'street'|null; priceUpdatedAt: string|null; url: string };
export type Recommendation = { equivalent: number; targetActual: number; choices: { lens: Lens; alternatives: Lens[] }[]; discontinued: Lens[] };
export type Result = {
  id: string; analyzedAt: string; appVersion: string;
  cameraDb: { version: string; updatedAt: string }; lensDb: { version: string; updatedAt: string };
  targetCamera: Target; analysis: { stats: Stats; cameraAggregates: CameraAggregate[]; selectedCameraKeys: string[] };
  recommendationsSnapshot: Recommendation[]; modalValues: number[];
};
// Only transient in the worker. Never stored or exported.
export type Shot = { make?: string; model?: string; focal?: number; equivalent?: number; timestamp?: string; subsecond?: string; error?: boolean };
export type Progress = { phase: 'discovering'|'analyzing'; total: number; processed: number; success: number; missing: number; errors: number };
