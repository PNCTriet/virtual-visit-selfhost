/**
 * The virtual office: Phaser 3 + a Tiled map (public/game/office.tmj).
 * Client-only: Phaser is dynamically imported, so it never runs during SSR and isn't in the landing bundle.
 *
 * - Tile layers floor / rugs / walls / deco / furniture come from the Kenney tilesets; the hidden
 *   "collision" layer drives arcade-physics collision for your own avatar.
 * - Characters are 16px Ninja Adventure sprites: 4-frame walk cycle per direction + idle frames.
 * - Your avatar is simulated locally; remote avatars are interpolated from Realtime broadcasts and
 *   play the walk animation in the direction they report.
 */
import type { Facing, PeerMeta, PeerPos, RoomTransport, TransportStatus } from "@/lib/realtime";
import { CHARACTER_COUNT, characterFor } from "@/lib/room";

export type Person = { id: string; name: string; character: number };
export type JoystickInput = { x: number; y: number };
export type OfficeHandle = { destroy(): void };

type Options = {
  parent: HTMLElement;
  me: PeerMeta;
  transport: RoomTransport;
  joystick: { current: JoystickInput };
  onPeople: (people: Person[]) => void;
  onStatus: (s: TransportStatus) => void;
  /**
   * Hidden recording mode for the landing-page clips (/room/x?demo=wide|phone). No network: a few
   * scripted visitors walk looping paths. Motion is a pure function of a clock (seconds), which can be
   * driven frame by frame through `window.__vvClock`, so recordings are smooth and loop exactly.
   */
  demo?: "wide" | "phone" | null;
};

const COLS = CHARACTER_COUNT * 4; // frames per row in characters.png
const SPEED = 82; // px/s in world space (16px tiles → ~5 tiles/s)
const SEND_EVERY = 75; // ms → ≤ ~13 msgs/s while moving
const HEARTBEAT = 2000;
const STALE_AFTER = 12000;
const LABEL_TEX = 40; // label font size in texture px, scaled down to LABEL_CSS screen px
const LABEL_CSS = 12;

const walkKey = (c: number, f: Facing) => `walk-${c}-${f}`;
const idleFrame = (c: number, f: Facing) => 4 * COLS + 4 * c + f;
const facingOf = (vx: number, vy: number): Facing => (Math.abs(vx) > Math.abs(vy) ? (vx < 0 ? 2 : 3) : vy < 0 ? 1 : 0);

/** Demo loop length (s). Every path is walked exactly once per loop, so clips loop seamlessly. */
export const DEMO_LOOP = 10;
type Pt = [number, number];
const DEMO_BOTS: { name: string; path: Pt[]; pingPong?: boolean; phase: number }[] = [
  { name: "Mai", path: [[136, 248], [136, 392], [232, 392], [232, 248]], phase: 0.1 },
  { name: "Linh", path: [[56, 152], [152, 152], [152, 320], [232, 320]], pingPong: true, phase: 0.35 },
  { name: "Khoa", path: [[440, 152], [488, 152], [488, 320], [392, 320]], pingPong: true, phase: 0.6 },
  { name: "Ivan", path: [[424, 248], [584, 248], [584, 400], [424, 400]], phase: 0.8 },
];
const DEMO_SELF: Pt[] = [[392, 248], [392, 400], [248, 400], [248, 248]];

/** Position + facing at time t on a closed (or ping-pong) path walked once every DEMO_LOOP seconds. */
function onPath(points: Pt[], pingPong: boolean, t: number): { x: number; y: number; f: Facing } {
  const pts = pingPong ? [...points, ...points.slice(1, -1).reverse()] : points;
  const segs = pts.map((p, i) => [p, pts[(i + 1) % pts.length]] as const);
  const lens = segs.map(([a, b]) => Math.hypot(b[0] - a[0], b[1] - a[1]));
  const total = lens.reduce((x, y) => x + y, 0);
  let d = ((((t / DEMO_LOOP) % 1) + 1) % 1) * total;
  for (let i = 0; i < segs.length; i++) {
    if (d <= lens[i] || i === segs.length - 1) {
      const [a, b] = segs[i], k = lens[i] ? Math.min(1, d / lens[i]) : 0;
      return { x: a[0] + (b[0] - a[0]) * k, y: a[1] + (b[1] - a[1]) * k, f: facingOf(b[0] - a[0], b[1] - a[1]) };
    }
    d -= lens[i];
  }
  return { x: pts[0][0], y: pts[0][1], f: 0 };
}

export async function startOffice(o: Options): Promise<OfficeHandle> {
  const Phaser = await import("phaser");
  type Sprite = Phaser.GameObjects.Sprite;
  type Avatar = { sprite: Sprite; shadow: Phaser.GameObjects.Image; label: Phaser.GameObjects.Container; character: number; facing: Facing };
  type Remote = Avatar & PeerMeta & { x: number; y: number; m: boolean; seen: number };

  const dpr = () => Math.min(window.devicePixelRatio || 1, 2);
  let zoomCss = 2.5;
  let destroyed = false;

  class Office extends Phaser.Scene {
    self!: Avatar & { sprite: Phaser.Physics.Arcade.Sprite };
    remotes = new Map<string, Remote>();
    keys!: Record<"up" | "down" | "left" | "right" | "w" | "a" | "s" | "d", Phaser.Input.Keyboard.Key>;
    labels: Phaser.GameObjects.Container[] = [];
    floorTexts: Phaser.GameObjects.Text[] = [];
    mapW = 0;
    mapH = 0;
    bots: Avatar[] = [];
    demoT = 0;
    lastSent = 0; lastX = NaN; lastY = NaN; lastF: Facing = 0; lastM = false; forceSend = true;

    constructor() { super("office"); }

    preload() {
      this.load.tilemapTiledJSON("office", "/game/office.tmj");
      this.load.image("kenney-roguelike-rpg", "/game/kenney-roguelike-rpg.png");
      this.load.image("kenney-roguelike-indoor", "/game/kenney-roguelike-indoor.png");
      this.load.spritesheet("chars", "/game/characters.png", { frameWidth: 16, frameHeight: 16, margin: 1, spacing: 2 });
      this.load.image("shadow", "/game/shadow.png");
    }

    create() {
      const map = this.make.tilemap({ key: "office" });
      const tilesets = ["kenney-roguelike-rpg", "kenney-roguelike-indoor"].map((n) => map.addTilesetImage(n, n)!);
      ["floor", "rugs", "walls", "deco", "furniture"].forEach((name, i) => map.createLayer(name, tilesets)!.setDepth(i));
      const collision = map.createLayer("collision", tilesets)!.setVisible(false);
      collision.setCollisionByExclusion([-1]);
      this.mapW = map.widthInPixels;
      this.mapH = map.heightInPixels;
      this.physics.world.setBounds(0, 0, this.mapW, this.mapH);

      for (let c = 0; c < CHARACTER_COUNT; c++) {
        for (let f = 0 as Facing; f < 4; f = (f + 1) as Facing) {
          this.anims.create({ key: walkKey(c, f), frames: [0, 1, 2, 3].map((r) => ({ key: "chars", frame: r * COLS + 4 * c + f })), frameRate: 8, repeat: -1 });
        }
      }

      const objects = map.getObjectLayer("objects")?.objects ?? [];
      for (const ob of objects.filter((ob) => ob.type === "label")) {
        const t = this.add.text(ob.x!, ob.y!, ob.name.toUpperCase(), {
          fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Arial, sans-serif',
          fontSize: `${LABEL_TEX}px`, fontStyle: "600", color: "#3a2a1a",
        }).setOrigin(0.5).setAlpha(0.32).setScale(6 / LABEL_TEX).setDepth(5).setLetterSpacing(6);
        t.texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
        this.floorTexts.push(t);
      }

      // Spawn near the map's spawn point, on a free tile.
      const sp = objects.find((ob) => ob.type === "spawn") ?? { x: this.mapW / 2, y: this.mapH / 2 };
      let sx = sp.x!, sy = sp.y!;
      for (let i = 0; i < 40; i++) {
        const x = sp.x! + Phaser.Math.Between(-4, 4) * 16, y = sp.y! + Phaser.Math.Between(-2, 1) * 16;
        if (!collision.getTileAtWorldXY(x, y + 5)) { sx = x; sy = y; break; }
      }
      const character = characterFor(o.me.name);
      const sprite = this.physics.add.sprite(sx, sy, "chars", idleFrame(character, 0));
      sprite.body!.setSize(10, 6).setOffset(3, 10);
      sprite.setCollideWorldBounds(true);
      this.physics.add.collider(sprite, collision);
      this.self = { sprite, shadow: this.add.image(sx, sy + 7, "shadow"), label: this.makeLabel(o.me.name, true), character, facing: 0 };

      const cam = this.cameras.main;
      cam.setBounds(0, 0, this.mapW, this.mapH);
      cam.startFollow(sprite, true, 0.18, 0.18);
      cam.setBackgroundColor("#1d1d1f");
      this.applyZoom();

      const K = Phaser.Input.Keyboard.KeyCodes;
      this.keys = this.input.keyboard!.addKeys({ up: K.UP, down: K.DOWN, left: K.LEFT, right: K.RIGHT, w: K.W, a: K.A, s: K.S, d: K.D }) as Office["keys"];
      this.game.events.on(Phaser.Core.Events.BLUR, () => this.input.keyboard?.resetKeys());

      if (o.demo) this.startDemo();
      else o.transport.connect(o.me, {
        onStatus: o.onStatus,
        onJoin: () => { this.forceSend = true; },
        onLeave: (id) => this.removeRemote(id),
        onPos: (p) => this.onPos(p),
      });

      // Read-only snapshot for QA / debugging.
      (window as unknown as { __vv: () => unknown }).__vv = () => ({
        kind: o.transport.kind,
        zoom: zoomCss,
        self: this.snap(this.self, o.me.name),
        peers: [...this.remotes.values()].map((r) => ({ id: r.id, ...this.snap(r, r.name), m: r.m })),
      });
    }

    startDemo() {
      for (const b of DEMO_BOTS) {
        const character = characterFor(b.name);
        const sprite = this.add.sprite(0, 0, "chars", idleFrame(character, 0));
        this.bots.push({ sprite, shadow: this.add.image(0, 0, "shadow"), label: this.makeLabel(b.name, false), character, facing: 0 });
      }
      this.self.sprite.body!.enable = false;
      if (o.demo === "wide") {
        // Fixed camera framing the lounge + meeting room doors and the café.
        this.cameras.main.stopFollow();
        this.cameras.main.centerOn(320, 236);
      }
      o.onStatus("live");
      o.onPeople(DEMO_BOTS.map((b, i) => ({ id: `demo-${i}`, name: b.name, character: characterFor(b.name) })).sort((a, b) => a.name.localeCompare(b.name)));
    }

    updateDemo(delta: number) {
      const clock = (window as unknown as { __vvClock?: number }).__vvClock;
      this.demoT = typeof clock === "number" ? clock : this.demoT + delta / 1000;
      const t = this.demoT;
      const row = Math.floor(t * 8) % 4; // 8 fps walk cycle → 80 frames per loop
      const step = (a: Avatar, p: { x: number; y: number; f: Facing }) => {
        a.facing = p.f;
        a.sprite.anims.stop();
        a.sprite.setPosition(p.x, p.y).setFrame(row * COLS + 4 * a.character + p.f);
        this.place(a);
      };
      DEMO_BOTS.forEach((b, i) => step(this.bots[i], onPath(b.path, !!b.pingPong, t + b.phase * DEMO_LOOP)));
      step(this.self, onPath(DEMO_SELF, false, t));
    }

    snap(a: Avatar, name: string) {
      return { name, x: Math.round(a.sprite.x), y: Math.round(a.sprite.y), f: a.facing, anim: a.sprite.anims.isPlaying ? a.sprite.anims.currentAnim?.key : "idle", frame: Number(a.sprite.frame.name) };
    }

    makeLabel(name: string, self: boolean) {
      const text = this.add.text(0, 0, name, {
        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Arial, sans-serif',
        fontSize: `${LABEL_TEX}px`, fontStyle: "600", color: "#ffffff",
      }).setOrigin(0.5);
      text.texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
      const w = text.width + LABEL_TEX * 0.9, h = LABEL_TEX * 1.45;
      const bg = this.add.graphics().fillStyle(self ? 0x0071e3 : 0x1d1d1f, self ? 0.95 : 0.72).fillRoundedRect(-w / 2, -h / 2, w, h, h / 2);
      const label = this.add.container(0, 0, [bg, text]).setDepth(1e6).setScale(this.labelScale());
      this.labels.push(label);
      return label;
    }

    labelScale() { return (o.demo === "wide" ? 22 : o.demo === "phone" ? 15 : LABEL_CSS) / (LABEL_TEX * zoomCss); }

    applyZoom() {
      const w = o.parent.clientWidth, h = o.parent.clientHeight;
      // Pixel-art zoom: 2.5x on desktop, a bit less on phones; never show space outside the map.
      zoomCss = Math.max(w < 640 ? 2.25 : 2.5, w / this.mapW, h / this.mapH);
      if (o.demo === "wide") zoomCss = w / 384; // ~24 tiles across
      if (o.demo === "phone") zoomCss = Math.max(w / 150, h / this.mapH);
      this.cameras.main.setZoom(zoomCss * dpr());
      const s = this.labelScale();
      for (const l of this.labels) l.setScale(s);
    }

    onPos(p: PeerPos) {
      const now = this.time.now;
      let r = this.remotes.get(p.id);
      if (!r) {
        const character = characterFor(p.name);
        const sprite = this.add.sprite(p.x, p.y, "chars", idleFrame(character, p.f ?? 0));
        r = { ...p, sprite, shadow: this.add.image(p.x, p.y + 7, "shadow"), label: this.makeLabel(p.name, false), character, facing: p.f ?? 0, m: !!p.m, seen: now };
        this.remotes.set(p.id, r);
        this.emitPeople();
      }
      r.x = p.x; r.y = p.y; r.m = !!p.m; r.seen = now;
      if (p.f !== undefined) r.facing = p.f;
    }

    removeRemote(id: string) {
      const r = this.remotes.get(id);
      if (!r) return;
      r.sprite.destroy(); r.shadow.destroy(); r.label.destroy();
      this.labels = this.labels.filter((l) => l !== r.label);
      this.remotes.delete(id);
      this.emitPeople();
    }

    emitPeople() {
      o.onPeople([...this.remotes.values()].map((r) => ({ id: r.id, name: r.name, character: r.character })).sort((a, b) => a.name.localeCompare(b.name)));
    }

    place(a: Avatar) {
      const { x, y } = a.sprite;
      a.sprite.setDepth(10 + y);
      a.shadow.setPosition(x, y + 7).setDepth(9 + y);
      a.label.setPosition(x, y - 13);
    }

    animate(a: Avatar, moving: boolean) {
      if (moving) a.sprite.anims.play(walkKey(a.character, a.facing), true);
      else { a.sprite.anims.stop(); a.sprite.setFrame(idleFrame(a.character, a.facing)); }
    }

    update(time: number, delta: number) {
      if (o.demo) return this.updateDemo(delta);
      const dt = Math.min(0.05, delta / 1000);
      const k = this.keys;
      let vx = (k.left.isDown || k.a.isDown ? -1 : 0) + (k.right.isDown || k.d.isDown ? 1 : 0);
      let vy = (k.up.isDown || k.w.isDown ? -1 : 0) + (k.down.isDown || k.s.isDown ? 1 : 0);
      if (!vx && !vy) { const j = o.joystick.current; if (Math.hypot(j.x, j.y) > 0.18) { vx = j.x; vy = j.y; } }
      const len = Math.hypot(vx, vy);
      if (len > 1) { vx /= len; vy /= len; }
      const moving = len > 0;
      const me = this.self;
      me.sprite.setVelocity(vx * SPEED, vy * SPEED);
      if (moving) me.facing = facingOf(vx, vy);
      this.animate(me, moving);
      this.place(me);

      // Network: throttled while moving; start/stop and turns go out immediately; heartbeat when idle.
      const x = me.sprite.x, y = me.sprite.y;
      const changed = Math.abs(x - this.lastX) > 0.3 || Math.abs(y - this.lastY) > 0.3;
      const stateChanged = moving !== this.lastM || me.facing !== this.lastF;
      if (this.forceSend || stateChanged || (changed && time - this.lastSent >= SEND_EVERY) || time - this.lastSent >= HEARTBEAT) {
        o.transport.send({ ...o.me, x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10, f: me.facing, m: moving, t: Date.now() });
        this.lastSent = time; this.lastX = x; this.lastY = y; this.lastF = me.facing; this.lastM = moving; this.forceSend = false;
      }

      // Remotes: exponential smoothing toward the last reported position; drop silent peers.
      const a = 1 - Math.exp(-dt * 12);
      for (const [id, r] of this.remotes) {
        if (time - r.seen > STALE_AFTER) { this.removeRemote(id); continue; }
        const dx = r.x - r.sprite.x, dy = r.y - r.sprite.y, d = Math.hypot(dx, dy);
        if (d > 160) r.sprite.setPosition(r.x, r.y);
        else r.sprite.setPosition(r.sprite.x + dx * a, r.sprite.y + dy * a);
        const walking = r.m || d > 1.5;
        if (!r.m && d > 1.5) r.facing = facingOf(dx, dy);
        this.animate(r, walking);
        this.place(r);
      }
    }
  }

  if (destroyed) return { destroy() {} };
  const w = o.parent.clientWidth, h = o.parent.clientHeight, ratio = dpr();
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: o.parent,
    width: Math.round(w * ratio),
    height: Math.round(h * ratio),
    backgroundColor: "#1d1d1f",
    pixelArt: true,
    banner: false,
    audio: { noAudio: true },
    input: { mouse: false, touch: false, gamepad: false },
    physics: { default: "arcade", arcade: { debug: false } },
    scale: { mode: Phaser.Scale.NONE, zoom: 1 / ratio },
    scene: Office,
  });

  const fit = () => {
    const r = dpr(), cw = o.parent.clientWidth, ch = o.parent.clientHeight;
    if (!cw || !ch) return;
    game.scale.resize(Math.round(cw * r), Math.round(ch * r));
    game.scale.setZoom(1 / r);
    game.canvas.style.width = `${cw}px`;
    game.canvas.style.height = `${ch}px`;
    const scene = game.scene.getScene("office") as Office | null;
    if (scene?.sys.isActive() && scene.mapW) scene.applyZoom();
  };
  const ro = new ResizeObserver(fit);
  ro.observe(o.parent);
  game.events.once(Phaser.Core.Events.READY, fit);

  return {
    destroy() {
      destroyed = true;
      ro.disconnect();
      if (!o.demo) o.transport.disconnect();
      delete (window as unknown as { __vv?: unknown }).__vv;
      game.destroy(true);
    },
  };
}
