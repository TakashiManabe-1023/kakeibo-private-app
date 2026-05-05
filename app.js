// app.js
// 全体の初期化と、収入管理 / 支出管理の表示切替だけを担当します。

const appScrollPositions = { income: 0, expense: 0 };

function bindMediaQueryChange(query, handler) {
  const media = window.matchMedia(query);
  if (typeof media.addEventListener === "function") media.addEventListener("change", handler);
  else if (typeof media.addListener === "function") media.addListener(handler);
}

function bindAppModeEvents() {
  document.querySelectorAll("[data-app-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      const nextMode = button.dataset.appMode;
      closeMobileNav();
      requestAnimationFrame(() => switchAppMode(nextMode));
    });
  });
  byId("mobileNavToggle")?.addEventListener("click", toggleMobileNav);
  byId("mobileNavBackdrop")?.addEventListener("click", closeMobileNav);
  bindMobileNavSwipe();
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeMobileNav();
  });
  bindMediaQueryChange("(min-width: 769px)", closeMobileNav);
  bindMediaQueryChange("(max-width: 768px)", () => {
    if (typeof appMode === "string" && appMode === "expense" && typeof renderMaster === "function") renderMaster();
  });
}

function toggleMobileNav() {
  if (document.body.classList.contains("mobile-nav-open")) closeMobileNav();
  else openMobileNav();
}

function openMobileNav() {
  document.body.classList.add("mobile-nav-open");
  byId("mobileNavToggle")?.setAttribute("aria-expanded", "true");
  byId("mobileNavToggle")?.setAttribute("aria-label", "メニューを閉じる");
  byId("mobileNavBackdrop")?.classList.remove("hidden");
}

function closeMobileNav() {
  document.body.classList.remove("mobile-nav-open");
  byId("mobileNavToggle")?.setAttribute("aria-expanded", "false");
  byId("mobileNavToggle")?.setAttribute("aria-label", "メニューを開く");
  byId("mobileNavBackdrop")?.classList.add("hidden");
}

function overallMetricsForApp() {
  if (typeof expenseSummaryMetrics === "function") return expenseSummaryMetrics();
  return { income: 0, expense: 0, saving: 0, surplus: 0, fixedRatio: 0, savingRatio: 0, health: "-", pendingCount: 0, attentionCount: 0 };
}

function appMetricCard(label, value, note = "") {
  return `<div class="summary-card"><span>${esc(label)}</span><strong>${esc(value)}</strong>${note ? `<small>${esc(note)}</small>` : ""}</div>`;
}

function renderSummaryPanel() {
  const panel = byId("panel-summary");
  if (!panel) return;
  const metrics = overallMetricsForApp();
  panel.innerHTML = `
    <article class="panel income-native unified-summary-panel">
      <div class="income-topbar"><div><h3>サマリー</h3><p>収入と支出から家計全体の現在地を確認します。</p></div></div>
      <section class="analysis-summary">
        ${appMetricCard("世帯収入", yen(metrics.income))}
        ${appMetricCard("支出合計", yen(metrics.expense))}
        ${appMetricCard("貯蓄・投資", yen(metrics.saving))}
        ${appMetricCard("月次余力", yen(metrics.surplus), metrics.health)}
        ${appMetricCard("固定費率", percent(metrics.fixedRatio))}
        ${appMetricCard("貯蓄率", percent(metrics.savingRatio))}
      </section>
      <section class="analysis-card analysis-card-wide">
        <h4>家計判定</h4>
        <p>${esc(typeof expenseHealthComment === "function" ? expenseHealthComment(metrics.health) : "収入と支出の登録状況を確認してください。")}</p>
      </section>
    </article>`;
}

function renderUnifiedAnalysis() {
  const panel = byId("panel-analysis");
  if (!panel) return;
  const metrics = overallMetricsForApp();
  const incomeChart = typeof payrollDetailedChartHtml === "function" ? payrollDetailedChartHtml() : '<div class="empty-state">収入データがありません。</div>';
  const review = typeof reviewTopItems === "function" ? reviewTopItems().slice(0, 5) : [];
  const expenseTables =
    typeof analysisTable === "function" && typeof enabledItems === "function" && typeof sumBy === "function" && typeof compactTopRows === "function"
      ? `<div class="analysis-grid expense-analysis-grid">
          ${analysisTable("カテゴリ別支出", compactTopRows(sumBy(enabledItems().filter((item) => item.flow === "expense"), (item) => item.category, (item) => item.monthlyAmount)))}
          ${analysisTable("固定/変動", compactTopRows(sumBy(enabledItems().filter((item) => item.flow === "expense"), (item) => displayValue("nature", item.nature), (item) => item.monthlyAmount)))}
        </div>`
      : "";
  panel.innerHTML = `
    <article class="panel income-native unified-analysis-panel">
      <div class="income-topbar"><div><h3>分析</h3><p>収入・支出・見直し候補を横断して確認します。</p></div></div>
      <section class="analysis-card analysis-card-wide">
        <h4>全体分析</h4>
        <div class="analysis-summary">
          ${appMetricCard("世帯収入", yen(metrics.income))}
          ${appMetricCard("支出合計", yen(metrics.expense))}
          ${appMetricCard("当月収支", yen(metrics.surplus), metrics.health)}
          ${appMetricCard("固定費率", percent(metrics.fixedRatio))}
          ${appMetricCard("貯蓄率", percent(metrics.savingRatio))}
          ${appMetricCard("更新確認", `${metrics.pendingCount || 0}件`)}
        </div>
      </section>
      <section class="analysis-card analysis-card-wide">
        <h4>収入分析</h4>
        ${incomeChart}
      </section>
      <section class="analysis-card analysis-card-wide">
        <h4>支出分析</h4>
        ${expenseTables || '<div class="empty-state">支出データがありません。</div>'}
      </section>
      <section class="analysis-card analysis-card-wide">
        <div class="analysis-card-head"><h4>見直し候補</h4><button type="button" data-unified-open-expense>支出管理で確認</button></div>
        <div class="review-top-list">
          ${review.length ? review.map((row, index) => `<div class="review-row"><strong>${index + 1}. ${esc(row.item.name || "名称未設定")}</strong><span>${yen(row.item.monthlyAmount)} / ${esc(row.reasons.join("・"))}</span></div>`).join("") : '<div class="empty-state">優先的に見直す候補はありません。</div>'}
        </div>
      </section>
    </article>`;
  if (typeof payrollBindChartEvents === "function") payrollBindChartEvents();
  panel.querySelector("[data-unified-open-expense]")?.addEventListener("click", () => switchAppMode("expense"));
}
function bindMobileNavSwipe() {
  let startX = 0;
  let startY = 0;
  let tracking = false;
  const isInteractive = (target) => Boolean(target.closest("input, textarea, select, button, a, [contenteditable='true']"));
  window.addEventListener("touchstart", (event) => {
    if (!window.matchMedia("(max-width: 768px)").matches || event.touches.length !== 1) return;
    const touch = event.touches[0];
    const navOpen = document.body.classList.contains("mobile-nav-open");
    if (!navOpen && touch.clientX > 24) return;
    if (isInteractive(event.target) && !navOpen) return;
    startX = touch.clientX;
    startY = touch.clientY;
    tracking = true;
  }, { passive: true });
  window.addEventListener("touchend", (event) => {
    if (!tracking) return;
    tracking = false;
    const touch = event.changedTouches[0];
    const dx = touch.clientX - startX;
    const dy = touch.clientY - startY;
    if (Math.abs(dy) > 50 || Math.abs(dx) < 70) return;
    if (dx > 0 && startX <= 24) openMobileNav();
    if (dx < 0 && document.body.classList.contains("mobile-nav-open")) closeMobileNav();
  }, { passive: true });
}

function switchAppMode(mode) {
  if (typeof appMode === "string") appScrollPositions[appMode] = window.scrollY || 0;
  appMode = ["summary", "income", "expense", "analysis"].includes(mode) ? mode : "income";
  const modeText = {
    summary: {
      title: "サマリー",
      copy: "家計全体の現在地を確認します。",
    },
    income: {
      title: "収入管理",
      copy: "月収登録と給与データ管理を行います。",
    },
    expense: {
      title: "支出管理",
      copy: "支出項目を整え、外部データを参照します。",
    },
    analysis: {
      title: "分析",
      copy: "収入と支出を横断して確認します。",
    },
  }[appMode];

  if (byId("navTitle")) byId("navTitle").textContent = modeText.title;
  if (byId("navCopy")) byId("navCopy").textContent = modeText.copy;
  document.querySelectorAll("[data-app-mode]").forEach((button) => {
    button.classList.toggle("active", button.dataset.appMode === appMode);
  });
  document.querySelectorAll(".expense-view").forEach((element) => {
    element.classList.toggle("hidden", appMode !== "expense");
  });
  byId("panel-summary")?.classList.toggle("hidden", appMode !== "summary");
  byId("panel-analysis")?.classList.toggle("hidden", appMode !== "analysis");
  byId("panel-income")?.classList.toggle("hidden", appMode !== "income");
  renderHeader();
  if (appMode === "summary") renderSummaryPanel();
  if (appMode === "income") mountIncomeManagement();
  if (appMode === "expense") renderExpenseVisible();
  if (appMode === "analysis") renderUnifiedAnalysis();
  requestAnimationFrame(() => window.scrollTo(0, appScrollPositions[appMode] || 0));
}

function init() {
  if (window.householdAppStarted) return;
  window.householdAppStarted = true;
  data = window.HOUSEHOLD_DATA;
  if (!data) throw new Error("家計データを読み込めませんでした。");

  loadMaster();
  loadOptions();
  loadCandidateStatus();
  loadImportedRows();
  loadLinkGroups();

  bindAppModeEvents();
  bindCommonUiEvents();
  bindHouseholdEvents();
  bindImportEvents();

  switchAppMode("income");
  rerender();
}

window.startHouseholdApp = init;
if (typeof window.householdAuthPassed === "function" && window.householdAuthPassed()) {
  init();
}




