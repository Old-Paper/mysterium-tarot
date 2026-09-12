/* The same reading state, presented as a quiet, progressively disclosed table. */
(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  const shell = $("reading-table"), head = shell.querySelector(".table-head");
  const library = $("spread-library");
  const spreadDialog = document.createElement("dialog"); spreadDialog.id = "spread-dialog"; spreadDialog.className = "practice-dialog spread-dialog";
  spreadDialog.innerHTML = '<button type="button" class="secondary-button dialog-close" id="spread-close">返回牌桌</button>';
  document.body.append(spreadDialog); spreadDialog.append(library);
  $("spread-library-title").textContent = "为问题选择合适的牌阵";
  library.querySelector(".spread-quick-guide").hidden = true;
  const topNav = document.createElement("nav"); topNav.className = "workbench-nav"; topNav.setAttribute("aria-label", "网站导航");
  document.querySelector(".site-header").append(topNav);
  topNav.innerHTML = '<button type="button" id="browse-spreads" class="text-button">牌阵</button><label class="density-label"><span class="sr-only">阅读密度</span><select id="reading-density" aria-label="阅读密度"><option value="comfortable">舒适 · 大字</option><option value="compact">紧凑</option></select></label>';
  topNav.prepend($("history-open")); topNav.append($("source-library-open"), $("open-notes"));
  $("history-open").className = "text-button"; $("history-open").textContent = "记录";
  $("source-library-open").textContent = "图版词典"; $("open-notes").textContent = "史料";
  const stableLink = document.createElement("a"); stableLink.id = "stable-site-link"; stableLink.className = "text-button"; stableLink.href = "../"; stableLink.target = "_blank"; stableLink.rel = "noopener noreferrer"; stableLink.textContent = "正式版 ↗"; stableLink.setAttribute("aria-label", "在新标签页打开正式版"); topNav.append(stableLink);
  document.querySelector(".hero-copy .practice-links").remove();
  const lede = document.querySelector(".hero-lede"), provenance = document.querySelector(".provenance-copy");
  provenance.querySelector("p").replaceWith(lede);
  const setup = document.createElement("details"); setup.id = "reading-setup"; setup.open = true;
  setup.innerHTML = '<summary id="setup-summary">本次问题与设置</summary>';
  head.after(setup);
  const choices = document.createElement("div"); choices.className = "table-choices";
  choices.innerHTML = `<label>选择牌阵<select id="quick-spread">${SPREADS.filter(s => s.available && s.id !== "waite-thirty-five").map(s => `<option value="${s.id}">${s.name} · ${s.countLabel}</option>`).join("")}</select></label>`;
  choices.append($("deck-profile").closest("label"), $("operation-mode").closest("label"), $("three-variant-row"));
  setup.append(choices, shell.querySelector(".controls-grid"));
  const advanced = document.createElement("details"); advanced.id = "advanced-settings";
  advanced.innerHTML = '<summary>进阶设置与抽前背景 <span>正逆位 · 洗切手法 · 阅读范围</span></summary>';
  setup.append(advanced); advanced.append(shell.querySelector(".method-card"), shell.querySelector(".practice-settings"));
  $("practice-fields").querySelector(".practice-fields").prepend($("operation-mode").closest("label"), $("three-variant-row"));
  const ritual = shell.querySelector(".ritual-bar");
  const questionControls = shell.querySelector(".controls-grid"); questionControls.after(ritual);
  const explanations = document.createElement("details"); explanations.className = "handling-notes";
  explanations.innerHTML = '<summary>查看当前方向、洗切与牌组说明</summary>';
  $("practice-fields").append(explanations);
  explanations.append($("deck-profile-help"), $("direction-help"), $("handling-help"), $("retained-help"));
  // Method-specific essentials remain visible before confirmation.
  const essentials = document.createElement("div"); essentials.className = "method-essentials";
  setup.append(essentials);
  for (const id of ["theme-toggle-row", "significator-row", "waite-significator-row", "waite-facing-row", "waite-original-note", "ai-depth-row"]) essentials.append($(id));
  const methodBrief = document.createElement("p"); methodBrief.id = "workbench-rule"; methodBrief.className = "workbench-rule"; setup.append(methodBrief);
  const freeNotes = document.createElement("details"); freeNotes.id = "free-notes";
  freeNotes.innerHTML = '<summary>自由复盘笔记（可编辑）</summary>';
  $("closure-panel").querySelector(".journal-section").before(freeNotes);
  freeNotes.append($("review-note").closest("label"));
  $("closure-panel").querySelector("h3").textContent = "记录与复盘";
  const readingNav = document.createElement("nav"); readingNav.id = "reading-sections"; readingNav.hidden = true; readingNav.setAttribute("aria-label", "阅读内容");
  readingNav.innerHTML = '<button type="button" data-view="observe">观察</button><button type="button" data-view="meanings">牌义</button><button type="button" data-view="combination">组合</button><button type="button" data-view="export">导出与记录</button><button type="button" id="end-shortcut">结束阅读</button>';
  $("observation-panel").before(readingNav);
  let lastPhase = "idle", view = "observe";
  function setView(next) {
    view = next; shell.dataset.resultView = view;
    for (const b of readingNav.querySelectorAll("[data-view]")) b.setAttribute("aria-pressed", String(b.dataset.view === view));
  }
  function sync() {
    const active = state.phase !== "idle", done = ["observing", "complete"].includes(state.phase);
    document.body.dataset.readingPhase = state.phase;
    document.body.dataset.readingEnded = String(Practice.isEnded());
    if (lastPhase === "idle" && active) { setup.open = false; advanced.open = false; }
    if (!active) setup.open = true;
    if (active && ritual.parentElement === setup) setup.after(ritual);
    if (!active && ritual.parentElement !== setup) questionControls.after(ritual);
    if (state.phase === "observing" && lastPhase !== "observing") setView("observe");
    if (state.phase === "complete" && lastPhase !== "complete") setView("meanings");
    lastPhase = state.phase;
    $("quick-spread").value = state.spreadId; $("quick-spread").disabled = active;
    if (active) $("deck-profile").disabled = true;
    $("operation-mode").disabled = active || state.spreadId === "waite-thirty-five";
    $("three-variant").disabled = active;
    $("browse-spreads").disabled = active;
    readingNav.hidden = !done;
    $("end-shortcut").hidden = state.phase !== "complete" || Practice.isEnded();
    $("setup-summary").textContent = `${activeSpread().name} · ${state.session?.question || (state.questionMode === "meditation" ? "冥想问题" : "本次问题")} · 查看已固定设置`;
    const model = state.session?.directionModel || (els.reversals.checked ? $("direction-model").value : "upright");
    const orientation = { upright: "全正位初始化", coin: "独立 50% 方向", packet: "转动一叠产生方向", retained: "保留本副牌方向", inherited: "沿用余牌方向" }[model];
    methodBrief.textContent = `${orientation} · ${historicalName()}。开始后问题与牌序锁定；换视图不会重抽。`;
  }
  function historicalName() {
    return state.spreadId === "waite-celtic-1911" ? "Waite §7：移出代表牌，余牌洗切三轮" : state.spreadId === "full-forty-two" ? "Waite §8：六行七张，右至左阅读" : state.spreadId === "waite-thirty-five" ? "Waite §9：原余牌35张，左至右阅读" : $("draw-mode").value === "fan" ? "现代固定槽位盲选" : "从牌顶按固定牌位取牌";
  }
  function openSpreads() { if (state.phase === "idle") spreadDialog.showModal(); }
  $("browse-spreads").addEventListener("click", openSpreads);
  $("spread-close").addEventListener("click", () => spreadDialog.close());
  els.spreadGrid.addEventListener("click", e => { if (e.target.closest("[data-spread]") && state.phase === "idle") { spreadDialog.close(); sync(); } });
  $("quick-spread").addEventListener("change", () => { selectSpread($("quick-spread").value); sync(); });
  readingNav.addEventListener("click", event => {
    const b = event.target.closest("[data-view]"); if (!b) return;
    if (state.phase === "observing" && b.dataset.view !== "observe") $("interpret-now").click();
    setView(b.dataset.view);
  });
  $("end-shortcut").addEventListener("click", () => { setView("export"); $("end-reading").click(); });
  $("interpret-now").addEventListener("click", () => setView("meanings"));
  for (const b of els.modeButtons) b.addEventListener("keydown", event => {
    const keys = ["ArrowLeft", "ArrowRight", "Home", "End"]; if (!keys.includes(event.key)) return;
    event.preventDefault(); const next = event.key === "Home" || event.key === "ArrowLeft" ? els.modeButtons[0] : els.modeButtons[1];
    if (!next.disabled) { next.click(); next.focus(); }
  });
  function syncDialogBounds() {
    const zoom = Number.parseFloat(getComputedStyle(document.body).zoom) || 1;
    document.documentElement.style.setProperty("--page-zoom", String(zoom));
  }
  const setDensity = value => { document.body.dataset.density = value; $("reading-density").value = value; requestAnimationFrame(syncDialogBounds); };
  try { setDensity(localStorage.getItem("mysterium.beta.density") === "compact" ? "compact" : "comfortable"); } catch { setDensity("comfortable"); }
  $("reading-density").addEventListener("change", () => { setDensity($("reading-density").value); try { localStorage.setItem("mysterium.beta.density", $("reading-density").value); } catch { showToast("本机偏好保存不可用；当前显示仍已调整"); } });
  const scheduleBounds = () => requestAnimationFrame(syncDialogBounds);
  window.addEventListener("resize", scheduleBounds);
  new MutationObserver(scheduleBounds).observe(document.body, { attributes: true, attributeFilter: ["style", "data-density"] });
  new ResizeObserver(syncDialogBounds).observe(document.body);
  // Anchors must also expose their destination when reading panels are folded.
  document.addEventListener("click", event => {
    const a = event.target.closest('a[href^="#"]'); if (!a) return;
    const id = a.getAttribute("href").slice(1);
    if (["spread-grid", "spread-library"].includes(id)) { event.preventDefault(); openSpreads(); }
    if (id === "closure-panel") setView("export");
    if (id === "reading-result") { if (state.phase === "observing") $("interpret-now").click(); setView("meanings"); }
    if (id === "observation-panel") setView("observe");
  });
  globalThis.Workbench = { sync, setView };
  setView("observe"); sync();
})();
