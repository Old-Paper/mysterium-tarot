/* Append-only reading events and after-reading notes. No persistence or network. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api; else root.ReadingJournal = api;
})(globalThis, function () {
  "use strict";
  const VERSION = "MYSTERIUM-JOURNAL-1";
  const RATINGS = Object.freeze(["符合", "部分符合", "不符合", "无法验证"]);
  const TYPES = new Set(["confirmed", "prepared", "observed", "interpreted", "ended", "cancelled", "failed"]);
  const time = () => new Date().toISOString();
  const clone = value => JSON.parse(JSON.stringify(value));
  function create(confirmedAt = time()) { return { version: VERSION, confirmedAt, events: [{ type: "confirmed", at: confirmedAt }], entries: [], fieldTimes: {} }; }
  function event(journal, type, detail = {}) {
    if (!TYPES.has(type)) throw new Error("未知阅读事件");
    if (journal.events.some(e => ["ended", "cancelled", "failed"].includes(e.type))) return;
    if (journal.events.some(e => e.type === type)) return;
    journal.events.push({ ...detail, type, at: time() });
  }
  function touch(journal, field) {
    const at = time(); journal.fieldTimes[field] = { createdAt: journal.fieldTimes[field]?.createdAt || at, updatedAt: at };
  }
  function append(journal, kind, text, rating = "") {
    if (!["background", "review"].includes(kind) || !text.trim() || text.length > 3000 || (kind === "review" && !RATINGS.includes(rating))) throw new Error("请填写补充事实；复盘需选择核验结果");
    if (journal.entries.length >= 100) throw new Error("本次已有 100 条补充记录，请先备份");
    const item = Object.freeze({ number: journal.entries.length + 1, kind, text: text.trim(), rating: kind === "review" ? rating : "", at: time() });
    journal.entries.push(item); return item;
  }
  function snapshot(journal, includePrivate) {
    if (!journal) return null;
    return clone({ ...journal, entries: includePrivate ? journal.entries : [], fieldTimes: includePrivate ? journal.fieldTimes : {} });
  }
  function validate(value, { includePrivate = true, createdAt, ended = false, cancelled = false } = {}) {
    if (value == null) return null; // Legacy record: never manufacture historical timestamps.
    const fail = () => { throw new Error("阅读日志或补充时间无效"); };
    const iso = v => typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v) && Number.isFinite(Date.parse(v));
    if (value.version !== VERSION || !iso(value.confirmedAt) || (createdAt && Date.parse(value.confirmedAt) < Date.parse(createdAt)) || !Array.isArray(value.events) || value.events.length > 12 || !Array.isArray(value.entries) || value.entries.length > 100) fail();
    const seen = new Set(); let last = Date.parse(value.confirmedAt), terminal = false, lastStep = -1;
    const steps = { confirmed: 0, prepared: 1, observed: 2, interpreted: 3, ended: 4, cancelled: 4, failed: 4 };
    for (const e of value.events) {
      if (!TYPES.has(e.type) || seen.has(e.type) || terminal || !iso(e.at) || Date.parse(e.at) < last || Object.keys(e).some(k => !["type", "at", "revealed"].includes(k)) || (e.revealed !== undefined && (!Number.isInteger(e.revealed) || e.revealed < 0 || e.revealed > 42))) fail();
      if (steps[e.type] <= lastStep || (["observed", "interpreted"].includes(e.type) && !seen.has(e.type === "observed" ? "prepared" : "observed"))) fail();
      seen.add(e.type); last = Date.parse(e.at); lastStep = steps[e.type]; terminal = ["ended", "cancelled", "failed"].includes(e.type);
    }
    if (value.events[0]?.type !== "confirmed" || value.events[0]?.at !== value.confirmedAt || (ended && !seen.has("ended") && !seen.has("cancelled")) || (cancelled && !seen.has("cancelled"))) fail();
    const entries = value.entries.map((e, i) => {
      if (e.number !== i + 1 || !["background", "review"].includes(e.kind) || typeof e.text !== "string" || !e.text.trim() || e.text.length > 3000 || !iso(e.at) || Date.parse(e.at) < Date.parse(value.confirmedAt) || (i && Date.parse(e.at) < Date.parse(value.entries[i - 1].at)) || (e.kind === "review" ? !RATINGS.includes(e.rating) : e.rating !== "")) fail();
      return { number: e.number, kind: e.kind, text: e.text, rating: e.rating, at: e.at };
    });
    const fields = value.fieldTimes;
    if (!fields || typeof fields !== "object" || Array.isArray(fields) || Object.keys(fields).length > 50) fail();
    for (const [k, v] of Object.entries(fields)) {
      if (!/^(observation-note|action-note|review-note|review-date|card-\d{1,2})$/.test(k) || !iso(v.createdAt) || !iso(v.updatedAt) || Date.parse(v.createdAt) < Date.parse(value.confirmedAt) || Date.parse(v.updatedAt) < Date.parse(v.createdAt)) fail();
    }
    if (!includePrivate && (entries.length || Object.keys(fields).length)) fail();
    return clone({ version: VERSION, confirmedAt: value.confirmedAt, events: value.events, entries, fieldTimes: fields });
  }
  function text(journal, privateNotes = true) {
    if (!journal) return "旧版记录未保存抽前确认及补充时间，不能事后补造。";
    const labels = { confirmed: "抽前确认", prepared: "洗切发牌计算完成", observed: "牌阵全部呈现", interpreted: "展开参考释读", ended: "结束阅读", cancelled: "作废阅读", failed: "操作失败" };
    return `抽前确认时间：${journal.confirmedAt}\n阅读视角：屏幕下方向上看牌；上下方向不随视图或横放改变。\n过程事件：${journal.events.map(e => `${labels[e.type]} ${e.at}`).join("；")}` +
      (privateNotes ? `\n抽后追加记录（不可倒改抽前意向）：\n${journal.entries.map(e => `${e.number}. ${e.kind === "background" ? "补充背景" : `复盘 · ${e.rating}`}，${e.at}：${e.text}`).join("\n") || "无"}\n笔记首次 / 最近修改时间：${JSON.stringify(journal.fieldTimes)}` : "");
  }
  return Object.freeze({ VERSION, RATINGS, create, event, touch, append, snapshot, validate, text });
});
