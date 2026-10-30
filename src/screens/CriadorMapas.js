// Criador de mapas no estilo do Dungeondraft:
// gere masmorras, cavernas e labirintos; pinte salas e terrenos com textura; coloque objetos de cenário
// dos seus packs; trace caminhos (estradas, rios); posicione luzes; trabalhe em vários andares;
// use qualquer asset (cenário, personagens com ficha, estruturas inteiras);
// importe mapas exportados do próprio Dungeondraft (.dd2vtt). Tudo é salvo em Meus assets › Mapas.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, PanResponder, Platform, ActivityIndicator } from 'react-native';
import Svg, { G, Path, Rect } from 'react-native-svg';
import { MaterialCommunityIcons as Icone } from '@expo/vector-icons';
import { MapaTilesSvg, TEMAS_MAPA } from '../components/MapaTiles';
import { PropSvg, LuzSvg, EscuridaoSvg, TokenSimplesSvg, FormaSvg } from '../components/ItensSvg';
import { dadosDeJogo } from '../components/Ficha';
import { AssetMini } from '../components/AssetMini';
import { Topo } from './Packs';
import { C } from '../config/theme';
import { salvar } from '../services/firestore';
import { lerPacksAtivos } from '../services/auth';
import { assetsDe, carregarMeusAssets, carregarTodosPacks, packEstaAtivo, packVisivelPara } from '../services/assets';
import { escolherArquivoVtt, importarVtt } from '../services/dungeondraft';
import { gerarId, limitar, pastasDe, pathDosPontos } from '../utils/util';
import { GERADORES, TERRENOS, VAZIO, deLinhas, ehPiso, gradeVazia, paraLinhas, pintar, preencherRet } from '../utils/masmorra';

const CEL_MUNDO = 70; // tamanho da célula quando o mapa vai para a mesa
const TAMANHOS = [
  [20, 15],
  [30, 20],
  [40, 30],
  [60, 40],
];
const FERRAMENTAS_PINTAR = [
  { id: 'pincel', nome: 'Pincel', icone: 'brush' },
  { id: 'sala', nome: 'Sala', icone: 'vector-square' },
  { id: 'borracha', nome: 'Borracha', icone: 'eraser' },
  { id: 'porta', nome: 'Porta', icone: 'door' },
  { id: 'escada', nome: 'Escada', icone: 'stairs' },
  { id: 'mover', nome: 'Mover', icone: 'hand-back-right-outline' },
];
const CAMINHOS = [
  { id: 'estrada', nome: 'Estrada', cor: '#a8916b', largura: 1.2, opac: 0.9, icone: 'road-variant' },
  { id: 'trilha', nome: 'Trilha', cor: '#7c6a4d', largura: 0.45, opac: 0.85, icone: 'walk' },
  { id: 'rio', nome: 'Rio', cor: '#3b82f6', largura: 1.4, opac: 0.8, icone: 'waves' },
  { id: 'lava', nome: 'Lava', cor: '#ef4444', largura: 0.9, opac: 0.85, icone: 'fire' },
  { id: 'muro', nome: 'Muro', cor: '#3f3a36', largura: 0.3, opac: 1, icone: 'wall' },
];
const CORES_LUZ = ['#ffd27a', '#ffffff', '#ff8a3d', '#60a5fa', '#a78bfa', '#4ade80', '#f87171'];
const ABAS_CRIADOR = [
  { id: 'gerar', nome: 'Gerar', icone: 'auto-fix', ferramenta: 'mover' },
  { id: 'pintar', nome: 'Pintar', icone: 'brush', ferramenta: 'pincel' },
  { id: 'cenario', nome: 'Assets', icone: 'package-variant', ferramenta: 'objeto' },
  { id: 'detalhes', nome: 'Caminhos e luzes', icone: 'lightbulb-on-outline', ferramenta: 'caminho' },
  { id: 'mapa', nome: 'Mapa', icone: 'layers-outline', ferramenta: 'mover' },
];
const novaSemente = () => Math.floor(Math.random() * 1e9);
const nivelVazio = (nome, cols, rows) => ({ nome, g: gradeVazia(cols, rows), objetos: [], caminhos: [], luzes: [], tokens: [], formas: [] });
// lista de cada tipo de elemento colocado no mapa
const LISTA = { objeto: 'objetos', luz: 'luzes', caminho: 'caminhos', token: 'tokens', forma: 'formas' };
const TIPOS_USO = [
  { id: 'objeto', nome: 'Cenário', icone: 'pine-tree' },
  { id: 'personagem', nome: 'Personagens', icone: 'account-group-outline' },
  { id: 'estrutura', nome: 'Estruturas', icone: 'home-city-outline' },
];

// Lê os dados de edição salvos (ou converte um mapa antigo, só com células)
function carregarNiveis(asset) {
  if (asset && asset.criador && Array.isArray(asset.criador.niveis) && asset.criador.niveis.length) {
    return asset.criador.niveis.map((n) => ({
      nome: n.nome,
      g: deLinhas(n.linhas),
      objetos: n.objetos || [],
      caminhos: n.caminhos || [],
      luzes: n.luzes || [],
      tokens: n.tokens || [],
      formas: n.formas || [],
    }));
  }
  const tiles = asset && (asset.itens || []).find((i) => i.type === 'tiles');
  if (tiles) return [{ nome: 'Térreo', g: deLinhas(tiles.linhas), objetos: [], caminhos: [], luzes: [], tokens: [], formas: [] }];
  return null;
}

export default function CriadorMapas({ usuario, asset, onVoltar }) {
  const cfg = (asset && asset.criador) || {};
  const tilesOrig = asset && (asset.itens || []).find((i) => i.type === 'tiles');
  const niveis = useRef(carregarNiveis(asset));
  const [nivel, setNivel] = useState(0);
  const primeiro = niveis.current && niveis.current[0];
  const [cols, setCols] = useState(primeiro ? primeiro.g[0].length : 30);
  const [rows, setRows] = useState(primeiro ? primeiro.g.length : 20);
  const [versao, setVersao] = useState(0);
  const historico = useRef([]);

  const [nome, setNome] = useState(asset ? asset.nome : '');
  const [tema, setTema] = useState(cfg.tema || (tilesOrig && tilesOrig.tema) || 'pedra');
  const [mostrarGrade, setMostrarGrade] = useState(cfg.mostrarGrade !== undefined ? cfg.mostrarGrade : true);
  const [textura, setTextura] = useState(cfg.textura !== false);
  const [escuridao, setEscuridao] = useState((asset && asset.sala && asset.sala.escuridao) || 0);
  const [aba, setAba] = useState(niveis.current ? 'pintar' : 'gerar');
  const [gerador, setGerador] = useState((asset && asset.gerador && asset.gerador.tipo) || 'masmorra');
  const [semente, setSemente] = useState((asset && asset.gerador && asset.gerador.semente) || novaSemente());
  const [salas, setSalas] = useState(9);
  const [agua, setAgua] = useState(true);
  const [ferramenta, setFerramenta] = useState(niveis.current ? 'pincel' : 'mover');
  const [terreno, setTerreno] = useState('#');
  const [raio, setRaio] = useState(0);
  const [tipoCaminho, setTipoCaminho] = useState('estrada');
  const [corLuz, setCorLuz] = useState(CORES_LUZ[0]);
  const [raioLuz, setRaioLuz] = useState(4);
  const [encaixar, setEncaixar] = useState(true);
  const [sel, setSel] = useState(null); // { tipo: 'objeto' | 'luz' | 'caminho', id }
  const [view, setView] = useState({ x: 10, y: 10, s: 16 });
  const [area, setArea] = useState({ w: 0, h: 0 });
  const [previa, setPreviaEstado] = useState(null);
  const previaRef = useRef(null);
  const setPrevia = (v) => {
    previaRef.current = v;
    setPreviaEstado(v);
  };
  const [msg, setMsg] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [idSalvo, setIdSalvo] = useState(asset ? asset.id : null);

  // assets de cenário (Meus assets + packs em uso)
  const [fontes, setFontes] = useState([]);
  const [fonte, setFonte] = useState('todos');
  const [estadoFontes, setEstadoFontes] = useState('carregando'); // carregando | ok | erro
  const [pastaObj, setPastaObj] = useState(null);
  const [modelo, setModelo] = useState(null);
  const [tipoUso, setTipoUso] = useState('objeto');

  if (!niveis.current) {
    niveis.current = [{ ...nivelVazio('Térreo', 30, 20), g: GERADORES[0].gerar(30, 20, semente, { salas: 9 }) }];
  }
  const nivelRef = useRef(0);
  nivelRef.current = nivel;
  const N = () => niveis.current[nivelRef.current];

  useEffect(() => {
    (async () => {
      try {
        const [meus, packs, ativos] = await Promise.all([carregarMeusAssets(usuario.usuario), carregarTodosPacks(), lerPacksAtivos(usuario.usuario)]);
        const objetos = (l) => l.filter((a) => a.tipo === 'objeto' || a.tipo === 'personagem' || a.tipo === 'estrutura');
        const dosPacks = packs
          .filter((p) => packVisivelPara(p, usuario.usuario) && packEstaAtivo(ativos, p.id))
          .map((p) => ({ id: p.id, nome: p.nome, assets: objetos(p.assets) }))
          .filter((f) => f.assets.length);
        const meusObj = objetos(meus);
        // "Todos" junta Meus assets + packs em uso (sem repetir as cópias de pack)
        const copias = new Set(meusObj.map((a) => a.origem).filter(Boolean));
        const todos = [...meusObj, ...dosPacks.flatMap((f) => f.assets.filter((a) => !copias.has(a.id)))];
        setFontes([{ id: 'todos', nome: 'Todos', assets: todos }, { id: 'meus', nome: 'Meus assets', assets: meusObj }, ...dosPacks]);
        setEstadoFontes('ok');
      } catch (e) {
        setEstadoFontes('erro');
      }
    })();
  }, []);

  const linhas = useMemo(() => paraLinhas(N().g), [versao, nivel]);
  const avisar = (t, ms = 2500) => {
    setMsg(t);
    setTimeout(() => setMsg((m) => (m === t ? '' : m)), ms);
  };
  const atualizar = () => setVersao((v) => v + 1);

  // ---------- histórico (por andar) ----------
  function guardar() {
    const n = N();
    historico.current.push({ nivel: nivelRef.current, dados: JSON.stringify({ ...n, g: paraLinhas(n.g) }) });
    if (historico.current.length > 40) historico.current.shift();
  }
  function desfazer() {
    const ant = historico.current.pop();
    if (!ant) return avisar('Nada para desfazer');
    const d = JSON.parse(ant.dados);
    niveis.current[ant.nivel] = { ...d, g: deLinhas(d.g) };
    setNivel(ant.nivel);
    setSel(null);
    atualizar();
  }

  // ---------- geração e tamanho ----------
  function gerar(c = cols, r = rows, sem = semente) {
    guardar();
    const gen = GERADORES.find((x) => x.id === gerador);
    // tamanho vale para todos os andares
    niveis.current.forEach((n, i) => {
      if (i !== nivel) n.g = redimensionarGrade(n.g, c, r);
    });
    N().g = gen.gerar(c, r, sem, { salas, agua });
    setCols(c);
    setRows(r);
    atualizar();
    ajustar(c, r);
  }

  function redimensionarGrade(g, c, r) {
    const novo = gradeVazia(c, r);
    for (let y = 0; y < Math.min(r, g.length); y++) for (let x = 0; x < Math.min(c, g[0].length); x++) novo[y][x] = g[y][x];
    return novo;
  }

  function redimensionar(c, r) {
    guardar();
    niveis.current.forEach((n) => (n.g = redimensionarGrade(n.g, c, r)));
    setCols(c);
    setRows(r);
    atualizar();
    ajustar(c, r);
  }

  function limpar() {
    guardar();
    Object.assign(N(), { g: gradeVazia(cols, rows), objetos: [], caminhos: [], luzes: [], tokens: [], formas: [] });
    setSel(null);
    atualizar();
  }

  // ---------- andares ----------
  function novoAndar() {
    const nomes = ['Térreo', 'Subsolo', 'Primeiro andar', 'Segundo andar', 'Torre', 'Cripta'];
    niveis.current.push(nivelVazio(nomes[niveis.current.length] || `Andar ${niveis.current.length + 1}`, cols, rows));
    setNivel(niveis.current.length - 1);
    setSel(null);
    atualizar();
  }
  function apagarAndar() {
    if (niveis.current.length <= 1) return avisar('O mapa precisa de ao menos um andar');
    niveis.current.splice(nivel, 1);
    setNivel(Math.max(0, nivel - 1));
    setSel(null);
    atualizar();
  }
  function renomearAndar(t) {
    N().nome = t;
    atualizar();
  }

  // ---------- vista ----------
  function ajustar(c = cols, r = rows, a = area) {
    if (!a.w) return;
    const s = Math.max(4, Math.min((a.w - 20) / c, (a.h - 20) / r));
    setView({ s, x: (a.w - c * s) / 2, y: (a.h - r * s) / 2 });
  }
  function zoom(f) {
    setView((v) => {
      const s = limitar(v.s * f, 4, 80);
      const cx = area.w / 2;
      const cy = area.h / 2;
      return { s, x: cx - ((cx - v.x) / v.s) * s, y: cy - ((cy - v.y) / v.s) * s };
    });
  }

  // ---------- seleção ----------
  const selecionado = sel && (N()[LISTA[sel.tipo]] || []).find((o) => o.id === sel.id);
  function alterarSel(fn) {
    if (!selecionado) return;
    guardar();
    fn(selecionado);
    atualizar();
  }
  function apagarSel() {
    if (!sel) return;
    guardar();
    const k = LISTA[sel.tipo];
    N()[k] = N()[k].filter((o) => o.id !== sel.id);
    setSel(null);
    atualizar();
  }

  function acharEm(c) {
    const n = N();
    for (let i = n.luzes.length - 1; i >= 0; i--) {
      const l = n.luzes[i];
      if (Math.hypot(c.x - l.x, c.y - l.y) < 0.6) return { tipo: 'luz', id: l.id };
    }
    for (let i = n.tokens.length - 1; i >= 0; i--) {
      const tk = n.tokens[i];
      if (Math.hypot(c.x - tk.x, c.y - tk.y) <= tk.r) return { tipo: 'token', id: tk.id };
    }
    for (let i = n.objetos.length - 1; i >= 0; i--) {
      const o = n.objetos[i];
      if (c.x >= o.x && c.x <= o.x + o.w && c.y >= o.y && c.y <= o.y + o.h) return { tipo: 'objeto', id: o.id };
    }
    for (let i = n.caminhos.length - 1; i >= 0; i--) {
      const cm = n.caminhos[i];
      if (cm.pts.some((p) => Math.hypot(c.x - p.x, c.y - p.y) < Math.max(0.6, cm.largura))) return { tipo: 'caminho', id: cm.id };
    }
    for (let i = n.formas.length - 1; i >= 0; i--) {
      const fm = n.formas[i];
      const b = fm.caixa || { x: 0, y: 0, w: 1, h: 1 };
      if (c.x >= fm.x + b.x && c.x <= fm.x + b.x + b.w && c.y >= fm.y + b.y && c.y <= fm.y + b.y + b.h) return { tipo: 'forma', id: fm.id };
    }
    return null;
  }

  // Personagem vira token (com ficha); estrutura é "carimbada" com todos os seus elementos
  function colocarAsset(m, p, n, enc) {
    if (m.tipo === 'personagem') {
      const tam = m.tamanho || 1;
      const meio = tam % 2 ? 0.5 : 0;
      const tk = {
        id: gerarId(),
        x: enc ? Math.floor(p.x - meio + 0.5) + meio : p.x,
        y: enc ? Math.floor(p.y - meio + 0.5) + meio : p.y,
        tam,
        r: tam * 0.45,
        cor: m.cor || '#8b5cf6',
        img: m.img || '',
        nome: m.nome,
        ficha: dadosDeJogo({ ...m, tipo: m.categoria }),
      };
      n.tokens.push(tk);
      setSel({ tipo: 'token', id: tk.id });
      return;
    }
    // estrutura: unidades originais -> células
    const k = 1 / (m.cel || CEL_MUNDO);
    const w = (m.w || 0) * k;
    const h = (m.h || 0) * k;
    const x0 = enc ? Math.round(p.x - w / 2) : p.x - w / 2;
    const y0 = enc ? Math.round(p.y - h / 2) : p.y - h / 2;
    (m.itens || []).forEach((it) => {
      const x = x0 + it.x * k;
      const y = y0 + it.y * k;
      if (it.type === 'prop') n.objetos.push({ id: gerarId(), x, y, w: it.w * k, h: it.h * k, rot: it.rot || 0, emoji: it.emoji || '', img: it.img || '', nome: it.rotulo || '' });
      else if (it.type === 'luz') n.luzes.push({ id: gerarId(), x, y, r: it.r * k, cor: it.cor, intensidade: it.intensidade || 1 });
      else if (it.type === 'token')
        n.tokens.push({ id: gerarId(), x, y, tam: it.tam || 1, r: (it.tam || 1) * 0.45, cor: it.cor, img: it.img || '', nome: it.rotulo || '', ficha: it.ficha || null });
      else if (it.type === 'rect' || it.type === 'circle' || it.type === 'draw') {
        const sp = it.escalaPath || 1;
        const caixa =
          it.type === 'circle'
            ? { x: -it.r * k, y: -it.r * k, w: it.r * 2 * k, h: it.r * 2 * k }
            : { x: 0, y: 0, w: (it.w || 0) * k * (it.type === 'draw' ? sp : 1), h: (it.h || 0) * k * (it.type === 'draw' ? sp : 1) };
        n.formas.push({ id: gerarId(), tipoForma: it.type, x, y, k: k * (it.type === 'draw' ? sp : 1), w: it.w, h: it.h, r: it.r, d: it.d, cor: it.cor, espessura: it.espessura, opac: it.opac, caixa });
      }
    });
    avisar(`"${m.nome}" colocada (${(m.itens || []).length} elementos)`);
  }

  // ---------- gestos ----------
  const E = useRef({});
  E.current = { view, ferramenta, terreno, raio, cols, rows, modelo, encaixar, tipoCaminho, corLuz, raioLuz, nivel };
  const caixaRef = useRef(null);
  const origem = useRef({ x: 0, y: 0 });
  const gesto = useRef({});

  const pontoDe = (pageX, pageY) => {
    const v = E.current.view;
    return { x: (pageX - origem.current.x - v.x) / v.s, y: (pageY - origem.current.y - v.y) / v.s };
  };
  const celulaDe = (p) => ({ x: Math.floor(p.x), y: Math.floor(p.y) });
  const dentro = (c) => c.x >= 0 && c.y >= 0 && c.x < E.current.cols && c.y < E.current.rows;
  const encx = (v) => (E.current.encaixar ? Math.round(v * 2) / 2 : v); // meio em meio

  function aplicar(c) {
    const { ferramenta: f, terreno: t, raio: r } = E.current;
    if (!dentro(c)) return;
    const g = niveis.current[E.current.nivel].g;
    if (f === 'pincel') pintar(g, c.x, c.y, r, t);
    if (f === 'borracha') pintar(g, c.x, c.y, r, VAZIO);
    atualizar();
  }

  function linhaAte(a, b) {
    const passos = Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y), 1);
    for (let i = 1; i <= passos; i++) {
      aplicar({ x: Math.round(a.x + ((b.x - a.x) * i) / passos), y: Math.round(a.y + ((b.y - a.y) * i) / passos) });
    }
  }

  const resp = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => {
        const ne = e.nativeEvent;
        if (ne.locationX !== undefined) origem.current = { x: ne.pageX - ne.locationX, y: ne.pageY - ne.locationY };
        const st = E.current;
        const f = st.ferramenta;
        const p = pontoDe(ne.pageX, ne.pageY);
        const c = celulaDe(p);
        const n = niveis.current[st.nivel];
        gesto.current = { ultima: c, view0: st.view, inicio: c, p0: p };

        if (f === 'mover') return;
        if (f === 'sala') return setPrevia({ tipo: 'sala', a: c, b: c });
        if (f === 'porta' || f === 'escada') {
          if (!dentro(c)) return;
          guardar();
          const marca = f === 'porta' ? 'D' : 'S';
          n.g[c.y][c.x] = n.g[c.y][c.x] === marca ? '#' : marca;
          return atualizar();
        }
        if (f === 'objeto') {
          const m = st.modelo;
          if (!m) return avisar('Escolha um asset na lista abaixo');
          if (m.tipo === 'personagem' || m.tipo === 'estrutura') {
            guardar();
            colocarAsset(m, p, n, st.encaixar);
            return atualizar();
          }
          guardar();
          const w = m.w || 1;
          const h = m.h || 1;
          const o = { id: gerarId(), x: encx(p.x - w / 2), y: encx(p.y - h / 2), w, h, rot: 0, emoji: m.emoji || '', img: m.img || '', nome: m.nome };
          if (st.encaixar) {
            o.x = Math.round(p.x - w / 2);
            o.y = Math.round(p.y - h / 2);
          }
          n.objetos.push(o);
          setSel({ tipo: 'objeto', id: o.id });
          return atualizar();
        }
        if (f === 'luz') {
          guardar();
          const l = { id: gerarId(), x: st.encaixar ? Math.floor(p.x) + 0.5 : p.x, y: st.encaixar ? Math.floor(p.y) + 0.5 : p.y, r: st.raioLuz, cor: st.corLuz, intensidade: 1 };
          n.luzes.push(l);
          setSel({ tipo: 'luz', id: l.id });
          return atualizar();
        }
        if (f === 'caminho') return setPrevia({ tipo: 'caminho', pts: [p] });
        if (f === 'selecionar') {
          const hit = acharEm(p);
          setSel(hit);
          if (hit) {
            guardar();
            const lista = n[LISTA[hit.tipo]];
            const alvo = lista.find((o) => o.id === hit.id);
            gesto.current.alvo = alvo;
            gesto.current.orig = hit.tipo === 'caminho' ? alvo.pts.map((q) => ({ ...q })) : { x: alvo.x, y: alvo.y };
          }
          return;
        }
        guardar();
        aplicar(c);
      },
      onPanResponderMove: (e, gs) => {
        const st = E.current;
        const f = st.ferramenta;
        const toques = e.nativeEvent.touches || [];
        if (toques.length >= 2) {
          const a = toques[0];
          const b = toques[1];
          const dist = Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY);
          const mx = (a.pageX + b.pageX) / 2 - origem.current.x;
          const my = (a.pageY + b.pageY) / 2 - origem.current.y;
          if (!gesto.current.pinca) {
            gesto.current.pinca = { dist, view0: st.view, mx, my };
            setPrevia(null);
            return;
          }
          const pz = gesto.current.pinca;
          const s = limitar(pz.view0.s * (dist / (pz.dist || 1)), 4, 80);
          setView({ s, x: mx - ((pz.mx - pz.view0.x) / pz.view0.s) * s, y: my - ((pz.my - pz.view0.y) / pz.view0.s) * s });
          return;
        }
        if (gesto.current.pinca) return;
        if (f === 'mover' || (f === 'selecionar' && !gesto.current.alvo)) {
          const v0 = gesto.current.view0;
          setView({ ...v0, x: v0.x + gs.dx, y: v0.y + gs.dy });
          return;
        }
        const p = pontoDe(e.nativeEvent.pageX, e.nativeEvent.pageY);
        const c = celulaDe(p);
        if (f === 'sala') return setPrevia({ tipo: 'sala', a: gesto.current.inicio, b: c });
        if (f === 'caminho') {
          const pv = previaRef.current;
          if (pv && pv.pts) {
            const u = pv.pts[pv.pts.length - 1];
            if (Math.hypot(p.x - u.x, p.y - u.y) > 0.3) setPrevia({ ...pv, pts: [...pv.pts, p] });
          }
          return;
        }
        if (f === 'selecionar' && gesto.current.alvo) {
          const dx = p.x - gesto.current.p0.x;
          const dy = p.y - gesto.current.p0.y;
          const alvo = gesto.current.alvo;
          if (alvo.pts) alvo.pts = gesto.current.orig.map((q) => ({ x: q.x + dx, y: q.y + dy }));
          else {
            alvo.x = gesto.current.orig.x + dx;
            alvo.y = gesto.current.orig.y + dy;
          }
          atualizar();
          return;
        }
        if (f === 'pincel' || f === 'borracha') {
          const u = gesto.current.ultima;
          if (c.x !== u.x || c.y !== u.y) {
            linhaAte(u, c);
            gesto.current.ultima = c;
          }
        }
      },
      onPanResponderRelease: () => {
        const st = E.current;
        const pv = previaRef.current;
        const n = niveis.current[st.nivel];
        if (st.ferramenta === 'sala' && pv && pv.a) {
          guardar();
          preencherRet(n.g, pv.a.x, pv.a.y, pv.b.x, pv.b.y, st.terreno);
          atualizar();
        }
        if (st.ferramenta === 'caminho' && pv && pv.pts && pv.pts.length > 1) {
          guardar();
          const tipo = CAMINHOS.find((x) => x.id === st.tipoCaminho) || CAMINHOS[0];
          n.caminhos.push({ id: gerarId(), pts: pv.pts.map((q) => ({ x: Math.round(q.x * 100) / 100, y: Math.round(q.y * 100) / 100 })), cor: tipo.cor, largura: tipo.largura, opac: tipo.opac, nome: tipo.nome });
          atualizar();
        }
        const alvo = gesto.current.alvo;
        if (st.ferramenta === 'selecionar' && alvo && st.encaixar && !alvo.pts && !alvo.tipoForma) {
          if (alvo.tam) {
            const meio = alvo.tam % 2 ? 0.5 : 0;
            alvo.x = Math.floor(alvo.x - meio + 0.5) + meio;
            alvo.y = Math.floor(alvo.y - meio + 0.5) + meio;
          } else if (alvo.w !== undefined) {
            alvo.x = Math.round(alvo.x);
            alvo.y = Math.round(alvo.y);
          } else {
            alvo.x = Math.floor(alvo.x) + 0.5;
            alvo.y = Math.floor(alvo.y) + 0.5;
          }
          atualizar();
        }
        gesto.current = {};
        setPrevia(null);
      },
    })
  ).current;

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const el = caixaRef.current;
    if (!el || !el.addEventListener) return;
    const roda = (ev) => {
      ev.preventDefault();
      const r = el.getBoundingClientRect();
      const px = ev.clientX - r.left;
      const py = ev.clientY - r.top;
      setView((v) => {
        const s = limitar(v.s * (ev.deltaY < 0 ? 1.1 : 1 / 1.1), 4, 80);
        return { s, x: px - ((px - v.x) / v.s) * s, y: py - ((py - v.y) / v.s) * s };
      });
    };
    el.addEventListener('wheel', roda, { passive: false });
    return () => el.removeEventListener('wheel', roda);
  }, []);

  const gradeFundo = useMemo(() => {
    let d = '';
    for (let x = 0; x <= cols; x++) d += `M${x} 0V${rows}`;
    for (let y = 0; y <= rows; y++) d += `M0 ${y}H${cols}`;
    return d;
  }, [cols, rows]);

  const caminhoD = (pts) => pts.map((p, i) => `${i ? 'L' : 'M'}${p.x} ${p.y}`).join('');

  // ---------- salvar ----------
  function montarAsset() {
    const base = asset || {};
    const K = CEL_MUNDO;
    const camadas = [];
    const itens = [];
    let z = 0;
    niveis.current.forEach((n, i) => {
      camadas.push({ chave: `n${i}`, nome: `${n.nome} · chão`, ordem: i * 2, visivel: i === 0, travada: true });
      camadas.push({ chave: `n${i}o`, nome: `${n.nome} · objetos`, ordem: i * 2 + 1, visivel: i === 0, travada: false });
      itens.push({
        type: 'tiles',
        camada: `n${i}`,
        x: 0,
        y: 0,
        z: z++,
        cel: K,
        cols,
        rows,
        w: cols * K,
        h: rows * K,
        linhas: paraLinhas(n.g),
        tema,
        mostrarGrade,
        textura,
        rotulo: n.nome,
      });
      n.caminhos.forEach((cm) => {
        const pd = pathDosPontos(cm.pts.map((p) => ({ x: p.x * K, y: p.y * K })));
        itens.push({ type: 'draw', camada: `n${i}`, z: z++, ...pd, cor: cm.cor, espessura: cm.largura * K, opac: cm.opac, rotulo: cm.nome });
      });
      n.objetos.forEach((o) =>
        itens.push({ type: 'prop', camada: `n${i}o`, z: z++, x: o.x * K, y: o.y * K, w: o.w * K, h: o.h * K, rot: o.rot || 0, emoji: o.emoji || '', img: o.img || '', rotulo: o.nome || '' })
      );
      n.luzes.forEach((l) =>
        itens.push({ type: 'luz', camada: `n${i}o`, z: z++, x: l.x * K, y: l.y * K, r: l.r * K, cor: l.cor, intensidade: l.intensidade || 1, rotulo: 'Luz' })
      );
      (n.formas || []).forEach((fm) => {
        const f = fm.k * K;
        const base = { camada: `n${i}`, z: z++, cor: fm.cor, rotulo: 'Forma' };
        if (fm.tipoForma === 'rect') itens.push({ ...base, type: 'rect', x: fm.x * K, y: fm.y * K, w: fm.w * f, h: fm.h * f, espessura: (fm.espessura || 3) * f });
        if (fm.tipoForma === 'circle') itens.push({ ...base, type: 'circle', x: fm.x * K, y: fm.y * K, r: fm.r * f, espessura: (fm.espessura || 3) * f });
        if (fm.tipoForma === 'draw') itens.push({ ...base, type: 'draw', x: fm.x * K, y: fm.y * K, w: fm.w, h: fm.h, d: fm.d, escalaPath: f, espessura: fm.espessura || 4, opac: fm.opac });
      });
      (n.tokens || []).forEach((tk) =>
        itens.push({ type: 'token', camada: `n${i}o`, z: z++, x: tk.x * K, y: tk.y * K, tam: tk.tam, cor: tk.cor, img: tk.img || '', rotulo: tk.nome || '', ...(tk.ficha ? { ficha: tk.ficha } : {}) })
      );
    });
    camadas.push({ chave: 'tokens', nome: 'Tokens', ordem: niveis.current.length * 2, visivel: true, travada: false });
    return {
      ...base,
      tipo: 'mapa',
      nome: nome.trim(),
      img: '',
      gerador: { tipo: gerador, semente },
      sala: {
        ...(base.sala || {}),
        mapUrl: '',
        mapW: cols * K,
        mapH: rows * K,
        tamGrade: K,
        grade: true,
        tipoGrade: 'quadrada',
        opacGrade: 0.06,
        offX: 0,
        offY: 0,
        snap: true,
        escuridao,
      },
      camadas,
      itens,
      criador: {
        tema,
        mostrarGrade,
        textura,
        niveis: niveis.current.map((n) => ({ nome: n.nome, linhas: paraLinhas(n.g), objetos: n.objetos, caminhos: n.caminhos, luzes: n.luzes, tokens: n.tokens || [], formas: n.formas || [] })),
      },
      autor: base.autor || usuario.nome,
      criadoEm: base.criadoEm || Date.now(),
      atualizadoEm: Date.now(),
    };
  }

  async function salvarMapa() {
    if (nome.trim().length < 2) return avisar('Dê um nome ao mapa');
    setSalvando(true);
    try {
      const id = idSalvo || gerarId();
      await salvar(`${assetsDe(usuario.usuario)}/${id}`, { ...montarAsset(), id });
      setIdSalvo(id);
      avisar('Mapa salvo em Meus assets › Mapas');
    } catch (e) {
      avisar('Erro ao salvar o mapa');
    }
    setSalvando(false);
  }

  async function importar() {
    try {
      const arq = await escolherArquivoVtt();
      if (!arq) return;
      avisar('Importando...', 10000);
      const m = await importarVtt(arq, { usuario, aoProgresso: (t) => avisar(t, 10000) });
      avisar(`"${m.nome}" importado em Meus assets › Mapas. Use pela aba Assets da mesa.`, 5000);
    } catch (e) {
      avisar(e.message || 'Não foi possível importar', 5000);
    }
  }

  function trocarAba(id) {
    setAba(id);
    setFerramenta(ABAS_CRIADOR.find((a) => a.id === id).ferramenta);
    setPrevia(null);
  }

  const n = N();
  const pisoTotal = linhas.join('').split('').filter(ehPiso).length;
  const fonteAtual = fontes.find((f) => f.id === fonte) || fontes[0];
  const objsFonte = (fonteAtual ? fonteAtual.assets : []).filter((a) => a.tipo === tipoUso);
  const pastas = pastasDe(objsFonte);
  const objsVisiveis = pastaObj ? objsFonte.filter((a) => (a.pasta || '').trim() === pastaObj) : objsFonte;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Topo
        titulo="Criador de mapas"
        sub={`${cols}×${rows} · ${n.nome} (${nivel + 1}/${niveis.current.length}) · ${pisoTotal} de piso`}
        onVoltar={onVoltar}
        direita={
          <TouchableOpacity style={s.btnSalvar} onPress={salvarMapa} disabled={salvando}>
            {salvando ? <ActivityIndicator color="#fff" /> : <Icone name="content-save-outline" size={18} color="#fff" />}
            <Text style={s.btnSalvarTxt}>Salvar</Text>
          </TouchableOpacity>
        }
      />
      <View style={s.linhaNome}>
        <TextInput style={s.inputNome} value={nome} onChangeText={setNome} placeholder="Nome do mapa (ex.: Cripta do Rei)" placeholderTextColor={C.suave} />
        {niveis.current.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginTop: 6 }}>
            {niveis.current.map((nv, i) => (
              <TouchableOpacity key={i} onPress={() => { setNivel(i); setSel(null); }} style={[s.chipAndar, nivel === i && s.chipAndarAtivo]}>
                <Icone name="stairs" size={13} color={nivel === i ? '#fff' : C.suave} />
                <Text style={[s.chipTxt, nivel === i && { color: '#fff' }]}>{nv.nome}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>

      {/* ---------- canvas ---------- */}
      <View
        ref={caixaRef}
        style={s.canvas}
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout;
          const a = { w: width, h: height };
          setArea(a);
          if (!area.w) ajustar(cols, rows, a);
        }}
        {...resp.panHandlers}
      >
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <Svg width="100%" height="100%">
            <G transform={`translate(${view.x} ${view.y})`}>
              <MapaTilesSvg linhas={linhas} cel={view.s} tema={tema} mostrarGrade={mostrarGrade} textura={textura} />
              <G transform={`scale(${view.s})`}>
                {n.caminhos.map((cm) => (
                  <Path key={cm.id} d={caminhoD(cm.pts)} stroke={cm.cor} strokeOpacity={cm.opac || 1} strokeWidth={cm.largura} strokeLinecap="round" strokeLinejoin="round" fill="none" />
                ))}
                {(n.formas || []).map((fm) => (
                  <FormaSvg key={fm.id} it={fm} />
                ))}
                {n.objetos.map((o) => (
                  <PropSvg key={o.id} it={o} />
                ))}
                {(n.tokens || []).map((tk) => (
                  <TokenSimplesSvg key={tk.id} it={tk} />
                ))}
                {n.luzes.map((l) => (
                  <LuzSvg key={l.id} it={l} escala={view.s} mostrarCentro />
                ))}
                <EscuridaoSvg nivel={escuridao} luzes={n.luzes} x={0} y={0} w={cols} h={rows} />
                <Path d={gradeFundo} stroke="#ffffff" strokeOpacity={0.07} strokeWidth={1 / view.s} fill="none" />
                {previa && previa.tipo === 'sala' && (
                  <Rect
                    x={Math.min(previa.a.x, previa.b.x)}
                    y={Math.min(previa.a.y, previa.b.y)}
                    width={Math.abs(previa.b.x - previa.a.x) + 1}
                    height={Math.abs(previa.b.y - previa.a.y) + 1}
                    fill="rgba(34,211,238,0.25)"
                    stroke={C.destaque2}
                    strokeWidth={2 / view.s}
                  />
                )}
                {previa && previa.tipo === 'caminho' && (
                  <Path
                    d={caminhoD(previa.pts)}
                    stroke={(CAMINHOS.find((x) => x.id === tipoCaminho) || CAMINHOS[0]).cor}
                    strokeOpacity={0.6}
                    strokeWidth={(CAMINHOS.find((x) => x.id === tipoCaminho) || CAMINHOS[0]).largura}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                )}
                {selecionado && sel.tipo === 'objeto' && (
                  <Rect x={selecionado.x - 0.1} y={selecionado.y - 0.1} width={selecionado.w + 0.2} height={selecionado.h + 0.2} fill="none" stroke={C.destaque2} strokeWidth={2 / view.s} strokeDasharray={`${6 / view.s} ${4 / view.s}`} />
                )}
                {selecionado && sel.tipo === 'token' && (
                  <Rect x={selecionado.x - selecionado.r - 0.1} y={selecionado.y - selecionado.r - 0.1} width={selecionado.r * 2 + 0.2} height={selecionado.r * 2 + 0.2} fill="none" stroke={C.destaque2} strokeWidth={2 / view.s} strokeDasharray={`${6 / view.s} ${4 / view.s}`} />
                )}
                {selecionado && sel.tipo === 'forma' && (
                  <Rect x={selecionado.x + selecionado.caixa.x} y={selecionado.y + selecionado.caixa.y} width={selecionado.caixa.w} height={selecionado.caixa.h} fill="none" stroke={C.destaque2} strokeWidth={2 / view.s} strokeDasharray={`${6 / view.s} ${4 / view.s}`} />
                )}
                {selecionado && sel.tipo === 'luz' && (
                  <Rect x={selecionado.x - 0.6} y={selecionado.y - 0.6} width={1.2} height={1.2} fill="none" stroke={C.destaque2} strokeWidth={2 / view.s} strokeDasharray={`${6 / view.s} ${4 / view.s}`} />
                )}
                {selecionado && sel.tipo === 'caminho' && (
                  <Path d={caminhoD(selecionado.pts)} stroke={C.destaque2} strokeWidth={3 / view.s} strokeDasharray={`${6 / view.s} ${4 / view.s}`} fill="none" />
                )}
              </G>
            </G>
          </Svg>
        </View>
        <View style={s.zoom} pointerEvents="box-none">
          <TouchableOpacity style={s.zoomBtn} onPress={() => zoom(1.25)}>
            <Icone name="plus" size={18} color={C.texto} />
          </TouchableOpacity>
          <TouchableOpacity style={s.zoomBtn} onPress={() => zoom(0.8)}>
            <Icone name="minus" size={18} color={C.texto} />
          </TouchableOpacity>
          <TouchableOpacity style={s.zoomBtn} onPress={() => ajustar()}>
            <Icone name="fit-to-screen-outline" size={18} color={C.texto} />
          </TouchableOpacity>
          <TouchableOpacity style={s.zoomBtn} onPress={desfazer}>
            <Icone name="undo" size={18} color={C.texto} />
          </TouchableOpacity>
        </View>
        {!!msg && (
          <View style={s.aviso} pointerEvents="none">
            <Text style={{ color: C.texto, textAlign: 'center' }}>{msg}</Text>
          </View>
        )}
      </View>

      {/* ---------- painel ---------- */}
      <View style={s.painel}>
        {/* ações do item selecionado */}
        {selecionado && (aba === 'cenario' || aba === 'detalhes') && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[s.faixa, { borderBottomWidth: 1, borderColor: C.borda }]}>
            <Text style={s.selTxt}>
              {sel.tipo === 'luz' ? 'Luz' : sel.tipo === 'forma' ? 'Forma' : selecionado.nome || (sel.tipo === 'objeto' ? 'Objeto' : sel.tipo === 'token' ? 'Token' : 'Caminho')}
            </Text>
            {sel.tipo === 'token' && (
              <>
                {[1, 2, 3, 4].map((t2) => (
                  <TouchableOpacity key={t2} onPress={() => alterarSel((tk) => { tk.tam = t2; tk.r = t2 * 0.45; })} style={[s.chip, selecionado.tam === t2 && s.chipAtivo]}>
                    <Text style={s.chipTxt}>{t2}×</Text>
                  </TouchableOpacity>
                ))}
                {!!selecionado.ficha && <Text style={s.dica}>com ficha</Text>}
              </>
            )}
            {sel.tipo === 'objeto' && (
              <>
                <OpcaoCriador icone="rotate-left" rotulo="-45°" onPress={() => alterarSel((o) => (o.rot = ((o.rot || 0) - 45) % 360))} />
                <OpcaoCriador icone="rotate-right" rotulo="+45°" onPress={() => alterarSel((o) => (o.rot = ((o.rot || 0) + 45) % 360))} />
                <OpcaoCriador icone="magnify-minus-outline" rotulo="Menor" onPress={() => alterarSel((o) => { if (o.w > 0.5) { o.w -= 0.5; o.h = Math.max(0.5, o.h - 0.5); } })} />
                <OpcaoCriador icone="magnify-plus-outline" rotulo="Maior" onPress={() => alterarSel((o) => { o.w += 0.5; o.h += 0.5; })} />
              </>
            )}
            {sel.tipo === 'luz' && (
              <>
                <OpcaoCriador icone="minus-circle-outline" rotulo="Raio −" onPress={() => alterarSel((l) => (l.r = Math.max(1, l.r - 1)))} />
                <Text style={s.chipTxt}>{selecionado.r} cél.</Text>
                <OpcaoCriador icone="plus-circle-outline" rotulo="Raio +" onPress={() => alterarSel((l) => (l.r = Math.min(30, l.r + 1)))} />
                <View style={s.grupo}>
                  {CORES_LUZ.map((c) => (
                    <TouchableOpacity key={c} onPress={() => alterarSel((l) => (l.cor = c))} style={[s.cor, { backgroundColor: c }, selecionado.cor === c && s.corSel]} />
                  ))}
                </View>
              </>
            )}
            <OpcaoCriador icone="trash-can-outline" rotulo="Apagar" onPress={apagarSel} cor={C.perigo} />
            <OpcaoCriador icone="close" rotulo="Soltar" onPress={() => setSel(null)} />
          </ScrollView>
        )}

        {aba === 'gerar' && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.faixa}>
            <View style={s.grupo}>
              {GERADORES.map((gen) => (
                <OpcaoCriador key={gen.id} ativo={gerador === gen.id} icone={gen.icone} rotulo={gen.nome} onPress={() => setGerador(gen.id)} />
              ))}
            </View>
            <View style={s.grupo}>
              {TAMANHOS.map(([c, r]) => (
                <TouchableOpacity key={c} onPress={() => gerar(c, r)} style={[s.chip, cols === c && rows === r && s.chipAtivo]}>
                  <Text style={s.chipTxt}>{c}×{r}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {gerador === 'masmorra' && <PassoCriador rotulo="Salas" valor={salas} onMenos={() => setSalas(Math.max(2, salas - 1))} onMais={() => setSalas(Math.min(30, salas + 1))} />}
            {gerador === 'caverna' && <OpcaoCriador ativo={agua} icone="water" rotulo="Água" onPress={() => setAgua(!agua)} />}
            <View style={s.passo}>
              <Text style={s.passoRot}>Semente</Text>
              <Text style={[s.passoVal, { minWidth: 80 }]}>{semente}</Text>
            </View>
            <TouchableOpacity
              style={s.btnGerar}
              onPress={() => {
                const sem = novaSemente();
                setSemente(sem);
                gerar(cols, rows, sem);
              }}
            >
              <Icone name="dice-multiple" size={18} color="#fff" />
              <Text style={s.btnGerarTxt}>Gerar novo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.btnGerar, s.btnSec]} onPress={() => gerar()}>
              <Icone name="refresh" size={18} color={C.destaque2} />
              <Text style={[s.btnGerarTxt, { color: C.destaque2 }]}>Mesma semente</Text>
            </TouchableOpacity>
          </ScrollView>
        )}

        {aba === 'pintar' && (
          <View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.faixa}>
              <View style={s.grupo}>
                {FERRAMENTAS_PINTAR.map((f) => (
                  <OpcaoCriador key={f.id} ativo={ferramenta === f.id} icone={f.icone} rotulo={f.nome} onPress={() => setFerramenta(f.id)} />
                ))}
              </View>
            </ScrollView>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[s.faixa, { paddingTop: 0 }]}>
              <View style={s.grupo}>
                {TERRENOS.map((t) => (
                  <OpcaoCriador key={t.id} ativo={terreno === t.id} icone={t.icone} rotulo={t.nome} onPress={() => setTerreno(t.id)} />
                ))}
              </View>
              <View style={s.grupo}>
                {[0, 1, 2].map((r) => (
                  <TouchableOpacity key={r} onPress={() => setRaio(r)} style={[s.chip, raio === r && s.chipAtivo]}>
                    <Text style={s.chipTxt}>{r * 2 + 1}×{r * 2 + 1}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity style={[s.chip, { paddingHorizontal: 10 }]} onPress={limpar}>
                <Text style={[s.chipTxt, { color: C.perigo }]}>Limpar andar</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        )}

        {aba === 'cenario' && (
          <View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.faixa}>
              <OpcaoCriador ativo={ferramenta === 'objeto'} icone="stamper" rotulo="Colocar" onPress={() => setFerramenta('objeto')} />
              <OpcaoCriador ativo={ferramenta === 'selecionar'} icone="cursor-default-click-outline" rotulo="Selecionar" onPress={() => setFerramenta('selecionar')} />
              <OpcaoCriador ativo={encaixar} icone="magnet" rotulo="Encaixar" onPress={() => setEncaixar(!encaixar)} />
              {TIPOS_USO.map((tu) => (
                <OpcaoCriador key={tu.id} ativo={tipoUso === tu.id} icone={tu.icone} rotulo={tu.nome} onPress={() => { setTipoUso(tu.id); setPastaObj(null); setModelo(null); setFerramenta('objeto'); }} />
              ))}
              {fontes.map((f) => (
                <TouchableOpacity key={f.id} onPress={() => { setFonte(f.id); setPastaObj(null); }} style={[s.chipAndar, fonteAtual && fonteAtual.id === f.id && s.chipAndarAtivo]}>
                  <Text style={[s.chipTxt, fonteAtual && fonteAtual.id === f.id && { color: '#fff' }]} numberOfLines={1}>{f.nome}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            {pastas.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[s.faixa, { paddingTop: 0, gap: 4 }]}>
                {[null, ...pastas].map((p) => (
                  <TouchableOpacity key={p || 'todas'} onPress={() => setPastaObj(p)} style={[s.pasta, pastaObj === p && s.pastaAtiva]}>
                    <Icone name={p ? 'folder-outline' : 'folder-multiple-outline'} size={12} color={pastaObj === p ? '#fff' : C.suave} />
                    <Text style={[s.pastaTxt, pastaObj === p && { color: '#fff' }]}>{p || 'Todas'}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[s.faixa, { paddingTop: 0 }]}>
              {estadoFontes === 'carregando' && <ActivityIndicator color={C.destaque} />}
              {estadoFontes === 'erro' && <Text style={[s.dica, { color: C.perigo }]}>Não foi possível carregar os assets. Verifique a conexão.</Text>}
              {estadoFontes === 'ok' && objsVisiveis.length === 0 && (
                <Text style={s.dica}>
                  Nada em {TIPOS_USO.find((x) => x.id === tipoUso).nome.toLowerCase()} nesta fonte. Crie em Meus assets, monte estruturas na mesa (aba Construir) ou ative packs.
                </Text>
              )}
              {objsVisiveis.map((a) => (
                <TouchableOpacity
                  key={a.id}
                  onPress={() => {
                    setModelo(a);
                    setFerramenta('objeto');
                  }}
                  style={[s.assetBtn, modelo && modelo.id === a.id && s.assetBtnAtivo]}
                >
                  <AssetMini asset={a} tamanho={36} />
                  <Text style={s.assetNome} numberOfLines={1}>{a.nome}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {aba === 'detalhes' && (
          <View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.faixa}>
              <OpcaoCriador ativo={ferramenta === 'caminho'} icone="vector-polyline" rotulo="Caminho" onPress={() => setFerramenta('caminho')} />
              <OpcaoCriador ativo={ferramenta === 'luz'} icone="lightbulb-on-outline" rotulo="Luz" onPress={() => setFerramenta('luz')} />
              <OpcaoCriador ativo={ferramenta === 'selecionar'} icone="cursor-default-click-outline" rotulo="Selecionar" onPress={() => setFerramenta('selecionar')} />
              <OpcaoCriador ativo={ferramenta === 'mover'} icone="hand-back-right-outline" rotulo="Mover" onPress={() => setFerramenta('mover')} />
            </ScrollView>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[s.faixa, { paddingTop: 0 }]}>
              {ferramenta === 'luz' ? (
                <>
                  <PassoCriador rotulo="Raio" valor={`${raioLuz} cél.`} onMenos={() => setRaioLuz(Math.max(1, raioLuz - 1))} onMais={() => setRaioLuz(Math.min(30, raioLuz + 1))} />
                  <View style={s.grupo}>
                    {CORES_LUZ.map((c) => (
                      <TouchableOpacity key={c} onPress={() => setCorLuz(c)} style={[s.cor, { backgroundColor: c }, corLuz === c && s.corSel]} />
                    ))}
                  </View>
                  <PassoCriador rotulo="Escuridão" valor={`${Math.round(escuridao * 100)}%`} onMenos={() => setEscuridao(Math.max(0, Math.round((escuridao - 0.1) * 10) / 10))} onMais={() => setEscuridao(Math.min(0.95, Math.round((escuridao + 0.1) * 10) / 10))} />
                </>
              ) : (
                <View style={s.grupo}>
                  {CAMINHOS.map((c) => (
                    <TouchableOpacity key={c.id} onPress={() => { setTipoCaminho(c.id); setFerramenta('caminho'); }} style={[s.opcao, tipoCaminho === c.id && ferramenta === 'caminho' && s.opcaoAtiva]}>
                      <Icone name={c.icone} size={18} color={c.cor} />
                      <Text style={[s.opcaoTxt, tipoCaminho === c.id && ferramenta === 'caminho' && { color: '#fff' }]}>{c.nome}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </ScrollView>
          </View>
        )}

        {aba === 'mapa' && (
          <View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.faixa}>
              <TextInput style={[s.inputNome, { width: 140, paddingVertical: 5 }]} value={n.nome} onChangeText={renomearAndar} placeholder="Nome do andar" placeholderTextColor={C.suave} />
              <OpcaoCriador icone="layers-plus" rotulo="Novo andar" onPress={novoAndar} />
              <OpcaoCriador icone="layers-remove" rotulo="Apagar andar" onPress={apagarAndar} cor={C.perigo} />
              <View style={s.grupo}>
                {TAMANHOS.map(([c, r]) => (
                  <TouchableOpacity key={c} onPress={() => redimensionar(c, r)} style={[s.chip, cols === c && rows === r && s.chipAtivo]}>
                    <Text style={s.chipTxt}>{c}×{r}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity style={[s.btnGerar, s.btnSec]} onPress={importar}>
                <Icone name="file-import-outline" size={18} color={C.destaque2} />
                <Text style={[s.btnGerarTxt, { color: C.destaque2 }]}>Importar Dungeondraft</Text>
              </TouchableOpacity>
            </ScrollView>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[s.faixa, { paddingTop: 0 }]}>
              {Object.entries(TEMAS_MAPA).map(([id, t]) => (
                <TouchableOpacity key={id} onPress={() => setTema(id)} style={[s.tema, tema === id && { borderColor: C.destaque2 }]}>
                  <View style={[s.temaAmostra, { backgroundColor: t.fundo }]}>
                    <View style={{ width: 22, height: 14, backgroundColor: t.chao, borderWidth: 2, borderColor: t.parede }} />
                  </View>
                  <Text style={s.temaTxt}>{t.nome}</Text>
                </TouchableOpacity>
              ))}
              <OpcaoCriador ativo={textura} icone="texture-box" rotulo="Texturas" onPress={() => setTextura(!textura)} />
              <OpcaoCriador ativo={mostrarGrade} icone="grid" rotulo="Grade" onPress={() => setMostrarGrade(!mostrarGrade)} />
            </ScrollView>
          </View>
        )}

        <View style={s.abas}>
          {ABAS_CRIADOR.map((a) => (
            <TouchableOpacity key={a.id} style={[s.aba, aba === a.id && s.abaAtiva]} onPress={() => trocarAba(a.id)}>
              <Icone name={a.icone} size={20} color={aba === a.id ? C.destaque2 : C.suave} />
              <Text style={[s.abaTxt, aba === a.id && { color: C.destaque2 }]} numberOfLines={1}>{a.nome}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );
}

function OpcaoCriador({ ativo, icone, rotulo, onPress, cor }) {
  return (
    <TouchableOpacity onPress={onPress} style={[s.opcao, ativo && s.opcaoAtiva]}>
      <Icone name={icone} size={18} color={ativo ? '#fff' : cor || C.suave} />
      <Text style={[s.opcaoTxt, ativo && { color: '#fff' }, cor && !ativo && { color: cor }]}>{rotulo}</Text>
    </TouchableOpacity>
  );
}

function PassoCriador({ rotulo, valor, onMenos, onMais }) {
  return (
    <View style={s.passo}>
      <Text style={s.passoRot}>{rotulo}</Text>
      <View style={s.grupo}>
        <TouchableOpacity onPress={onMenos} style={s.passoBtn}>
          <Icone name="minus" size={14} color={C.texto} />
        </TouchableOpacity>
        <Text style={s.passoVal}>{valor}</Text>
        <TouchableOpacity onPress={onMais} style={s.passoBtn}>
          <Icone name="plus" size={14} color={C.texto} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  btnSalvar: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.destaque, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  btnSalvarTxt: { color: '#fff', fontWeight: '800', fontSize: 13 },
  linhaNome: { paddingHorizontal: 10, paddingVertical: 6, backgroundColor: C.painel, borderBottomWidth: 1, borderColor: C.borda },
  inputNome: { backgroundColor: C.painel2, borderWidth: 1, borderColor: C.borda, color: C.texto, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 },
  chipAndar: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, borderWidth: 1, borderColor: C.borda, maxWidth: 160 },
  chipAndarAtivo: { backgroundColor: C.destaque, borderColor: C.destaque },
  canvas: { flex: 1, backgroundColor: C.palco, overflow: 'hidden' },
  zoom: { position: 'absolute', right: 10, top: 10, gap: 6 },
  zoomBtn: { backgroundColor: 'rgba(21,18,31,0.9)', borderWidth: 1, borderColor: C.borda, borderRadius: 10, padding: 8 },
  aviso: { position: 'absolute', bottom: 12, alignSelf: 'center', maxWidth: '90%', backgroundColor: 'rgba(21,18,31,0.95)', borderWidth: 1, borderColor: C.destaque, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  painel: { backgroundColor: C.painel, borderTopWidth: 1, borderColor: C.borda },
  faixa: { alignItems: 'center', paddingHorizontal: 10, paddingVertical: 8, gap: 10 },
  grupo: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  selTxt: { color: C.destaque2, fontWeight: '800', maxWidth: 120 },
  opcao: { alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, borderWidth: 1, borderColor: C.borda, minWidth: 62 },
  opcaoAtiva: { backgroundColor: C.destaque, borderColor: C.destaque },
  opcaoTxt: { color: C.suave, fontSize: 10, fontWeight: '700', marginTop: 1 },
  chip: { minWidth: 46, height: 32, borderRadius: 8, borderWidth: 1, borderColor: C.borda, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  chipAtivo: { borderColor: C.destaque2, backgroundColor: 'rgba(34,211,238,0.15)' },
  chipTxt: { color: C.texto, fontSize: 12, fontWeight: '700' },
  pasta: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, borderWidth: 1, borderColor: C.borda },
  pastaAtiva: { backgroundColor: C.destaque2, borderColor: C.destaque2 },
  pastaTxt: { color: C.suave, fontSize: 11, fontWeight: '700' },
  assetBtn: { alignItems: 'center', width: 62, padding: 3, borderRadius: 10, borderWidth: 1, borderColor: 'transparent' },
  assetBtnAtivo: { borderColor: C.destaque2, backgroundColor: 'rgba(34,211,238,0.12)' },
  assetNome: { color: C.texto, fontSize: 10, marginTop: 2, textAlign: 'center' },
  cor: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: 'transparent' },
  corSel: { borderColor: '#fff' },
  dica: { color: C.suave, fontSize: 12 },
  passo: { alignItems: 'center', backgroundColor: C.painel2, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4 },
  passoRot: { color: C.suave, fontSize: 10, fontWeight: '700' },
  passoBtn: { width: 24, height: 24, borderRadius: 12, borderWidth: 1, borderColor: C.borda, alignItems: 'center', justifyContent: 'center' },
  passoVal: { color: C.texto, fontWeight: '800', minWidth: 40, textAlign: 'center', fontSize: 12 },
  btnGerar: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.destaque, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9 },
  btnSec: { backgroundColor: 'transparent', borderWidth: 1, borderColor: C.destaque2 },
  btnGerarTxt: { color: '#fff', fontWeight: '800', fontSize: 13 },
  tema: { alignItems: 'center', borderWidth: 2, borderColor: 'transparent', borderRadius: 10, padding: 4 },
  temaAmostra: { width: 52, height: 36, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  temaTxt: { color: C.texto, fontSize: 11, marginTop: 3 },
  abas: { flexDirection: 'row', borderTopWidth: 1, borderColor: C.borda, backgroundColor: C.bg },
  aba: { flex: 1, alignItems: 'center', paddingVertical: 6, borderTopWidth: 2, borderColor: 'transparent' },
  abaAtiva: { borderColor: C.destaque2, backgroundColor: C.painel },
  abaTxt: { color: C.suave, fontSize: 10, fontWeight: '700', marginTop: 1 },
});
