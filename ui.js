import * as Data from './data.js';
import * as Engine from './engine.js';
import { sound } from './audio.js';

const STORAGE_KEY = 'tangsahur_clicker_save_v1';
const PREFS_KEY = 'tangsahur_clicker_prefs_v1';
const AUTO_SAVE_INTERVAL_MS = 30000;
const TICK_STEP_MS = 50; // 20 Hz simulation tick; 60fps UI/FX via RAF/CSS
const NEWS_INTERVAL_MS = 9500;
const MAX_ACTIVE_PARTICLES = 36;

// =========================================================
// Preferences & Persistent State
// =========================================================
const defaultPrefs = {
  soundEnabled: true,
  volume: 0.7,
  shortNumbers: true,
  particles: true,
  fancyGraphics: true,
};

let prefs = loadPrefs();
let state = loadGameState();
let derived = Engine.computeDerived(state);

// UI transient state
let tradeMode = 'buy'; // 'buy' | 'sell'
let bulkAmount = 1; // 1 | 10 | 100 | 'max'
let activePanel = null; // null | 'options' | 'stats' | 'info'
let clickCombo = 0;
let tungBeat = 0;
let lastSaveAtMs = Date.now();
let lastTickRafMs = performance.now();
let lastTickWallMs = Date.now();
let lastPokeAtMs = 0;
let pokeIndex = 0;
let currentNewsText = '3:00 AM approaches. The kentongan echoes across the neighborhood.';
let fortuneActive = false;
let lastNewsSwapMs = Date.now();
let activeModalCleanup = null;

// Tooltip tracking
let tooltipTarget = null; // { kind: string, id?: string, meta?: object }
let lastPointerX = 0;
let lastPointerY = 0;

// Cached DOM keys for differential rendering
let cachedUpgradesKey = '';
let cachedBuildingsKey = '';
let cachedDioramaKey = '';
let cachedOrbitCount = -1;
let cachedGoldensKey = '';
let cachedStatsAchKey = '';
let cachedStatsUpgKey = '';
let cachedBuffsKey = '';

// Astral tree pan state
let astralPanX = 0;
let astralPanY = 0;
let astralDragging = false;
let astralDragStartX = 0;
let astralDragStartY = 0;
let astralStarAnimId = null;

// =========================================================
// DOM References
// =========================================================
const el = {
  versionBadge: document.getElementById('version-badge'),
  saveStatus: document.getElementById('save-status'),
  topSaveBtn: document.getElementById('top-save-btn'),
  topMuteBtn: document.getElementById('top-mute-btn'),
  topLegacyBtn: document.getElementById('top-legacy-btn'),
  topPendingChips: document.getElementById('top-pending-chips'),

  mobileTabs: document.getElementById('mobile-tabs'),
  mainGrid: document.getElementById('main-grid'),

  bakeryNameBtn: document.getElementById('bakery-name-btn'),
  bakeryNameText: document.getElementById('bakery-name-text'),
  tangsahurCount: document.getElementById('tangsahur-count'),
  tangsahurTps: document.getElementById('tangsahur-tps'),
  buffsBar: document.getElementById('buffs-bar'),

  sahurStage: document.getElementById('sahur-stage'),
  kentonganOrbit: document.getElementById('kentongan-orbit'),
  shockwaveLayer: document.getElementById('shockwave-layer'),
  bigTangsahurBtn: document.getElementById('big-tangsahur-btn'),
  bigTangsahurImg: document.getElementById('big-tangsahur-img'),
  clickFxLayer: document.getElementById('click-fx-layer'),

  milkBasin: document.getElementById('milk-basin'),
  milkFill: document.getElementById('milk-fill'),
  milkLabel: document.getElementById('milk-label'),

  newsTickerBtn: document.getElementById('news-ticker-btn'),
  newsTickerText: document.getElementById('news-ticker-text'),

  btnOptions: document.getElementById('btn-options'),
  btnStats: document.getElementById('btn-stats'),
  btnInfo: document.getElementById('btn-info'),
  btnLegacy: document.getElementById('btn-legacy'),
  toolbarPendingChips: document.getElementById('toolbar-pending-chips'),

  lumpWidget: document.getElementById('lump-widget'),
  lumpIcon: document.getElementById('lump-icon'),
  lumpCount: document.getElementById('lump-count'),
  lumpTimer: document.getElementById('lump-timer'),

  dioramasEmpty: document.getElementById('dioramas-empty'),
  dioramasList: document.getElementById('dioramas-list'),

  panelOptions: document.getElementById('panel-options'),
  panelStats: document.getElementById('panel-stats'),
  panelInfo: document.getElementById('panel-info'),

  optSaveNow: document.getElementById('opt-save-now'),
  optWipeSave: document.getElementById('opt-wipe-save'),
  optSoundToggle: document.getElementById('opt-sound-toggle'),
  optVolumeSlider: document.getElementById('opt-volume-slider'),
  optVolumeVal: document.getElementById('opt-volume-val'),
  optShortNumbers: document.getElementById('opt-short-numbers'),
  optParticles: document.getElementById('opt-particles'),
  optFancy: document.getElementById('opt-fancy'),

  statsGeneralGrid: document.getElementById('stats-general-grid'),
  statsMilkBox: document.getElementById('stats-milk-box'),
  statsUpgradesCount: document.getElementById('stats-upgrades-count'),
  statsUpgradesGrid: document.getElementById('stats-upgrades-grid'),
  statsAchCount: document.getElementById('stats-ach-count'),
  statsAchievementsGrid: document.getElementById('stats-achievements-grid'),

  upgradesAvailCount: document.getElementById('upgrades-avail-count'),
  upgradesExpandBtn: document.getElementById('upgrades-expand-btn'),
  upgradesCrate: document.getElementById('upgrades-crate'),
  upgradesEmpty: document.getElementById('upgrades-empty'),
  upgradesGrid: document.getElementById('upgrades-grid'),

  modeBuyBtn: document.getElementById('mode-buy-btn'),
  modeSellBtn: document.getElementById('mode-sell-btn'),
  bulkMaxBtn: document.getElementById('bulk-max-btn'),
  buildingsList: document.getElementById('buildings-list'),

  goldenLayer: document.getElementById('golden-layer'),
  toastStack: document.getElementById('toast-stack'),
  tooltip: document.getElementById('tooltip'),

  modalBackdrop: document.getElementById('modal-backdrop'),
  modalTitle: document.getElementById('modal-title'),
  modalBody: document.getElementById('modal-body'),
  modalFooter: document.getElementById('modal-footer'),
  modalCloseBtn: document.getElementById('modal-close-btn'),

  ascensionOverlay: document.getElementById('ascension-overlay'),
  astralCanvas: document.getElementById('astral-canvas'),
  astralChipsCount: document.getElementById('astral-chips-count'),
  astralPrestigeLevel: document.getElementById('astral-prestige-level'),
  astralPrestigePct: document.getElementById('astral-prestige-pct'),
  astralCenterBtn: document.getElementById('astral-center-btn'),
  reincarnateBtn: document.getElementById('reincarnate-btn'),
  astralViewport: document.getElementById('astral-viewport'),
  astralTreeStage: document.getElementById('astral-tree-stage'),
  astralLines: document.getElementById('astral-lines'),
  astralNodes: document.getElementById('astral-nodes'),
};

// =========================================================
// Utilities & Safe Helpers
// =========================================================
function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatRichText(str) {
  return escapeHtml(str).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}

function hasUpgrade(id) {
  return Array.isArray(state.upgrades)
    ? state.upgrades.includes(id)
    : Boolean(state.upgrades?.[id]);
}

function hasAchievement(id) {
  return Array.isArray(state.achievements)
    ? state.achievements.includes(id)
    : Boolean(state.achievements?.[id]);
}

function hasHeavenly(id) {
  return Array.isArray(state.heavenlyUpgrades)
    ? state.heavenlyUpgrades.includes(id)
    : Boolean(state.heavenlyUpgrades?.[id]);
}

function fmt(n) {
  return Engine.formatNumber(n, prefs.shortNumbers);
}

function fmtCps(n) {
  return Engine.formatCps(n, prefs.shortNumbers);
}

function syncPrefsToState() {
  if (!state) return;
  state.settings = {
    sound: Boolean(prefs.soundEnabled),
    volume: prefs.volume,
    shortNumbers: Boolean(prefs.shortNumbers),
    particles: Boolean(prefs.particles),
    fancy: Boolean(prefs.fancyGraphics),
  };
}

function loadPrefs() {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return { ...defaultPrefs };
    const parsed = JSON.parse(raw);
    return {
      ...defaultPrefs,
      ...parsed,
      volume: Number.isFinite(Number(parsed.volume))
        ? Math.max(0, Math.min(1, Number(parsed.volume)))
        : defaultPrefs.volume,
    };
  } catch {
    return { ...defaultPrefs };
  }
}

function savePrefs() {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // Ignore quota errors
  }
}

function loadGameState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const loaded = Engine.deserializeSave(raw);
      if (loaded) return loaded;
    }
  } catch {
    // Fallback to initial state
  }
  return Engine.createInitialState();
}

function saveGameState(manual = false) {
  try {
    const encoded = Engine.serializeSave(state);
    localStorage.setItem(STORAGE_KEY, encoded);
    lastSaveAtMs = Date.now();
    updateSaveStatusLabel(true);
    if (manual) {
      showToast({
        icon: '💾',
        title: 'Game Saved',
        text: 'Your Sahur bakery progress is safely stored.',
      });
    }
  } catch {
    if (manual) {
      showToast({
        icon: '⚠️',
        title: 'Save Warning',
        text: 'Could not write to browser storage.',
      });
    }
  }
}

function updateSaveStatusLabel(justSaved = false) {
  if (justSaved) {
    el.saveStatus.textContent = 'Saved!';
    el.saveStatus.classList.add('just-saved');
    setTimeout(() => {
      el.saveStatus.classList.remove('just-saved');
    }, 1800);
    return;
  }
  const secAgo = Math.max(0, Math.floor((Date.now() - lastSaveAtMs) / 1000));
  if (secAgo < 5) {
    el.saveStatus.textContent = 'Saved just now';
  } else if (secAgo < 60) {
    el.saveStatus.textContent = `Saved ${secAgo}s ago`;
  } else {
    el.saveStatus.textContent = `Saved ${Math.floor(secAgo / 60)}m ago`;
  }
}

function applyPrefsToEnvironment() {
  sound.setEnabled(Boolean(prefs.soundEnabled));
  sound.setVolume(prefs.volume);

  document.body.classList.toggle('no-fancy-graphics', !prefs.fancyGraphics);
  document.body.classList.toggle('fancy-graphics', Boolean(prefs.fancyGraphics));
  document.body.classList.toggle('no-particles', !prefs.particles);
  syncPrefsToState();

  // Sync top mute button
  const on = sound.isEnabled();
  el.topMuteBtn.textContent = on ? '🔊 Sound: ON' : '🔇 Sound: OFF';
  el.topMuteBtn.setAttribute('aria-pressed', String(!on));

  // Sync Options panel controls
  syncTogglePill(el.optSoundToggle, on);
  syncTogglePill(el.optShortNumbers, prefs.shortNumbers);
  syncTogglePill(el.optParticles, prefs.particles);
  syncTogglePill(el.optFancy, prefs.fancyGraphics);

  const volPct = Math.round(sound.getVolume() * 100);
  el.optVolumeSlider.value = String(volPct);
  el.optVolumeVal.textContent = `${volPct}%`;
}

function syncTogglePill(btn, isOn) {
  if (!btn) return;
  btn.textContent = isOn ? 'ON' : 'OFF';
  btn.classList.toggle('on', Boolean(isOn));
  btn.setAttribute('aria-pressed', String(Boolean(isOn)));
}

function getBuildingCount(id) {
  return Math.max(0, Math.floor(state.buildings?.[id]?.owned ?? state.buildings?.[id] ?? 0));
}

function getBuildingLevel(id) {
  return Math.max(0, Math.floor(state.buildings?.[id]?.level ?? state.buildingLevels?.[id] ?? 0));
}

function getTotalBuildingsOwned() {
  return Data.BUILDINGS.reduce((sum, b) => sum + getBuildingCount(b.id), 0);
}

// =========================================================
// Toast Notifications
// =========================================================
function showToast({ icon = '🥁', title = '', text = '', variant = '', durationMs = 4400 }) {
  const toast = document.createElement('div');
  toast.className = `toast ${variant}`.trim();
  toast.innerHTML = `
    <span class="toast-icon">${escapeHtml(icon)}</span>
    <div class="toast-body">
      <div class="toast-title">${escapeHtml(title)}</div>
      <div class="toast-text">${formatRichText(text)}</div>
    </div>
    <button class="toast-close" type="button" aria-label="Dismiss notification">✕</button>
  `;

  const remove = () => {
    if (toast.parentNode) toast.parentNode.removeChild(toast);
  };

  toast.querySelector('.toast-close').addEventListener('click', remove);
  el.toastStack.appendChild(toast);

  // Keep toast stack neat
  while (el.toastStack.children.length > 4) {
    el.toastStack.removeChild(el.toastStack.firstElementChild);
  }

  setTimeout(remove, durationMs);
}

function announceAchievements(achievementIds) {
  if (!Array.isArray(achievementIds) || achievementIds.length === 0) return;
  let played = false;
  for (const idOrObj of achievementIds) {
    const id = typeof idOrObj === 'string' ? idOrObj : idOrObj?.id;
    const ach = Data.ACHIEVEMENTS.find((a) => a.id === id);
    if (!ach) continue;
    if (!played) {
      sound.playAchievement();
      played = true;
    }
    showToast({
      icon: ach.icon || '🏆',
      title: `Achievement Unlocked: ${ach.name}`,
      text: ach.desc,
      variant: 'achievement',
      durationMs: 5200,
    });
  }
}

// =========================================================
// In-App Modals (Never browser prompt/confirm/alert)
// =========================================================
function openModal({ title, bodyHtml, buttons = [], onMount }) {
  closeModal();
  el.modalTitle.textContent = title;
  el.modalBody.innerHTML = bodyHtml;
  el.modalFooter.innerHTML = '';

  for (const b of buttons) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = b.className || 'cc-btn';
    btn.textContent = b.label;
    btn.addEventListener('click', () => {
      if (b.onClick) b.onClick();
    });
    el.modalFooter.appendChild(btn);
  }

  el.modalBackdrop.classList.remove('hidden');
  if (typeof onMount === 'function') {
    activeModalCleanup = onMount() || null;
  }
}

function closeModal() {
  if (typeof activeModalCleanup === 'function') {
    try {
      activeModalCleanup();
    } catch {
      // ignore
    }
    activeModalCleanup = null;
  }
  el.modalBackdrop.classList.add('hidden');
  el.modalBody.innerHTML = '';
  el.modalFooter.innerHTML = '';
}

function openRenameBakeryModal() {
  const current = state.bakeryName || 'Tung Tung Sahur';
  openModal({
    title: '✎ Rename Sahur Bakery',
    bodyHtml: `
      <p>Choose a worthy name for your 3:00 AM Sahur empire:</p>
      <input id="rename-input" class="modal-input" type="text" maxlength="32" value="${escapeHtml(current)}" autocomplete="off" />
      <div id="rename-error" class="modal-error hidden"></div>
    `,
    buttons: [
      { label: 'Cancel', className: 'cc-btn', onClick: closeModal },
      {
        label: 'Save Name',
        className: 'cc-btn cc-btn-primary',
        onClick: () => submitRename(),
      },
    ],
    onMount: () => {
      const input = document.getElementById('rename-input');
      const err = document.getElementById('rename-error');
      const submit = () => {
        const trimmed = input.value.trim();
        if (!trimmed) {
          err.textContent = 'Bakery name cannot be empty!';
          err.classList.remove('hidden');
          input.focus();
          return;
        }
        const res = Engine.renameBakery(state, trimmed);
        if (res && res.ok === false) {
          err.textContent = res.error || 'Please enter a valid bakery name.';
          err.classList.remove('hidden');
          return;
        }
        if (res?.newAchievements) announceAchievements(res.newAchievements);
        refreshDerivedAndUI();
        saveGameState(false);
        closeModal();
        showToast({
          icon: '🏷️',
          title: 'Bakery Renamed',
          text: `${state.bakeryName}'s Sahur Bakery is open for business!`,
        });
      };

      window.__submitRename = submit;
      input.focus();
      input.select();
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          submit();
        }
      });
      return () => {
        delete window.__submitRename;
      };
    },
  });
}

function submitRename() {
  if (typeof window.__submitRename === 'function') window.__submitRename();
}

function openWipeSaveModal() {
  openModal({
    title: '🗑️ Wipe Save Data',
    bodyHtml: `
      <p><strong>Are you sure?</strong> This permanently erases your Tangsahurs, buildings, upgrades, achievements, and Heavenly Chips.</p>
      <p>Consider exporting your save first if you want a backup.</p>
    `,
    buttons: [
      { label: 'Cancel', className: 'cc-btn', onClick: closeModal },
      {
        label: 'Yes, Wipe Everything',
        className: 'cc-btn cc-btn-danger',
        onClick: () => {
          state = Engine.createInitialState();
          localStorage.removeItem(STORAGE_KEY);
          closeAscensionOverlay();
          closeCenterPanel();
          resetRenderCaches();
          refreshDerivedAndUI();
          saveGameState(false);
          closeModal();
          showToast({
            icon: '🌙',
            title: 'Fresh 3:00 AM Start',
            text: 'Save wiped. Ready to drum anew!',
          });
        },
      },
    ],
  });
}

function openLegacyModal() {
  derived = Engine.computeDerived(state);
  const gain = Math.floor(derived.prestigeGainOnAscend || 0);
  const currentChips = Math.floor(state.heavenlyChips || 0);
  const currentPrestige = Math.floor(state.prestigeLevel || 0);
  const nextAt = Math.pow((derived.prestigePotential || 0) + 1, 3) * 1e12;

  const chipSummary =
    gain > 0
      ? `<p>Ascending now grants <strong>+${fmt(gain)} Heavenly Chips</strong> (and +${fmt(gain)} Prestige Level = <strong>+${fmt(gain)}% TpS</strong>)!</p>`
      : `<p>You currently have <strong>+0 pending Heavenly Chips</strong>. Bake more Tangsahurs all-time to earn your next Heavenly Chip (next at <strong>${fmt(nextAt)}</strong> baked).</p>`;

  const canEnterAstral = gain > 0 || currentChips > 0 || currentPrestige > 0;

  openModal({
    title: '✨ Legacy & Ascension',
    bodyHtml: `
      ${chipSummary}
      <p>Current Heavenly Chips: <strong>${fmt(currentChips)}</strong> • Current Prestige: <strong>${fmt(currentPrestige)}</strong> (+${fmt(derived.prestigeBonusPct || 0)}% TpS)</p>
      <p class="panel-note">Ascending resets your Tangsahurs, buildings, and regular upgrades for a fresh run, while keeping all Achievements, Sahur Lumps, Heavenly Chips, and Heavenly Upgrades forever.</p>
    `,
    buttons: [
      { label: 'Stay in Bakery', className: 'cc-btn', onClick: closeModal },
      ...(canEnterAstral
        ? [
            {
              label: gain > 0 ? `✨ Ascend (+${fmt(gain)} Chips)` : '✨ Enter Astral Plane',
              className: 'cc-btn cc-btn-ascend',
              onClick: () => {
                const res = Engine.ascend(state, Date.now());
                sound.playAscend();
                closeModal();
                if (res?.newAchievements?.length) announceAchievements(res.newAchievements);
                refreshDerivedAndUI();
                saveGameState(false);
                openAscensionOverlay();
              },
            },
          ]
        : []),
    ],
  });
}

// =========================================================
// Center Panels (Options, Stats, Info) & Mobile Tabs
// =========================================================
function openCenterPanel(name) {
  if (activePanel === name) {
    closeCenterPanel();
    return;
  }
  activePanel = name;
  // On mobile, ensure center tab is visible when opening a center panel
  setActiveMobileTab('center');

  el.panelOptions.classList.toggle('hidden', name !== 'options');
  el.panelStats.classList.toggle('hidden', name !== 'stats');
  el.panelInfo.classList.toggle('hidden', name !== 'info');

  el.btnOptions.classList.toggle('active', name === 'options');
  el.btnStats.classList.toggle('active', name === 'stats');
  el.btnInfo.classList.toggle('active', name === 'info');

  if (name === 'stats') {
    renderStatsPanel(true);
  }
}

function closeCenterPanel() {
  activePanel = null;
  el.panelOptions.classList.add('hidden');
  el.panelStats.classList.add('hidden');
  el.panelInfo.classList.add('hidden');
  el.btnOptions.classList.remove('active');
  el.btnStats.classList.remove('active');
  el.btnInfo.classList.remove('active');
}

function setActiveMobileTab(tab) {
  el.mainGrid.dataset.activeTab = tab;
  const buttons = el.mobileTabs.querySelectorAll('.mobile-tab');
  buttons.forEach((btn) => {
    const active = btn.dataset.tab === tab;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-selected', String(active));
  });
}

// =========================================================
// Smart Viewport-Clamped Tooltip
// =========================================================
function showTooltip(kind, meta, clientX, clientY) {
  tooltipTarget = { kind, meta };
  lastPointerX = clientX;
  lastPointerY = clientY;
  renderTooltipContent();
  el.tooltip.classList.remove('hidden');
  el.tooltip.setAttribute('aria-hidden', 'false');
  positionTooltip(clientX, clientY);
}

function hideTooltip() {
  tooltipTarget = null;
  el.tooltip.classList.add('hidden');
  el.tooltip.setAttribute('aria-hidden', 'true');
}

function positionTooltip(clientX, clientY) {
  if (!tooltipTarget || el.tooltip.classList.contains('hidden')) return;
  const rect = el.tooltip.getBoundingClientRect();
  const margin = 8;
  const offset = 14;

  // Prefer left of pointer when hovering right store column so it never hides behind edge
  let x = clientX + offset;
  if (x + rect.width + margin > window.innerWidth) {
    x = clientX - rect.width - offset;
  }
  let y = clientY + offset;
  if (y + rect.height + margin > window.innerHeight) {
    y = clientY - rect.height - offset;
  }

  x = Math.max(margin, Math.min(x, window.innerWidth - rect.width - margin));
  y = Math.max(margin, Math.min(y, window.innerHeight - rect.height - margin));

  el.tooltip.style.left = `${Math.round(x)}px`;
  el.tooltip.style.top = `${Math.round(y)}px`;
}

function renderTooltipContent() {
  if (!tooltipTarget) return;
  const { kind, meta } = tooltipTarget;

  if (kind === 'building') {
    const b = Data.BUILDINGS.find((item) => item.id === meta.id);
    if (!b) return;
    if (meta.mystery) {
      el.tooltip.innerHTML = `
        <div class="tt-header">
          <div class="tt-title-wrap">
            <span class="tt-icon">❓</span>
            <div>
              <div class="tt-title">???</div>
              <span class="tt-tag">Undiscovered Building</span>
            </div>
          </div>
          <span class="tt-price bad">${escapeHtml(fmt(b.baseCost))}</span>
        </div>
        <div class="tt-desc">Bake more Tangsahurs to reveal this mysterious Sahur structure.</div>
      `;
      return;
    }

    const owned = getBuildingCount(b.id);
    const level = getBuildingLevel(b.id);
    const bStat = derived.buildingStats?.[b.id] || {};
    const eachCps = bStat.cpsEach ?? b.baseCps;
    const totalCps = bStat.cpsTotal ?? owned * eachCps;
    const sharePct = Number.isFinite(bStat.sharePct)
      ? bStat.sharePct.toFixed(1)
      : derived.cps > 0
      ? ((totalCps / derived.cps) * 100).toFixed(1)
      : '0.0';

    let priceText = '';
    let priceClass = 'ok';
    if (tradeMode === 'buy') {
      if (bulkAmount === 'max') {
        const maxInfo = Engine.getMaxAffordable(b.id, owned, state.tangsahurs);
        if (maxInfo.count > 0) {
          priceText = `${fmt(maxInfo.cost)} (×${maxInfo.count})`;
          priceClass = 'ok';
        } else {
          priceText = fmt(Engine.getBuildingCost(b.id, owned));
          priceClass = 'bad';
        }
      } else {
        const cost = Engine.getBuildingBulkCost(b.id, owned, bulkAmount);
        priceText = fmt(cost);
        priceClass = state.tangsahurs >= cost ? 'ok' : 'bad';
      }
    } else {
      const sellCount = bulkAmount === 'max' ? owned : Math.min(owned, bulkAmount);
      const refund = sellCount > 0 ? Engine.getBuildingSellRefund(b.id, owned, sellCount) : 0;
      priceText = sellCount > 0 ? `+${fmt(refund)}` : 'None';
      priceClass = sellCount > 0 ? 'ok' : 'bad';
    }

    el.tooltip.innerHTML = `
      <div class="tt-header">
        <div class="tt-title-wrap">
          <span class="tt-icon">${escapeHtml(b.icon)}</span>
          <div>
            <div class="tt-title">${escapeHtml(b.name)}</div>
            <span class="tt-tag">Owned: ${owned}${level > 0 ? ` • Lv.${level}` : ''}</span>
          </div>
        </div>
        <span class="tt-price ${priceClass}">${escapeHtml(priceText)}</span>
      </div>
      <div class="tt-desc">${formatRichText(b.desc)}</div>
      <div class="tt-stats">
        <div>• Each ${escapeHtml(b.name)} produces <strong>${escapeHtml(fmtCps(eachCps))}</strong> TpS</div>
        <div>• ${owned} producing <strong>${escapeHtml(fmtCps(totalCps))}</strong> TpS (${sharePct}% of total TpS)</div>
      </div>
      ${b.quote ? `<div class="tt-quote">"${escapeHtml(b.quote)}"</div>` : ''}
    `;
    return;
  }

  if (kind === 'upgrade') {
    const upg = Data.UPGRADES.find((u) => u.id === meta.id);
    if (!upg) return;
    const isPurchased = hasUpgrade(upg.id);
    const canAfford = state.tangsahurs >= upg.price;
    const priceCls = isPurchased ? 'owned' : canAfford ? 'ok' : 'bad';
    const priceLabel = isPurchased ? 'Purchased' : fmt(upg.price);

    el.tooltip.innerHTML = `
      <div class="tt-header">
        <div class="tt-title-wrap">
          <span class="tt-icon">${escapeHtml(upg.icon || '✨')}</span>
          <div>
            <div class="tt-title">${escapeHtml(upg.name)}</div>
            <span class="tt-tag">${escapeHtml(upg.category || upg.pool || 'Upgrade')}</span>
          </div>
        </div>
        <span class="tt-price ${priceCls}">${escapeHtml(priceLabel)}</span>
      </div>
      <div class="tt-desc">${formatRichText(upg.desc)}</div>
      ${upg.quote ? `<div class="tt-quote">"${escapeHtml(upg.quote)}"</div>` : ''}
    `;
    return;
  }

  if (kind === 'achievement') {
    const ach = Data.ACHIEVEMENTS.find((a) => a.id === meta.id);
    if (!ach) return;
    const unlocked = hasAchievement(ach.id);

    el.tooltip.innerHTML = `
      <div class="tt-header">
        <div class="tt-title-wrap">
          <span class="tt-icon">${unlocked ? escapeHtml(ach.icon || '🏆') : '🔒'}</span>
          <div>
            <div class="tt-title">${unlocked ? escapeHtml(ach.name) : 'Locked Achievement'}</div>
            <span class="tt-tag">${escapeHtml(ach.category || 'Achievement')}${ach.shadow ? ' • Shadow' : ''}</span>
          </div>
        </div>
        <span class="tt-price ${unlocked ? 'ok' : 'bad'}">${unlocked ? 'Unlocked' : 'Locked'}</span>
      </div>
      <div class="tt-desc">${unlocked ? formatRichText(ach.desc) : 'Keep playing to unlock this achievement!'}</div>
      ${unlocked && ach.quote ? `<div class="tt-quote">"${escapeHtml(ach.quote)}"</div>` : ''}
    `;
    return;
  }

  if (kind === 'heavenly') {
    const node = Data.HEAVENLY_UPGRADES.find((h) => h.id === meta.id);
    if (!node) return;
    const owned = hasHeavenly(node.id);
    const reqsMet = (node.requires || []).every((reqId) => hasHeavenly(reqId));
    const canAfford = (state.heavenlyChips || 0) >= node.price;

    let statusText = `${fmt(node.price)} Chips`;
    let statusClass = canAfford && reqsMet ? 'ok' : 'bad';
    if (owned) {
      statusText = 'Purchased';
      statusClass = 'owned';
    } else if (!reqsMet) {
      statusText = 'Locked (Requires parent)';
      statusClass = 'bad';
    }

    el.tooltip.innerHTML = `
      <div class="tt-header">
        <div class="tt-title-wrap">
          <span class="tt-icon">${escapeHtml(node.icon || '🌟')}</span>
          <div>
            <div class="tt-title">${escapeHtml(node.name)}</div>
            <span class="tt-tag">Heavenly Upgrade</span>
          </div>
        </div>
        <span class="tt-price ${statusClass}">${escapeHtml(statusText)}</span>
      </div>
      <div class="tt-desc">${formatRichText(node.desc)}</div>
      ${node.quote ? `<div class="tt-quote">"${escapeHtml(node.quote)}"</div>` : ''}
    `;
    return;
  }

  if (kind === 'lump') {
    const lumpInfo = getLumpStatusInfo(Date.now());
    el.tooltip.innerHTML = `
      <div class="tt-header">
        <div class="tt-title-wrap">
          <span class="tt-icon">🪵</span>
          <div>
            <div class="tt-title">Sahur Lump</div>
            <span class="tt-tag">${escapeHtml(lumpInfo.stageLabel)}</span>
          </div>
        </div>
        <span class="tt-price owned">${state.lumps || 0} owned</span>
      </div>
      <div class="tt-desc">A sacred wooden knot growing on your Sahur tree. Spend Sahur Lumps on any building diorama to level it up (+1% TpS per level!).</div>
      <div class="tt-stats">
        <div>• ${escapeHtml(lumpInfo.detailText)}</div>
      </div>
    `;
  }
}

// =========================================================
// Rendering: Left Stage, Orbit, Milk, Buffs
// =========================================================
function renderLeftStage(nowMs) {
  el.bakeryNameText.textContent = `${state.bakeryName || 'Tung Tung Sahur'}'s Sahur Bakery`;

  const wholeTangsahurs = Math.floor(state.tangsahurs || 0);
  const unitLabel = wholeTangsahurs === 1 ? 'Tangsahur' : 'Tangsahurs';
  el.tangsahurCount.textContent = `${fmt(wholeTangsahurs)} ${unitLabel}`;

  const cps = derived.cps || 0;
  el.tangsahurTps.innerHTML = `per second: <strong>${escapeHtml(fmtCps(cps))}</strong>`;
  const hasBuff = Array.isArray(derived.activeBuffs) && derived.activeBuffs.length > 0;
  el.tangsahurTps.classList.toggle('buffed', hasBuff);

  renderBuffs(nowMs);
  renderKentonganOrbit();
  renderMilkWaves();
}

function renderBuffs(nowMs) {
  const buffs = derived.activeBuffs || [];
  const key = buffs.map((b) => `${b.id}:${Math.ceil((b.expiresAtMs - nowMs) / 1000)}`).join('|');
  if (key === cachedBuffsKey) return;
  cachedBuffsKey = key;

  if (buffs.length === 0) {
    el.buffsBar.innerHTML = '';
    return;
  }

  el.buffsBar.innerHTML = buffs
    .map((b) => {
      const remSec = Math.max(0, Math.ceil((b.expiresAtMs - nowMs) / 1000));
      const totalMs = Math.max(1000, b.durationMs || b.expiresAtMs - (b.startedAtMs || nowMs));
      const pct = Math.max(0, Math.min(100, ((b.expiresAtMs - nowMs) / totalMs) * 100));
      const icon = b.kind === 'click_frenzy' ? '👆' : b.kind === 'building_special' ? '🏛️' : '⚡';
      return `
        <div class="buff-badge" title="${escapeHtml(b.name)}">
          <div class="buff-badge-fill" style="width:${pct.toFixed(1)}%"></div>
          <span class="buff-badge-text">${icon} ${escapeHtml(b.name)} - ${remSec}s</span>
        </div>
      `;
    })
    .join('');
}

function renderKentonganOrbit() {
  const owned = getBuildingCount('kentongan');
  const visualCount = Math.min(48, owned);
  if (visualCount === cachedOrbitCount) return;
  cachedOrbitCount = visualCount;

  el.kentonganOrbit.innerHTML = '';
  for (let i = 0; i < visualCount; i++) {
    const ring = i < 24 ? 0 : 1;
    const countInRing = ring === 0 ? Math.min(24, visualCount) : visualCount - 24;
    const idxInRing = ring === 0 ? i : i - 24;
    const angle = (360 / countInRing) * idxInRing + (ring === 1 ? 7.5 : 0);

    const stick = document.createElement('div');
    stick.className = 'orbit-stick';
    stick.style.setProperty('--stick-angle', `${angle.toFixed(1)}deg`);
    stick.style.setProperty('--stick-radius', ring === 0 ? 'var(--orbit-r0, 126px)' : 'var(--orbit-r1, 150px)');
    stick.innerHTML = `
      <svg width="14" height="24" viewBox="0 0 14 24" aria-hidden="true">
        <rect x="4" y="2" width="6" height="17" rx="2.5" fill="#c9884a" stroke="#42220b" stroke-width="1.3"/>
        <rect x="6" y="5" width="2" height="10" rx="1" fill="#42220b"/>
        <rect x="5" y="18" width="4" height="5" rx="1.5" fill="#9a5e2b" stroke="#42220b" stroke-width="1"/>
      </svg>
    `;
    el.kentonganOrbit.appendChild(stick);
  }
}

function pokeNextOrbitStick(nowMs) {
  if (!prefs.fancyGraphics || cachedOrbitCount <= 0) return;
  if (nowMs - lastPokeAtMs < 480) return;
  lastPokeAtMs = nowMs;
  const children = el.kentonganOrbit.children;
  if (!children.length) return;
  pokeIndex = (pokeIndex + 1) % children.length;
  const stick = children[pokeIndex];
  stick.classList.add('poking');
  setTimeout(() => stick.classList.remove('poking'), 220);
}

function renderMilkWaves() {
  const tier = derived.milkTier || Data.MILK_TIERS[0];
  const progress = Math.max(0, Number(derived.milkProgress || 0));
  const pctHeight = Math.min(88, 12 + progress * 14); // rises nicely inside 44% basin

  document.documentElement.style.setProperty('--milk-top', tier.colorTop || '#f7f3e9');
  document.documentElement.style.setProperty('--milk-bottom', tier.colorBottom || '#dfd7c6');
  document.documentElement.style.setProperty('--milk-foam', tier.foamColor || '#ffffff');
  el.milkFill.style.setProperty('--milk-pct', `${pctHeight.toFixed(1)}%`);

  const milkPctText = Math.round(progress * 100);
  el.milkLabel.textContent = `${tier.name} (${milkPctText}%)`;
}

// =========================================================
// Rendering: Center Toolbar, Lump, Dioramas, Stats
// =========================================================
function getLumpStatusInfo(nowMs) {
  const totalBaked = state.totalBakedAllTime ?? state.totalBakedRun ?? 0;
  const unlocked = Boolean(
    getTotalBuildingsOwned() > 0 ||
      (state.lumps || 0) > 0 ||
      (state.lumpsHarvested || 0) > 0 ||
      totalBaked >= 1000
  );
  const lumpStatus = Engine.getLumpStatus(state, nowMs);
  const canHarvest = lumpStatus.stage === 'mature' || lumpStatus.stage === 'ripe';
  const isRipe = lumpStatus.stage === 'ripe';
  const ripeRemainingSec =
    lumpStatus.ripeRemainingSec ??
    Math.max(0, ((lumpStatus.ripeMs ?? 0) - (lumpStatus.ageMs ?? 0)) / 1000);

  let stageLabel = 'Growing';
  if (lumpStatus.stage === 'ripe') stageLabel = 'Ripe! Click to harvest!';
  else if (lumpStatus.stage === 'mature') stageLabel = 'Mature! Click for +1 Lump';

  const detailText =
    lumpStatus.stage === 'ripe'
      ? 'Fully ripe! Click to harvest +1 Sahur Lump (10% chance of +2!).'
      : lumpStatus.stage === 'mature'
      ? `Ready to harvest for +1 Sahur Lump (10% chance of +2 past halfway) — Fully ripe in ${Engine.formatTime(ripeRemainingSec)}.`
      : `Matures in ${Engine.formatTime(lumpStatus.remainingSec)}`;

  return {
    unlocked,
    canHarvest,
    isRipe,
    remainingSec: lumpStatus.remainingSec,
    ripeRemainingSec,
    stageLabel,
    detailText,
  };
}

function renderToolbarAndHeader(nowMs) {
  const gain = Math.floor(derived.prestigeGainOnAscend || 0);
  const badgeText = `+${fmt(gain)}`;

  [el.topPendingChips, el.toolbarPendingChips].forEach((badge) => {
    if (!badge) return;
    badge.textContent = badgeText;
    badge.classList.toggle('hidden', gain <= 0);
  });

  const lumpInfo = getLumpStatusInfo(nowMs);
  el.lumpWidget.classList.toggle('hidden', !lumpInfo.unlocked);
  if (lumpInfo.unlocked) {
    const lumps = Math.floor(state.lumps || 0);
    el.lumpCount.textContent = `${lumps} ${lumps === 1 ? 'Lump' : 'Lumps'}`;
    el.lumpTimer.textContent = lumpInfo.isRipe
      ? 'RIPE! Harvest'
      : lumpInfo.canHarvest
      ? 'MATURE!'
      : Engine.formatTime(lumpInfo.remainingSec);
    el.lumpWidget.classList.toggle('ripe', lumpInfo.canHarvest);
    el.lumpIcon.textContent = lumpInfo.isRipe ? '✨🪵' : '🪵';
  }
}

function renderDioramas() {
  const ownedBuildings = Data.BUILDINGS.filter((b) => getBuildingCount(b.id) > 0);
  el.dioramasEmpty.classList.toggle('hidden', ownedBuildings.length > 0);

  const lumps = Math.floor(state.lumps || 0);
  const structKey = ownedBuildings
    .map((b) => {
      const level = getBuildingLevel(b.id);
      const canLvl = lumps >= level + 1 ? 1 : 0;
      const muted = state.buildings?.[b.id]?.muted ? 1 : 0;
      return `${b.id}:${getBuildingCount(b.id)}:${level}:${muted}:${canLvl}`;
    })
    .join('|');

  if (structKey !== cachedDioramaKey) {
    cachedDioramaKey = structKey;
    el.dioramasList.innerHTML = '';

    for (const b of ownedBuildings) {
      const count = getBuildingCount(b.id);
      const level = getBuildingLevel(b.id);
      const levelCost = level + 1;
      const isMuted = Boolean(state.buildings?.[b.id]?.muted);
      const visualSprites = Math.min(28, count);

      const row = document.createElement('div');
      row.className = `diorama-row${isMuted ? ' muted' : ''}`;
      row.dataset.buildingId = b.id;

      let spritesHtml = '';
      for (let i = 0; i < visualSprites; i++) {
        const delay = ((i % 7) * 0.18).toFixed(2);
        spritesHtml += `<span class="diorama-sprite" style="--bob-delay:${delay}s">${escapeHtml(b.icon)}</span>`;
      }
      if (count > visualSprites) {
        spritesHtml += `<span class="diorama-overflow-badge">+${fmt(count - visualSprites)} more</span>`;
      }

      row.innerHTML = `
        <div class="diorama-header">
          <div class="diorama-title-group">
            <span class="diorama-title">${escapeHtml(b.plural || `${b.name}s`)}</span>
            <span class="diorama-count-pill">×${fmt(count)}</span>
            <span class="diorama-cps-pill" data-cps-for="${escapeHtml(b.id)}"></span>
          </div>
          <div class="diorama-actions">
            <button
              class="diorama-mini-btn lvl-btn"
              type="button"
              data-action="level-up"
              data-id="${escapeHtml(b.id)}"
              ${lumps < levelCost ? 'disabled' : ''}
              title="Spend ${levelCost} Sahur Lump(s) for +1% TpS on this building"
            >Lv.${level} (+1 Lv • ${levelCost}🪵)</button>
            <button
              class="diorama-mini-btn"
              type="button"
              data-action="toggle-mute"
              data-id="${escapeHtml(b.id)}"
            >${isMuted ? 'Show' : 'Hide'}</button>
          </div>
        </div>
        <div class="diorama-stage" style="--row-color:${escapeHtml(b.color || '#253355')}">
          ${spritesHtml}
        </div>
      `;

      el.dioramasList.appendChild(row);
    }
  }

  // Update live TpS numbers smoothly without tearing down rows
  const cpsBadges = el.dioramasList.querySelectorAll('[data-cps-for]');
  cpsBadges.forEach((badge) => {
    const id = badge.dataset.cpsFor;
    const total = derived.buildingStats?.[id]?.cpsTotal ?? 0;
    badge.textContent = `${fmtCps(total)} TpS`;
  });
}

function renderStatsPanel(force = false) {
  if (activePanel !== 'stats') return;

  const runStart = state.runStartMs || state.runStartedAtMs || state.startedAtMs || Date.now();
  const runDurationSec = Math.max(0, Math.floor((Date.now() - runStart) / 1000));
  const totalBuildings = getTotalBuildingsOwned();
  const unlockedAchIds = Data.ACHIEVEMENTS.filter((a) => hasAchievement(a.id)).map((a) => a.id);
  const nonShadowTotal = derived.totalNonShadowAchievements || Data.ACHIEVEMENTS.filter((a) => !a.shadow).length;
  const unlockedNonShadow = unlockedAchIds.filter((id) => {
    const a = Data.ACHIEVEMENTS.find((x) => x.id === id);
    return a && !a.shadow;
  }).length;
  const achPct = nonShadowTotal > 0 ? Math.round((unlockedNonShadow / nonShadowTotal) * 100) : 0;

  const bakedRun = state.totalBakedRun ?? state.tangsahursEarned ?? 0;
  const bakedAll = state.totalBakedAllTime ?? state.tangsahursAllTime ?? bakedRun;

  const statItems = [
    ['Tangsahurs in Bank', fmt(Math.floor(state.tangsahurs || 0))],
    ['Baked This Run', fmt(Math.floor(bakedRun))],
    ['Baked All Time', fmt(Math.floor(bakedAll))],
    ['Run Started', `${Engine.formatTime(runDurationSec)} ago`],
    ['Buildings Owned', fmt(totalBuildings)],
    ['Tangsahurs per Second', fmtCps(derived.cps || 0)],
    ['Tangsahurs per Click', fmt(derived.clickPower || 1)],
    ['Handmade Clicks', fmt(state.totalClicks || 0)],
    ['Golden Tangsahurs Clicked', fmt(state.goldenClicks || 0)],
    ['Prestige Level', `${fmt(state.prestigeLevel || 0)} (+${fmt(derived.prestigeBonusPct || 0)}% TpS)`],
    ['Heavenly Chips', fmt(state.heavenlyChips || 0)],
    ['Sahur Lumps Harvested', fmt(state.lumpsHarvested || state.lumps || 0)],
  ];

  el.statsGeneralGrid.innerHTML = statItems
    .map(
      ([label, value]) => `
        <div class="stat-item">
          <div class="stat-label">${escapeHtml(label)}</div>
          <div class="stat-value">${escapeHtml(value)}</div>
        </div>
      `
    )
    .join('');

  const tier = derived.milkTier || Data.MILK_TIERS[0];
  const milkPct = Math.round((derived.milkProgress || 0) * 100);
  el.statsMilkBox.innerHTML = `
    <div>
      <span class="milk-swatch" style="background:linear-gradient(180deg, ${escapeHtml(tier.colorTop)}, ${escapeHtml(tier.colorBottom)})"></span>
      <strong>${escapeHtml(tier.name)}</strong>
    </div>
    <div>Milk Power: <strong>${milkPct}%</strong></div>
  `;

  // Purchased Upgrades grid
  const purchasedUpgs = Data.UPGRADES.filter((u) => hasUpgrade(u.id));
  el.statsUpgradesCount.textContent = `${purchasedUpgs.length} / ${Data.UPGRADES.length}`;
  const upgKey = purchasedUpgs.map((u) => u.id).join(',');
  if (force || upgKey !== cachedStatsUpgKey) {
    cachedStatsUpgKey = upgKey;
    el.statsUpgradesGrid.innerHTML = purchasedUpgs.length
      ? purchasedUpgs
          .map(
            (u) => `
              <button
                type="button"
                class="crate-tile unlocked"
                data-tt-kind="upgrade"
                data-tt-id="${escapeHtml(u.id)}"
                aria-label="${escapeHtml(u.name)}"
              >${escapeHtml(u.icon || '✨')}</button>
            `
          )
          .join('')
      : '<div class="panel-note">No upgrades purchased yet this run.</div>';
  }

  // Achievements Grid
  el.statsAchCount.textContent = `${unlockedNonShadow} / ${nonShadowTotal} (${achPct}%)`;
  const achKey = unlockedAchIds.sort().join(',');
  if (force || achKey !== cachedStatsAchKey) {
    cachedStatsAchKey = achKey;
    el.statsAchievementsGrid.innerHTML = Data.ACHIEVEMENTS.filter((a) => !a.shadow || hasAchievement(a.id))
      .map((a) => {
        const unlocked = hasAchievement(a.id);
        return `
          <button
            type="button"
            class="crate-tile ${unlocked ? 'unlocked' : 'locked'}${a.shadow ? ' shadow-ach' : ''}"
            data-tt-kind="achievement"
            data-tt-id="${escapeHtml(a.id)}"
            aria-label="${unlocked ? escapeHtml(a.name) : 'Locked Achievement'}"
          >${unlocked ? escapeHtml(a.icon || '🏆') : '❔'}</button>
        `;
      })
      .join('');
  }
}

// =========================================================
// Rendering: Right Store (Upgrades Crate + Buildings)
// =========================================================
function renderStore() {
  // 1. Upgrades Crate
  const availUpgrades = [...(derived.availableUpgrades || [])].sort((a, b) => a.price - b.price);
  el.upgradesAvailCount.textContent = `(${availUpgrades.length})`;
  el.upgradesEmpty.classList.toggle('hidden', availUpgrades.length > 0);

  const upgIdsKey = availUpgrades.map((u) => u.id).join('|');
  if (upgIdsKey !== cachedUpgradesKey) {
    cachedUpgradesKey = upgIdsKey;
    el.upgradesGrid.innerHTML = '';
    for (const u of availUpgrades) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'crate-tile';
      btn.dataset.upgradeId = u.id;
      btn.dataset.ttKind = 'upgrade';
      btn.dataset.ttId = u.id;
      btn.setAttribute('aria-label', `${u.name} - ${fmt(u.price)} Tangsahurs`);
      btn.textContent = u.icon || '✨';
      el.upgradesGrid.appendChild(btn);
    }
  }

  // Update affordable state on upgrade tiles in-place
  for (const tile of el.upgradesGrid.children) {
    const id = tile.dataset.upgradeId;
    const u = availUpgrades.find((x) => x.id === id);
    if (!u) continue;
    const canAfford = state.tangsahurs >= u.price;
    tile.classList.toggle('affordable', canAfford);
    tile.classList.toggle('unaffordable', !canAfford);
  }

  // 2. Bulk Max/All label
  el.bulkMaxBtn.textContent = tradeMode === 'sell' ? 'All' : 'Max';

  // 3. Buildings list
  const earnedAll = Math.max(state.totalBakedRun ?? state.tangsahursEarned ?? 0, state.tangsahurs || 0);
  let highestRevealed = 1;
  Data.BUILDINGS.forEach((b, idx) => {
    const owned = getBuildingCount(b.id);
    const unlockAt = b.unlockAt ?? b.baseCost * 0.1;
    if (owned > 0 || earnedAll >= unlockAt) {
      highestRevealed = Math.max(highestRevealed, idx);
    }
  });
  const visibleLimit = Math.min(Data.BUILDINGS.length - 1, highestRevealed + 2);

  const buildStructKey = `${visibleLimit}:${tradeMode}:${bulkAmount}`;
  if (buildStructKey !== cachedBuildingsKey) {
    cachedBuildingsKey = buildStructKey;
    el.buildingsList.innerHTML = '';

    for (let i = 0; i <= visibleLimit; i++) {
      const b = Data.BUILDINGS[i];
      const isMystery = i > highestRevealed && getBuildingCount(b.id) === 0 && earnedAll < (b.unlockAt ?? b.baseCost * 0.1);

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `building-btn${isMystery ? ' mystery' : ''}${tradeMode === 'sell' ? ' sell-mode' : ''}`;
      btn.dataset.buildingId = b.id;
      btn.dataset.ttKind = 'building';
      btn.dataset.ttId = b.id;
      if (isMystery) btn.dataset.mystery = '1';

      btn.innerHTML = `
        <div class="building-icon">${isMystery ? '❓' : escapeHtml(b.icon)}</div>
        <div class="building-info">
          <div class="building-name">${isMystery ? '???' : escapeHtml(b.name)}</div>
          <div class="building-price" data-price>—</div>
        </div>
        <div class="building-owned" data-owned>0</div>
      `;
      el.buildingsList.appendChild(btn);
    }
  }

  // Update prices, affordability, and owned counts in-place
  for (const btn of el.buildingsList.children) {
    const id = btn.dataset.buildingId;
    const isMystery = btn.dataset.mystery === '1';
    const owned = getBuildingCount(id);
    const priceEl = btn.querySelector('[data-price]');
    const ownedEl = btn.querySelector('[data-owned]');

    ownedEl.textContent = String(owned);

    if (isMystery) {
      const b = Data.BUILDINGS.find((x) => x.id === id);
      priceEl.textContent = fmt(b.baseCost);
      priceEl.className = 'building-price cannot-afford';
      btn.disabled = true;
      continue;
    }

    if (tradeMode === 'buy') {
      let cost = 0;
      let canAfford = false;
      let suffix = '';

      if (bulkAmount === 'max') {
        const maxInfo = Engine.getMaxAffordable(id, owned, state.tangsahurs);
        if (maxInfo.count > 0) {
          cost = maxInfo.cost;
          canAfford = true;
          suffix = ` (×${maxInfo.count})`;
        } else {
          cost = Engine.getBuildingCost(id, owned);
          canAfford = false;
        }
      } else {
        cost = Engine.getBuildingBulkCost(id, owned, bulkAmount);
        canAfford = state.tangsahurs >= cost;
      }

      priceEl.textContent = `${fmt(cost)}${suffix}`;
      priceEl.className = `building-price ${canAfford ? 'can-afford' : 'cannot-afford'}`;
      btn.classList.toggle('affordable', canAfford);
      btn.classList.toggle('unaffordable', !canAfford);
      btn.disabled = !canAfford;
    } else {
      const sellCount = bulkAmount === 'max' ? owned : Math.min(owned, bulkAmount);
      const canSell = sellCount > 0;
      const refund = canSell ? Engine.getBuildingSellRefund(id, owned, sellCount) : 0;

      priceEl.textContent = canSell ? `+${fmt(refund)} (×${sellCount})` : 'None to sell';
      priceEl.className = `building-price ${canSell ? 'sell-refund' : 'cannot-afford'}`;
      btn.classList.toggle('affordable', canSell);
      btn.classList.toggle('unaffordable', !canSell);
      btn.disabled = !canSell;
    }
  }
}

// =========================================================
// Rendering: Golden Tangsahurs
// =========================================================
function renderGoldens(nowMs) {
  const goldens = state.activeGoldens || [];
  const key = goldens.map((g) => g.id).join('|');

  if (key !== cachedGoldensKey) {
    cachedGoldensKey = key;
    el.goldenLayer.innerHTML = '';

    for (const g of goldens) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'golden-tangsahur';
      btn.dataset.goldenId = g.id;
      btn.style.left = `${Math.max(8, Math.min(92, g.xPct || 50))}%`;
      btn.style.top = `${Math.max(12, Math.min(88, g.yPct || 50))}%`;
      btn.setAttribute('aria-label', 'Golden Tangsahur! Click for a blessing!');

      const img = document.createElement('img');
      img.src = './assets/golden-tangsahur.png';
      img.alt = 'Golden Tangsahur';
      img.draggable = false;
      img.addEventListener('error', () => {
        if (!img.dataset.fallback) {
          img.dataset.fallback = '1';
          img.src = './assets/tangsahur.png';
        } else if (img.dataset.fallback === '1') {
          img.dataset.fallback = '2';
          img.src = './assets/tangsahur-original.jpg';
        }
      });

      btn.appendChild(img);
      el.goldenLayer.appendChild(btn);
    }
  }

  // Update fade near expiration
  for (const btn of el.goldenLayer.children) {
    const id = btn.dataset.goldenId;
    const g = goldens.find((item) => item.id === id);
    if (!g) continue;
    const rem = g.createdAtMs + g.durationMs - nowMs;
    btn.classList.toggle('fading', rem < 2500);
  }
}

function spawnGoldenBanner(x, y, title, subtitle) {
  const banner = document.createElement('div');
  banner.className = 'golden-banner';
  banner.style.left = `${Math.max(110, Math.min(window.innerWidth - 110, x))}px`;
  banner.style.top = `${Math.max(80, Math.min(window.innerHeight - 80, y))}px`;
  banner.innerHTML = `
    <div class="golden-banner-title">${escapeHtml(title)}</div>
    ${subtitle ? `<div class="golden-banner-sub">${escapeHtml(subtitle)}</div>` : ''}
  `;
  document.body.appendChild(banner);
  setTimeout(() => {
    if (banner.parentNode) banner.parentNode.removeChild(banner);
  }, 2350);
}

// =========================================================
// Ascension & Astral Tree
// =========================================================
function openAscensionOverlay() {
  el.ascensionOverlay.classList.remove('hidden');
  astralPanX = 0;
  astralPanY = 0;
  applyAstralPan();
  renderAstralTree();
  startAstralStars();
}

function closeAscensionOverlay() {
  el.ascensionOverlay.classList.add('hidden');
  if (astralStarAnimId) {
    cancelAnimationFrame(astralStarAnimId);
    astralStarAnimId = null;
  }
}

function applyAstralPan() {
  el.astralTreeStage.style.transform = `translate(${astralPanX}px, ${astralPanY}px)`;
}

function renderAstralTree() {
  el.astralChipsCount.textContent = fmt(Math.floor(state.heavenlyChips || 0));
  el.astralPrestigeLevel.textContent = fmt(Math.floor(state.prestigeLevel || 0));
  el.astralPrestigePct.textContent = `${fmt(derived.prestigeBonusPct || 0)}%`;

  // Lines SVG (viewBox -800 -600 1600 1200)
  const nodes = Data.HEAVENLY_UPGRADES || [];
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  let linesHtml = '';
  for (const n of nodes) {
    for (const reqId of n.requires || []) {
      const parent = nodeMap.get(reqId);
      if (!parent) continue;
      const unlocked = hasHeavenly(reqId);
      linesHtml += `<line class="astral-edge${unlocked ? ' unlocked' : ''}" x1="${parent.x}" y1="${parent.y}" x2="${n.x}" y2="${n.y}" />`;
    }
  }
  el.astralLines.innerHTML = linesHtml;

  // Nodes
  el.astralNodes.innerHTML = '';
  for (const n of nodes) {
    const owned = hasHeavenly(n.id);
    const reqsMet = (n.requires || []).every((reqId) => hasHeavenly(reqId));
    const canAfford = (state.heavenlyChips || 0) >= n.price;

    let cls = 'locked';
    if (owned) cls = 'purchased';
    else if (reqsMet && canAfford) cls = 'available';
    else if (reqsMet) cls = 'unaffordable';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `astral-node ${cls}`;
    btn.style.left = `${n.x}px`;
    btn.style.top = `${n.y}px`;
    btn.dataset.heavenlyId = n.id;
    btn.dataset.ttKind = 'heavenly';
    btn.dataset.ttId = n.id;
    btn.setAttribute('aria-label', `${n.name} (${n.price} Heavenly Chips)`);
    btn.innerHTML = `
      <span>${escapeHtml(n.icon || '🌟')}</span>
      <span class="astral-node-cost">${owned ? '✓' : fmt(n.price)}</span>
    `;
    el.astralNodes.appendChild(btn);
  }
}

function startAstralStars() {
  if (astralStarAnimId) cancelAnimationFrame(astralStarAnimId);
  const canvas = el.astralCanvas;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const stars = Array.from({ length: 120 }, () => ({
    x: Math.random(),
    y: Math.random(),
    r: 0.6 + Math.random() * 1.6,
    phase: Math.random() * Math.PI * 2,
    speed: 0.015 + Math.random() * 0.025,
  }));

  const draw = () => {
    if (el.ascensionOverlay.classList.contains('hidden')) return;
    const w = (canvas.width = window.innerWidth);
    const h = (canvas.height = window.innerHeight);
    ctx.clearRect(0, 0, w, h);

    for (const s of stars) {
      s.phase += s.speed;
      const alpha = prefs.fancyGraphics ? 0.35 + 0.55 * Math.sin(s.phase) : 0.6;
      ctx.fillStyle = `rgba(210, 232, 255, ${Math.max(0.15, alpha).toFixed(2)})`;
      ctx.beginPath();
      ctx.arc(s.x * w, s.y * h, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    if (prefs.fancyGraphics) {
      astralStarAnimId = requestAnimationFrame(draw);
    }
  };

  draw();
}

// =========================================================
// News Ticker
// =========================================================
function pickNextHeadline({ allowFortune = false, forceFortune = false } = {}) {
  const next = Engine.pickNewsHeadline(state, derived);
  if (!next) return;

  currentNewsText = next;
  // Fortunes only appear rarely on natural ticker rotation (never from manual spam-clicking)
  fortuneActive = forceFortune || (allowFortune && Math.random() < 0.04);
  lastNewsSwapMs = Date.now();

  el.newsTickerText.textContent = fortuneActive ? `✨ FORTUNE: ${currentNewsText} (Click!)` : currentNewsText;
  el.newsTickerBtn.classList.toggle('fortune-glow', fortuneActive);
}

// =========================================================
// Click Visual Effects
// =========================================================
function spawnClickFx(stageX, stageY, gained, beatStep = 0) {
  if (!prefs.particles) return;

  // Trim old FX if clicking at lightning speed
  while (el.clickFxLayer.children.length > MAX_ACTIVE_PARTICLES) {
    el.clickFxLayer.removeChild(el.clickFxLayer.firstElementChild);
  }

  // Floating +X
  const plus = document.createElement('div');
  const hasClickFrenzy = (derived.activeBuffs || []).some((b) => b.kind === 'click_frenzy');
  plus.className = `float-plus${hasClickFrenzy ? ' crit' : ''}`;
  plus.style.left = `${stageX + (Math.random() * 20 - 10)}px`;
  plus.style.top = `${stageY - 10}px`;
  plus.textContent = `+${fmt(gained)}`;
  el.clickFxLayer.appendChild(plus);
  setTimeout(() => {
    if (plus.parentNode) plus.parentNode.removeChild(plus);
  }, 950);

  // Rhythmic TUNG! TUNG! TUNG! SAHUR! callout
  if (prefs.fancyGraphics) {
    const tung = document.createElement('div');
    const isSahur = beatStep === 3;
    tung.className = `float-tung${isSahur ? ' sahur-beat' : ''}`;
    tung.style.left = `${stageX + (Math.random() * 44 - 22)}px`;
    tung.style.top = `${stageY - 34}px`;
    tung.textContent = isSahur ? 'SAHUR!' : 'TUNG!';
    el.clickFxLayer.appendChild(tung);
    setTimeout(() => {
      if (tung.parentNode) tung.parentNode.removeChild(tung);
    }, 850);
  }

  // Expanding Shockwave Ring
  if (prefs.fancyGraphics) {
    const wave = document.createElement('div');
    wave.className = 'click-shockwave';
    wave.style.left = `${stageX}px`;
    wave.style.top = `${stageY}px`;
    el.shockwaveLayer.appendChild(wave);
    setTimeout(() => {
      if (wave.parentNode) wave.parentNode.removeChild(wave);
    }, 520);
  }

  // Mini Falling Tangsahur Particles
  const count = prefs.fancyGraphics ? 2 : 1;
  for (let i = 0; i < count; i++) {
    const p = document.createElement('div');
    p.className = 'mini-particle';
    p.style.left = `${stageX - 12}px`;
    p.style.top = `${stageY - 12}px`;
    p.style.setProperty('--dx', `${Math.round((Math.random() - 0.5) * 140)}px`);
    p.style.setProperty('--dy', `${Math.round(90 + Math.random() * 140)}px`);
    p.style.setProperty('--rot', `${Math.round((Math.random() - 0.5) * 320)}deg`);
    el.clickFxLayer.appendChild(p);
    setTimeout(() => {
      if (p.parentNode) p.parentNode.removeChild(p);
    }, 1050);
  }
}

// =========================================================
// Full Refresh & Simulation Loop
// =========================================================
function resetRenderCaches() {
  cachedUpgradesKey = '';
  cachedBuildingsKey = '';
  cachedDioramaKey = '';
  cachedOrbitCount = -1;
  cachedGoldensKey = '';
  cachedStatsAchKey = '';
  cachedStatsUpgKey = '';
  cachedBuffsKey = '';
}

function refreshDerivedAndUI(nowMs = Date.now()) {
  derived = Engine.computeDerived(state);
  renderLeftStage(nowMs);
  renderToolbarAndHeader(nowMs);
  renderDioramas();
  renderStore();
  renderGoldens(nowMs);
  if (activePanel === 'stats') {
    renderStatsPanel(false);
  }
  if (!el.ascensionOverlay.classList.contains('hidden')) {
    renderAstralTree();
  }
  if (tooltipTarget) {
    renderTooltipContent();
    positionTooltip(lastPointerX, lastPointerY);
  }
}

function stepLoop(rafNow) {
  const nowMs = Date.now();
  const dtRafMs = rafNow - lastTickRafMs;

  if (dtRafMs >= TICK_STEP_MS) {
    const dtSec = Math.min(3600, Math.max(0, (nowMs - lastTickWallMs) / 1000));
    lastTickRafMs = rafNow;
    lastTickWallMs = nowMs;

    const tickRes = Engine.tick(state, dtSec, nowMs);
    if (tickRes?.events) {
      for (const ev of tickRes.events) {
        if (ev.type === 'golden_spawn') {
          sound.playGoldenAppear();
        } else if (ev.type === 'achievement') {
          announceAchievements(ev.achievement ? [ev.achievement] : ev.ids || [ev.id]);
        } else if (ev.type === 'lump_autoharvest' || ev.type === 'lump_harvest') {
          sound.playLump();
          showToast({
            icon: '🪵',
            title: 'Sahur Lump Auto-Harvested',
            text: `+${ev.gained || 1} Sahur Lump added to your stash!`,
          });
        }
      }
    }
    if (tickRes?.newAchievements?.length) {
      announceAchievements(tickRes.newAchievements);
    }

    refreshDerivedAndUI(nowMs);
    pokeNextOrbitStick(nowMs);
    updateSaveStatusLabel(false);

    if (nowMs - lastNewsSwapMs >= NEWS_INTERVAL_MS) {
      pickNextHeadline({ allowFortune: true });
    }
    if (nowMs - lastSaveAtMs >= AUTO_SAVE_INTERVAL_MS) {
      saveGameState(false);
    }
  }

  requestAnimationFrame(stepLoop);
}

// =========================================================
// Event Wiring
// =========================================================
function bindEvents() {
  // Image fallback if cutout missing
  el.bigTangsahurImg.addEventListener('error', () => {
    if (!el.bigTangsahurImg.dataset.fallback) {
      el.bigTangsahurImg.dataset.fallback = '1';
      el.bigTangsahurImg.src = './assets/tangsahur-original.jpg';
    }
  });

  // Prevent Space/Enter key-repeat cheat on Big Tangsahur
  el.bigTangsahurBtn.addEventListener('keydown', (e) => {
    if ((e.key === ' ' || e.key === 'Enter') && e.repeat) {
      e.preventDefault();
    }
  });

  el.bigTangsahurBtn.addEventListener('click', (e) => {
    const nowMs = Date.now();
    const res = Engine.handleClick(state, nowMs);
    clickCombo = (clickCombo + 1) % 3;
    const beatStep = tungBeat;
    tungBeat = (tungBeat + 1) % 4;
    sound.playClick(clickCombo);

    // Spring animation
    el.bigTangsahurBtn.classList.remove('spring-pop');
    void el.bigTangsahurBtn.offsetWidth;
    el.bigTangsahurBtn.classList.add('spring-pop');

    // Position FX relative to sahurStage
    const stageRect = el.sahurStage.getBoundingClientRect();
    let fxX = stageRect.width / 2;
    let fxY = stageRect.height / 2;
    if (e.clientX > 0 || e.clientY > 0) {
      fxX = e.clientX - stageRect.left;
      fxY = e.clientY - stageRect.top;
    }

    const gained = res?.gained ?? derived.clickPower ?? 1;
    spawnClickFx(fxX, fxY, gained, beatStep);
    if (res?.newAchievements?.length) {
      announceAchievements(res.newAchievements);
    }
    refreshDerivedAndUI(nowMs);
  });

  // Top Header Controls
  el.topSaveBtn.addEventListener('click', () => saveGameState(true));
  el.topMuteBtn.addEventListener('click', () => {
    prefs.soundEnabled = !sound.isEnabled();
    savePrefs();
    applyPrefsToEnvironment();
  });
  el.topLegacyBtn.addEventListener('click', openLegacyModal);

  // Bakery Name Rename
  el.bakeryNameBtn.addEventListener('click', openRenameBakeryModal);

  // Mobile Tabs
  el.mobileTabs.addEventListener('click', (e) => {
    const btn = e.target.closest('.mobile-tab');
    if (!btn) return;
    setActiveMobileTab(btn.dataset.tab);
  });

  // News Ticker
  el.newsTickerBtn.addEventListener('click', () => {
    const nowMs = Date.now();
    if (fortuneActive) {
      const res = Engine.recordNewsClick(state, nowMs, { isFortune: true });
      const bonus = res?.bonus || 0;
      sound.playGoldenClick();
      if (bonus > 0) {
        showToast({
          icon: '📰',
          title: 'Sahur Fortune!',
          text: `You claimed +${fmt(bonus)} Tangsahurs from the breaking news!`,
          variant: 'golden',
        });
      }
      if (res?.newAchievements?.length) announceAchievements(res.newAchievements);
      fortuneActive = false;
      pickNextHeadline({ allowFortune: false });
      refreshDerivedAndUI();
    } else {
      const res = Engine.recordNewsClick(state, nowMs, { isFortune: false });
      if (res?.newAchievements?.length) announceAchievements(res.newAchievements);
      pickNextHeadline({ allowFortune: false });
    }
  });

  // Center Toolbar
  el.btnOptions.addEventListener('click', () => openCenterPanel('options'));
  el.btnStats.addEventListener('click', () => openCenterPanel('stats'));
  el.btnInfo.addEventListener('click', () => openCenterPanel('info'));
  el.btnLegacy.addEventListener('click', openLegacyModal);

  document.querySelectorAll('[data-close-panel]').forEach((btn) => {
    btn.addEventListener('click', closeCenterPanel);
  });

  // Sahur Lump Harvest
  el.lumpWidget.addEventListener('click', () => {
    const nowMs = Date.now();
    const res = Engine.harvestLump(state, nowMs);
    if (res && res.ok) {
      sound.playLump();
      showToast({
        icon: '🪵',
        title: 'Sahur Lump Harvested!',
        text: `+${res.gained || 1} Sahur Lump collected! Spend it on building dioramas to level them up.`,
      });
      if (res.newAchievements?.length) announceAchievements(res.newAchievements);
      refreshDerivedAndUI(nowMs);
      saveGameState(false);
    } else {
      const info = getLumpStatusInfo(nowMs);
      showToast({
        icon: '🪵',
        title: 'Sahur Lump Growing',
        text: info.detailText,
        durationMs: 2800,
      });
    }
  });

  // Diorama Actions (Level Up / Mute Row)
  el.dioramasList.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const id = btn.dataset.id;
    const action = btn.dataset.action;
    if (action === 'level-up') {
      const res = Engine.levelUpBuilding(state, id);
      if (res && res.ok) {
        sound.playUpgrade();
        if (res.newAchievements?.length) announceAchievements(res.newAchievements);
        refreshDerivedAndUI();
        saveGameState(false);
      }
    } else if (action === 'toggle-mute') {
      Engine.toggleBuildingMute(state, id);
      renderDioramas();
      saveGameState(false);
    }
  });

  // Options Controls
  el.optSaveNow.addEventListener('click', () => saveGameState(true));
  el.optWipeSave.addEventListener('click', openWipeSaveModal);

  el.optSoundToggle.addEventListener('click', () => {
    prefs.soundEnabled = !sound.isEnabled();
    savePrefs();
    applyPrefsToEnvironment();
  });

  el.optVolumeSlider.addEventListener('input', (e) => {
    prefs.volume = Math.max(0, Math.min(1, Number(e.target.value) / 100));
    savePrefs();
    applyPrefsToEnvironment();
  });

  el.optShortNumbers.addEventListener('click', () => {
    prefs.shortNumbers = !prefs.shortNumbers;
    savePrefs();
    applyPrefsToEnvironment();
    refreshDerivedAndUI();
  });

  el.optParticles.addEventListener('click', () => {
    prefs.particles = !prefs.particles;
    savePrefs();
    applyPrefsToEnvironment();
  });

  el.optFancy.addEventListener('click', () => {
    prefs.fancyGraphics = !prefs.fancyGraphics;
    savePrefs();
    applyPrefsToEnvironment();
  });

  // Upgrades Expand & Purchase
  el.upgradesExpandBtn.addEventListener('click', () => {
    const expanded = el.upgradesCrate.dataset.expanded === 'true';
    el.upgradesCrate.dataset.expanded = String(!expanded);
    el.upgradesExpandBtn.textContent = !expanded ? '▲ Collapse' : '▼ Expand';
  });

  el.upgradesGrid.addEventListener('click', (e) => {
    const tile = e.target.closest('.crate-tile[data-upgrade-id]');
    if (!tile) return;
    const res = Engine.buyUpgrade(state, tile.dataset.upgradeId);
    if (res && res.ok) {
      sound.playUpgrade();
      if (res.newAchievements?.length) announceAchievements(res.newAchievements);
      refreshDerivedAndUI();
    }
  });

  // Store Buy / Sell & Bulk
  el.modeBuyBtn.addEventListener('click', () => {
    tradeMode = 'buy';
    el.modeBuyBtn.classList.add('active');
    el.modeSellBtn.classList.remove('active');
    renderStore();
  });

  el.modeSellBtn.addEventListener('click', () => {
    tradeMode = 'sell';
    el.modeSellBtn.classList.add('active');
    el.modeBuyBtn.classList.remove('active');
    renderStore();
  });

  document.querySelectorAll('.bulk-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const raw = btn.dataset.bulk;
      bulkAmount = raw === 'max' ? 'max' : Number(raw);
      document.querySelectorAll('.bulk-btn').forEach((b) => b.classList.toggle('active', b === btn));
      renderStore();
    });
  });

  el.buildingsList.addEventListener('click', (e) => {
    const btn = e.target.closest('.building-btn[data-building-id]');
    if (!btn || btn.disabled) return;
    const id = btn.dataset.buildingId;
    if (tradeMode === 'buy') {
      const res = Engine.buyBuilding(state, id, bulkAmount);
      if (res && res.ok) {
        sound.playBuy();
        if (res.newAchievements?.length) announceAchievements(res.newAchievements);
        refreshDerivedAndUI();
      }
    } else {
      const amt = bulkAmount === 'max' ? 'all' : bulkAmount;
      const res = Engine.sellBuilding(state, id, amt);
      if (res && res.ok) {
        sound.playSell();
        refreshDerivedAndUI();
      }
    }
  });

  // Golden Tangsahur Click
  el.goldenLayer.addEventListener('click', (e) => {
    const btn = e.target.closest('.golden-tangsahur[data-golden-id]');
    if (!btn) return;
    const nowMs = Date.now();
    const res = Engine.clickGolden(state, btn.dataset.goldenId, nowMs);
    if (res && res.ok) {
      sound.playGoldenClick();
      const rect = btn.getBoundingClientRect();
      spawnGoldenBanner(
        rect.left + rect.width / 2,
        rect.top + rect.height / 2,
        res.title || 'Golden Sahur!',
        res.subtitle || ''
      );
      showToast({
        icon: '🌟',
        title: res.title || 'Golden Tangsahur!',
        text: res.subtitle || 'Blessing activated!',
        variant: 'golden',
      });
      if (res.newAchievements?.length) announceAchievements(res.newAchievements);
      refreshDerivedAndUI(nowMs);
    }
  });

  // Modal Close Controls
  el.modalCloseBtn.addEventListener('click', closeModal);
  el.modalBackdrop.addEventListener('click', (e) => {
    if (e.target === el.modalBackdrop) closeModal();
  });

  // Ascension Astral Controls
  el.astralCenterBtn.addEventListener('click', () => {
    astralPanX = 0;
    astralPanY = 0;
    applyAstralPan();
  });

  el.reincarnateBtn.addEventListener('click', () => {
    const res = Engine.reincarnate(state, Date.now());
    sound.playUpgrade();
    closeAscensionOverlay();
    resetRenderCaches();
    refreshDerivedAndUI();
    if (res?.newAchievements?.length) announceAchievements(res.newAchievements);
    saveGameState(false);
    showToast({
      icon: '🌅',
      title: 'Reincarnated!',
      text: `You return stronger with +${fmt(derived.prestigeBonusPct || 0)}% Prestige TpS!`,
    });
  });

  el.astralNodes.addEventListener('click', (e) => {
    const nodeBtn = e.target.closest('.astral-node[data-heavenly-id]');
    if (!nodeBtn) return;
    const res = Engine.buyHeavenlyUpgrade(state, nodeBtn.dataset.heavenlyId);
    if (res && res.ok) {
      sound.playUpgrade();
      refreshDerivedAndUI();
      saveGameState(false);
    }
  });

  // Astral Drag-to-Pan
  el.astralViewport.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.astral-node')) return;
    astralDragging = true;
    astralDragStartX = e.clientX - astralPanX;
    astralDragStartY = e.clientY - astralPanY;
  });

  window.addEventListener('pointermove', (e) => {
    if (astralDragging) {
      astralPanX = e.clientX - astralDragStartX;
      astralPanY = e.clientY - astralDragStartY;
      applyAstralPan();
    }
    if (tooltipTarget) {
      lastPointerX = e.clientX;
      lastPointerY = e.clientY;
      positionTooltip(e.clientX, e.clientY);
    }
  });

  window.addEventListener('pointerup', () => {
    astralDragging = false;
  });

  // Delegated Hover Tooltips (Buildings, Upgrades, Achievements, Heavenly, Lump)
  document.addEventListener('pointerover', (e) => {
    const target = e.target.closest('[data-tt-kind]');
    if (!target) return;
    const kind = target.dataset.ttKind;
    const id = target.dataset.ttId;
    const mystery = target.dataset.mystery === '1';
    showTooltip(kind, { id, mystery }, e.clientX, e.clientY);
  });

  document.addEventListener('pointerout', (e) => {
    const leaving = e.target.closest('[data-tt-kind]');
    if (!leaving) return;
    const next = e.relatedTarget?.closest?.('[data-tt-kind]');
    if (next === leaving) return;
    if (!next) hideTooltip();
  });

  el.lumpWidget.addEventListener('pointerenter', (e) => {
    showTooltip('lump', {}, e.clientX, e.clientY);
  });
  el.lumpWidget.addEventListener('pointerleave', hideTooltip);

  // Keyboard shortcuts
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (!el.modalBackdrop.classList.contains('hidden')) {
        closeModal();
      } else if (activePanel) {
        closeCenterPanel();
      }
      hideTooltip();
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      saveGameState(true);
    }
  });

  // Save before page unload
  window.addEventListener('beforeunload', () => {
    saveGameState(false);
  });
}

// =========================================================
// Initialization
// =========================================================
function init() {
  el.versionBadge.textContent = `v${Data.GAME_VERSION || '1.0.0'}`;
  applyPrefsToEnvironment();
  bindEvents();
  pickNextHeadline({ allowFortune: false });

  // Offline Welcome Back check
  const offline = Engine.applyOfflineProgress(state, Date.now());
  refreshDerivedAndUI();

  if (offline && offline.gained > 0 && offline.elapsedSec >= 10) {
    showToast({
      icon: '🌙',
      title: 'Welcome Back!',
      text: `While away for ${Engine.formatTime(Math.floor(offline.elapsedSec))}, your bakery earned +${fmt(offline.gained)} Tangsahurs!`,
      durationMs: 6500,
    });
  }

  if (state.isAscending) {
    openAscensionOverlay();
  }

  requestAnimationFrame(stepLoop);
}

init();
