type Ship = { x: number; y: number; lane: number; speed: number; phase: number; visible: boolean; checked: number };

// Paint only over unoccupied page space. The canvas never receives DOM clicks.
const PROTECTED = 'a,button,input,textarea,select,label,[contenteditable],nav,header,footer,[role="button"],[role="dialog"],img,video,iframe,canvas:not(.pointer-atmosphere),h1,h2,h3,h4,p,li,table,.member-panel';
export function clearFlightSpace(x: number, y: number) {
  return [[0, 0], [-25, 0], [25, 0], [0, -16], [0, 16]].every(([dx, dy]) => {
    const element = document.elementFromPoint(x + dx, y + dy);
    return element && !element.closest(PROTECTED);
  });
}

export class AmbientShips {
  private ships: Ship[] = [];
  private nextSpawn = 0;
  private hits = 0;

  clear() { this.ships = []; }
  get flying() { return this.ships.length > 0; }
  allowed() {
    return !/^\/(admin|member)(\/|$)/.test(location.pathname)
      && !document.querySelector('[role="dialog"], [aria-modal="true"]')
      && innerHeight > 350;
  }

  draw(ctx: CanvasRenderingContext2D, now: number, dt: number, width: number, height: number, light: boolean) {
    if (!this.allowed()) { this.clear(); return; }
    if (now > this.nextSpawn && this.ships.length < 2) {
      this.nextSpawn = now + 5000 + Math.random() * 3000;
      const direction = Math.random() > .5 ? 1 : -1;
      const lane = 150 + Math.random() * Math.max(1, height - 270);
      this.ships.push({ x: direction > 0 ? -30 : width + 30, y: lane, lane, speed: direction * (28 + Math.random() * 16), phase: Math.random() * 6, visible: false, checked: 0 });
    }
    this.ships = this.ships.filter(ship => ship.x > -60 && ship.x < width + 60);
    for (const ship of this.ships) {
      ship.x += ship.speed * dt;
      ship.y = ship.lane + Math.sin(now * .001 + ship.phase) * 17;
      if (now - ship.checked > 100) {
        ship.checked = now;
        ship.visible = ship.x > 30 && ship.x < width - 30 && clearFlightSpace(ship.x, ship.y);
      }
      if (!ship.visible) continue;
      ctx.save();
      ctx.translate(ship.x, ship.y); ctx.scale(ship.speed > 0 ? 1 : -1, 1);
      ctx.globalAlpha = .8;
      // Small retro spacecraft: swept wings, illuminated cockpit, engine plume.
      const plume = 10 + Math.sin(now * .02 + ship.phase) * 4;
      ctx.fillStyle = light ? '#288c9e' : '#74d3e1';
      ctx.beginPath(); ctx.moveTo(-12, -3); ctx.lineTo(-12 - plume, 0); ctx.lineTo(-12, 3); ctx.fill();
      ctx.fillStyle = light ? '#e5d7bd' : '#26303c';
      ctx.strokeStyle = light ? '#846744' : '#dbc59d'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(19, 0); ctx.lineTo(-12, -11); ctx.lineTo(-7, -2);
      ctx.lineTo(-14, 0); ctx.lineTo(-7, 2); ctx.lineTo(-12, 11); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = light ? '#217c93' : '#83dceb';
      ctx.beginPath(); ctx.ellipse(5, 0, 4, 2, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }

  hit(x: number, y: number) {
    if (!this.allowed() || !clearFlightSpace(x, y)) return null;
    const index = this.ships.findIndex(ship => ship.visible && Math.hypot(ship.x - x, ship.y - y) < 27 && clearFlightSpace(ship.x, ship.y));
    if (index < 0) return null;
    const [ship] = this.ships.splice(index, 1);
    return { x: ship.x, y: ship.y, score: ++this.hits };
  }
}
