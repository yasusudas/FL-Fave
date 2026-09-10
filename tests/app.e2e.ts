import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
const referenceDirectory = path.join(tmpdir(), "fl-fave-fixtures");
import { jpeg, createTree, modernFormats } from "./fixtures";
async function setup(page: Page) {
  await page.goto("/");
  await page.getByLabel("メーカー", { exact: true }).selectOption("fujifilm");
  await page.getByLabel("センサーサイズ", { exact: true }).selectOption("aps");
  await page.getByLabel("マウント", { exact: true }).selectOption("fuji-x");
}
async function exported(page: Page) {
  const waiting = page.waitForEvent("download");
  await page
    .getByRole("button", { name: ".flfave を書き出す", exact: true })
    .click();
  const d = await waiting;
  return JSON.parse(await fs.readFile((await d.path())!, "utf8"));
}
async function stored(page: Page) {
  return page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const r = indexedDB.open("fl-fave");
      r.onsuccess = () => resolve(r.result);
      r.onerror = reject;
    });
    return new Promise<any[]>((resolve, reject) => {
      const q = database.transaction("results").objectStore("results").getAll();
      q.onsuccess = () => {
        database.close();
        resolve(q.result);
      };
      q.onerror = reject;
    });
  });
}
test("recursive folder, conservative pairs, mode/filter recompute, export/import, history and deletion", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await setup(page);
  await fs.mkdir("/tmp/fl-fave-qa", { recursive: true });
  await page.screenshot({ path: "/tmp/fl-fave-qa/start.png" });
  const root = await createTree("/tmp/fl-fave-generated-library");
  let requests: string[] = [];
  page.on("request", (r) => requests.push(`${r.method()} ${r.url()}`));
  await page.getByTestId("folder-input").setInputFiles(root);
  await expect(
    page.getByRole("heading", { name: "あなたが選んだ画角。" }),
  ).toBeVisible();
  let data = await exported(page);
  expect(data.analysis.stats).toEqual({
    detected: 6,
    pairs: 1,
    shots: 5,
    success: 3,
    missing: 1,
    errors: 1,
  });
  expect(data.recommendationsSnapshot.map((r: any) => r.equivalent)).toEqual([
    35,
  ]);
  expect(JSON.stringify(data)).not.toMatch(
    /pair_edited|relativePath|GPS|2026:09:10/,
  );
  const before = data.recommendationsSnapshot;
  await page.getByRole("button", { name: "実焦点距離", exact: true }).click();
  data = await exported(page);
  expect(data.recommendationsSnapshot).toEqual(before);
  await expect(
    page.getByText(
      "複数のセンサーサイズを含むため、実焦点距離では画角を直接比較できません。",
    ),
  ).toBeVisible();
  await page.getByRole("button", { name: "35mm判換算", exact: true }).click();
  await page.screenshot({ path: "/tmp/fl-fave-qa/result.png", fullPage: true });
  await page.getByRole("checkbox").filter({ hasText: "" }).count();
  const boxes = page.locator(".camera-choice input");
  for (const box of await boxes.all()) await box.uncheck();
  await expect(
    page.getByText("分析対象のカメラを選ぶと、分布とおすすめが表示されます。"),
  ).toBeVisible();
  await boxes.first().check();
  const exportData = await exported(page);
  expect(exportData.analysis.selectedCameraKeys).toHaveLength(1);
  const csvWait = page.waitForEvent("download");
  await page.getByRole("button", { name: "CSVを書き出す" }).click();
  const csvFile = await csvWait;
  const csvText = await fs.readFile((await csvFile.path())!, "utf8");
  expect(csvText).toContain(
    "focal_length_mm,actual_count,actual_ratio,equivalent_35mm_count,equivalent_35mm_ratio",
  );
  expect(csvText).not.toMatch(/FUJIFILM|X-T5|2026/);
  await expect.poll(async () => stored(page).then((r) => r.length)).toBe(1);
  expect(JSON.stringify(await stored(page))).not.toMatch(
    /pair.jpg|relativePath|timestamp|FileName/,
  );
  await page.reload();
  await page.getByRole("button", { name: "履歴", exact: true }).click();
  await page.locator(".history-open").click();
  await expect(
    page.getByRole("heading", { name: "あなたが選んだ画角。" }),
  ).toBeVisible();
  await page.getByTestId("import-input").setInputFiles({
    name: "saved.flfave",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(exportData)),
  });
  await expect.poll(async () => stored(page).then((r) => r.length)).toBe(2);
  await page.getByRole("button", { name: "履歴", exact: true }).click();
  await page
    .getByRole("button", { name: /の履歴を削除/ })
    .first()
    .click();
  await expect.poll(async () => stored(page).then((r) => r.length)).toBe(1);
  expect(
    requests.filter((r) => !r.startsWith("GET http://127.0.0.1:3000/")),
  ).toEqual([]);
  expect(errors).toEqual([]);
});
test("offline cached startup and WASM metadata parsing, no data transmission", async ({
  page,
  context,
}) => {
  await setup(page);
  await page.getByRole("button", { name: "About", exact: true }).click();
  await expect(
    page.getByText(/オフライン利用の準備ができています/),
  ).toBeVisible({ timeout: 30000 });
  await page.reload();
  await context.setOffline(true);
  await page.reload();
  await expect(
    page.getByText("撮影に使用したカメラを選択してください"),
  ).toBeVisible();
  const requests: any[] = [];
  page.on("request", (r) =>
    requests.push({ url: r.url(), method: r.method(), body: r.postData() }),
  );
  await page
    .getByTestId("photo-input")
    .setInputFiles([
      path.join(referenceDirectory, "CanonRaw.cr3"),
      path.join(referenceDirectory, "FujiFilm.raf"),
      path.join(referenceDirectory, "QuickTime.heic"),
      path.join(referenceDirectory, "Photoshop.psd"),
    ]);
  await expect(
    page.getByRole("heading", { name: "あなたが選んだ画角。" }),
  ).toBeVisible({ timeout: 45000 });
  const data = await exported(page);
  expect(data.analysis.stats.success).toBe(2);
  expect(data.analysis.stats.errors).toBe(0);
  expect(
    requests.every(
      (r) =>
        r.url.startsWith("http://127.0.0.1:3000/") &&
        r.method === "GET" &&
        r.body === null,
    ),
  ).toBe(true);
  await page.reload();
  await page.getByRole("button", { name: "履歴", exact: true }).click();
  await page.locator(".history-open").click();
  await expect(
    page.getByRole("heading", { name: "あなたが選んだ画角。" }),
  ).toBeVisible();
});
test("cancel/empty/missing/malformed/future-import states never save incomplete results", async ({
  page,
}) => {
  await setup(page);
  await page.getByTestId("photo-input").setInputFiles({
    name: "a.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("test"),
  });
  await expect(
    page.getByText(/対応する画像が見つかりませんでした/),
  ).toBeVisible();
  await page.getByTestId("photo-input").setInputFiles({
    name: "missing.jpg",
    mimeType: "image/jpeg",
    buffer: jpeg(null),
  });
  await expect(page.getByText(/焦点距離を取得できませんでした/)).toBeVisible();
  expect(await stored(page)).toHaveLength(0);
  await page.getByTestId("photo-input").setInputFiles(
    Array.from({ length: 100 }, (_, i) => ({
      name: `image${i}.psd`,
      mimeType: "image/vnd.adobe.photoshop",
      buffer: Buffer.from("test"),
    })),
  );
  await page
    .getByRole("button", { name: "解析をキャンセル", exact: true })
    .click();
  await expect(page.getByText(/解析をキャンセルしました/)).toBeVisible();
  expect(await stored(page)).toHaveLength(0);
  await page.getByTestId("import-input").setInputFiles({
    name: "new.flfave",
    mimeType: "application/json",
    buffer: Buffer.from('{"formatVersion":999}'),
  });
  await expect(page.locator(".notice.error")).toContainText("新しいバージョン");
  expect(await stored(page)).toHaveLength(0);
});
test("mobile multiple photos, ties, responsive layout and settings", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setup(page);
  await expect(
    page.getByRole("button", { name: "写真を選択", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "/tmp/fl-fave-qa/mobile-start.png",
    fullPage: true,
  });
  await page.getByTestId("photo-input").setInputFiles([
    { name: "a.jpg", mimeType: "image/jpeg", buffer: jpeg(23) },
    { name: "b.jpg", mimeType: "image/jpeg", buffer: jpeg(33.4) },
  ]);
  await expect(
    page.getByRole("heading", { name: "あなたが選んだ画角。" }),
  ).toBeVisible();
  const data = await exported(page);
  expect(data.recommendationsSnapshot.map((r: any) => r.equivalent)).toEqual([
    35, 50,
  ]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "/tmp/fl-fave-qa/mobile-result.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "About", exact: true }).click();
  await expect(page.getByText(/Camera DB/)).toBeVisible();
  await expect(
    page.getByText("2026.09.10.1", { exact: false }).first(),
  ).toBeVisible();
});
test("published ExifTool format fixtures complete with no worker crashes", async ({
  page,
}) => {
  await setup(page);
  const files = (await fs.readdir(referenceDirectory)).map((n) =>
    path.join(referenceDirectory, n),
  );
  await page.getByTestId("photo-input").setInputFiles(files);
  await expect(
    page.getByRole("heading", { name: "あなたが選んだ画角。" }),
  ).toBeVisible({ timeout: 55000 });
  const data = await exported(page);
  expect(data.analysis.stats.detected).toBe(files.length);
  expect(data.analysis.stats.success).toBe(13);
  expect(data.analysis.stats.missing).toBe(7);
  expect(data.analysis.stats.errors).toBe(0);
  await fs.writeFile(
    "/tmp/fl-fave-qa/format-fixtures-result.json",
    JSON.stringify(data, null, 2),
  );
});

test("AVIF, PNG, WebP and PSB retain focal metadata without retaining private tags", async ({
  page,
}) => {
  await setup(page);
  await page.getByTestId("photo-input").setInputFiles(await modernFormats());
  await expect(
    page.getByRole("heading", { name: "あなたが選んだ画角。" }),
  ).toBeVisible();
  const data = await exported(page);
  expect(data.analysis.stats).toEqual({
    detected: 4,
    pairs: 0,
    shots: 4,
    success: 4,
    missing: 0,
    errors: 0,
  });
  expect(data.recommendationsSnapshot.map((r: any) => r.equivalent)).toEqual([
    35,
  ]);
  expect(JSON.stringify(data)).not.toMatch(
    /PRIVATE-TEST|Artist|Copyright|DateTimeOriginal/,
  );
});
