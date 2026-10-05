const { chromium } = require('playwright-core');
const fs = require('fs');
const FPS = 30, LOOP = 10;
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const modes = (process.env.MODES || 'wide,phone').split(',');
  for (const mode of modes) {
    const [vp, dsf] = mode === 'wide' ? [{ width: 1280, height: 832 }, 1] : [{ width: 390, height: 846 }, 2];
    const dir = `/tmp/frames-${mode}`; fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir);
    const c = await b.newContext({ viewport: vp, deviceScaleFactor: dsf, isMobile: mode === 'phone', hasTouch: mode === 'phone' });
    const p = await c.newPage();
    await p.goto(`http://localhost:3123/room/lobby?name=Howls&demo=${mode}`);
    await p.waitForFunction(() => window.__vv, null, { timeout: 20000 }); await p.waitForTimeout(1500);
    const t0 = Date.now();
    for (let i = 0; i < FPS * LOOP; i++) {
      await p.evaluate((t) => new Promise((r) => { window.__vvClock = t; requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r))); }), i / FPS);
      await p.screenshot({ path: `${dir}/f${String(i).padStart(4, '0')}.png` });
    }
    console.log(mode, 'frames', FPS * LOOP, 'in', Date.now() - t0, 'ms');
    await c.close();
  }
  await b.close();
})();
