
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const scoreElement = document.getElementById("score");
const bestElement = document.getElementById("best");
const statusElement = document.getElementById("status");
const overlay = document.getElementById("overlay");
const startBtn = document.getElementById("startBtn");
const switchBtn = document.getElementById("switchBtn");
let paused = false;

const pauseBtn = document.getElementById("pauseBtn");
const resumeBtn = document.getElementById("resumeBtn");
const pauseOverlay = document.getElementById("pauseOverlay");

const SIZE = 500;
canvas.width = SIZE;
canvas.height = SIZE;

const cx = SIZE / 2;
const cy = SIZE / 2;

let playerAngle = -Math.PI / 2;
let playerLane = 0;
let score = 0;
let best = Number(localStorage.getItem("orbitBest")) || 0;
let running = false;
let animationId;
let lastTime = 0;
let spawnTimer = 0;
let objects = [];
let particles = [];
let combo = 0;
let lastCollectTime = 0;
// SOUND SYSTEM

let audioContext = null;
let soundEnabled = true;

function initializeAudio() {
    if (!audioContext) {
        const AudioEngine =
            window.AudioContext || window.webkitAudioContext;

        if (!AudioEngine) return;

        audioContext = new AudioEngine();
    }

    if (audioContext.state === "suspended") {
        audioContext.resume();
    }
}

function playTone(frequency, duration, type = "sine") {
    if (!soundEnabled || !audioContext) return;

    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();

    oscillator.type = type;
    oscillator.frequency.value = frequency;

    gain.gain.setValueAtTime(0.12, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(
        0.001,
        audioContext.currentTime + duration
    );

    oscillator.connect(gain);
    gain.connect(audioContext.destination);

    oscillator.start();
    oscillator.stop(audioContext.currentTime + duration);
}

function collectSound() {
    playTone(660, 0.12);
    setTimeout(() => playTone(880, 0.15), 70);
}

function collisionSound() {
    playTone(180, 0.35, "sawtooth");
}

function achievementSound() {
    playTone(523, 0.15);
    setTimeout(() => playTone(659, 0.15), 120);
    setTimeout(() => playTone(784, 0.25), 240);
}
// ACHIEVEMENT SYSTEM

const achievementListElement =
    document.getElementById("achievementList");

const achievementToast =
    document.getElementById("achievementToast");

const achievements = [
    { score: 100, name: "Rookie Pilot" },
    { score: 250, name: "Space Explorer" },
    { score: 500, name: "Orbit Legend" }
];

let unlockedAchievements = [];

try {
    unlockedAchievements = JSON.parse(
        localStorage.getItem("orbitAchievements") || "[]"
    );

    if (!Array.isArray(unlockedAchievements)) {
        unlockedAchievements = [];
    }
} catch {
    unlockedAchievements = [];
}

function renderAchievements() {
    const unlocked = achievements.filter(item =>
        unlockedAchievements.includes(item.score)
    );

    achievementListElement.textContent = unlocked.length
        ? unlocked.map(item => "🏅 " + item.name).join(" | ")
        : "No achievements unlocked yet.";
}

function checkAchievements() {
    achievements.forEach(item => {
        if (
            score >= item.score &&
            !unlockedAchievements.includes(item.score)
        ) {
            unlockedAchievements.push(item.score);

            localStorage.setItem(
                "orbitAchievements",
                JSON.stringify(unlockedAchievements)
            );

            achievementToast.textContent =
                "🏆 UNLOCKED: " + item.name + "!";

            achievementSound();
        }
    });

    renderAchievements();
}

renderAchievements();

const comboElement = document.getElementById("combo");

const backgroundStars = Array.from({length: 65}, () => ({
    x: random(0, SIZE),
    y: random(0, SIZE),
    size: random(0.5, 2),
    alpha: random(0.2, 0.9)
}));
let difficulty = 1;
let baseDifficulty = 1;

const difficultySelect =
    document.getElementById("difficulty");

const lanes = [125, 185];
const colors = ["#38d9ff", "#ffb347", "#ff4e78"];

bestElement.textContent = best;

function random(min, max) {
    return Math.random() * (max - min) + min;
}
function drawBackground() {
    backgroundStars.forEach(star => {
        ctx.globalAlpha = star.alpha;
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fill();
    });

    ctx.globalAlpha = 1;
}

function drawStar(x, y, radius) {
    ctx.beginPath();

    for (let i = 0; i < 10; i++) {
        const r = i % 2 === 0 ? radius : radius * 0.45;
        const angle = i * Math.PI / 5 - Math.PI / 2;

        const px = x + Math.cos(angle) * r;
        const py = y + Math.sin(angle) * r;

        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
    }

    ctx.closePath();
    ctx.fill();
}

function createParticles(x, y) {
    for (let i = 0; i < 12; i++) {
        const angle = Math.random() * Math.PI * 2;

        particles.push({
            x, y,
            vx: Math.cos(angle) * random(1, 4),
            vy: Math.sin(angle) * random(1, 4),
            life: 1
        });
    }
}

function updateParticles(dt) {
    particles.forEach(p => {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= 0.035 * dt;
    });

    particles = particles.filter(p => p.life > 0);
}

function drawParticles() {
    particles.forEach(p => {
        ctx.globalAlpha = p.life;
        ctx.fillStyle = "#ffcf4a";
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
        ctx.fill();
    });

    ctx.globalAlpha = 1;
}
function drawPlanet() {
    const gradient = ctx.createRadialGradient(cx - 15, cy - 15, 5, cx, cy, 55);
    gradient.addColorStop(0, "#7bdbff");
    gradient.addColorStop(1, "#3456a3");

    ctx.beginPath();
    ctx.arc(cx, cy, 48, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();
}

function drawOrbits() {
    lanes.forEach(radius => {
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.strokeStyle = "#365078";
        ctx.lineWidth = 2;
        ctx.stroke();
    });
}

function drawPlayer() {
    const radius = lanes[playerLane];
    const x = cx + Math.cos(playerAngle) * radius;
    const y = cy + Math.sin(playerAngle) * radius;

    ctx.save();
    ctx.shadowBlur = 20;
    ctx.shadowColor = "#38d9ff";
    ctx.fillStyle = "#38d9ff";

    ctx.beginPath();
    ctx.arc(x, y, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}

function drawObjects() {
    objects.forEach(obj => {
        const x = cx + Math.cos(obj.angle) * lanes[obj.lane];
        const y = cy + Math.sin(obj.angle) * lanes[obj.lane];

        ctx.save();
        ctx.shadowBlur = 15;

        if (obj.type === 0) {
            ctx.shadowColor = "#ffcf4a";
            ctx.fillStyle = "#ffcf4a";
            drawStar(x, y, 12);
        } else if (obj.type === 1) {
            ctx.shadowColor = "#ff4e78";
            ctx.fillStyle = "#ff4e78";

            ctx.beginPath();
            ctx.moveTo(x, y - 12);
            ctx.lineTo(x + 11, y + 9);
            ctx.lineTo(x - 11, y + 9);
            ctx.closePath();
            ctx.fill();
        }

        ctx.restore();
    });
}

function spawnObject() {
    const lane = Math.floor(Math.random() * 2);
    const angle = playerAngle + Math.PI + random(-0.65, 0.65);

    objects.push({
        lane,
        angle,
        type: Math.random() < 0.25 ? 0 : 1,
        speed: random(0.9, 1.3) * difficulty
    });
}

function switchLane() {
    if (!running) return;
    playerLane = 1 - playerLane;
}

function endGame() {
    running = false;
    cancelAnimationFrame(animationId);
    paused = false;
    pauseOverlay.style.display = "none";
    pauseBtn.textContent = "PAUSE";

    if (score > best) {
        best = score;
        localStorage.setItem("orbitBest", best);
        bestElement.textContent = best;
    }

    statusElement.textContent = "MISSION FAILED";
    overlay.style.display = "flex";
    overlay.querySelector("h2").textContent = "GAME OVER";
    overlay.querySelector("p").textContent =
        `Your score: ${score} | Best: ${best}`;
    startBtn.textContent = "PLAY AGAIN";
}

function update(delta) {
    const dt = Math.min(delta / 16.67, 2);

    playerAngle += 0.025 * dt * difficulty;

    spawnTimer += delta;

    if (spawnTimer > Math.max(450, 1150 / difficulty)) {
        spawnObject();
        spawnTimer = 0;
    }

    objects.forEach(obj => {
        obj.angle += obj.speed * 0.008 * dt;

        const difference = Math.atan2(
            Math.sin(obj.angle - playerAngle),
            Math.cos(obj.angle - playerAngle)
        );

        if (
            obj.type === 1 &&
            obj.lane === playerLane &&
            Math.abs(difference) < 0.085
        ) {
            collisionSound();
            endGame();
        }

        if (
            obj.type === 0 &&
            obj.lane === playerLane &&
            Math.abs(difference) < 0.09
        ) {
            const x = cx + Math.cos(obj.angle) * lanes[obj.lane];
            const y = cy + Math.sin(obj.angle) * lanes[obj.lane];

            createParticles(x, y);

            const now = performance.now();

            combo = now - lastCollectTime < 3000
                ? combo + 1
                : 1;

            lastCollectTime = now;

            score += 5 * combo;

            comboElement.textContent = combo;
            scoreElement.textContent = score;
            collectSound();
            checkAchievements();

            obj.type = 2;
        }
    });
    if (performance.now() - lastCollectTime > 3000) {
        combo = 0;
        comboElement.textContent = "0";
    }

    updateParticles(dt);
    objects = objects.filter(obj => {
        const difference = Math.atan2(
            Math.sin(obj.angle - playerAngle),
            Math.cos(obj.angle - playerAngle)
        );

        return obj.type !== 2 &&
            Math.abs(difference) < Math.PI - 0.15;
    });

    difficulty = baseDifficulty + score / 200;
}

function draw() {
    ctx.clearRect(0, 0, SIZE, SIZE);

    drawBackground();
    drawOrbits();
    drawPlanet();
    drawObjects();
    drawParticles();
    drawPlayer();
}

function loop(timestamp) {
    if (!running || paused) return;

    const delta = lastTime
        ? timestamp - lastTime
        : 16.67;

    lastTime = timestamp;

    update(delta);

    if (!running || paused) return;

    draw();

    animationId = requestAnimationFrame(loop);
}
function pauseGame() {
    if (!running || paused) return;

    paused = true;

    cancelAnimationFrame(animationId);

    pauseOverlay.style.display = "flex";
    pauseBtn.textContent = "RESUME";
}

function resumeGame() {
    if (!running || !paused) return;

    paused = false;
    lastTime = 0;

    pauseOverlay.style.display = "none";
    pauseBtn.textContent = "PAUSE";

    animationId = requestAnimationFrame(loop);
}

function togglePause() {
    if (paused) {
        resumeGame();
    } else {
        pauseGame();
    }
}

function startGame() {
    initializeAudio();
    paused = false;
    pauseOverlay.style.display = "none";
    pauseBtn.textContent = "PAUSE";

    baseDifficulty = Number(difficultySelect.value);
    difficulty = baseDifficulty;

    achievementToast.textContent = "";
    cancelAnimationFrame(animationId);

    score = 0;
    playerLane = 0;
    playerAngle = -Math.PI / 2;
    objects = [];
    difficulty = 1;
    spawnTimer = 0;
    lastTime = 0;
    particles = [];
    combo = 0;
    lastCollectTime = 0;
    comboElement.textContent = "0";

    scoreElement.textContent = "0";
    statusElement.textContent = "SURVIVE THE ORBIT!";
    overlay.style.display = "none";

    running = true;
    draw();
    animationId = requestAnimationFrame(loop);
}

startBtn.addEventListener("click", startGame);
switchBtn.addEventListener("click", switchLane);

document.addEventListener("keydown", event => {
    if (event.code === "Space") {
        event.preventDefault();
        switchLane();
    }
});

draw();
// SOUND TOGGLE

const soundBtn = document.getElementById("soundBtn");

soundBtn.addEventListener("click", () => {
    soundEnabled = !soundEnabled;

    soundBtn.textContent = soundEnabled
        ? "SOUND: ON"
        : "SOUND: OFF";

    if (soundEnabled) {
        initializeAudio();
        playTone(660, 0.15);
    }
});
pauseBtn.addEventListener("click", togglePause);
resumeBtn.addEventListener("click", resumeGame);
document.addEventListener("visibilitychange", () => {
    if (document.hidden && running && !paused) {
        pauseGame();
    }
});