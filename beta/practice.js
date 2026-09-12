/* Reading workflow and local records. No network calls; the question never
 * enters the random engine. All imported cards resolve through CARDS. */
(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  const E = TarotEngine;
  const RECORD_VERSION = "MYSTERIUM-LOCAL-2";
  const SOURCE_VERSION = "MYSTERIUM-SOURCES-2026-09-10";
  const STORE = "mysterium.beta.local-readings.v2";
  const h = text => String(text ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  let accepted = false, working = null, pending = null, traceIndex = 0, ended = false;
  let saved = false, restoring = false, annotations = {}, action = null, lastSpread = "three";
  let journal = null, selection = null;
  const retainedPacks = new Map();
  const historical = id => ["waite-celtic-1911", "full-forty-two", "waite-thirty-five"].includes(id);
  const preferences = new Map([["waite-celtic-1911", { enabled: false, model: "packet" }]]);
  const variants = {
    process: SPREAD_MAP.get("three").positions.map(p => ({ ...p })),
    cause: [
      { name: "原因", english: "CAUSE", lens: "形成当前状况的原因或背景", role: "past" },
      { name: "现状", english: "PRESENT", lens: "当下正在发生的状态", role: "present" },
      { name: "结果趋向", english: "OUTCOME", lens: "条件不变时的可能结果", role: "outcome" }
    ],
    advice: [
      { name: "优势", english: "STRENGTH", lens: "可实际利用的资源与优势", role: "support" },
      { name: "阻碍", english: "OBSTACLE", lens: "限制行动的因素或代价", role: "obstacle" },
      { name: "建议", english: "ADVICE", lens: "可以检验的下一步行动", role: "advice" }
    ]
  };

  document.querySelector(".hero-copy").insertAdjacentHTML("beforeend", `<nav class="practice-links" aria-label="快速导航"><a href="#reading-table">进入牌桌 ↓</a><a href="#spread-grid">挑选牌阵</a><button type="button" id="history-open">本机记录</button></nav>`);
  document.querySelector(".ritual-bar").insertAdjacentHTML("beforebegin", `
    <section class="practice-settings" aria-labelledby="practice-heading">
      <div class="practice-section-title"><h3 id="practice-heading">本次如何阅读</h3><span>意向 → 确认 → 洗切 → 摆牌 → 观察 → 释读 → 收束</span></div>
      <fieldset id="practice-fields"><legend class="sr-only">开始前固定设置</legend>
        <div class="practice-fields">
          <label class="wide">本次牌面<select id="deck-profile">${TarotDecks.profiles.map(p => `<option value="${p.id}">${h(p.label)}${p.id === TarotDecks.DEFAULT ? "（保留原版）" : ""}</option>`).join("")}</select></label>
          <label>操作方式<select id="operation-mode"><option value="quick">快捷完成洗切</option><option value="guided">逐步操作与文献演示</option></select></label>
          <label>方向生成方式<select id="direction-model"><option value="coin">逐牌独立随机 · 现代 50% 模型</option><option value="packet">旋转一叠牌 · 不指定固定比例</option><option value="retained">保留本副牌当前方向</option></select></label>
          <label>洗牌模型<select id="shuffle-model"><option value="uniform">均匀数字洗牌（默认）</option><option value="riffle">实体交错近似 · GSR</option></select></label>
          <label id="shuffle-passes-row" hidden>每轮交错次数<input id="shuffle-passes" type="number" min="1" max="40" value="8" /></label>
          <label id="cut-mode-row">切牌方式<select id="cut-mode"><option value="single">两叠切牌</option><option value="three-packet">三叠合牌 · 现代变式</option></select></label>
          <label id="packet-order-row" hidden>三叠合牌次序（上方为牌顶）<select id="packet-order"><option value="2,1,0">C → B → A</option><option value="1,2,0">B → C → A</option><option value="1,0,2">B → A → C</option><option value="2,0,1">C → A → B</option><option value="0,2,1">A → C → B</option><option value="0,1,2">A → B → C（原顺序）</option></select></label>
          <label id="draw-mode-row">取牌方式<select id="draw-mode"><option value="top">从牌顶依序取牌</option><option value="fan">固定牌序盲选 · 现代变式</option></select></label>
          <label id="three-variant-row">三张牌的固定定义<select id="three-variant"><option value="process">来处 — 当下 — 趋向</option><option value="cause">原因 — 现状 — 结果趋向</option><option value="advice">优势 — 阻碍 — 建议</option></select></label>
        </div>
        <p id="deck-profile-help" class="practice-help"></p>
        <p id="direction-help" class="practice-help"></p>
        <p id="handling-help" class="practice-help"></p>
        <p id="retained-help" class="practice-help"></p>
        <details><summary>补充范围与背景（可选，抽牌后冻结）</summary><div class="practice-fields">
          <label>观察期限<input id="intent-period" maxlength="120" placeholder="例如：现在至年底；不涉及未来可留空" /></label>
          <label>结果标准<input id="intent-standard" maxlength="240" placeholder="怎样才算达成？可不填写" /></label>
          <label class="wide">已知背景<textarea id="intent-background" maxlength="1500" rows="3" placeholder="只写已知事实；不必填写姓名、联系方式等隐私"></textarea></label>
          <label class="wide">你确认后的聚焦表述（可选）<textarea id="intent-reworded" maxlength="500" rows="2" placeholder="只在你愿意时重述；原问题会同时保留，不被替换"></textarea></label>
        </div></details>
        <div id="choice-fields" class="practice-fields" hidden><label>方案 A<input id="option-a" maxlength="240" placeholder="定义第一个可执行选项" /></label><label>方案 B<input id="option-b" maxlength="240" placeholder="定义第二个可执行选项" /></label><p class="practice-help wide">输入模式请分别定义 A、B；冥想模式可只在心中明确，页面不会猜测选项。</p></div>
      </fieldset>
      <button id="source-library-open" class="text-button" type="button">浏览图版与原文资料（78 张）</button>
      <details class="method-boundaries"><summary>文献依据与数字适配边界</summary><p id="practice-source"></p><p id="deck-source-boundary"></p><p>中文基础牌义为本站现代反思性整理，不是 Waite 原文逐字译文。英语文献条目另列。洗牌使用安全随机与 Fisher–Yates；程序不模拟纸牌摩擦，也不声称提高预测命中率。</p><p><a href="https://en.wikisource.org/wiki/The_Pictorial_Key_to_the_Tarot/Part_3" target="_blank" rel="noopener noreferrer">查阅 Waite 第三部分 §7—9 原文 ↗</a></p></details>
    </section>
    <section id="guided-panel" class="practice-panel" hidden aria-labelledby="guided-title"><h3 id="guided-title">逐步洗切</h3><p id="guided-status" aria-live="polite"></p><div id="guided-controls" class="practice-actions"></div><ol id="guided-log"></ol><button id="cancel-reading" class="text-button" type="button">取消本次阅读</button></section>
    <section id="trace-panel" class="practice-panel" hidden><h3>文献步骤回看</h3><p>以下显示本次真实计算的中间牌序。点击下一步只切换快照，不重新随机；正面发出的牌不会为效果而再次盖回。</p><h4 id="trace-label"></h4><div id="trace-groups"></div><button id="trace-next" type="button" class="secondary-button">下一步</button></section>`);
  $("trace-panel").insertAdjacentHTML("afterend", `<section id="fan-panel" class="practice-panel" hidden aria-labelledby="fan-title"><h3 id="fan-title">从固定牌序中盲选</h3><p>洗切已经结束。牌背编号是固定槽位，不是卡牌身份；点击只取出该槽位，不再随机。按选择顺序对应牌位，已选牌不可撤换。</p><p id="fan-progress" aria-live="polite"></p><div id="fan-cards" class="fan-cards"></div></section>`);
  els.grid.insertAdjacentHTML("beforebegin", `<div class="practice-toolbar"><label>牌桌视图<select id="board-view"><option value="adaptive">自适应排列</option><option value="native">原排列（窄屏可横向滚动）</option><option value="list">编号列表</option></select></label><span id="deck-status" aria-live="polite"></span><button id="next-card" type="button" class="secondary-button" hidden>取下一张</button><button id="abandon-reading" type="button" class="text-button" hidden>结束 / 重新起牌</button></div><div id="outside-significator" hidden></div><nav id="row-nav" class="practice-actions" aria-label="跳到牌阵行" hidden></nav>`);
  const scroll = document.createElement("div"); scroll.className = "board-scroll"; els.grid.before(scroll); scroll.append(els.grid);
  $("abandon-reading").insertAdjacentHTML("beforebegin", `<button id="save-progress" type="button" class="text-button" hidden>保存进度（不含私人资料）</button><button id="inspect-significator" type="button" class="text-button" hidden>查看代表 / 人物牌</button>`);
  document.querySelector(".practice-toolbar").insertAdjacentHTML("afterend", `<details id="reading-summary" class="reading-summary" hidden><summary id="summary-title">本次阅读摘要</summary><p id="summary-content"></p><nav class="practice-links"><a href="#card-grid">牌阵</a><a href="#observation-panel">观察</a><a href="#reading-result">释读</a><a href="#closure-panel">导出与记录</a></nav></details>`);
  els.spreadGrid.insertAdjacentHTML("beforebegin", `<label class="spread-filter">想怎样观察？<select id="spread-filter"><option value="all">查看全部牌阵</option><option value="focus">快速聚焦 / 入门</option><option value="event">分析具体事件</option><option value="choice">比较两个方案</option><option value="panorama">阶段全景</option><option value="history">文献步骤</option></select></label>`);
  els.result.insertAdjacentHTML("beforebegin", `<section id="observation-panel" class="practice-panel" hidden tabindex="-1"><p class="section-kicker">LOOK BEFORE INTERPRETING</p><h3>先看见图像，再解释它</h3><p>先描述颜色、人物、动作和重复图案。哪些是你实际看见的，哪些只是联想？暂时不急着把每张牌判为吉凶。点击牌下“放大图像”可细看。</p><label>整体观察（可留空）<textarea id="observation-note" maxlength="3000" rows="3" placeholder="写下第一印象；不会改动已抽出的牌"></textarea></label><div class="practice-fields"><label>逐牌笔记<select id="note-card"></select></label><label>该牌的图像 / 联想<textarea id="card-note" maxlength="1200" rows="2"></textarea></label></div><button id="interpret-now" type="button" class="primary-button">查看基础释读 →</button></section>`);
  els.result.insertAdjacentHTML("beforeend", `<section class="practice-panel" id="closure-panel"><h3>收束与复盘</h3><p>把解释作为待核实的假设。保存不会上传至服务器；本机记录可能随浏览器清理而丢失，需要长期保留请下载备份。</p><div class="practice-fields"><label>计划采取的行动<textarea id="action-note" maxlength="1500" rows="3"></textarea></label><label>抽牌后补充背景 / 复盘<textarea id="review-note" maxlength="3000" rows="3" placeholder="单独保存，不倒改抽牌前的问题"></textarea></label><label>计划复盘日期<input id="review-date" type="date" /></label></div><label class="privacy-choice"><input id="include-private" type="checkbox" /> 保存 / 下载时同时保留问题、背景与笔记（默认只保留牌阵与操作记录）</label><div class="practice-actions"><button id="save-local" class="secondary-button" type="button">保存到本机</button><button id="download-record" class="secondary-button" type="button">下载 JSON 备份</button><button id="continue-35" class="secondary-button" type="button" hidden>用剩余 35 张继续 §9</button><button id="end-reading" class="text-button" type="button">结束本次阅读</button></div><p id="record-status" aria-live="polite"></p></section>`);
  document.body.insertAdjacentHTML("beforeend", `
    <dialog id="confirm-dialog" class="practice-dialog"><h2>确认本次阅读</h2><p>开始后，问题、牌位、方向与代表牌将锁定。翻牌和解读不会重新抽牌。</p><div id="confirmation-summary"></div><div class="practice-actions"><button id="confirm-start" class="primary-button" type="button">确认并开始</button><button type="button" data-close="confirm-dialog" class="secondary-button">返回修改</button></div></dialog>
    <dialog id="action-dialog" class="practice-dialog"><h2 id="action-title"></h2><p id="action-description"></p><label id="continuation-reason-row" hidden>续读理由<textarea id="continuation-reason" rows="3" maxlength="1000" placeholder="说明第十张为何仍不清晰；不要为了重抽到满意的牌"></textarea></label><div class="practice-actions"><button id="action-confirm" class="primary-button" type="button">确认</button><button data-close="action-dialog" class="secondary-button" type="button">返回</button></div></dialog>
    <dialog id="card-dialog" class="practice-dialog card-dialog"><button class="secondary-button dialog-close" type="button" data-close="card-dialog">关闭</button><h2 id="card-detail-title"></h2><img id="card-detail-image" alt="" /><p id="card-detail-source"></p></dialog>
    <dialog id="prompt-dialog" class="practice-dialog"><h2>预览 AI 提示词</h2><p>这不会调用 AI。先检查并删除隐私；可编辑此副本，但不会改变原始抽牌记录。自动脱敏只作辅助，不保证发现所有隐私。</p><div class="practice-actions"><button id="prompt-no-private" class="secondary-button" type="button">重新生成无私人资料版</button><button id="prompt-redact" class="text-button" type="button">辅助遮盖邮箱 / 手机号</button></div><label>将复制的完整内容<textarea id="prompt-preview" rows="16" spellcheck="false"></textarea></label><p id="prompt-status" aria-live="polite"></p><div class="practice-actions"><button id="prompt-copy" class="primary-button" type="button">复制此版本</button><button data-close="prompt-dialog" class="secondary-button" type="button">关闭</button></div></dialog>
    <dialog id="history-dialog" class="practice-dialog"><h2>本机阅读记录 · 测试版</h2><p>仅保存在此浏览器，不跨设备同步。本站测试版使用独立存储键，不读取或清除正式版记录。导入不会自动保存，下载的文件可能包含你选择保留的私人资料。</p><div class="practice-actions"><label class="secondary-button">导入 JSON<input id="import-record" type="file" accept=".json,application/json" /></label><button id="delete-all-records" class="text-button" type="button">清除本机记录</button><button data-close="history-dialog" class="secondary-button" type="button">关闭</button></div><div id="history-list"></div></dialog>`);
  $("closure-panel").querySelector(".privacy-choice").insertAdjacentHTML("beforebegin", `<details class="journal-section"><summary>抽后补充与可核验复盘</summary><p>新增内容单独标记时间，不会修改抽前问题。复盘自评不是预测有效性的证明。</p><label>补充的现实背景<textarea id="after-background" rows="3" maxlength="3000"></textarea></label><button id="append-background" type="button" class="secondary-button">追加背景记录</button><div class="practice-fields"><label>本次核验结果<select id="review-rating"><option value="">请选择</option>${ReadingJournal.RATINGS.map(r => `<option>${r}</option>`).join("")}</select></label><label class="wide">实际发生的事情<textarea id="review-outcome" rows="3" maxlength="3000"></textarea></label></div><button id="append-review" type="button" class="secondary-button">追加复盘记录</button><ol id="journal-entries"></ol></details><details><summary>本次过程与时间</summary><p id="journal-events" class="practice-help"></p></details>`);
  $("action-description").insertAdjacentHTML("afterend", `<label id="archive-cancel-row" class="privacy-choice" hidden><input id="archive-cancel" type="checkbox" /> 作废时在本机保留一条无私人资料的过程摘要（不含问题、牌面或笔记）</label>`);

  function directionText(session) {
    return session.directionModel === "retained" ? "保留本副牌当前方向与收牌顺序；首次使用从全正位开始。洗切不会另掷方向；仅在本页内存延续，不自动保存。"
      : session.directionModel === "inherited" ? "继承上一轮余牌的方向，不重新生成逆位"
      : session.directionModel === "packet" ? "初始全正位，平面旋转一叠 180°；方向翻转、牌序不变，随后洗切。转叠数量为本站数字约定，非原文指定比例"
      : session.directionModel === "coin" ? "洗牌前逐牌独立等概率生成方向（现代 50% 模型，不保证各半）"
      : "全正位初始化（本站约定；不声称原文禁止逆位）";
  }
  function sync() {
    const spread = activeSpread();
    const pDeck = TarotDecks.profile(state.session?.deckProfileId || pending?.deckProfileId || $("deck-profile").value);
    $("deck-profile").value = pDeck.id;
    $("deck-profile").disabled = Boolean(pending || state.session);
    $("deck-profile-help").textContent = pDeck.description;
    $("deck-source-boundary").textContent = pDeck.description;
    $("method-deck-name").textContent = pDeck.label;
    els.significator.querySelector('option[value="2"]').textContent = pDeck.id === "waite-pkt" ? "女祭司" : "女教皇";
    if (state.phase === "idle" && spread.id !== lastSpread) {
      const p = preferences.get(spread.id) || { enabled: true, model: "coin" };
      els.reversals.checked = p.enabled; $("direction-model").value = p.model;
      lastSpread = spread.id;
    }
    $("three-variant-row").hidden = spread.id !== "three";
    $("choice-fields").hidden = spread.id !== "choice";
    $("direction-model").disabled = !els.reversals.checked || spread.id === "waite-thirty-five";
    $("direction-help").textContent = directionText({ directionModel: spread.id === "waite-thirty-five" ? "inherited" : els.reversals.checked ? $("direction-model").value : "upright" });
    const classic = historical(spread.id);
    $("cut-mode-row").hidden = classic; $("draw-mode-row").hidden = classic;
    $("packet-order-row").hidden = classic || $("cut-mode").value !== "three-packet";
    $("shuffle-passes-row").hidden = $("shuffle-model").value !== "riffle";
    $("handling-help").textContent = $("shuffle-model").value === "riffle" ? "GSR：按二项分布分成两叠，再按各叠剩余张数比例交错。有限次数不等于均匀洗牌；8 次只是界面默认，不保证充分混合，不提高预测率。§8 的小组重洗仍用均匀数字模型。" : "默认均匀洗牌，每张合格牌获得相同的入阵机会。数字模型不模拟纸牌摩擦，也不把点击时机当随机源。";
    $("retained-help").textContent = retainedPacks.has(pDeck.id) ? "此牌组已有本页收牌状态；选“保留本副牌当前方向”可沿用。其他方向模型会按所选规则重新准备。刷新后不自动恢复。" : "此牌组尚无本页收牌状态；保留方向模式首次从全正位开始。";
    $("practice-source").textContent = spread.sourceNote + (spread.id === "full-forty-two" ? " §8 提到洗牌时转动部分牌，并由问卜者左手切牌；网页不能验证使用哪只手。逐步模式展示正面分叠、重排与补位。" : "");
    if (spread.id === "waite-thirty-five") els.methodNote.textContent = "仅使用上一轮剩余的 35 张。方向继承，六行按 7 / 6 / 5 / 4 / 2 / 11 排列，从左向右阅读。";
    if (spread.id === "full-forty-two") els.methodNote.textContent = "§8 原法转动部分牌，没有规定 50% 比例。人物牌最后放在阵外；省略人物牌属于现代简化，也不能进入 35 张续读。";
    $("inspect-significator").hidden = !["waite-celtic-1911", "full-forty-two"].includes(spread.id);
    filterSpreads();
    applyView(); globalThis.Workbench?.sync();
  }
  function capture() {
    const id = state.spreadId;
    const model = id === "waite-thirty-five" ? "inherited" : els.reversals.checked ? $("direction-model").value : "upright";
    const pDeck = TarotDecks.profile(pending?.deckProfileId || $("deck-profile").value);
    return {
      id: crypto.randomUUID(), engineVersion: E.VERSION, sourceVersion: SOURCE_VERSION,
      methodVersion: "MYSTERIUM-METHODS-3", meaningVersion: "MYSTERIUM-MODERN-MEANINGS-1",
      deckProfileId: pDeck.id, deckVersion: pDeck.version, referenceVersion: pDeck.referenceVersion,
      glossVersion: pDeck.id === "waite-pkt" && (!pending || pending.referenceVersion === "WAITE-PKT-REFERENCE-2") ? globalThis.WaiteZh?.VERSION || null : null,
      operationMode: $("operation-mode").value, directionModel: model,
      shuffleModel: $("shuffle-model").value, shufflePasses: $("shuffle-model").value === "riffle" ? Number($("shuffle-passes").value) : 1,
      cutMode: historical(id) ? "single" : $("cut-mode").value, packetOrder: $("packet-order").value.split(",").map(Number),
      drawMode: historical(id) ? "top" : $("draw-mode").value,
      ...(model === "retained" ? { retainedDeck: (retainedPacks.get(pDeck.id)?.deck || E.initialize(TarotDecks.cards(CARDS, pDeck.id))).map(d => ({ ...d })), retainedFromId: retainedPacks.get(pDeck.id)?.id || null } : {}),
      reversalsEnabled: model === "inherited" ? pending.inheritedDeck.some(d => d.reversed) : model !== "upright",
      threeVariant: $("three-variant").value,
      intent: { period: $("intent-period").value.trim(), standard: $("intent-standard").value.trim(), background: $("intent-background").value.trim(), reworded: $("intent-reworded").value.trim(),
        optionA: id === "choice" ? $("option-a").value.trim() : "", optionB: id === "choice" ? $("option-b").value.trim() : "" },
      ...(pending || {})
    };
  }
  function confirmStart() {
    if (accepted) { accepted = false; return true; }
    if (state.spreadId === "choice" && state.questionMode === "write" && (!$("option-a").value.trim() || !$("option-b").value.trim())) {
      showToast("请分别定义方案 A 与 B，或切换为冥想模式在心中明确"); $("option-a").focus(); return false;
    }
    if (state.spreadId === "waite-thirty-five" && !pending?.inheritedDeck) { showToast("需要先完成含人物牌的 42 张法"); return false; }
    const s = captureReadingSession();
    if (!Number.isInteger(s.shufflePasses) || s.shufflePasses < 1 || s.shufflePasses > 40) { showToast("交错次数须为 1—40 的整数"); $("shuffle-passes").focus(); return false; }
    $("confirmation-summary").innerHTML = `<dl class="confirmation-list"><dt>问题 / 意向</dt><dd>${h(s.question || "心中默念，不记录具体问题")}</dd><dt>牌阵</dt><dd>${h(s.spread.name)} · ${s.positions.length} 张</dd><dt>固定牌位</dt><dd>${h(s.positions.map((p, i) => `${i + 1} ${p.name}`).join(" · "))}</dd><dt>方向</dt><dd>${h(directionText(s))}</dd><dt>操作</dt><dd>${s.operationMode === "guided" ? "逐步洗切与步骤回看" : "快捷数字洗切"}</dd><dt>代表 / 人物牌</dt><dd>${h(selectedSignificatorCard(s)?.name || "不单设")}${s.waiteFacing ? ` · 面向${s.waiteFacing === "left" ? "左" : "右"}` : ""}</dd><dt>期限 / 结果标准</dt><dd>${h(s.intent.period || "未限定")} / ${h(s.intent.standard || "未限定")}</dd>${s.spread.id === "choice" ? `<dt>A / B</dt><dd>${h(s.intent.optionA || "在心中明确 A")} / ${h(s.intent.optionB || "在心中明确 B")}</dd>` : ""}</dl>`;
    $("confirmation-summary").insertAdjacentHTML("afterbegin", `<p class="confirmation-deck">${h(TarotDecks.profile(s.deckProfileId).label)}<br />中文现代参考义 / ${s.referenceVersion ? "另列 Waite 英文资料" : "非历史原文译文"}</p>`);
    if (s.intent.reworded) $("confirmation-summary").insertAdjacentHTML("beforeend", `<p>用户整理的聚焦表述（不替换原问题）：${h(s.intent.reworded)}</p>`);
    $("confirmation-summary").insertAdjacentHTML("beforeend", `<details><summary>核对固定牌位、来源与适配项</summary><p>${h(s.spread.sourceNote)}</p><p>${h(TarotDecks.profile(s.deckProfileId).description)}</p><p>${h(s.positions.map((p, i) => `${i + 1}. ${p.name}：${p.lens}`).join("\n"))}</p><p>方法 ${h(s.methodVersion)}；牌面 ${h(s.deckVersion)}；中文参考义 ${h(s.meaningVersion)}；英语资料 ${h(s.referenceVersion || "未使用")}；中文对照 ${h(s.glossVersion || "未使用")}</p></details>`);
    $("confirmation-summary").insertAdjacentHTML("beforeend", `<p>${h(s.shuffleModel === "riffle" ? `每轮 ${s.shufflePasses} 次 GSR 交错近似（不是均匀分布保证）` : "均匀数字洗牌")} · ${s.cutMode === "three-packet" ? `三叠按 ${s.packetOrder.map(i => "ABC"[i]).join(" → ")} 合牌（现代）` : "两叠切牌"} · ${s.drawMode === "fan" ? "固定槽位盲选（现代）" : "牌顶依序发牌"}。阅读视角固定为屏幕下方向上看牌。</p>`);
    $("confirm-dialog").showModal(); return false;
  }
  function beginGuided(session) {
    journal = ReadingJournal.create(session.createdAt); renderJournal();
    $("practice-fields").disabled = true; $("abandon-reading").hidden = false; saved = false; ended = false;
    globalThis.Workbench?.sync();
    if (session.operationMode !== "guided") return false;
    const deck = E.initialDeck(readingDeck(session), session, secureRandomInt);
    working = { deck, log: [], cuts: [], round: 1, stage: session.directionModel === "packet" ? "rotate" : "shuffle", session };
    $("guided-panel").hidden = false; renderGuided(); return true;
  }
  function renderGuided() {
    const w = working;
    const stage = w.stage;
    $("guided-status").textContent = `工作牌库 ${w.deck.length} 张 · 第 ${w.round} / ${w.session.spread.id === "waite-celtic-1911" ? 3 : 1} 轮。` + (stage === "rotate" ? "选择前叠数量，平面旋转 180°。不是翻面，也不倒转牌序。" : stage === "shuffle" ? `${w.session.shuffleModel === "riffle" ? `执行 ${w.session.shufflePasses} 次 GSR 交错近似` : "执行均匀数字洗牌"}，方向保持不变。` : "可以继续洗牌，或在此停止并切牌。切叠只重排当前牌序，不重新随机。§8 的左手要求由你自行配合，网页不能验证。");
    $("guided-controls").innerHTML = stage === "shuffle" ? `<button id="guided-step" class="primary-button" type="button">洗牌</button>` : `<label>${stage === "rotate" ? "转叠数量" : "切点（上叠张数）"}<input id="packet-count" type="number" min="1" max="${w.deck.length - 1}" value="${Math.floor(w.deck.length / 2)}" /></label><button id="guided-step" class="primary-button" type="button">${stage === "rotate" ? "旋转这一叠" : "完成切牌"}</button>`;
    if (stage === "cut") {
      $("guided-controls").insertAdjacentHTML("beforeend", `<button id="guided-repeat" class="secondary-button" type="button">再洗一次（可选）</button>`);
      if (w.session.cutMode === "three-packet") {
        $("packet-count").value = Math.floor(w.deck.length / 3);
        $("guided-step").insertAdjacentHTML("beforebegin", `<label>第二切点（从原牌顶计数）<input id="packet-second" type="number" min="2" max="${w.deck.length - 1}" value="${Math.floor(w.deck.length * 2 / 3)}" /></label><p>A 是原上叠，B 是中叠，C 是下叠；按 ${w.session.packetOrder.map(i => "ABC"[i]).join(" → ")} 合回，最左为新牌顶。</p>`);
      }
      $("guided-repeat").onclick = () => {
        try {
          const op = w.log.findLast(op => op.type === "shuffle");
          if (op.passes >= 40) throw new Error("本轮已洗 40 次，请继续切牌；次数不是预测准确率");
          w.deck = E.wash(w.deck, w.session.shuffleModel, 1, secureRandomInt); op.passes++;
          renderGuided(); $("guided-repeat").focus();
        } catch (e) { showToast(e.message); }
      };
    }
    $("guided-log").innerHTML = w.log.map(op => `<li>${h(operationLabel(op))}</li>`).join("");
    $("guided-step").onclick = () => {
      try {
        if (stage === "rotate") {
          const count = Number($("packet-count").value); w.deck = E.rotatePacket(w.deck, count); w.log.push({ type: "rotate", count, convention: "用户选择前叠数量" }); w.stage = "shuffle";
        } else if (stage === "shuffle") { w.deck = E.wash(w.deck, w.session.shuffleModel, w.session.shufflePasses, secureRandomInt); w.log.push({ type: "shuffle", round: w.round, model: w.session.shuffleModel, passes: w.session.shufflePasses }); w.stage = "cut"; }
        else {
          const index = Number($("packet-count").value);
          if (w.session.cutMode === "three-packet") {
            const second = Number($("packet-second").value); w.deck = E.cutThree(w.deck, index, second, w.session.packetOrder);
            w.log.push({ type: "cut-three", round: w.round, first: index, second, order: w.session.packetOrder });
          } else { w.deck = E.cut(w.deck, index); w.log.push({ type: "cut", round: w.round, index }); }
          w.cuts.push(index);
          if (w.round < (w.session.spread.id === "waite-celtic-1911" ? 3 : 1)) { w.round++; w.stage = "shuffle"; }
          else {
            const prepared = prepareDraws(w.session, w); working = null; $("guided-panel").hidden = true;
            if (prepared === false) return;
            state.phase = "ready"; els.deckMini.classList.remove("is-shuffling"); els.shuffleButton.querySelector("span").textContent = "洗切完成";
            els.receipt.textContent = auditReceipt(); updateSteps(3); onReady(); return;
          }
        }
        renderGuided(); $("guided-step").focus({ preventScroll: true });
      } catch (error) { showToast(error.message); }
    };
  }
  function operationLabel(op) {
    return op.type === "rotate" ? `旋转前叠 ${op.count} 张（方向变化，牌序不变）` : op.type === "shuffle" ? `第 ${op.round} 轮${op.model === "riffle" ? " GSR 交错" : "均匀洗牌"} × ${op.passes || 1}` : op.type === "cut" ? `第 ${op.round} 轮在 ${op.index} 张处切牌` : op.type === "cut-three" ? `第 ${op.round} 轮三叠切点 ${op.first}/${op.second}，合叠 ${op.order.map(i => "ABC"[i]).join("→")}` : op.type === "select" ? `按固定槽位 ${op.indices.map(i => i + 1).join("、")} 依序盲选（未重新随机）` : op.type === "replace-significator" ? `人物牌从全局牌位 ${op.position} 移出，并从未用牌补位` : `发出 ${op.count} 张，方法 ${op.method}`;
  }
  function beginSelection(session, prepared) {
    selection = { session, ...prepared, indices: [] };
    state.phase = "selecting"; $("fan-panel").hidden = false; $("guided-panel").hidden = true;
    els.grid.closest(".board-scroll").hidden = true; els.deckMini.classList.remove("is-shuffling");
    els.shuffleButton.querySelector("span").textContent = "洗切已完成";
    $("fan-cards").innerHTML = prepared.deck.map((_, i) => `<button type="button" class="fan-slot" data-slot="${i}" aria-label="选择固定槽位 ${i + 1}"><span aria-hidden="true">✦</span><small>${i + 1}</small></button>`).join("");
    $("fan-progress").textContent = `请选择第 1 张：${session.positions[0].name}。0 / ${session.positions.length}`;
    $("fan-cards").querySelector("button").focus(); globalThis.Workbench?.sync();
  }
  function renderJournal() {
    if (!$("journal-events")) return;
    $("journal-events").textContent = ReadingJournal.text(journal, false);
    $("journal-entries").innerHTML = (journal?.entries || []).map(e => `<li><strong>${e.kind === "background" ? "补充背景" : `复盘 · ${h(e.rating)}`}</strong><time>${h(e.at)}</time><p>${h(e.text)}</p></li>`).join("");
  }
  function collectPack() {
    const s = state.session; if (!s?.audit) return;
    const sigDirection = s.significatorReversed || false;
    const deck = [...s.draws, ...s.remaining];
    if (s.spread.id === "waite-thirty-five") {
      const parent = s.lineage.at(-1), map = new Map(readingDeck(s).map(c => [E.key(c), c]));
      deck.push(...parent.draws.map(d => ({ card: map.get(d.key), reversed: d.reversed })), { card: map.get(parent.significator), reversed: parent.significatorReversed || false });
    } else if (s.significator) deck.push({ card: s.significator, reversed: sigDirection });
    E.unique(deck, 78); retainedPacks.set(s.deckProfileId, { id: s.id, deck });
  }
  function onReady() {
    if (journal && !restoring) ReadingJournal.event(journal, "prepared"); renderJournal();
    $("practice-fields").disabled = true; $("abandon-reading").hidden = false;
    if (state.session.operationMode === "guided" && state.session.trace?.length) {
      state.phase = "demonstrating"; traceIndex = 0; $("trace-panel").hidden = false;
      els.grid.closest(".board-scroll").hidden = true; showTrace();
    } else { $("next-card").hidden = false; els.statusText.textContent = "洗切完成，按固定编号依次取牌"; }
    showOutside(); rowNavigation(); progress();
  }
  function showTrace() {
    const trace = state.session.trace[traceIndex];
    $("trace-label").textContent = `${traceIndex + 1} / ${state.session.trace.length} · ${trace.label}`;
    $("trace-groups").className = `trace-${trace.kind}`;
    $("trace-groups").innerHTML = trace.groups.map((group, i) => `<section><h4>${trace.kind === "packets" ? "叠" : "行"} ${i + 1}${trace.kind === "rows35" ? ` · ${THIRTY_FIVE_THEMES[i]}` : ""}</h4><div class="trace-cards ${trace.kind === "rows" ? "rtl" : ""}">${group.map((d, j) => `<figure><img src="assets/cards/${h(d.card.file)}" alt="${h(d.card.name)}，${d.reversed ? "逆位" : "正位"}" class="${d.reversed ? "reversed-image" : ""}" /><figcaption>${j + 1} · ${h(d.card.name)} · ${d.reversed ? "逆" : "正"}</figcaption></figure>`).join("")}</div></section>`).join("");
    $("trace-next").textContent = traceIndex === state.session.trace.length - 1 ? "摆牌完成，观察全阵" : "下一步骤 →";
  }
  function showOutside() {
    const s = state.session; const visible = s?.spread.id === "full-forty-two" && s.significator;
    $("outside-significator").hidden = !visible;
    $("outside-significator").innerHTML = visible ? `<img src="assets/cards/${h(s.significator.file)}" alt="阵外人物牌 ${h(s.significator.name)}" /><p>阵外人物牌 · ${h(s.significator.name)}<br>置于第一行右侧，不是第 43 张，也不参与后续 35 张续读。${s.audit.significatorReplaced ? `原在全局牌位 ${s.audit.significatorPosition}，已从未发牌补入 ${h(s.audit.replacement)}。` : "人物牌从未发牌中取出，无需补位。"}</p>` : "";
  }
  function rowNavigation() {
    const id = activeSpread().id; const grouped = ["full-forty-two", "waite-thirty-five"].includes(id);
    $("row-nav").hidden = !grouped;
    let offset = 0;
    $("row-nav").innerHTML = grouped ? (id === "full-forty-two" ? [7, 7, 7, 7, 7, 7] : E.COUNTS_35).map((count, row) => {
      const start = offset; offset += count;
      return `<button type="button" class="text-button" data-jump="${start}">${id === "full-forty-two" ? `第 ${row + 1} 行` : THIRTY_FIVE_THEMES[row]} · ${start + 1}—${offset}</button>`;
    }).join("") : "";
    document.querySelectorAll(".card-position").forEach((node, index) => {
      node.dataset.row = id === "full-forty-two" ? Math.floor(index / 7) : activePositions()[index]?.row ?? 0;
      const title = node.querySelector(".position-label strong"); title.textContent = `${index + 1} · ${activePositions()[index].name}`;
    });
  }
  function progress() {
    if (!state.session?.audit) return;
    $("deck-status").textContent = `已呈现 ${state.revealed} / ${state.draws.length} 张 · 余牌 ${state.session.remaining.length} 张 · 牌序已锁定`;
    $("next-card").hidden = state.phase !== "ready" || ended;
    $("next-card").textContent = activeSpread().id === "full-forty-two" ? "翻开下一行" : `取第 ${Math.min(state.revealed + 1, state.draws.length)} 张`;
    $("save-progress").hidden = !["ready", "observing", "complete"].includes(state.phase);
    $("reading-summary").hidden = false;
    $("summary-title").textContent = `${activeSpread().name} · ${state.revealed}/${state.draws.length} 张 · 查看本次摘要`;
    $("summary-content").textContent = `${state.session.question || "冥想意向：具体问题未提供"}\n${directionText(state.session)}\n${TarotDecks.profile(state.session.deckProfileId).label} / 本站现代中文牌义${state.session.referenceVersion ? " / 英文原文另列" : ""}`;
    document.querySelectorAll(".card-position.is-revealed").forEach(node => {
      if (!node.querySelector(".magnify-card")) node.insertAdjacentHTML("beforeend", `<button type="button" class="text-button magnify-card" data-magnify="${node.dataset.index}">放大图像</button>`);
    });
    saved = false; globalThis.Workbench?.sync();
  }
  function onComplete() {
    if (journal && !restoring) ReadingJournal.event(journal, "observed", { revealed: state.revealed }); renderJournal();
    globalThis.SourcesUI?.readingNote();
    $("next-card").hidden = true; rowNavigation(); progress();
    $("observation-panel").hidden = false;
    $("note-card").innerHTML = activePositions().map((p, i) => `<option value="${i}">${i + 1} · ${h(p.name)} · ${h(state.draws[i].card.name)}</option>`).join("");
    $("card-note").value = annotations[0] || "";
    $("continue-35").hidden = !(activeSpread().id === "full-forty-two" && state.significator && state.session.remaining.length === 35);
    if (!restoring) {
      state.phase = "observing"; els.result.hidden = true;
      els.statusText.textContent = "牌阵已形成：先观察图像，再选择查看释读";
      $("observation-panel").focus({ preventScroll: true }); $("observation-panel").scrollIntoView({ behavior: "smooth", block: "start" });
    }
    globalThis.Workbench?.sync();
  }
  function viewInterpretation() { state.phase = "complete"; els.result.hidden = false; $("interpret-now").hidden = true; if (journal) ReadingJournal.event(journal, "interpreted"); renderJournal(); els.statusText.textContent = "释读已展开；可记录行动、导出或结束本次阅读"; els.result.focus({ preventScroll: true }); els.result.scrollIntoView({ behavior: "smooth", block: "start" }); globalThis.Workbench?.sync(); }
  function onReset() {
    collectPack(); journal = null; selection = null;
    accepted = false; pending = null; working = null; annotations = {}; ended = false; saved = false;
    ["guided-panel", "trace-panel", "fan-panel", "observation-panel", "outside-significator", "next-card", "abandon-reading", "row-nav", "save-progress", "reading-summary"].forEach(id => { $(id).hidden = true; });
    ["observation-note", "card-note", "action-note", "review-note", "review-date", "record-status", "deck-status"].forEach(id => { if ("value" in $(id)) $(id).value = ""; else $(id).textContent = ""; });
    $("practice-fields").disabled = false; $("interpret-now").hidden = false; $("include-private").checked = false;
    $("deck-profile").disabled = false;
    ["after-background", "review-rating", "review-outcome"].forEach(id => { $(id).value = ""; }); renderJournal();
    els.grid.closest(".board-scroll").hidden = false;
    if (state.spreadId === "waite-thirty-five") state.spreadId = "full-forty-two";
  }
  function askAction(title, description, callback, reason = false) {
    action = callback; $("action-title").textContent = title; $("action-description").textContent = description;
    $("archive-cancel-row").hidden = true; $("archive-cancel").checked = false;
    $("continuation-reason-row").hidden = !reason; $("continuation-reason").value = ""; $("action-dialog").showModal();
  }
  const pack = entry => ({ key: E.key(entry), reversed: entry.reversed });
  function proof(s) { return { id: s.id, method: s.spread.id, deckProfileId: s.deckProfileId, deckVersion: s.deckVersion, referenceVersion: s.referenceVersion, draws: s.draws.map(pack), remaining: s.remaining.map(pack), significator: s.significator ? E.key(s.significator) : null, significatorReversed: s.significatorReversed || false }; }
  function continueReading(kind) {
    if (state.phase !== "complete") return;
    const s = state.session;
    if (kind === "35" && (s.spread.id !== "full-forty-two" || !s.significator || s.remaining.length !== 35)) return;
    askAction(kind === "35" ? "继续阅读未使用的 35 张" : "以第十张作为新代表牌", kind === "35" ? "保留原来的 42 张和人物牌，继承同一问题、范围与余牌方向。无需重新选择一副牌。父阅读卡牌记录会随续读保存。" : "§7 在第十张无法判断或为宫廷牌时提出续读。新一轮保留关联与理由，不替换旧记录；旧代表牌回到可用牌库。请先保存需要保留的旧笔记。", () => {
      const reason = $("continuation-reason").value.trim();
      if (kind !== "35" && !reason) { showToast("请说明续读理由"); return false; }
      const lineage = [...(s.lineage || []), proof(s)];
      resetReading(); state.spreadId = kind === "35" ? "waite-thirty-five" : "waite-celtic-1911";
      $("deck-profile").value = s.deckProfileId; populateWaiteSignificators();
      els.question.value = s.question; setQuestionMode(s.questionMode);
      ["period", "standard", "background", "reworded"].forEach(key => { $(`intent-${key}`).value = s.intent[key] || ""; });
      if (kind !== "35") { els.waiteSignificator.value = E.key(s.draws[9]); els.waiteFacing.value = ""; }
      pending = { parentReadingId: s.id, lineage, deckProfileId: s.deckProfileId, deckVersion: s.deckVersion, referenceVersion: s.referenceVersion, continuationReason: kind === "35" ? "按 §9 承接上一轮余牌" : reason,
        ...(kind === "35" ? { inheritedDeck: s.remaining.map(d => ({ ...d })) } : {}) };
      syncSpreadUI(); renderEmptyTable(); syncIdleCopy();
      if (kind === "35") { $("practice-fields").disabled = true; els.question.disabled = true; els.modeButtons.forEach(b => { b.disabled = true; }); }
      showToast(kind === "35" ? "已继承 35 张余牌；确认后开始洗切" : "新代表牌已固定，请确认面向"); return true;
    }, kind !== "35");
  }
  function methodSummary(s) {
    return `${s.engineVersion}；${s.operationMode === "guided" ? "用户逐步洗切" : "快捷数字洗切"}；${s.spread.id === "waite-thirty-five" ? "牌库为父阅读余下的 35 张" : s.spread.id === "waite-celtic-1911" ? "代表牌先移出，77 张参与三轮洗切" : "完整 78 张参与洗切"}；有效牌库为 ${s.audit.eligibleDeckSize} 张；${s.significator ? `${s.spread.id === "waite-celtic-1911" ? "代表牌" : "人物牌"}为${s.significator.name}；` : ""}${directionText(s)}。操作记录：${s.audit.operationLog.map(operationLabel).join("；")}。${s.spread.sourceNote}${s.shuffleModel === "riffle" ? " 初次洗切为 GSR 有限交错近似，不承诺均匀分布；42 法内部小组重洗采用均匀数字洗牌。" : ""}`;
  }
  function exportContext(s) {
    const cardMap = new Map(readingDeck(s).map(c => [E.key(c), c]));
    const pDeck = TarotDecks.recordProfile(s);
    const parents = ReadingJournal.text(journal, true) + `\n用户确认的聚焦表述（不替换原问题）：${s.intent.reworded || "未另行填写"}\n牌组：${pDeck.label}\n牌面 / 英文资料版本：${pDeck.version} / ${pDeck.referenceVersion || "未使用"}\n` + (s.lineage || []).map(p => `父阵 ${p.id}（${SPREAD_MAP.get(p.method)?.name}）：${p.draws.map((d,i) => `父牌${i+1} ${cardMap.get(d.key)?.name} ${d.reversed ? "逆位" : "正位"}`).join("；")}；代表牌 ${cardMap.get(p.significator)?.name || "无"}`).join("\n");
    return `阅读 ID：${s.id}\n父阅读：${s.parentReadingId || "无"}\n${parents}\n引擎 / 方法 / 来源 / 牌义版本：${s.engineVersion} / ${s.methodVersion} / ${s.sourceVersion} / ${s.meaningVersion}\n中文对照译注版本：${s.glossVersion || "未使用"}\n期限：${s.intent.period || "未限定"}\n结果标准：${s.intent.standard || "未限定"}\n已知背景：${s.intent.background || "未提供"}\n选项 A：${s.intent.optionA || "未提供"}\n选项 B：${s.intent.optionB || "未提供"}\n续读理由：${s.continuationReason || "无"}\n抽牌后观察（不是抽牌前问题）：${$("observation-note").value || "无"}\n逐牌笔记：${JSON.stringify(annotations)}\n抽牌后补充 / 复盘：${$("review-note").value || "无"}\n计划行动：${$("action-note").value || "无"}\n来源 ID：WAITE-PKT-1911-III-7/8/9；${pDeck.version}；${pDeck.referenceVersion || "无历史牌义资料层"}；${s.meaningVersion}。历史方法和英语资料不为本站现代中文牌义背书。`;
  }
  function openPrompt() { $("prompt-preview").value = buildAiPrompt(); globalThis.PromptExport?.reset($("prompt-preview").value); $("prompt-status").textContent = "尚未复制或发送。"; $("prompt-dialog").showModal(); }
  function publicPrompt() {
    // Build through a temporary immutable view, restoring in finally. No card operation.
    const old = state.session; const notes = ["observation-note", "review-note", "action-note"].map(id => $(id).value); const a = annotations, oldJournal = journal;
    try {
      state.session = { ...old, question: "", questionMode: "meditation", intent: {}, continuationReason: "" };
      journal = ReadingJournal.snapshot(oldJournal, false);
      ["observation-note", "review-note", "action-note"].forEach(id => { $(id).value = ""; }); annotations = {};
      return buildAiPrompt();
    } finally { state.session = old; journal = oldJournal; ["observation-note", "review-note", "action-note"].forEach((id, i) => { $(id).value = notes[i]; }); annotations = a; }
  }
  function snapshot(includePrivate) {
    const s = state.session; if (!s?.audit) throw new Error("请先完成洗切");
    return {
      schema: RECORD_VERSION, savedAt: new Date().toISOString(), id: s.id, createdAt: s.createdAt,
      engineVersion: s.engineVersion, sourceVersion: s.sourceVersion, methodVersion: s.methodVersion, meaningVersion: s.meaningVersion,
      deckProfileId: s.deckProfileId, deckVersion: s.deckVersion, referenceVersion: s.referenceVersion,
      glossVersion: s.glossVersion || null,
      spreadId: s.spread.id, threeVariant: s.threeVariant, themeCard: s.positions.length === 13,
      question: includePrivate ? s.question : "", questionMode: includePrivate ? s.questionMode : "meditation",
      intent: includePrivate ? s.intent : {}, continuationReason: includePrivate ? s.continuationReason || "" : "",
      privateIncluded: includePrivate, operationMode: s.operationMode, directionModel: s.directionModel,
      shuffleModel: s.shuffleModel || "uniform", shufflePasses: s.shufflePasses || 1, cutMode: s.cutMode || "single", packetOrder: s.packetOrder || [2,1,0], drawMode: s.drawMode || "top",
      selectedIndices: s.selectedIndices, selectionDeck: s.selectionDeck?.map(pack), retainedDeck: s.retainedDeck?.map(pack), retainedFromId: s.retainedFromId || null,
      journal: ReadingJournal.snapshot(journal, includePrivate), significatorReversed: s.significatorReversed || false,
      reversalsEnabled: s.reversalsEnabled, significatorId: s.significatorId, waiteSignificatorKey: s.waiteSignificatorKey, waiteFacing: s.waiteFacing, aiDepth: s.aiDepth,
      significator: s.significator ? E.key(s.significator) : null,
      draws: s.draws.map(pack), remaining: s.remaining.map(pack), inheritedDeck: s.inheritedDeck?.map(pack),
      audit: s.audit, lineage: s.lineage || [], parentReadingId: s.parentReadingId || null,
      revealed: state.revealed, stage: state.phase, ended,
      notes: includePrivate ? { observation: $("observation-note").value, perCard: annotations, action: $("action-note").value, review: $("review-note").value, reviewDate: $("review-date").value } : {}
    };
  }
  const cardMap = new Map(CARDS.map(c => [E.key(c), c]));
  function unpack(list, count, map = cardMap) {
    if (!Array.isArray(list) || list.length !== count) throw new Error("记录张数不符");
    const result = list.map(d => {
      if (!d || !map.has(d.key) || typeof d.reversed !== "boolean") throw new Error("记录含未知卡牌或无效方向");
      return { card: map.get(d.key), reversed: d.reversed };
    }); return E.unique(result, count);
  }
  function validate(record) {
    if (!record || record.schema !== RECORD_VERSION || ![E.VERSION, "MYSTERIUM-ENGINE-3"].includes(record.engineVersion) || record.sourceVersion !== SOURCE_VERSION) throw new Error("记录格式或规则版本不受支持；未导入");
    const r = record; const base = SPREAD_MAP.get(r.spreadId);
    const pDeck = TarotDecks.recordProfile(r);
    const cardMap = new Map(TarotDecks.cards(CARDS, pDeck.id, pDeck.referenceVersion).map(c => [E.key(c), c]));
    if (r.glossVersion && (r.glossVersion !== globalThis.WaiteZh?.VERSION || pDeck.referenceVersion !== globalThis.WaiteZh?.SOURCE_VERSION)) throw new Error("中文对照版本与原文资料不匹配");
    const decode = (list, count) => unpack(list, count, cardMap);
    if (!base || typeof r.id !== "string" || r.id.length > 100 || !["quick", "guided"].includes(r.operationMode) || !["upright", "coin", "packet", "inherited", "retained"].includes(r.directionModel)) throw new Error("阅读设置无效");
    const positions = r.spreadId === "three" ? variants[r.threeVariant] : base.positions;
    if (!positions) throw new Error("三张牌位版本未知");
    const canonicalPositions = r.spreadId === "zodiac" && r.themeCard ? [...positions, THEME_POSITION] : positions;
    const draws = decode(r.draws, canonicalPositions.length);
    const sig = r.significator ? cardMap.get(r.significator) : null;
    if (r.significator && !sig) throw new Error("人物牌未知");
    const is35 = r.spreadId === "waite-thirty-five"; const is7 = r.spreadId === "waite-celtic-1911";
    if (is7 && (!sig || r.significator !== r.waiteSignificatorKey || !["left", "right"].includes(r.waiteFacing))) throw new Error("代表牌记录不一致");
    if (r.spreadId === "full-forty-two" && (r.significatorId == null ? !!sig : r.significator !== `major:${r.significatorId}` || ![1, 2].includes(r.significatorId))) throw new Error("42 张人物牌不一致");
    if (!is7 && r.spreadId !== "full-forty-two" && sig) throw new Error("此牌阵不能有额外人物牌");
    const remaining = decode(r.remaining, (is35 ? 35 : 78 - (sig ? 1 : 0)) - draws.length);
    E.unique([...draws, ...remaining, ...(sig ? [{ card: sig }] : [])], is35 ? 35 : 78);
    if (!Number.isInteger(r.revealed) || r.revealed < 0 || r.revealed > draws.length || !["ready", "observing", "complete"].includes(r.stage)) throw new Error("阅读进度无效");
    if ((r.ended !== undefined && typeof r.ended !== "boolean") || (r.ended && r.stage !== "complete")) throw new Error("结束标记与阅读阶段不一致");
    if (["observing", "complete"].includes(r.stage) && r.revealed !== draws.length) throw new Error("完成状态与翻牌数不一致");
    if (r.spreadId === "full-forty-two" && r.revealed % 7 !== 0) throw new Error("42 张法的行进度无效");
    if (r.directionModel === "upright" && [...draws, ...remaining].some(d => d.reversed)) throw new Error("全正位记录中出现逆位");
    if (!r.audit || r.audit.drawCount !== draws.length || r.audit.uniqueCount !== draws.length || r.audit.reversedCount !== draws.filter(d => d.reversed).length) throw new Error("核验记录与牌阵不一致");
    const deckSize = is35 ? 35 : is7 ? 77 : 78;
    if (!Array.isArray(r.audit.cutIndices) || r.audit.cutIndices.length !== (is7 ? 3 : 1) || r.audit.cutIndices.some(n => !Number.isInteger(n) || n < 1 || n >= deckSize)) throw new Error("切牌记录无效");
    if (!Array.isArray(r.audit.operationLog) || r.audit.operationLog.length > 30 || r.audit.operationLog.some(op => !["rotate", "shuffle", "cut", "cut-three", "select", "deal", "replace-significator"].includes(op.type))) throw new Error("操作日志无效");
    if (r.methodVersion !== "MYSTERIUM-METHODS-3" || r.meaningVersion !== "MYSTERIUM-MODERN-MEANINGS-1" || r.audit.engineVersion !== r.engineVersion) throw new Error("方法或牌义版本不符");
    if (typeof r.reversalsEnabled !== "boolean" || r.audit.reversalsEnabled !== r.reversalsEnabled || r.audit.cutIndex !== r.audit.cutIndices.at(-1) || r.audit.eligibleDeckSize !== (is35 ? 35 : 78 - (sig ? 1 : 0))) throw new Error("设置与核验摘要不一致");
    if ((r.directionModel === "upright" && r.reversalsEnabled) || (["coin", "packet", "retained"].includes(r.directionModel) && !r.reversalsEnabled)) throw new Error("方向模型与开关不一致");
    const logs = r.audit.operationLog, shuffles = logs.filter(op => op.type === "shuffle"), cuts = logs.filter(op => ["cut", "cut-three"].includes(op.type)), deals = logs.filter(op => op.type === "deal"), rotations = logs.filter(op => op.type === "rotate");
    if (shuffles.length !== r.audit.cutIndices.length || cuts.length !== shuffles.length || shuffles.some((op,i) => op.round !== i+1) || cuts.some((op,i) => op.round !== i+1 || (op.type === "cut" ? op.index : op.first) !== r.audit.cutIndices[i]) || deals.length !== 1 || deals[0].count !== draws.length || deals[0].method !== r.spreadId) throw new Error("操作日志与方法步骤不一致");
    const model = r.shuffleModel || "uniform", cutMode = r.cutMode || "single", drawMode = r.drawMode || "top";
    if (!["uniform", "riffle"].includes(model) || !["single", "three-packet"].includes(cutMode) || !["top", "fan"].includes(drawMode) || (historical(r.spreadId) && (cutMode !== "single" || drawMode !== "top"))) throw new Error("洗切或取牌变式与方法不一致");
    if (shuffles.some(op => (op.model || "uniform") !== model || !Number.isInteger(op.passes ?? 1) || (op.passes ?? 1) < 1 || (op.passes ?? 1) > 40) || !Number.isInteger(r.shufflePasses ?? 1) || (r.shufflePasses ?? 1) < 1 || (r.shufflePasses ?? 1) > 40) throw new Error("洗牌次数或模型无效");
    for (const op of cuts) {
      if ((cutMode === "three-packet") !== (op.type === "cut-three")) throw new Error("切叠方式不一致");
      if (op.type === "cut-three") { E.cutThree([...draws, ...remaining], op.first, op.second, op.order); if (JSON.stringify(op.order) !== JSON.stringify(r.packetOrder)) throw new Error("合叠次序不一致"); }
    }
    const selectionOps = logs.filter(op => op.type === "select");
    if (drawMode === "fan") {
      const selected = E.select(decode(r.selectionDeck, 78), r.selectedIndices, draws.length);
      if (selectionOps.length !== 1 || JSON.stringify(selectionOps[0].indices) !== JSON.stringify(r.selectedIndices) || JSON.stringify(selected.draws.map(pack)) !== JSON.stringify(draws.map(pack)) || JSON.stringify(selected.remaining.map(pack)) !== JSON.stringify(remaining.map(pack))) throw new Error("盲选结果与固定槽位不一致");
    } else if (selectionOps.length || r.selectedIndices || r.selectionDeck) throw new Error("顶牌发牌不能夹带盲选记录");
    if (r.directionModel === "retained") {
      const retained = new Map(decode(r.retainedDeck, 78).map(d => [E.key(d), d.reversed]));
      if ([...draws, ...remaining].some(d => retained.get(E.key(d)) !== d.reversed) || (sig && retained.get(E.key(sig)) !== Boolean(r.significatorReversed))) throw new Error("保留方向被暗中改变");
    } else if (r.retainedDeck || r.retainedFromId) throw new Error("方向模型不能夹带未使用的保留牌组");
    const expectedLog = [...(rotations.length ? ["rotate"] : []), ...shuffles.flatMap(() => ["shuffle", cutMode === "three-packet" ? "cut-three" : "cut"]), ...(drawMode === "fan" ? ["select"] : []), "deal", ...(r.audit.significatorReplaced ? ["replace-significator"] : [])];
    if (logs.map(op => op.type).join() !== expectedLog.join()) throw new Error("操作事件的先后顺序无效");
    if (rotations.length !== (r.directionModel === "packet" ? 1 : 0) || rotations.some(op => !Number.isInteger(op.count) || op.count < 1 || op.count >= deckSize)) throw new Error("转叠记录无效");
    const replacementLogs = logs.filter(op => op.type === "replace-significator");
    if (r.audit.significator !== (sig?.name || null)) throw new Error("人物牌摘要不符");
    if (r.audit.significatorReplaced) {
      const index = r.audit.significatorPosition - 1;
      if (r.spreadId !== "full-forty-two" || !sig || !Number.isInteger(index) || index < 0 || index >= 42 || replacementLogs.length !== 1 || replacementLogs[0].position !== index+1 || replacementLogs[0].replacement !== E.key(draws[index]) || r.audit.replacement !== draws[index].card.name) throw new Error("人物牌补位记录不一致");
    } else if (replacementLogs.length || r.audit.significatorPosition != null || r.audit.replacement != null) throw new Error("无补位却存在补位记录");
    if (!Array.isArray(r.lineage) || r.lineage.length > 100) throw new Error("续读链无效或过长");
    const parentIds = new Set();
    for (const parent of r.lineage) {
      if (TarotDecks.recordProfile(parent).id !== pDeck.id) throw new Error("续读不能更换父阅读的牌组");
      if (typeof parent.id !== "string" || parent.id.length > 100 || parentIds.has(parent.id) || !["waite-celtic-1911", "full-forty-two"].includes(parent.method) || !cardMap.has(parent.significator)) throw new Error("父阅读记录无效");
      parentIds.add(parent.id);
      E.unique([...decode(parent.draws, parent.method === "full-forty-two" ? 42 : 10), ...decode(parent.remaining, parent.method === "full-forty-two" ? 35 : 67), { card: cardMap.get(parent.significator) }], 78);
    }
    if (r.parentReadingId) {
      const parent = r.lineage.at(-1);
      if (!parent || parent.id !== r.parentReadingId || parent.id === r.id) throw new Error("父阅读关联无效");
      if (is35) {
        if (parent.method !== "full-forty-two" || !["major:1", "major:2"].includes(parent.significator)) throw new Error("35 张必须来自含人物牌的 42 张阅读");
        const pd = decode(parent.draws, 42), pr = decode(parent.remaining, 35);
        E.unique([...pd, ...pr, { card: cardMap.get(parent.significator) }], 78);
        const inherited = decode(r.inheritedDeck, 35);
        if (JSON.stringify(inherited.map(pack)) !== JSON.stringify(pr.map(pack))) throw new Error("继承的余牌序列不一致");
        const original = new Map(pr.map(d => [E.key(d), d.reversed]));
        if (draws.some(d => original.get(E.key(d)) !== d.reversed) || r.directionModel !== "inherited") throw new Error("续读牌不属于原余牌，或方向被改动");
      } else if (!is7 || parent.method !== "waite-celtic-1911" || parent.draws?.[9]?.key !== r.waiteSignificatorKey) throw new Error("第十张续读关联不一致");
    } else if (is35 || r.directionModel === "inherited") throw new Error("缺少父阅读");
    const string = (v, max) => { if (v == null) return ""; if (typeof v !== "string" || v.length > max) throw new Error("记录文字超出限制"); return v; };
    const intent = Object.fromEntries(["period", "standard", "background", "reworded", "optionA", "optionB"].map(k => [k, string(r.intent?.[k], k === "reworded" ? 500 : 1500)]));
    const notes = { observation: string(r.notes?.observation, 3000), action: string(r.notes?.action, 1500), review: string(r.notes?.review, 3000), reviewDate: string(r.notes?.reviewDate, 10), perCard: {} };
    for (const [k, v] of Object.entries(r.notes?.perCard || {})) { if (!/^\d+$/.test(k) || +k >= draws.length) throw new Error("笔记牌号无效"); notes.perCard[k] = string(v, 1200); }
    if (!["meditation", "write"].includes(r.questionMode) || !["detailed", "summary"].includes(r.aiDepth) || typeof r.privateIncluded !== "boolean" || !Number.isFinite(Date.parse(r.createdAt))) throw new Error("模式或日期无效");
    if (!r.privateIncluded && (r.question || r.continuationReason || Object.values(intent).some(Boolean) || Object.values(notes).some(v => typeof v === "string" ? Boolean(v) : Object.keys(v).length))) throw new Error("无私人资料标记与记录内容不符");
    const validJournal = ReadingJournal.validate(r.journal, { includePrivate: r.privateIncluded, createdAt: r.createdAt, ended: r.ended });
    if (r.engineVersion === E.VERSION && !validJournal) throw new Error("当前版本缺少确认与过程日志");
    if (validJournal) {
      const events = new Set(validJournal.events.map(e => e.type));
      if (!events.has("prepared") || events.has("ended") !== Boolean(r.ended) || events.has("cancelled") || events.has("failed") || (["observing", "complete"].includes(r.stage) && !events.has("observed")) || (r.stage === "complete" && !events.has("interpreted")) || (r.revealed < draws.length && events.has("observed")) || validJournal.events.some(e => e.revealed !== undefined && (e.revealed > draws.length || (["observed", "ended"].includes(e.type) && e.revealed !== draws.length)))) throw new Error("过程日志与阅读进度不一致");
    }
    return { session: deepFreeze({ ...r, version: "MYSTERIUM-READING-2", spread: { ...base, positions: canonicalPositions }, positions: canonicalPositions,
      deckProfileId: pDeck.id, deckVersion: pDeck.version, referenceVersion: pDeck.referenceVersion,
      question: string(r.question, 500), questionMode: r.questionMode === "write" ? "write" : "meditation", intent, continuationReason: string(r.continuationReason, 1000),
      draws, remaining, significator: sig, inheritedDeck: is35 ? decode(r.inheritedDeck, 35) : undefined, retainedDeck: r.directionModel === "retained" ? decode(r.retainedDeck, 78) : undefined, selectionDeck: drawMode === "fan" ? decode(r.selectionDeck, 78) : undefined, trace: [] }), notes, journal: validJournal };
  }
  function restore(record) {
    const checked = validate(record); // Fully validate before touching the current session.
    resetReading(); const s = checked.session; state.spreadId = s.spread.id;
    els.question.value = s.question; setQuestionMode(s.questionMode);
    state.session = s; state.draws = s.draws; state.significator = s.significator; state.audit = s.audit; state.cutIndex = s.audit.cutIndex;
    state.revealed = record.revealed; state.phase = "ready"; ended = Boolean(record.ended); journal = checked.journal;
    $("deck-profile").value = s.deckProfileId; populateWaiteSignificators();
    els.waiteFacing.value = s.waiteFacing; els.waiteSignificator.value = s.waiteSignificatorKey; els.reversals.checked = s.reversalsEnabled;
    els.question.value = s.question; state.questionMode = s.questionMode; syncSpreadUI(); renderEmptyTable(); bindDrawButtons();
    $("three-variant").value = s.threeVariant; $("operation-mode").value = s.operationMode; $("direction-model").value = ["packet", "retained"].includes(s.directionModel) ? s.directionModel : "coin";
    $("shuffle-model").value = s.shuffleModel || "uniform"; $("shuffle-passes").value = s.shufflePasses || 8; $("cut-mode").value = s.cutMode || "single"; $("packet-order").value = (s.packetOrder || [2,1,0]).join(); $("draw-mode").value = s.drawMode || "top";
    if (s.spread.id === "three") SPREAD_MAP.get("three").positions = variants[s.threeVariant].map(p => ({ ...p }));
    ["period", "standard", "background", "reworded"].forEach(key => { $(`intent-${key}`).value = s.intent[key] || ""; }); $("option-a").value = s.intent.optionA; $("option-b").value = s.intent.optionB;
    els.themeCard.checked = s.positions.length === 13; els.significator.value = s.significatorId == null ? "" : String(s.significatorId); els.aiDepth.value = s.aiDepth;
    for (let i = 0; i < state.revealed; i++) paintCard(i);
    document.querySelectorAll(".tarot-card").forEach((b, i) => { b.disabled = i !== state.revealed; });
    const n = checked.notes; annotations = n.perCard; $("observation-note").value = n.observation; $("action-note").value = n.action; $("review-note").value = n.review; $("review-date").value = n.reviewDate;
    setQuestionControlsDisabled(true); els.reversals.disabled = true; els.shuffleButton.disabled = true; $("practice-fields").disabled = true;
    if (state.revealed === s.draws.length) { restoring = true; finishReading(); restoring = false; if (record.stage === "observing") { state.phase = "observing"; els.result.hidden = true; } else $("interpret-now").hidden = true; }
    $("abandon-reading").hidden = false; els.receipt.textContent = auditReceipt(); sync(); showOutside(); rowNavigation(); progress(); saved = true;
    renderJournal(); $("history-dialog").close(); showToast("已恢复原记录；没有重新随机抽牌"); globalThis.Workbench?.sync();
  }
  function cancelCurrent() {
    const s = state.session;
    askAction(s && !ended ? "作废并重新起牌？" : "开始新的阅读？", "新阅读不会替换旧牌阵。需要保留完整牌阵或笔记，请先保存或下载；作废摘要仅证明本页有过一次操作，不包含卡牌身份和私人文字。", () => {
      if (journal && !ended) {
        // Prepare the optional archive before mutating the active journal.
        const archiveJournal = ReadingJournal.snapshot(journal, false);
        ReadingJournal.event(archiveJournal, "cancelled", { revealed: state.revealed });
        if ($("archive-cancel").checked) {
          const records = getRecords(); if (records.length >= 30) throw new Error("本机已满；请先备份或取消勾选摘要保存");
          const archive = { schema: "MYSTERIUM-CANCELLED-1", id: `${s.id}:cancelled`, createdAt: s.createdAt, spreadId: s.spread.id, stage: "cancelled", revealed: state.revealed, privateIncluded: false, journal: archiveJournal };
          validateArchive(archive); localStorage.setItem(STORE, JSON.stringify([archive, ...records.filter(r => r.id !== archive.id)]));
        }
        journal = archiveJournal;
      }
      resetReading(); globalThis.Workbench?.sync();
    });
    $("archive-cancel-row").hidden = !s || ended;
  }
  function validateArchive(r) {
    if (r.schema !== "MYSTERIUM-CANCELLED-1" || r.stage !== "cancelled" || typeof r.id !== "string" || !r.id || r.id.length > 100 || !SPREAD_MAP.has(r.spreadId) || r.privateIncluded !== false || !Number.isInteger(r.revealed) || r.revealed < 0 || r.revealed > 42 || Object.keys(r).some(k => !["schema","id","createdAt","spreadId","stage","revealed","privateIncluded","journal"].includes(k))) throw new Error("作废摘要无效");
    ReadingJournal.validate(r.journal, { includePrivate: false, createdAt: r.createdAt, cancelled: true }); return r;
  }
  function getRecords() { const raw = localStorage.getItem(STORE); if (!raw) return []; const data = JSON.parse(raw); if (!Array.isArray(data)) throw new Error("本机记录格式异常，请导出后检查"); return data; }
  function saveLocal() {
    const record = snapshot($("include-private").checked); validate(record); const records = getRecords().filter(r => r.id !== record.id);
    if (records.length >= 30) throw new Error("本机已有 30 条记录，请先下载备份并删除不需要的记录");
    localStorage.setItem(STORE, JSON.stringify([record, ...records])); saved = true;
    $("record-status").textContent = record.privateIncluded ? "已保存到本机，包含你勾选的问题与笔记。" : "已保存到本机：仅牌阵与操作记录，未保存问题与笔记。";
  }
  function history() {
    $("history-list").replaceChildren();
    getRecords().forEach((r, i) => {
      const node = document.createElement("article"); node.className = "history-item";
      node.innerHTML = `<h3>${h(SPREAD_MAP.get(r.spreadId)?.name || "未知版本")}${r.stage === "cancelled" ? " · 已作废" : r.ended ? " · 已结束" : ""}</h3><p>${h(r.createdAt)} · ${r.privateIncluded ? "含私人笔记" : "无私人资料"}</p><p>${h(r.question || "冥想或已省略问题")}</p>${r.schema === "MYSTERIUM-CANCELLED-1" ? `<details><summary>查看作废过程</summary><p>${h(ReadingJournal.text(validateArchive(r).journal, false))}</p><p>作废摘要不能继续翻牌或生成释读。</p></details>` : `<button class="secondary-button" type="button" data-restore="${i}">恢复原记录</button>`}<button class="text-button" type="button" data-delete="${i}">删除</button>`; $("history-list").append(node);
    });
    if (!$("history-list").children.length) $("history-list").textContent = "尚无本机记录。只有主动点击保存，才会写入此浏览器。";
    if (!$("history-dialog").open) $("history-dialog").showModal();
  }
  function applyView() {
    const mode = $("board-view").value; els.grid.closest(".board-scroll").dataset.view = mode;
    const coordinates = {
      "cross-five": ["2/2", "1/2", "2/1", "2/3", "3/2"],
      choice: ["2/1", "1/2", "1/3", "1/4", "3/2", "3/3", "3/4"],
      "celtic-cross": ["2/2", "2/3", "1/2", "3/2", "2/1", "2/4", "4/5", "3/5", "2/5", "1/5"],
      zodiac: ["2/1", "3/1", "4/1", "4/2", "4/3", "4/4", "3/4", "2/4", "1/4", "1/3", "1/2", "1/1", "2/2/4/4"]
    };
    const facing = state.session?.waiteFacing || els.waiteFacing.value;
    coordinates["waite-celtic-1911"] = ["auto", "auto", "1/2", "3/2", facing === "left" ? "2/4" : "2/1", facing === "left" ? "2/1" : "2/4", "4/5", "3/5", "2/5", "1/5"];
    els.grid.querySelectorAll(".card-position").forEach((node, index) => {
      node.style.setProperty("--native-area", coordinates[activeSpread().id]?.[index] || "auto");
      node.style.setProperty("--horseshoe-offset", `${[0,26,48,62,48,26,0][index] || 0}px`);
    });
  }
  function filterSpreads() {
    const groups = { focus: ["single", "three"], event: ["three", "cross-five", "horseshoe", "celtic-cross", "waite-celtic-1911"], choice: ["choice"], panorama: ["zodiac", "full-forty-two"], history: ["waite-celtic-1911", "full-forty-two", "waite-thirty-five"] };
    const group = groups[$("spread-filter").value];
    els.spreadGrid.querySelectorAll("[data-spread-card]").forEach(node => { node.hidden = Boolean(group && !group.includes(node.dataset.spreadCard)); });
  }
  function guard(fn) { return async (...args) => { try { await fn(...args); } catch (error) { showToast(error.message || "操作失败，请重试"); console.error(error); } }; }
  function listen(id, event, fn) { $(id).addEventListener(event, guard(fn)); }
  listen("confirm-start", "click", () => { $("confirm-dialog").close(); accepted = true; startShuffle(); });
  listen("action-confirm", "click", () => { if (action?.() !== false) $("action-dialog").close(); });
  document.querySelectorAll("[data-close]").forEach(b => b.addEventListener("click", () => $(b.dataset.close).close()));
  listen("three-variant", "change", () => { if (state.phase !== "idle") return; SPREAD_MAP.get("three").positions = variants[$("three-variant").value].map(p => ({ ...p })); syncSpreadUI(); renderEmptyTable(); });
  listen("deck-profile", "change", () => { if (state.phase !== "idle" || pending) return; populateWaiteSignificators(); els.waiteFacing.value = ""; sync(); renderEmptyTable(); });
  [els.reversals, $("direction-model")].forEach(el => el.addEventListener("change", () => { if (state.phase === "idle") preferences.set(state.spreadId, { enabled: els.reversals.checked, model: $("direction-model").value }); sync(); }));
  ["shuffle-model", "cut-mode", "draw-mode"].forEach(id => listen(id, "change", sync));
  $("fan-cards").addEventListener("click", guard(event => {
    const button = event.target.closest("[data-slot]"); if (!button || !selection || state.phase !== "selecting" || button.disabled) return;
    const index = Number(button.dataset.slot), w = selection; if (w.indices.includes(index)) return;
    w.indices.push(index); button.disabled = true; button.classList.add("is-picked"); button.textContent = `已取 ${w.indices.length}`;
    if (w.indices.length === w.session.positions.length) {
      const session = deepFreeze({ ...w.session, selectedIndices: [...w.indices], selectionDeck: w.deck.map(d => ({ ...d })) });
      prepareDraws(session, w); selection = null; $("fan-panel").hidden = true; els.grid.closest(".board-scroll").hidden = false;
      state.phase = "ready"; els.receipt.textContent = auditReceipt(); updateSteps(3); onReady(); $("next-card").focus();
    } else {
      $("fan-progress").textContent = `已选 ${w.indices.length} / ${w.session.positions.length}，下一张对应：${w.session.positions[w.indices.length].name}`;
      $("fan-cards").querySelector("button:not(:disabled)")?.focus({ preventScroll: true });
    }
  }));
  listen("board-view", "change", applyView);
  listen("spread-filter", "change", filterSpreads);
  listen("save-progress", "click", () => { $("include-private").checked = false; saveLocal(); showToast("已保存原牌序和进度，未保存问题与笔记"); });
  listen("inspect-significator", "click", () => {
    const card = state.significator || selectedSignificatorCard();
    if (!card) { showToast("请先在上方选择代表 / 人物牌"); return; }
    $("card-detail-title").textContent = `${card.name} · 代表 / 人物牌（不计入解读张数）`;
    $("card-detail-image").src = `assets/cards/${card.file}`; $("card-detail-image").alt = card.name; $("card-detail-image").classList.remove("reversed-image");
    $("card-detail-source").textContent = meaningBasis(card); $("card-dialog").showModal();
  });
  listen("next-card", "click", () => { if (state.phase !== "ready" || ended) return; if (activeSpread().id === "full-forty-two") revealFortyTwoLine(state.revealed); else revealCard(state.revealed); progress(); });
  listen("trace-next", "click", () => { if (state.phase !== "demonstrating") return; if (++traceIndex < state.session.trace.length) showTrace(); else { $("trace-panel").hidden = true; els.grid.closest(".board-scroll").hidden = false; state.draws.forEach((_, i) => paintCard(i)); state.revealed = state.draws.length; finishReading(); } });
  listen("interpret-now", "click", viewInterpretation);
  listen("note-card", "change", () => { $("card-note").value = annotations[$("note-card").value] || ""; });
  listen("card-note", "input", () => { annotations[$("note-card").value] = $("card-note").value; if (journal) ReadingJournal.touch(journal, `card-${$("note-card").value}`); saved = false; });
  ["observation-note", "action-note", "review-note", "review-date"].forEach(id => listen(id, "input", () => { if (journal) ReadingJournal.touch(journal, id); saved = false; }));
  ["background", "review"].forEach(kind => listen(`append-${kind}`, "click", () => {
    if (!journal) throw new Error("旧版记录没有独立时间日志；请用当前版本的新阅读添加结构化复盘");
    ReadingJournal.append(journal, kind, $(kind === "background" ? "after-background" : "review-outcome").value, $("review-rating").value);
    $(kind === "background" ? "after-background" : "review-outcome").value = ""; if (kind === "review") $("review-rating").value = "";
    saved = false; renderJournal(); showToast("已追加到当前阅读；尚未保存到本机");
  }));
  $("row-nav").addEventListener("click", event => { const b = event.target.closest("[data-jump]"); if (b) els.grid.querySelector(`[data-index="${b.dataset.jump}"]`)?.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" }); });
  els.grid.addEventListener("click", event => {
    const b = event.target.closest("[data-magnify]"); if (!b || +b.dataset.magnify >= state.revealed) return;
    const i = +b.dataset.magnify, d = state.draws[i]; $("card-detail-title").textContent = `${i + 1} · ${activePositions()[i].name} · ${d.card.name}（${d.reversed ? "逆位" : "正位"}）`;
    $("card-detail-image").src = `assets/cards/${d.card.file}`; $("card-detail-image").alt = d.card.name; $("card-detail-image").classList.toggle("reversed-image", d.reversed); $("card-detail-source").textContent = meaningBasis(d.card); $("card-dialog").showModal();
  });
  ["cancel-reading", "abandon-reading"].forEach(id => listen(id, "click", cancelCurrent));
  els.resetButton.removeEventListener("click", resetReading); els.resetButton.addEventListener("click", cancelCurrent);
  listen("continue-35", "click", () => continueReading("35"));
  listen("end-reading", "click", () => { if (!ended && journal) ReadingJournal.event(journal, "ended", { revealed: state.revealed }); ended = true; saved = false; collectPack(); renderJournal(); $("record-status").textContent = (journal ? "本次阅读已结束并记录时间。" : "本次阅读已结束；旧记录未保存时间日志，不补造历史时间。") + "牌阵保留供核对；请按需要保存，结束不等于自动保存。"; els.statusText.textContent = "已收束本次阅读"; globalThis.Workbench?.sync(); });
  listen("save-local", "click", saveLocal);
  listen("download-record", "click", () => { const r = snapshot($("include-private").checked); validate(r); const blob = new Blob([JSON.stringify(r, null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `mysterium-${r.id}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); saved = true; $("record-status").textContent = "已生成下载；请确认文件在你的下载目录中。"; });
  listen("history-open", "click", history);
  listen("delete-all-records", "click", () => askAction("清除本机记录？", "只清除本网站保存的阅读，不影响其他网站。此操作无法在站内撤销；已下载的备份不受影响。", () => { localStorage.removeItem(STORE); history(); showToast("本机阅读记录已清除；可从下载备份恢复"); }));
  $("history-list").addEventListener("click", guard(event => {
    const load = event.target.closest("[data-restore]"), del = event.target.closest("[data-delete]");
    if (load) { const record = getRecords()[+load.dataset.restore]; validate(record); askAction("恢复保存的阅读？", "恢复的是原来的牌序与进度，不会重新抽牌。当前未保存的笔记将被替换。", () => restore(record)); }
    if (del) askAction("删除这条本机记录？", "无法在站内撤销；已下载的 JSON 备份不受影响。", () => { const rows = getRecords(); rows.splice(+del.dataset.delete, 1); localStorage.setItem(STORE, JSON.stringify(rows)); history(); showToast("已删除本机记录，可用下载备份恢复"); });
  }));
  listen("import-record", "change", async event => { const file = event.target.files[0]; if (!file) return; if (file.size > 2_000_000) throw new Error("备份超过 2 MB 限制"); const record = JSON.parse(await file.text()); validate(record); event.target.value = ""; askAction("导入并恢复原记录？", "文件已通过格式与牌库一致性检查（不等于证明它未被人工修改）。导入只恢复到当前页，需另点保存才会写入本机。", () => restore(record)); });
  listen("prompt-no-private", "click", () => { $("prompt-preview").value = publicPrompt(); globalThis.PromptExport?.reset($("prompt-preview").value); $("prompt-status").textContent = "已重新生成：移除原问题、背景与笔记。发送前仍请自行检查。"; });
  listen("prompt-redact", "click", () => { $("prompt-preview").value = $("prompt-preview").value.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[邮箱已隐藏]").replace(/(?<!\d)(?:\+?86[- ]?)?1[3-9]\d{9}(?!\d)/g, "[手机号已隐藏]"); $("prompt-status").textContent = "已辅助遮盖常见邮箱与中国大陆手机号；姓名、地址等仍需手动检查。"; });
  listen("prompt-copy", "click", async () => { await writeClipboard($("prompt-preview").value); $("prompt-status").textContent = "已复制此预览版本，尚未发送至任何 AI。"; showToast("AI 提示词已复制"); });
  window.addEventListener("beforeunload", event => { if (state.session && !saved && !ended) { event.preventDefault(); event.returnValue = ""; } });
  globalThis.Practice = { capture, confirmStart, beginGuided, beginSelection, sync, onReady, onComplete, onReset, progress, continueReading, methodSummary, exportContext, openPrompt, snapshot, validate, restore, isEnded: () => ended, tableRendered() { rowNavigation(); applyView(); globalThis.Workbench?.sync(); } };
  els.question.maxLength = 500; els.question.addEventListener("input", () => { els.questionCount.textContent = `${els.question.value.length} / 500`; }); els.questionCount.textContent = "0 / 500";
  sync(); rowNavigation(); applyView();
})();
