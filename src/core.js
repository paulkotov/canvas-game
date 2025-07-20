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
