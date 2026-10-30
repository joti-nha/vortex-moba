// Assets e packs: carregamento, regras de visibilidade/oficialização, notificações
// e conversões entre itens da mesa e estruturas/mapas.
import { porNome } from '../components/Ficha';
import { C } from '../config/theme';
import { ASSETS_SEMENTE, PACKS_SEMENTE } from '../data/sementes';
import { COL, atualizar, consultar, listar, salvar } from './firestore';
import { caixa, gerarId } from '../utils/util';

export const assetsDe = (usuario) => `${COL.usuarios}/${usuario}/assets`;


// ---------- carregamento ----------
// Packs com seus assets agrupados. incluirRascunhos: só para o admin.
// Todos os packs (oficiais e de jogadores) com seus assets agrupados
export async function carregarTodosPacks() {
  let [packs, assets] = await Promise.all([listar(COL.packs), listar(COL.assets)]);
  if (packs.length === 0) {
    await Promise.all([
      ...PACKS_SEMENTE.map((p) => salvar(`${COL.packs}/${p.id}`, p)),
      ...ASSETS_SEMENTE.map((a) => salvar(`${COL.assets}/${a.id}`, a)),
    ]);
    packs = PACKS_SEMENTE.slice();
    assets = ASSETS_SEMENTE.slice();
  }
  const porPack = {};
  assets.forEach((a) => (porPack[a.pack] = porPack[a.pack] || []).push(a));
  return packs
    .sort((a, b) => (a.ordem || 0) - (b.ordem || 0) || (a.criadoEm || 0) - (b.criadoEm || 0))
    .map((p) => ({ ...p, assets: porNome(porPack[p.id] || []) }));
}

export async function carregarMeusAssets(usuario) {
  return porNome(await listar(assetsDe(usuario)));
}

export const packEstaAtivo = (ativos, id) => ativos === null || ativos.includes(id);

// Pack oficial = postado por admin ou aprovado na oficialização. Packs de jogadores têm oficial: false
export const ehOficial = (p) => p.oficial !== false;
// O que um usuário pode ver/usar: oficiais publicados + os próprios packs
export const packVisivelPara = (p, usuario) => (ehOficial(p) && p.publicado) || p.dono === usuario;

export const STATUS_PACK = {
  privado: { nome: 'Privado', cor: '#6b7280', icone: 'lock-outline' },
  pendente: { nome: 'Aguardando análise', cor: '#eab308', icone: 'timer-sand' },
  ressalvas: { nome: 'Com ressalvas', cor: '#f97316', icone: 'message-alert-outline' },
  recusado: { nome: 'Recusado', cor: '#ef4444', icone: 'close-octagon-outline' },
  aceito: { nome: 'Oficial', cor: '#22c55e', icone: 'check-decagram' },
};
export const statusDoPack = (p) => (ehOficial(p) ? 'aceito' : p.status || 'privado');

// ---------- notificações ----------
export async function notificar(para, dados) {
  const id = gerarId();
  await salvar(`${COL.notificacoes}/${id}`, { para, lida: false, em: Date.now(), ...dados });
}

export async function carregarNotificacoes(usuario, admin) {
  const [minhas, deAdmins] = await Promise.all([
    consultar(COL.notificacoes, 'para', usuario),
    admin ? consultar(COL.notificacoes, 'para', 'admins') : Promise.resolve([]),
  ]);
  return [...minhas, ...deAdmins].sort((a, b) => (b.em || 0) - (a.em || 0));
}

export const marcarLida = (id) => atualizar(`${COL.notificacoes}/${id}`, { lida: true }).catch(() => {});

// ---------- conversões mesa <-> asset ----------
const CAMPOS_FORA = ['id', 'camada', 'z', 'autor'];
const limparItem = (it) => {
  const o = {};
  Object.keys(it).forEach((k) => !CAMPOS_FORA.includes(k) && (o[k] = it[k]));
  return o;
};

// Estrutura a partir de itens da mesa (posições relativas ao canto superior esquerdo)
export function estruturaDosItens(itens, cel) {
  const bs = itens.map(caixa);
  const x0 = Math.min(...bs.map((b) => b.x));
  const y0 = Math.min(...bs.map((b) => b.y));
  const x1 = Math.max(...bs.map((b) => b.x + b.w));
  const y1 = Math.max(...bs.map((b) => b.y + b.h));
  const ord = [...itens].sort((a, b) => (a.z || 0) - (b.z || 0));
  return {
    tipo: 'estrutura',
    cel,
    w: Math.round(x1 - x0),
    h: Math.round(y1 - y0),
    itens: ord.map((it) => ({ ...limparItem(it), x: it.x - x0, y: it.y - y0 })),
  };
}

// Itens prontos para a mesa a partir de uma estrutura, com o canto em (x, y) e escala para a grade atual
export function itensDaEstrutura(estr, x, y, cel, camada, autor) {
  const k = estr.cel ? cel / estr.cel : 1;
  const z0 = Date.now();
  return (estr.itens || []).map((it, i) => {
    const n = { ...it, id: gerarId(), camada, autor, z: z0 + i, x: x + it.x * k, y: y + it.y * k };
    if (n.w !== undefined) n.w = it.w * k;
    if (n.h !== undefined) n.h = it.h * k;
    if (it.type === 'circle' || it.type === 'luz') n.r = it.r * k;
    if (it.type === 'draw' && k !== 1) n.escalaPath = (it.escalaPath || 1) * k;
    return n;
  });
}

// Mapa = cena inteira (fundo, grade, camadas e itens)
const CAMPOS_SALA = ['mapUrl', 'mapW', 'mapH', 'grade', 'tipoGrade', 'tamGrade', 'corGrade', 'opacGrade', 'espGrade', 'infinita', 'offX', 'offY', 'snap'];
export function mapaDaMesa(sala, camadasOrd, itens) {
  const salaMapa = {};
  CAMPOS_SALA.forEach((k) => sala[k] !== undefined && (salaMapa[k] = sala[k]));
  const chaves = {};
  camadasOrd.forEach((c, i) => (chaves[c.id] = 'c' + i));
  return {
    tipo: 'mapa',
    img: sala.mapUrl || '',
    sala: salaMapa,
    camadas: camadasOrd.map((c, i) => ({ chave: 'c' + i, nome: c.nome, ordem: i, visivel: c.visivel !== false, travada: !!c.travada })),
    itens: itens.filter((it) => chaves[it.camada]).map((it) => ({ ...limparItem(it), camada: chaves[it.camada], z: it.z || 0 })),
  };
}

export function resumoAsset(a) {
  if (a.tipo === 'personagem') return `${a.categoria || a.tipo} · C${a.corpo || 0} P${a.precisao || 0} E${a.essencia || 0}`;
  if (a.tipo === 'objeto') return `${a.w || 1}×${a.h || 1} células`;
  if (a.tipo === 'estrutura') return `${(a.itens || []).length} elementos`;
  if (a.tipo === 'mapa') return `${(a.camadas || []).length} camadas · ${(a.itens || []).length} elementos`;
  return '';
}

// personagem no formato da ficha (categoria = Aliado/Inimigo/NPC/Criatura)
export const fichaDoAsset = (a) => ({ ...a, tipo: a.categoria || 'Aliado' });
export const assetDaFicha = (f, extra = {}) => {
  const { tipo, ...resto } = f;
  return { ...resto, ...extra, tipo: 'personagem', categoria: tipo || 'Aliado' };
};
