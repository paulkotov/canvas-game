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

  constructor(size) {
    this.size = size;
    this.wallGrid = new Uint8Array(size * size);
    this.skybox = new Bitmap('assets/deathvalley_panorama.jpg', 2000, 750);
    this.wallTexture = new Bitmap('assets/wall_texture.jpg', 1024, 1024);
    this.light = 0;
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
