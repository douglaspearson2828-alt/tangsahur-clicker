import {
  GAME_VERSION,
  LUMP_MATURE_MS,
  LUMP_RIPE_MS,
  LUMP_OVERRIPE_MS,
  BUILDINGS,
  BUILDING_MAP,
  UPGRADES,
  UPGRADE_MAP,
  HEAVENLY_UPGRADES,
  HEAVENLY_UPGRADE_MAP,
  ACHIEVEMENTS,
  ACHIEVEMENT_MAP,
  MILK_TIERS,
  NEWS_HEADLINES,
} from './data.js';

const SHORT_SCALE_SUFFIXES = [
  '', // 10^0
  '', // 10^3 (below 1e6 stays exact integer)
  'million',
  'billion',
  'trillion',
  'quadrillion',
  'quintillion',
  'sextillion',
  'septillion',
  'octillion',
  'nonillion',
  'decillion',
  'undecillion',
  'duodecillion',
  'tredecillion',
  'quattuordecillion',
  'quindecillion',
  'sexdecillion',
  'septendecillion',
  'octodecillion',
  'novemdecillion',
  'vigintillion',
];

let goldenCounter = 0;

function sanitizeBakeryName(name) {
  const cleaned = String(name ?? '')
    .replace(/[\r\n\t<>]/g, '')
    .trim()
    .slice(0, 32);
  return cleaned || 'Tung Tung Sahur';
}

function finiteNonNeg(val, fallback = 0) {
  const num = Number(val);
  if (!Number.isFinite(num) || num < 0) return fallback;
  return num;
}

function finiteInt(val, fallback = 0) {
  const num = Number(val);
  if (!Number.isFinite(num) || num < 0) return fallback;
  return Math.floor(num);
}

function hasUpgrade(state, id) {
  return Array.isArray(state?.upgrades) && state.upgrades.includes(id);
}

function hasHeavenly(state, id) {
  return Array.isArray(state?.heavenlyUpgrades) && state.heavenlyUpgrades.includes(id);
}

/**
 * Formats numbers faithfully to Cookie Clicker:
 * - Exact comma-separated integers below 1e6 (with optional decimals for small CpS)
 * - "1.234 million" .. "vigintillion" above 1e6 when shortNumbers = true
 * - Never returns NaN
 */
export function formatNumber(n, shortNumbers = true, decimals = 0) {
  const num = Number(n);
  if (Number.isNaN(num)) return '0';
  if (!Number.isFinite(num)) return num > 0 ? 'Infinity' : '-Infinity';
  if (num === 0) return '0';

  const sign = num < 0 ? '-' : '';
  const abs = Math.abs(num);

  if (abs < 1e6) {
    if (decimals > 0 && abs < 1000) {
      const fixed = abs.toFixed(Math.min(4, decimals)).replace(/\.0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1');
      return sign + fixed;
    }
    if (decimals === 0 && abs > 0 && abs < 1) {
      const rounded1 = Number(abs.toFixed(1));
      if (rounded1 > 0 && rounded1 < 1) {
        return sign + String(rounded1);
      }
    }
    const whole = Math.floor(abs + 1e-9);
    return sign + whole.toLocaleString('en-US');
  }

  if (!shortNumbers) {
    if (abs < 1e21) {
      return sign + Math.floor(abs + 1e-9).toLocaleString('en-US');
    }
    return sign + abs.toExponential(3);
  }

  let tier = Math.floor(Math.log10(abs) / 3);
  let scaled = abs / Math.pow(10, tier * 3);
  if (Math.round(scaled * 1000) >= 1000000) {
    tier += 1;
    scaled = abs / Math.pow(10, tier * 3);
  }

  if (tier < SHORT_SCALE_SUFFIXES.length && SHORT_SCALE_SUFFIXES[tier]) {
    const formatted = scaled.toFixed(3).replace(/\.0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1');
    return `${sign}${formatted} ${SHORT_SCALE_SUFFIXES[tier]}`;
  }

  return sign + abs.toExponential(3);
}

/**
 * Convenience formatter for TpS / rates where sub-1000 values show 1 decimal place.
 */
export function formatCps(n, shortNumbers = true) {
  return formatNumber(n, shortNumbers, 1);
}

/**
 * Formats duration in seconds to readable string like "42s", "3m 15s", "2h 5m 10s", "1d 4h 12m".
 */
export function formatTime(seconds) {
  const num = Number(seconds);
  if (!Number.isFinite(num) || num <= 0) return '0s';
  const total = Math.floor(num);
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;

  if (days > 0) {
    return `${days}d ${hours}h ${mins}m`;
  }
  if (hours > 0) {
    return `${hours}h ${mins}m ${secs}s`;
  }
  if (mins > 0) {
    return `${mins}m ${secs}s`;
  }
  return `${secs}s`;
}

/**
 * Creates a fresh initial state object.
 */
export function createInitialState(bakeryName = 'Tung Tung Sahur', nowMs = Date.now()) {
  const safeNow = Number.isFinite(Number(nowMs)) ? Number(nowMs) : Date.now();
  const buildings = {};
  for (const b of BUILDINGS) {
    buildings[b.id] = {
      owned: 0,
      level: 0,
      totalProduced: 0,
      muted: false,
    };
  }

  const goldens = [];

  return {
    version: GAME_VERSION,
    bakeryName: sanitizeBakeryName(bakeryName),
    bakeryRenamed: false,
    tangsahurs: 0,
    totalBakedRun: 0,
    totalBakedAllTime: 0,
    clickedTangsahurs: 0,
    totalClicks: 0,
    runStartMs: safeNow,
    lastSavedMs: safeNow,
    lastTickMs: safeNow,
    _simNowMs: safeNow,
    buildings,
    buildingsSold: 0,
    upgrades: [],
    achievements: [],
    goldenClicks: 0,
    goldenSpawned: 0,
    goldens,
    activeGoldens: goldens,
    nextGoldenMs: safeNow + 150000,
    buffs: [],
    prestigeLevel: 0,
    heavenlyChips: 0,
    heavenlyChipsSpent: 0,
    heavenlyUpgrades: [],
    ascensions: 0,
    isAscending: false,
    ascended: false,
    lumps: 0,
    lumpsHarvested: 0,
    lumpStartMs: safeNow,
    lumpStartedAtMs: safeNow,
    newsClicks: 0,
    clickTimestamps: [],
    uncannyClickEarned: false,
    justPlainLuckyEarned: false,
    settings: {
      sound: true,
      volume: 0.7,
      shortNumbers: true,
      particles: true,
      fancy: true,
    },
  };
}

/**
 * Single next building price: ceil(baseCost * 1.15^owned).
 */
export function getBuildingCost(buildingId, owned) {
  const b = BUILDING_MAP[buildingId];
  if (!b) return Infinity;
  const n = finiteInt(owned, 0);
  const price = Math.ceil(b.baseCost * Math.pow(1.15, n));
  return Number.isFinite(price) ? price : Infinity;
}

/**
 * Exact sum of `count` consecutive building prices starting from `owned`.
 */
export function getBuildingBulkCost(buildingId, owned, count) {
  const b = BUILDING_MAP[buildingId];
  if (!b) return Infinity;
  const start = finiteInt(owned, 0);
  const n = finiteInt(count, 0);
  if (n <= 0) return 0;

  let total = 0;
  for (let i = 0; i < n; i++) {
    const next = getBuildingCost(buildingId, start + i);
    if (!Number.isFinite(next)) return Infinity;
    total += next;
    if (!Number.isFinite(total)) return Infinity;
  }
  return total;
}

/**
 * Exact max buildings affordable with `tangsahurs` starting at `owned`.
 */
export function getMaxAffordable(buildingId, owned, tangsahurs) {
  const b = BUILDING_MAP[buildingId];
  const bank = finiteNonNeg(tangsahurs, 0);
  if (!b || bank <= 0) return { count: 0, cost: 0 };

  const start = finiteInt(owned, 0);
  let count = 0;
  let cost = 0;
  while (count < 10000) {
    const next = getBuildingCost(buildingId, start + count);
    if (!Number.isFinite(next) || cost + next > bank) break;
    cost += next;
    count += 1;
  }
  return { count, cost };
}

/**
 * Exact 25% sell refund of the purchase prices of the last `count` buildings.
 * Strictly <= purchase price (zero infinite-money exploit).
 */
export function getBuildingSellRefund(buildingId, owned, count = 1) {
  const b = BUILDING_MAP[buildingId];
  if (!b) return 0;
  const cur = finiteInt(owned, 0);
  const n = Math.min(cur, finiteInt(count, 1));
  if (n <= 0) return 0;

  let refund = 0;
  for (let i = 1; i <= n; i++) {
    const paid = getBuildingCost(buildingId, cur - i);
    if (!Number.isFinite(paid)) continue;
    refund += Math.floor(paid * 0.25);
  }
  return Number.isFinite(refund) ? refund : 0;
}

/**
 * Computes Sahur Lump growth status.
 */
export function getLumpStatus(state, nowMs = Date.now()) {
  const speedMult = hasHeavenly(state, 'divine_lump') ? 0.8 : 1;
  const matureMs = Math.round(LUMP_MATURE_MS * speedMult);
  const ripeMs = Math.round(LUMP_RIPE_MS * speedMult);
  const overripeMs = Math.round(LUMP_OVERRIPE_MS * speedMult);
  const rawStart = state?.lumpStartMs ?? state?.lumpStartedAtMs;
  const startedAt = Number.isFinite(rawStart) ? rawStart : nowMs;
  const ageMs = Math.max(0, nowMs - startedAt);

  let stage = 'growing';
  if (ageMs >= ripeMs) stage = 'ripe';
  else if (ageMs >= matureMs) stage = 'mature';

  const progressPct = Math.min(100, (ageMs / ripeMs) * 100);
  const remainingSec = Math.max(0, (matureMs - ageMs) / 1000);
  const ripeRemainingSec = Math.max(0, (ripeMs - ageMs) / 1000);

  return {
    ageMs,
    matureMs,
    ripeMs,
    overripeMs,
    stage,
    progressPct,
    remainingSec,
    ripeRemainingSec,
  };
}

function getGoldenRates(state) {
  let freqMult = 1;
  let durMult = 1;
  let buffDurMult = 1;

  if (hasUpgrade(state, 'lucky_day')) {
    freqMult *= 2;
    durMult *= 2;
  }
  if (hasUpgrade(state, 'serendipity')) {
    freqMult *= 2;
    durMult *= 2;
  }
  if (hasUpgrade(state, 'get_lucky')) {
    buffDurMult *= 2;
  }
  if (hasHeavenly(state, 'heavenly_luck')) {
    freqMult *= 1.1;
  }
  if (hasHeavenly(state, 'golden_drumstick')) {
    freqMult *= 1.25;
  }
  if (hasHeavenly(state, 'lasting_memory')) {
    buffDurMult *= 1.15;
  }
  if (hasHeavenly(state, 'tin_martabak')) {
    buffDurMult *= 1.1;
  }

  return { freqMult, durMult, buffDurMult };
}

/**
 * Pure derived state calculation (CpS, click power, milk, upgrades, achievements, prestige, buffs).
 */
export function computeDerived(state, explicitNowMs) {
  const safeState = state || createInitialState();
  const nowMs =
    explicitNowMs !== undefined && Number.isFinite(Number(explicitNowMs))
      ? Number(explicitNowMs)
      : (Number.isFinite(safeState._simNowMs) ? safeState._simNowMs : (Number.isFinite(safeState.lastTickMs) ? safeState.lastTickMs : Date.now()));

  const activeBuffs = (Array.isArray(safeState.buffs) ? safeState.buffs : []).filter(
    (b) => {
      if (!b) return false;
      const end = b.endsAtMs ?? b.expiresAtMs;
      return Number.isFinite(end) && end > nowMs;
    }
  );

  // Achievements & Milk
  const achIds = new Set(Array.isArray(safeState.achievements) ? safeState.achievements : []);
  const unlockedAchievements = ACHIEVEMENTS.filter((a) => achIds.has(a.id));
  const nonShadowUnlocked = unlockedAchievements.filter((a) => !a.shadow);
  const achievementCount = nonShadowUnlocked.length;
  const totalNonShadowAchievements = ACHIEVEMENTS.filter((a) => !a.shadow).length;
  const milkProgress = achievementCount / 25;

  let milkTier = MILK_TIERS[0];
  for (const tier of MILK_TIERS) {
    if (milkProgress >= tier.minMilk) {
      milkTier = tier;
    }
  }

  // Prestige
  const allTime = finiteNonNeg(safeState.totalBakedAllTime, 0);
  const prestigeLevel = finiteInt(safeState.prestigeLevel, 0);
  const prestigePotential = Math.floor(Math.cbrt(allTime / 1e12));
  const prestigeGainOnAscend = Math.max(0, prestigePotential - prestigeLevel);
  const prestigeChipFactor = hasHeavenly(safeState, 'eternal_echo') ? 1.25 : 1;
  const prestigeBonusPct = prestigeLevel * prestigeChipFactor;

  // Distinct owned building types (for Synergy Vol. I)
  const distinctOwnedTypes = BUILDINGS.reduce(
    (acc, b) => acc + ((safeState.buildings?.[b.id]?.owned ?? 0) > 0 ? 1 : 0),
    0
  );

  // Purchased upgrades
  const upgSet = new Set(Array.isArray(safeState.upgrades) ? safeState.upgrades : []);
  const purchasedUpgrades = UPGRADES.filter((u) => upgSet.has(u.id));

  // Global multipliers
  let globalPctMult = 1;
  let flatPerNonCursor = 0;
  let kentonganClickMult = 1;
  let mouseTpsPct = 0;
  const kittenBoost = hasHeavenly(safeState, 'kitten_angels') ? 1.1 : 1;
  let kittenMult = 1;

  for (const u of purchasedUpgrades) {
    const eff = u.effect;
    if (!eff) continue;
    if (eff.type === 'global_pct') {
      globalPctMult *= 1 + eff.pct / 100;
    } else if (eff.type === 'grandma_and_global') {
      globalPctMult *= 1 + eff.pct / 100;
    } else if (eff.type === 'grandma_awakening') {
      globalPctMult *= 1 + eff.pct / 100;
    } else if (eff.type === 'cursor_flat') {
      flatPerNonCursor = Math.max(flatPerNonCursor, eff.perNonCursor);
    } else if (eff.type === 'kentongan_mult') {
      kentonganClickMult *= eff.mult;
    } else if (eff.type === 'click_tps_pct') {
      mouseTpsPct += eff.tpsPct;
    } else if (eff.type === 'kitten_milk') {
      kittenMult *= 1 + milkProgress * eff.factor * kittenBoost;
    }
  }

  let heavenlyMult = 1;
  if (hasHeavenly(safeState, 'legacy')) heavenlyMult *= 1.1;
  if (hasHeavenly(safeState, 'heavenly_drums')) heavenlyMult *= 1.15;
  if (hasHeavenly(safeState, 'drum_aura')) heavenlyMult *= 1.1;
  if (hasHeavenly(safeState, 'synergy_1')) heavenlyMult *= 1.05 + 0.005 * distinctOwnedTypes;
  if (hasHeavenly(safeState, 'synergy_2')) heavenlyMult *= 1.1;
  if (hasHeavenly(safeState, 'tin_ketupat')) heavenlyMult *= 1.1;
  if (hasHeavenly(safeState, 'tin_dates')) heavenlyMult *= 1.15;
  if (hasHeavenly(safeState, 'tin_kolak')) heavenlyMult *= 1.2;
  if (hasHeavenly(safeState, 'tin_nastar')) heavenlyMult *= 1.25;
  if (hasHeavenly(safeState, 'tin_martabak')) heavenlyMult *= 1.1;
  if (hasHeavenly(safeState, 'eternal_echo')) heavenlyMult *= 1.5;

  const prestigeMult = 1 + prestigeBonusPct / 100;
  const totalGlobalMult = globalPctMult * kittenMult * prestigeMult * heavenlyMult;

  // Buff multipliers
  let activeCpsBuffMult = 1;
  let activeClickBuffMult = 1;
  for (const buff of activeBuffs) {
    const m = Number.isFinite(buff.mult) && buff.mult > 0 ? buff.mult : 1;
    if (buff.target === 'click') {
      activeClickBuffMult *= m;
    } else {
      activeCpsBuffMult *= m;
    }
  }

  // Non-cursor count for Thousand Taps etc.
  let nonCursorBuildings = 0;
  for (const b of BUILDINGS) {
    if (b.id !== 'kentongan') {
      nonCursorBuildings += finiteInt(safeState.buildings?.[b.id]?.owned, 0);
    }
  }
  const flatTapBonus = flatPerNonCursor * nonCursorBuildings;
  const grandmaOwned = finiteInt(safeState.buildings?.grandma?.owned, 0);

  // Per-building CpS
  const buildingStats = {};
  let rawCps = 0;
  let cps = 0;

  for (const b of BUILDINGS) {
    const bs = safeState.buildings?.[b.id] || {};
    const owned = finiteInt(bs.owned, 0);
    const level = finiteInt(bs.level, 0);
    const muted = Boolean(bs.muted);
    const totalProduced = finiteNonNeg(bs.totalProduced, 0);
    const levelMult = 1 + 0.01 * level;

    let bMult = 1;
    for (const u of purchasedUpgrades) {
      const eff = u.effect;
      if (!eff) continue;
      if (eff.type === 'building_mult' && eff.buildingId === b.id) {
        bMult *= eff.mult;
      } else if (eff.type === 'kentongan_mult' && b.id === 'kentongan') {
        bMult *= eff.mult;
      } else if (eff.type === 'grandma_synergy') {
        if (b.id === 'grandma') {
          bMult *= 2;
        } else if (eff.buildingId === b.id) {
          bMult *= 1 + (0.01 * grandmaOwned) / eff.step;
        }
      } else if (eff.type === 'grandma_and_global' && b.id === 'grandma') {
        bMult *= eff.buildingMult;
      }
    }

    let unitBase = b.baseCps;
    if (b.id === 'grandma' && hasUpgrade(safeState, 'awakened_tung_pacts')) {
      unitBase += 0.02 * grandmaOwned;
    }

    const rawCpsEach =
      (unitBase * bMult + (b.id === 'kentongan' ? flatTapBonus : 0)) *
      levelMult *
      totalGlobalMult;
    const rawCpsTotal = rawCpsEach * owned;
    const cpsEach = rawCpsEach * activeCpsBuffMult;
    const cpsTotal = rawCpsTotal * activeCpsBuffMult;

    rawCps += rawCpsTotal;
    cps += cpsTotal;

    buildingStats[b.id] = {
      id: b.id,
      name: b.name,
      owned,
      level,
      muted,
      cost: getBuildingCost(b.id, owned),
      nextCost: getBuildingCost(b.id, owned),
      rawEachCps: rawCpsEach,
      rawTotalCps: rawCpsTotal,
      rawCpsEach,
      rawCpsTotal,
      eachCps: cpsEach,
      totalCps: cpsTotal,
      cpsEach,
      cpsTotal,
      sharePct: 0,
      totalProduced,
    };
  }

  for (const b of BUILDINGS) {
    buildingStats[b.id].sharePct = rawCps > 0 ? (buildingStats[b.id].rawCpsTotal / rawCps) * 100 : 0;
  }

  // Click Power
  const baseClick = 1 * kentonganClickMult + flatTapBonus;
  let heavenlyClickMult = 1;
  if (hasHeavenly(safeState, 'drum_aura')) heavenlyClickMult *= 1.1;
  if (hasHeavenly(safeState, 'synergy_2')) heavenlyClickMult *= 1.1;
  if (hasHeavenly(safeState, 'tin_kolak')) heavenlyClickMult *= 1.15;
  if (hasHeavenly(safeState, 'golden_drumstick')) heavenlyClickMult *= 1.2;

  const rawClickPower = (baseClick + rawCps * mouseTpsPct) * heavenlyClickMult;
  const clickPower = (baseClick + cps * mouseTpsPct) * heavenlyClickMult * activeClickBuffMult;

  const prelimDerived = {
    cps,
    rawCps,
    clickPower,
    rawClickPower,
    milkProgress,
    achievementCount,
    activeBuffs,
  };

  const availableUpgrades = UPGRADES.filter(
    (u) => !upgSet.has(u.id) && u.unlock(safeState, prelimDerived)
  ).sort((a, b) => a.price - b.price || a.order - b.order);

  const nextGoldenEtaSec = Number.isFinite(safeState.nextGoldenMs)
    ? Math.max(0, (safeState.nextGoldenMs - nowMs) / 1000)
    : 0;

  const lumpStatus = getLumpStatus(safeState, nowMs);
  const nextChipAt = Math.pow(prestigePotential + 1, 3) * 1e12;
  const totalOwnedCount = BUILDINGS.reduce(
    (acc, b) => acc + finiteInt(safeState.buildings?.[b.id]?.owned, 0),
    0
  );
  const lumpsUnlocked = Boolean(safeState.lumpsUnlocked || totalOwnedCount > 0 || allTime >= 1e6);

  return {
    cps,
    rawCps,
    clickPower,
    rawClickPower,
    buildingStats,
    milkProgress,
    milkTier,
    availableUpgrades,
    purchasedUpgrades,
    unlockedAchievements,
    achievementCount,
    shadowAchievementCount: unlockedAchievements.length - achievementCount,
    totalUnlockedAchievements: unlockedAchievements.length,
    totalNonShadowAchievements,
    prestigePotential,
    prestigeGainOnAscend,
    prestigeBonusPct,
    nextChipAt,
    lumpsUnlocked,
    activeBuffs,
    nextGoldenEtaSec,
    lumpStatus,
  };
}

/**
 * Evaluates and grants any newly earned achievements.
 */
export function checkAchievements(state, nowMs) {
  if (!state) return [];
  if (!Array.isArray(state.achievements)) state.achievements = [];
  const ownedSet = new Set(state.achievements);
  const derived = computeDerived(state, nowMs);
  const newlyUnlocked = [];

  for (const ach of ACHIEVEMENTS) {
    if (ownedSet.has(ach.id)) continue;
    try {
      if (ach.check(state, derived)) {
        state.achievements.push(ach.id);
        ownedSet.add(ach.id);
        newlyUnlocked.push(ach);
      }
    } catch {
      // Ignore predicate safety errors
    }
  }
  return newlyUnlocked;
}

function nextGoldenDelayMs(state) {
  const { freqMult } = getGoldenRates(state);
  const baseMs = (120 + Math.random() * 120) * 1000; // 2 to 4 minutes
  return Math.max(15000, Math.round(baseMs / freqMult));
}

function ensureGoldenArray(state) {
  if (!Array.isArray(state.goldens)) {
    state.goldens = Array.isArray(state.activeGoldens) ? state.activeGoldens : [];
  }
  state.activeGoldens = state.goldens;
  return state.goldens;
}

/**
 * Spawns a Golden Tangsahur token at a safe viewport position.
 */
export function spawnGolden(state, nowMs = Date.now(), forceKind) {
  const safeNow = Number.isFinite(Number(nowMs)) ? Number(nowMs) : Date.now();
  state._simNowMs = safeNow;
  const goldens = ensureGoldenArray(state);

  const { durMult } = getGoldenRates(state);
  const hasAnyBuilding = BUILDINGS.some((b) => (state.buildings?.[b.id]?.owned ?? 0) > 0);

  let kind = forceKind;
  if (!kind) {
    const roll = Math.random();
    if (roll < 0.36) kind = 'frenzy';
    else if (roll < 0.68) kind = 'lucky';
    else if (roll < 0.82) kind = 'click_frenzy';
    else if (roll < 0.94 && hasAnyBuilding) kind = 'building_special';
    else kind = 'sahur_storm';
  }
  if (kind === 'building_special' && !hasAnyBuilding) {
    kind = 'frenzy';
  }

  const isStormDrop = kind === 'storm_drop';
  const durationMs = isStormDrop ? 7000 : Math.round(13000 * durMult);

  const labelMap = {
    frenzy: 'Golden Tangsahur',
    click_frenzy: 'Golden Tangsahur',
    lucky: 'Golden Tangsahur',
    building_special: 'Golden Tangsahur',
    sahur_storm: 'Golden Tangsahur',
    storm_drop: 'Storm Tangsahur',
  };

  const golden = {
    id: `golden_${Math.floor(safeNow)}_${++goldenCounter}`,
    kind,
    name: labelMap[kind] || 'Golden Tangsahur',
    xPct: Number((12 + Math.random() * 72).toFixed(2)),
    yPct: Number((14 + Math.random() * 68).toFixed(2)),
    createdAtMs: safeNow,
    durationMs,
  };

  goldens.push(golden);
  state.goldenSpawned = finiteInt(state.goldenSpawned, 0) + 1;

  return golden;
}

/**
 * Clicks an active Golden Tangsahur and applies its reward or buff.
 */
export function clickGolden(state, goldenId, nowMs = Date.now()) {
  const safeNow = Number.isFinite(Number(nowMs)) ? Number(nowMs) : Date.now();
  state._simNowMs = safeNow;
  const goldens = ensureGoldenArray(state);

  const idx = goldens.findIndex((g) => g && g.id === goldenId);
  if (idx === -1) {
    return {
      ok: false,
      kind: null,
      title: '',
      subtitle: '',
      gained: 0,
      buff: null,
      newAchievements: [],
    };
  }

  const [golden] = goldens.splice(idx, 1);
  if (state.isAscending || state.ascended) {
    return {
      ok: false,
      kind: golden.kind,
      title: '',
      subtitle: '',
      gained: 0,
      buff: null,
      newAchievements: [],
    };
  }

  state.goldenClicks = finiteInt(state.goldenClicks, 0) + 1;

  const derived = computeDerived(state, safeNow);
  const { buffDurMult } = getGoldenRates(state);
  const luckyBonusMult = hasHeavenly(state, 'heavenly_luck') ? 1.1 : 1;

  let kind = golden.kind;
  let title = '';
  let subtitle = '';
  let gained = 0;
  let buff = null;
  let spawnedStormGoldens = [];

  if (!Array.isArray(state.buffs)) state.buffs = [];

  const upsertBuff = (newBuff) => {
    const existingIdx = state.buffs.findIndex(
      (b) => b && b.kind === newBuff.kind && b.buildingId === newBuff.buildingId
    );
    if (existingIdx !== -1) {
      state.buffs[existingIdx] = newBuff;
    } else {
      state.buffs.push(newBuff);
    }
  };

  if (kind === 'building_special') {
    const ownedBuildings = BUILDINGS.filter((b) => (state.buildings?.[b.id]?.owned ?? 0) >= 1);
    if (ownedBuildings.length === 0) {
      kind = 'frenzy';
    } else {
      const picked = ownedBuildings[Math.floor(Math.random() * ownedBuildings.length)];
      const owned = state.buildings[picked.id].owned;
      const mult = 1 + owned * 0.1;
      const durMs = Math.round(30000 * buffDurMult);
      buff = {
        id: `building_${picked.id}`,
        kind: 'building_special',
        name: `${picked.name} x${mult.toFixed(1)}`,
        icon: picked.icon || '🏛️',
        desc: `${picked.plural} boost all TpS by x${mult.toFixed(1)}!`,
        buildingId: picked.id,
        mult,
        target: 'cps',
        startedAtMs: safeNow,
        durationMs: durMs,
        endsAtMs: safeNow + durMs,
        expiresAtMs: safeNow + durMs,
      };
      upsertBuff(buff);
      title = `${picked.name} Resonance!`;
      subtitle = `Production x${mult.toFixed(1)} for ${Math.round(durMs / 1000)}s!`;
    }
  }

  if (kind === 'frenzy') {
    const durMs = Math.round(77000 * buffDurMult);
    buff = {
      id: 'frenzy',
      kind: 'frenzy',
      name: 'Frenzy x7',
      icon: '🔥',
      desc: 'Tangsahur production is multiplied by 7!',
      mult: 7,
      target: 'cps',
      startedAtMs: safeNow,
      durationMs: durMs,
      endsAtMs: safeNow + durMs,
      expiresAtMs: safeNow + durMs,
    };
    upsertBuff(buff);
    title = 'Frenzy!';
    subtitle = `Production x7 for ${Math.round(durMs / 1000)}s!`;
  } else if (kind === 'click_frenzy') {
    const durMs = Math.round(13000 * buffDurMult);
    buff = {
      id: 'click_frenzy',
      kind: 'click_frenzy',
      name: 'Click Frenzy x777',
      icon: '⚡',
      desc: 'Clicking power is multiplied by 777!',
      mult: 777,
      target: 'click',
      startedAtMs: safeNow,
      durationMs: durMs,
      endsAtMs: safeNow + durMs,
      expiresAtMs: safeNow + durMs,
    };
    upsertBuff(buff);
    title = 'Click Frenzy!';
    subtitle = `Clicking power x777 for ${Math.round(durMs / 1000)}s!`;
  } else if (kind === 'lucky') {
    const bankShare = finiteNonNeg(state.tangsahurs, 0) * 0.15 + 13;
    const cpsShare = derived.rawCps * 900 + 13;
    gained = Math.ceil(Math.min(bankShare, cpsShare) * luckyBonusMult);
    state.tangsahurs += gained;
    state.totalBakedRun += gained;
    state.totalBakedAllTime += gained;
    title = 'Lucky!';
    subtitle = `+${formatNumber(gained, state.settings?.shortNumbers ?? true)} Tangsahurs!`;
  } else if (kind === 'sahur_storm') {
    title = 'Sahur Storm!';
    subtitle = 'Catch the falling Golden Tangsahurs!';
    for (let i = 0; i < 6; i++) {
      spawnedStormGoldens.push(spawnGolden(state, safeNow, 'storm_drop'));
    }
  } else if (kind === 'storm_drop') {
    gained = Math.max(13, Math.ceil(derived.rawCps * 60 + derived.rawClickPower * 5));
    state.tangsahurs += gained;
    state.totalBakedRun += gained;
    state.totalBakedAllTime += gained;
    title = 'Storm Bonus!';
    subtitle = `+${formatNumber(gained, state.settings?.shortNumbers ?? true)} Tangsahurs!`;
  }

  const newAchievements = checkAchievements(state, safeNow);

  return {
    ok: true,
    kind,
    title,
    subtitle,
    gained,
    buff,
    spawnedStormGoldens,
    newAchievements,
  };
}

/**
 * Advances simulation by `dtSeconds` (safely clamped to [0, 3600]).
 * Mutates `state` and returns `{ state, events, gained, cps, lumpStatus }`.
 */
export function tick(state, dtSeconds, nowMs = Date.now()) {
  const safeNow = Number.isFinite(Number(nowMs)) ? Number(nowMs) : Date.now();
  const rawDt = Number(dtSeconds);
  const dt = Number.isFinite(rawDt) ? Math.min(3600, Math.max(0, rawDt)) : 0;

  state._simNowMs = safeNow;
  state.lastTickMs = safeNow;

  const events = [];
  if (!Array.isArray(state.buffs)) state.buffs = [];
  const goldens = ensureGoldenArray(state);

  // Expire buffs
  const keptBuffs = [];
  for (const b of state.buffs) {
    if (!b) continue;
    const end = b.endsAtMs ?? b.expiresAtMs;
    if (!Number.isFinite(end)) continue;
    if (end <= safeNow) {
      events.push({ type: 'buff_expire', buff: b });
    } else {
      keptBuffs.push(b);
    }
  }
  state.buffs = keptBuffs;

  // Expire goldens
  const keptGoldens = [];
  for (const g of goldens) {
    if (!g || !Number.isFinite(g.createdAtMs) || !Number.isFinite(g.durationMs)) continue;
    if (safeNow >= g.createdAtMs + g.durationMs) {
      events.push({ type: 'golden_expire', golden: g });
    } else {
      keptGoldens.push(g);
    }
  }
  state.goldens = keptGoldens;
  state.activeGoldens = keptGoldens;

  if (state.isAscending || state.ascended) {
    const derivedPaused = computeDerived(state, safeNow);
    return { state, events, gained: 0, cps: 0, lumpStatus: derivedPaused.lumpStatus };
  }

  // Compute current CpS and add production
  const derived = computeDerived(state, safeNow);
  const gained = derived.cps * dt;
  if (Number.isFinite(gained) && gained > 0) {
    state.tangsahurs = finiteNonNeg(state.tangsahurs, 0) + gained;
    state.totalBakedRun = finiteNonNeg(state.totalBakedRun, 0) + gained;
    state.totalBakedAllTime = finiteNonNeg(state.totalBakedAllTime, 0) + gained;

    for (const b of BUILDINGS) {
      const bStat = derived.buildingStats[b.id];
      if (bStat && bStat.cpsTotal > 0 && state.buildings?.[b.id]) {
        state.buildings[b.id].totalProduced =
          finiteNonNeg(state.buildings[b.id].totalProduced, 0) + bStat.cpsTotal * dt;
      }
    }
  }

  // Golden Tangsahur spawning
  if (!Number.isFinite(state.nextGoldenMs)) {
    state.nextGoldenMs = safeNow + nextGoldenDelayMs(state);
  } else if (safeNow >= state.nextGoldenMs) {
    if (state.goldens.length < 3) {
      const golden = spawnGolden(state, safeNow);
      events.push({ type: 'golden_spawn', golden });
    }
    state.nextGoldenMs = safeNow + nextGoldenDelayMs(state);
  }

  // Sahur Lump auto-harvest if overripe
  const lumpStatus = getLumpStatus(state, safeNow);
  if (lumpStatus.ageMs >= lumpStatus.overripeMs) {
    const autoRes = harvestLump(state, safeNow);
    if (autoRes.ok && autoRes.gained > 0) {
      events.push({ type: 'lump_harvest', gained: autoRes.gained });
    }
  }

  // Rare Shadow Achievement: Just Plain Lucky (1 in 100,000 per second)
  if (!state.justPlainLuckyEarned && dt > 0 && Math.random() < Math.min(0.01, dt / 100000)) {
    state.justPlainLuckyEarned = true;
  }

  const newAchievements = checkAchievements(state, safeNow);
  for (const ach of newAchievements) {
    events.push({ type: 'achievement', id: ach.id, achievement: ach });
  }

  return {
    state,
    events,
    gained,
    cps: derived.cps,
    lumpStatus: getLumpStatus(state, safeNow),
  };
}

/**
 * Handles manual click on the Big Tangsahur.
 */
export function handleClick(state, nowMs = Date.now()) {
  const safeNow = Number.isFinite(Number(nowMs)) ? Number(nowMs) : Date.now();
  state._simNowMs = safeNow;

  if (state.isAscending || state.ascended) {
    return { gained: 0, clickPower: 0, newAchievements: [] };
  }

  if (!Array.isArray(state.clickTimestamps)) state.clickTimestamps = [];
  state.clickTimestamps = state.clickTimestamps.filter((t) => Number.isFinite(t) && safeNow - t <= 1000);
  state.clickTimestamps.push(safeNow);
  if (state.clickTimestamps.length >= 12) {
    state.uncannyClickEarned = true;
  }

  const derived = computeDerived(state, safeNow);
  const gained = Number.isFinite(derived.clickPower) ? derived.clickPower : 1;

  state.tangsahurs = finiteNonNeg(state.tangsahurs, 0) + gained;
  state.totalBakedRun = finiteNonNeg(state.totalBakedRun, 0) + gained;
  state.totalBakedAllTime = finiteNonNeg(state.totalBakedAllTime, 0) + gained;
  state.clickedTangsahurs = finiteNonNeg(state.clickedTangsahurs, 0) + gained;
  state.totalClicks = finiteInt(state.totalClicks, 0) + 1;

  const newAchievements = checkAchievements(state, safeNow);
  return {
    gained,
    clickPower: gained,
    newAchievements,
  };
}

/**
 * Purchases buildings (`amount`: 1, 10, 100, or 'max').
 */
export function buyBuilding(state, buildingId, amount = 1) {
  if (state.isAscending || state.ascended || !BUILDING_MAP[buildingId] || !state.buildings?.[buildingId]) {
    return { ok: false, bought: 0, cost: 0, newAchievements: [] };
  }

  const owned = finiteInt(state.buildings[buildingId].owned, 0);
  const bank = finiteNonNeg(state.tangsahurs, 0);

  let count = 0;
  let cost = 0;

  if (amount === 'max') {
    const res = getMaxAffordable(buildingId, owned, bank);
    count = res.count;
    cost = res.cost;
  } else {
    count = finiteInt(amount, 0);
    if (count <= 0) return { ok: false, bought: 0, cost: 0, newAchievements: [] };
    cost = getBuildingBulkCost(buildingId, owned, count);
  }

  if (count <= 0 || !Number.isFinite(cost) || bank < cost) {
    return { ok: false, bought: 0, cost: 0, newAchievements: [] };
  }

  state.tangsahurs = Math.max(0, bank - cost);
  state.buildings[buildingId].owned = owned + count;

  const newAchievements = checkAchievements(state);
  return {
    ok: true,
    bought: count,
    cost,
    newAchievements,
  };
}

/**
 * Sells owned buildings (`amount`: 1, 10, 100, or 'all').
 */
export function sellBuilding(state, buildingId, amount = 1) {
  if (state.isAscending || state.ascended || !BUILDING_MAP[buildingId] || !state.buildings?.[buildingId]) {
    return { ok: false, sold: 0, refund: 0 };
  }

  const owned = finiteInt(state.buildings[buildingId].owned, 0);
  if (owned <= 0) return { ok: false, sold: 0, refund: 0 };

  const count = amount === 'all' ? owned : Math.min(owned, finiteInt(amount, 0));
  if (count <= 0) return { ok: false, sold: 0, refund: 0 };

  const refund = getBuildingSellRefund(buildingId, owned, count);
  state.buildings[buildingId].owned = owned - count;
  state.buildingsSold = finiteInt(state.buildingsSold, 0) + count;
  state.tangsahurs = finiteNonNeg(state.tangsahurs, 0) + refund;

  checkAchievements(state);
  return {
    ok: true,
    sold: count,
    refund,
  };
}

/**
 * Toggles visual diorama mute state for a building row.
 */
export function toggleBuildingMute(state, buildingId) {
  if (!state?.buildings?.[buildingId]) return false;
  state.buildings[buildingId].muted = !state.buildings[buildingId].muted;
  return state.buildings[buildingId].muted;
}

/**
 * Purchases an unlocked upgrade.
 */
export function buyUpgrade(state, upgradeId) {
  const upg = UPGRADE_MAP[upgradeId];
  if (!upg || state.isAscending || state.ascended) {
    return { ok: false, cost: 0, newAchievements: [] };
  }
  if (!Array.isArray(state.upgrades)) state.upgrades = [];
  if (state.upgrades.includes(upgradeId)) {
    return { ok: false, cost: 0, newAchievements: [] };
  }

  const derived = computeDerived(state);
  if (!upg.unlock(state, derived)) {
    return { ok: false, cost: upg.price, newAchievements: [] };
  }

  const bank = finiteNonNeg(state.tangsahurs, 0);
  if (bank < upg.price) {
    return { ok: false, cost: upg.price, newAchievements: [] };
  }

  state.tangsahurs = Math.max(0, bank - upg.price);
  state.upgrades.push(upgradeId);

  const newAchievements = checkAchievements(state);
  return {
    ok: true,
    cost: upg.price,
    newAchievements,
  };
}

/**
 * Harvests the current Sahur Lump if mature or ripe.
 */
export function harvestLump(state, nowMs = Date.now()) {
  const safeNow = Number.isFinite(Number(nowMs)) ? Number(nowMs) : Date.now();
  state._simNowMs = safeNow;
  const status = getLumpStatus(state, safeNow);

  if (status.stage === 'growing') {
    return {
      ok: false,
      reason: 'not_mature',
      gained: 0,
      stage: status.stage,
      newAchievements: [],
    };
  }

  let gained = 1;
  if (status.stage === 'ripe' || status.ageMs >= Math.round((status.matureMs + status.ripeMs) / 2)) {
    gained = Math.random() < 0.1 ? 2 : 1;
  }

  state.lumpStartMs = safeNow;
  state.lumpStartedAtMs = safeNow;
  state.lumps = finiteInt(state.lumps, 0) + gained;
  state.lumpsHarvested = finiteInt(state.lumpsHarvested, 0) + gained;

  const newAchievements = checkAchievements(state, safeNow);
  return {
    ok: true,
    gained,
    stage: status.stage,
    newAchievements,
  };
}

/**
 * Spends Sahur Lumps to permanently level up a building (+1% CpS per level).
 */
export function levelUpBuilding(state, buildingId) {
  if (!BUILDING_MAP[buildingId] || !state.buildings?.[buildingId]) {
    return { ok: false, newLevel: 0, cost: 0, newAchievements: [] };
  }
  const curLevel = finiteInt(state.buildings[buildingId].level, 0);
  const cost = curLevel + 1;
  const lumps = finiteInt(state.lumps, 0);

  if (lumps < cost) {
    return { ok: false, newLevel: curLevel, cost, newAchievements: [] };
  }

  state.lumps = lumps - cost;
  state.buildings[buildingId].level = curLevel + 1;

  const newAchievements = checkAchievements(state);
  return {
    ok: true,
    newLevel: curLevel + 1,
    cost,
    newAchievements,
  };
}

/**
 * Ascends into the Astral Plane, cashing in pending Heavenly Chips.
 */
export function ascend(state, nowMs = Date.now()) {
  const safeNow = Number.isFinite(Number(nowMs)) ? Number(nowMs) : Date.now();
  state._simNowMs = safeNow;

  const derived = computeDerived(state, safeNow);
  const gain = derived.prestigeGainOnAscend;

  state.heavenlyChips = finiteInt(state.heavenlyChips, 0) + gain;
  state.prestigeLevel = derived.prestigePotential;
  state.ascensions = finiteInt(state.ascensions, 0) + 1;
  state.isAscending = true;
  state.ascended = true;
  state.buffs = [];
  state.goldens = [];
  state.activeGoldens = state.goldens;

  const newAchievements = checkAchievements(state, safeNow);
  return {
    ok: true,
    gainedChips: gain,
    totalChips: state.heavenlyChips,
    prestigeLevel: state.prestigeLevel,
    newAchievements,
  };
}

/**
 * Purchases a Heavenly Upgrade node from the Astral Skill Tree.
 */
export function buyHeavenlyUpgrade(state, id) {
  const upg = HEAVENLY_UPGRADE_MAP[id];
  if (!upg) return { ok: false, cost: 0, remainingChips: finiteInt(state?.heavenlyChips, 0) };

  if (!Array.isArray(state.heavenlyUpgrades)) state.heavenlyUpgrades = [];
  if (state.heavenlyUpgrades.includes(id)) {
    return { ok: false, cost: 0, remainingChips: finiteInt(state.heavenlyChips, 0) };
  }

  for (const req of upg.requires) {
    if (!state.heavenlyUpgrades.includes(req)) {
      return { ok: false, cost: upg.price, remainingChips: finiteInt(state.heavenlyChips, 0) };
    }
  }

  const chips = finiteInt(state.heavenlyChips, 0);
  if (chips < upg.price) {
    return { ok: false, cost: upg.price, remainingChips: chips };
  }

  state.heavenlyChips = chips - upg.price;
  state.heavenlyChipsSpent = finiteInt(state.heavenlyChipsSpent, 0) + upg.price;
  state.heavenlyUpgrades.push(id);

  return {
    ok: true,
    cost: upg.price,
    remainingChips: state.heavenlyChips,
  };
}

/**
 * Reincarnates from the Astral Plane into a fresh run while keeping permanent progress.
 */
export function reincarnate(state, nowMs = Date.now()) {
  const safeNow = Number.isFinite(Number(nowMs)) ? Number(nowMs) : Date.now();
  state._simNowMs = safeNow;

  state.tangsahurs = 0;
  state.totalBakedRun = 0;
  state.clickedTangsahurs = 0;
  state.totalClicks = 0;
  state.runStartMs = safeNow;
  state.lastTickMs = safeNow;
  state.lastSavedMs = safeNow;
  state.upgrades = [];
  state.buffs = [];
  state.goldens = [];
  state.activeGoldens = state.goldens;
  state.nextGoldenMs = safeNow + nextGoldenDelayMs(state);
  state.isAscending = false;
  state.ascended = false;
  state.clickTimestamps = [];

  for (const b of BUILDINGS) {
    if (!state.buildings[b.id]) {
      state.buildings[b.id] = { owned: 0, level: 0, totalProduced: 0, muted: false };
    } else {
      state.buildings[b.id].owned = 0;
      state.buildings[b.id].totalProduced = 0;
      // Preserve building.level and building.muted across reincarnations
    }
  }

  if (hasHeavenly(state, 'starter_kit')) {
    state.buildings.kentongan.owned = 10;
  }
  if (hasHeavenly(state, 'starter_kitchen')) {
    state.buildings.grandma.owned = 5;
  }

  const newAchievements = checkAchievements(state, safeNow);
  return {
    ok: true,
    state,
    newAchievements,
  };
}

/**
 * Grants bounded offline Tangsahur production since `lastSavedMs`.
 */
export function applyOfflineProgress(state, nowMs = Date.now()) {
  const safeNow = Number.isFinite(Number(nowMs)) ? Number(nowMs) : Date.now();
  const lastMs = Number.isFinite(state?.lastSavedMs) ? state.lastSavedMs : safeNow;
  const elapsedSec = Math.max(0, (safeNow - lastMs) / 1000);

  state.lastSavedMs = safeNow;
  state.lastTickMs = safeNow;
  state._simNowMs = safeNow;

  if (state.isAscending || state.ascended || elapsedSec <= 0) {
    return { elapsedSec, gained: 0, efficiency: 0, cappedSec: 0 };
  }

  let efficiency = 0.1;
  let maxSec = 2 * 3600; // 2 hours base cap
  if (hasHeavenly(state, 'twin_gates_2')) {
    efficiency = 0.85;
    maxSec = 24 * 3600;
  } else if (hasHeavenly(state, 'twin_gates_1')) {
    efficiency = 0.5;
    maxSec = 8 * 3600;
  }

  const cappedSec = Math.min(elapsedSec, maxSec);
  const derived = computeDerived(state, safeNow);
  const rawCps = Number.isFinite(derived.rawCps) ? derived.rawCps : 0;
  const gained = Math.max(0, rawCps * cappedSec * efficiency);

  if (Number.isFinite(gained) && gained > 0) {
    state.tangsahurs = finiteNonNeg(state.tangsahurs, 0) + gained;
    state.totalBakedRun = finiteNonNeg(state.totalBakedRun, 0) + gained;
    state.totalBakedAllTime = finiteNonNeg(state.totalBakedAllTime, 0) + gained;
    checkAchievements(state, safeNow);
  }

  return {
    elapsedSec,
    cappedSec,
    efficiency,
    gained: Number.isFinite(gained) ? gained : 0,
  };
}

/**
 * Validates and renames the bakery, unlocking the bakery rename achievement.
 */
export function renameBakery(state, name) {
  const raw = String(name ?? '')
    .replace(/[\r\n\t<>]/g, '')
    .trim()
    .slice(0, 32);

  if (!raw) {
    return {
      ok: false,
      error: 'Bakery name cannot be empty.',
      bakeryName: state?.bakeryName || 'Tung Tung Sahur',
      newAchievements: [],
    };
  }

  state.bakeryName = raw;
  state.bakeryRenamed = true;
  const newAchievements = checkAchievements(state);

  return {
    ok: true,
    bakeryName: raw,
    newAchievements,
  };
}

/**
 * Records a click on the News Ticker, granting a small fortune bonus and achievement check.
 */
export function recordNewsClick(state, nowMs = Date.now()) {
  const safeNow = Number.isFinite(Number(nowMs)) ? Number(nowMs) : Date.now();
  state._simNowMs = safeNow;
  state.newsClicks = finiteInt(state.newsClicks, 0) + 1;

  const derived = computeDerived(state, safeNow);
  const bonus = Math.max(1, Math.floor(derived.rawCps * 5 + derived.rawClickPower));

  const paused = Boolean(state.isAscending || state.ascended);
  if (!paused && Number.isFinite(bonus) && bonus > 0) {
    state.tangsahurs = finiteNonNeg(state.tangsahurs, 0) + bonus;
    state.totalBakedRun = finiteNonNeg(state.totalBakedRun, 0) + bonus;
    state.totalBakedAllTime = finiteNonNeg(state.totalBakedAllTime, 0) + bonus;
  }

  const newAchievements = checkAchievements(state, safeNow);
  const netGained = paused ? 0 : bonus;
  return {
    ok: true,
    gained: netGained,
    bonus: netGained,
    newsClicks: state.newsClicks,
    newAchievements,
  };
}

/**
 * Selects a random eligible news headline string.
 */
export function pickNewsHeadline(state, derived) {
  const d = derived || computeDerived(state);
  const candidates = [];
  for (const item of NEWS_HEADLINES) {
    if (typeof item === 'string') {
      candidates.push(item);
    } else if (typeof item === 'function') {
      const text = item(state, d);
      if (text) candidates.push(text);
    }
  }
  if (candidates.length === 0) return 'News: Tung Tung Tung Sahur!';
  return candidates[Math.floor(Math.random() * candidates.length)];
}

function utf8ToBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) {
    bin += String.fromCharCode(bytes[i]);
  }
  return btoa(bin);
}

function base64ToUtf8(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

/**
 * Serializes game state to safe Base64 UTF-8 JSON.
 */
export function serializeSave(state) {
  const safe = sanitizeState(state) || createInitialState();
  safe.lastSavedMs = Date.now();
  const payload = { ...safe };
  delete payload._simNowMs;
  delete payload.clickTimestamps;
  delete payload.activeGoldens;
  return utf8ToBase64(JSON.stringify(payload));
}

function sanitizeState(raw) {
  const base = createInitialState();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }

  base.version = typeof raw.version === 'string' ? raw.version.slice(0, 16) : GAME_VERSION;
  base.bakeryName = sanitizeBakeryName(raw.bakeryName);
  base.bakeryRenamed = Boolean(raw.bakeryRenamed);

  base.tangsahurs = finiteNonNeg(raw.tangsahurs, 0);
  base.totalBakedRun = finiteNonNeg(raw.totalBakedRun, 0);
  base.totalBakedAllTime = Math.max(base.totalBakedRun, finiteNonNeg(raw.totalBakedAllTime, 0));
  base.clickedTangsahurs = finiteNonNeg(raw.clickedTangsahurs, 0);
  base.totalClicks = finiteInt(raw.totalClicks, 0);

  const now = Date.now();
  base.runStartMs = Number.isFinite(Number(raw.runStartMs)) && Number(raw.runStartMs) > 0 ? Number(raw.runStartMs) : now;
  base.lastSavedMs = Number.isFinite(Number(raw.lastSavedMs)) && Number(raw.lastSavedMs) > 0 ? Number(raw.lastSavedMs) : now;
  base.lastTickMs = Number.isFinite(Number(raw.lastTickMs)) && Number(raw.lastTickMs) > 0 ? Number(raw.lastTickMs) : base.lastSavedMs;
  base._simNowMs = base.lastTickMs;

  if (raw.buildings && typeof raw.buildings === 'object') {
    for (const b of BUILDINGS) {
      const src = raw.buildings[b.id];
      if (src && typeof src === 'object') {
        base.buildings[b.id] = {
          owned: finiteInt(src.owned, 0),
          level: finiteInt(src.level, 0),
          totalProduced: finiteNonNeg(src.totalProduced, 0),
          muted: Boolean(src.muted),
        };
      }
    }
  }

  base.buildingsSold = finiteInt(raw.buildingsSold, 0);

  if (Array.isArray(raw.upgrades)) {
    const seen = new Set();
    base.upgrades = raw.upgrades.filter((id) => typeof id === 'string' && UPGRADE_MAP[id] && !seen.has(id) && seen.add(id));
  }

  if (Array.isArray(raw.achievements)) {
    const seen = new Set();
    base.achievements = raw.achievements.filter((id) => typeof id === 'string' && ACHIEVEMENT_MAP[id] && !seen.has(id) && seen.add(id));
  }

  base.goldenClicks = finiteInt(raw.goldenClicks, 0);
  base.goldenSpawned = finiteInt(raw.goldenSpawned, 0);

  const rawGoldens = Array.isArray(raw.goldens)
    ? raw.goldens
    : (Array.isArray(raw.activeGoldens) ? raw.activeGoldens : []);
  base.goldens = rawGoldens
    .filter(
      (g) =>
        g &&
        typeof g === 'object' &&
        typeof g.id === 'string' &&
        typeof g.kind === 'string' &&
        Number.isFinite(g.createdAtMs) &&
        Number.isFinite(g.durationMs) &&
        g.durationMs > 0
    )
    .slice(0, 10)
    .map((g) => ({
      id: g.id,
      kind: g.kind,
      name: typeof g.name === 'string' ? g.name : 'Golden Tangsahur',
      xPct: Math.min(90, Math.max(5, Number.isFinite(g.xPct) ? g.xPct : 50)),
      yPct: Math.min(90, Math.max(5, Number.isFinite(g.yPct) ? g.yPct : 50)),
      createdAtMs: g.createdAtMs,
      durationMs: g.durationMs,
    }));
  base.activeGoldens = base.goldens;

  base.nextGoldenMs = Number.isFinite(Number(raw.nextGoldenMs)) ? Number(raw.nextGoldenMs) : now + 150000;

  if (Array.isArray(raw.buffs)) {
    base.buffs = raw.buffs
      .filter((b) => {
        if (!b || typeof b !== 'object' || typeof b.kind !== 'string') return false;
        const end = Number(b.endsAtMs ?? b.expiresAtMs);
        return Number.isFinite(b.mult) && b.mult > 0 && Number.isFinite(end) && Number.isFinite(b.durationMs);
      })
      .slice(0, 20)
      .map((b) => {
        const end = Number(b.endsAtMs ?? b.expiresAtMs);
        return {
          id: typeof b.id === 'string' ? b.id : b.kind,
          kind: b.kind,
          name: typeof b.name === 'string' ? b.name : b.kind,
          icon: typeof b.icon === 'string' ? b.icon : '⚡',
          desc: typeof b.desc === 'string' ? b.desc : '',
          buildingId: typeof b.buildingId === 'string' && BUILDING_MAP[b.buildingId] ? b.buildingId : undefined,
          mult: b.mult,
          target: b.target === 'click' ? 'click' : 'cps',
          startedAtMs: Number.isFinite(b.startedAtMs) ? b.startedAtMs : end - b.durationMs,
          durationMs: b.durationMs,
          endsAtMs: end,
          expiresAtMs: end,
        };
      });
  }

  base.prestigeLevel = finiteInt(raw.prestigeLevel, 0);
  base.heavenlyChips = finiteInt(raw.heavenlyChips, 0);
  base.heavenlyChipsSpent = finiteInt(raw.heavenlyChipsSpent, 0);

  if (Array.isArray(raw.heavenlyUpgrades)) {
    const seen = new Set();
    base.heavenlyUpgrades = raw.heavenlyUpgrades.filter(
      (id) => typeof id === 'string' && HEAVENLY_UPGRADE_MAP[id] && !seen.has(id) && seen.add(id)
    );
  }

  base.ascensions = finiteInt(raw.ascensions, 0);
  const ascFlag = Boolean(raw.isAscending ?? raw.ascended);
  base.isAscending = ascFlag;
  base.ascended = ascFlag;
  base.lumps = finiteInt(raw.lumps, 0);
  base.lumpsHarvested = finiteInt(raw.lumpsHarvested, 0);
  const rawLumpStart = Number(raw.lumpStartMs ?? raw.lumpStartedAtMs);
  const safeLumpStart = Number.isFinite(rawLumpStart) && rawLumpStart > 0 ? rawLumpStart : now;
  base.lumpStartMs = safeLumpStart;
  base.lumpStartedAtMs = safeLumpStart;
  base.newsClicks = finiteInt(raw.newsClicks, 0);
  base.uncannyClickEarned = Boolean(raw.uncannyClickEarned);
  base.justPlainLuckyEarned = Boolean(raw.justPlainLuckyEarned);

  if (raw.settings && typeof raw.settings === 'object') {
    const vol = Number(raw.settings.volume);
    base.settings = {
      sound: raw.settings.sound !== undefined ? Boolean(raw.settings.sound) : true,
      volume: Number.isFinite(vol) ? Math.min(1, Math.max(0, vol)) : 0.7,
      shortNumbers: raw.settings.shortNumbers !== undefined ? Boolean(raw.settings.shortNumbers) : true,
      particles: raw.settings.particles !== undefined ? Boolean(raw.settings.particles) : true,
      fancy: raw.settings.fancy !== undefined ? Boolean(raw.settings.fancy) : true,
    };
  }

  return base;
}

/**
 * Deserializes a Base64 UTF-8 save string into a thoroughly sanitized state object, or null if invalid.
 */
export function deserializeSave(saveStr) {
  if (typeof saveStr !== 'string') return null;
  const trimmed = saveStr.trim();
  if (!trimmed) return null;

  try {
    const json = base64ToUtf8(trimmed);
    const parsed = JSON.parse(json);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    // Require at least one recognizable game field so arbitrary objects like "{}" don't silently pass as valid saves
    const hasSignature =
      'tangsahurs' in parsed ||
      'buildings' in parsed ||
      'bakeryName' in parsed ||
      'version' in parsed;
    if (!hasSignature) return null;
    return sanitizeState(parsed);
  } catch {
    return null;
  }
}
