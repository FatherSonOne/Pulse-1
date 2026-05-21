import fs from 'fs';
import path from 'path';

const dir = 'dist/assets';
const files = fs.readdirSync(dir).filter(f => f.startsWith('svc-') && f.endsWith('.js'));

function bareName(f) {
  // svc-core-DIedi3ly.js -> svc-core
  const m = f.match(/^(svc-[a-z-]+?)-[A-Za-z0-9_-]+\.js$/);
  return m ? m[1] : f.replace(/\.js$/, '');
}

const graph = {};
for (const f of files) {
  const name = bareName(f);
  const c = fs.readFileSync(path.join(dir, f), 'utf8');
  const matches = c.match(/from"\.\/(svc-[^"]+\.js)"/g) || [];
  const deps = matches.map(s => {
    const fn = s.match(/svc-[^"]+\.js/)[0];
    return bareName(fn);
  });
  graph[name] = [...new Set(deps)].filter(d => d !== name);
}

console.log('=== Chunk dependency graph ===');
for (const [k, v] of Object.entries(graph)) {
  console.log('  ' + k + ' -> ' + (v.join(', ') || '(none)'));
}
console.log('\n=== Cycles ===');
const reported = new Set();
for (const a of Object.keys(graph)) {
  for (const b of graph[a] || []) {
    if (graph[b]?.includes(a)) {
      const key = [a, b].sort().join('|');
      if (!reported.has(key)) {
        reported.add(key);
        console.log('  CYCLE: ' + a + ' <-> ' + b);
      }
    }
  }
}
if (reported.size === 0) console.log('  (none — chunk graph is acyclic)');
