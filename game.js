import audio from './audio.js';

// === ゲームの設定定数 ===
const CANVAS_WIDTH = 256;
const CANVAS_HEIGHT = 320;
const FPS = 60;
const FRAME_TIME = 1000 / FPS;

// ゲーム状態
const STATE_TITLE = 'title';
const STATE_SELECT_DIFFICULTY = 'select_difficulty';
const STATE_SELECT_ABILITY = 'select_ability';
const STATE_PLAYING = 'playing';
const STATE_GAMEOVER = 'gameover';

// 難易度設定
const DIFFICULTIES = {
  EASY: { label: 'EASY', lives: 5, bulletSpeedMult: 0.6, spawnRateMult: 0.7, scoreMult: 0.5 },
  NORMAL: { label: 'NORMAL', lives: 3, bulletSpeedMult: 1.0, spawnRateMult: 1.0, scoreMult: 1.0 },
  HELL: { label: 'HELL', lives: 1, bulletSpeedMult: 1.4, spawnRateMult: 1.5, scoreMult: 2.0 }
};

// 特殊能力（ギミック）設定
const ABILITIES = {
  CLASSIC: { label: 'CLASSIC (NONE)', desc: 'NO ABILITY', scoreMult: 1.5 },
  SLOW: { label: 'TIME SLOW', desc: '[SPACE] SLOWS TIME', scoreMult: 1.0 },
  SHIELD: { label: 'SHIELD', desc: '[SPACE] BARRIER', scoreMult: 1.0 }
};

// === ピクセルアートデータ (8x8 グリッド) ===
const PLAYER_ART = [
  [0,0,0,1,1,0,0,0],
  [0,0,1,2,2,1,0,0],
  [0,1,1,2,2,1,1,0],
  [0,1,2,2,2,2,1,0],
  [1,1,3,1,1,3,1,1],
  [1,3,3,3,3,3,3,1],
  [1,1,0,0,0,0,1,1],
  [1,0,0,0,0,0,0,1]
];
const PLAYER_COLORS = { 1: '#00ffff', 2: '#ffffff', 3: '#0088ff' };

const ENEMY_BASIC_ART = [
  [0,1,0,0,0,0,1,0],
  [0,0,1,1,1,1,0,0],
  [0,1,1,2,2,1,1,0],
  [1,1,2,2,2,2,1,1],
  [1,1,1,1,1,1,1,1],
  [0,0,1,1,1,1,0,0],
  [0,1,0,0,0,0,1,0],
  [1,0,0,0,0,0,0,1]
];
const ENEMY_BASIC_COLORS = { 1: '#ff2a6d', 2: '#ffffff' };

const ENEMY_TRACKING_ART = [
  [0,0,1,1,1,1,0,0],
  [0,1,2,2,2,2,1,0],
  [1,2,3,3,3,3,2,1],
  [1,2,3,1,1,3,2,1],
  [1,2,3,3,3,3,2,1],
  [0,1,2,2,2,2,1,0],
  [0,0,1,0,0,1,0,0],
  [0,1,0,0,0,0,1,0]
];
const ENEMY_TRACKING_COLORS = { 1: '#05d9e8', 2: '#ffffff', 3: '#01595c' };

const ENEMY_SPIRAL_ART = [
  [0,0,1,1,1,1,0,0],
  [0,1,2,2,2,2,1,0],
  [1,2,3,3,3,3,2,1],
  [1,2,3,2,2,3,2,1],
  [1,2,3,3,3,3,2,1],
  [0,1,2,2,2,2,1,0],
  [0,0,1,1,1,1,0,0],
  [0,0,0,0,0,0,0,0]
];
const ENEMY_SPIRAL_COLORS = { 1: '#ff7700', 2: '#ffaa00', 3: '#ffff00' };

const ENEMY_BOSS_ART = [
  [0,0,1,1,1,1,1,1,1,1,0,0],
  [0,1,1,2,2,2,2,2,2,1,1,0],
  [1,1,2,3,3,2,2,3,3,2,1,1],
  [1,2,2,3,3,2,2,3,3,2,2,1],
  [1,2,2,2,2,2,2,2,2,2,2,1],
  [1,1,2,1,1,1,1,1,1,2,1,1],
  [0,1,1,2,2,2,2,2,2,1,1,0],
  [0,0,1,1,1,1,1,1,1,1,0,0]
]; // 12x8
const ENEMY_BOSS_COLORS = { 1: '#f5a623', 2: '#d0021b', 3: '#ffffff' };

const CRYSTAL_ART = [
  [0,0,1,1,0,0],
  [0,1,2,2,1,0],
  [1,2,2,2,2,1],
  [1,2,2,2,2,1],
  [0,1,2,2,1,0],
  [0,0,1,1,0,0]
]; // 6x6
const CRYSTAL_COLORS = { 1: '#ffea00', 2: '#ffffff' };

// === ゲームシステム変数 ===
let canvas, ctx;
let gameState = STATE_TITLE;
let lastTime = 0;
let accumulator = 0;

// 選択中の設定
let selectedDifficulty = 'NORMAL';
let selectedAbility = 'CLASSIC';
let menuIndex = 0;

// ゲームプレイ中のエンティティ
let player = {
  x: 0,
  y: 0,
  width: 16,
  height: 16,
  hitboxRadius: 1.0, // より厳しい当たり判定（1ピクセル）
  speed: 2.2,
  lives: 3,
  maxLives: 3,
  invincibleFrames: 0,
  abilityGauge: 100, // 0 - 100 (TIME SLOW用)
  abilityCooldown: 0, // フレーム数 (SHIELD用)
  shieldActiveFrames: 0 // シールド展開残りフレーム
};

let enemies = [];
let bullets = [];
let items = [];
let particles = [];
let scorePopups = []; // スコアポップアップテキスト用配列

// スコアとタイマー
let score = 0;
let gameFrame = 0;
let survivalTime = 0; // 生き残り秒数
let nextEnemySpawnFrame = 0;
let bossActive = false;

// キーボード入力の状態
const keys = {};

// === ユーティリティ関数 ===

// ピクセルアート描画
function drawPixelArt(art, x, y, pixelSize, colorMap, angle = 0) {
  ctx.save();
  ctx.translate(x, y);
  if (angle !== 0) {
    ctx.rotate(angle);
  }
  const rows = art.length;
  const cols = art[0].length;
  const offsetX = -(cols * pixelSize) / 2;
  const offsetY = -(rows * pixelSize) / 2;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const colorIndex = art[r][c];
      if (colorIndex > 0) {
        ctx.fillStyle = colorMap[colorIndex];
        ctx.fillRect(offsetX + c * pixelSize, offsetY + r * pixelSize, pixelSize, pixelSize);
      }
    }
  }
  ctx.restore();
}

// プレイヤーにダメージを与える
function damagePlayer() {
  if (player.invincibleFrames > 0 || player.shieldActiveFrames > 0) return;

  player.lives--;
  player.invincibleFrames = 120; // 2秒無敵
  audio.playHit();
  triggerScreenShake();

  // 周囲の弾を消滅させるボム的演出
  createExplosion(player.x, player.y, '#ffffff', 40);
  bullets = [];

  if (player.lives <= 0) {
    gameState = STATE_GAMEOVER;
    audio.stopBGM();
    audio.playGameOver();
    saveHighScore();
  }
}

// 画面揺らし
function triggerScreenShake() {
  const container = document.querySelector('.screen-container');
  if (container) {
    container.classList.add('shake');
    setTimeout(() => {
      container.classList.remove('shake');
    }, 150);
  }
}

// パーティクル生成
function createExplosion(x, y, color, count = 10) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 0.5 + Math.random() * 2.0;
    particles.push({
      x: x,
      y: y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      color: color,
      size: 1 + Math.floor(Math.random() * 3),
      life: 20 + Math.random() * 30
    });
  }
}

// ハイスコアのキー名取得
function getHighScoreKey() {
  return `antishooting_highscore_${selectedDifficulty}_${selectedAbility}`;
}

// ハイスコアのロード
function getHighScore() {
  const key = getHighScoreKey();
  return parseInt(localStorage.getItem(key) || '0', 10);
}

// ハイスコアの保存
function saveHighScore() {
  const currentHigh = getHighScore();
  const finalScore = Math.floor(score);
  if (finalScore > currentHigh) {
    localStorage.setItem(getHighScoreKey(), finalScore.toString());
  }
}

// === 初期化 ===
window.addEventListener('DOMContentLoaded', () => {
  canvas = document.getElementById('gameCanvas');
  ctx = canvas.getContext('2d');
  
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  ctx.imageSmoothingEnabled = false;

  // イベントリスナー設定
  window.addEventListener('keydown', (e) => {
    keys[e.code] = true;
    
    // オーディオ初期化のトリガー (ユーザーの最初のキー入力でアクティベート)
    audio.init();

    handleMenuInput(e.code);
  });

  window.addEventListener('keyup', (e) => {
    keys[e.code] = false;
  });

  // 音量切り替えボタン
  const muteBtn = document.getElementById('muteBtn');
  if (muteBtn) {
    muteBtn.addEventListener('click', () => {
      audio.init();
      const isMuted = audio.toggleMute();
      muteBtn.textContent = isMuted ? 'SOUND: OFF' : 'SOUND: ON';
      muteBtn.classList.toggle('muted', isMuted);
    });
  }

  // アプリ起動ループ
  requestAnimationFrame(gameLoop);
});

// === メニュー入力ハンドラー ===
function handleMenuInput(code) {
  // ESCキーでいつでもタイトルに戻る（終了）
  if (code === 'Escape' && gameState !== STATE_TITLE) {
    audio.playSelect();
    audio.stopBGM();
    enemies = [];
    bullets = [];
    particles = [];
    scorePopups = [];
    gameState = STATE_TITLE;
    return;
  }

  if (gameState === STATE_TITLE) {
    if (code === 'Enter' || code === 'Space') {
      audio.playSelect();
      gameState = STATE_SELECT_DIFFICULTY;
      menuIndex = 1; // デフォルト NORMAL (0: EASY, 1: NORMAL, 2: HELL)
    }
  } 
  else if (gameState === STATE_SELECT_DIFFICULTY) {
    if (code === 'ArrowUp' || code === 'KeyW') {
      audio.playSelect();
      menuIndex = (menuIndex - 1 + 3) % 3;
    } else if (code === 'ArrowDown' || code === 'KeyS') {
      audio.playSelect();
      menuIndex = (menuIndex + 1) % 3;
    } else if (code === 'Enter' || code === 'Space') {
      audio.playSelect();
      const diffKeys = Object.keys(DIFFICULTIES);
      selectedDifficulty = diffKeys[menuIndex];
      gameState = STATE_SELECT_ABILITY;
      menuIndex = 0; // デフォルト CLASSIC
    }
  } 
  else if (gameState === STATE_SELECT_ABILITY) {
    if (code === 'ArrowUp' || code === 'KeyW') {
      audio.playSelect();
      menuIndex = (menuIndex - 1 + 3) % 3;
    } else if (code === 'ArrowDown' || code === 'KeyS') {
      audio.playSelect();
      menuIndex = (menuIndex + 1) % 3;
    } else if (code === 'Enter' || code === 'Space') {
      audio.playStart();
      const abKeys = Object.keys(ABILITIES);
      selectedAbility = abKeys[menuIndex];
      initGame();
    }
  } 
  else if (gameState === STATE_GAMEOVER) {
    if (code === 'Enter' || code === 'Space') {
      audio.playSelect();
      gameState = STATE_TITLE;
    }
  }
}

// === ゲームプレイ初期化 ===
function initGame() {
  const diffSetting = DIFFICULTIES[selectedDifficulty];
  player.lives = diffSetting.lives;
  player.maxLives = diffSetting.lives;
  player.x = CANVAS_WIDTH / 2;
  player.y = CANVAS_HEIGHT / 2; // スタート位置を画面中央に変更
  player.invincibleFrames = 60;
  player.abilityGauge = 100;
  player.abilityCooldown = 0;
  player.shieldActiveFrames = 0;
  player.isSlowActive = false;

  enemies = [];
  bullets = [];
  items = [];
  particles = [];
  scorePopups = []; // 初期化
  
  score = 0;
  gameFrame = 0;
  survivalTime = 0;
  nextEnemySpawnFrame = 180; // 最初の敵出現を遅く（3秒後）
  bossActive = false;

  audio.stopBGM();
  // BGM開始
  audio.isSlow = false;
  audio.bgmIndex = 0;
  audio.tempo = 135;
  audio.startBGM();

  gameState = STATE_PLAYING;
}

// === ゲームメインループ ===
function gameLoop(time) {
  if (!lastTime) lastTime = time;
  let dt = time - lastTime;
  lastTime = time;

  // 最大フレーム飛びを抑制
  if (dt > 100) dt = FRAME_TIME;

  accumulator += dt;

  while (accumulator >= FRAME_TIME) {
    update();
    accumulator -= FRAME_TIME;
  }

  draw();
  requestAnimationFrame(gameLoop);
}

// === アップデート処理 ===
function update() {
  if (gameState !== STATE_PLAYING) {
    // メニュー用の星屑などの背景アニメーション
    updateStars();
    return;
  }

  gameFrame++;
  survivalTime = gameFrame / FPS;

  // 特殊能力（タイムスロー）のアクティブ判定
  const isSlowWanted = (selectedAbility === 'SLOW' && keys['Space'] && player.abilityGauge > 0);
  if (isSlowWanted) {
    if (!player.isSlowActive) {
      player.isSlowActive = true;
      audio.playSlowSfx();
      audio.isSlow = true; // BGMスロー
    }
    player.abilityGauge = Math.max(0, player.abilityGauge - 0.6); // ゲージ消費
  } else {
    if (player.isSlowActive) {
      player.isSlowActive = false;
      audio.isSlow = false; // BGM元に戻す
    }
    // スローを使用していない時はゲージ回復
    if (selectedAbility === 'SLOW') {
      player.abilityGauge = Math.min(100, player.abilityGauge + 0.15);
    }
  }

  // スロー係数の設定（スロー中はゲーム内の更新レートを部分的に落とす）
  const timeStep = player.isSlowActive ? 0.3 : 1.0;

  // 背景の更新
  updateStars(timeStep);

  // 特殊能力（シールド）のクールダウンと発動処理
  if (selectedAbility === 'SHIELD') {
    if (player.abilityCooldown > 0) {
      player.abilityCooldown = Math.max(0, player.abilityCooldown - timeStep);
    }
    if (keys['Space'] && player.abilityCooldown === 0 && player.shieldActiveFrames === 0) {
      player.shieldActiveFrames = 90; // 1.5秒間シールド展開
      player.abilityCooldown = 480; // 8秒間クールダウン
      audio.playShield();
      createExplosion(player.x, player.y, '#00ffff', 15);
    }
    if (player.shieldActiveFrames > 0) {
      player.shieldActiveFrames = Math.max(0, player.shieldActiveFrames - timeStep);
    }
  }

  // 無敵フレーム更新
  if (player.invincibleFrames > 0) {
    player.invincibleFrames = Math.max(0, player.invincibleFrames - timeStep);
  }

  // プレイヤー移動
  updatePlayer();

  // 敵の生成管理
  handleEnemySpawning(timeStep);

  // 敵の更新
  updateEnemies(timeStep);

  // 弾の更新
  updateBullets(timeStep);

  // パーティクルの更新
  updateParticles(timeStep);

  // 衝突判定
  checkCollisions();

  // スコアポップアップの更新
  updateScorePopups(timeStep);

  // スコアの自動増加（生き残りボーナス）
  const diffSetting = DIFFICULTIES[selectedDifficulty];
  const abSetting = ABILITIES[selectedAbility];
  score += 0.05 * diffSetting.scoreMult * abSetting.scoreMult * timeStep;
}

// 星屑の背景配列
const stars = Array.from({ length: 40 }, () => ({
  x: Math.random() * CANVAS_WIDTH,
  y: Math.random() * CANVAS_HEIGHT,
  speed: 0.5 + Math.random() * 1.5,
  size: Math.random() < 0.2 ? 2 : 1
}));

function updateStars(timeStep = 1.0) {
  stars.forEach(star => {
    star.y += star.speed * timeStep;
    if (star.y > CANVAS_HEIGHT) {
      star.y = 0;
      star.x = Math.random() * CANVAS_WIDTH;
    }
  });
}

// プレイヤー移動処理
function updatePlayer() {
  let dx = 0;
  let dy = 0;

  if (keys['ArrowUp'] || keys['KeyW']) dy -= 1;
  if (keys['ArrowDown'] || keys['KeyS']) dy += 1;
  if (keys['ArrowLeft'] || keys['KeyA']) dx -= 1;
  if (keys['ArrowRight'] || keys['KeyD']) dx += 1;

  // 斜め移動時の正規化
  if (dx !== 0 && dy !== 0) {
    dx *= 0.7071;
    dy *= 0.7071;
  }

  player.x += dx * player.speed;
  player.y += dy * player.speed;

  // 画面端のクランプ
  const halfW = player.width / 2;
  const halfH = player.height / 2;
  player.x = Math.max(halfW, Math.min(CANVAS_WIDTH - halfW, player.x));
  player.y = Math.max(halfH, Math.min(CANVAS_HEIGHT - halfH, player.y));

  // エンジン火花パーティクル
  if (gameFrame % 3 === 0 && (dx !== 0 || dy !== 0 || Math.random() < 0.3)) {
    particles.push({
      x: player.x - dx * 4,
      y: player.y + halfH - 2,
      vx: (Math.random() - 0.5) * 0.5 - dx * 0.5,
      vy: 0.8 + Math.random() * 0.8,
      color: Math.random() < 0.5 ? '#00ffff' : '#0055ff',
      size: 1,
      life: 10 + Math.random() * 10
    });
  }
}

// 敵出現管理
function handleEnemySpawning(timeStep) {
  const diffSetting = DIFFICULTIES[selectedDifficulty];
  
  if (bossActive) return;

  // 定期的な中ボス/ボス出現 (生存時間60秒ごと)
  if (Math.floor(survivalTime) > 0 && Math.floor(survivalTime) % 60 === 0 && !bossActive && enemies.length === 0) {
    spawnBoss();
    return;
  }

  // 通常の敵スポンタイマー
  nextEnemySpawnFrame -= timeStep;
  if (nextEnemySpawnFrame <= 0) {
    spawnRandomEnemy();
    // 経過時間でスポン頻度が上がる（最初は遅く、生存時間とともに徐々に激化）
    const spawnDelay = Math.max(25, 220 - (survivalTime * 1.5)) / diffSetting.spawnRateMult;
    nextEnemySpawnFrame = spawnDelay;
  }
}

function spawnRandomEnemy() {
  const rand = Math.random();
  const diffSetting = DIFFICULTIES[selectedDifficulty];

  if (rand < 0.4) {
    // 1. 直進エネミー (上からまっすぐ降りて、角度可変で弾を撃ち去る)
    enemies.push({
      type: 'basic',
      x: 20 + Math.random() * (CANVAS_WIDTH - 40),
      y: -10,
      vy: 1.0 + Math.random() * 0.8,
      vx: 0,
      width: 16,
      height: 16,
      shootCooldown: 30 + Math.random() * 40,
      shootInterval: 90 / diffSetting.bulletSpeedMult, // 射撃間隔を延長 (50 -> 90)
      life: 1
    });
  } else if (rand < 0.8) {
    // 2. 横断/追尾エネミー (上部でプレイヤーの周辺に向かってX軸移動しながら降下)
    enemies.push({
      type: 'tracking',
      x: Math.random() < 0.5 ? -10 : CANVAS_WIDTH + 10,
      y: 15 + Math.random() * 40,
      vx: (Math.random() < 0.5 ? 1 : -1) * (0.8 + Math.random() * 0.6),
      vy: 0.2,
      targetOffsetX: (Math.random() - 0.5) * 100, // プレイヤーとのX軸オフセット（一列に並ぶのを防ぐ）
      width: 16,
      height: 16,
      shootCooldown: 20 + Math.random() * 30,
      shootInterval: 120 / diffSetting.bulletSpeedMult, // 射撃間隔を大幅延長 (60 -> 120)
      life: 1
    });
  } else {
    // 3. 螺旋敵 (上からゆっくり降りながら螺旋状に弾を放出)
    enemies.push({
      type: 'spiral',
      x: 20 + Math.random() * (CANVAS_WIDTH - 40),
      y: -10,
      vy: 0.6,
      vx: 0,
      width: 16,
      height: 16,
      shootCooldown: 30,
      shootPattern: 0,
      shootInterval: 100 / diffSetting.bulletSpeedMult,
      life: 1
    });
  }
}

function spawnBoss() {
  bossActive = true;
  enemies.push({
    type: 'boss',
    x: CANVAS_WIDTH / 2,
    y: -30,
    targetY: 60,
    vx: 0.5,
    vy: 1.0,
    width: 24,
    height: 16,
    shootCooldown: 40,
    shootPattern: 0,
    maxLife: 900, // ボスは攻撃できないため「生存タイマー」を体力として扱う (約15秒で自爆)
    life: 900
  });
}

// 敵の挙動更新
function updateEnemies(timeStep) {
  const diffSetting = DIFFICULTIES[selectedDifficulty];

  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];

    if (e.type === 'basic') {
      e.y += e.vy * timeStep;
      
      // 弾撃ち
      e.shootCooldown -= timeStep;
      if (e.shootCooldown <= 0) {
        e.shootCooldown = e.shootInterval;
        fire3Way(e.x, e.y + 4, diffSetting.bulletSpeedMult);
      }
      
      // 画面外で消去
      if (e.y > CANVAS_HEIGHT + 16) {
        enemies.splice(i, 1);
        continue;
      }
    } 
    else if (e.type === 'tracking') {
      // プレイヤーのX座標＋個別オフセットにゆっくり吸い寄せられつつ横移動
      const targetX = player.x + (e.targetOffsetX || 0);
      const targetVx = targetX > e.x ? 0.7 : -0.7;
      e.vx += (targetVx - e.vx) * 0.05 * timeStep;
      e.x += e.vx * timeStep;
      e.y += e.vy * timeStep;

      e.shootCooldown -= timeStep;
      if (e.shootCooldown <= 0) {
        e.shootCooldown = e.shootInterval;
        // 弾の数を6方向から4方向に減少
        fireRing(e.x, e.y + 4, 4, diffSetting.bulletSpeedMult);
      }

      if (e.y > CANVAS_HEIGHT + 16 || e.x < -20 || e.x > CANVAS_WIDTH + 20) {
        enemies.splice(i, 1);
        continue;
      }
    }
    else if (e.type === 'spiral') {
      e.y += e.vy * timeStep;

      // 螺旋パターンで弾を発射
      e.shootCooldown -= timeStep;
      if (e.shootCooldown <= 0) {
        e.shootCooldown = e.shootInterval;
        fireSpiral(e.x, e.y + 4, e.shootPattern, diffSetting.bulletSpeedMult);
        e.shootPattern = (e.shootPattern + 1) % 360;
      }

      // 画面外で消去
      if (e.y > CANVAS_HEIGHT + 16) {
        enemies.splice(i, 1);
        continue;
      }
    }
    else if (e.type === 'boss') {
      e.life -= timeStep;
      
      // 登場演出：指定Y座標まで降りてくる
      if (e.y < e.targetY) {
        e.y += e.vy * timeStep;
      } else {
        // 画面上部を左右にうろうろ
        e.x += e.vx * timeStep;
        if (e.x < 40 || e.x > CANVAS_WIDTH - 40) {
          e.vx = -e.vx;
        }
        
        // 激しい弾幕攻撃
        e.shootCooldown -= timeStep;
        if (e.shootCooldown <= 0) {
          e.shootCooldown = 12; // 連射速度を少しマイルドに (6 -> 12)
          e.shootPattern = (e.shootPattern + 1) % 360;
          
          // ボス弾幕：回転する2重螺旋
          const angle1 = (e.shootPattern * 8) * Math.PI / 180;
          const angle2 = angle1 + Math.PI; // 対称
          
          // ボス弾幕の弾サイズを3から6に拡大
          fireBullet(e.x, e.y + 6, Math.cos(angle1) * 1.5, Math.sin(angle1) * 1.5, '#f5a623', 6);
          fireBullet(e.x, e.y + 6, Math.cos(angle2) * 1.5, Math.sin(angle2) * 1.5, '#f5a623', 6);
          
          // 追加弾の発射頻度を半分に減少 (30 -> 60)
          if (e.shootPattern % 60 === 0) {
            fireRing(e.x, e.y + 6, 10, diffSetting.bulletSpeedMult * 0.8, '#ff00ff');
          }
        }
      }

      // 時間経過で自爆
      if (e.life <= 0) {
        createExplosion(e.x, e.y, '#f5a623', 60);
        audio.playHit();
        triggerScreenShake();
        
        enemies.splice(i, 1);
        bossActive = false;
        continue;
      }
    }
  }
}

// === 弾幕発射アルゴリズム ===
// 弾の通常サイズを2から4に拡大
function fireBullet(x, y, vx, vy, color = '#ff2a6d', size = 4) {
  bullets.push({ x, y, vx, vy, color, size });
}

// 3方向扇状弾
function fire3Way(x, y, speedMult) {
  const baseSpeed = 1.3 * speedMult;
  const angleToPlayer = Math.atan2(player.y - y, player.x - x);
  const spread = 0.26; // 約15度
  
  fireBullet(x, y, Math.cos(angleToPlayer) * baseSpeed, Math.sin(angleToPlayer) * baseSpeed);
  fireBullet(x, y, Math.cos(angleToPlayer - spread) * baseSpeed, Math.sin(angleToPlayer - spread) * baseSpeed);
  fireBullet(x, y, Math.cos(angleToPlayer + spread) * baseSpeed, Math.sin(angleToPlayer + spread) * baseSpeed);
}

// 全方位（リング）弾
function fireRing(x, y, count, speedMult, color = '#ff7700') {
  const speed = 1.1 * speedMult;
  const step = (Math.PI * 2) / count;
  for (let i = 0; i < count; i++) {
    const angle = i * step;
    fireBullet(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, color);
  }
}

// 螺旋状弾発射
function fireSpiral(x, y, shootPattern, speedMult, color = '#ff7700') {
  const speed = 1.2 * speedMult;
  const baseAngle = (shootPattern * 12) * Math.PI / 180; // 12度ずつ回転

  // 内側の螺旋
  const innerCount = 4;
  const innerStep = (Math.PI * 2) / innerCount;
  for (let i = 0; i < innerCount; i++) {
    const angle = baseAngle + i * innerStep;
    fireBullet(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, color);
  }

  // 外側の螺旋（逆方向）
  const outerCount = 4;
  const outerStep = (Math.PI * 2) / outerCount;
  for (let i = 0; i < outerCount; i++) {
    const angle = -baseAngle + i * outerStep;
    fireBullet(x, y, Math.cos(angle) * (speed * 0.8), Math.sin(angle) * (speed * 0.8), color, 3);
  }
}

// 弾の更新
function updateBullets(timeStep) {
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    
    // スローの影響を受ける
    b.x += b.vx * timeStep;
    b.y += b.vy * timeStep;

    // 画面外に出たら削除
    if (b.y < -10 || b.y > CANVAS_HEIGHT + 10 || b.x < -10 || b.x > CANVAS_WIDTH + 10) {
      bullets.splice(i, 1);
    }
  }
}

// アイテムの更新
function updateItems(timeStep) {
  for (let i = items.length - 1; i >= 0; i--) {
    const item = items[i];

    // 自機との距離計算 (吸い込み判定)
    const dx = player.x - item.x;
    const dy = player.y - item.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // 80ピクセル以内なら吸い込む
    if (dist < 80) {
      const pullSpeed = 3.5;
      item.vx = (dx / dist) * pullSpeed;
      item.vy = (dy / dist) * pullSpeed;
    } else {
      item.vx = item.vx ? item.vx * 0.95 : 0;
      item.vy = 1.0; // 通常降下
    }

    item.x += item.vx * timeStep;
    item.y += item.vy * timeStep;

    // 画面外削除
    if (item.y > CANVAS_HEIGHT + 10) {
      items.splice(i, 1);
    }
  }
}

// パーティクルの更新
function updateParticles(timeStep) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx * timeStep;
    p.y += p.vy * timeStep;
    p.life -= timeStep;

    if (p.life <= 0) {
      particles.splice(i, 1);
    }
  }
}

// スコアポップアップの更新
function updateScorePopups(timeStep) {
  for (let i = scorePopups.length - 1; i >= 0; i--) {
    const sp = scorePopups[i];
    sp.y -= 0.6 * timeStep; // 上に浮かせる
    sp.life -= timeStep;
    if (sp.life <= 0) {
      scorePopups.splice(i, 1);
    }
  }
}

// === 衝突判定 ===
function checkCollisions() {
  // 1. 自機 vs 弾
  if (player.invincibleFrames === 0 && player.shieldActiveFrames === 0) {
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      const dx = player.x - b.x;
      const dy = player.y - b.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      // 自機の極小当たり判定 + 弾のサイズ考慮
      if (dist < player.hitboxRadius + (b.size / 2)) {
        bullets.splice(i, 1);
        damagePlayer();
        break; // 1回被弾したらループ抜ける
      }
    }
  }

  // シールド発動中の弾消去判定
  if (player.shieldActiveFrames > 0) {
    const shieldRadius = 24;
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      const dx = player.x - b.x;
      const dy = player.y - b.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist < shieldRadius) {
        // 被弾消滅エフェクト
        createExplosion(b.x, b.y, '#00ffff', 2);
        bullets.splice(i, 1);
      }
    }
  }

  // 2. 自機 vs 敵 (直接衝突)
  if (player.invincibleFrames === 0 && player.shieldActiveFrames === 0) {
    for (const e of enemies) {
      const dx = player.x - e.x;
      const dy = player.y - e.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const minDist = (player.width / 4) + (e.width / 4); // やや小さめの判定
      
      if (dist < minDist) {
        damagePlayer();
        break;
      }
    }
  }

}

// === 描画処理 ===
function draw() {
  // 画面クリア
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // 背景の星屑（弾と混同しないよう薄い青・1ピクセル固定で復活）
  ctx.fillStyle = 'rgba(0, 100, 200, 0.25)';
  stars.forEach(star => {
    ctx.fillRect(star.x, star.y, 1, 1);
  });

  if (gameState === STATE_TITLE) {
    drawTitleScreen();
  } 
  else if (gameState === STATE_SELECT_DIFFICULTY) {
    drawDifficultySelectScreen();
  } 
  else if (gameState === STATE_SELECT_ABILITY) {
    drawAbilitySelectScreen();
  } 
  else if (gameState === STATE_PLAYING) {
    drawGamePlayScreen();
  } 
  else if (gameState === STATE_GAMEOVER) {
    drawGameOverScreen();
  }
}

// 1. タイトル画面
function drawTitleScreen() {
  ctx.textAlign = 'center';
  
  // ネオンタイトル
  ctx.fillStyle = '#ff2a6d';
  ctx.font = '16px "Press Start 2P"';
  ctx.fillText('ANTI-BULLET', CANVAS_WIDTH / 2, 90);
  
  ctx.fillStyle = '#05d9e8';
  ctx.font = '8px "Press Start 2P"';
  ctx.fillText('8-BIT EVADER', CANVAS_WIDTH / 2, 115);

  // デコレーション（自機）
  drawPixelArt(PLAYER_ART, CANVAS_WIDTH / 2, 160, 3, PLAYER_COLORS);

  // 点滅するスタートテキスト
  if (Math.floor(Date.now() / 400) % 2 === 0) {
    ctx.fillStyle = '#ffffff';
    ctx.font = '8px "Press Start 2P"';
    ctx.fillText('PRESS START KEY', CANVAS_WIDTH / 2, 230);
  }

  ctx.fillStyle = '#666666';
  ctx.font = '6px "Press Start 2P"';
  ctx.fillText('[ENTER] OR [SPACE] TO START', CANVAS_WIDTH / 2, 250);

  ctx.fillText('MOVE: ARROW KEYS / WASD', CANVAS_WIDTH / 2, 280);
}

// 2. 難易度選択画面
function drawDifficultySelectScreen() {
  ctx.textAlign = 'center';
  
  ctx.fillStyle = '#ffffff';
  ctx.font = '10px "Press Start 2P"';
  ctx.fillText('SELECT DIFFICULTY', CANVAS_WIDTH / 2, 60);

  const diffKeys = Object.keys(DIFFICULTIES);
  diffKeys.forEach((key, idx) => {
    const isSelected = idx === menuIndex;
    const setting = DIFFICULTIES[key];
    
    if (isSelected) {
      ctx.fillStyle = '#00ffff';
      ctx.fillText(`> ${setting.label} <`, CANVAS_WIDTH / 2, 120 + idx * 35);
      
      ctx.fillStyle = '#888888';
      ctx.font = '6px "Press Start 2P"';
      let infoText = `LIVES: ${setting.lives} | SCORE: ${setting.scoreMult}x`;
      if (key === 'HELL') infoText += ' (ONE SHOT DIE!)';
      ctx.fillText(infoText, CANVAS_WIDTH / 2, 135 + idx * 35);
      ctx.font = '10px "Press Start 2P"'; // 元に戻す
    } else {
      ctx.fillStyle = '#666666';
      ctx.fillText(setting.label, CANVAS_WIDTH / 2, 120 + idx * 35);
    }
  });

  ctx.fillStyle = '#444';
  ctx.font = '6px "Press Start 2P"';
  ctx.fillText('[W/S] OR [UP/DOWN] TO MOVE', CANVAS_WIDTH / 2, 260);
  ctx.fillText('[ENTER] TO CONFIRM', CANVAS_WIDTH / 2, 275);
}

// 3. 特殊能力選択画面
function drawAbilitySelectScreen() {
  ctx.textAlign = 'center';
  
  ctx.fillStyle = '#ffffff';
  ctx.font = '10px "Press Start 2P"';
  ctx.fillText('SELECT ABILITY', CANVAS_WIDTH / 2, 60);

  const abKeys = Object.keys(ABILITIES);
  abKeys.forEach((key, idx) => {
    const isSelected = idx === menuIndex;
    const setting = ABILITIES[key];
    
    if (isSelected) {
      ctx.fillStyle = '#ff00ff';
      ctx.fillText(`> ${setting.label} <`, CANVAS_WIDTH / 2, 120 + idx * 35);
      
      ctx.fillStyle = '#888888';
      ctx.font = '6px "Press Start 2P"';
      const infoText = `${setting.desc} | SCORE: ${setting.scoreMult}x`;
      ctx.fillText(infoText, CANVAS_WIDTH / 2, 135 + idx * 35);
      ctx.font = '10px "Press Start 2P"'; // 元に戻す
    } else {
      ctx.fillStyle = '#666666';
      ctx.fillText(setting.label, CANVAS_WIDTH / 2, 120 + idx * 35);
    }
  });

  ctx.fillStyle = '#444';
  ctx.font = '6px "Press Start 2P"';
  ctx.fillText('[W/S] OR [UP/DOWN] TO MOVE', CANVAS_WIDTH / 2, 260);
  ctx.fillText('[ENTER] TO LAUNCH GAME', CANVAS_WIDTH / 2, 275);
}

// 4. ゲームプレイ画面
function drawGamePlayScreen() {
  // 敵描画
  enemies.forEach(e => {
    if (e.type === 'basic') {
      drawPixelArt(ENEMY_BASIC_ART, e.x, e.y, 2, ENEMY_BASIC_COLORS);
    } else if (e.type === 'tracking') {
      drawPixelArt(ENEMY_TRACKING_ART, e.x, e.y, 2, ENEMY_TRACKING_COLORS);
    } else if (e.type === 'spiral') {
      drawPixelArt(ENEMY_SPIRAL_ART, e.x, e.y, 2, ENEMY_SPIRAL_COLORS);
    } else if (e.type === 'boss') {
      drawPixelArt(ENEMY_BOSS_ART, e.x, e.y, 2, ENEMY_BOSS_COLORS);
      
      // ボスのHPゲージ (生存時間のゲージ)
      ctx.fillStyle = '#440000';
      ctx.fillRect(CANVAS_WIDTH / 2 - 40, e.y - 12, 80, 2);
      ctx.fillStyle = '#d0021b';
      ctx.fillRect(CANVAS_WIDTH / 2 - 40, e.y - 12, 80 * (e.life / e.maxLife), 2);
    }
  });

  // 弾描画
  bullets.forEach(b => {
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x - b.size/2, b.y - b.size/2, b.size, b.size);
  });

  // パーティクル描画
  particles.forEach(p => {
    ctx.fillStyle = p.color;
    ctx.globalAlpha = p.life / 50; // フェードアウト
    ctx.fillRect(p.x - p.size/2, p.y - p.size/2, p.size, p.size);
  });
  ctx.globalAlpha = 1.0; // 透過をリセット

  // プレイヤー自機描画 (無敵時点滅)
  if (player.invincibleFrames === 0 || Math.floor(player.invincibleFrames / 4) % 2 === 0) {
    drawPixelArt(PLAYER_ART, player.x, player.y, 2, PLAYER_COLORS);

    // 被弾判定位置に極小ドットをガイド表示（親切設計）
    ctx.fillStyle = '#ff0000';
    ctx.fillRect(player.x - 0.5, player.y - 0.5, 1, 1);
  }

  // 被弾時の無敵シールドを可視化
  if (player.invincibleFrames > 0) {
    ctx.strokeStyle = 'rgba(255, 120, 0, 0.6)'; // オレンジ色
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 2]); // ドット点線
    ctx.beginPath();
    // 無敵残り時間に応じてサークルが縮小する演出
    const invRadius = 12 + (player.invincibleFrames * 0.15);
    ctx.arc(player.x, player.y, invRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // バリア展開中の描画
  if (player.shieldActiveFrames > 0) {
    ctx.strokeStyle = '#00ffff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    // 鼓動するようなサイズ変更
    const animRadius = 24 + Math.sin(gameFrame * 0.3) * 2;
    ctx.arc(player.x, player.y, animRadius, 0, Math.PI * 2);
    ctx.stroke();

    // 内側にうっすら光
    ctx.fillStyle = 'rgba(0, 255, 255, 0.08)';
    ctx.beginPath();
    ctx.arc(player.x, player.y, animRadius, 0, Math.PI * 2);
    ctx.fill();
  }

  // == タイムスローの特殊視覚効果 ==
  if (player.isSlowActive) {
    // スロー中は画面周囲にシアンのうっすらした枠線を表示
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.25)';
    ctx.lineWidth = 4;
    ctx.strokeRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  }

  // スコアポップアップの描画
  ctx.textAlign = 'center';
  ctx.font = '5px "Press Start 2P"';
  scorePopups.forEach(sp => {
    ctx.fillStyle = sp.color;
    ctx.globalAlpha = sp.life / 40;
    ctx.fillText(sp.text, sp.x, sp.y);
  });
  ctx.globalAlpha = 1.0; // リセット

  // == HUD UI 描画 ==
  ctx.textAlign = 'left';
  ctx.font = '6px "Press Start 2P"';
  
  // 1. スコアとハイスコア
  ctx.fillStyle = '#ffffff';
  ctx.fillText(`SCORE:${String(Math.floor(score)).padStart(6, '0')}`, 6, 12);
  
  ctx.fillStyle = '#666';
  ctx.fillText(`HI:${String(getHighScore()).padStart(6, '0')}`, 6, 22);

  // 2. ライフ（ハートでレトロに表現）
  ctx.textAlign = 'right';
  ctx.fillStyle = '#ff2a6d';
  let heartStr = '';
  for (let i = 0; i < player.lives; i++) heartStr += '♥';
  ctx.fillText(heartStr, CANVAS_WIDTH - 6, 12);

  // 3. 特殊能力のステータスゲージ
  ctx.textAlign = 'center';
  if (selectedAbility === 'SLOW') {
    // タイムスローゲージ
    const gaugeW = 60;
    const gaugeX = CANVAS_WIDTH / 2 - gaugeW / 2;
    const gaugeY = 10;
    
    // 枠
    ctx.fillStyle = '#222';
    ctx.fillRect(gaugeX, gaugeY, gaugeW, 4);
    // ゲージ中身
    ctx.fillStyle = player.abilityGauge > 20 ? '#05d9e8' : '#ffea00';
    ctx.fillRect(gaugeX, gaugeY, gaugeW * (player.abilityGauge / 100), 4);
    
    ctx.font = '5px "Press Start 2P"';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('SLOW TIME', CANVAS_WIDTH / 2, 8);
  } 
  else if (selectedAbility === 'SHIELD') {
    // シールドクールダウンゲージ
    const gaugeW = 60;
    const gaugeX = CANVAS_WIDTH / 2 - gaugeW / 2;
    const gaugeY = 10;
    
    ctx.fillStyle = '#222';
    ctx.fillRect(gaugeX, gaugeY, gaugeW, 4);
    
    if (player.shieldActiveFrames > 0) {
      // シールド展開中
      ctx.fillStyle = '#ff00ff';
      ctx.fillRect(gaugeX, gaugeY, gaugeW * (player.shieldActiveFrames / 90), 4);
      ctx.font = '5px "Press Start 2P"';
      ctx.fillStyle = '#ffffff';
      ctx.fillText('ACTIVE', CANVAS_WIDTH / 2, 8);
    } else {
      // クールダウン中
      const cdRatio = (480 - player.abilityCooldown) / 480;
      ctx.fillStyle = cdRatio === 1 ? '#00ffff' : '#444';
      ctx.fillRect(gaugeX, gaugeY, gaugeW * cdRatio, 4);
      ctx.font = '5px "Press Start 2P"';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(cdRatio === 1 ? 'SHIELD READY' : 'RECHARGING', CANVAS_WIDTH / 2, 8);
    }
  }
}

// 5. ゲームオーバー画面
function drawGameOverScreen() {
  ctx.textAlign = 'center';
  
  ctx.fillStyle = '#ff2a6d';
  ctx.font = '16px "Press Start 2P"';
  ctx.fillText('GAME OVER', CANVAS_WIDTH / 2, 100);

  ctx.fillStyle = '#ffffff';
  ctx.font = '8px "Press Start 2P"';
  ctx.fillText(`FINAL SCORE: ${Math.floor(score)}`, CANVAS_WIDTH / 2, 140);
  
  const high = getHighScore();
  const isNewRecord = Math.floor(score) >= high && Math.floor(score) > 0;
  
  if (isNewRecord) {
    ctx.fillStyle = '#ffea00';
    ctx.fillText('NEW RECORD!', CANVAS_WIDTH / 2, 160);
  } else {
    ctx.fillStyle = '#888';
    ctx.fillText(`HI-SCORE: ${high}`, CANVAS_WIDTH / 2, 160);
  }

  // プレイ設定の表示
  ctx.fillStyle = '#666';
  ctx.font = '6px "Press Start 2P"';
  ctx.fillText(`DIFFICULTY: ${selectedDifficulty}`, CANVAS_WIDTH / 2, 200);
  ctx.fillText(`ABILITY: ${selectedAbility}`, CANVAS_WIDTH / 2, 212);

  // 点滅
  if (Math.floor(Date.now() / 450) % 2 === 0) {
    ctx.fillStyle = '#ffffff';
    ctx.font = '8px "Press Start 2P"';
    ctx.fillText('PRESS ENTER OR SPACE', CANVAS_WIDTH / 2, 260);
    ctx.fillText('TO CONTINUE', CANVAS_WIDTH / 2, 275);
  }
}
