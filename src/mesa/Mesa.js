import React, { useEffect, useRef, useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, TextInput, ScrollView, StyleSheet, Platform, ActivityIndicator, Share, Modal } from 'react-native';
import { MaterialCommunityIcons as Icone } from '@expo/vector-icons';
import { AssetMini } from '../components/AssetMini';
import FichaVortex, { dadosDeJogo } from '../components/Ficha';
import { ModalNome } from '../components/ModalNome';
import { C, CORES } from '../config/theme';
import { TIPOS_ASSET } from '../data/constantes';
import ConfigMesa from './ConfigMesa';
import PainelCamadas from './PainelCamadas';
import Palco from './Palco';
import { escolherArquivoVtt, importarVtt } from '../services/dungeondraft';
import { assetsDe, carregarMeusAssets, carregarTodosPacks, estruturaDosItens, itensDaEstrutura, mapaDaMesa, packEstaAtivo, packVisivelPara, resumoAsset } from '../services/assets';
import { lerPacksAtivos } from '../services/auth';
import { COL, apagar, atualizar, lerDoc, listar, salvar } from '../services/firestore';
import { encaixarPonto, lerGrade } from '../utils/grade';
import { linkDaMesa } from '../utils/link';
import { NOME_TIPO, caixa, contemPonto, gerarId, limitar, pastasDe, pathDosPontos } from '../utils/util';

const INTERVALO = 1500; // ms entre sincronizações
const JANELA = 4000; // ms em que uma alteração local tem prioridade sobre o servidor

// Abas de mecanismos da mesa
const ABAS = [
  { id: 'mover', nome: 'Mover', icone: 'cursor-default', ferramenta: 'mover' },
  { id: 'assets', nome: 'Assets', icone: 'package-variant', ferramenta: 'colocar' },
  { id: 'desenho', nome: 'Desenho', icone: 'pencil-outline', ferramenta: 'desenho' },
  { id: 'grade', nome: 'Grade', icone: 'grid', ferramenta: 'mover' },
  { id: 'construir', nome: 'Construir', icone: 'hammer-wrench', ferramenta: 'capturar' },
];
const DICA_FERRAMENTA = {
  mover: 'Toque para selecionar e arraste para mover. Arraste o vazio para navegar; pinça ou roda do mouse para zoom.',
  pan: 'Arraste para navegar pelo mapa.',
  colocar: 'Escolha um asset e toque no mapa para colocar.',
  desenho: 'Desenhe à mão livre.',
  retangulo: 'Arraste para desenhar um retângulo.',
  circulo: 'Arraste do centro para fora para desenhar um círculo.',
  borracha: 'Toque ou arraste sobre os itens para apagar.',
  luz: 'Toque no mapa para colocar uma luz. Use a Escuridão (aba Grade) para ver o efeito.',
  capturar: 'Arraste um retângulo sobre os itens que formam a estrutura.',
};

export default function Mesa({ codigo, usuario, onSair, onEntrarConta, onCriarMapa }) {
  const visitante = usuario.provedor === 'anonimo';
  const base = `${COL.mesas}/${codigo}`;
  const nome = usuario.nome;

  // ---------- estado da cena ----------
  const [sala, setSala] = useState(null);
  const [camadas, setCamadas] = useState({});
  const [itens, setItens] = useState({});
  const [online, setOnline] = useState(true);
  const [naoExiste, setNaoExiste] = useState(false);

  // ---------- estado da interface ----------
  const [view, setView] = useState({ x: 0, y: 0, s: 0.6 });
  const [tam, setTam] = useState({ w: 0, h: 0 });
  const [centralizado, setCentralizado] = useState(false);
  const [aba, setAba] = useState('mover');
  const [ferramenta, setFerramenta] = useState('mover');
  const [cor, setCor] = useState(CORES[7]);
  const [espessura, setEspessura] = useState(4);
  const [camadaAtiva, setCamadaAtiva] = useState(null);
  const [selecionado, setSelecionado] = useState(null);
  const [painel, setPainel] = useState(false);
  const [config, setConfig] = useState(false);
  const [aviso, setAviso] = useState('');
  const [faixaVisitante, setFaixaVisitante] = useState(true);

  // ---------- assets ----------
  const [fontes, setFontes] = useState([]); // [{ id, nome, assets }]
  const [fonte, setFonte] = useState('rapido');
  const [tipoAsset, setTipoAsset] = useState('personagem');
  const [pastaAsset, setPastaAsset] = useState(null); // filtro de pasta no navegador de assets
  const [modelo, setModelo] = useState(null);
  const [rapido, setRapido] = useState({ nome: '', tam: 1 });
  const [fichaDe, setFichaDe] = useState(null); // id do token com a ficha aberta
  const [captura, setCaptura] = useState(null); // itens capturados para virar estrutura
  const [salvandoMapa, setSalvandoMapa] = useState(false);
  const [mapaPendente, setMapaPendente] = useState(null); // asset mapa a aplicar

  // ---------- controle de sincronização ----------
  const pendentes = useRef({});
  const apagados = useRef({});
  const pendSala = useRef(0);
  const arrastando = useRef(null);
  const origemArraste = useRef(null);
  const ocupado = useRef(false);
  const ultimaRolagem = useRef(null);

  const avisar = (t, ms = 2200) => {
    setAviso(t);
    setTimeout(() => setAviso((a) => (a === t ? '' : a)), ms);
  };

  function mesclar(prev, remotos) {
    const agora = Date.now();
    const out = {};
    remotos.forEach((r) => {
      if (apagados.current[r.id] && agora - apagados.current[r.id] < JANELA * 2) return;
      const local = prev[r.id];
      const recente = (pendentes.current[r.id] || 0) > agora - JANELA;
      out[r.id] = local && (recente || arrastando.current === r.id) ? local : r;
    });
    Object.keys(prev).forEach((id) => {
      if (!out[id] && !apagados.current[id] && (pendentes.current[id] || 0) > agora - JANELA) out[id] = prev[id];
    });
    return out;
  }

  async function sincronizar() {
    if (ocupado.current) return;
    ocupado.current = true;
    try {
      const [sl, cams, its] = await Promise.all([lerDoc(base), listar(`${base}/camadas`), listar(`${base}/itens`)]);
      if (sl) setSala((atual) => (atual && pendSala.current > Date.now() - JANELA ? atual : sl));
      else setNaoExiste(true);
      setCamadas((prev) => mesclar(prev, cams));
      setItens((prev) => mesclar(prev, its));
      setOnline(true);
    } catch (e) {
      setOnline(false);
    }
    ocupado.current = false;
  }

  useEffect(() => {
    sincronizar();
    const t = setInterval(sincronizar, INTERVALO);
    return () => clearInterval(t);
  }, []);

  // carrega "Meus assets" + packs que o usuário ativou
  async function carregarFontes() {
    try {
      const [meus, packs, ativos] = await Promise.all([
        carregarMeusAssets(usuario.usuario),
        carregarTodosPacks(),
        lerPacksAtivos(usuario.usuario),
      ]);
      setFontes([
        { id: 'meus', nome: 'Meus assets', icone: 'account-box-outline', assets: meus },
        ...packs.filter((p) => packVisivelPara(p, usuario.usuario) && packEstaAtivo(ativos, p.id)).map((p) => ({ id: p.id, nome: p.nome, icone: p.icone, assets: p.assets })),
      ]);
    } catch (e) {}
  }
  useEffect(() => {
    carregarFontes();
  }, []);

  // rolagens feitas por qualquer jogador aparecem para todos
  useEffect(() => {
    const r = sala && sala.ultimaRolagem;
    if (!r || !r.em) return;
    if (ultimaRolagem.current === null) {
      ultimaRolagem.current = r.em; // ignora a rolagem antiga ao abrir a mesa
      return;
    }
    if (r.em !== ultimaRolagem.current) {
      ultimaRolagem.current = r.em;
      avisar(`🎲 ${r.autor}: ${r.texto}`, 5000);
    }
  }, [sala && sala.ultimaRolagem && sala.ultimaRolagem.em]);

  // ---------- derivados ----------
  const g = lerGrade(sala);
  const cel = g.tamGrade;
  const mestre = !!sala && (!sala.criador || sala.criador === usuario.usuario);

  const camadasOrd = useMemo(() => Object.values(camadas).sort((a, b) => (a.ordem || 0) - (b.ordem || 0)), [camadas]);

  const itensVisiveis = useMemo(() => {
    const ordem = {};
    camadasOrd.forEach((c, i) => (ordem[c.id] = i));
    return Object.values(itens)
      .filter((i) => camadas[i.camada] && camadas[i.camada].visivel !== false)
      .sort((a, b) => ordem[a.camada] - ordem[b.camada] || (a.z || 0) - (b.z || 0))
      .map((i) => (i.type === 'token' ? { ...i, r: (i.tam || 1) * cel * 0.45 } : i));
  }, [itens, camadas, camadasOrd, cel]);

  useEffect(() => {
    if (camadasOrd.length && (!camadaAtiva || !camadas[camadaAtiva])) setCamadaAtiva(camadasOrd[camadasOrd.length - 1].id);
  }, [camadasOrd]);

  useEffect(() => {
    if (sala && tam.w && !centralizado) {
      centralizar();
      setCentralizado(true);
    }
  }, [sala, tam]);

  // Delete / Backspace apaga o selecionado (navegador)
  const selRef = useRef(null);
  selRef.current = selecionado;
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const tecla = (ev) => {
      const tag = (ev.target && ev.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if ((ev.key === 'Delete' || ev.key === 'Backspace') && selRef.current) removerItem(selRef.current);
      if (ev.key === 'Escape') setSelecionado(null);
    };
    document.addEventListener('keydown', tecla);
    return () => document.removeEventListener('keydown', tecla);
  }, []);

  function trocarAba(id) {
    setAba(id);
    setFerramenta(ABAS.find((a) => a.id === id).ferramenta);
    setSelecionado(null);
  }

  // ---------- operações de itens ----------
  function salvarItem(it) {
    pendentes.current[it.id] = Date.now();
    setItens((p) => ({ ...p, [it.id]: it }));
    salvar(`${base}/itens/${it.id}`, it).catch(() => setOnline(false));
  }

  function removerItem(id) {
    apagados.current[id] = Date.now();
    setItens((p) => {
      const n = { ...p };
      delete n[id];
      return n;
    });
    setSelecionado((sid) => (sid === id ? null : sid));
    apagar(`${base}/itens/${id}`).catch(() => setOnline(false));
  }

  const camadaPodeReceber = () => {
    const c = camadas[camadaAtiva];
    if (!c) {
      avisar('Crie uma camada primeiro');
      return false;
    }
    if (c.travada) {
      avisar(`Camada "${c.nome}" está travada`);
      return false;
    }
    if (c.visivel === false) {
      avisar(`Camada "${c.nome}" está oculta`);
      return false;
    }
    return true;
  };

  const novoBase = () => ({ id: gerarId(), camada: camadaAtiva, z: Date.now(), cor, autor: nome });

  // encaixa o canto superior esquerdo nas linhas da grade (quadrada); na hex, centraliza na célula
  function encaixarCanto(x, y, w, h) {
    if (!g.grade || !g.snap) return { x, y };
    if (g.tipoGrade === 'hex') {
      const c = encaixarPonto(x + w / 2, y + h / 2, g);
      return { x: c.x - w / 2, y: c.y - h / 2 };
    }
    return {
      x: Math.round((x - g.offX) / cel) * cel + g.offX,
      y: Math.round((y - g.offY) / cel) * cel + g.offY,
    };
  }

  function colocar(p) {
    if (ferramenta === 'luz') {
      if (!camadaPodeReceber()) return;
      salvarItem({ ...novoBase(), type: 'luz', x: p.x, y: p.y, r: cel * 4, intensidade: 1, cor: cor === CORES[7] ? '#ffd27a' : cor, rotulo: 'Luz' });
      return;
    }
    if (!modelo) {
      // token rápido
      if (!camadaPodeReceber()) return;
      const pos = encaixarPonto(p.x, p.y, g, rapido.tam);
      const it = { ...novoBase(), type: 'token', ...pos, tam: rapido.tam, rotulo: rapido.nome.trim(), img: '' };
      salvarItem(it);
      return;
    }
    if (modelo.tipo === 'mapa') return setMapaPendente(modelo);
    if (!camadaPodeReceber()) return;

    if (modelo.tipo === 'personagem') {
      const t = modelo.tamanho || 1;
      const pos = encaixarPonto(p.x, p.y, g, t);
      salvarItem({
        ...novoBase(),
        type: 'token',
        ...pos,
        tam: t,
        cor: modelo.cor || cor,
        rotulo: modelo.nome,
        img: modelo.img || '',
        ficha: dadosDeJogo({ ...modelo, tipo: modelo.categoria }),
      });
    } else if (modelo.tipo === 'objeto') {
      const w = (modelo.w || 1) * cel;
      const h = (modelo.h || 1) * cel;
      const pos = encaixarCanto(p.x - w / 2, p.y - h / 2, w, h);
      salvarItem({ ...novoBase(), type: 'prop', ...pos, w, h, emoji: modelo.emoji || '', img: modelo.img || '', rot: 0, rotulo: modelo.nome });
    } else if (modelo.tipo === 'estrutura') {
      const k = modelo.cel ? cel / modelo.cel : 1;
      const w = (modelo.w || 0) * k;
      const h = (modelo.h || 0) * k;
      const pos = encaixarCanto(p.x - w / 2, p.y - h / 2, w, h);
      const novos = itensDaEstrutura(modelo, pos.x, pos.y, cel, camadaAtiva, nome);
      novos.forEach(salvarItem);
      avisar(`"${modelo.nome}" colocada (${novos.length} elementos)`);
    }
  }

  function criarForma(tipo, a, b) {
    if (!camadaPodeReceber()) return;
    if (tipo === 'rect') {
      const w = Math.abs(b.x - a.x);
      const h = Math.abs(b.y - a.y);
      if (w < 5 || h < 5) return;
      salvarItem({ ...novoBase(), type: 'rect', x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w, h, espessura });
    } else {
      const r = Math.hypot(b.x - a.x, b.y - a.y);
      if (r < 5) return;
      salvarItem({ ...novoBase(), type: 'circle', x: a.x, y: a.y, r, espessura });
    }
  }

  function criarDesenho(pts) {
    if (!camadaPodeReceber()) return;
    salvarItem({ ...novoBase(), type: 'draw', ...pathDosPontos(pts), espessura });
  }

  function capturar(a, b) {
    const x0 = Math.min(a.x, b.x);
    const y0 = Math.min(a.y, b.y);
    const x1 = Math.max(a.x, b.x);
    const y1 = Math.max(a.y, b.y);
    if (x1 - x0 < 5 || y1 - y0 < 5) return;
    const dentro = itensVisiveis.filter((it) => {
      const bx = caixa(it);
      const cx = bx.x + bx.w / 2;
      const cy = bx.y + bx.h / 2;
      return cx >= x0 && cx <= x1 && cy >= y0 && cy <= y1;
    });
    if (!dentro.length) return avisar('Nenhum item dentro da área');
    setCaptura(dentro);
  }

  async function importarDungeondraft() {
    try {
      const arq = await escolherArquivoVtt();
      if (!arq) return;
      avisar('Importando mapa do Dungeondraft...', 8000);
      const m = await importarVtt(arq, { usuario, aoProgresso: (t) => avisar(t, 8000) });
      setFontes((f) => f.map((x) => (x.id === 'meus' ? { ...x, assets: [...x.assets, m] } : x)));
      avisar(`"${m.nome}" importado`);
      setMapaPendente(m);
    } catch (e) {
      avisar(e.message || 'Não foi possível importar o arquivo', 5000);
    }
  }

  async function salvarMeuAsset(dados) {
    const id = gerarId();
    const final = { ...dados, id, autor: nome, criadoEm: Date.now() };
    await salvar(`${assetsDe(usuario.usuario)}/${id}`, final);
    setFontes((f) => f.map((x) => (x.id === 'meus' ? { ...x, assets: [...x.assets, final] } : x)));
  }

  async function aplicarMapa(m, substituir) {
    setMapaPendente(null);
    if (substituir) {
      Object.values(itens).forEach((i) => removerItem(i.id));
      Object.values(camadas).forEach((c) => {
        apagados.current[c.id] = Date.now();
        apagar(`${base}/camadas/${c.id}`).catch(() => {});
      });
      setCamadas({});
    }
    const ordem0 = substituir ? 0 : camadasOrd.reduce((mx, c) => Math.max(mx, c.ordem || 0), -1) + 1;
    const ids = {};
    (m.camadas || []).forEach((c, i) => {
      const id = gerarId();
      ids[c.chave] = id;
      salvarCamada({ id, nome: substituir ? c.nome : `${m.nome} · ${c.nome}`, ordem: ordem0 + i, visivel: c.visivel !== false, travada: !!c.travada });
    });
    (m.itens || []).forEach((it) => ids[it.camada] && salvarItem({ ...it, id: gerarId(), camada: ids[it.camada], autor: nome }));
    if (substituir || !sala.mapUrl) salvarSala(m.sala || {});
    avisar(`Mapa "${m.nome}" aplicado`);
  }

  function acharItem(wx, wy) {
    for (let i = itensVisiveis.length - 1; i >= 0; i--) {
      const it = itensVisiveis[i];
      const c = camadas[it.camada];
      if (c && c.travada) continue;
      if (contemPonto(it, wx, wy)) return it;
    }
    return null;
  }

  function iniciarArraste(id) {
    arrastando.current = id;
    const it = itens[id];
    origemArraste.current = it ? { x: it.x, y: it.y } : null;
  }

  function moverLocal(id, x, y) {
    setItens((p) => (p[id] ? { ...p, [id]: { ...p[id], x, y } } : p));
  }

  function soltar(id) {
    arrastando.current = null;
    setItens((p) => {
      let it = p[id];
      if (!it) return p;
      if (it.type === 'token') it = { ...it, ...encaixarPonto(it.x, it.y, g, it.tam || 1) };
      if (it.type === 'prop') it = { ...it, ...encaixarCanto(it.x, it.y, it.w, it.h) };
      const o = origemArraste.current;
      if (!o || o.x !== it.x || o.y !== it.y) {
        pendentes.current[id] = Date.now();
        salvar(`${base}/itens/${id}`, it).catch(() => setOnline(false));
      }
      return { ...p, [id]: it };
    });
  }

  // ---------- operações de camadas ----------
  function salvarCamada(c) {
    pendentes.current[c.id] = Date.now();
    setCamadas((p) => ({ ...p, [c.id]: c }));
    salvar(`${base}/camadas/${c.id}`, c).catch(() => setOnline(false));
  }

  function novaCamada() {
    const maior = camadasOrd.reduce((m, c) => Math.max(m, c.ordem || 0), -1);
    const c = { id: gerarId(), nome: `Camada ${camadasOrd.length + 1}`, ordem: maior + 1, visivel: true, travada: false };
    salvarCamada(c);
    setCamadaAtiva(c.id);
  }

  function apagarCamada(id) {
    if (camadasOrd.length <= 1) return avisar('A mesa precisa de ao menos uma camada');
    Object.values(itens)
      .filter((i) => i.camada === id)
      .forEach((i) => removerItem(i.id));
    apagados.current[id] = Date.now();
    setCamadas((p) => {
      const n = { ...p };
      delete n[id];
      return n;
    });
    apagar(`${base}/camadas/${id}`).catch(() => setOnline(false));
    if (camadaAtiva === id) setCamadaAtiva(null);
  }

  function moverCamada(id, dir) {
    const idx = camadasOrd.findIndex((c) => c.id === id);
    const outra = camadasOrd[idx + dir];
    if (!outra) return;
    const a = camadasOrd[idx];
    salvarCamada({ ...a, ordem: outra.ordem });
    salvarCamada({ ...outra, ordem: a.ordem });
  }

  // ---------- ações do item selecionado ----------
  const sel = selecionado ? itens[selecionado] : null;

  function zPara(it, frente) {
    const zs = Object.values(itens)
      .filter((i) => i.camada === it.camada && i.id !== it.id)
      .map((i) => i.z || 0);
    const z = frente ? (zs.length ? Math.max(...zs) + 1 : it.z) : zs.length ? Math.min(...zs) - 1 : it.z;
    salvarItem({ ...it, z });
  }

  function trocarCamada(it, dir) {
    const idx = camadasOrd.findIndex((c) => c.id === it.camada);
    const alvo = camadasOrd[idx + dir];
    if (!alvo) return avisar(dir > 0 ? 'Já está na camada do topo' : 'Já está na camada de baixo');
    salvarItem({ ...it, camada: alvo.id, z: Date.now() });
    avisar(`Movido para "${alvo.nome}"`);
  }

  function duplicar(it) {
    const novo = { ...it, id: gerarId(), z: Date.now(), x: it.x + cel, y: it.y, autor: nome };
    salvarItem(novo);
    setSelecionado(novo.id);
  }

  function registrarRolagem(texto) {
    pendSala.current = Date.now();
    const r = { texto, autor: nome, em: Date.now() };
    ultimaRolagem.current = r.em;
    setSala((sl) => ({ ...sl, ultimaRolagem: r }));
    atualizar(base, { ultimaRolagem: r }).catch(() => {});
    avisar(`🎲 ${texto}`, 5000);
  }

  // ---------- vista ----------
  function centralizar() {
    if (!sala || !tam.w) return;
    const mw = sala.mapW || 1400;
    const mh = sala.mapH || 1000;
    const sc = Math.min(tam.w / mw, tam.h / mh) * 0.92;
    setView({ s: sc, x: (tam.w - mw * sc) / 2, y: (tam.h - mh * sc) / 2 });
  }

  function zoom(fator) {
    setView((v) => {
      const sc = limitar(v.s * fator, 0.15, 6);
      const cx = tam.w / 2;
      const cy = tam.h / 2;
      const wx = (cx - v.x) / v.s;
      const wy = (cy - v.y) / v.s;
      return { s: sc, x: cx - wx * sc, y: cy - wy * sc };
    });
  }

  function salvarSala(parcial) {
    pendSala.current = Date.now();
    setSala((sl) => ({ ...sl, ...parcial }));
    atualizar(base, parcial).catch(() => setOnline(false));
  }

  async function compartilhar() {
    const link = linkDaMesa(codigo);
    try {
      if (Platform.OS === 'web') {
        await navigator.clipboard.writeText(link);
        avisar('Link da mesa copiado!');
      } else {
        await Share.share({ message: `Entre na minha mesa "${sala.nome}" no Mesa Vortex: ${link} (código ${codigo})` });
      }
    } catch (e) {
      avisar(`Código da mesa: ${codigo}`);
    }
  }

  if (naoExiste && !sala) {
    return (
      <View style={[s.tela, { alignItems: 'center', justifyContent: 'center', padding: 24 }]}>
        <Icone name="map-marker-question-outline" size={48} color={C.suave} />
        <Text style={{ color: C.texto, fontSize: 17, fontWeight: '700', marginTop: 10 }}>Mesa não encontrada</Text>
        <Text style={{ color: C.suave, marginTop: 4, textAlign: 'center' }}>O código {codigo} não existe ou a mesa foi excluída.</Text>
        <TouchableOpacity onPress={onSair} style={[s.chip, { marginTop: 16, paddingHorizontal: 16 }]}>
          <Text style={s.chipTxt}>Voltar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!sala) {
    return (
      <View style={[s.tela, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={C.destaque} size="large" />
        <Text style={{ color: C.suave, marginTop: 12 }}>{online ? 'Abrindo a mesa...' : 'Sem conexão com o Firestore'}</Text>
      </View>
    );
  }

  const nomeCamadaAtiva = camadas[camadaAtiva] ? camadas[camadaAtiva].nome : '—';
  const tokenFicha = fichaDe ? itens[fichaDe] : null;

  // ---------- conteúdo de cada aba ----------
  function conteudoAba() {
    if (aba === 'mover') {
      return (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.baseConteudo}>
          <Ferramentas
            lista={[
              ['mover', 'cursor-default', 'Selecionar'],
              ['pan', 'hand-back-right-outline', 'Navegar'],
            ]}
            atual={ferramenta}
            onEscolher={setFerramenta}
          />
          <Text style={s.dica}>{DICA_FERRAMENTA[ferramenta]}</Text>
        </ScrollView>
      );
    }

    if (aba === 'desenho') {
      return (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.baseConteudo}>
          <Ferramentas
            lista={[
              ['desenho', 'pencil-outline', 'Lápis'],
              ['retangulo', 'square-outline', 'Retângulo'],
              ['circulo', 'circle-outline', 'Círculo'],
              ['borracha', 'eraser', 'Borracha'],
              ['luz', 'lightbulb-on-outline', 'Luz'],
            ]}
            atual={ferramenta}
            onEscolher={setFerramenta}
          />
          {ferramenta !== 'borracha' && <Paleta cor={cor} onCor={setCor} />}
          {ferramenta !== 'borracha' && (
            <View style={s.grupo}>
              {[2, 4, 8, 14].map((e) => (
                <TouchableOpacity key={e} onPress={() => setEspessura(e)} style={[s.chip, espessura === e && s.chipAtivo]}>
                  <View style={{ width: 18, height: Math.min(e, 10), borderRadius: 5, backgroundColor: C.texto }} />
                </TouchableOpacity>
              ))}
            </View>
          )}
        </ScrollView>
      );
    }

    if (aba === 'grade') {
      return <PainelGrade g={g} mestre={mestre} onMudar={salvarSala} />;
    }

    if (aba === 'construir') {
      return (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.baseConteudo}>
          <TouchableOpacity style={[s.btnGrande, ferramenta === 'capturar' && s.btnGrandeAtivo]} onPress={() => setFerramenta('capturar')}>
            <Icone name="selection-drag" size={20} color={ferramenta === 'capturar' ? '#fff' : C.destaque2} />
            <Text style={[s.btnGrandeTxt, ferramenta === 'capturar' && { color: '#fff' }]}>Capturar estrutura</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.btnGrande} onPress={() => setSalvandoMapa(true)}>
            <Icone name="content-save-outline" size={20} color={C.destaque2} />
            <Text style={s.btnGrandeTxt}>Salvar mesa como mapa</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.btnGrande} onPress={importarDungeondraft}>
            <Icone name="file-import-outline" size={20} color={C.destaque2} />
            <Text style={s.btnGrandeTxt}>Importar Dungeondraft (.dd2vtt)</Text>
          </TouchableOpacity>
          {!!onCriarMapa && (
            <TouchableOpacity style={s.btnGrande} onPress={onCriarMapa}>
              <Icone name="map-plus" size={20} color={C.destaque2} />
              <Text style={s.btnGrandeTxt}>Criador de mapas</Text>
            </TouchableOpacity>
          )}
          <Text style={[s.dica, { maxWidth: 260 }]}>
            Monte com objetos, desenhos e formas; depois capture a área como estrutura ou salve a mesa inteira. Tudo vai para Meus assets e fica na aba Assets.
          </Text>
        </ScrollView>
      );
    }

    // ---- aba assets ----
    const fonteAtual = fontes.find((f) => f.id === fonte);
    const assetsFonte = fonteAtual ? fonteAtual.assets : [];
    const tiposDisp = TIPOS_ASSET.filter((t) => assetsFonte.some((a) => a.tipo === t.id));
    const tipoEfetivo = tiposDisp.some((t) => t.id === tipoAsset) ? tipoAsset : tiposDisp[0] ? tiposDisp[0].id : null;
    const doTipo = assetsFonte.filter((a) => a.tipo === tipoEfetivo);
    const pastas = pastasDe(doTipo);
    const pastaEfetiva = pastaAsset && pastas.includes(pastaAsset) ? pastaAsset : null;
    const lista = pastaEfetiva ? doTipo.filter((a) => (a.pasta || '').trim() === pastaEfetiva) : doTipo;
    return (
      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[s.baseConteudo, { paddingBottom: 2, gap: 6 }]}>
          <FonteChip ativo={fonte === 'rapido'} icone="flash-outline" rotulo="Rápido" onPress={() => { setFonte('rapido'); setModelo(null); }} />
          {fontes.map((f) => (
            <FonteChip key={f.id} ativo={fonte === f.id} icone={f.icone || 'package-variant'} rotulo={f.nome} onPress={() => { setFonte(f.id); setModelo(null); }} />
          ))}
          <TouchableOpacity onPress={carregarFontes} style={{ padding: 6 }}>
            <Icone name="refresh" size={16} color={C.suave} />
          </TouchableOpacity>
        </ScrollView>

        {fonte === 'rapido' ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.baseConteudo}>
            <TextInput
              style={[s.inputBase, { width: 120 }]}
              value={rapido.nome}
              onChangeText={(t) => setRapido({ ...rapido, nome: t })}
              placeholder="Nome do token"
              placeholderTextColor={C.suave}
            />
            <View style={s.grupo}>
              {[1, 2, 3, 4].map((t) => (
                <TouchableOpacity key={t} onPress={() => setRapido({ ...rapido, tam: t })} style={[s.chip, rapido.tam === t && s.chipAtivo]}>
                  <Text style={s.chipTxt}>{t}×</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Paleta cor={cor} onCor={setCor} />
          </ScrollView>
        ) : (
          <View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[s.baseConteudo, { paddingVertical: 2, gap: 4 }]}>
              {tiposDisp.map((t) => (
                <TouchableOpacity key={t.id} onPress={() => { setTipoAsset(t.id); setPastaAsset(null); }} style={[s.tipoChip, tipoEfetivo === t.id && s.tipoChipAtivo]}>
                  <Icone name={t.icone} size={14} color={tipoEfetivo === t.id ? C.destaque2 : C.suave} />
                  <Text style={[s.tipoTxt, tipoEfetivo === t.id && { color: C.destaque2 }]}>{t.nome}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            {pastas.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[s.baseConteudo, { paddingVertical: 2, gap: 4 }]}>
                {[null, ...pastas].map((p) => (
                  <TouchableOpacity key={p || 'todas'} onPress={() => setPastaAsset(p)} style={[s.pastaChip, pastaEfetiva === p && s.pastaChipAtiva]}>
                    <Icone name={p ? (pastaEfetiva === p ? 'folder-open' : 'folder-outline') : 'folder-multiple-outline'} size={13} color={pastaEfetiva === p ? '#fff' : C.suave} />
                    <Text style={[s.pastaTxt, pastaEfetiva === p && { color: '#fff' }]}>{p || 'Todas'}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[s.baseConteudo, { gap: 8 }]}>
              {lista.length === 0 && (
                <Text style={s.dica}>
                  {fonte === 'meus' ? 'Nada aqui ainda. Crie em Meus assets ou pela aba Construir.' : 'Pack vazio.'}
                </Text>
              )}
              {lista.map((a) => (
                <TouchableOpacity key={a.id} onPress={() => setModelo(modelo && modelo.id === a.id ? null : a)} style={[s.assetBtn, modelo && modelo.id === a.id && s.assetBtnAtivo]}>
                  <AssetMini asset={a} tamanho={40} />
                  <Text style={s.assetNome} numberOfLines={1}>{a.nome}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
        <Text style={[s.dica, { paddingHorizontal: 12, paddingBottom: 6 }]}>
          {modelo
            ? modelo.tipo === 'mapa'
              ? `Toque no mapa para aplicar "${modelo.nome}".`
              : `Toque no mapa para colocar "${modelo.nome}" · ${resumoAsset(modelo)}`
            : fonte === 'rapido'
            ? 'Toque no mapa para colocar um token simples.'
            : 'Escolha um asset.'}
          {'  '}Camada: {nomeCamadaAtiva}
        </Text>
      </View>
    );
  }

  return (
    <View style={s.tela}>
      {/* ---------- barra superior ---------- */}
      <View style={s.topo}>
        <TouchableOpacity onPress={onSair} style={s.btnTopo}>
          <Icone name="arrow-left" size={20} color={C.texto} />
        </TouchableOpacity>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.nomeMesa} numberOfLines={1}>{sala.nome}</Text>
          <Text style={s.codigo} numberOfLines={1}>
            <Text style={{ color: online ? C.ok : C.perigo }}>● </Text>
            {codigo} · camada: {nomeCamadaAtiva}
          </Text>
        </View>
        <TouchableOpacity onPress={() => zoom(1 / 1.25)} style={s.btnTopo}>
          <Icone name="minus" size={18} color={C.texto} />
        </TouchableOpacity>
        <TouchableOpacity onPress={centralizar} style={s.btnTopo}>
          <Text style={s.zoomTxt}>{Math.round(view.s * 100)}%</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => zoom(1.25)} style={s.btnTopo}>
          <Icone name="plus" size={18} color={C.texto} />
        </TouchableOpacity>
        {mestre && (
          <TouchableOpacity onPress={() => setConfig(true)} style={s.btnTopo}>
            <Icone name="cog-outline" size={20} color={C.texto} />
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={compartilhar} style={s.btnTopo}>
          <Icone name="share-variant-outline" size={20} color={C.texto} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setPainel(!painel)} style={[s.btnTopo, painel && s.btnTopoAtivo]}>
          <Icone name="layers-triple-outline" size={20} color={painel ? '#fff' : C.texto} />
        </TouchableOpacity>
      </View>

      {visitante && faixaVisitante && (
        <View style={s.faixaVisitante}>
          <Icone name="incognito" size={18} color="#fff" />
          <Text style={s.faixaTxt}>
            Você está jogando como <Text style={{ fontWeight: '800' }}>visitante</Text>. Entrar é opcional, mas salva suas campanhas e assets.
          </Text>
          <TouchableOpacity style={s.faixaBtn} onPress={onEntrarConta}>
            <Text style={s.faixaBtnTxt}>Entrar / criar conta</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setFaixaVisitante(false)} style={{ padding: 4 }}>
            <Icone name="close" size={16} color="#fff" />
          </TouchableOpacity>
        </View>
      )}

      {/* ---------- palco ---------- */}
      <View style={{ flex: 1 }}>
        <Palco
          mostrarLuzes={mestre}
          sala={sala}
          itens={itensVisiveis}
          view={view}
          setView={setView}
          ferramenta={ferramenta}
          cor={cor}
          espessura={espessura}
          selecionado={selecionado}
          acharItem={acharItem}
          onSelecionar={setSelecionado}
          onIniciarArraste={iniciarArraste}
          onMoverLocal={moverLocal}
          onSoltar={soltar}
          onApagar={removerItem}
          onColocar={colocar}
          onCriarForma={criarForma}
          onCriarDesenho={criarDesenho}
          onCapturar={capturar}
          onTamanho={(w, h) => setTam({ w, h })}
        />
        {!!aviso && (
          <View style={s.aviso} pointerEvents="none">
            <Text style={s.avisoTxt}>{aviso}</Text>
          </View>
        )}
        {painel && (
          <PainelCamadas
            camadas={camadasOrd}
            itens={Object.values(itens)}
            camadaAtiva={camadaAtiva}
            setCamadaAtiva={setCamadaAtiva}
            selecionado={selecionado}
            onSelecionar={setSelecionado}
            onSalvarCamada={salvarCamada}
            onNovaCamada={novaCamada}
            onApagarCamada={apagarCamada}
            onMoverCamada={moverCamada}
            onFechar={() => setPainel(false)}
          />
        )}
      </View>

      {/* ---------- painel inferior: inspetor ou conteúdo da aba ---------- */}
      <View style={s.base}>
        {sel ? (
          <Inspetor
            key={sel.id}
            it={sel}
            camada={camadas[sel.camada]}
            cel={cel}
            onSalvar={salvarItem}
            onFicha={() => setFichaDe(sel.id)}
            onApagar={() => removerItem(sel.id)}
            onFrente={() => zPara(sel, true)}
            onTras={() => zPara(sel, false)}
            onCamada={(d) => trocarCamada(sel, d)}
            onDuplicar={() => duplicar(sel)}
            onFechar={() => setSelecionado(null)}
          />
        ) : (
          conteudoAba()
        )}
        <View style={s.abasBar}>
          {ABAS.map((a) => (
            <TouchableOpacity key={a.id} style={[s.abaBtn, aba === a.id && s.abaBtnAtiva]} onPress={() => trocarAba(a.id)}>
              <Icone name={a.icone} size={20} color={aba === a.id ? C.destaque2 : C.suave} />
              <Text style={[s.abaTxt, aba === a.id && { color: C.destaque2 }]}>{a.nome}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <ConfigMesa visivel={config} sala={sala} codigo={codigo} autor={nome} onSalvar={salvarSala} onFechar={() => setConfig(false)} />

      {tokenFicha && (
        <FichaVortex
          ficha={{ ...(tokenFicha.ficha || {}), nome: tokenFicha.rotulo || '', cor: tokenFicha.cor, img: tokenFicha.img || '', tamanho: tokenFicha.tam || 1 }}
          titulo="Ficha do token (só nesta mesa)"
          onSalvar={async (f) => {
            salvarItem({ ...tokenFicha, rotulo: f.nome, cor: f.cor, img: f.img, tam: f.tamanho, ficha: dadosDeJogo(f) });
            setFichaDe(null);
          }}
          onRolagem={registrarRolagem}
          onFechar={() => setFichaDe(null)}
        />
      )}

      {captura && (
        <ModalNome
          titulo="Salvar estrutura"
          detalhe={`${captura.length} elementos capturados. Ela vai para Meus assets › Estruturas.`}
          onConfirmar={async (n) => {
            await salvarMeuAsset({ ...estruturaDosItens(captura, cel), nome: n });
            setCaptura(null);
            avisar(`Estrutura "${n}" salva`);
          }}
          onFechar={() => setCaptura(null)}
        />
      )}

      {salvandoMapa && (
        <ModalNome
          titulo="Salvar mesa como mapa"
          valorInicial={sala.nome}
          detalhe={`Fundo, grade, ${camadasOrd.length} camadas e ${Object.keys(itens).length} itens. Vai para Meus assets › Mapas.`}
          onConfirmar={async (n) => {
            await salvarMeuAsset({ ...mapaDaMesa(sala, camadasOrd, Object.values(itens)), nome: n });
            setSalvandoMapa(false);
            avisar(`Mapa "${n}" salvo`);
          }}
          onFechar={() => setSalvandoMapa(false)}
        />
      )}

      {mapaPendente && (
        <Modal transparent animationType="fade" onRequestClose={() => setMapaPendente(null)}>
          <View style={s.fundoModal}>
            <View style={s.modal}>
              <Text style={s.modalTitulo}>Aplicar mapa "{mapaPendente.nome}"</Text>
              <Text style={s.dica}>{resumoAsset(mapaPendente)}</Text>
              {!mestre && <Text style={[s.dica, { color: '#f59e0b', marginTop: 6 }]}>Só o mestre pode aplicar mapas nesta mesa.</Text>}
              <TouchableOpacity disabled={!mestre} style={[s.opcaoMapa, !mestre && { opacity: 0.4 }]} onPress={() => aplicarMapa(mapaPendente, false)}>
                <Icone name="layers-plus" size={20} color={C.destaque2} />
                <View style={{ flex: 1 }}>
                  <Text style={s.opcaoTit}>Adicionar à mesa</Text>
                  <Text style={s.dica}>Cria as camadas do mapa por cima das atuais.</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity disabled={!mestre} style={[s.opcaoMapa, !mestre && { opacity: 0.4 }]} onPress={() => aplicarMapa(mapaPendente, true)}>
                <Icone name="swap-horizontal" size={20} color={C.perigo} />
                <View style={{ flex: 1 }}>
                  <Text style={s.opcaoTit}>Substituir tudo</Text>
                  <Text style={s.dica}>Apaga camadas e itens atuais e carrega o mapa.</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setMapaPendente(null)} style={{ alignSelf: 'center', padding: 10 }}>
                <Text style={{ color: C.suave }}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

function Ferramentas({ lista, atual, onEscolher }) {
  return (
    <View style={s.grupo}>
      {lista.map(([id, icone, rotulo]) => (
        <TouchableOpacity key={id} onPress={() => onEscolher(id)} style={[s.ferr, atual === id && s.ferrAtiva]}>
          <Icone name={icone} size={20} color={atual === id ? '#fff' : C.suave} />
          <Text style={[s.ferrTxt, atual === id && { color: '#fff' }]}>{rotulo}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function FonteChip({ ativo, icone, rotulo, onPress }) {
  return (
    <TouchableOpacity onPress={onPress} style={[s.fonte, ativo && s.fonteAtiva]}>
      <Icone name={icone} size={14} color={ativo ? '#fff' : C.suave} />
      <Text style={[s.fonteTxt, ativo && { color: '#fff' }]} numberOfLines={1}>{rotulo}</Text>
    </TouchableOpacity>
  );
}

function Paleta({ cor, onCor }) {
  return (
    <View style={s.grupo}>
      {CORES.map((c) => (
        <TouchableOpacity key={c} onPress={() => onCor(c)} style={[s.cor, { backgroundColor: c }, cor === c && s.corSel]} />
      ))}
    </View>
  );
}

function Passo({ rotulo, valor, onMenos, onMais, desativado }) {
  return (
    <View style={[s.passo, desativado && { opacity: 0.45 }]}>
      <Text style={s.passoRot}>{rotulo}</Text>
      <View style={s.grupo}>
        <TouchableOpacity disabled={desativado} onPress={onMenos} style={s.passoBtn}>
          <Icone name="minus" size={14} color={C.texto} />
        </TouchableOpacity>
        <Text style={s.passoVal}>{valor}</Text>
        <TouchableOpacity disabled={desativado} onPress={onMais} style={s.passoBtn}>
          <Icone name="plus" size={14} color={C.texto} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// Opções da grade (só o mestre altera; vale para todos na mesa)
function PainelGrade({ g, mestre, onMudar }) {
  const d = !mestre;
  const alterna = (k) => !d && onMudar({ [k]: !g[k] });
  const CORES_GRADE = ['#ffffff', '#000000', '#22d3ee', '#8b5cf6', '#eab308', '#ef4444'];
  return (
    <View>
      {!mestre && <Text style={[s.dica, { paddingHorizontal: 12, paddingTop: 6, color: '#f59e0b' }]}>Só o mestre altera a grade desta mesa.</Text>}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.baseConteudo}>
        <View style={s.grupo}>
          {[
            ['grade', 'grid', 'Mostrar'],
            ['snap', 'magnet', 'Encaixar'],
            ['infinita', 'all-inclusive', 'Infinita'],
          ].map(([k, ic, rot]) => (
            <TouchableOpacity key={k} disabled={d} onPress={() => alterna(k)} style={[s.ferr, g[k] && s.ferrAtiva, d && { opacity: 0.45 }]}>
              <Icone name={ic} size={18} color={g[k] ? '#fff' : C.suave} />
              <Text style={[s.ferrTxt, g[k] && { color: '#fff' }]}>{rot}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={s.grupo}>
          {[
            ['quadrada', 'square-outline', 'Quadrada'],
            ['hex', 'hexagon-outline', 'Hexagonal'],
          ].map(([k, ic, rot]) => (
            <TouchableOpacity key={k} disabled={d} onPress={() => onMudar({ tipoGrade: k })} style={[s.ferr, g.tipoGrade === k && s.ferrAtiva, d && { opacity: 0.45 }]}>
              <Icone name={ic} size={18} color={g.tipoGrade === k ? '#fff' : C.suave} />
              <Text style={[s.ferrTxt, g.tipoGrade === k && { color: '#fff' }]}>{rot}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Passo rotulo="Célula" valor={`${g.tamGrade}px`} desativado={d} onMenos={() => onMudar({ tamGrade: Math.max(20, g.tamGrade - 5) })} onMais={() => onMudar({ tamGrade: Math.min(300, g.tamGrade + 5) })} />
        <Passo rotulo="Linha" valor={g.espGrade} desativado={d} onMenos={() => onMudar({ espGrade: Math.max(0.5, g.espGrade - 0.5) })} onMais={() => onMudar({ espGrade: Math.min(6, g.espGrade + 0.5) })} />
        <Passo
          rotulo="Opacidade"
          valor={`${Math.round(g.opacGrade * 100)}%`}
          desativado={d}
          onMenos={() => onMudar({ opacGrade: Math.max(0.05, Math.round((g.opacGrade - 0.05) * 100) / 100) })}
          onMais={() => onMudar({ opacGrade: Math.min(1, Math.round((g.opacGrade + 0.05) * 100) / 100) })}
        />
        <Passo rotulo="Deslocar X" valor={g.offX} desativado={d} onMenos={() => onMudar({ offX: g.offX - 5 })} onMais={() => onMudar({ offX: g.offX + 5 })} />
        <Passo rotulo="Deslocar Y" valor={g.offY} desativado={d} onMenos={() => onMudar({ offY: g.offY - 5 })} onMais={() => onMudar({ offY: g.offY + 5 })} />
        <Passo
          rotulo="Escuridão"
          valor={`${Math.round((g.escuridao || 0) * 100)}%`}
          desativado={d}
          onMenos={() => onMudar({ escuridao: Math.max(0, Math.round(((g.escuridao || 0) - 0.1) * 10) / 10) })}
          onMais={() => onMudar({ escuridao: Math.min(0.95, Math.round(((g.escuridao || 0) + 0.1) * 10) / 10) })}
        />
        <View style={s.grupo}>
          {CORES_GRADE.map((c) => (
            <TouchableOpacity key={c} disabled={d} onPress={() => onMudar({ corGrade: c })} style={[s.cor, { backgroundColor: c }, g.corGrade === c && s.corSel]} />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function Inspetor({ it, camada, cel, onSalvar, onFicha, onApagar, onFrente, onTras, onCamada, onDuplicar, onFechar }) {
  const travada = camada && camada.travada;
  const rec = it.type === 'token' && it.ficha && it.ficha.recursos && it.ficha.recursos[0];

  function mudarRecurso(delta) {
    const recursos = it.ficha.recursos.map((r, i) => (i === 0 ? { ...r, atual: Math.max(0, Math.min(r.max || 999, (r.atual || 0) + delta)) } : r));
    onSalvar({ ...it, ficha: { ...it.ficha, recursos } });
  }

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.baseConteudo}>
      <View>
        <Text style={s.insTitulo} numberOfLines={1}>{it.rotulo || NOME_TIPO[it.type]}</Text>
        <Text style={s.insCamada}>
          {NOME_TIPO[it.type]} · {camada ? camada.nome : '?'}
          {travada ? ' 🔒' : ''}
        </Text>
      </View>

      {it.type === 'token' && (
        <View style={s.grupo}>
          <BtnIns icone="card-account-details-outline" rotulo="Ficha" cor={C.destaque2} onPress={onFicha} />
          {rec && (
            <View style={s.recurso}>
              <TouchableOpacity onPress={() => mudarRecurso(-1)} style={s.passoBtn}>
                <Icone name="minus" size={14} color={C.texto} />
              </TouchableOpacity>
              <View style={{ alignItems: 'center' }}>
                <Text style={s.recNome}>{rec.nome}</Text>
                <Text style={s.recVal}>
                  {rec.atual}/{rec.max}
                </Text>
              </View>
              <TouchableOpacity onPress={() => mudarRecurso(1)} style={s.passoBtn}>
                <Icone name="plus" size={14} color={C.texto} />
              </TouchableOpacity>
            </View>
          )}
          {[1, 2, 3, 4].map((t) => (
            <TouchableOpacity key={t} onPress={() => onSalvar({ ...it, tam: t })} style={[s.chip, (it.tam || 1) === t && s.chipAtivo]}>
              <Text style={s.chipTxt}>{t}×</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {it.type === 'luz' && (
        <View style={s.grupo}>
          <BtnIns icone="minus-circle-outline" rotulo="Raio −" onPress={() => onSalvar({ ...it, r: Math.max(cel, it.r - cel) })} />
          <Text style={s.recVal}>{Math.round(it.r / cel)} cél.</Text>
          <BtnIns icone="plus-circle-outline" rotulo="Raio +" onPress={() => onSalvar({ ...it, r: it.r + cel })} />
          <BtnIns
            icone="brightness-6"
            rotulo={`${Math.round((it.intensidade || 1) * 100)}%`}
            onPress={() => onSalvar({ ...it, intensidade: (it.intensidade || 1) >= 1 ? 0.4 : Math.round(((it.intensidade || 1) + 0.2) * 10) / 10 })}
          />
        </View>
      )}

      {it.type === 'prop' && (
        <View style={s.grupo}>
          <BtnIns icone="rotate-left" rotulo="-45°" onPress={() => onSalvar({ ...it, rot: ((it.rot || 0) - 45) % 360 })} />
          <BtnIns icone="rotate-right" rotulo="+45°" onPress={() => onSalvar({ ...it, rot: ((it.rot || 0) + 45) % 360 })} />
          <BtnIns icone="magnify-minus-outline" rotulo="Menor" onPress={() => it.w > cel / 2 && onSalvar({ ...it, w: it.w - cel / 2, h: Math.max(cel / 2, it.h - cel / 2) })} />
          <BtnIns icone="magnify-plus-outline" rotulo="Maior" onPress={() => onSalvar({ ...it, w: it.w + cel / 2, h: it.h + cel / 2 })} />
        </View>
      )}

      {it.type !== 'prop' && <Paleta cor={it.cor} onCor={(c) => onSalvar({ ...it, cor: c })} />}

      <View style={s.grupo}>
        <BtnIns icone="arrange-bring-forward" rotulo="Frente" onPress={onFrente} />
        <BtnIns icone="arrange-send-backward" rotulo="Trás" onPress={onTras} />
        <BtnIns icone="layers-plus" rotulo="Camada ↑" onPress={() => onCamada(+1)} />
        <BtnIns icone="layers-minus" rotulo="Camada ↓" onPress={() => onCamada(-1)} />
        <BtnIns icone="content-copy" rotulo="Duplicar" onPress={onDuplicar} />
        <BtnIns icone="trash-can-outline" rotulo="Apagar" cor={C.perigo} onPress={onApagar} />
        <BtnIns icone="close" rotulo="Fechar" onPress={onFechar} />
      </View>
    </ScrollView>
  );
}

function BtnIns({ icone, rotulo, onPress, cor }) {
  return (
    <TouchableOpacity onPress={onPress} style={s.btnIns}>
      <Icone name={icone} size={18} color={cor || C.texto} />
      <Text style={[s.btnInsTxt, cor && { color: cor }]}>{rotulo}</Text>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  tela: { flex: 1, backgroundColor: C.bg },
  topo: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: C.painel,
    borderBottomWidth: 1,
    borderColor: C.borda,
    gap: 2,
  },
  btnTopo: { padding: 7, borderRadius: 8 },
  btnTopoAtivo: { backgroundColor: C.destaque },
  nomeMesa: { color: C.texto, fontWeight: '700', fontSize: 15 },
  codigo: { color: C.suave, fontSize: 11 },
  zoomTxt: { color: C.texto, fontSize: 12, minWidth: 38, textAlign: 'center' },
  base: { backgroundColor: C.painel, borderTopWidth: 1, borderColor: C.borda },
  baseConteudo: { alignItems: 'center', paddingHorizontal: 10, paddingVertical: 8, gap: 14 },
  abasBar: { flexDirection: 'row', borderTopWidth: 1, borderColor: C.borda, backgroundColor: C.bg },
  abaBtn: { flex: 1, alignItems: 'center', paddingVertical: 6, borderTopWidth: 2, borderColor: 'transparent' },
  abaBtnAtiva: { borderColor: C.destaque2, backgroundColor: C.painel },
  abaTxt: { color: C.suave, fontSize: 10, fontWeight: '700', marginTop: 1 },
  grupo: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ferr: { alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, borderWidth: 1, borderColor: C.borda, minWidth: 64 },
  ferrAtiva: { backgroundColor: C.destaque, borderColor: C.destaque },
  ferrTxt: { color: C.suave, fontSize: 10, fontWeight: '700', marginTop: 1 },
  fonte: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, borderWidth: 1, borderColor: C.borda, maxWidth: 170 },
  fonteAtiva: { backgroundColor: C.destaque, borderColor: C.destaque },
  fonteTxt: { color: C.suave, fontSize: 12, fontWeight: '700' },
  tipoChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderBottomWidth: 2, borderColor: 'transparent' },
  tipoChipAtivo: { borderColor: C.destaque2 },
  tipoTxt: { color: C.suave, fontSize: 11, fontWeight: '700' },
  pastaChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, borderWidth: 1, borderColor: C.borda },
  pastaChipAtiva: { backgroundColor: C.destaque2, borderColor: C.destaque2 },
  pastaTxt: { color: C.suave, fontSize: 11, fontWeight: '700' },
  assetBtn: { alignItems: 'center', width: 66, padding: 4, borderRadius: 10, borderWidth: 1, borderColor: 'transparent' },
  assetBtnAtivo: { borderColor: C.destaque2, backgroundColor: 'rgba(34,211,238,0.12)' },
  assetNome: { color: C.texto, fontSize: 10, marginTop: 3, textAlign: 'center' },
  cor: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: 'transparent' },
  corSel: { borderColor: C.destaque2, transform: [{ scale: 1.15 }] },
  chip: { minWidth: 34, height: 30, borderRadius: 8, borderWidth: 1, borderColor: C.borda, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  chipAtivo: { borderColor: C.destaque, backgroundColor: 'rgba(139,92,246,0.25)' },
  chipTxt: { color: C.texto, fontSize: 12, fontWeight: '600' },
  inputBase: { backgroundColor: C.painel2, borderWidth: 1, borderColor: C.borda, color: C.texto, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5, fontSize: 13 },
  passo: { alignItems: 'center', backgroundColor: C.painel2, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4 },
  passoRot: { color: C.suave, fontSize: 10, fontWeight: '700' },
  passoBtn: { width: 24, height: 24, borderRadius: 12, borderWidth: 1, borderColor: C.borda, alignItems: 'center', justifyContent: 'center' },
  passoVal: { color: C.texto, fontWeight: '800', minWidth: 38, textAlign: 'center', fontSize: 12 },
  btnGrande: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: C.destaque2, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9 },
  btnGrandeAtivo: { backgroundColor: C.destaque, borderColor: C.destaque },
  btnGrandeTxt: { color: C.destaque2, fontWeight: '800', fontSize: 13 },
  dica: { color: C.suave, fontSize: 12 },
  insTitulo: { color: C.destaque2, fontWeight: '700', maxWidth: 140 },
  insCamada: { color: C.suave, fontSize: 11 },
  recurso: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.painel2, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  recNome: { color: C.suave, fontSize: 10 },
  recVal: { color: C.texto, fontWeight: '800' },
  btnIns: { alignItems: 'center', paddingHorizontal: 6 },
  btnInsTxt: { color: C.suave, fontSize: 10, marginTop: 2 },
  faixaVisitante: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#b45309', paddingHorizontal: 10, paddingVertical: 7 },
  faixaTxt: { color: '#fff', fontSize: 12, flex: 1 },
  faixaBtn: { backgroundColor: '#fff', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  faixaBtnTxt: { color: '#b45309', fontWeight: '800', fontSize: 12 },
  aviso: {
    position: 'absolute',
    top: 12,
    alignSelf: 'center',
    maxWidth: '90%',
    backgroundColor: 'rgba(21,18,31,0.95)',
    borderWidth: 1,
    borderColor: C.destaque,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  avisoTxt: { color: C.texto, fontSize: 13 },
  fundoModal: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', alignItems: 'center', padding: 14 },
  modal: { width: '100%', maxWidth: 420, backgroundColor: C.painel, borderRadius: 16, borderWidth: 1, borderColor: C.borda, padding: 16, gap: 8 },
  modalTitulo: { color: C.texto, fontWeight: '800', fontSize: 17 },
  opcaoMapa: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: C.borda, borderRadius: 12, padding: 12 },
  opcaoTit: { color: C.texto, fontWeight: '700' },
});
