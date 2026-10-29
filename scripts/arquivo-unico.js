// Gera um único App.js (snack/App.js) a partir do projeto em pastas.
// Uso: node scripts/arquivo-unico.js
// Útil para colar no Expo Snack de uma vez só.
const fs = require('fs');
const path = require('path');

const RAIZ = path.resolve(__dirname, '..');
const SAIDA = path.join(RAIZ, 'snack', 'App.js');
const IMPORT_RE = /^import\s+([^;]*?)\s+from\s+['"]([^'"]+)['"];[ \t]*\n?/gm;

const resolver = (de, rel) => {
  const base = path.resolve(path.dirname(de), rel);
  return fs.existsSync(base + '.js') ? base + '.js' : path.join(base, 'index.js');
};

// 1) ordem: dependências antes de quem as usa (busca em profundidade a partir do App.js)
const ordem = [];
const visitados = new Set();
function visitar(arq) {
  if (visitados.has(arq)) return;
  visitados.add(arq);
  const txt = fs.readFileSync(arq, 'utf8');
  for (const m of txt.matchAll(IMPORT_RE)) if (m[2].startsWith('.')) visitar(resolver(arq, m[2]));
  ordem.push(arq);
}
visitar(path.join(RAIZ, 'App.js'));

// 2) junta imports externos e corpos
const externos = {}; // modulo -> { padrao, ns, nomes:Set }
const nomesTopo = {};
let corpo = '';

for (const arq of ordem) {
  let txt = fs.readFileSync(arq, 'utf8');
  for (const m of txt.matchAll(IMPORT_RE)) {
    if (m[2].startsWith('.')) continue;
    const e = (externos[m[2]] = externos[m[2]] || { padrao: null, ns: null, nomes: new Set() });
    let spec = m[1].trim();
    const ns = spec.match(/\*\s+as\s+([\w$]+)/);
    if (ns) e.ns = ns[1];
    const chaves = spec.match(/\{([^}]*)\}/);
    if (chaves) chaves[1].split(',').map((x) => x.trim()).filter(Boolean).forEach((n) => e.nomes.add(n));
    const pad = spec.replace(/\{[^}]*\}/, '').replace(/\*\s+as\s+[\w$]+/, '').replace(/,/g, '').trim();
    if (pad) e.padrao = pad;
  }
  txt = txt.replace(IMPORT_RE, '').replace(/^export default /gm, '').replace(/^export /gm, '');

  // estilos: cada arquivo ganha um nome próprio (estMesa, estPalco...)
  const nomeArq = path.basename(arq, '.js');
  const novoEst = 'est' + nomeArq.charAt(0).toUpperCase() + nomeArq.slice(1);
  for (const m of [...txt.matchAll(/^const ([\w$]+) = StyleSheet\.create/gm)]) {
    const antigo = m[1];
    txt = txt.replace(new RegExp(`^const ${antigo} = StyleSheet\\.create`, 'm'), `const ${novoEst} = StyleSheet.create`);
    txt = txt.replace(new RegExp(`(^|[^\\w.$])${antigo}\\.(?=[A-Za-z_])`, 'g'), `$1${novoEst}.`);
  }

  // nomes de topo repetidos entre arquivos quebrariam o arquivo único
  for (const m of txt.matchAll(/^(?:async\s+)?(?:function|const|let|class)\s+([\w$]+)/gm)) {
    if (nomesTopo[m[1]] && nomesTopo[m[1]] !== arq) {
      console.error(`Nome repetido "${m[1]}" em ${path.relative(RAIZ, nomesTopo[m[1]])} e ${path.relative(RAIZ, arq)}`);
      process.exit(1);
    }
    nomesTopo[m[1]] = arq;
  }

  const rel = path.relative(RAIZ, arq);
  corpo += `\n// ${'='.repeat(64)}\n// ${rel}\n// ${'='.repeat(64)}\n${txt.trim()}\n`;
}

corpo = corpo.replace(/^function App\(\)/m, 'export default function App()');

const cab = Object.entries(externos)
  .map(([mod, e]) => {
    const partes = [];
    if (e.padrao) partes.push(e.padrao);
    if (e.ns) partes.push(`* as ${e.ns}`);
    if (e.nomes.size) partes.push(`{ ${[...e.nomes].join(', ')} }`);
    return `import ${partes.join(', ')} from '${mod}';`;
  })
  .join('\n');

fs.mkdirSync(path.dirname(SAIDA), { recursive: true });
fs.writeFileSync(
  SAIDA,
  `// MESA VORTEX — arquivo único gerado por scripts/arquivo-unico.js (não edite aqui; edite em src/)\n${cab}\n${corpo}`
);
console.log(`Gerado ${path.relative(RAIZ, SAIDA)} com ${ordem.length} arquivos.`);
