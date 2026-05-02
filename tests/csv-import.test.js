const assert = require("node:assert/strict");
const {
  detectImportType,
  normalizeImportedRow,
  normalizeRakutenRow,
  mergeImportedRows,
} = require("../import-utils.js");

function testDetectImportType() {
  assert.equal(detectImportType(["日付", "計算対象", "保有金融機関"], "mf.csv"), "moneyforward");
  assert.equal(detectImportType(["利用日", "利用店名・商品名", "利用金額"], "enavi202604.csv"), "rakuten");
  assert.equal(detectImportType(["foo"], "enavi202604.csv"), "rakuten");
}

function testNormalizeMoneyForwardRow() {
  const row = normalizeImportedRow(
    {
      日付: "2026/02/19",
      内容: "AMAZON.CO.JP",
      "金額（円）": "-1299",
      保有金融機関: "孝の口座",
      大項目: "その他",
      中項目: "未分類",
      メモ: "memo",
      振替: "",
      ID: "mf-1",
    },
    "mf.csv",
  );
  assert.equal(row.month, "2026-02");
  assert.equal(row.content, "AMAZON.CO.JP");
  assert.equal(row.amount, "-1299");
  assert.equal(row.institution, "孝の口座");
  assert.equal(row.id, "mf-1");
}

function testNormalizeRakutenRow() {
  const headers = ["利用日", "利用店名・商品名", "利用者", "支払方法", "利用金額", "手数料/利息", "支払総額", "2026年04月支払金額"];
  const row = normalizeRakutenRow(
    {
      利用日: "2026/02/19",
      "利用店名・商品名": "AMAZON.CO.JP",
      利用者: "孝",
      支払方法: "1回払い",
      利用金額: "1299",
      "手数料/利息": "0",
      支払総額: "1299",
      "2026年04月支払金額": "1299",
    },
    "enavi202604(4227).csv",
    headers,
  );
  assert.equal(row.sourceType, "rakuten");
  assert.equal(row.month, "2026-04");
  assert.equal(row.useMonth, "2026-02");
  assert.equal(row.content, "AMAZON.CO.JP");
  assert.equal(row.paymentAmount, "1299");
}

function testRakutenBlankRowIsIgnored() {
  const row = normalizeRakutenRow({ 利用日: "", 利用金額: "0" }, "enavi202604.csv", ["利用日", "利用金額"]);
  assert.equal(row, null);
}

function testMergeImportedRowsPreventsDuplicateMonthRegistration() {
  const existing = [
    { sourceType: "moneyforward", month: "2026-02", date: "2026/02/01", content: "old", amount: "-100", sourceFile: "old.csv" },
    { sourceType: "rakuten", month: "2026-03", date: "2026/01/01", content: "kept", paymentAmount: "200", sourceFile: "r.csv" },
  ];
  const incoming = [
    { sourceType: "moneyforward", month: "2026-02", date: "2026/02/02", content: "new", amount: "-300", sourceFile: "new.csv" },
    { sourceType: "moneyforward", month: "2026-02", date: "2026/02/02", content: "new", amount: "-300", sourceFile: "new.csv" },
  ];
  const merged = mergeImportedRows(existing, incoming);
  assert.equal(merged.length, 2);
  assert.equal(merged.some((row) => row.content === "old"), false);
  assert.equal(merged.filter((row) => row.content === "new").length, 1);
  assert.equal(merged.some((row) => row.content === "kept"), true);
}

testDetectImportType();
testNormalizeMoneyForwardRow();
testNormalizeRakutenRow();
testRakutenBlankRowIsIgnored();
testMergeImportedRowsPreventsDuplicateMonthRegistration();

console.log("csv-import tests passed");
