import * as THREE from "three";

const clampNumber = (value, min, max) => Math.max(min, Math.min(max, value));
const safeJsonParse = (raw, fallback) => {
  try {
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
};

const formatTodayKey = () => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const createSeededRng = (seedString) => {
  let h = 2166136261;
  for (let i = 0; i < seedString.length; i += 1) {
    h ^= seedString.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const STORAGE_KEY = "stack_plus_save_v1";

const SKINS = [
  { id: "classic", name: "Classic", cost: 0, kind: "matte" },
  { id: "gloss", name: "Gloss", cost: 60, kind: "gloss" },
  { id: "metal", name: "Metal", cost: 120, kind: "metal" },
  { id: "checker", name: "Checker", cost: 140, kind: "checker" },
  { id: "marble", name: "Marble", cost: 180, kind: "marble" },
  { id: "carbon", name: "Carbon", cost: 220, kind: "carbon" },
  { id: "mono", name: "Mono", cost: 90, kind: "mono" },
  { id: "gold", name: "Gold", cost: 300, kind: "gold" }
];

const SKIES = [
  { id: "day", name: "Day", cost: 0, bg: "#FAFAFA", fog: "#FAFAFA", ground: "#F2F2F2", ambient: 0.85, sun: 0.95, exposure: 1.05 },
  { id: "cloudy", name: "Cloudy", cost: 80, bg: "#F7F7F7", fog: "#F0F0F0", ground: "#EDEDED", ambient: 0.95, sun: 0.75, exposure: 1.05 },
  { id: "dusk", name: "Dusk", cost: 140, bg: "#EFEFEF", fog: "#E9E9E9", ground: "#E6E6E6", ambient: 0.75, sun: 0.9, exposure: 1.0 },
  { id: "studio", name: "Studio", cost: 200, bg: "#F8F8F8", fog: "#F8F8F8", ground: "#F0F0F0", ambient: 1.1, sun: 0.55, exposure: 1.15 },
  { id: "noir", name: "Noir", cost: 240, bg: "#EDEDED", fog: "#E5E5E5", ground: "#E2E2E2", ambient: 0.65, sun: 0.8, exposure: 0.95 },
  { id: "mint", name: "Mint", cost: 260, bg: "#F3F9F6", fog: "#F3F9F6", ground: "#EAF4EF", ambient: 0.9, sun: 0.85, exposure: 1.05 }
];

const createDefaultSaveData = () => ({
  bestScore: 0,
  stars: 0,
  ownedSkins: ["classic"],
  ownedSkies: ["day"],
  selectedSkinId: "classic",
  selectedSkyId: "day",
  stats: {
    gamesPlayed: 0,
    totalPlacedBlocks: 0,
    bestPerfectStreak: 0
  },
  challenges: {
    dayKey: formatTodayKey(),
    items: []
  }
});

const loadSaveData = () => {
  const raw = localStorage.getItem(STORAGE_KEY);
  const parsed = raw ? safeJsonParse(raw, null) : null;
  const merged = { ...createDefaultSaveData(), ...(parsed || {}) };
  merged.ownedSkins = Array.isArray(merged.ownedSkins) ? merged.ownedSkins : ["classic"];
  merged.ownedSkies = Array.isArray(merged.ownedSkies) ? merged.ownedSkies : ["day"];
  return merged;
};

const writeSaveData = (saveData) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(saveData));
};

const dom = {
  canvas: document.getElementById("game-canvas"),
  score: document.getElementById("score"),
  best: document.getElementById("best"),
  stars: document.getElementById("stars"),
  menuStars: document.getElementById("menu-stars"),
  homeScore: document.getElementById("home-score"),
  homeBest: document.getElementById("home-best"),
  currentSkin: document.getElementById("current-skin"),
  currentSky: document.getElementById("current-sky"),
  menuOverlay: document.getElementById("menu-overlay"),
  menuTitle: document.getElementById("menu-title"),
  menuSubtitle: document.getElementById("menu-subtitle"),
  btnPlay: document.getElementById("btn-play"),
  btnHow: document.getElementById("btn-how"),
  how: document.getElementById("how"),
  btnMenu: document.getElementById("btn-menu"),
  btnCloseMenu: document.getElementById("btn-close-menu"),
  btnRestart: document.getElementById("btn-restart"),
  btnSound: document.getElementById("btn-sound"),
  skinsGrid: document.getElementById("skins-grid"),
  skiesGrid: document.getElementById("skies-grid"),
  challengeList: document.getElementById("challenge-list"),
  comboToast: document.getElementById("combo-toast"),
  tabButtons: Array.from(document.querySelectorAll(".tab-btn")),
  panels: Array.from(document.querySelectorAll(".panel")),
  jumpButtons: Array.from(document.querySelectorAll("[data-tab-jump]"))
};

const createSimpleSoundPlayer = () => {
  let audioContext = null;
  let enabled = true;

  const ensureContext = () => {
    if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
    return audioContext;
  };

  const playBeep = (frequency, durationMs, type, gainValue) => {
    if (!enabled) return;
    const context = ensureContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = type;
    oscillator.frequency.value = frequency;
    gain.gain.value = gainValue;

    oscillator.connect(gain);
    gain.connect(context.destination);

    const now = context.currentTime;
    oscillator.start(now);
    oscillator.stop(now + durationMs / 1000);

    gain.gain.setValueAtTime(gainValue, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + durationMs / 1000);
  };

  return {
    setEnabled: (nextEnabled) => { enabled = !!nextEnabled; },
    getEnabled: () => enabled,
    click: () => playBeep(520, 55, "square", 0.018),
    perfect: () => playBeep(900, 70, "triangle", 0.028),
    grow: () => playBeep(1040, 90, "sine", 0.03),
    fail: () => playBeep(180, 220, "sawtooth", 0.03)
  };
};

const sound = createSimpleSoundPlayer();

const createCanvasTexture = (drawFn) => {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  drawFn(ctx, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
};

const TEXTURES = {
  checker: createCanvasTexture((ctx, size) => {
    ctx.fillStyle = "#f7f7f7";
    ctx.fillRect(0, 0, size, size);
    const step = size / 8;
    for (let y = 0; y < 8; y += 1) {
      for (let x = 0; x < 8; x += 1) {
        const isDark = (x + y) % 2 === 0;
        ctx.fillStyle = isDark ? "rgba(0,0,0,0.18)" : "rgba(0,0,0,0.06)";
        ctx.fillRect(x * step, y * step, step, step);
      }
    }
  }),
  carbon: createCanvasTexture((ctx, size) => {
    ctx.fillStyle = "#f6f6f6";
    ctx.fillRect(0, 0, size, size);
    const step = size / 10;
    ctx.globalAlpha = 0.22;
    for (let y = -size; y < size * 2; y += step) {
      ctx.fillStyle = "#0a0a0a";
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(size, y + size);
      ctx.lineTo(size, y + size + step / 2);
      ctx.lineTo(0, y + step / 2);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 0.1;
    for (let y = -size; y < size * 2; y += step) {
      ctx.fillStyle = "#0a0a0a";
      ctx.beginPath();
      ctx.moveTo(0, y + step / 2);
      ctx.lineTo(size, y + size + step / 2);
      ctx.lineTo(size, y + size + step);
      ctx.lineTo(0, y + step);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }),
  marble: createCanvasTexture((ctx, size) => {
    ctx.fillStyle = "#fbfbfb";
    ctx.fillRect(0, 0, size, size);
    const lines = 44;
    for (let i = 0; i < lines; i += 1) {
      const y = (i / lines) * size;
      const wobble = Math.sin(i * 0.6) * 14;
      ctx.strokeStyle = `rgba(0,0,0,${0.03 + (i % 7) * 0.004})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-10, y + wobble);
      ctx.bezierCurveTo(size * 0.33, y - 16, size * 0.66, y + 16, size + 10, y - wobble);
      ctx.stroke();
    }
    ctx.globalAlpha = 0.08;
    ctx.fillStyle = "#0a0a0a";
    for (let i = 0; i < 120; i += 1) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      ctx.fillRect(x, y, 1.2, 1.2);
    }
    ctx.globalAlpha = 1;
  })
};

const getSkinById = (id) => SKINS.find((s) => s.id === id) || SKINS[0];
const getSkyById = (id) => SKIES.find((s) => s.id === id) || SKIES[0];

const createSkinMaterial = (skinId, hue) => {
  const skin = getSkinById(skinId);
  const baseColor = new THREE.Color().setHSL(hue, 0.72, 0.58);

  if (skin.kind === "mono") {
    return new THREE.MeshStandardMaterial({ color: new THREE.Color("#111111"), roughness: 0.55, metalness: 0.05 });
  }

  if (skin.kind === "metal") {
    return new THREE.MeshStandardMaterial({ color: baseColor, roughness: 0.22, metalness: 0.75 });
  }

  if (skin.kind === "gold") {
    return new THREE.MeshStandardMaterial({ color: new THREE.Color("#c8a100"), roughness: 0.25, metalness: 0.95 });
  }

  if (skin.kind === "gloss") {
    return new THREE.MeshStandardMaterial({ color: baseColor, roughness: 0.14, metalness: 0.08 });
  }

  if (skin.kind === "checker") {
    const material = new THREE.MeshStandardMaterial({ color: baseColor, roughness: 0.45, metalness: 0.06, map: TEXTURES.checker });
    material.map.repeat.set(2, 2);
    return material;
  }

  if (skin.kind === "carbon") {
    const material = new THREE.MeshStandardMaterial({ color: baseColor, roughness: 0.25, metalness: 0.35, map: TEXTURES.carbon });
    material.map.repeat.set(2, 2);
    return material;
  }

  if (skin.kind === "marble") {
    const material = new THREE.MeshStandardMaterial({ color: baseColor.clone().lerp(new THREE.Color("#ffffff"), 0.45), roughness: 0.55, metalness: 0.04, map: TEXTURES.marble });
    material.map.repeat.set(1.5, 1.5);
    return material;
  }

  return new THREE.MeshStandardMaterial({ color: baseColor, roughness: 0.5, metalness: 0.06 });
};

const createDailyChallenges = (dayKey) => {
  const rng = createSeededRng(dayKey);
  const pool = [
    { type: "place_blocks", name: "Builder", desc: "Place 25 blocks total", goal: 25, reward: 60 },
    { type: "place_blocks", name: "Foreman", desc: "Place 45 blocks total", goal: 45, reward: 110 },
    { type: "score_single", name: "Warmup", desc: "Reach score 15 in one run", goal: 15, reward: 80 },
    { type: "score_single", name: "Climber", desc: "Reach score 25 in one run", goal: 25, reward: 140 },
    { type: "perfect_total", name: "Clean Hands", desc: "Get 12 perfect drops", goal: 12, reward: 90 },
    { type: "perfect_streak", name: "Zen", desc: "Get a perfect streak of 3", goal: 3, reward: 70 }
  ];

  const pickOne = () => pool[Math.floor(rng() * pool.length)];
  const picked = new Set();
  const items = [];

  while (items.length < 3) {
    const candidate = pickOne();
    const key = `${candidate.type}:${candidate.goal}`;
    if (picked.has(key)) continue;
    picked.add(key);
    items.push({
      id: `${dayKey}-${items.length}-${candidate.type}-${candidate.goal}`,
      type: candidate.type,
      name: candidate.name,
      desc: candidate.desc,
      goal: candidate.goal,
      reward: candidate.reward,
      progress: 0,
      completed: false,
      claimed: false
    });
  }

  return items;
};

let saveData = loadSaveData();

const ensureChallengesForToday = () => {
  const today = formatTodayKey();
  if (saveData.challenges?.dayKey !== today || !Array.isArray(saveData.challenges?.items) || saveData.challenges.items.length === 0) {
    saveData.challenges = { dayKey: today, items: createDailyChallenges(today) };
    writeSaveData(saveData);
  }
};

ensureChallengesForToday();

const showComboToast = (text) => {
  dom.comboToast.textContent = text;
  dom.comboToast.classList.remove("hidden");
  window.clearTimeout(showComboToast._t);
  showComboToast._t = window.setTimeout(() => dom.comboToast.classList.add("hidden"), 700);
};

const updateAllUiNumbers = (currentScore) => {
  dom.score.textContent = String(currentScore);
  dom.best.textContent = String(saveData.bestScore);
  dom.stars.textContent = String(saveData.stars);
  dom.menuStars.textContent = String(saveData.stars);
  dom.homeScore.textContent = String(currentScore);
  dom.homeBest.textContent = String(saveData.bestScore);
  dom.currentSkin.textContent = getSkinById(saveData.selectedSkinId).name;
  dom.currentSky.textContent = getSkyById(saveData.selectedSkyId).name;
};

const setActiveTab = (tabId) => {
  for (const btn of dom.tabButtons) {
    const isActive = btn.dataset.tab === tabId;
    btn.classList.toggle("active", isActive);
    btn.setAttribute("aria-selected", String(isActive));
  }
  for (const panel of dom.panels) {
    panel.classList.toggle("active", panel.dataset.panel === tabId);
  }
};

const openMenuOverlay = (mode) => {
  dom.menuOverlay.style.display = "grid";
  if (mode === "gameover") {
    dom.menuTitle.textContent = "Game Over";
    dom.menuSubtitle.textContent = "Spend your stars, upgrade your look, and run it back.";
    dom.btnPlay.textContent = "Play again";
  } else if (mode === "paused") {
    dom.menuTitle.textContent = "Paused";
    dom.menuSubtitle.textContent = "Ready when you are.";
    dom.btnPlay.textContent = "Resume";
  } else {
    dom.menuTitle.textContent = "Stack Plus";
    dom.menuSubtitle.textContent = "Tap to drop. Perfect stacks grow your tower.";
    dom.btnPlay.textContent = "Play";
  }
};

const closeMenuOverlay = () => {
  dom.menuOverlay.style.display = "none";
};

const renderShopGrid = (type) => {
  const items = type === "skins" ? SKINS : SKIES;
  const ownedKey = type === "skins" ? "ownedSkins" : "ownedSkies";
  const selectedKey = type === "skins" ? "selectedSkinId" : "selectedSkyId";
  const grid = type === "skins" ? dom.skinsGrid : dom.skiesGrid;

  grid.innerHTML = "";
  for (const item of items) {
    const isOwned = saveData[ownedKey].includes(item.id);
    const isEquipped = saveData[selectedKey] === item.id;

    const card = document.createElement("div");
    card.className = "shop-item";

    const preview = document.createElement("div");
    preview.className = "shop-preview";
    preview.style.background = type === "skies" ? item.bg : "#f3f3f3";

    const body = document.createElement("div");
    body.className = "shop-body";

    const title = document.createElement("div");
    title.className = "shop-title";
    title.textContent = item.name;

    const meta = document.createElement("div");
    meta.className = "shop-meta";

    const price = document.createElement("div");
    price.className = "price";
    price.textContent = item.cost === 0 ? "Free" : `${item.cost} stars`;

    const badge = document.createElement("span");
    badge.className = "badge " + (isEquipped ? "good" : isOwned ? "" : "warn");
    badge.textContent = isEquipped ? "Equipped" : isOwned ? "Owned" : "Locked";

    meta.append(price, badge);

    const actions = document.createElement("div");
    actions.className = "shop-actions";

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn " + (isEquipped ? "btn-secondary" : "btn-primary");

    if (isEquipped) btn.textContent = "Using";
    else if (isOwned) btn.textContent = "Equip";
    else btn.textContent = "Buy";

    btn.addEventListener("click", () => {
      sound.click();
      if (!isOwned) {
        if (saveData.stars < item.cost) {
          showComboToast("Not enough stars");
          return;
        }
        saveData.stars -= item.cost;
        saveData[ownedKey] = Array.from(new Set([...saveData[ownedKey], item.id]));
      }
      saveData[selectedKey] = item.id;
      writeSaveData(saveData);
      applySelectedSkyToScene();
      updateAllUiNumbers(gameState.score);
      renderShopGrid(type);
    });

    actions.appendChild(btn);

    body.append(title, meta, actions);
    card.append(preview, body);
    grid.appendChild(card);
  }
};

const renderChallenges = () => {
  ensureChallengesForToday();
  dom.challengeList.innerHTML = "";

  for (const ch of saveData.challenges.items) {
    const wrap = document.createElement("div");
    wrap.className = "challenge";

    const top = document.createElement("div");
    top.className = "challenge-top";

    const left = document.createElement("div");
    const title = document.createElement("div");
    title.className = "challenge-title";
    title.textContent = ch.name;

    const desc = document.createElement("div");
    desc.className = "challenge-desc";
    desc.textContent = ch.desc;

    left.append(title, desc);

    const rightBadge = document.createElement("span");
    rightBadge.className = "badge " + (ch.claimed ? "good" : ch.completed ? "good" : "");
    rightBadge.textContent = ch.claimed ? "Claimed" : ch.completed ? "Complete" : `${ch.reward} stars`;

    top.append(left, rightBadge);

    const progress = document.createElement("div");
    progress.className = "progress";
    const bar = document.createElement("div");
    const pct = ch.goal > 0 ? clampNumber(ch.progress / ch.goal, 0, 1) : 0;
    bar.style.width = `${Math.round(pct * 100)}%`;
    progress.appendChild(bar);

    const bottom = document.createElement("div");
    bottom.className = "challenge-bottom";

    const progressText = document.createElement("div");
    progressText.className = "price";
    progressText.textContent = `${Math.min(ch.progress, ch.goal)} / ${ch.goal}`;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn btn-primary";
    btn.textContent = ch.claimed ? "Claimed" : ch.completed ? "Claim" : "In progress";
    btn.disabled = !ch.completed || ch.claimed;

    btn.addEventListener("click", () => {
      if (!ch.completed || ch.claimed) return;
      sound.click();
      ch.claimed = true;
      saveData.stars += ch.reward;
      writeSaveData(saveData);
      updateAllUiNumbers(gameState.score);
      renderChallenges();
      showComboToast(`+${ch.reward} stars`);
    });

    bottom.append(progressText, btn);

    wrap.append(top, progress, bottom);
    dom.challengeList.appendChild(wrap);
  }
};

const updateChallengeProgress = (event) => {
  ensureChallengesForToday();

  let changed = false;

  const applyCompletion = (ch) => {
    const wasCompleted = ch.completed;
    ch.completed = ch.progress >= ch.goal;
    if (!wasCompleted && ch.completed) changed = true;
  };

  for (const ch of saveData.challenges.items) {
    if (ch.claimed) continue;

    if (event.type === "placed_block") {
      if (ch.type === "place_blocks") {
        ch.progress += 1;
        applyCompletion(ch);
      }
    }

    if (event.type === "perfect") {
      if (ch.type === "perfect_total") {
        ch.progress += 1;
        applyCompletion(ch);
      }
      if (ch.type === "perfect_streak") {
        ch.progress = Math.max(ch.progress, event.streak);
        applyCompletion(ch);
      }
    }

    if (event.type === "run_end") {
      if (ch.type === "score_single") {
        ch.progress = Math.max(ch.progress, event.score);
        applyCompletion(ch);
      }
    }
  }

  if (changed) {
    writeSaveData(saveData);
    renderChallenges();
    showComboToast("Challenge complete!");
  } else {
    writeSaveData(saveData);
    renderChallenges();
  }
};

const scene = new THREE.Scene();

const renderer = new THREE.WebGLRenderer({ canvas: dom.canvas, antialias: true, alpha: false });
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 120);
camera.position.set(8, 8, 8);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
scene.add(ambientLight);

const sunLight = new THREE.DirectionalLight(0xffffff, 0.95);
sunLight.position.set(10, 16, 8);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(1024, 1024);
sunLight.shadow.camera.near = 1;
sunLight.shadow.camera.far = 60;
sunLight.shadow.camera.left = -14;
sunLight.shadow.camera.right = 14;
sunLight.shadow.camera.top = 14;
sunLight.shadow.camera.bottom = -14;
scene.add(sunLight);

const groundGeometry = new THREE.PlaneGeometry(120, 120);
const groundMaterial = new THREE.MeshStandardMaterial({ color: new THREE.Color("#F2F2F2"), roughness: 1.0, metalness: 0.0 });
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.26;
ground.receiveShadow = true;
scene.add(ground);

const unitBoxGeometry = new THREE.BoxGeometry(1, 1, 1);

const createBlockMesh = (material) => {
  const mesh = new THREE.Mesh(unitBoxGeometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
};

const createBurstPoints = (colorHex, count) => {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const velocities = new Float32Array(count * 3);
  const startTimes = new Float32Array(count);
  const lifetimes = new Float32Array(count);

  for (let i = 0; i < count; i += 1) {
    positions[i * 3 + 0] = 0;
    positions[i * 3 + 1] = 0;
    positions[i * 3 + 2] = 0;

    const angle = Math.random() * Math.PI * 2;
    const up = 0.6 + Math.random() * 1.6;
    const radius = 0.7 + Math.random() * 1.4;

    velocities[i * 3 + 0] = Math.cos(angle) * radius;
    velocities[i * 3 + 1] = up;
    velocities[i * 3 + 2] = Math.sin(angle) * radius;

    startTimes[i] = 0;
    lifetimes[i] = 0.45 + Math.random() * 0.25;
  }

  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("velocity", new THREE.BufferAttribute(velocities, 3));
  geometry.setAttribute("startTime", new THREE.BufferAttribute(startTimes, 1));
  geometry.setAttribute("lifetime", new THREE.BufferAttribute(lifetimes, 1));

  const material = new THREE.PointsMaterial({
    color: new THREE.Color(colorHex),
    size: 0.08,
    transparent: true,
    opacity: 0.9,
    depthWrite: false
  });

  return new THREE.Points(geometry, material);
};

const gameConfig = {
  blockHeight: 0.5,
  initialSizeX: 3.2,
  initialSizeZ: 3.2,
  spawnOffset: 5.2,
  baseSpeed: 2.25,
  speedIncreasePerScore: 0.03,
  movementRangePadding: 1.1,
  perfectTolerance: 0.08,
  gravity: 20,
  perfectGrowEvery: 3,
  growAmount: 0.16,
  starPerPlaced: 1,
  starPerPerfect: 1,
  starPerPerfectGrow: 2
};

const createInitialGameState = () => ({
  score: 0,
  playing: false,
  gameOver: false,
  axis: "x",
  timeSeconds: 0,
  hue: 0.58,
  perfectStreak: 0,
  stackBlocks: [],
  fallingPieces: [],
  particleBursts: [],
  cameraTarget: new THREE.Vector3(0, 1.6, 0),
  cameraShakeTime: 0,
  cameraShakeStrength: 0
});

let gameState = createInitialGameState();

const applySelectedSkyToScene = () => {
  const sky = getSkyById(saveData.selectedSkyId);
  scene.background = new THREE.Color(sky.bg);
  scene.fog = new THREE.Fog(sky.fog, 10, 36);
  groundMaterial.color = new THREE.Color(sky.ground);
  ambientLight.intensity = sky.ambient;
  sunLight.intensity = sky.sun;
  renderer.toneMappingExposure = sky.exposure;
};

applySelectedSkyToScene();

const clearSceneMeshes = () => {
  for (const block of gameState.stackBlocks) scene.remove(block.mesh);
  for (const piece of gameState.fallingPieces) scene.remove(piece.mesh);
  for (const burst of gameState.particleBursts) scene.remove(burst.points);
};

const createStackBlockRecord = ({ sizeX, sizeZ, centerX, centerZ, y, material }) => {
  const mesh = createBlockMesh(material);
  mesh.scale.set(sizeX, gameConfig.blockHeight, sizeZ);
  mesh.position.set(centerX, y, centerZ);
  scene.add(mesh);

  return { mesh, sizeX, sizeZ, centerX, centerZ, y, isMoving: false, moveDirection: 1, pulse: 0 };
};

const getTopBlock = () => gameState.stackBlocks[gameState.stackBlocks.length - 1];

const spawnMovingBlock = () => {
  const top = getTopBlock();
  const nextAxis = gameState.axis;
  gameState.hue = (gameState.hue + 0.055) % 1;

  const material = createSkinMaterial(saveData.selectedSkinId, gameState.hue);
  const y = top.y + gameConfig.blockHeight;

  const centerX = nextAxis === "x" ? top.centerX - gameConfig.spawnOffset : top.centerX;
  const centerZ = nextAxis === "z" ? top.centerZ - gameConfig.spawnOffset : top.centerZ;

  const moving = createStackBlockRecord({
    sizeX: top.sizeX,
    sizeZ: top.sizeZ,
    centerX,
    centerZ,
    y,
    material
  });

  moving.isMoving = true;
  moving.moveDirection = 1;
  gameState.stackBlocks.push(moving);
};

const resetGame = () => {
  clearSceneMeshes();
  gameState = createInitialGameState();

  const baseMaterial = createSkinMaterial(saveData.selectedSkinId, gameState.hue);
  const base = createStackBlockRecord({
    sizeX: gameConfig.initialSizeX,
    sizeZ: gameConfig.initialSizeZ,
    centerX: 0,
    centerZ: 0,
    y: 0,
    material: baseMaterial
  });

  gameState.stackBlocks.push(base);
  spawnMovingBlock();
};

const resizeRendererToDisplaySize = () => {
  const width = dom.canvas.clientWidth;
  const height = dom.canvas.clientHeight;
  const dpr = clampNumber(window.devicePixelRatio || 1, 1, 2);

  const targetW = Math.floor(width * dpr);
  const targetH = Math.floor(height * dpr);

  if (renderer.domElement.width !== targetW || renderer.domElement.height !== targetH) {
    renderer.setPixelRatio(dpr);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
};

const addCameraShake = (strength, timeSeconds) => {
  gameState.cameraShakeStrength = Math.max(gameState.cameraShakeStrength, strength);
  gameState.cameraShakeTime = Math.max(gameState.cameraShakeTime, timeSeconds);
};

const spawnBurstAt = (position, colorHex) => {
  const points = createBurstPoints(colorHex, 46);
  points.position.copy(position);
  scene.add(points);
  gameState.particleBursts.push({ points, age: 0 });
};

const awardStars = (amount) => {
  if (amount <= 0) return;
  saveData.stars += amount;
  writeSaveData(saveData);
  updateAllUiNumbers(gameState.score);
  showComboToast(`+${amount} stars`);
};

const finalizePlacedBlock = ({ keptSize, keptCenter, cutSize, cutCenter, wasPerfect }) => {
  const current = getTopBlock();
  const axis = gameState.axis;

  const axisPositionKey = axis === "x" ? "x" : "z";
  const axisCenterKey = axis === "x" ? "centerX" : "centerZ";
  const axisSizeKey = axis === "x" ? "sizeX" : "sizeZ";

  current.isMoving = false;
  current[axisCenterKey] = keptCenter;
  current[axisSizeKey] = keptSize;
  current.mesh.position[axisPositionKey] = keptCenter;

  if (axis === "x") current.mesh.scale.x = keptSize;
  if (axis === "z") current.mesh.scale.z = keptSize;

  current.pulse = 0.12;

  if (cutSize > 0.001) {
    const pieceMaterial = current.mesh.material;
    const pieceMesh = createBlockMesh(pieceMaterial);

    const pieceSizeX = axis === "x" ? cutSize : current.sizeX;
    const pieceSizeZ = axis === "z" ? cutSize : current.sizeZ;

    pieceMesh.scale.set(pieceSizeX, gameConfig.blockHeight, pieceSizeZ);

    const pieceX = axis === "x" ? cutCenter : current.centerX;
    const pieceZ = axis === "z" ? cutCenter : current.centerZ;

    pieceMesh.position.set(pieceX, current.y, pieceZ);
    scene.add(pieceMesh);

    const kick = (current.mesh.position[axisPositionKey] - cutCenter) > 0 ? -1 : 1;

    gameState.fallingPieces.push({
      mesh: pieceMesh,
      velocity: new THREE.Vector3(
        axis === "x" ? kick * 2.2 : 0,
        2.0,
        axis === "z" ? kick * 2.2 : 0
      ),
      angularVelocity: new THREE.Vector3(
        (Math.random() * 2 - 1) * 2.2,
        (Math.random() * 2 - 1) * 1.4,
        (Math.random() * 2 - 1) * 2.2
      )
    });
  }

  gameState.score += 1;
  saveData.stats.totalPlacedBlocks += 1;
  saveData.bestScore = Math.max(saveData.bestScore, gameState.score);
  saveData.stats.bestPerfectStreak = Math.max(saveData.stats.bestPerfectStreak, gameState.perfectStreak);
  writeSaveData(saveData);

  awardStars(gameConfig.starPerPlaced + (wasPerfect ? gameConfig.starPerPerfect : 0));

  updateChallengeProgress({ type: "placed_block" });
  if (wasPerfect) updateChallengeProgress({ type: "perfect", streak: gameState.perfectStreak });

  if (wasPerfect && gameState.perfectStreak > 0 && gameState.perfectStreak % gameConfig.perfectGrowEvery === 0) {
    const grownX = clampNumber(current.sizeX + gameConfig.growAmount, 0.6, gameConfig.initialSizeX);
    const grownZ = clampNumber(current.sizeZ + gameConfig.growAmount, 0.6, gameConfig.initialSizeZ);
    current.sizeX = grownX;
    current.sizeZ = grownZ;
    current.mesh.scale.x = grownX;
    current.mesh.scale.z = grownZ;

    spawnBurstAt(current.mesh.position.clone().add(new THREE.Vector3(0, 0.35, 0)), "#c8a100");
    sound.grow();
    addCameraShake(0.08, 0.12);
    awardStars(gameConfig.starPerPerfectGrow);
    showComboToast(`Perfect x${gameState.perfectStreak} - Grow!`);
  }

  gameState.axis = gameState.axis === "x" ? "z" : "x";
  spawnMovingBlock();
  updateAllUiNumbers(gameState.score);
};

const endRun = () => {
  gameState.playing = false;
  gameState.gameOver = true;
  saveData.stats.gamesPlayed += 1;
  writeSaveData(saveData);
  updateChallengeProgress({ type: "run_end", score: gameState.score });
  openMenuOverlay("gameover");
  setActiveTab("home");
};

const tryDropCurrentBlock = () => {
  if (!gameState.playing || gameState.gameOver) return;

  const current = getTopBlock();
  const previous = gameState.stackBlocks[gameState.stackBlocks.length - 2];
  if (!current || !previous) return;

  const axis = gameState.axis;
  const axisKey = axis === "x" ? "centerX" : "centerZ";
  const sizeKey = axis === "x" ? "sizeX" : "sizeZ";

  const currentPos = current[axisKey];
  const previousPos = previous[axisKey];
  const currentSize = current[sizeKey];
  const previousSize = previous[sizeKey];

  const delta = currentPos - previousPos;
  const absDelta = Math.abs(delta);

  addCameraShake(0.06, 0.1);

  if (absDelta <= gameConfig.perfectTolerance) {
    current[axisKey] = previousPos;
    current.mesh.position[axis === "x" ? "x" : "z"] = previousPos;

    gameState.perfectStreak += 1;
    sound.perfect();

    spawnBurstAt(current.mesh.position.clone().add(new THREE.Vector3(0, 0.35, 0)), "#111111");
    showComboToast(`Perfect x${gameState.perfectStreak}`);

    finalizePlacedBlock({ keptSize: currentSize, keptCenter: previousPos, cutSize: 0, cutCenter: 0, wasPerfect: true });
    return;
  }

  const prevMin = previousPos - previousSize / 2;
  const prevMax = previousPos + previousSize / 2;
  const curMin = currentPos - currentSize / 2;
  const curMax = currentPos + currentSize / 2;

  const overlapMin = Math.max(prevMin, curMin);
  const overlapMax = Math.min(prevMax, curMax);
  const overlapSize = overlapMax - overlapMin;

  if (overlapSize <= 0.0001) {
    sound.fail();
    addCameraShake(0.16, 0.16);
    endRun();
    return;
  }

  const keptCenter = (overlapMin + overlapMax) / 2;
  const keptSize = overlapSize;

  const cutSize = currentSize - overlapSize;
  const cutCenter = currentPos < previousPos ? (curMin + overlapMin) / 2 : (overlapMax + curMax) / 2;

  gameState.perfectStreak = 0;
  sound.click();

  finalizePlacedBlock({ keptSize, keptCenter, cutSize, cutCenter, wasPerfect: false });
};

const updateMovingBlock = (dt) => {
  const current = getTopBlock();
  const previous = gameState.stackBlocks[gameState.stackBlocks.length - 2];
  if (!current?.isMoving || !previous) return;

  const axis = gameState.axis;
  const axisPositionKey = axis === "x" ? "x" : "z";
  const axisCenterKey = axis === "x" ? "centerX" : "centerZ";
  const axisSize = axis === "x" ? current.sizeX : current.sizeZ;

  const speed = gameConfig.baseSpeed + gameState.score * gameConfig.speedIncreasePerScore;
  const movementRange = axisSize / 2 + gameConfig.movementRangePadding + 2.0;
  const origin = axis === "x" ? previous.centerX : previous.centerZ;

  let nextValue = current.mesh.position[axisPositionKey] + current.moveDirection * speed * dt;
  const min = origin - movementRange;
  const max = origin + movementRange;

  if (nextValue < min) {
    nextValue = min;
    current.moveDirection = 1;
  } else if (nextValue > max) {
    nextValue = max;
    current.moveDirection = -1;
  }

  current.mesh.position[axisPositionKey] = nextValue;
  current[axisCenterKey] = nextValue;
};

const updateFallingPieces = (dt) => {
  const gravity = gameConfig.gravity;
  const remaining = [];
  for (const piece of gameState.fallingPieces) {
    piece.velocity.y -= gravity * dt;

    piece.mesh.position.x += piece.velocity.x * dt;
    piece.mesh.position.y += piece.velocity.y * dt;
    piece.mesh.position.z += piece.velocity.z * dt;

    piece.mesh.rotation.x += piece.angularVelocity.x * dt;
    piece.mesh.rotation.y += piece.angularVelocity.y * dt;
    piece.mesh.rotation.z += piece.angularVelocity.z * dt;

    if (piece.mesh.position.y > -14) remaining.push(piece);
    else scene.remove(piece.mesh);
  }
  gameState.fallingPieces = remaining;
};

const updateParticles = (dt) => {
  const remaining = [];
  for (const burst of gameState.particleBursts) {
    burst.age += dt;
    const points = burst.points;
    const geometry = points.geometry;

    const positions = geometry.getAttribute("position");
    const velocities = geometry.getAttribute("velocity");
    const lifetimes = geometry.getAttribute("lifetime");

    const count = positions.count;
    const fade = clampNumber(1 - burst.age / 0.7, 0, 1);
    points.material.opacity = 0.9 * fade;

    for (let i = 0; i < count; i += 1) {
      const life = lifetimes.getX(i);
      if (burst.age > life) continue;

      const vx = velocities.getX(i);
      const vy = velocities.getY(i) - 2.6 * burst.age;
      const vz = velocities.getZ(i);

      positions.setXYZ(
        i,
        vx * burst.age,
        vy * burst.age,
        vz * burst.age
      );
    }

    positions.needsUpdate = true;

    if (burst.age < 0.8) remaining.push(burst);
    else scene.remove(points);
  }
  gameState.particleBursts = remaining;
};

const updatePlacedBlockPulse = (dt) => {
  for (const block of gameState.stackBlocks) {
    if (!block.pulse || block.pulse <= 0) continue;
    block.pulse = Math.max(0, block.pulse - dt);
    const t = block.pulse / 0.12;
    const bump = 1 + 0.06 * Math.sin((1 - t) * Math.PI);
    block.mesh.scale.y = gameConfig.blockHeight * bump;
  }
  const top = getTopBlock();
  if (top && (!top.pulse || top.pulse <= 0)) top.mesh.scale.y = gameConfig.blockHeight;
};

const updateCamera = (dt) => {
  const top = getTopBlock();
  if (!top) return;

  const desiredTarget = new THREE.Vector3(top.centerX, top.y + 1.2, top.centerZ);
  gameState.cameraTarget.lerp(desiredTarget, 1 - Math.pow(0.001, dt));

  const basePos = new THREE.Vector3(
    gameState.cameraTarget.x + 8,
    gameState.cameraTarget.y + 7,
    gameState.cameraTarget.z + 8
  );

  if (gameState.cameraShakeTime > 0) {
    gameState.cameraShakeTime = Math.max(0, gameState.cameraShakeTime - dt);
    const shakeT = gameState.cameraShakeTime;
    const s = gameState.cameraShakeStrength * (shakeT / 0.16);
    basePos.x += (Math.random() * 2 - 1) * s;
    basePos.y += (Math.random() * 2 - 1) * s;
    basePos.z += (Math.random() * 2 - 1) * s;
    if (gameState.cameraShakeTime === 0) gameState.cameraShakeStrength = 0;
  }

  camera.position.lerp(basePos, 1 - Math.pow(0.001, dt));
  camera.lookAt(gameState.cameraTarget);
};

let lastTimeMs = performance.now();
const tick = (nowMs) => {
  const dt = clampNumber((nowMs - lastTimeMs) / 1000, 0, 0.033);
  lastTimeMs = nowMs;

  resizeRendererToDisplaySize();

  if (gameState.playing && !gameState.gameOver) updateMovingBlock(dt);
  updateFallingPieces(dt);
  updateParticles(dt);
  updatePlacedBlockPulse(dt);
  updateCamera(dt);

  renderer.render(scene, camera);
  requestAnimationFrame(tick);
};

const isEventFromUi = (target) => {
  if (!(target instanceof HTMLElement)) return false;
  return !!target.closest('[data-ui="true"], button, .card, .overlay');
};

const handlePrimaryAction = () => {
  if (dom.menuOverlay.style.display !== "none") return;
  if (!gameState.playing) {
    gameState.playing = true;
    gameState.gameOver = false;
    closeMenuOverlay();
    return;
  }
  tryDropCurrentBlock();
};

dom.btnHow.addEventListener("click", () => {
  dom.how.classList.toggle("hidden");
});

dom.btnMenu.addEventListener("click", () => {
  sound.click();
  if (dom.menuOverlay.style.display === "none") {
    openMenuOverlay(gameState.gameOver ? "gameover" : gameState.playing ? "paused" : "home");
    setActiveTab("home");
    gameState.playing = false;
  } else {
    closeMenuOverlay();
    if (!gameState.gameOver) gameState.playing = true;
  }
});

dom.btnCloseMenu.addEventListener("click", () => {
  sound.click();
  closeMenuOverlay();
  if (!gameState.gameOver) gameState.playing = true;
});

dom.btnPlay.addEventListener("click", () => {
  sound.click();
  closeMenuOverlay();
  if (gameState.gameOver) {
    resetGame();
    gameState.playing = true;
    gameState.gameOver = false;
    updateAllUiNumbers(gameState.score);
    return;
  }
  gameState.playing = true;
});

dom.btnRestart.addEventListener("click", () => {
  sound.click();
  resetGame();
  gameState.playing = true;
  gameState.gameOver = false;
  updateAllUiNumbers(gameState.score);
});

dom.btnSound.addEventListener("click", () => {
  const next = !sound.getEnabled();
  sound.setEnabled(next);
  dom.btnSound.textContent = `Sound: ${next ? "On" : "Off"}`;
  dom.btnSound.setAttribute("aria-pressed", String(next));
  if (next) sound.click();
});

dom.tabButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    sound.click();
    setActiveTab(btn.dataset.tab);
  });
});

dom.jumpButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    sound.click();
    setActiveTab(btn.getAttribute("data-tab-jump"));
  });
});

window.addEventListener("pointerdown", (e) => {
  if (isEventFromUi(e.target)) return;
  handlePrimaryAction();
});

window.addEventListener("keydown", (e) => {
  if (e.code === "Space") {
    e.preventDefault();
    handlePrimaryAction();
  }
});

resetGame();
renderShopGrid("skins");
renderShopGrid("skies");
renderChallenges();
setActiveTab("home");
openMenuOverlay("home");
updateAllUiNumbers(gameState.score);

requestAnimationFrame(tick);