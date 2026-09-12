/* Text-only segmentation. No external AI service, credential or HTTP request. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else { root.PromptTools = api; api.install(); }
})(globalThis, function () {
  "use strict";
  function parts(prompt) {
    const end = prompt.indexOf("</抽牌记录>");
    const matches = [...prompt.matchAll(/^(\d+)\. [^\n]*｜[^\n]*\n   抽到：[^\n]*/gm)];
    if (end < 0 || !matches.length) throw new Error("找不到完整的牌阵记录，不能分段");
    const cards = matches.map((m, i) => ({ number: +m[1], title: m[0], body: prompt.slice(m.index, matches[i + 1]?.index ?? end) }));
    if (cards.some((c, i) => c.number !== i + 1)) throw new Error("牌号缺失或重复，请重新生成提示词");
    return { header: prompt.slice(0, matches[0].index), cards, tail: prompt.slice(end) };
  }
  function segment(prompt, row, readingId) {
    const p = parts(prompt);
    if (p.cards.length !== 42 || !Number.isInteger(row) || row < 0 || row > 5) throw new Error("分行导出只适用于完整42张牌阵");
    const first = row * 7 + 1, last = first + 6;
    return `${p.header}\n全阵卡牌索引（不代替其余各段资料）：\n${p.cards.map(c => c.title.replace("\n   ", " ")).join("\n")}\n\n本段完整条目：\n${p.cards.slice(first - 1, last).map(c => c.body).join("")}${p.tail}\n\n<分段任务>\n阅读 ID：${readingId}\n第 ${row + 1} / 6 段，全局牌号 ${first}—${last}。上文“覆盖全部42张”的要求由六段共同完成；本段仅逐牌详读这7张，其余牌只作索引参照，不臆补其条目。每项结论引用全局牌号。段末列出已覆盖 ${first}—${last}、未详读的其余牌号，检查遗漏与重复，并等待下一段；第6段只有在前5段都提供后才作完整综合。\n</分段任务>`;
  }
  function inspect(record) {
    record = record && typeof record === "object" ? record : {};
    const errors = [], warnings = [], draws = Array.isArray(record.draws) ? record.draws : [];
    if (!draws.length) errors.push("缺少牌阵");
    if (draws.some(d => !d || typeof d.key !== "string")) return { errors: [...errors, "卡牌身份格式无效"], warnings };
    if (new Set(draws.map(d => d.key)).size !== draws.length) errors.push("卡牌身份重复");
    if (draws.some(d => typeof d.reversed !== "boolean")) errors.push("正逆位格式冲突");
    if (record.directionModel === "upright" && draws.some(d => d.reversed)) errors.push("全正位模型出现逆位");
    if (record.spreadId === "full-forty-two" && draws.length !== 42) errors.push("42张记录缺牌");
    if (typeof record.question !== "string" || !record.question.trim()) warnings.push("意向尚未提供，不能猜测问题");
    if (record.spreadId === "choice" && (!record.intent?.optionA || !record.intent?.optionB)) warnings.push("A/B未提供，AI无法知道心中定义");
    const userText = [record.question, ...Object.values(record.intent || {}), record.notes?.observation, record.notes?.review, ...(record.journal?.entries || []).map(e => e.text)].filter(v => typeof v === "string").join("\n");
    if (/[<>]|忽略.*规则|system\s*:/i.test(userText)) warnings.push("用户资料含类似指令的内容，仍须仅按资料处理；自然语言约束不是注入防护保证");
    if (/诊断|疾病|怀孕|停药|手术|投资|股票|贷款|诉讼|判刑|医疗|自杀/.test(userText)) warnings.push("涉及医疗、财务、法律或安全事项：不据牌阵作诊断、投资判断或确定性结论，请核实现实证据");
    warnings.push("纯文本未附图，不等于已经视觉核验", "本地结构检查不能证明外部AI的回答正确");
    return { errors, warnings };
  }
  function install() {
    const $ = id => document.getElementById(id);
    $("prompt-preview").closest("label").insertAdjacentHTML("beforebegin", '<label id="prompt-segment-row" hidden>复制范围<select id="prompt-segment"><option value="all">完整42张</option>' + Array.from({ length: 6 }, (_, i) => `<option value="${i}">第${i + 1}行 · 全局牌号${i * 7 + 1}—${i * 7 + 7}</option>`).join("") + '</select></label><p id="prompt-validation" class="practice-help"></p>');
    let full = "";
    const reset = prompt => {
      full = prompt; $("prompt-segment").value = "all";
      $("prompt-segment-row").hidden = state.session?.draws.length !== 42;
      const checks = inspect(Practice.snapshot(true));
      $("prompt-validation").textContent = "结构核验：" + (checks.errors.join("；") || `${state.draws.length} 张，未发现身份或方向冲突。`) + " " + checks.warnings.join("；");
    };
    $("prompt-segment").addEventListener("change", () => {
      try {
        $("prompt-preview").value = $("prompt-segment").value === "all" ? full : segment(full, Number($("prompt-segment").value), state.session.id);
        $("prompt-status").textContent = "已从原始提示词切换范围；预览中的手动修改不会自动带到其他段，发送前请逐段检查隐私。";
      } catch (e) { showToast(e.message); }
    });
    globalThis.PromptExport = { reset };
  }
  return Object.freeze({ parts, segment, inspect, install });
});
