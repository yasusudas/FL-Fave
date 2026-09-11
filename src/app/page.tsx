"use client";
import { useEffect, useRef, useState, useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from "recharts";
import {
  manufacturers,
  sensors,
  mounts,
  cropFor,
  validTarget,
  DB_INFO,
  APP_VERSION,
  cameras,
} from "@/data/cameras";
import { lenses } from "@/data/lenses";
import { extensions, formatManifest } from "@/data/formats";
import { bins, combine, modes, recommend } from "@/lib/analysis";
import { db } from "@/lib/storage";
import { exportResult, importResult, csv, download } from "@/lib/transfer";
import type { Target, Result, Progress, Stats, Lens } from "@/lib/types";
const blank: Target = { manufacturerId: "", sensorProfileId: "", mountId: "" };
const number = (n: number) => n.toLocaleString("ja-JP");
const date = (s: string) =>
  new Date(s).toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
function system(t: Target) {
  return `${manufacturers.find((m) => m.id === t.manufacturerId)?.name ?? t.manufacturerId} / ${sensors.find((s) => s.id === t.sensorProfileId)?.name ?? t.sensorProfileId} / ${mounts[t.mountId] ?? t.mountId}`;
}
function Price({ lens }: { lens: Lens }) {
  return (
    <p className="price">
      {lens.price === null ? "価格未登録" : `¥${number(lens.price)}（税込）`}
      <small>
        {lens.price !== null
          ? `${lens.priceType === "official" ? "メーカー公式価格" : "参考実売価格"} · ${lens.priceUpdatedAt}`
          : "公式サイトで価格を確認できます"}
      </small>
    </p>
  );
}
function Diagnostics({ stats }: { stats: Stats }) {
  return (
    <div className="diagnostics">
      {(
        [
          ["detected", "検出画像"],
          ["pairs", "RAW＋JPEGペア"],
          ["shots", "重複排除後の枚数"],
          ["success", "焦点距離取得成功"],
          ["missing", "焦点距離情報なし"],
          ["errors", "読み取りエラー"],
        ] as const
      ).map(([key, label]) => (
        <div key={key}>
          <span>{label}</span>
          <strong>{number(stats[key])}</strong>
        </div>
      ))}
    </div>
  );
}
function Distribution({
  rows,
  modal,
}: {
  rows: ReturnType<typeof bins>;
  modal: number[];
}) {
  const [tableTop, setTableTop] = useState(0);
  const [zoom, setZoom] = useState(0);
  const ranking = useMemo(
    () =>
      rows
        .filter((r) => r.count >= 10)
        .sort((a, b) => b.count - a.count || a.focal - b.focal),
    [rows],
  );
  const chartRows = useMemo(() => {
    const counts = new Map(rows.map((r) => [r.focal, r]));
    return Array.from(
      { length: Math.max(600, rows.at(-1)?.focal ?? 600) },
      (_, i) => counts.get(i + 1) ?? { focal: i + 1, count: 0, ratio: 0 },
    );
  }, [rows]);
  const [chartLeft, setChartLeft] = useState(0);
  const [viewport, setViewport] = useState(900);
  const container = useRef<HTMLDivElement>(null);
  const tableContainer = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = container.current;
    if (!el) return;
    const ob = new ResizeObserver(() => setViewport(el.clientWidth));
    ob.observe(el);
    return () => ob.disconnect();
  }, []);
  useEffect(() => {
    setTableTop(0);
    setChartLeft(0);
    if (tableContainer.current) tableContainer.current.scrollTop = 0;
    if (container.current) container.current.scrollLeft = 0;
  }, [rows]);
  // Zooming out fits the whole range; zooming in retains individual 1 mm bins.
  const fitUnit = Math.max(1, viewport - 80) / chartRows.length;
  const unit = fitUnit + ((Math.max(24, fitUnit) - fitUnit) * zoom) / 100;
  const totalWidth = Math.max(viewport, chartRows.length * unit + 80);
  const virtual = chartRows.length > 1000 && zoom > 0;
  const start = virtual ? Math.max(0, Math.floor(chartLeft / unit) - 4) : 0;
  const end = virtual
    ? Math.min(chartRows.length, start + Math.ceil(viewport / unit) + 12)
    : chartRows.length;
  const windowRows = chartRows.slice(start, end);
  const width = virtual ? windowRows.length * unit + 80 : totalWidth;
  const max = rows.reduce((max, r) => Math.max(max, r.count), 1);
  const tableStart = Math.max(0, Math.floor(tableTop / 40) - 4),
    tableEnd = Math.min(ranking.length, tableStart + 24);
  function changeZoom(value: number) {
    setZoom(value);
    setChartLeft(0);
    if (container.current) container.current.scrollLeft = 0;
  }
  return (
    <>
      <section className="section">
        <div className="section-heading">
          <h2>焦点距離の分布</h2>
          <span>1 mm刻み · 1–{chartRows.length} mm</span>
        </div>
        <div className="chart-controls">
          <button type="button" onClick={() => changeZoom(0)}>
            全体表示
          </button>
          <label htmlFor="chart-zoom">横方向の拡大率</label>
          <div className="chart-zoom-range">
            <span>縮小</span>
            <input
              id="chart-zoom"
              type="range"
              min="0"
              max="100"
              step="1"
              value={zoom}
              onChange={(e) => changeZoom(Number(e.target.value))}
            />
            <span>拡大</span>
          </div>
        </div>
        <div
          className="chart-scroll"
          ref={container}
          onScroll={(e) => setChartLeft(e.currentTarget.scrollLeft)}
          aria-label="焦点距離グラフ。横にスクロールできます"
          tabIndex={0}
        >
          <div style={{ width: totalWidth, height: 280, position: "relative" }}>
            <div
              style={{ position: "absolute", left: virtual ? start * unit : 0 }}
            >
              <BarChart
                width={width}
                height={280}
                data={windowRows}
                margin={{ top: 24, right: 20, left: 0, bottom: 10 }}
                accessibilityLayer
              >
                <CartesianGrid vertical={false} stroke="#e9ebea" />
                <XAxis
                  dataKey="focal"
                  interval="preserveStartEnd"
                  minTickGap={12}
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: "#bfc4c0" }}
                />
                <YAxis
                  allowDecimals={false}
                  domain={[0, max]}
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  labelFormatter={(v) => `${v} mm`}
                  formatter={(v) => [`${v} 枚`, null]}
                  cursor={{ fill: "#f0f2ed" }}
                />
                <Bar dataKey="count" isAnimationActive={false} maxBarSize={18}>
                  {windowRows.map((r) => (
                    <Cell
                      key={r.focal}
                      fill={modal.includes(r.focal) ? "#bedf39" : "#232723"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </div>
          </div>
        </div>
        <div className="axis-caption">
          <span>広角</span>
          <span>焦点距離（mm） / 縦軸：枚数</span>
          <span>望遠</span>
        </div>
      </section>
      <section className="section">
        <div className="section-heading">
          <h2>よく使う焦点距離ランキング</h2>
          <span>10枚以上</span>
        </div>
        <div
          className="table-scroll"
          ref={tableContainer}
          onScroll={(e) => setTableTop(e.currentTarget.scrollTop)}
          tabIndex={0}
          aria-label="焦点距離ランキング"
        >
          <table>
            <thead>
              <tr>
                <th>順位</th>
                <th>焦点距離</th>
                <th>枚数</th>
              </tr>
            </thead>
            <tbody>
              {ranking.length === 0 && (
                <tr>
                  <td colSpan={3}>10枚以上撮影された焦点距離はありません。</td>
                </tr>
              )}
              {tableStart > 0 && (
                <tr aria-hidden="true">
                  <td
                    colSpan={3}
                    style={{ height: tableStart * 40, padding: 0 }}
                  />
                </tr>
              )}
              {ranking.slice(tableStart, tableEnd).map((r, index) => (
                <tr
                  key={r.focal}
                  className={modal.includes(r.focal) ? "modal-row" : ""}
                >
                  <td>{tableStart + index + 1}位</td>
                  <td>
                    {r.focal} mm{" "}
                    {modal.includes(r.focal) && (
                      <span className="mode-label">最頻</span>
                    )}
                  </td>
                  <td>{number(r.count)}</td>
                </tr>
              ))}
              {tableEnd < ranking.length && (
                <tr aria-hidden="true">
                  <td
                    colSpan={3}
                    style={{
                      height: (ranking.length - tableEnd) * 40,
                      padding: 0,
                    }}
                  />
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
export default function Home() {
  const [target, setTarget] = useState<Target>(blank),
    [view, setView] = useState<"start" | "history" | "about" | "result">(
      "start",
    );
  const [history, setHistory] = useState<Result[]>([]),
    [result, setResult] = useState<Result | null>(null),
    [mode, setMode] = useState<"actual" | "equivalent">("equivalent");
  const [progress, setProgress] = useState<Progress | null>(null),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [diagnostics, setDiagnostics] = useState<Stats | null>(null),
    [offlineReady, setOfflineReady] = useState(false);
  const folderInput = useRef<HTMLInputElement>(null),
    photoInput = useRef<HTMLInputElement>(null),
    importInput = useRef<HTMLInputElement>(null),
    worker = useRef<Worker | null>(null),
    generation = useRef(0);
  const refresh = async () => {
    try {
      setHistory(await db.results.orderBy("analyzedAt").reverse().toArray());
    } catch {
      setError(
        "履歴を保存できないブラウザ設定です。結果は .flfave で書き出してください。",
      );
    }
  };
  useEffect(() => {
    try {
      const value = JSON.parse(
        localStorage.getItem("fl-fave-target") ?? "null",
      );
      if (value && validTarget(value)) setTarget(value);
    } catch {}
    void refresh();
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker
        .register("/sw.js", { updateViaCache: "none" })
        .then((reg) => {
          if (reg.active) setOfflineReady(true);
          const installed = () => {
            if (reg.installing)
              reg.installing.addEventListener("statechange", () => {
                if (reg.active || reg.waiting) setOfflineReady(true);
              });
          };
          installed();
          reg.addEventListener("updatefound", installed);
          navigator.serviceWorker.ready.then(() => setOfflineReady(true));
        })
        .catch(() =>
          setMessage(
            "オフライン保存ができませんでした。オンラインで再度開いてください。",
          ),
        );
    }
    return () => {
      worker.current?.terminate();
    };
  }, []);
  useEffect(() => {
    if (!progress) return;
    const on = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", on);
    return () => window.removeEventListener("beforeunload", on);
  }, [progress]);
  const save = async (r: Result) => {
    try {
      await db.results.put(r);
      await refresh();
    } catch {
      setError(
        "端末に保存できませんでした。結果を .flfave で書き出してください。",
      );
    }
  };
  const updateTarget = (t: Target) => {
    setTarget(t);
    if (validTarget(t))
      try {
        localStorage.setItem("fl-fave-target", JSON.stringify(t));
      } catch {}
  };
  const start = (files: File[]) => {
    if (!validTarget(target)) {
      setError("メーカー・センサーサイズ・マウントを選択してください。");
      return;
    }
    if (!files.length) return;
    worker.current?.terminate();
    const run = ++generation.current;
    setError("");
    setMessage("");
    setDiagnostics(null);
    setResult(null);
    setView("start");
    setProgress({
      phase: "discovering",
      processed: 0,
      total: 0,
      success: 0,
      missing: 0,
      errors: 0,
    });
    try {
      const w = new Worker(
        new URL("../workers/analyze.worker.ts", import.meta.url),
      );
      worker.current = w;
      w.onmessage = (event) => {
        if (run !== generation.current) return;
        const m = event.data;
        if (m.type === "progress") setProgress(m.progress);
        else if (m.type === "complete") {
          w.terminate();
          worker.current = null;
          setProgress(null);
          if (!m.analysis.stats.detected) {
            setMessage(
              "対応する画像が見つかりませんでした。通常のフォルダ内の画像を選択してください。",
            );
            return;
          }
          if (!m.analysis.stats.success) {
            setDiagnostics(m.analysis.stats);
            setMessage(
              "焦点距離を取得できませんでした。解析の内訳をご確認ください。",
            );
            return;
          }
          const active = combine(
            m.analysis.cameraAggregates,
            m.analysis.selectedCameraKeys,
          );
          const values = modes(active.equivalent);
          const r: Result = {
            id: crypto.randomUUID(),
            analyzedAt: new Date().toISOString(),
            appVersion: APP_VERSION,
            cameraDb: DB_INFO,
            lensDb: DB_INFO,
            targetCamera: { ...target },
            analysis: m.analysis,
            modalValues: values,
            recommendationsSnapshot: recommend(values, target),
          };
          setResult(r);
          setMode("equivalent");
          setView("result");
          void save(r);
        } else if (m.type === "error") {
          w.terminate();
          worker.current = null;
          setProgress(null);
          setError(m.message);
        }
      };
      w.onerror = () => {
        w.terminate();
        worker.current = null;
        setProgress(null);
        setError(
          "解析用Workerを起動できませんでした。再読み込みしてお試しください。",
        );
      };
      w.postMessage({ files, target });
    } catch {
      setProgress(null);
      setError("このブラウザでは解析を開始できませんでした。");
    }
  };
  const cancel = () => {
    generation.current++;
    worker.current?.terminate();
    worker.current = null;
    setProgress(null);
    setMessage("解析をキャンセルしました。途中の結果は保存していません。");
  };
  const open = (r: Result) => {
    setResult(r);
    setMode("equivalent");
    setView("result");
    setError("");
    setMessage("");
    setDiagnostics(null);
    window.scrollTo({ top: 0 });
  };
  const importFile = async (file?: File) => {
    if (!file) return;
    try {
      if (file.size > 50 * 1024 * 1024)
        throw new Error("ファイルが大きすぎます（上限50 MB）。");
      const r = importResult(await file.text());
      open(r);
      await save(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : "読み込めませんでした。");
    }
  };
  const active = useMemo(
    () =>
      result
        ? combine(
            result.analysis.cameraAggregates,
            result.analysis.selectedCameraKeys,
          )
        : null,
    [result],
  );
  const rows = useMemo(
    () => (active ? bins(active[mode], active.stats.success) : []),
    [active, mode],
  );
  const displayModes = useMemo(
    () => (active ? modes(active[mode]) : []),
    [active, mode],
  );
  const toggleCamera = (key: string) => {
    if (!result) return;
    const keys = result.analysis.selectedCameraKeys.includes(key)
      ? result.analysis.selectedCameraKeys.filter((k) => k !== key)
      : [...result.analysis.selectedCameraKeys, key];
    const values = modes(
      combine(result.analysis.cameraAggregates, keys).equivalent,
    );
    const updated = {
      ...result,
      analysis: { ...result.analysis, selectedCameraKeys: keys },
      modalValues: values,
      recommendationsSnapshot: recommend(values, result.targetCamera),
    };
    setResult(updated);
    void save(updated);
  };
  const maker = manufacturers.find((m) => m.id === target.manufacturerId),
    sensorOptions = maker?.systems ?? [],
    mountOptions =
      sensorOptions.find((s) => s.sensor === target.sensorProfileId)?.mounts ??
      [];
  const historyList = (
    <>
      <div className="section-heading">
        <h2>解析履歴</h2>
      </div>
      {history.length === 0 ? (
        <p className="empty-history">
          解析が完了すると、ここに履歴が残ります。
        </p>
      ) : (
        <div className="history-list">
          {history.map((r) => (
            <div className="history-row" key={r.id}>
              <button
                className="history-open"
                onClick={() => open(r)}
                disabled={!!progress}
              >
                <span>{date(r.analyzedAt)}</span>
                <strong>
                  {r.modalValues.map((n) => `${n} mm`).join(" / ") ||
                    "カメラ未選択"}
                </strong>
                <span>{system(r.targetCamera)}</span>
                <span>{number(r.analysis.stats.success)} 枚</span>
              </button>
              <button
                className="text-button danger"
                disabled={!!progress}
                onClick={async () => {
                  try {
                    await db.results.delete(r.id);
                    await refresh();
                    if (result?.id === r.id) {
                      setResult(null);
                      setView("history");
                    }
                  } catch {
                    setError("履歴を削除できませんでした。");
                  }
                }}
                aria-label={`${date(r.analyzedAt)}の履歴を削除`}
              >
                削除
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
  return (
    <>
      <header>
        <a
          className="brand"
          href="/"
          onClick={(e) => {
            e.preventDefault();
            if (!progress) setView("start");
          }}
        >
          FL-Fave<span className="brand-dot">.</span>
        </a>
        <nav aria-label="メインナビゲーション">
          {(
            [
              ["start", "新規解析"],
              ["history", "履歴"],
              ["about", "About"],
            ] as const
          ).map(([id, label]) => (
            <button
              className={view === id ? "nav-active" : ""}
              key={id}
              onClick={() => setView(id)}
              disabled={!!progress}
            >
              {label}
            </button>
          ))}
        </nav>
      </header>
      <main>
        {error && (
          <div role="alert" className="notice error">
            {error}
            <button onClick={() => setError("")} aria-label="エラーを閉じる">
              閉じる
            </button>
          </div>
        )}
        {message && (
          <p role="status" className="notice">
            {message}
          </p>
        )}
        {view === "start" && (
          <>
            <section aria-label="カメラの設定" className="setup">
              <p className="setup-title">
                撮影に使用したカメラを選択してください
              </p>
              <div className="select-grid">
                <label>
                  メーカー
                  <select
                    aria-label="メーカー"
                    value={target.manufacturerId}
                    disabled={!!progress}
                    onChange={(e) =>
                      updateTarget({
                        manufacturerId: e.target.value,
                        sensorProfileId: "",
                        mountId: "",
                      })
                    }
                  >
                    <option value="">選択してください</option>
                    {manufacturers.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  センサーサイズ
                  <select
                    aria-label="センサーサイズ"
                    value={target.sensorProfileId}
                    disabled={!maker || !!progress}
                    onChange={(e) =>
                      updateTarget({
                        ...target,
                        sensorProfileId: e.target.value,
                        mountId: "",
                      })
                    }
                  >
                    <option value="">選択してください</option>
                    {sensorOptions.map((s) => (
                      <option key={s.sensor} value={s.sensor}>
                        {sensors.find((v) => v.id === s.sensor)?.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  マウント
                  <select
                    aria-label="マウント"
                    value={target.mountId}
                    disabled={!target.sensorProfileId || !!progress}
                    onChange={(e) =>
                      updateTarget({ ...target, mountId: e.target.value })
                    }
                  >
                    <option value="">選択してください</option>
                    {mountOptions.map((m) => (
                      <option value={m} key={m}>
                        {mounts[m]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </section>
            {progress ? (
              <section className="source-panel" aria-label="解析進捗">
                <div className="progress-title">
                  <h2>
                    {progress.phase === "discovering"
                      ? "画像を探しています"
                      : "メタデータを解析しています"}
                  </h2>
                  <span className="pulse" />
                </div>
                <p aria-live="polite">
                  検出画像 {number(progress.total)} 枚 ·{" "}
                  {number(progress.processed)} / {number(progress.total)}
                </p>
                <progress
                  max={progress.total || 1}
                  value={progress.processed}
                />
                <div className="progress-stats">
                  <span>
                    取得成功 <b>{number(progress.success)}</b>
                  </span>
                  <span>
                    情報なし <b>{number(progress.missing)}</b>
                  </span>
                  <span>
                    エラー <b>{number(progress.errors)}</b>
                  </span>
                </div>
                <button className="secondary" onClick={cancel}>
                  解析をキャンセル
                </button>
                <p className="subtle">
                  完了するまで、このページを開いたままにしてください。
                </p>
              </section>
            ) : (
              <section className="source-panel">
                <h2>写真の入ったフォルダを選択してください</h2>
                <div className="source-actions">
                  <button
                    className="primary folder-button"
                    disabled={!validTarget(target)}
                    onClick={() => folderInput.current?.click()}
                  >
                    フォルダを選択
                  </button>
                  <button
                    className="secondary"
                    disabled={!validTarget(target)}
                    onClick={() => photoInput.current?.click()}
                  >
                    写真を選択
                  </button>
                </div>
                <p className="formats">JPEG / PNG / HEIC / AVIF / RAW ほか</p>
              </section>
            )}
            {diagnostics && (
              <section className="section">
                <h2>解析の内訳</h2>
                <Diagnostics stats={diagnostics} />
              </section>
            )}
            <section className="section history-section">
              {historyList}
              <button
                className="text-button import-button"
                onClick={() => importInput.current?.click()}
                disabled={!!progress}
              >
                保存した .flfave を読み込む
              </button>
            </section>
          </>
        )}
        {view === "history" && (
          <section className="page-section">
            <h1>
              写真を読み直さず、
              <br />
              もう一度。
            </h1>
            <p>集計結果だけを、このブラウザに保存しています。</p>
            <button
              className="secondary"
              onClick={() => importInput.current?.click()}
            >
              .flfave を読み込む
            </button>
            <div className="section">{historyList}</div>
          </section>
        )}
        {view === "about" && (
          <section className="page-section about">
            <h1>写真は、あなたの手元に。</h1>
            <p className="lead">
              FL-Faveは、写真の「よく使う画角」を知るためのローカル解析ツールです。
            </p>
            <h2>端末内で完結する解析</h2>
            <p>
              画像・EXIF・カメラ情報・集計結果は外部へ送信しません。位置情報、撮影者名、シリアル番号は抽出対象に含めません。履歴と書き出しファイルには、個々の画像やファイル名を保存しません。
            </p>
            <h2>オフラインでも使えます</h2>
            <p>
              {offlineReady
                ? "オフライン利用の準備ができています。"
                : "アプリ全体をキャッシュすると、オフラインで利用できます。"}{" "}
              ブラウザのアプリ追加機能からインストールできます。更新はバックグラウンドで取得し、開いている解析を中断しません。
            </p>
            <h2>カメラとレンズのデータ</h2>
            <dl>
              <dt>Camera DB</dt>
              <dd>
                {DB_INFO.version} · 更新 {DB_INFO.updatedAt} · {cameras.length}
                機種
              </dd>
              <dt>Lens DB</dt>
              <dd>
                {DB_INFO.version} · 更新 {DB_INFO.updatedAt} · {lenses.length}
                製品
              </dd>
              <dt>対応形式</dt>
              <dd>
                {formatManifest.version} · {[...extensions].join(", ")}
              </dd>
              <dt>アプリ</dt>
              <dd>{APP_VERSION}</dd>
            </dl>
            <p>
              内蔵カタログに収録された純正レンズから推薦します。価格未登録の製品は価格比較の後順位になります。価格は確認日時点の税込情報で、現在の販売価格は公式サイトをご確認ください。
            </p>
            <p>
              データ未登録のカメラはEXIFの35mm判換算値、または最初に選択したセンサーサイズで換算します。RAW形式や書き出し方法によって、焦点距離情報を読み取れない場合があります。
            </p>
            <h2>保存について</h2>
            <p>
              履歴はブラウザのデータ削除や保存領域の整理によって消える場合があります。残したい結果は
              .flfave で書き出してください。
            </p>
            <p>
              <a
                href="/third-party-notices.txt"
                target="_blank"
                rel="noopener noreferrer"
              >
                使用ソフトウェアとライセンス
              </a>
            </p>
          </section>
        )}
        {view === "result" && result && active && (
          <>
            <div className="result-heading">
              <div>
                <span className="subtle">{date(result.analyzedAt)}</span>
                <h1>あなたが選んだ画角。</h1>
              </div>
              <div className="shot-total">
                <strong>{number(active.stats.success)}</strong>
                <span>
                  枚を分析 / 全 {number(result.analysis.stats.shots)} 枚
                </span>
              </div>
            </div>
            <section className="summary">
              <div className="favorites">
                <p className="eyeline">最もよく使った画角 · 35mm判換算</p>
                {active.stats.success ? (
                  result.recommendationsSnapshot.map((group) => (
                    <div className="favorite" key={group.equivalent}>
                      <strong>
                        {group.equivalent}
                        <small> mm</small>
                      </strong>
                      <p>
                        {group.choices[0]?.lens.name ??
                          "対応する現行純正単焦点レンズはありません"}
                      </p>
                    </div>
                  ))
                ) : (
                  <p>選択中のカメラに、分析できる写真がありません。</p>
                )}
              </div>
              <div className="summary-controls">
                <p className="eyeline">表示する焦点距離</p>
                <div className="segmented">
                  {(["equivalent", "actual"] as const).map((m) => (
                    <button
                      key={m}
                      aria-pressed={mode === m}
                      className={mode === m ? "selected" : ""}
                      onClick={() => setMode(m)}
                    >
                      {m === "equivalent" ? "35mm判換算" : "実焦点距離"}
                    </button>
                  ))}
                </div>
                <p className="subtle">
                  切り替えても、おすすめの画角は変わりません。
                </p>
              </div>
            </section>
            <section className="camera-filters">
              <h2>分析対象のカメラ</h2>
              <div>
                {result.analysis.cameraAggregates.map((g) => (
                  <label className="camera-choice" key={g.key}>
                    <input
                      type="checkbox"
                      checked={result.analysis.selectedCameraKeys.includes(
                        g.key,
                      )}
                      onChange={() => toggleCamera(g.key)}
                    />
                    <span>
                      <b>{g.model}</b>
                      <small>
                        {g.manufacturer} · {number(g.stats.success)} 枚
                        {g.match !== "matched"
                          ? ` · ${g.match === "unknown" ? "機種不明" : "DB未登録"}`
                          : ""}
                      </small>
                      {g.sources.fallback > 0 && (
                        <small>
                          選択センサー（{g.cropFactor}×）で換算：
                          {g.sources.fallback}枚
                        </small>
                      )}
                    </span>
                  </label>
                ))}
              </div>
            </section>
            {mode === "actual" &&
              new Set(
                active.active
                  .filter((g) => g.stats.success > 0)
                  .map((g) => g.sensorProfileId),
              ).size > 1 && (
                <p className="notice">
                  複数のセンサーサイズを含むため、実焦点距離では画角を直接比較できません。
                </p>
              )}
            {rows.length ? (
              <>
                <Distribution rows={rows} modal={displayModes} />
                <section className="section">
                  <div className="section-heading">
                    <h2>この画角を、次の一本に。</h2>
                  </div>
                  <p className="subtle">
                    {system(result.targetCamera)} 向け · 純正 / アダプター不要
                  </p>
                  {result.recommendationsSnapshot.map((g) => (
                    <div className="recommendation-group" key={g.equivalent}>
                      <h3>
                        {g.equivalent} mm相当のおすすめ
                        <span>
                          目標の実焦点距離 {Number(g.targetActual.toFixed(2))}{" "}
                          mm
                        </span>
                      </h3>
                      {!g.choices.length ? (
                        <p className="notice">
                          条件に一致する現行純正単焦点レンズはありません。
                        </p>
                      ) : (
                        <div className="lens-grid">
                          {g.choices.map((c, i) => (
                            <article className="lens" key={c.lens.id}>
                              <span className="lens-rank">
                                {String(i + 1).padStart(2, "0")}
                              </span>
                              <div className="lens-focal">
                                {c.lens.focal}
                                <small> mm</small>
                              </div>
                              <h4>{c.lens.name}</h4>
                              <p>
                                F{c.lens.aperture} ·{" "}
                                {mounts[c.lens.mountId] ?? c.lens.mountId}
                              </p>
                              <Price lens={c.lens} />
                              <a
                                href={c.lens.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                referrerPolicy="no-referrer"
                              >
                                メーカー公式サイト
                              </a>
                              {c.alternatives.length > 0 && (
                                <details>
                                  <summary>
                                    ほかの候補（{c.alternatives.length}）
                                  </summary>
                                  {c.alternatives.map((l) => (
                                    <div className="alternative" key={l.id}>
                                      <a
                                        href={l.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        referrerPolicy="no-referrer"
                                      >
                                        {l.name}
                                      </a>
                                      <Price lens={l} />
                                    </div>
                                  ))}
                                </details>
                              )}
                            </article>
                          ))}
                        </div>
                      )}
                      {g.discontinued.length > 0 && (
                        <details className="discontinued">
                          <summary>生産終了モデル</summary>
                          {g.discontinued.map((l) => (
                            <p key={l.id}>
                              <a
                                href={l.url}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                {l.name}
                              </a>{" "}
                              · 生産終了
                            </p>
                          ))}
                        </details>
                      )}
                    </div>
                  ))}
                </section>
              </>
            ) : (
              <p role="status" className="empty-result">
                分析対象のカメラを選ぶと、分布とおすすめが表示されます。
              </p>
            )}
            <section className="section">
              <div className="section-heading">
                <h2>解析の内訳</h2>
                <span>フォルダ・選択写真全体</span>
              </div>
              <Diagnostics stats={result.analysis.stats} />
              <p className="subtle">
                RAW＋JPEGの同時記録ペアは1枚。通常のコピーや書き出し画像は、それぞれ1枚として数えます。
              </p>
            </section>
            <section className="export-section">
              <div>
                <h2>この結果を手元に。</h2>
                <p>写真やファイル名を含まず、集計データだけを書き出します。</p>
              </div>
              <div className="export-actions">
                <button
                  className="primary"
                  onClick={() =>
                    download(
                      exportResult(result),
                      "FL-Fave.flfave",
                      "application/json",
                    )
                  }
                >
                  .flfave を書き出す
                </button>
                <button
                  className="secondary"
                  onClick={() =>
                    download(
                      csv(result),
                      "FL-Fave.csv",
                      "text/csv;charset=utf-8",
                    )
                  }
                >
                  CSVを書き出す
                </button>
              </div>
            </section>
          </>
        )}
        <input
          ref={folderInput}
          type="file"
          hidden
          multiple
          {...{ webkitdirectory: "", directory: "" }}
          data-testid="folder-input"
          onChange={(e) => {
            start(Array.from(e.target.files ?? []));
            e.target.value = "";
          }}
        />
        <input
          ref={photoInput}
          type="file"
          hidden
          multiple
          accept={"image/*," + [...extensions].map((e) => "." + e).join(",")}
          data-testid="photo-input"
          onChange={(e) => {
            start(Array.from(e.target.files ?? []));
            e.target.value = "";
          }}
        />
        <input
          ref={importInput}
          type="file"
          hidden
          accept=".flfave,application/json"
          data-testid="import-input"
          onChange={(e) => {
            void importFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </main>
      <footer>
        <span>FL-Fave</span>
      </footer>
    </>
  );
}
