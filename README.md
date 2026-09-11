# FL-Fave

写真の「好きな画角」を見つける、完全ローカル処理のWebアプリ。画像をアップロードせず、サブフォルダまで解析し、実焦点距離・35mm判換算の1mm刻みの分布と、選択したカメラに合う純正単焦点レンズを表示します。

## 起動

Node.js 22以上（検証環境: Node.js 24）、npmを使用します。アカウント・環境変数・APIキーは不要です。

```sh
npm ci
npm run dev
```

開発画面は `http://localhost:3000`。PWA・オフライン動作を使う場合は静的ビルドを起動します。

```sh
npm run build
npm start
```

`http://127.0.0.1:3000` を開き、Aboutで「オフライン利用の準備ができています」と表示されるまで待つと、ネット接続なしで起動・解析できます。初回はWASMを含む約30MBのアプリ資材を取得します。履歴はオリジンごとのため、localhostと127.0.0.1、ポートの異なるURLでは共有されません。

配布物は `out/`。HTTPSの静的ホスティングのドメイン直下に配置できます。`sw.js` の長期キャッシュを避け、WASMを `application/wasm` で配信してください。`scripts/serve.mjs` に配信ヘッダーの例があります。バックエンド・画像アップロード先・外部APIはありません。

## 機能

- 9メーカーグループ、センサーサイズ、マウントを順に選択。前回の設定を復元。
- フォルダの再帰入力と写真複数選択。隠しファイル・隠しフォルダ・動画を除外。
- JPEG、PNG、AVIF、HEIC/HEIF/HIF、TIFF、JXL、PSD/PSB、WebP、DNGとRAWを解析。進捗・キャンセル対応。
- 厳密なRAW＋JPEG同時記録ペアのみ1撮影に集約。コピー・編集派生は別々に集計。
- EXIF換算値 → 機種DBの倍率 → 選択センサーの倍率で35mm判換算。情報不足と読み取りエラーを区別。
- 実焦点距離と換算値の切り替え、カメラごとの絞り込み、0件を含む度数分布表。再解析は不要。
- 同率の最頻画角をすべて表示し、それぞれ最大3種類の焦点距離を推薦。メーカー・マウント・イメージサークル・現行品の条件を厳守。同焦点距離の別製品は「ほかの候補」に表示。
- Dexie/IndexedDBの履歴、削除、`.flfave` 書き出し・取り込み、両モードのCSV。キャンセル・成功0件は保存しません。
- 全資材のオフラインキャッシュ。更新時に実行中の解析を中断しません。

## プライバシー

Web Worker内で必要なメタデータを抽出します。GPS・撮影者名・シリアル番号などは抽出対象に含めません。RAW＋JPEG照合用の名前・相対パス・撮影時刻は一時的に利用し、解析後に破棄します。履歴と書き出しにはカメラ別集計、推薦先の設定、解析件数、DBバージョン、推薦スナップショットだけを保存します。

解析中の通信は同一オリジンのアプリ資材取得のみです。解析データのPOST、外部解析API、CDN、外部フォント、アクセス解析はありません。レンズの公式リンクはユーザーが押したときだけ別タブで開きます。

## テスト（ローカル専用）

テスト本体・設定・素材取得スクリプトはGit管理外です。以下はテスト一式を保持しているローカル環境でのみ実行できます。新規クローンでは `npm run typecheck` と `npm run build` で確認できます。

```sh
npm run typecheck
npm test
npm run build
npm run test:e2e
```

E2Eはインストール済みのGoogle Chromeを使用し、ポート3000の静的サーバーを自動起動します。`playwright.config.ts` の `channel` で別のChromium環境も指定できます。

E2Eの前処理は、ExifTool公式リポジトリの固定コミットから公開素材20点を一時ディレクトリに取得し、`tests/reference/manifest.json` のSHA-256で検証します。2回目以降はキャッシュを利用します。素材取得だけはネット接続が必要です。個人の写真は使用しません。

- コア: 四捨五入、換算優先順位、ペア条件、同率最頻値、適合性・価格による順位、JSON/CSVの整合性。
- ブラウザ: 入れ子・隠しファイル、破損・欠損、キャンセル、絞り込み、履歴、CSV/JSON、将来バージョン拒否、モバイル幅。
- 形式: CR2/CR3/CRW/RAF/NEF/DNG/RW2/IIQ/MRW/X3F/HEIF/JXLなどの公開素材、EXIF付きAVIF/PNG/WebP/PSBの生成素材。
- オフライン: キャッシュ後にブラウザをオフラインにして再起動し、WASMでRAWを再解析。リクエストとIndexedDB/エクスポートも検査。

## データと対応範囲

カメラ・レンズ・形式マニフェストは `src/data/` に同梱。Aboutにバージョン・更新日を表示します。製品URLはレンズレコードに保持し、価格は確認できた日本国内の税込公式価格だけを登録しています。不明な価格は推定せず `null` とし、価格比較では既知価格の後に並べます。

レンズカタログは2026年9月11日時点で、9メーカーの公式オンラインストアが販売している純正単焦点レンズを収録しています。カメラは主要機種を収録し、全製品を網羅するものではありません。推薦は収録範囲内で行います。未登録カメラは画面に明示して換算倍率をフォールバックします。旧マウントなど候補のない条件では、3本を無理に埋めません。

価格とラインアップの照合元は各メーカーの公式オンラインストアです。[ソニーストア](https://www.sony.jp/ichigan/lineup/e-lens.html)、[キヤノンオンラインショップ](https://store.canon.jp/online/secure/rf_lens.aspx)、[ニコンダイレクト](https://nij.nikon.com/shop/r/r2060/)、[フジフイルムモール](https://mall-jp.fujifilm.com/shop/c/cx-slens/)、[OM SYSTEM STORE](https://jp.omsystem.com/product/lens/single/index.html)、[パナソニック公式](https://panasonic.jp/dc/products/s_series_lens.html)、[リコーイメージングストア](https://ricohimagingstore.com/Form/Product/ProductList.aspx?shop=0&cat=004001)、[ライカオンラインストア](https://store.leica-camera.jp/category/lens_sl-system)、[SIGMAオンラインショップ](https://www.sigma-onlineshop.jp/shop/c/c201020/)。期間限定セール価格ではなく通常価格を採用し、価格を公開していない製品は推定せず `null` にしています。光学系が同じ色違い・記念モデルは代表1本に集約し、立体VR用の二眼レンズは収録しません。製品・価格を更新するときは `DB_INFO` のバージョン・日付も更新してください。

Chromeデスクトップと390pxのモバイル表示で検証しています。iPhone/Androidの実機写真ライブラリや、すべての機種のRAWは未検証です。OSの写真共有処理でEXIFが削除された画像からは焦点距離を復元できません。ブラウザのデータ削除で履歴・オフライン資材も失われるため、残したい結果は `.flfave` で書き出してください。

## 構成

- `src/app/`: React UI、レスポンシブスタイル
- `src/workers/`: 解析ワーカー
- `src/lib/`: 抽出・集計・推薦・ローカル保存・入出力
- `src/data/`: 静的カタログと形式マニフェスト
- `scripts/prepare-assets.mjs`: WASM同梱とWorker環境判定の補正
- `scripts/build-sw.mjs`: 全ビルド資材をハッシュ化したService Worker生成
- `tests/`: コアと実ブラウザの回帰テスト（ローカル専用・Git管理外）

Next.js静的出力、TypeScript、React、Tailwind CSS、Recharts、Dexie、exifr、ExifTool WASMを使用。`zeroperl-ts` のブラウザ判定がWorkerを認識しないため、ビルド時にその判定だけを補正しています。補正前の文字列を検査し、依存更新時に黙って壊れないようにしています。生成ファイルはGit管理外です。

第三者ソフトウェアの出典とライセンスは `public/third-party-notices.txt` に記載しています。
