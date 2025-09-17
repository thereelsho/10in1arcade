// ============================
// Space Invaders - game.js
// ============================

// Grab canvas + context
const canvas = document.getElementById("gameCanvas");
const context = canvas.getContext("2d");

// Match Pac-Man size (560x620)
canvas.width = 560;
canvas.height = 620;

// ============================
// Game variables
// ============================
let gameInterval;
let isGameOver = false;
let score = 0;
let lives = 3;

const playerWidth = 50;
const playerHeight = 30;
const playerSpeed = 5;

const bulletWidth = 4;
const bulletHeight = 10;
const bulletSpeed = 6;

const invaderWidth = 40;
const invaderHeight = 30;
const invaderRowCount = 5;
const invaderColumnCount = 10;
const invaderPadding = 10;
const invaderOffsetTop = 30;
const invaderOffsetLeft = 30;

let rightPressed = false;
let leftPressed = false;
let spacePressed = false;

// ============================
// Player setup
// ============================
const player = {
    x: canvas.width / 2 - playerWidth / 2,
    y: canvas.height - playerHeight - 10,
    width: playerWidth,
    height: playerHeight,
    bullets: []
};

// ============================
// Invaders setup
// ============================
let invaders = [];
function createInvaders() {
    invaders = [];
    for (let c = 0; c < invaderColumnCount; c++) {
        for (let r = 0; r < invaderRowCount; r++) {
            let invaderX = c * (invaderWidth + invaderPadding) + invaderOffsetLeft;
            let invaderY = r * (invaderHeight + invaderPadding) + invaderOffsetTop;
            invaders.push({
                x: invaderX,
                y: invaderY,
                width: invaderWidth,
                height: invaderHeight,
                alive: true
            });
        }
    }
}
createInvaders();

// ============================
// Event listeners
// ============================
document.addEventListener("keydown", keyDownHandler, false);
document.addEventListener("keyup", keyUpHandler, false);

function keyDownHandler(e) {
    if (e.key === "Right" || e.key === "ArrowRight") {
        rightPressed = true;
    } else if (e.key === "Left" || e.key === "ArrowLeft") {
        leftPressed = true;
    } else if (e.key === " " || e.code === "Space") {
        spacePressed = true;
    }
}

function keyUpHandler(e) {
    if (e.key === "Right" || e.key === "ArrowRight") {
        rightPressed = false;
    } else if (e.key === "Left" || e.key === "ArrowLeft") {
        leftPressed = false;
    } else if (e.key === " " || e.code === "Space") {
        spacePressed = false;
    }
}

// ============================
// Draw functions
// ============================
function drawPlayer() {
    context.fillStyle = "lime";
    context.fillRect(player.x, player.y, player.width, player.height);
}

function drawBullets() {
    context.fillStyle = "red";
    for (let i = 0; i < player.bullets.length; i++) {
        let bullet = player.bullets[i];
        context.fillRect(bullet.x, bullet.y, bullet.width, bullet.height);
    }
}

function drawInvaders() {
    context.fillStyle = "white";
    for (let i = 0; i < invaders.length; i++) {
        if (invaders[i].alive) {
            context.fillRect(
                invaders[i].x,
                invaders[i].y,
                invaders[i].width,
                invaders[i].height
            );
        }
    }
}

function drawScore() {
    context.fillStyle = "white";
    context.font = "16px Arial";
    context.fillText("Score: " + score, 8, 20);
}

function drawLives() {
    context.fillStyle = "white";
    context.font = "16px Arial";
    context.fillText("Lives: " + lives, canvas.width - 80, 20);
}

// ============================
// Update functions
// ============================
function updatePlayer() {
    if (rightPressed && player.x < canvas.width - player.width) {
        player.x += playerSpeed;
    } else if (leftPressed && player.x > 0) {
        player.x -= playerSpeed;
    }
    if (spacePressed) {
        shootBullet();
    }
}

function updateBullets() {
    for (let i = 0; i < player.bullets.length; i++) {
        player.bullets[i].y -= bulletSpeed;
        if (player.bullets[i].y + bulletHeight < 0) {
            player.bullets.splice(i, 1);
            i--;
        }
    }
}

function updateInvaders() {
    // Simple left-right motion
    let moveDown = false;
    for (let i = 0; i < invaders.length; i++) {
        if (invaders[i].alive) {
            invaders[i].x += 1;
            if (invaders[i].x + invaders[i].width > canvas.width || invaders[i].x < 0) {
                moveDown = true;
            }
        }
    }

    if (moveDown) {
        for (let i = 0; i < invaders.length; i++) {
            invaders[i].y += invaderHeight;
        }
    }
}

function checkCollisions() {
    for (let i = 0; i < player.bullets.length; i++) {
        let b = player.bullets[i];
        for (let j = 0; j < invaders.length; j++) {
            let inv = invaders[j];
            if (inv.alive &&
                b.x < inv.x + inv.width &&
                b.x + b.width > inv.x &&
                b.y < inv.y + inv.height &&
                b.y + b.height > inv.y) {
                inv.alive = false;
                player.bullets.splice(i, 1);
                i--;
                score += 10;
                break;
            }
        }
    }
}

// ============================
// Shooting
// ============================
function shootBullet() {
    if (player.bullets.length < 5) { // limit bullets
        player.bullets.push({
            x: player.x + player.width / 2 - bulletWidth / 2,
            y: player.y,
            width: bulletWidth,
            height: bulletHeight
        });
    }
}

// ============================
// Main game loop
// ============================
function draw() {
    context.clearRect(0, 0, canvas.width, canvas.height);

    drawPlayer();
    drawBullets();
    drawInvaders();
    drawScore();
    drawLives();

    updatePlayer();
    updateBullets();
    updateInvaders();
    checkCollisions();

    if (!isGameOver) {
        requestAnimationFrame(draw);
    }
}

draw();
