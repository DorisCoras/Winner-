// Demo sürümünü derler ve tek, bağımsız bir HTML dosyasına gömer:
//   client/dist-demo/fimar-ik-demo.html  (tarayıcıda doğrudan açılabilir)
import { execSync } from 'node:child_process';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const clientDir = new URL('../client/', import.meta.url).pathname;
const outDir = join(clientDir, 'dist-demo');
execSync('npx vite build --config vite.demo.config.js', { cwd: clientDir, stdio: 'inherit' });

const assets = readdirSync(join(outDir, 'assets'));
const js = assets.filter((f) => f.endsWith('.js')).map((f) => readFileSync(join(outDir, 'assets', f), 'utf8'));
const css = assets.filter((f) => f.endsWith('.css')).map((f) => readFileSync(join(outDir, 'assets', f), 'utf8'));
if (js.length !== 1) throw new Error(`Tek bir JS paketi bekleniyordu, bulunan: ${js.length}`);

const html = readFileSync(join(outDir, 'demo.html'), 'utf8');
const title = html.match(/<title>.*?<\/title>/)[0];
const root = html.match(/<div id="root">[\s\S]*?<\/div><\/div>/)[0];
// Gömülü betikte "</script" dizisi HTML ayrıştırıcısını erken kapatmasın.
const script = js[0].replace(/<\/(script)/gi, '<\\/$1');
const page = `${title}
<meta name="color-scheme" content="light dark" />
<style>${css.join('\n')}</style>
${root}
<script type="module">${script}</script>
`;
const target = join(outDir, 'fimar-ik-demo.html');
writeFileSync(target, page);
console.log(`Demo hazır: ${target} (${(Buffer.byteLength(page) / 1024 / 1024).toFixed(2)} MB)`);
