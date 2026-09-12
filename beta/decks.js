/* Stable card identity is independent of a deck's printed number or language. */
(function (root, factory) {
  const local = typeof module === "object" && module.exports;
  const api = factory(local ? require("./waite-data.js") : root.WaiteData, local ? require("./marseille-data.js") : root.MarseilleData);
  if (typeof module === "object" && module.exports) module.exports = api; else root.TarotDecks = api;
})(globalThis, function (data, marseilleData) {
  "use strict";
  const DEFAULT = "marseille-composite";
  const majorIds = ["fool", "magician", "high-priestess", "empress", "emperor", "hierophant", "lovers", "chariot", "justice", "hermit", "wheel-of-fortune", "strength", "hanged-man", "death", "temperance", "devil", "tower", "star", "moon", "sun", "judgement", "world"];
  const suitIds = { coins: "pentacles", cups: "cups", swords: "swords", batons: "wands" };
  const courts = { page: "11", knight: "12", queen: "13", king: "14" };
  const numerals = ["0", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV", "XVI", "XVII", "XVIII", "XIX", "XX", "XXI"];
  const plates = new Map((data?.cards || []).map(c => [c.semanticId, c]));
  const marseille = new Map((marseilleData?.cards || []).map(c => [c.semanticId, c]));
  const profiles = Object.freeze([
    Object.freeze({ id: DEFAULT, version: "MYSTERIUM-MARSEILLE-1", referenceVersion: null, label: "马赛组合 · 78 张",
      description: "22 张 Jean Dodal 主牌＋56 张 BnF Conver 系小牌，来自两套历史素材，不冒充同一副古牌。中文释义是本站现代反思性整理。" }),
    Object.freeze({ id: "waite-pkt", version: "WAITE-PKT-PLATES-1", referenceVersion: "WAITE-PKT-REFERENCE-2", label: "Waite–Smith 书中黑白图版 · 78 张",
      description: "Pamela Colman Smith 绘制的完整 78 张书中黑白图版；文件出处标注《The Pictorial Key to the Tarot》(1911)，并非 1909 年彩色实牌扫描。英语资料取自 1922 再版的 Wikisource 转录；中文基础释读仍为本站现代整理，二者分别展示。" }),
    Object.freeze({ id: "marseille-camoin", version: "BNF-CAMOIN-MARSEILLE-1", referenceVersion: null, label: "Camoin 马赛完整牌 · 78 张",
      description: "同一副 BnF 馆藏历史马赛牌的完整 78 张原扫描；目录归属 [A. Camoin]、约 1890—1900 年，依 Conver 模式制作。不是 1760 年印本，也不是现代 Camoin/Jodorowsky 复刻。保留实物笔记、印章与磨损；中文释义仍为本站现代整理，不冒称该牌的历史说明。" })
  ]);
  const cache = new WeakMap();
  function profile(id = DEFAULT) {
    const p = profiles.find(p => p.id === id);
    if (!p) throw new Error("未知牌组版本，不能替换成其他牌组");
    if (p.id === "waite-pkt" && (plates.size !== 78 || data.version !== p.referenceVersion || data.imageVersion !== p.version)) throw new Error("Waite 图版资料未完整加载，请刷新后重试");
    if (p.id === "marseille-camoin" && (marseille.size !== 78 || marseilleData.version !== p.version)) throw new Error("Camoin 历史图包未完整加载，请刷新后重试");
    return p;
  }
  function semanticId(card) {
    if (card.arcana === "major") return majorIds[card.id];
    const [suit, rank] = String(card.id).split("-");
    return `${suitIds[suit]}-${courts[rank] || rank}`;
  }
  function cards(base, id = DEFAULT, referenceVersion = undefined) {
    const p = profile(id);
    const refVersion = referenceVersion === undefined ? p.referenceVersion : referenceVersion;
    if (id === "waite-pkt" && !["WAITE-PKT-REFERENCE-1", "WAITE-PKT-REFERENCE-2"].includes(refVersion)) throw new Error("未知原文资料版本");
    if (id !== "waite-pkt" && refVersion != null) throw new Error("马赛牌组不能冒用 Waite 原文版本");
    if (!cache.has(base)) cache.set(base, new Map());
    const cacheKey = `${id}:${refVersion}`;
    const saved = cache.get(base); if (saved.has(cacheKey)) return saved.get(cacheKey);
    const deck = base.map(card => {
      const identity = semanticId(card);
      if (!identity || identity.startsWith("undefined")) throw new Error("未知卡牌身份");
      if (id === DEFAULT) return Object.freeze({ ...card, semanticId: identity, deckProfileId: id });
      if (id === "marseille-camoin") {
        const original = marseille.get(identity); if (!original) throw new Error("历史原图缺失：" + identity);
        return Object.freeze({ ...card, semanticId: identity, deckProfileId: p.id, referenceVersion: null,
          file: `marseille-camoin/${original.file}`, numeral: card.arcana === "major" ? original.number || "—" : card.numeral });
      }
      const plate = plates.get(identity); if (!plate) throw new Error("图版缺失：" + identity);
      return Object.freeze({ ...card, semanticId: identity, deckProfileId: p.id, referenceVersion: refVersion,
        file: `waite-pkt/${plate.file}`, french: plate.reference.title,
        numeral: card.arcana === "major" ? numerals[plate.number] : card.numeral,
        name: card.arcana === "major" && card.id === 2 ? "女祭司" : card.suit === "coins" ? card.name.replace(/^钱币/, "星币") : card.name });
    });
    if (deck.length !== 78 || new Set(deck.map(c => c.semanticId)).size !== 78) throw new Error("牌组必须含 78 张不同身份的卡牌");
    Object.freeze(deck); saved.set(cacheKey, deck); return deck;
  }
  function reference(card) {
    if (card.deckProfileId !== "waite-pkt") return null;
    const plate = plates.get(semanticId(card));
    return card.referenceVersion === "WAITE-PKT-REFERENCE-1" && plate.legacyReference ? { ...plate, reference: plate.legacyReference } : plate;
  }
  function imageSource(card) {
    if (card.deckProfileId === "marseille-camoin") {
      const original = marseille.get(semanticId(card));
      if (!original) throw new Error("历史原图出处缺失");
      return `BNF-CAMOIN-MARSEILLE-1；Camoin 约1890—1900，Conver 模式；${original.credit}；${original.source}；原图 ${original.image}`;
    }
    const plate = reference(card); if (plate) return `${plate.source}；原图 ${plate.image}`;
    return card.arcana === "major" ? "DODAL-MAJORS；https://opengameart.org/content/tarot-cards-major-arcana（原组合牌库的22张主牌图包，CC0）" : "BNF-CONVER-MINORS；https://gallica.bnf.fr/ark:/12148/btv1b10539497f（Camoin，约1890—1900，Conver 式；本站旧图为处理后的素材）";
  }
  function recordProfile(record) {
    // 0.8 records without deck fields always refer to the original Marseille pack.
    const p = profile(record.deckProfileId === undefined ? DEFAULT : record.deckProfileId);
    if (record.deckVersion !== undefined && record.deckVersion !== p.version) throw new Error("牌组版本不符");
    if (p.id === "waite-pkt" && (record.deckVersion !== p.version || ![p.referenceVersion, "WAITE-PKT-REFERENCE-1"].includes(record.referenceVersion))) throw new Error("缺少配套图版或原文版本");
    if (p.id !== "waite-pkt" && record.referenceVersion != null) throw new Error("马赛记录不能冒用 Waite 原文版本");
    if (p.id === "marseille-camoin" && record.deckVersion !== p.version) throw new Error("缺少配套历史图包版本");
    return p.id === "waite-pkt" ? Object.freeze({ ...p, referenceVersion: record.referenceVersion }) : p;
  }
  function referenceText(card, reversed) {
    const plate = reference(card); if (!plate) return "";
    const r = plate.reference;
    return `Waite 英文资料（${r.section}，书页 ${r.page}，非中文基础释读）：${reversed ? r.reversed || "本节未单列逆位，不推定为正位的反义。" : r.upright}\n原文链接：${r.url}` +
      (r.additional ? `\n另列 ${r.additional.section} 补充义（可能与正文不同，不静默合并）：${r.additional.text}\n补充出处：${r.additional.url}` : "");
  }
  function imageInfo(card) { return card.deckProfileId === "marseille-camoin" ? marseille.get(semanticId(card)) || null : reference(card); }
  return Object.freeze({ DEFAULT, profiles, profile, recordProfile, cards, semanticId, reference, referenceText, imageSource, imageInfo });
});
