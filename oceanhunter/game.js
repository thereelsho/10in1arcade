/* Ocean Hunter+ — minimal rail shooter core
   - Mouse/touch reticle, click/tap to shoot (no keyboard)
   - On-rails camera illusion (parallax backgrounds)
   - JSON-scripted spawns + simple boss with weak points
   - SL media prim friendly: no popups, no pointer-lock required
*/

(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d', { alpha: false });
  const overlay = document.getElementById('overlay');
  const startBtn = document.getElementById('startBtn');
  const domScore = document.getElementById('score');
  const domLives = document.getElementById('lives');
  const domAmmo  = document.getElementById('ammo');
  const domWave  = document.getElementById('wave');

  // ---------- Settings ----------
  const GAME = {
    width: canvas.width,
    height: canvas.height,
    lives: 3,
    score: 0,
    wave: 1,
    time: 0,
    started: false,
    shooting: false,
    fireRate: 8, // shots per second
    lastShot: 0
  };

  const reticle = {
    x: canvas.width * 0.5,
    y: canvas.height * 0.5,
    r: 18,
    img: null
  };

  // Assets (optional)
  const ASSETS = {
    bg1: null,
    sfxShoot: null,
    sfxHit: null,
    sfxBoss: null,
    enemyFish: null,
    bossJaws: null
  };

  // Level scripting
  let LEVELS = null;
  let activeLevel = null;
  let spawnIndex = 0;
  let entities = []; // enemies, bullets, effects
  let particles = [];

  // ---------- Utility ----------
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const now = () => performance.now() / 1000;

  function loadImage(path) {
    return new Promise(res => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = () => res(null);
      img.src = path;
    });
  }
  function loadAudio(path) {
    return new Promise(res => {
      const a = new Audio();
      a.oncanplaythrough = () => res(a);
      a.onerror = () => res(null);
      a.src = path;
    });
  }

  function pxX(frac) { return frac * canvas.width; }
  function pxY(frac) { return frac * canvas.height; }

  // ---------- Input ----------
  function setReticleFromEvent(e) {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    reticle.x = clamp((clientX - rect.left) * (canvas.width / rect.width), 0, canvas.width);
    reticle.y = clamp((clientY - rect.top) * (canvas.height / rect.height), 0, canvas.height);
  }

  canvas.addEventListener('mousemove', setReticleFromEvent);
  canvas.addEventListener('touchmove', (e) => { setReticleFromEvent(e); e.preventDefault(); }, {passive:false});
  canvas.addEventListener('mousedown', () => GAME.shooting = true);
  canvas.addEventListener('mouseup',   () => GAME.shooting = false);
  canvas.addEventListener('touchstart', (e) => { GAME.shooting = true; setReticleFromEvent(e); }, {passive:true});
  canvas.addEventListener('touchend',   () => GAME.shooting = false, {passive:true});

  // ---------- Entities ----------
  function spawnEnemy(def) {
    const base = {
      type: def.type,
      x: pxX(def.x),
      y: pxY(def.y),
      vx: def.vx || 0,
      vy: def.vy || 0,
      hp: def.hp || 1,
      score: def.score || 50,
      r: 28,
      t: 0,
      alive: true,
      weakpoints: null
    };
    if (def.type === 'boss') {
      base.r = 120;
      base.hp = def.hp || 60;
      base.weakpoints = (def.weakpoints || []).map(w => ({
        dx: w.dx, dy: w.dy, hp: w.hp || 5, score: w.score || 200, alive: true, r: 24
      }));
      if (ASSETS.sfxBoss) ASSETS.sfxBoss.play().catch(()=>{});
    }
    entities.push(base);
  }

  function spawnBullet(x, y) {
    entities.push({ type:'bullet', x, y, vx:0, vy:-1200, r:4, alive:true, t:0 });
  }

  function hitEntity(ent, dmg=1) {
    ent.hp -= dmg;
    if (ASSETS.sfxHit) ASSETS.sfxHit.currentTime = 0, ASSETS.sfxHit.play().catch(()=>{});
    if (ent.hp <= 0) {
      ent.alive = false;
      GAME.score += ent.score || 0;
      for (let i=0;i<10;i++) particles.push({x:ent.x,y:ent.y,vx:(Math.random()-0.5)*200,vy:(Math.random()-0.5)*200,t:0,life:0.5});
    }
  }

  function circleHit(ax,ay,ar,bx,by,br){
    const dx = ax-bx, dy = ay-by; return (dx*dx+dy*dy) <= (ar+br)*(ar+br);
  }

  // ---------- Camera / Parallax ----------
  let bgScroll = 0;
  function updateParallax(dt) {
    const speed = activeLevel?.camera?.speed || 4;
    bgScroll += speed * dt * 30; // arbitrary scale
  }

  // ---------- Update loop ----------
  let lastTime = 0;
  function update(dt) {
    GAME.time += dt;
    updateParallax(dt);

    // Spawn based on schedule
    const spawns = activeLevel.spawns || [];
    while (spawnIndex < spawns.length && spawns[spawnIndex].t <= GAME.time) {
      spawnEnemy(spawns[spawnIndex]);
      spawnIndex++;
    }

    // Auto-fire
    if (GAME.shooting) {
      const interval = 1 / GAME.fireRate;
      if (GAME.time - GAME.lastShot >= interval) {
        spawnBullet(reticle.x, reticle.y);
        if (ASSETS.sfxShoot) ASSETS.sfxShoot.currentTime = 0, ASSETS.sfxShoot.play().catch(()=>{});
        GAME.lastShot = GAME.time;
      }
    }

    // Update entities
    for (const e of entities) {
      e.t += dt;
      e.x += e.vx * dt;
      e.y += e.vy * dt;

      // Simple behaviors
      if (e.type === 'fish') {
        e.x += Math.sin(e.t*3) * 30 * dt;
      } else if (e.type === 'eel') {
        e.y += Math.sin(e.t*4) * 40 * dt;
      } else if (e.type === 'puffer') {
        e.r = 22 + Math.sin(e.t*3)*6 + 28;
      } else if (e.type === 'boss') {
        // drift + slight track toward reticle
        e.x += Math.sign(reticle.x - e.x) * 40 * dt;
        e.y += Math.sign(reticle.y - e.y) * 20 * dt;
      }

      // Cull off-screen bullets
      if (e.type === 'bullet' && e.y < -20) e.alive = false;
    }

    // Bullet collisions
    const bullets = entities.filter(e => e.type === 'bullet' && e.alive);
    for (const b of bullets) {
      for (const target of entities) {
        if (!target.alive || target.type === 'bullet') continue;
        // Boss weak points
        if (target.type === 'boss' && target.weakpoints) {
          for (const w of target.weakpoints) {
            if (!w.alive) continue;
            const wx = target.x + w.dx, wy = target.y + w.dy;
            if (circleHit(b.x,b.y,b.r, wx,wy,w.r)) {
              w.hp -= 1;
              b.alive = false;
              if (ASSETS.sfxHit) ASSETS.sfxHit.play().catch(()=>{});
              if (w.hp <= 0) { w.alive = false; GAME.score += w.score; }
              break;
            }
          }
        } else {
          if (circleHit(b.x,b.y,b.r, target.x,target.y,target.r)) {
            hitEntity(target, 1);
            b.alive = false;
          }
        }
      }
    }

    // Boss body dies when all weakpoints down or HP zero
    for (const e of entities) {
      if (e.type === 'boss' && e.alive) {
        const allDown = e.weakpoints && e.weakpoints.every(w => !w.alive);
        if (allDown || e.hp <= 0) {
          e.alive = false; GAME.score += e.score || 1000;
          for (let i=0;i<30;i++) particles.push({x:e.x,y:e.y,vx:(Math.random()-0.5)*300,vy:(Math.random()-0.5)*300,t:0,life:0.8});
        }
      }
    }

    // Particles
    for (const p of particles) {
      p.t += dt; p.x += p.vx*dt; p.y += p.vy*dt;
    }
    particles = particles.filter(p => p.t < p.life);

    // Clean entities & check level end
    entities = entities.filter(e => e.alive);

    if (GAME.time >= activeLevel.length) {
      // Level complete
      GAME.wave++;
      startLevel(Math.min(GAME.wave-1, LEVELS.levels.length-1)); // repeat last if only one
    }

    // (Optional) Damage on miss / player lives logic could go here.
  }

  // ---------- Render ----------
  function draw() {
    // Background (parallax or solid color)
    if (ASSETS.bg1) {
      const w = ASSETS.bg1.width, h = ASSETS.bg1.height;
      const scale = Math.max(canvas.width / w, canvas.height / h);
      const drawW = w*scale, drawH=h*scale;
      const offset = (bgScroll % drawW);
      for (let x=-offset; x<canvas.width; x+=drawW) {
        ctx.drawImage(ASSETS.bg1, x, 0, drawW, drawH);
      }
    } else {
      // gradient water
      const g = ctx.createLinearGradient(0,0,0,canvas.height);
      g.addColorStop(0, '#022d3b'); g.addColorStop(1, '#00141c');
      ctx.fillStyle = g; ctx.fillRect(0,0,canvas.width,canvas.height);
    }

    // Entities
    for (const e of entities) {
      if (e.type === 'bullet') {
        ctx.fillStyle = '#8ff';
        ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, Math.PI*2); ctx.fill();
        continue;
      }
      if (e.type === 'fish') {
        if (ASSETS.enemyFish) {
          ctx.drawImage(ASSETS.enemyFish, e.x-24, e.y-18, 48, 36);
        } else {
          ctx.fillStyle = '#5bd1ff';
          ctx.beginPath(); ctx.ellipse(e.x, e.y, 30, 16, 0, 0, Math.PI*2); ctx.fill();
          ctx.fillStyle = '#02455e'; ctx.fillRect(e.x-18, e.y-4, 12, 8);
        }
      } else if (e.type === 'eel') {
        ctx.strokeStyle = '#7fffd4'; ctx.lineWidth = 6;
        ctx.beginPath(); ctx.moveTo(e.x-40, e.y); ctx.quadraticCurveTo(e.x, e.y-20, e.x+40, e.y); ctx.stroke();
      } else if (e.type === 'puffer') {
        ctx.fillStyle = '#f5d76e';
        ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = '#caa94e'; ctx.lineWidth = 3; ctx.stroke();
      } else if (e.type === 'boss') {
        if (ASSETS.bossJaws) {
          ctx.drawImage(ASSETS.bossJaws, e.x-120, e.y-100, 240, 200);
        } else {
          ctx.fillStyle = '#ff9b73';
          ctx.beginPath(); ctx.arc(e.x, e.y, 110, 0, Math.PI*2); ctx.fill();
        }
        // weak points
        if (e.weakpoints) for (const w of e.weakpoints) if (w.alive) {
          const wx = e.x + w.dx, wy = e.y + w.dy;
          ctx.strokeStyle = '#ff6262'; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(wx, wy, w.r, 0, Math.PI*2); ctx.stroke();
        }
      }
    }

    // Particles
    for (const p of particles) {
      const a = 1 - (p.t / p.life);
      ctx.fillStyle = `rgba(180,240,255,${a.toFixed(3)})`;
      ctx.fillRect(p.x, p.y, 3, 3);
    }

    // Reticle
    if (reticle.img) {
      ctx.drawImage(reticle.img, reticle.x-24, reticle.y-24, 48, 48);
    } else {
      ctx.strokeStyle = '#9ddfff'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(reticle.x, reticle.y, reticle.r, 0, Math.PI*2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(reticle.x-10, reticle.y); ctx.lineTo(reticle.x+10, reticle.y); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(reticle.x, reticle.y-10); ctx.lineTo(reticle.x, reticle.y+10); ctx.stroke();
    }

    // HUD text mirrors header for SL fullscreen if header not visible
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = '16px Arial';
    ctx.fillText(`Score ${GAME.score}`, 14, 26);
    ctx.fillText(`Lives ${GAME.lives}`, 140, 26);
    ctx.fillText(`Wave ${GAME.wave}`, 260, 26);
  }

  // ---------- Main loop ----------
  function loop(t) {
    if (!GAME.started) return;
    const sec = t / 1000;
    if (!lastTime) lastTime = sec;
    const dt = Math.min(0.033, sec - lastTime);
    lastTime = sec;
    update(dt);
    draw();
    requestAnimationFrame(loop);
    // Update DOM HUD
    domScore.textContent = `Score: ${GAME.score}`;
    domLives.textContent = `Lives: ${GAME.lives}`;
    domAmmo.textContent  = `Ammo: ∞`;
    domWave.textContent  = `Wave: ${GAME.wave}`;
  }

  async function startLevel(levelIdx=0) {
    // If index beyond range, clamp
    levelIdx = Math.max(0, Math.min(levelIdx, LEVELS.levels.length-1));
    activeLevel = JSON.parse(JSON.stringify(LEVELS.levels[levelIdx])); // clone
    entities = []; particles = [];
    spawnIndex = 0; GAME.time = 0;
    lastTime = 0;
  }

  async function startGame() {
    overlay.style.display = 'none';
    GAME.started = true; GAME.score = 0; GAME.lives = 3; GAME.wave = 1;
    await startLevel(0);
    requestAnimationFrame(loop);
  }

  // ---------- Boot ----------
  (async function boot(){
    // Load assets (non-blocking)
    [ASSETS.bg1, ASSETS.enemyFish, ASSETS.bossJaws, reticle.img] = await Promise.all([
      loadImage('assets/img/bg_loop_1.png'),
      loadImage('assets/img/enemy_fish.png'),
      loadImage('assets/img/boss_jaws.png'),
      loadImage('assets/ui/reticle.png')
    ]);
    [ASSETS.sfxShoot, ASSETS.sfxHit, ASSETS.sfxBoss] = await Promise.all([
      loadAudio('assets/sfx/shoot.mp3'),
      loadAudio('assets/sfx/hit.mp3'),
      loadAudio('assets/sfx/boss_roar.mp3')
    ]);

    // Load level script (fallback to inline default if fetch fails)
    try {
      const res = await fetch('levels.json', { cache: 'no-store' });
      LEVELS = await res.json();
    } catch {
      LEVELS = {
        levels: [{
          name:'Default',
          length:45,
          camera:{speed:5, spline:[{"x":0,"y":0},{"x":3000,"y":0}]},
          spawns:[
            {"t":2,"type":"fish","x":0.3,"y":0.3,"hp":1,"score":50},
            {"t":3,"type":"fish","x":0.7,"y":0.25,"hp":1,"score":50},
            {"t":5,"type":"eel","x":0.5,"y":0.7,"hp":2,"score":100,"vx":-40},
            {"t":15,"type":"puffer","x":0.4,"y":0.55,"hp":3,"score":150},
            {"t":25,"type":"boss","x":0.5,"y":0.5,"hp":70,"score":2500,"weakpoints":[
              {"dx":-70,"dy":-90,"hp":5,"score":250},
              {"dx":70,"dy":-90,"hp":5,"score":250}
            ]}
          ]
        }]
      };
    }

    // Start button
    startBtn.addEventListener('click', startGame);
  })();
})();
