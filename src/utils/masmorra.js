// Mapas em células (estilo "dungeon maker").
// Cada célula é um caractere:
//   '.' vazio (rocha)   '#' chão   '~' água   ',' terra   '^' lava   'D' porta   'S' escada
// Tudo que não é '.' conta como piso (as paredes são desenhadas na borda entre piso e vazio).

export const VAZIO = '.';
export const TERRENOS = [
  { id: '#', nome: 'Chão', icone: 'square' },
  { id: ',', nome: 'Terra', icone: 'grass' },
  { id: '~', nome: 'Água', icone: 'water' },
  { id: '^', nome: 'Lava', icone: 'fire' },
];
export const ehPiso = (c) => !!c && c !== VAZIO;

// gerador pseudoaleatório com semente (mesma semente = mesmo mapa)
export function aleatorio(semente) {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const entre = (r, min, max) => min + Math.floor(r() * (max - min + 1));

export const gradeVazia = (cols, rows) => Array.from({ length: rows }, () => Array(cols).fill(VAZIO));
export const paraLinhas = (g) => g.map((l) => l.join(''));
export const deLinhas = (linhas) => linhas.map((l) => l.split(''));
export const copiarGrade = (g) => g.map((l) => l.slice());

export function preencherRet(g, x0, y0, x1, y1, c) {
  const rows = g.length;
  const cols = g[0].length;
  for (let y = Math.max(0, Math.min(y0, y1)); y <= Math.min(rows - 1, Math.max(y0, y1)); y++)
    for (let x = Math.max(0, Math.min(x0, x1)); x <= Math.min(cols - 1, Math.max(x0, x1)); x++) g[y][x] = c;
}

export function pintar(g, cx, cy, raio, c) {
  preencherRet(g, cx - raio, cy - raio, cx + raio, cy + raio, c);
}

// ---------- gerador: masmorra (salas + corredores) ----------
export function gerarMasmorra(cols, rows, semente, { salas = 9, portas = true } = {}) {
  const r = aleatorio(semente);
  const g = gradeVazia(cols, rows);
  const lista = [];
  for (let t = 0; t < 400 && lista.length < salas; t++) {
    const w = entre(r, 4, Math.max(4, Math.min(10, Math.floor(cols / 3))));
    const h = entre(r, 3, Math.max(3, Math.min(8, Math.floor(rows / 3))));
    const x = entre(r, 1, cols - w - 2);
    const y = entre(r, 1, rows - h - 2);
    if (x < 1 || y < 1) continue;
    const sobrepoe = lista.some((s) => x <= s.x + s.w + 1 && x + w + 1 >= s.x && y <= s.y + s.h + 1 && y + h + 1 >= s.y);
    if (sobrepoe) continue;
    lista.push({ x, y, w, h, cx: x + Math.floor(w / 2), cy: y + Math.floor(h / 2) });
  }
  lista.sort((a, b) => a.cx - b.cx);
  lista.forEach((s) => preencherRet(g, s.x, s.y, s.x + s.w - 1, s.y + s.h - 1, '#'));

  const dentroDeSala = (x, y) => lista.some((s) => x >= s.x && x < s.x + s.w && y >= s.y && y < s.y + s.h);
  const corredor = (a, b) => {
    const cavar = (x, y) => {
      if (g[y][x] === VAZIO) g[y][x] = '#';
    };
    if (r() < 0.5) {
      for (let x = Math.min(a.cx, b.cx); x <= Math.max(a.cx, b.cx); x++) cavar(x, a.cy);
      for (let y = Math.min(a.cy, b.cy); y <= Math.max(a.cy, b.cy); y++) cavar(b.cx, y);
    } else {
      for (let y = Math.min(a.cy, b.cy); y <= Math.max(a.cy, b.cy); y++) cavar(a.cx, y);
      for (let x = Math.min(a.cx, b.cx); x <= Math.max(a.cx, b.cx); x++) cavar(x, b.cy);
    }
  };
  for (let i = 1; i < lista.length; i++) corredor(lista[i - 1], lista[i]);
  for (let k = 0; k < Math.floor(lista.length / 3); k++) {
    const a = lista[entre(r, 0, lista.length - 1)];
    const b = lista[entre(r, 0, lista.length - 1)];
    if (a !== b) corredor(a, b);
  }

  // portas: piso de corredor encostado na sala, com paredes dos dois lados
  if (portas) {
    for (let y = 1; y < rows - 1; y++)
      for (let x = 1; x < cols - 1; x++) {
        if (g[y][x] !== '#' || dentroDeSala(x, y)) continue;
        const horiz = g[y][x - 1] === VAZIO && g[y][x + 1] === VAZIO && (dentroDeSala(x, y - 1) || dentroDeSala(x, y + 1));
        const vert = g[y - 1][x] === VAZIO && g[y + 1][x] === VAZIO && (dentroDeSala(x - 1, y) || dentroDeSala(x + 1, y));
        if ((horiz || vert) && r() < 0.7) g[y][x] = 'D';
      }
  }
  if (lista.length) {
    g[lista[0].cy][lista[0].cx] = 'S';
    const u = lista[lista.length - 1];
    g[u.cy][u.cx] = 'S';
  }
  return g;
}

// ---------- gerador: caverna (autômato celular) ----------
export function gerarCaverna(cols, rows, semente, opcoes = {}) {
  // tenta de novo (com semente derivada) se a caverna sair pequena demais
  for (let t = 0; t < 6; t++) {
    const g = cavernaUmaVez(cols, rows, semente + t * 7919, opcoes);
    const piso = g.reduce((n, l) => n + l.filter((c) => c !== VAZIO).length, 0);
    if (piso >= cols * rows * 0.35 || t === 5) return g;
  }
}

function cavernaUmaVez(cols, rows, semente, { densidade = 0.4, agua = true } = {}) {
  const r = aleatorio(semente);
  let g = gradeVazia(cols, rows);
  for (let y = 1; y < rows - 1; y++) for (let x = 1; x < cols - 1; x++) g[y][x] = r() < densidade ? VAZIO : '#';
  const vizinhosVazios = (gg, x, y) => {
    let n = 0;
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const yy = y + dy;
        const xx = x + dx;
        if (yy < 0 || xx < 0 || yy >= rows || xx >= cols || gg[yy][xx] === VAZIO) n++;
      }
    return n;
  };
  for (let it = 0; it < 5; it++) {
    const n = gradeVazia(cols, rows);
    for (let y = 1; y < rows - 1; y++)
      for (let x = 1; x < cols - 1; x++) {
        const v = vizinhosVazios(g, x, y);
        n[y][x] = v > 4 ? VAZIO : v < 4 ? '#' : g[y][x];
      }
    g = n;
  }
  // mantém só a maior região conectada
  const marca = gradeVazia(cols, rows).map((l) => l.map(() => 0));
  let melhor = [];
  for (let y = 0; y < rows; y++)
    for (let x = 0; x < cols; x++) {
      if (g[y][x] === VAZIO || marca[y][x]) continue;
      const regiao = [];
      const pilha = [[x, y]];
      marca[y][x] = 1;
      while (pilha.length) {
        const [px, py] = pilha.pop();
        regiao.push([px, py]);
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => {
          const nx = px + dx;
          const ny = py + dy;
          if (nx >= 0 && ny >= 0 && nx < cols && ny < rows && !marca[ny][nx] && g[ny][nx] !== VAZIO) {
            marca[ny][nx] = 1;
            pilha.push([nx, ny]);
          }
        });
      }
      if (regiao.length > melhor.length) melhor = regiao;
    }
  const final = gradeVazia(cols, rows);
  melhor.forEach(([x, y]) => (final[y][x] = '#'));
  // poças d'água
  if (agua && melhor.length) {
    for (let p = 0; p < entre(r, 1, 3); p++) {
      let [x, y] = melhor[entre(r, 0, melhor.length - 1)];
      for (let passo = 0; passo < entre(r, 15, 45); passo++) {
        if (final[y] && final[y][x] && final[y][x] !== VAZIO) final[y][x] = '~';
        const [dx, dy] = [[1, 0], [-1, 0], [0, 1], [0, -1]][entre(r, 0, 3)];
        if (final[y + dy] && final[y + dy][x + dx] && final[y + dy][x + dx] !== VAZIO) {
          x += dx;
          y += dy;
        }
      }
    }
  }
  return final;
}

// ---------- gerador: labirinto (backtracking) ----------
export function gerarLabirinto(cols, rows, semente) {
  const r = aleatorio(semente);
  const g = gradeVazia(cols, rows);
  const W = Math.floor((cols - 1) / 2);
  const H = Math.floor((rows - 1) / 2);
  if (W < 1 || H < 1) return g;
  const visit = Array.from({ length: H }, () => Array(W).fill(false));
  const pilha = [[0, 0]];
  visit[0][0] = true;
  g[1][1] = '#';
  while (pilha.length) {
    const [cx, cy] = pilha[pilha.length - 1];
    const op = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => {
      const nx = cx + dx;
      const ny = cy + dy;
      return nx >= 0 && ny >= 0 && nx < W && ny < H && !visit[ny][nx];
    });
    if (!op.length) {
      pilha.pop();
      continue;
    }
    const [dx, dy] = op[entre(r, 0, op.length - 1)];
    const nx = cx + dx;
    const ny = cy + dy;
    visit[ny][nx] = true;
    g[1 + cy * 2 + dy][1 + cx * 2 + dx] = '#';
    g[1 + ny * 2][1 + nx * 2] = '#';
    pilha.push([nx, ny]);
  }
  g[1][1] = 'S';
  g[1 + (H - 1) * 2][1 + (W - 1) * 2] = 'S';
  return g;
}

export const GERADORES = [
  { id: 'masmorra', nome: 'Masmorra', icone: 'castle', gerar: gerarMasmorra },
  { id: 'caverna', nome: 'Caverna', icone: 'terrain', gerar: gerarCaverna },
  { id: 'labirinto', nome: 'Labirinto', icone: 'puzzle-outline', gerar: gerarLabirinto },
];
