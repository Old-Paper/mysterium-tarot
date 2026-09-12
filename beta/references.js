/* On-demand historical reference views. Browsing never draws or changes cards. */
(function () {
  "use strict";
  const $ = id => document.getElementById(id), D = TarotDecks;
  const h = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  let library = [];
  const intros = {
    "waite-pkt": "浏览不抽牌，不改变当前牌组或阅读。图版文件出处标注 1911 年作品；英语正文据 1922 再版的 Wikisource 转录。不是 1909 年彩色实牌扫描，也不是全书或完整中文译本。",
    "marseille-camoin": "浏览不抽牌，不改变当前牌组或阅读。同一副 BnF 馆藏历史马赛牌的完整 78 张原扫描；目录归属 [A. Camoin]、约 1890—1900 年，依 Conver 模式。保留原有手写笔记、印章、磨损和纸边；不是 1760 年印本或现代修复复刻。"
  };
  const warning = "以下为英语历史资料，不是本站中文解读的翻译来源。原文含时代性的性别、外貌、疾病及命运断语，只作史料阅读，不能用于诊断、判定他人或预言伤亡。";
  document.body.insertAdjacentHTML("beforeend", `<dialog id="reference-dialog" class="practice-dialog reference-dialog"><button type="button" class="secondary-button dialog-close" id="reference-close">关闭</button><p class="section-kicker">HISTORICAL CARDS · SOURCE LIBRARY</p><h2>78 张图版与出处</h2><label>选择查阅资料（不切换阅读牌组）<select id="reference-deck"><option value="waite-pkt">Waite–Smith 书中黑白图版与原文</option><option value="marseille-camoin">Camoin 历史马赛牌 · 完整原扫描</option></select></label><p id="reference-intro"></p><label>选择要查阅的牌<select id="reference-card"></select></label><div class="practice-actions reference-pager"><button type="button" id="reference-prev" class="secondary-button">← 上一张</button><span id="reference-count"></span><button type="button" id="reference-next" class="secondary-button">下一张 →</button></div><div class="reference-layout"><figure><img id="reference-image" alt="" /><figcaption id="reference-caption"></figcaption></figure><div id="reference-content"></div></div></dialog>`);
  $("card-detail-source").insertAdjacentHTML("afterend", `<div id="card-historical-reference" hidden></div>`);
  $("card-detail-image").insertAdjacentHTML("afterend", `<a id="card-detail-original" target="_blank" rel="noopener noreferrer">查看原图 ↗</a>`);
  $("reading-result").insertAdjacentHTML("afterbegin", `<p class="reading-layer-note" id="reading-layer-note"></p>`);

  function content(card) {
    if (card.deckProfileId === "marseille-camoin") {
      const original = D.imageInfo(card);
      return `<p class="practice-help source-caution">牌面史料与牌义分开：以下核对的是历史实物图像。本站中文基础释读是现代整理，不是实物笔记的转录或译文，也不是该牌附带的古代说明。</p>
        <h3>Camoin 历史马赛牌 · 约 1890—1900</h3><p>目录归属 [A. Camoin]，依 Nicolas Conver 模式制作。这 78 张均来自同一馆藏对象；钱币二上的“1760”不能用作这副牌的印刷年份。</p>
        <p>保留完整扫描，不重绘、上色、裁边或清除笔记。愚人没有印刷牌号；正义为 VIII，力量为 XI。手写附记不是本站新增的规则，也未在此作学术释读。</p>
        <p class="reference-credit">${h(original.credit)}<br /><a href="${h(original.source)}" target="_blank" rel="noopener noreferrer">本牌来源与 Public domain 标注 ↗</a><br /><a href="${h(MarseilleData.catalogue)}" target="_blank" rel="noopener noreferrer">BnF 馆藏目录与年代 ↗</a> · <a href="${h(MarseilleData.source)}" target="_blank" rel="noopener noreferrer">查看整副馆藏 ↗</a></p>
        <details class="source-entry"><summary>文件核验与使用说明</summary><p>馆藏扫描：f${original.scan}；原始尺寸 ${original.width} × ${original.height} px。本站文件与来源 SHA-1、大小一致；哈希核验不等于版权或史料内容的学术认证。</p><p class="reference-identity">SHA-1：${h(original.sha1)}<br />图包版本：${h(MarseilleData.version)}<br />卡牌身份：${h(card.semanticId)}</p><p>Commons 标注 Public domain。BnF 对数字化图像另有来源署名及商业使用条款；这里不提供不受限制的商业授权保证。正式使用前请按用途核对。</p><a href="https://www.bnf.fr/fr/faire-une-utilisation-commerciale-dune-reproduction" target="_blank" rel="noopener noreferrer">BnF 数字图像使用条款 ↗</a></details>`;
    }
    const plate = D.reference(card); if (!plate) return "";
    const r = plate.reference;
    const zh = card.referenceVersion === WaiteZh.SOURCE_VERSION ? WaiteZh.get(card) : null;
    return `<p class="practice-help source-caution">${h(warning)}</p><p class="reference-credit">图版：Pamela Colman Smith · 黑白线描<br /><a href="${h(plate.source)}" target="_blank" rel="noopener noreferrer">此图版的来源与 Public domain 标注 ↗</a></p>
      <details class="source-entry"><summary>${h(r.section)} · 本牌英语条目（书页 ${h(r.page)}）</summary>
      ${r.description ? `<h4>图像描述 · Description</h4><p lang="en">${h(r.description)}</p>` : ""}
      <h4>占卜义 · Divinatory meanings</h4><p lang="en">${h(r.upright)}</p><h4>逆位 · Reversed</h4>${r.reversed ? `<p lang="en">${h(r.reversed)}</p>` : `<p>本节没有单列逆位。保持缺项，不推定为正位反义；另见下面 §4 的补充义。</p>`}
      <a href="${h(r.url)}" target="_blank" rel="noopener noreferrer">核对原书转录页 ↗</a></details>
      ${zh ? `<details class="source-entry translated-entry"><summary>中文对照译注 · 本站译稿</summary><p>对应以上占卜词条，保留原文异说、缺项及条件；不是本站现代建议，也不是全书或经学术审校的译本。图像描述段目前保留英语。</p><h4>正文 · 正位</h4><p>${h(zh.upright)}</p><h4>正文 · 逆位</h4><p>${h(zh.reversed || "本节未单列逆位；不得从别处补作本节原文。")}</p>${zh.additional ? `<h4>III §4 · 另列补充义</h4><p>${h(zh.additional)}</p>` : ""}<p class="practice-help">译注版本：${WaiteZh.VERSION} · 所据转录 ${WaiteZh.SOURCE_REVISION}。原文的诊病、伤亡、外貌与性别分类仅作史料；不据此判断现实人物。</p></details>` : ""}
      ${r.additional ? `<details class="source-entry"><summary>III §4 · 另列补充义，不与正文混合</summary><p>本节可能与前文有不同或相反的归属；这里保留差异和原文条件。</p><p lang="en">${h(r.additional.text)}</p><a href="${h(r.additional.url)}" target="_blank" rel="noopener noreferrer">核对补充义 · 书页 ${h(r.additional.page)} ↗</a></details>` : ""}
      <p class="practice-help reference-identity">卡牌身份：${h(card.semanticId)}<br />资料版本：${h(card.referenceVersion)}<br />这里只收录第三部分 §2 / §3 条目及另列的 §4，不将其称为 Waite 全部象征理论。数字转录仍可能存在排印或校录差异，可沿出处核对扫描。</p>`;
  }
  function updateLibrary() {
    const index = +$("reference-card").value, card = library[index];
    $("reference-image").src = `assets/cards/${card.file}`;
    $("reference-image").alt = `${card.name}，${D.profile(card.deckProfileId).label}，正位`;
    $("reference-caption").textContent = `${card.numeral} · ${card.name} / ${card.french}`;
    $("reference-content").innerHTML = content(card);
    $("reference-count").textContent = `${index + 1} / 78`;
    $("reference-prev").disabled = index === 0; $("reference-next").disabled = index === 77;
  }
  function selectLibrary() {
    const identity = library[+$("reference-card").value]?.semanticId, id = $("reference-deck").value;
    library = D.cards(CARDS, id).slice().sort((a,b) => {
      if (a.arcana === "major" && b.arcana === "major") return id === "waite-pkt" ? D.reference(a).number - D.reference(b).number : a.id - b.id;
      if (a.arcana !== b.arcana) return a.arcana === "major" ? -1 : 1;
      return a.deckIndex - b.deckIndex;
    });
    $("reference-intro").textContent = intros[id];
    $("reference-card").innerHTML = library.map((c,i) => `<option value="${i}">${h(c.numeral)} · ${h(c.name)} / ${h(c.french)}</option>`).join("");
    $("reference-card").value = String(Math.max(0, library.findIndex(c => c.semanticId === identity)));
  }
  function open() { updateLibrary(); $("reference-dialog").showModal(); }
  function showCard(card) {
    const node = $("card-historical-reference"); node.hidden = !D.imageInfo(card); node.innerHTML = content(card);
    $("card-detail-original").href = `assets/cards/${card.file}`;
  }
  function readingNote() {
    const rws = state.session?.deckProfileId === "waite-pkt";
    $("reading-layer-note").textContent = rws
      ? "当前牌面：Waite–Smith 书中黑白图版。下方基础释读是本站现代反思性整理。点击牌下“放大图像”，可查看英语原文与相应版本的中文对照译注；AI 提示词将历史词条和现代建议分开列出。"
      : state.session?.deckProfileId === "marseille-camoin"
        ? "当前牌面：Camoin 约1890—1900 年完整历史马赛牌 · 78 张。同一副实物原扫描；以下中文基础释读仍是本站现代整理，不是历史笔记译文。放大图像可核对逐牌出处。"
        : "当前牌面：马赛组合。以下中文基础释读为本站现代反思性整理，不是历史原文直译。";
  }
  $("source-library-open").addEventListener("click", open);
  $("reference-close").addEventListener("click", () => $("reference-dialog").close());
  $("reference-card").addEventListener("change", updateLibrary);
  $("reference-deck").addEventListener("change", () => { selectLibrary(); updateLibrary(); });
  ["prev", "next"].forEach(direction => $("reference-" + direction).addEventListener("click", () => {
    $("reference-card").value = String(+$("reference-card").value + (direction === "next" ? 1 : -1)); updateLibrary();
  }));
  $("inspect-significator").addEventListener("click", () => { const c = state.significator || selectedSignificatorCard(); if (c) showCard(c); });
  els.grid.addEventListener("click", event => { const b = event.target.closest("[data-magnify]"); if (b && +b.dataset.magnify < state.revealed) showCard(state.draws[+b.dataset.magnify].card); });
  selectLibrary();
  globalThis.SourcesUI = { readingNote };
})();
