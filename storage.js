// storage.js

const yenFormatter = new Intl.NumberFormat("ja-JP", {
  maximumFractionDigits: 0,
});

const STORAGE_KEY = "household-maintenance-master-v3";
const OPTION_STORAGE_KEY = "household-maintenance-options-v2";
const CANDIDATE_STATUS_KEY = "household-maintenance-candidate-status-v2";
const IMPORT_STORAGE_KEY = "household-maintenance-imported-rows-v1";
const MASTER_UPDATED_KEY = "household-maintenance-master-updated-at-v1";
const HOUSEHOLD_SNAPSHOT_KEY = "household-maintenance-snapshots-v1";
const LINK_GROUPS_KEY = "household-maintenance-link-groups-v1";
const FULL_BACKUP_SCHEMA_VERSION = 1;
const FULL_BACKUP_AUTO_RESTORE_KEY = "household-maintenance-full-backup-before-restore-v1";
const STORAGE_DIAGNOSTIC_KEYS = [
  STORAGE_KEY,
  OPTION_STORAGE_KEY,
  CANDIDATE_STATUS_KEY,
  IMPORT_STORAGE_KEY,
  MASTER_UPDATED_KEY,
  HOUSEHOLD_SNAPSHOT_KEY,
  LINK_GROUPS_KEY,
  FULL_BACKUP_AUTO_RESTORE_KEY,
  "positivePayrollActiveProfile",
  "positivePayrollProfileName_primary",
  "positivePayrollProfileName_secondary",
  "positivePayrollLastSaved_primary",
  "positivePayrollLastSaved_secondary",
  "payrollUserRecords",
  "payrollUserRecords_secondary",
  "payrollDeletedMonths",
  "payrollDeletedMonths_secondary",
  "positivePayrollSnapshots_primary",
  "positivePayrollSnapshots_secondary",
  "positivePayrollAutoBackup_primary",
  "positivePayrollAutoBackup_secondary",
];
const LEGACY_STORAGE_KEYS = {
  [STORAGE_KEY]: ["household-maintenance-master-v2", "household-maintenance-master-v1", "householdMaster", "expenseMaster"],
  [OPTION_STORAGE_KEY]: ["household-maintenance-options-v1", "householdOptions"],
  [CANDIDATE_STATUS_KEY]: ["household-maintenance-candidate-status-v1", "candidateStatus"],
  [IMPORT_STORAGE_KEY]: ["household-maintenance-imported-rows", "importedRows", "externalImportedRows", "moneyForwardImportedRows", "rakutenImportedRows"],
  [LINK_GROUPS_KEY]: ["household-link-groups", "linkGroups"],
  payrollUserRecords: ["positivePayrollUserRecords", "payrollRecords", "payrollRecords_primary"],
  payrollUserRecords_secondary: ["positivePayrollUserRecords_secondary", "payrollRecords_secondary"],
  payrollDeletedMonths: ["positivePayrollDeletedMonths", "deletedMonths"],
  payrollDeletedMonths_secondary: ["positivePayrollDeletedMonths_secondary", "deletedMonths_secondary"],
};

let data = null;
let master = [];
let optionLists = {};
let candidateStatus = {};
let importedRows = [];
let linkGroups = [];
let sortState = { key: "status", direction: "asc" };
let columnFilters = {};
let selectedId = null;
let editingId = null;
let editDraft = null;
let pendingCandidate = null;
let pendingUpdateCandidate = null;
let pendingUpdateAction = "amount";
let masterViewMode = "cards";
let selectedExpensePerson = "";
let candidateFilters = {
  source: "all",
  confidence: "all",
  status: "all",
  changedOnly: false,
};
let highlightedExternalKey = null;
let returnExternalKey = null;
let returnExternalMonth = null;
let returnExternalTab = null;
let importEditMode = false;
let appMode = "summary";

function storageHasUsableValue(key) {
  const raw = localStorage.getItem(key);
  if (raw === null || raw === undefined || raw === "") return false;
  try {
    const value = JSON.parse(raw);
    if (Array.isArray(value)) return value.length > 0;
    if (value && typeof value === "object") return Object.keys(value).length > 0;
    return value !== null && value !== "";
  } catch {
    return true;
  }
}

function copyLegacyStorageValue(targetKey, legacyKeys = []) {
  if (storageHasUsableValue(targetKey)) return false;
  const legacyKey = legacyKeys.find((key) => storageHasUsableValue(key));
  if (!legacyKey) return false;
  localStorage.setItem(targetKey, localStorage.getItem(legacyKey));
  return true;
}

function migrateLegacyStorage() {
  Object.entries(LEGACY_STORAGE_KEYS).forEach(([targetKey, legacyKeys]) => copyLegacyStorageValue(targetKey, legacyKeys));
}

function storageCount(value) {
  if (Array.isArray(value)) return value.length;
  if (value && typeof value === "object") return Object.keys(value).length;
  return value ? 1 : 0;
}

function storageStatusSummary() {
  const imports = normalizeStoredImportedRows(readImportedRowsStorage());
  const payrollPrimary = readArrayStorage("payrollUserRecords", []);
  const payrollSecondary = readArrayStorage("payrollUserRecords_secondary", []);
  const masterObject = readObjectStorage(STORAGE_KEY, {});
  const linkRows = readArrayStorage(LINK_GROUPS_KEY, []);
  const moneyForwardRows = imports.filter((row) => normalizeStoredImportSource(row) === "moneyforward");
  const rakutenRows = imports.filter((row) => normalizeStoredImportSource(row) === "rakuten");
  return {
    keys: [...STORAGE_DIAGNOSTIC_KEYS],
    incomeRecords: payrollPrimary.length + payrollSecondary.length,
    incomePrimary: payrollPrimary.length,
    incomeSecondary: payrollSecondary.length,
    expenseItems: storageCount(masterObject),
    importedRows: imports.length,
    moneyForwardRows: moneyForwardRows.length,
    rakutenRows: rakutenRows.length,
    linkGroups: linkRows.length,
    candidateStatus: storageCount(readObjectStorage(CANDIDATE_STATUS_KEY, {})),
    householdSnapshots: readArrayStorage(HOUSEHOLD_SNAPSHOT_KEY, []).length,
    payrollSnapshots: readArrayStorage("positivePayrollSnapshots_primary", []).length + readArrayStorage("positivePayrollSnapshots_secondary", []).length,
  };
}

function storageStatusHtml() {
  const summary = storageStatusSummary();
  const rows = [
    ["収入データ", summary.incomeRecords + "件（ユーザー1: " + summary.incomePrimary + " / ユーザー2: " + summary.incomeSecondary + "）"],
    ["支出データ", summary.expenseItems + "件"],
    ["MoneyForward", summary.moneyForwardRows + "件"],
    ["楽天カード", summary.rakutenRows + "件"],
    ["外部データ合計", summary.importedRows + "件"],
    ["紐づけ管理", summary.linkGroups + "件"],
    ["候補状態", summary.candidateStatus + "件"],
    ["スナップショット", (summary.householdSnapshots + summary.payrollSnapshots) + "件"],
  ];
  return '<div class="storage-status-grid">' + rows.map(([label, value]) => '<div><span>' + esc(label) + '</span><strong>' + esc(value) + '</strong></div>').join('') + '</div>' +
    '<details class="storage-key-details"><summary>保存キー名を表示</summary><ul>' + summary.keys.map((key) => '<li><code>' + esc(key) + '</code></li>').join('') + '</ul></details>';
}
function readObjectStorage(key, fallback = {}) {
  const value = readJsonStorage(key, fallback);
  return value && typeof value === "object" && !Array.isArray(value) ? value : fallback;
}

function readArrayStorage(key, fallback = []) {
  const value = readJsonStorage(key, fallback);
  return Array.isArray(value) ? value : fallback;
}

function loadMaster() {
  const defaults = buildDefaultMaster();
  const saved = readObjectStorage(STORAGE_KEY, {});
  master = defaults.map((item) => {
    const merged = normalizeJudgmentFlags({ ...item, ...(saved[item.id] || {}) });
    merged.alignmentId = alignmentId(merged);
    merged.amountHistory ||= [];
    merged.externalAliases = externalAliases(merged);
    merged.incomeLinks ||= [];
    merged.paymentMonths ||= [];
    merged.bimonthlyPattern ||= "even";
    return merged;
  });
  for (const item of Object.values(saved)) {
    if (item?.id && !master.some((entry) => entry.id === item.id)) {
      const normalized = normalizeJudgmentFlags(item);
      master.unshift({ ...normalized, alignmentId: normalized.alignmentId || alignmentId(normalized), amountHistory: normalized.amountHistory || [], externalAliases: externalAliases(normalized), incomeLinks: normalized.incomeLinks || [], paymentMonths: normalized.paymentMonths || [], bimonthlyPattern: normalized.bimonthlyPattern || "even" });
    }
  }
  selectedId ||= master[0]?.id || null;
}

function saveMaster() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(master.map((item) => [item.id, item]))));
  localStorage.setItem(MASTER_UPDATED_KEY, new Date().toISOString());
}


function loadOptions() {
  const saved = readObjectStorage(OPTION_STORAGE_KEY, {});
  const merge = (field) => [...new Set([...(saved[field] || []), ...uniqueValues(field)])].filter(Boolean);
  const savedCodes = (field) => (saved[field] || []).map((value) => optionValue(field, value));
  optionLists = {
    person: merge("person"),
    category: merge("category"),
    payment: merge("payment"),
    updateMonth: merge("updateMonth"),
    status: ["normal", "editing"],
    nature: ["fixed", "variable"],
    flow: [...new Set([...savedCodes("flow"), "expense", "saving"])],
    frequency: ["monthly", "yearly", "bimonthly", "semiannual"],
  };
}

function saveOptions() {
  localStorage.setItem(
    OPTION_STORAGE_KEY,
    JSON.stringify({
      person: optionLists.person,
      category: optionLists.category,
      payment: optionLists.payment,
      status: optionLists.status,
      nature: optionLists.nature,
      flow: optionLists.flow,
      frequency: optionLists.frequency,
      updateMonth: optionLists.updateMonth,
    }),
  );
}

function loadCandidateStatus() {
  candidateStatus = readObjectStorage(CANDIDATE_STATUS_KEY, {});
}

function saveCandidateStatus() {
  localStorage.setItem(CANDIDATE_STATUS_KEY, JSON.stringify(candidateStatus));
}

function normalizeStoredImportMonth(value) {
  const raw = String(value || "").trim().normalize("NFKC");
  const match = raw.match(/(20\d{2})\D?(0?[1-9]|1[0-2])/);
  if (!match) return raw.replaceAll("/", "-").slice(0, 7);
  return `${match[1]}-${match[2].padStart(2, "0")}`;
}

function normalizeStoredImportSource(row = {}) {
  const value = String(row.sourceType || row.source || row.provider || row.importType || row.sourceFile || "").normalize("NFKC").toLowerCase();
  if (/rakuten|楽天|enavi/.test(value)) return "rakuten";
  if (row.paymentMethod || row.paymentAmount || row.user || row.useMonth || row.carryover || row["利用日"] || row["利用店名・商品名"] || row["支払方法"] || row["利用者"]) return "rakuten";
  return "moneyforward";
}

function normalizeStoredRakutenContent(row = {}) {
  return row.content || row.shopName || row.merchantName || row["利用店名・商品名"] || row["利用店名"] || row["商品名"] || "";
}

function seededImportedRows() {
  const normalizeMonth = normalizeStoredImportMonth;
  const moneyForwardRows = (data.moneyForward?.transactions || data.moneyForward?.rows || []).map((row) => ({
    ...row,
    sourceType: "moneyforward",
    month: normalizeMonth(row.month || row.date),
    absAmount: row.absAmount ?? Math.abs(Number(row.amount || 0)),
  }));
  const rakutenRows = (data.rakutenCard?.rows || []).map((row) => ({
    ...row,
    sourceType: "rakuten",
    month: normalizeMonth(row.month || row.date || row.useDate),
    amount: Number(row.amount || row.useAmount || 0),
  }));
  return [...moneyForwardRows, ...rakutenRows].filter((row) => row.month && (row.content || row.date || row.amount));
}

function normalizeStoredImportedRows(rows = []) {
  return rows
    .map((row) => {
      const sourceType = normalizeStoredImportSource(row);
      const month = normalizeStoredImportMonth(row.month || row.paymentMonth || row.useMonth || row.date || row.useDate || row["利用日"]);
      const content = sourceType === "rakuten" ? normalizeStoredRakutenContent(row) : row.content;
      return {
        ...row,
        sourceType,
        month,
        date: row.date || row["利用日"] || row.useDate || "",
        content,
        user: row.user || row["利用者"] || "",
        paymentMethod: row.paymentMethod || row["支払方法"] || "",
        paymentAmount: sourceType === "rakuten" ? (row.paymentAmount || row.total || row.amount || row.useAmount || row["支払総額"] || row["利用金額"] || "") : row.paymentAmount,
        absAmount: row.absAmount ?? Math.abs(Number(row.amount || row.paymentAmount || row.useAmount || row["利用金額"] || 0)),
      };
    })
    .filter((row) => row.month && (row.content || row.date || row.amount || row.paymentAmount));
}

function importedStorageRowsFromValue(value) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") {
    if (Array.isArray(value.rows)) return value.rows;
    return Object.values(value).flatMap((entry) => Array.isArray(entry) ? entry : entry && typeof entry === "object" ? [entry] : []);
  }
  return [];
}

function readImportedRowsStorage() {
  return importedStorageRowsFromValue(readJsonStorage(IMPORT_STORAGE_KEY, []));
}
function loadImportedRows() {
  const hasSaved = localStorage.getItem(IMPORT_STORAGE_KEY) !== null;
  const saved = readImportedRowsStorage();
  importedRows = normalizeStoredImportedRows(hasSaved ? saved : seededImportedRows());
  if (hasSaved) localStorage.setItem(IMPORT_STORAGE_KEY, JSON.stringify(importedRows));
}

function saveImportedRows() {
  localStorage.setItem(IMPORT_STORAGE_KEY, JSON.stringify(importedRows));
}

function loadLinkGroups() {
  linkGroups = readArrayStorage(LINK_GROUPS_KEY, []);
}

function saveLinkGroups() {
  localStorage.setItem(LINK_GROUPS_KEY, JSON.stringify(linkGroups));
}

function createHouseholdSnapshot(reason = "before-update-candidate", meta = {}) {
  const snapshots = readJsonStorage(HOUSEHOLD_SNAPSHOT_KEY, []);
  const snapshot = {
    id: `household-snapshot-${Date.now()}`,
    reason,
    createdAt: new Date().toISOString(),
    meta,
    master: Object.fromEntries(master.map((item) => [item.id, item])),
    candidateStatus: { ...candidateStatus },
    importedRows: [...importedRows],
    masterUpdatedAt: localStorage.getItem(MASTER_UPDATED_KEY) || "",
  };
  writeJsonStorage(HOUSEHOLD_SNAPSHOT_KEY, [snapshot, ...(Array.isArray(snapshots) ? snapshots : [])].slice(0, 5));
  return snapshot.id;
}

function readJsonStorage(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "null");
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

function writeJsonStorage(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function payrollBackupProfile(profile) {
  const suffix = profile === "secondary" ? "_secondary" : "";
  const profileNameKey = profile === "secondary" ? "positivePayrollProfileName_secondary" : "positivePayrollProfileName_primary";
  const lastSavedKey = profile === "secondary" ? "positivePayrollLastSaved_secondary" : "positivePayrollLastSaved_primary";
  return {
    profileName: localStorage.getItem(profileNameKey) || "",
    lastSaved: readJsonStorage(lastSavedKey, null),
    userRecords: readJsonStorage(`payrollUserRecords${suffix}`, []),
    deletedMonths: readJsonStorage(`payrollDeletedMonths${suffix}`, []),
    snapshots: readJsonStorage(`positivePayrollSnapshots_${profile}`, []),
    autoBackup: readJsonStorage(`positivePayrollAutoBackup_${profile}`, null),
  };
}

function createFullBackupPayload() {
  return {
    schemaVersion: FULL_BACKUP_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    app: "Kakei Compass",
    household: {
      master: readJsonStorage(STORAGE_KEY, {}),
      candidateStatus: readJsonStorage(CANDIDATE_STATUS_KEY, {}),
      masterUpdatedAt: localStorage.getItem(MASTER_UPDATED_KEY) || "",
      linkGroups: readJsonStorage(LINK_GROUPS_KEY, []),
      snapshots: readJsonStorage(HOUSEHOLD_SNAPSHOT_KEY, []),
    },
    imports: {
      rows: normalizeStoredImportedRows(readImportedRowsStorage()),
    },
    payroll: {
      activeProfile: localStorage.getItem("positivePayrollActiveProfile") || "primary",
      profiles: {
        primary: payrollBackupProfile("primary"),
        secondary: payrollBackupProfile("secondary"),
      },
    },
    settings: {
      householdOptions: readJsonStorage(OPTION_STORAGE_KEY, {}),
    },
  };
}

function downloadJson(payload, fileName) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const anchor = document.createElement("a");
  anchor.href = URL.createObjectURL(blob);
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(anchor.href);
}

function exportFullBackup() {
  const payload = createFullBackupPayload();
  const date = payload.exportedAt.slice(0, 10).replaceAll("-", "");
  downloadJson(payload, `household-maintenance-full-backup-${date}.json`);
  if (typeof showToast === "function") showToast("バックアップを出力しました。", "ok");
}

function validateFullBackupPayload(payload) {
  if (!payload || typeof payload !== "object") throw new Error("バックアップファイルの形式が正しくありません。");
  if (payload.schemaVersion !== FULL_BACKUP_SCHEMA_VERSION) {
    throw new Error(`対応していないバックアップ形式です。schemaVersion: ${payload.schemaVersion ?? "不明"}`);
  }
  if (!payload.household || !payload.imports || !payload.payroll || !payload.settings) {
    throw new Error("バックアップファイルに必要なデータが不足しています。");
  }
}

function writePayrollProfileBackup(profile, profileData = {}) {
  const suffix = profile === "secondary" ? "_secondary" : "";
  const profileNameKey = profile === "secondary" ? "positivePayrollProfileName_secondary" : "positivePayrollProfileName_primary";
  const lastSavedKey = profile === "secondary" ? "positivePayrollLastSaved_secondary" : "positivePayrollLastSaved_primary";
  if (profileData.profileName) localStorage.setItem(profileNameKey, profileData.profileName);
  else localStorage.removeItem(profileNameKey);
  if (profileData.lastSaved) writeJsonStorage(lastSavedKey, profileData.lastSaved);
  else localStorage.removeItem(lastSavedKey);
  writeJsonStorage(`payrollUserRecords${suffix}`, Array.isArray(profileData.userRecords) ? profileData.userRecords : []);
  writeJsonStorage(`payrollDeletedMonths${suffix}`, Array.isArray(profileData.deletedMonths) ? profileData.deletedMonths : []);
  if (Array.isArray(profileData.snapshots)) writeJsonStorage(`positivePayrollSnapshots_${profile}`, profileData.snapshots);
  if (profileData.autoBackup) writeJsonStorage(`positivePayrollAutoBackup_${profile}`, profileData.autoBackup);
}

function refreshAfterFullRestore() {
  selectedId = null;
  editingId = null;
  editDraft = null;
  pendingCandidate = null;
  highlightedExternalKey = null;
  returnExternalKey = null;
  returnExternalMonth = null;
  returnExternalTab = null;
  importEditMode = false;
  loadMaster();
  loadOptions();
  loadCandidateStatus();
  loadImportedRows();
  loadLinkGroups();
  if (typeof payrollState !== "undefined") {
    payrollState.values = payrollBaseValues();
    payrollState.inputStarted = false;
    payrollState.reviewConfirmed = false;
    payrollState.dirty = false;
  }
  rerender();
  if (appMode === "income") mountIncomeManagement();
}

function restoreFullBackupPayload(payload) {
  validateFullBackupPayload(payload);
  localStorage.setItem(
    FULL_BACKUP_AUTO_RESTORE_KEY,
    JSON.stringify({ ...createFullBackupPayload(), backupReason: "before-full-restore", backedUpAt: new Date().toISOString() }),
  );
  writeJsonStorage(STORAGE_KEY, payload.household.master || {});
  writeJsonStorage(CANDIDATE_STATUS_KEY, payload.household.candidateStatus || {});
  writeJsonStorage(LINK_GROUPS_KEY, Array.isArray(payload.household.linkGroups) ? payload.household.linkGroups : []);
  if (Array.isArray(payload.household.snapshots)) writeJsonStorage(HOUSEHOLD_SNAPSHOT_KEY, payload.household.snapshots);
  if (payload.household.masterUpdatedAt) localStorage.setItem(MASTER_UPDATED_KEY, payload.household.masterUpdatedAt);
  else localStorage.removeItem(MASTER_UPDATED_KEY);
  writeJsonStorage(IMPORT_STORAGE_KEY, Array.isArray(payload.imports.rows) ? payload.imports.rows : []);
  writeJsonStorage(OPTION_STORAGE_KEY, payload.settings.householdOptions || {});
  localStorage.setItem("positivePayrollActiveProfile", payload.payroll.activeProfile === "secondary" ? "secondary" : "primary");
  writePayrollProfileBackup("primary", payload.payroll.profiles?.primary || {});
  writePayrollProfileBackup("secondary", payload.payroll.profiles?.secondary || {});
  refreshAfterFullRestore();
}

function importFullBackupFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const payload = JSON.parse(reader.result);
      validateFullBackupPayload(payload);
      const ok = window.confirm("全体バックアップを復元します。現在のデータは復元前に自動退避されます。実行してよろしいですか？");
      if (!ok) return;
      restoreFullBackupPayload(payload);
      if (typeof showToast === "function") showToast("バックアップを復元しました。", "ok");
    } catch (error) {
      if (typeof showToast === "function") showToast(error.message || "バックアップを復元できませんでした。既存データは変更していません。", "warn");
      else window.alert(error.message || "バックアップを復元できませんでした。既存データは変更していません。");
    }
  };
  reader.readAsText(file);
}






