// Teste visual local: abre o app servido por rota simulada e tira capturas.
// Uso: node tools/teste_tela.js <pasta_saida> <caminho_leaflet.js>
const { chromium } = require('playwright');
const fs = require('fs');
const OUT = process.argv[2] || '.';
const LEAFLET = process.argv[3];
(async () => {
  const b = await chromium.launch();
  for (const [name, vp] of [['desk', { width: 1400, height: 860 }], ['phone', { width: 400, height: 820 }]]) {
    const p = await b.newPage({ viewport: vp });
    const errs = [];
    p.on('pageerror', e => errs.push('pageerror ' + e.message));
    p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    if (LEAFLET) await p.route('**/cdnjs.cloudflare.com/**/leaflet.js', r => r.fulfill({ body: fs.readFileSync(LEAFLET), contentType: 'text/javascript' }));
    await p.route('**/fonts.g*/**', r => r.abort());
    await p.route('http://gleba.test/**', r => { const f = new URL(r.request().url()).pathname.slice(1); try { r.fulfill({ body: fs.readFileSync(require('path').join(__dirname, '..', f)), contentType: f.endsWith('.html') ? 'text/html' : 'application/json' }); } catch (e) { r.fulfill({ status: 404, body: '' }); } });
    await p.route(/arcgisonline\.com/, r => r.abort());
    await p.goto('http://gleba.test/index.html');
    await p.waitForTimeout(2500);
    await p.screenshot({ path: OUT + '/' + name + '-1.png' });
    await p.click('summary[data-p]');
    await p.waitForTimeout(300);
    await p.click('summary[data-f]');
    await p.waitForTimeout(300);
    await p.click('.t[data-t]');
    await p.waitForTimeout(800);
    await p.screenshot({ path: OUT + '/' + name + '-2.png' });
    if (name === 'desk') {
      await p.goto('http://gleba.test/index.html#ordens'); await p.waitForTimeout(1500);
      await p.screenshot({ path: OUT + '/' + name + '-3.png' });
      await p.click('.card'); await p.waitForTimeout(400);
      await p.screenshot({ path: OUT + '/' + name + '-4.png' });
      await p.click('[data-save]'); await p.waitForTimeout(400);
      await p.goto('http://gleba.test/index.html#monitoramentos'); await p.waitForTimeout(1200);
      await p.screenshot({ path: OUT + '/' + name + '-5.png' });
    }
    console.log(name, errs);
  }
  await b.close();
})();
