/* Pure card operations. Index 0 is the top of a face-down working deck.
 * Face-up packet arrays are also top-first. Orientation is independent of
 * visibility and table rotation. No question or card meaning enters this module. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.TarotEngine = api;
})(globalThis, function () {
  "use strict";
  const VERSION = "MYSTERIUM-ENGINE-4";
  const COUNTS_35 = [7, 6, 5, 4, 2, 11];
  const key = entry => `${(entry.card || entry).arcana}:${(entry.card || entry).id}`;
  function unique(deck, count = Array.isArray(deck) ? deck.length : -1) {
    if (!Array.isArray(deck) || deck.length !== count || new Set(deck.map(key)).size !== count) throw new Error("牌库张数或唯一性错误");
    return deck;
  }
  function randomInt(max) {
    if (!Number.isSafeInteger(max) || max < 1 || max > 0x100000000) throw new RangeError("随机上限无效");
    if (!globalThis.crypto?.getRandomValues) throw new Error("安全随机源不可用");
    const limit = Math.floor(0x100000000 / max) * max;
    const word = new Uint32Array(1);
    do { globalThis.crypto.getRandomValues(word); } while (word[0] >= limit);
    return word[0] % max;
  }
  function shuffle(deck, random = randomInt) {
    const copy = [...unique(deck)];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = random(i + 1);
      if (!Number.isInteger(j) || j < 0 || j > i) throw new Error("随机整数超出范围");
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }
  function cut(deck, index) {
    unique(deck);
    if (!Number.isInteger(index) || index < 1 || index >= deck.length) throw new RangeError("切点必须位于牌叠内部");
    return [...deck.slice(index), ...deck.slice(0, index)];
  }
  // Gilbert-Shannon-Reeds forward riffle: Binomial(n, 1/2) split,
  // then draw from each packet in proportion to its remaining size.
  // A finite number of riffles is NOT a uniform random permutation.
  function riffle(deck, random = randomInt) {
    unique(deck); let split = 0;
    const next = max => { const n = random(max); if (!Number.isInteger(n) || n < 0 || n >= max) throw new Error("随机整数超出范围"); return n; };
    for (let i = 0; i < deck.length; i++) split += next(2);
    const out = []; let left = 0, right = split;
    while (out.length < deck.length) {
      if (left === split) out.push(deck[right++]);
      else if (right === deck.length) out.push(deck[left++]);
      else if (next((split - left) + (deck.length - right)) < split - left) out.push(deck[left++]);
      else out.push(deck[right++]);
    }
    return out;
  }
  function wash(deck, model = "uniform", passes = 1, random = randomInt) {
    if (!["uniform", "riffle"].includes(model) || !Number.isInteger(passes) || passes < 1 || passes > 40) throw new Error("洗牌模型或次数无效");
    let result = [...deck];
    for (let i = 0; i < passes; i++) result = model === "riffle" ? riffle(result, random) : shuffle(result, random);
    return result;
  }
  function cutThree(deck, first, second, order = [2, 1, 0]) {
    unique(deck);
    if (!Number.isInteger(first) || !Number.isInteger(second) || first < 1 || second <= first || second >= deck.length || !Array.isArray(order) || order.some(n => !Number.isInteger(n)) || [...order].sort().join() !== "0,1,2") throw new Error("三叠切点或合叠次序无效");
    const packets = [deck.slice(0, first), deck.slice(first, second), deck.slice(second)];
    return order.flatMap(i => packets[i]);
  }
  function select(deck, indices, count) {
    unique(deck);
    if (!Array.isArray(indices) || indices.length !== count || new Set(indices).size !== count || indices.some(i => !Number.isInteger(i) || i < 0 || i >= deck.length)) throw new Error("盲选位置无效或重复");
    const chosen = new Set(indices);
    return { draws: indices.map(i => deck[i]), remaining: deck.filter((_, i) => !chosen.has(i)), trace: [] };
  }
  function rotatePacket(deck, count) {
    if (!Number.isInteger(count) || count < 1 || count >= deck.length) throw new RangeError("转叠数量必须小于牌库张数");
    return unique(deck).map((entry, index) => index < count ? { ...entry, reversed: !entry.reversed } : entry);
  }
  function initialize(cards, options = {}, random = randomInt) {
    unique(cards, 78);
    if (options.direction !== undefined && !["upright", "coin", "packet"].includes(options.direction)) throw new Error("未知方向初始化模型");
    const eligible = options.exclude ? cards.filter(card => key(card) !== options.exclude) : cards;
    if (options.exclude && eligible.length !== 77) throw new Error("代表牌不在牌库中");
    return eligible.map(card => {
      const coin = options.direction === "coin" ? random(2) : 0;
      if (coin !== 0 && coin !== 1) throw new Error("方向随机值超出范围");
      return { card: { ...card }, reversed: coin === 1 };
    });
  }
  function initialDeck(cards, session, random = randomInt) {
    if (session.spread.id === "waite-thirty-five") return unique(session.inheritedDeck, 35).map(d => ({ ...d }));
    if (session.directionModel === "retained") {
      const retained = unique(session.retainedDeck, 78);
      const map = new Map(cards.map(c => [key(c), c]));
      if (retained.some(d => !map.has(key(d)) || typeof d.reversed !== "boolean")) throw new Error("保留牌组的身份或方向无效");
      return retained.filter(d => session.spread.id !== "waite-celtic-1911" || key(d) !== session.waiteSignificatorKey).map(d => ({ card: map.get(key(d)), reversed: d.reversed }));
    }
    return initialize(cards, { exclude: session.spread.id === "waite-celtic-1911" ? session.waiteSignificatorKey : null, direction: session.directionModel || (session.reversalsEnabled ? "coin" : "upright") }, random);
  }
  function finalize42(deck, significatorKey, random = randomInt) {
    unique(deck, 78);
    // Consecutive face-up dealing makes the last dealt card the packet top.
    const six = Array.from({ length: 6 }, (_, i) => deck.slice(i * 7, i * 7 + 7).reverse());
    const seven = Array.from({ length: 7 }, (_, column) => six.map(packet => packet[column]).reverse());
    const first = shuffle(seven.map(packet => packet[0]), random);
    const middle = shuffle(seven.flatMap(packet => packet.slice(1, 3)), random);
    const last = shuffle(seven.flatMap(packet => packet.slice(3)), random);
    const beforeReplacement = [...first, ...middle, ...last];
    let draws = [...beforeReplacement];
    let remaining = deck.slice(42);
    let significator = null;
    let replacedPosition = null;
    let replacement = null;
    if (significatorKey) {
      const entry = deck.find(card => key(card) === significatorKey);
      if (!entry) throw new Error("人物牌不在本副牌中");
      significator = entry.card;
      const position = draws.findIndex(card => key(card) === significatorKey);
      if (position >= 0) {
        const pick = random(remaining.length);
        if (!Number.isInteger(pick) || pick < 0 || pick >= remaining.length) throw new Error("人物牌补位随机值超出范围");
        replacement = remaining[pick].card;
        draws[position] = remaining[pick];
        remaining = remaining.filter((_, i) => i !== pick);
        replacedPosition = position + 1;
      } else remaining = remaining.filter(card => key(card) !== significatorKey);
    }
    unique(draws, 42);
    unique([...draws, ...remaining, ...(significator ? [{ card: significator }] : [])], 78);
    return {
      draws, remaining, significator, replacedPosition, replacement,
      trace: [
        { label: "正面发成六叠，每叠七张（右侧第一叠；每叠左端为顶部）", groups: six, kind: "packets" },
        { label: "从右向左叠放，形成七叠，每叠六张", groups: seven, kind: "packets" },
        { label: "各取顶张，共七张；重洗并从右向左排第一行", groups: [first], kind: "rows" },
        { label: "各再取两张，共十四张；重洗排第二、三行", groups: [first, middle.slice(0, 7), middle.slice(7)], kind: "rows" },
        { label: "剩余二十一张重洗，排第四至六行", groups: Array.from({ length: 6 }, (_, i) => beforeReplacement.slice(i * 7, i * 7 + 7)), kind: "rows" },
        { label: significator ? "阵外安放人物牌；若原在阵内，从未发牌随机补位" : "不设人物牌（本站现代简化）", groups: Array.from({ length: 6 }, (_, i) => draws.slice(i * 7, i * 7 + 7)), kind: "rows" }
      ]
    };
  }
  function finalize35(deck) {
    unique(deck, 35);
    let offset = 0;
    // Explicit digital convention: packets are dealt face-up as in §8,
    // then dealt top-first into left-to-right rows (§9).
    const groups = COUNTS_35.map(count => {
      const group = deck.slice(offset, offset + count).reverse();
      offset += count;
      return group;
    });
    return { draws: groups.flat(), remaining: [], trace: [{ label: "剩余三十五张：按 7／6／5／4／2／11 张分叠，依叠顶发出并从左向右阅读", groups, kind: "rows35" }] };
  }
  function finish(deck, session, random = randomInt) {
    const id = session.spread.id;
    if (id === "full-forty-two") return finalize42(deck, session.significatorId !== null ? `major:${session.significatorId}` : null, random);
    if (id === "waite-thirty-five") return finalize35(deck);
    const n = session.positions.length;
    if (n > deck.length) throw new Error("剩余牌不足");
    if (session.drawMode === "fan") return select(deck, session.selectedIndices, n);
    return { draws: unique(deck.slice(0, n), n), remaining: deck.slice(n), trace: [] };
  }
  function run(cards, session, random = randomInt, manual = null) {
    const original = session.spread.id === "waite-celtic-1911";
    const continuation = session.spread.id === "waite-thirty-five";
    if (continuation && (!session.parentReadingId || !session.inheritedDeck)) throw new Error("三十五张法只能使用四十二张阅读剩余的牌");
    let deck;
    const log = manual ? [...manual.log] : [];
    let cuts = manual ? [...manual.cuts] : [];
    if (manual) deck = [...manual.deck];
    else {
      deck = initialDeck(cards, session, random);
      if (session.directionModel === "packet" && !continuation) {
        const count = random(deck.length - 1) + 1;
        deck = rotatePacket(deck, count);
        log.push({ type: "rotate", count, convention: "随机选择前叠数量，非原文指定比例" });
      }
      for (let round = 1; round <= (original ? 3 : 1); round++) {
        deck = wash(deck, session.shuffleModel || "uniform", session.shufflePasses || 1, random);
        const index = random(deck.length - 1) + 1;
        if (session.cutMode === "three-packet") {
          if (original || continuation || session.spread.id === "full-forty-two") throw new Error("文献模式不混入现代三叠变式");
          const first = Math.min(index, deck.length - 2), second = first + 1 + random(deck.length - first - 1);
          deck = cutThree(deck, first, second, session.packetOrder || [2, 1, 0]);
          log.push({ type: "shuffle", round, model: session.shuffleModel || "uniform", passes: session.shufflePasses || 1 }, { type: "cut-three", round, first, second, order: session.packetOrder || [2, 1, 0] });
          cuts.push(first); continue;
        }
        deck = cut(deck, index);
        cuts.push(index);
        log.push({ type: "shuffle", round, model: session.shuffleModel || "uniform", passes: session.shufflePasses || 1 }, { type: "cut", round, index });
      }
    }
    unique(deck, continuation ? 35 : original ? 77 : 78);
    const eligible = continuation ? unique(session.inheritedDeck, 35) : cards.filter(c => !original || key(c) !== session.waiteSignificatorKey);
    const keys = new Set(eligible.map(key));
    if (deck.some(d => !keys.has(key(d)) || typeof d.reversed !== "boolean")) throw new Error("工作牌库出现不合资格的牌或方向");
    if (continuation) {
      const directions = new Map(eligible.map(d => [key(d), d.reversed]));
      if (deck.some(d => directions.get(key(d)) !== d.reversed)) throw new Error("续读必须保留余牌方向");
    }
    if (cuts.length !== (original ? 3 : 1) || cuts.some(n => !Number.isInteger(n) || n < 1 || n >= deck.length)) throw new Error("洗切轮数或切点不符合方法");
    if (session.drawMode === "fan" && ["waite-celtic-1911", "full-forty-two", "waite-thirty-five"].includes(session.spread.id)) throw new Error("文献方法固定从牌顶发牌，不支持盲选变式");
    if (session.drawMode === "fan" && !session.selectedIndices) return { selecting: true, deck, cuts, log };
    const result = finish(deck, session, random);
    if (session.drawMode === "fan") log.push({ type: "select", indices: [...session.selectedIndices] });
    log.push({ type: "deal", method: session.spread.id, count: result.draws.length });
    if (result.replacedPosition) log.push({ type: "replace-significator", position: result.replacedPosition, replacement: key(result.replacement) });
    return { ...result, deck, cuts, log };
  }
  return Object.freeze({ VERSION, COUNTS_35, key, unique, randomInt, shuffle, riffle, wash, cut, cutThree, select, rotatePacket, initialize, initialDeck, finalize42, finalize35, finish, run });
});
