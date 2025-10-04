class Bitmap {
  image;
  width;
  height;

  constructor(src, width, height) {
    this.image = new Image();
    this.image.src = src;
    this.width = width;
    this.height = height;
  }
}

class Camera {
  ctx;
  width;
  height;
  resolution;
  spacing;
  focalLength;
  range;
  lightRange = 5;
  scale;

  constructor(canvas, resolution, focalLength) {
    this.ctx = canvas.getContext('2d');
    this.width = canvas.width = window.innerWidth * 0.5;
    this.height = canvas.height = window.innerHeight * 0.5;
    this.resolution = resolution;
    this.spacing = this.width / resolution;
    this.focalLength = focalLength ?? 0.8;
    this.range = typeof MOBILE !== 'undefined' && MOBILE ? 8 : 14;
    this.scale = (this.width + this.height) / 1200;
  }

  drawWall = (wall, ray, angle, map) => {
    const ctx = this.ctx;
    const texture = map.wallTexture;
    const left = Math.floor(wall * this.spacing);
    const width = Math.ceil(this.spacing);
    let hit = -1;

    while (++hit < ray.length && ray[hit].height <= 0);

    for (let s = ray.length - 1; s >= 0; s--) {
      const step = ray[s];
      let rainDrops = Math.pow(Math.random(), 3) * s;
      const rain = (rainDrops > 0) && this.project(0.1, angle, step.distance);

      if (s === hit) {
        const textureX = Math.floor(texture.width * step.offset);
        const wall = this.project(step.height, angle, step.distance);

        ctx.globalAlpha = 1;
        ctx.drawImage(texture.image, textureX, 0, 1, texture.height, left, wall.top, width, wall.height);

        ctx.fillStyle = '#000000';
        ctx.globalAlpha = Math.max((step.distance + step.shading) / this.lightRange - map.light, 0);
        ctx.fillRect(left, wall.top, width, wall.height);
      }

      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = 0.15;
      while (--rainDrops > 0) ctx.fillRect(left, Math.random() * rain.top, 1, rain.height);
    }
  };

  render = (player, map) => {
    this.drawSky(player.direction, map.skybox, map.light);
    this.drawWalls(player, map);
    this.drawWeapon(player.weapon, player.paces);
  };

  drawWalls = (player, map) => {
    this.ctx.save();
    for (let wall = 0; wall < this.resolution; wall++) {
      const x = wall / this.resolution - 0.5;
      const angle = Math.atan2(x, this.focalLength);
      const ray = map.cast(player, player.direction + angle, this.range);
      this.drawWall(wall, ray, angle, map);
    }
    this.ctx.restore();
  };
}

// Game map class
class Map {
  size;
  wallGrid;
  skybox;
  wallTexture;
  light = 0;
  objects = []; // Store all game objects (enemies, items, etc.)

  constructor(size) {
    this.size = size;
    this.wallGrid = new Uint8Array(size * size);
    this.skybox = new Bitmap('assets/deathvalley_panorama.jpg', 2000, 750);
    this.wallTexture = new Bitmap('assets/wall_texture.jpg', 1024, 1024);
    this.light = 0;
    this.objects = [];
  }

  addObject(obj) {
    this.objects.push(obj);
  }

  /** 
   * Gets the wall value at the specified coordinates (x, y).
   * Returns -1 if the coordinates are out of bounds,
   * otherwise returns the wall value (1 for wall, 0 for no wall).
   * @param {number} x - The x coordinate.
   * @param {number} y - The y coordinate.
   * @returns {number} The wall value at the specified coordinates.
   * @memberof Map
   */
  get = (x, y) => {
    x = Math.floor(x);
    y = Math.floor(y);
    if (x < 0 || x > this.size - 1 || y < 0 || y > this.size - 1) return -1;
    return this.wallGrid[y * this.size + x];
  }

  /**
   * Randomizes the wall grid by setting each cell to either 1 (wall) or 0 (no wall)
   * with a 30% chance of being a wall.
   * This creates a random maze-like structure for the map.
   * @returns {void}
   * @memberof Map
   */
  randomize = () => {
    for (let i = 0; i < this.size * this.size; i++) {
      this.wallGrid[i] = Math.random() < 0.3 ? 1 : 0;
    }
  }

  /**
   * Casts a ray from a given point at a specified angle and range.
   * Returns an array of points where the ray intersects walls, including distance and shading information.
   * @param {Object} point - The starting point of the ray with x, y coordinates.
   * @param {number} angle - The angle of the ray in radians.
   * @param {number} range - The maximum distance the ray should travel.
   * @returns {Array} An array of intersection points with distance and shading info.
   */
  cast = (point, angle, range) => {
    const sin = Math.sin(angle);
    const cos = Math.cos(angle);
    const noWall = { length2: Infinity };
    const self = this;

    return ray({ x: point.x, y: point.y, height: 0, distance: 0 });

    /**
     * Recursive function to trace the ray through the map.
     * It calculates the next step based on the current position and angle,
     * and continues until it reaches the specified range or a wall.
     * @param {Object} origin - The starting point of the ray with x, y coordinates, height, and distance.
     * @returns {Array} An array of intersection points with distance and shading info.
     * @memberof Map
     */
    function ray(origin) {
      const stepX = step(sin, cos, origin.x, origin.y);
      const stepY = step(cos, sin, origin.y, origin.x, true);
      const nextStep = stepX.length2 < stepY.length2
        ? inspect(stepX, 1, 0, origin.distance, stepX.y)
        : inspect(stepY, 0, 1, origin.distance, stepY.x);

      if (nextStep.distance > range) return [origin];
      return [origin].concat(ray(nextStep));
    }

    /**
      * Calculates the next step in the ray based on the rise and run values,
      * the current x and y coordinates, and whether the coordinates are inverted.
      * Returns an object containing the new x and y coordinates, and the squared length of the step.
      * @param {number} rise - The vertical change in the ray.
      * @param {number} run - The horizontal change in the ray.
      * @param {number} x - The current x coordinate.
      * @param {number} y - The current y coordinate.
      * @param {boolean} inverted - Whether the coordinates are inverted (for y-axis).
      * @returns {Object} An object containing the new x, y coordinates and squared length
      * of the step.
    */
    function step(rise, run, x, y, inverted) {
      if (run === 0) return noWall;
      const dx = run > 0 ? Math.floor(x + 1) - x : Math.ceil(x - 1) - x;
      const dy = dx * (rise / run);
      return {
        x: inverted ? y + dy : x + dx,
        y: inverted ? x + dx : y + dy,
        length2: dx * dx + dy * dy
      };
    }

    /**
     * Inspects the current step to determine its height, distance, and shading.
     * It adjusts the height based on the cosine and sine values,
     * and calculates the distance from the origin.
     * The shading is determined based on the direction of the ray.
     * @param {Object} step - The current step object containing x, y, length2.
     * @param {number} shiftX - The horizontal shift for shading calculation.
     * @param {number} shiftY - The vertical shift for shading calculation.
     * @param {number} distance - The accumulated distance from the origin.
     * @param {number} offset - The offset for texture mapping.
     */
    function inspect(step, shiftX, shiftY, distance, offset) {
      const dx = cos < 0 ? shiftX : 0;
      const dy = sin < 0 ? shiftY : 0;
      step.height = self.get(step.x - dx, step.y - dy);
      step.distance = distance + Math.sqrt(step.length2);
      if (shiftX) step.shading = cos < 0 ? 2 : 0;
      else step.shading = sin < 0 ? 2 : 1;
      step.offset = offset - Math.floor(offset);
      return step;
    }
  }

  update = (seconds) => {
    if (this.light > 0) this.light = Math.max(this.light - 10 * seconds, 0);
    else if (Math.random() * 5 < seconds) this.light = 2;
  }
}

class GameObject {
  x;
  y;
  direction;
  sprite;
  alive = true;

  /**
   * @param {number} x
   * @param {number} y
   * @param {number} direction
   * @param {string} spriteSrc
   * @param {number} spriteWidth
   * @param {number} spriteHeight
   */
  constructor(x, y, direction = 0, spriteSrc = '', spriteWidth = 32, spriteHeight = 32) {
    this.x = x;
    this.y = y;
    this.direction = direction;
    this.sprite = spriteSrc ? new Bitmap(spriteSrc, spriteWidth, spriteHeight) : null;
  }

  /**
   * Draws the object on the canvas.
   * @param {Camera} camera
   */
  draw(camera) {
    if (!this.alive || !this.sprite) {
      return;
    }
    const ctx = camera.ctx;
    const screenX = (this.x / camera.width) * camera.width;
    const screenY = (this.y / camera.height) * camera.height;
    ctx.save();
    ctx.drawImage(
      this.sprite.image,
      screenX - this.sprite.width / 2,
      screenY - this.sprite.height / 2,
      this.sprite.width,
      this.sprite.height
    );
    ctx.restore();
  }
}

class Enemy extends GameObject {
  speed;

  constructor(x, y, direction = 0, speed = 1, spriteSrc = 'assets/enemy.png') {
    super(x, y, direction, spriteSrc, 64, 64);
    this.speed = speed;
  }

  update(target, map, seconds) {
    if (!this.alive) return;
    const dx = target.x - this.x;
    const dy = target.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 0.1) {
      const moveX = (dx / dist) * this.speed * seconds;
      const moveY = (dy / dist) * this.speed * seconds;
      if (map.get(this.x + moveX, this.y) <= 0) this.x += moveX;
      if (map.get(this.x, this.y + moveY) <= 0) this.y += moveY;
      this.direction = Math.atan2(dy, dx);
    }
  }
}

class Item extends GameObject {
  type;

  constructor(x, y, type = 'health', spriteSrc = 'assets/health_pack.png') {
    super(x, y, 0, spriteSrc, 32, 32);
    this.type = type;
  }

  // Example: item effect
  use(player) {
    if (this.type === 'health') {
      player.health = Math.min(player.health + 25, 100);
      this.alive = false;
    }
  }
}

class Player {
  x;
  y;
  direction;
  weapon;
  paces = 0;

  constructor(x, y, direction) {
    this.x = x;
    this.y = y;
    this.direction = direction;
    this.weapon = new Bitmap('assets/some_weapon.png', 319, 320);
    this.paces = 0;
  }

  rotate = (angle) => {
    this.direction = (this.direction + angle + CIRCLE) % (CIRCLE);
  }

  walk = (distance, map) => {
    const dx = Math.cos(this.direction) * distance;
    const dy = Math.sin(this.direction) * distance;
    if (map.get(this.x + dx, this.y) <= 0) {
      this.x += dx;
    }
    if (map.get(this.x, this.y + dy) <= 0) {
      this.y += dy;
    }
    this.paces += distance;
  }

  update = (controls, map, seconds) => {
    for (const key of ['left', 'right', 'forward', 'backward']) {
      if (controls[key]) {
        switch (key) {
          case 'left':
            this.rotate(-Math.PI * seconds);
            break;
          case 'right':
            this.rotate(Math.PI * seconds);
            break;
          case 'forward':
            this.walk(3 * seconds, map);
            break;
          case 'backward':
            this.walk(-3 * seconds, map);
            break;
        }
      }
    }
  }
}

class Controls {
  codes = { 37: 'left', 39: 'right', 38: 'forward', 40: 'backward' };
  states = { left: false, right: false, forward: false, backward: false };

  constructor() {
    document.addEventListener('keydown', this.onKey, false);
    document.addEventListener('keyup', this.onKey, false);
    document.addEventListener('touchstart', this.onTouch, false);
    document.addEventListener('touchmove', this.onTouch, false);
    document.addEventListener('touchend', this.onTouchEnd, false);
  }

  onTouch = (e) => {
    const t = e.touches[0];
    this.onTouchEnd(e);
    if (t.pageY < window.innerHeight * 0.5) {
      this.onKey(true, { keyCode: 38 });
    } else if (t.pageX < window.innerWidth * 0.5) {
      this.onKey(true, { keyCode: 37 });
    } else if (t.pageX > window.innerWidth * 0.5) {
      this.onKey(true, { keyCode: 39 });
    }
  };

  onTouchEnd = (e) => {
    this.states = { left: false, right: false, forward: false, backward: false };
    if (e.preventDefault) {
      e.preventDefault();
    }
    if (e.stopPropagation) {
      e.stopPropagation();
    }
  };

  onKey = (eOrVal, eMaybe) => {
    // Support both event handler and manual call with (val, e)
    let val, e;
    if (typeof eMaybe === 'undefined') {
      // Called by event listener: (event)
      e = eOrVal;
      val = e.type === 'keydown';
    } else {
      // Called manually: (val, event)
      val = eOrVal;
      e = eMaybe;
    }
    const state = this.codes[e.keyCode];
    if (typeof state === 'undefined') return;
    this.states[state] = val;
    if (e.preventDefault) {
      e.preventDefault();
    }
    if (e.stopPropagation) {
      e.stopPropagation();
    }
  }
}

class Game {
  lastTime = 0;
  // accumulator = 0;
  timestep = 1 / 60; // 60 updates per second
  callback = () => {};

  constructor() {}

  start = (callback) => {
    this.callback = callback;
    requestAnimationFrame(this.frame);
  }

  frame = (time) => {
    const seconds = (time - this.lastTime) / 1000;
    this.lastTime = time;

    if (seconds < 0.2) {
      this.callback(seconds);
    }

    requestAnimationFrame(this.frame);
  }
}

const display = document.getElementById('display');
const player = new Player(15.3, -1.2, Math.PI * 0.3);
const map = new Map(32);
const controls = new Controls();
const camera = new Camera(display, typeof MOBILE !== 'undefined' && MOBILE ? 160 : 320, 0.8);
const game = new Game();

map.randomize();

// Add objects to the map
map.addObject(new Enemy(10, 10, 0, 1));
map.addObject(new Enemy(20, 20, 0, 1.2));
map.addObject(new Item(5, 5, 'health', 'assets/health_pack.png'));

game.start((seconds) => {
  map.update(seconds);
  player.update(controls.states, map, seconds);

  // Update and draw all objects
  for (const obj of map.objects) {
    if (obj instanceof Enemy) {
      obj.update(player, map, seconds);
    }
    obj.draw(camera);
  }

  camera.render(player, map);
});
