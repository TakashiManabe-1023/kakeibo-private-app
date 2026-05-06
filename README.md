# Kakei Compass GitHub Pages公開用

Kakei Compassは、収入・支出・外部データを統合し、家計の現在地と見直し余地を確認する個人用Webアプリです。
このフォルダの中身だけをGitHub Pagesへアップロードしてください。

## アップロードするもの

- `index.html`
- `auth.js`
- `app.js`
- `ui.js`
- `storage.js`
- `household.js`
- `payroll.js`
- `import.js`
- `import-utils.js`
- `styles.css`
- `manifest.webmanifest`
- `app-icon.png`
- `app-icon-512.png`
- `app-icon-192.png`
- `app-icon-180.png`
- `README.md`
- `data/household-data.js`
- `data/payroll-data.js`

## アップロードしないもの

- `node_modules/`
- `archive/`
- `scripts/`
- `tests/`
- `.cmd` ファイル
- Pythonスクリプト
- Excelファイル
- CSV元データ
- 旧HTML、旧JS、旧給与単体アプリ

## 注意

`data` フォルダは必ずアップロードしてください。
特に以下の2ファイルがないと、アプリは初期データを読み込めません。

- `data/household-data.js`
- `data/payroll-data.js`

## 簡易ログイン

パスワードは `auth.js` の `APP_PASSWORD` で変更できます。
この認証は個人利用向けの簡易ガードです。GitHub Pages上のHTML/JavaScriptは閲覧可能なため、完全なセキュリティではありません。本格的に非公開化する場合は、サーバー側認証や認証付きホスティングを使ってください。

## iPhoneで使う場合

1. SafariでGitHub PagesのURLを開きます。
2. 共有ボタンを押します。
3. 「ホーム画面に追加」を選びます。
4. ホーム画面に追加すると、リキッドグラス風の `app-icon-180.png` と「Kakei Compass」の名称で起動できます。

## ログイン状態をリセットする方法

ログイン画面をもう一度表示したい場合は、ブラウザの開発者ツールConsoleで以下を実行してください。

```js
resetHouseholdLoginOnly()
location.reload()
```

この操作で削除されるのは認証済みフラグ `household_app_auth_passed` だけです。収入・支出・外部データなどの家計データは削除されません。

## データ保存とGitHub Pages更新時の注意

GitHub Pagesはアプリ本体を配信する場所です。月収、支出項目、MoneyForward、楽天カード、紐づけ管理などの登録データは、GitHubへ保存されるのではなく、利用している端末のブラウザ内（localStorage）に保存されます。

- GitHub Pagesを更新しても、同じURL・同じブラウザであれば保存データは同じ保存キーから読み込まれます。
- iPhoneのSafariデータ削除、プライベートブラウズ、別ブラウザ利用、URL/ドメイン変更を行うと、以前のデータが見えなくなることがあります。
- GitHub Pagesを更新する前、またはSafariのサイトデータを削除する前には、設定の「バックアップ」からJSONを保存してください。
- 改修後にデータが見えない場合は、設定の「保存状態確認」で件数を確認し、必要に応じてバックアップから復元してください。
- `data/household-data.js` と `data/payroll-data.js` は初回表示用の初期データです。既存保存データがある場合は、保存済みデータを優先します。
