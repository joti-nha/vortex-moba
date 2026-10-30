// MESA VORTEX — arquivo único gerado por scripts/arquivo-unico.js (não edite aqui; edite em src/)
import React, { useEffect, useState, useMemo, useRef } from 'react';
import Svg, { Path, Circle, Defs, LinearGradient, Stop, G, Rect, Pattern, Image as SvgImage, Text as SvgText, RadialGradient, Mask, ClipPath, Line } from 'react-native-svg';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Image, ActivityIndicator, ScrollView, Modal, PanResponder, Platform, Linking, Share, KeyboardAvoidingView, SafeAreaView, StatusBar } from 'react-native';
import { MaterialCommunityIcons as Icone } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ExpoLinking from 'expo-linking';

// ================================================================
// src/config/theme.js
// ================================================================
// Paleta da Mesa Vortex
const C = {
  bg: '#0b0912',
  palco: '#07060c',
  painel: '#15121f',
  painel2: '#1e1a2d',
  borda: '#2f2845',
  texto: '#ece8f5',
  suave: '#958db0',
  destaque: '#8b5cf6',
  destaque2: '#22d3ee',
  perigo: '#ef4444',
  ok: '#22c55e',
};

const CORES = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#22d3ee', '#3b82f6', '#8b5cf6', '#ec4899', '#f5f5f5', '#1f2937',
];

const FERRAMENTAS = [
  { id: 'mover', icone: 'cursor-default', nome: 'Mover / Selecionar' },
  { id: 'pan', icone: 'hand-back-right-outline', nome: 'Navegar' },
  { id: 'token', icone: 'account-circle-outline', nome: 'Token' },
  { id: 'desenho', icone: 'pencil-outline', nome: 'Desenho livre' },
  { id: 'retangulo', icone: 'square-outline', nome: 'Retângulo' },
  { id: 'circulo', icone: 'circle-outline', nome: 'Círculo' },
  { id: 'borracha', icone: 'eraser', nome: 'Borracha' },
];

// ================================================================
// src/components/Logo.js
// ================================================================
// Identidade visual: hexágono (dado/mesa) com um vórtice no centro
function Logo({ tamanho = 64, id = 'logo' }) {
  const grad = `url(#${id})`;
  return (
    <Svg width={tamanho} height={tamanho} viewBox="0 0 100 100">
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={C.destaque} />
          <Stop offset="1" stopColor={C.destaque2} />
        </LinearGradient>
      </Defs>
      <Path
        d="M50 5 L89 27.5 L89 72.5 L50 95 L11 72.5 L11 27.5 Z"
        fill={C.painel2}
        stroke={grad}
        strokeWidth="5"
        strokeLinejoin="round"
      />
      <Path
        d="M50 42 A8 8 0 0 1 58 50 A14 14 0 0 1 44 64 A20 20 0 0 1 24 44 A27 27 0 0 1 51 17 A31 31 0 0 1 79 45"
        fill="none"
        stroke={grad}
        strokeWidth="6"
        strokeLinecap="round"
      />
      <Circle cx="50" cy="50" r="4.5" fill={C.destaque2} />
    </Svg>
  );
}

// ================================================================
// src/services/firestore.js
// ================================================================
// Acesso ao Firestore via REST (sem SDK), compatível com o Expo Snack
const PROJETO_ID = 'vortex-mobile-21f79';
const FIRESTORE_URL = `https://firestore.googleapis.com/v1/projects/${PROJETO_ID}/databases/(default)/documents`;

// Coleções do banco principal (vortex-mobile-21f79)
const COL = {
  usuarios: 'usuarios',
  mesas: 'mesas',
  packs: 'packs', // packs postados pelo admin
  assets: 'assets', // assets dos packs (campo "pack" aponta para o pack)
  notificacoes: 'notificacoes', // avisos (para: usuario ou "admins")
  // assets pessoais de cada usuário: usuarios/{usuario}/assets
};

// ---------- conversão JS <-> formato do Firestore ----------
function paraValor(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') {
    return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  }
  if (typeof v === 'string') return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(paraValor) } };
  if (typeof v === 'object') return { mapValue: { fields: paraCampos(v) } };
  return { stringValue: String(v) };
}

function paraCampos(obj) {
  const f = {};
  Object.keys(obj).forEach((k) => {
    if (obj[k] !== undefined) f[k] = paraValor(obj[k]);
  });
  return f;
}

function deValor(v) {
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('nullValue' in v) return null;
  if ('timestampValue' in v) return v.timestampValue;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(deValor);
  if ('mapValue' in v) return deCampos(v.mapValue.fields || {});
  return null;
}

function deCampos(f) {
  const o = {};
  Object.keys(f).forEach((k) => (o[k] = deValor(f[k])));
  return o;
}

const idDoNome = (name) => name.split('/').pop();
const semId = ({ id, ...resto }) => resto;

// ---------- operações ----------
async function lerDoc(caminho) {
  const r = await fetch(`${FIRESTORE_URL}/${caminho}`);
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`Firestore ${r.status}`);
  const j = await r.json();
  return { id: idDoNome(j.name), ...deCampos(j.fields || {}) };
}

async function listar(caminho) {
  const docs = [];
  let token = '';
  do {
    const url =
      `${FIRESTORE_URL}/${caminho}?pageSize=300` +
      (token ? `&pageToken=${encodeURIComponent(token)}` : '');
    const r = await fetch(url);
    if (!r.ok) throw new Error(`Firestore ${r.status}`);
    const j = await r.json();
    (j.documents || []).forEach((d) =>
      docs.push({ id: idDoNome(d.name), ...deCampos(d.fields || {}) })
    );
    token = j.nextPageToken || '';
  } while (token);
  return docs;
}

// Cria ou substitui o documento inteiro
async function salvar(caminho, dados) {
  const r = await fetch(`${FIRESTORE_URL}/${caminho}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: paraCampos(semId(dados)) }),
  });
  if (!r.ok) throw new Error(`Firestore ${r.status}`);
}

// Atualiza só os campos enviados
async function atualizar(caminho, parcial) {
  const dados = semId(parcial);
  const mascara = Object.keys(dados)
    .map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`)
    .join('&');
  const r = await fetch(`${FIRESTORE_URL}/${caminho}?${mascara}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: paraCampos(dados) }),
  });
  if (!r.ok) throw new Error(`Firestore ${r.status}`);
}

// Consulta simples: documentos de uma coleção onde campo == valor
async function consultar(colecao, campo, valor) {
  const r = await fetch(`${FIRESTORE_URL}:runQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: colecao }],
        where: { fieldFilter: { field: { fieldPath: campo }, op: 'EQUAL', value: paraValor(valor) } },
      },
    }),
  });
  if (!r.ok) throw new Error(`Firestore ${r.status}`);
  const j = await r.json();
  return (j || [])
    .filter((x) => x.document)
    .map((x) => ({ id: idDoNome(x.document.name), ...deCampos(x.document.fields || {}) }));
}

async function apagar(caminho) {
  const r = await fetch(`${FIRESTORE_URL}/${caminho}`, { method: 'DELETE' });
  if (!r.ok && r.status !== 404) throw new Error(`Firestore ${r.status}`);
}

// ================================================================
// src/utils/util.js
// ================================================================
const gerarId = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

const gerarCodigo = () => {
  const letras = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let c = '';
  for (let i = 0; i < 6; i++) c += letras[Math.floor(Math.random() * letras.length)];
  return c;
};

const limitar = (v, min, max) => Math.max(min, Math.min(max, v));

// Centro de um token "encaixado" na grade (tamanho ímpar = centro da célula, par = cruzamento)
const encaixar = (v, celula, tam = 1) =>
  tam % 2 === 1
    ? Math.floor(v / celula) * celula + celula / 2
    : Math.round(v / celula) * celula;

// Caixa delimitadora de qualquer item (para seleção e outliner)
function caixa(it) {
  if (it.type === 'luz') return { x: it.x - 20, y: it.y - 20, w: 40, h: 40 }; // só o centro da luz é "pegável"
  if (it.type === 'token' || it.type === 'circle') {
    return { x: it.x - it.r, y: it.y - it.r, w: it.r * 2, h: it.r * 2 };
  }
  return { x: it.x, y: it.y, w: it.w || 0, h: it.h || 0 };
}

function contemPonto(it, wx, wy, margem = 6) {
  if (it.type === 'luz') return Math.hypot(wx - it.x, wy - it.y) <= 20 + margem;
  if (it.type === 'token' || it.type === 'circle') {
    return Math.hypot(wx - it.x, wy - it.y) <= it.r + margem;
  }
  const b = caixa(it);
  return wx >= b.x - margem && wx <= b.x + b.w + margem && wy >= b.y - margem && wy <= b.y + b.h + margem;
}

// Converte pontos do mundo em um path relativo à própria caixa
function pathDosPontos(pts) {
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const d = pts
    .map((p, i) => `${i ? 'L' : 'M'}${(p.x - minX).toFixed(1)} ${(p.y - minY).toFixed(1)}`)
    .join(' ');
  return { x: minX, y: minY, w: Math.max(...xs) - minX, h: Math.max(...ys) - minY, d };
}

const NOME_TIPO = {
  token: 'Token',
  draw: 'Desenho',
  rect: 'Retângulo',
  circle: 'Círculo',
  prop: 'Objeto',
  luz: 'Luz',
  tiles: 'Mapa',
};

const ICONE_TIPO = {
  token: 'account-circle-outline',
  draw: 'draw',
  rect: 'square-outline',
  circle: 'circle-outline',
  prop: 'cube-outline',
  luz: 'lightbulb-on-outline',
  tiles: 'map-outline',
};

// ---------- pastas ----------
const SEM_PASTA = 'Sem pasta';

// Agrupa itens pelo campo "pasta": [{ pasta, itens }], com "Sem pasta" por último
function agruparPorPasta(itens) {
  const grupos = {};
  itens.forEach((it) => {
    const p = (it.pasta || '').trim() || SEM_PASTA;
    (grupos[p] = grupos[p] || []).push(it);
  });
  return Object.keys(grupos)
    .sort((a, b) => (a === SEM_PASTA) - (b === SEM_PASTA) || a.localeCompare(b))
    .map((pasta) => ({ pasta, itens: grupos[pasta] }));
}

// Lista de pastas já usadas
const pastasDe = (itens) => [...new Set(itens.map((it) => (it.pasta || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));

// ================================================================
// src/services/imagens.js
// ================================================================
// Imagens: galeria, câmera ou URL.
// Imagens enviadas do aparelho são redimensionadas, comprimidas (JPEG) e salvas em base64
// na coleção "imagens" do Firestore. Os itens guardam só a referência "fs:ID".

const COL_IMAGENS = 'imagens';
const LIMITE = 900000; // caracteres de base64 (documento do Firestore tem limite de 1 MB)

// ---------- cache de imagens já baixadas ----------
const cacheImg = {};
const pendentesImg = {};

async function resolverImagem(ref) {
  if (!ref) return '';
  if (!ref.startsWith('fs:')) return ref; // URL comum
  const id = ref.slice(3);
  if (cacheImg[id]) return cacheImg[id];
  if (!pendentesImg[id]) {
    pendentesImg[id] = lerDoc(`${COL_IMAGENS}/${id}`)
      .then((d) => {
        cacheImg[id] = (d && d.dados) || '';
        return cacheImg[id];
      })
      .catch(() => '')
      .finally(() => delete pendentesImg[id]);
  }
  return pendentesImg[id];
}

// Hook: devolve a imagem pronta para exibir (URL ou data URI)
function useImagem(ref) {
  const inicial = !ref ? '' : ref.startsWith('fs:') ? cacheImg[ref.slice(3)] || '' : ref;
  const [src, setSrc] = useState(inicial);
  useEffect(() => {
    let vivo = true;
    if (!ref) setSrc('');
    else if (!ref.startsWith('fs:')) setSrc(ref);
    else resolverImagem(ref).then((v) => vivo && setSrc(v));
    return () => {
      vivo = false;
    };
  }, [ref]);
  return src;
}

// ---------- seleção + compressão + upload ----------
async function comprimir(uri, largura) {
  let w = largura;
  let q = 0.7;
  for (let i = 0; i < 5; i++) {
    let r;
    if (ImageManipulator.ImageManipulator && ImageManipulator.ImageManipulator.manipulate) {
      // API nova (SDK 52+)
      const ctx = ImageManipulator.ImageManipulator.manipulate(uri);
      ctx.resize({ width: w });
      const img = await ctx.renderAsync();
      r = await img.saveAsync({ compress: q, format: ImageManipulator.SaveFormat.JPEG, base64: true });
    } else {
      // API antiga
      r = await ImageManipulator.manipulateAsync(uri, [{ resize: { width: w } }], {
        compress: q,
        format: ImageManipulator.SaveFormat.JPEG,
        base64: true,
      });
    }
    if (r.base64 && r.base64.length < LIMITE) return r;
    w = Math.round(w * 0.75);
    q = Math.max(0.3, q - 0.15);
  }
  throw new Error('Imagem grande demais.');
}

// origem: 'galeria' | 'camera'. Retorna { ref, w, h } ou null se cancelado.
async function escolherImagem(origem, { largura = 512, autor = '' } = {}) {
  const perm =
    origem === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (perm && perm.granted === false) throw new Error('Permissão negada para acessar ' + (origem === 'camera' ? 'a câmera.' : 'a galeria.'));

  const opcoes = { mediaTypes: ['images'], quality: 1, allowsEditing: false };
  const res =
    origem === 'camera' ? await ImagePicker.launchCameraAsync(opcoes) : await ImagePicker.launchImageLibraryAsync(opcoes);
  if (!res || res.canceled || !res.assets || !res.assets.length) return null;

  const original = res.assets[0];
  return salvarImagemDeUri(original.uri, { largura: Math.min(largura, original.width || largura), autor });
}

// Comprime uma imagem (uri local, blob ou data URI) e guarda no Firestore. Retorna { ref, w, h }
async function salvarImagemDeUri(uri, { largura = 1024, autor = '' } = {}) {
  const r = await comprimir(uri, largura);
  const id = gerarId();
  const dados = `data:image/jpeg;base64,${r.base64}`;
  await salvar(`${COL_IMAGENS}/${id}`, { dados, largura: r.width, altura: r.height, autor, criadoEm: Date.now() });
  cacheImg[id] = dados;
  return { ref: `fs:${id}`, w: r.width, h: r.height };
}

// Tipo da imagem pelo início do base64
function mimeDoBase64(b64) {
  if (b64.startsWith('/9j/')) return 'image/jpeg';
  if (b64.startsWith('UklGR')) return 'image/webp';
  return 'image/png';
}

// Imagem que chega em base64 (ex.: mapa do Dungeondraft): comprime direto do data URI
async function salvarImagemBase64(b64, opcoes = {}) {
  const mime = mimeDoBase64(b64);
  try {
    return await salvarImagemDeUri(`data:${mime};base64,${b64}`, opcoes);
  } catch (e) {
    throw new Error('Não consegui processar a imagem do mapa neste aparelho. Tente importar pela versão web do Snack.');
  }
}

// ================================================================
// src/components/CampoImagem.js
// ================================================================
// Campo de imagem reutilizável: galeria, câmera ou URL, com prévia

// ---------- componente de campo de imagem ----------
// valor: ref atual · onMudar(ref, {w,h}) · largura: tamanho máximo ao enviar
function CampoImagem({ valor, onMudar, largura = 512, rotulo = 'Imagem', autor = '', redondo }) {
  const src = useImagem(valor);
  const [modoUrl, setModoUrl] = useState(false);
  const [url, setUrl] = useState(valor && !valor.startsWith('fs:') ? valor : '');
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState('');

  async function pegar(origem) {
    setErro('');
    setOcupado(true);
    try {
      const r = await escolherImagem(origem, { largura, autor });
      if (r) onMudar(r.ref, { w: r.w, h: r.h });
    } catch (e) {
      setErro(e.message || 'Não foi possível carregar a imagem.');
    }
    setOcupado(false);
  }

  function aplicarUrl() {
    const u = url.trim();
    if (!u) return;
    setModoUrl(false);
    Image.getSize(
      u,
      (w, h) => onMudar(u, { w, h }),
      () => onMudar(u, null)
    );
  }

  return (
    <View style={estCampoImagem.campo}>
      <Text style={estCampoImagem.rotulo}>{rotulo}</Text>
      <View style={estCampoImagem.linha}>
        <View style={[estCampoImagem.preview, redondo && { borderRadius: 32 }]}>
          {ocupado ? (
            <ActivityIndicator color={C.destaque} />
          ) : src ? (
            <Image source={{ uri: src }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
          ) : (
            <Icone name="image-outline" size={26} color={C.suave} />
          )}
        </View>
        <View style={{ flex: 1, gap: 6 }}>
          <View style={estCampoImagem.botoes}>
            <TouchableOpacity style={estCampoImagem.btn} onPress={() => pegar('galeria')} disabled={ocupado}>
              <Icone name="image-multiple-outline" size={16} color={C.destaque2} />
              <Text style={estCampoImagem.btnTxt}>Galeria</Text>
            </TouchableOpacity>
            <TouchableOpacity style={estCampoImagem.btn} onPress={() => pegar('camera')} disabled={ocupado}>
              <Icone name="camera-outline" size={16} color={C.destaque2} />
              <Text style={estCampoImagem.btnTxt}>Câmera</Text>
            </TouchableOpacity>
            <TouchableOpacity style={estCampoImagem.btn} onPress={() => setModoUrl(!modoUrl)} disabled={ocupado}>
              <Icone name="link-variant" size={16} color={C.destaque2} />
              <Text style={estCampoImagem.btnTxt}>URL</Text>
            </TouchableOpacity>
            {!!valor && (
              <TouchableOpacity style={[estCampoImagem.btn, { borderColor: C.perigo }]} onPress={() => onMudar('', null)} disabled={ocupado}>
                <Icone name="close" size={16} color={C.perigo} />
              </TouchableOpacity>
            )}
          </View>
          {modoUrl && (
            <View style={estCampoImagem.linha}>
              <TextInput
                style={estCampoImagem.input}
                value={url}
                onChangeText={setUrl}
                placeholder="https://..."
                placeholderTextColor={C.suave}
                autoCapitalize="none"
                onSubmitEditing={aplicarUrl}
              />
              <TouchableOpacity style={[estCampoImagem.btn, { backgroundColor: C.destaque, borderColor: C.destaque }]} onPress={aplicarUrl}>
                <Icone name="check" size={16} color="#fff" />
              </TouchableOpacity>
            </View>
          )}
          {!!erro && <Text style={estCampoImagem.erro}>{erro}</Text>}
        </View>
      </View>
    </View>
  );
}

const estCampoImagem = StyleSheet.create({
  campo: { marginTop: 4 },
  rotulo: { color: C.suave, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', marginBottom: 6 },
  linha: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  preview: {
    width: 64,
    height: 64,
    borderRadius: 10,
    backgroundColor: C.painel2,
    borderWidth: 1,
    borderColor: C.borda,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  botoes: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: C.destaque2,
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  btnTxt: { color: C.destaque2, fontSize: 12, fontWeight: '700' },
  input: {
    flex: 1,
    backgroundColor: C.painel2,
    borderWidth: 1,
    borderColor: C.borda,
    color: C.texto,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 13,
  },
  erro: { color: C.perigo, fontSize: 12 },
});

// ================================================================
// src/components/CampoPasta.js
// ================================================================
// Escolha da pasta de um asset: pastas já existentes ou uma nova

function CampoPasta({ valor, pastas = [], onMudar }) {
  const [nova, setNova] = useState('');
  const lista = [...new Set([...pastas, ...(valor ? [valor] : [])])].filter(Boolean).sort((a, b) => a.localeCompare(b));

  const criar = () => {
    const n = nova.trim();
    if (!n) return;
    onMudar(n);
    setNova('');
  };

  return (
    <View>
      <Text style={estCampoPasta.rotulo}>Pasta</Text>
      <View style={estCampoPasta.wrap}>
        <TouchableOpacity onPress={() => onMudar('')} style={[estCampoPasta.chip, !valor && estCampoPasta.chipAtivo]}>
          <Icone name="folder-off-outline" size={13} color={!valor ? '#fff' : C.suave} />
          <Text style={[estCampoPasta.chipTxt, !valor && { color: '#fff' }]}>Sem pasta</Text>
        </TouchableOpacity>
        {lista.map((p) => (
          <TouchableOpacity key={p} onPress={() => onMudar(p)} style={[estCampoPasta.chip, valor === p && estCampoPasta.chipAtivo]}>
            <Icone name={valor === p ? 'folder-open' : 'folder-outline'} size={13} color={valor === p ? '#fff' : C.suave} />
            <Text style={[estCampoPasta.chipTxt, valor === p && { color: '#fff' }]}>{p}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={estCampoPasta.linha}>
        <TextInput
          style={estCampoPasta.input}
          value={nova}
          onChangeText={setNova}
          onSubmitEditing={criar}
          placeholder="Nova pasta (ex.: Mortos-vivos)"
          placeholderTextColor={C.suave}
        />
        <TouchableOpacity style={estCampoPasta.btn} onPress={criar}>
          <Icone name="folder-plus-outline" size={18} color={C.destaque2} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// Cabeçalho de pasta usado nas listas agrupadas
function CabecalhoPasta({ nome, quantidade, aberta, onPress }) {
  return (
    <TouchableOpacity style={estCampoPasta.cabecalho} onPress={onPress} activeOpacity={onPress ? 0.6 : 1}>
      <Icone name={aberta === false ? 'folder-outline' : 'folder-open-outline'} size={16} color={C.destaque2} />
      <Text style={estCampoPasta.cabecalhoTxt}>{nome}</Text>
      <Text style={estCampoPasta.cabecalhoNum}>{quantidade}</Text>
      {!!onPress && <Icone name={aberta === false ? 'chevron-down' : 'chevron-up'} size={16} color={C.suave} />}
    </TouchableOpacity>
  );
}

const estCampoPasta = StyleSheet.create({
  rotulo: { color: C.suave, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', marginTop: 12, marginBottom: 6 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, borderWidth: 1, borderColor: C.borda },
  chipAtivo: { backgroundColor: C.destaque, borderColor: C.destaque },
  chipTxt: { color: C.suave, fontSize: 12, fontWeight: '600' },
  linha: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  input: { flex: 1, backgroundColor: C.painel2, borderWidth: 1, borderColor: C.borda, color: C.texto, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, fontSize: 13 },
  btn: { borderWidth: 1, borderColor: C.destaque2, borderRadius: 8, padding: 7 },
  cabecalho: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, marginTop: 4, borderBottomWidth: 1, borderColor: C.borda },
  cabecalhoTxt: { color: C.destaque2, fontWeight: '800', fontSize: 12, flex: 1 },
  cabecalhoNum: { color: C.suave, fontSize: 11 },
});

// ================================================================
// src/components/Ficha.js
// ================================================================
// ---------- Ficha reduzida do Vortex ----------
// Teste: 2d6 + Atributo + Perícia · Atributos: Corpo, Precisão, Essência
const TIPOS = ['Aliado', 'Inimigo', 'NPC', 'Criatura'];
const ICONE_CATEGORIA = { Aliado: 'shield-account', Inimigo: 'sword-cross', NPC: 'account-tie', Criatura: 'paw' };
const ATRIBUTOS = [
  ['corpo', 'Corpo', 'arm-flex-outline'],
  ['precisao', 'Precisão', 'bullseye-arrow'],
  ['essencia', 'Essência', 'creation'],
];

const FICHA_VAZIA = {
  nome: '',
  conceito: '',
  tipo: 'Aliado',
  tamanho: 1,
  cor: '#8b5cf6',
  img: '',
  corpo: 0,
  precisao: 0,
  essencia: 0,
  pericias: [],
  recursos: [{ nome: 'Vida', atual: 10, max: 10 }],
  descricao: '',
};

function normalizarFicha(f = {}) {
  return {
    ...FICHA_VAZIA,
    ...f,
    pericias: Array.isArray(f.pericias) ? f.pericias : [],
    recursos: Array.isArray(f.recursos) ? f.recursos : FICHA_VAZIA.recursos,
  };
}

const porNome = (l) => l.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));

// Só os dados de jogo (o que vai junto do token na mesa)
const dadosDeJogo = (f) => ({
  conceito: f.conceito || '',
  tipo: f.tipo || 'Aliado',
  corpo: f.corpo || 0,
  precisao: f.precisao || 0,
  essencia: f.essencia || 0,
  pericias: f.pericias || [],
  recursos: f.recursos || [],
  descricao: f.descricao || '',
});

function TokenMini({ item, tamanho = 44 }) {
  const src = useImagem(item.img);
  return (
    <View
      style={{
        width: tamanho,
        height: tamanho,
        borderRadius: tamanho / 2,
        backgroundColor: item.cor || C.destaque,
        borderWidth: 2,
        borderColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      {src ? (
        <Image source={{ uri: src }} style={{ width: tamanho, height: tamanho }} />
      ) : (
        <Text style={{ color: '#fff', fontWeight: '800', fontSize: tamanho * 0.36 }}>
          {(item.nome || '?').slice(0, 2).toUpperCase()}
        </Text>
      )}
    </View>
  );
}

function Contador({ rotulo, valor, onMudar, min = 0, max = 6, travado }) {
  return (
    <View style={estFicha.contador}>
      {!!rotulo && <Text style={estFicha.contRot}>{rotulo}</Text>}
      <View style={estFicha.contLinha}>
        {!travado && (
          <TouchableOpacity onPress={() => onMudar(Math.max(min, valor - 1))} style={estFicha.contBtn}>
            <Icone name="minus" size={14} color={C.texto} />
          </TouchableOpacity>
        )}
        <Text style={estFicha.contValor}>{valor}</Text>
        {!travado && (
          <TouchableOpacity onPress={() => onMudar(Math.min(max, valor + 1))} style={estFicha.contBtn}>
            <Icone name="plus" size={14} color={C.texto} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const d6 = () => 1 + Math.floor(Math.random() * 6);

// Modal de edição/consulta da ficha.
//  ficha: objeto da ficha · titulo · somenteLeitura · acaoExtra {rotulo, icone, onPress}
//  onSalvar(ficha) · onApagar() opcional · onFechar() · onRolagem(texto) opcional
// pastas: se informado, mostra a escolha de pasta (usado em packs e em Meus assets)
function FichaVortex({ ficha, titulo, somenteLeitura, acaoExtra, onSalvar, onApagar, onFechar, onRolagem, pastas }) {
  const [f, setF] = useState(normalizarFicha(ficha));
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const [rolAttr, setRolAttr] = useState('corpo');
  const [rolPer, setRolPer] = useState(-1);
  const [resultado, setResultado] = useState(null);
  const ro = !!somenteLeitura;

  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const setLista = (k, i, campo, v) =>
    setF((x) => ({ ...x, [k]: x[k].map((it, j) => (j === i ? { ...it, [campo]: v } : it)) }));
  const removerDaLista = (k, i) => setF((x) => ({ ...x, [k]: x[k].filter((_, j) => j !== i) }));

  function rolar() {
    const a = d6();
    const b = d6();
    const attr = f[rolAttr] || 0;
    const per = rolPer >= 0 && f.pericias[rolPer] ? f.pericias[rolPer] : null;
    const total = a + b + attr + (per ? per.valor || 0 : 0);
    const nomeAttr = ATRIBUTOS.find((x) => x[0] === rolAttr)[1];
    const r = { a, b, attr, nomeAttr, per, total };
    setResultado(r);
    if (onRolagem) {
      onRolagem(`${f.nome || 'Ficha'}: ${nomeAttr}${per ? ' + ' + per.nome : ''} → [${a}+${b}] + ${attr}${per ? ' + ' + (per.valor || 0) : ''} = ${total}`);
    }
  }

  async function salvar() {
    if (f.nome.trim().length < 2) return setErro('Dê um nome à ficha.');
    setOcupado(true);
    try {
      await onSalvar({
        ...f,
        nome: f.nome.trim(),
        conceito: (f.conceito || '').trim(),
        img: (f.img || '').trim(),
        descricao: (f.descricao || '').trim(),
        pericias: f.pericias.filter((p) => (p.nome || '').trim()).map((p) => ({ nome: p.nome.trim(), valor: p.valor || 0 })),
        recursos: f.recursos
          .filter((r) => (r.nome || '').trim())
          .map((r) => ({ nome: r.nome.trim(), max: Math.max(0, parseInt(r.max, 10) || 0), atual: Math.max(0, parseInt(r.atual, 10) || 0) })),
      });
    } catch (e) {
      setErro('Erro ao salvar.');
      setOcupado(false);
    }
  }

  async function apagar() {
    if (!confirmar) return setConfirmar(true);
    setOcupado(true);
    try {
      await onApagar();
    } catch (e) {
      setErro('Erro ao apagar.');
      setOcupado(false);
    }
  }

  return (
    <Modal transparent animationType="fade" onRequestClose={onFechar}>
      <View style={estFicha.fundo}>
        <View style={estFicha.modal}>
          {/* cabeçalho */}
          <View style={estFicha.topo}>
            <TokenMini item={f} tamanho={46} />
            <View style={{ flex: 1 }}>
              <Text style={estFicha.etiqueta}>{titulo || 'Ficha Vortex'}</Text>
              {ro ? (
                <Text style={estFicha.nomeRO}>{f.nome}</Text>
              ) : (
                <TextInput style={estFicha.nome} value={f.nome} onChangeText={(t) => set('nome', t)} placeholder="Nome" placeholderTextColor={C.suave} />
              )}
            </View>
            <TouchableOpacity onPress={onFechar}>
              <Icone name="close" size={22} color={C.suave} />
            </TouchableOpacity>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled">
            {ro ? (
              !!f.conceito && <Text style={estFicha.conceitoRO}>{f.conceito}</Text>
            ) : (
              <TextInput
                style={estFicha.input}
                value={f.conceito}
                onChangeText={(t) => set('conceito', t)}
                placeholder="Conceito (ex.: guerreira exilada do norte)"
                placeholderTextColor={C.suave}
              />
            )}

            {/* token */}
            <Text style={estFicha.secao}>Token (visual na mesa)</Text>
            <View style={estFicha.linhaWrap}>
              {TIPOS.map((t) => (
                <TouchableOpacity key={t} disabled={ro} onPress={() => set('tipo', t)} style={[estFicha.chip, f.tipo === t && estFicha.chipAtivo]}>
                  <Icone name={ICONE_CATEGORIA[t]} size={13} color={f.tipo === t ? '#fff' : C.suave} />
                  <Text style={[estFicha.chipTxt, f.tipo === t && { color: '#fff' }]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={[estFicha.linhaWrap, { marginTop: 8 }]}>
              {[1, 2, 3, 4].map((t) => (
                <TouchableOpacity key={t} disabled={ro} onPress={() => set('tamanho', t)} style={[estFicha.chip, f.tamanho === t && estFicha.chipAtivo]}>
                  <Text style={[estFicha.chipTxt, f.tamanho === t && { color: '#fff' }]}>{t}×{t}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {!ro && (
              <>
                <View style={[estFicha.linhaWrap, { marginTop: 8 }]}>
                  {CORES.map((c) => (
                    <TouchableOpacity key={c} onPress={() => set('cor', c)} style={[estFicha.cor, { backgroundColor: c }, f.cor === c && estFicha.corSel]} />
                  ))}
                </View>
                <View style={{ marginTop: 10 }}>
                  <CampoImagem valor={f.img} onMudar={(ref) => set('img', ref)} largura={256} rotulo="Imagem do token" redondo />
                </View>
              </>
            )}
            {!!pastas && !ro && <CampoPasta valor={f.pasta || ''} pastas={pastas} onMudar={(v) => set('pasta', v)} />}

            {/* atributos (ficha) */}
            <Text style={[estFicha.secao, { color: C.destaque2, marginTop: 18 }]}>Ficha Vortex</Text>
            {/* atributos */}
            <Text style={estFicha.secao}>Atributos</Text>
            <View style={estFicha.linhaWrap}>
              {ATRIBUTOS.map(([k, rot, ic]) => (
                <View key={k} style={[estFicha.attr, rolAttr === k && estFicha.attrSel]}>
                  <TouchableOpacity onPress={() => setRolAttr(k)} style={estFicha.attrCab}>
                    <Icone name={ic} size={14} color={rolAttr === k ? C.destaque2 : C.suave} />
                    <Text style={[estFicha.attrNome, rolAttr === k && { color: C.destaque2 }]}>{rot}</Text>
                  </TouchableOpacity>
                  <Contador valor={f[k] || 0} onMudar={(v) => set(k, v)} travado={ro} />
                </View>
              ))}
            </View>

            {/* perícias */}
            <Text style={estFicha.secao}>Perícias</Text>
            {f.pericias.length === 0 && <Text style={estFicha.vazio}>Nenhuma perícia.</Text>}
            {f.pericias.map((p, i) => (
              <View key={i} style={[estFicha.linhaItem, rolPer === i && estFicha.linhaSel]}>
                <TouchableOpacity onPress={() => setRolPer(rolPer === i ? -1 : i)} style={{ padding: 2 }}>
                  <Icone name={rolPer === i ? 'checkbox-marked-circle' : 'checkbox-blank-circle-outline'} size={18} color={rolPer === i ? C.destaque2 : C.suave} />
                </TouchableOpacity>
                {ro ? (
                  <Text style={[estFicha.itemTxt, { flex: 1 }]}>{p.nome}</Text>
                ) : (
                  <TextInput style={[estFicha.inputMini, { flex: 1 }]} value={p.nome} onChangeText={(t) => setLista('pericias', i, 'nome', t)} placeholder="Perícia" placeholderTextColor={C.suave} />
                )}
                <Contador valor={p.valor || 0} onMudar={(v) => setLista('pericias', i, 'valor', v)} max={5} travado={ro} />
                {!ro && (
                  <TouchableOpacity onPress={() => removerDaLista('pericias', i)} style={{ padding: 4 }}>
                    <Icone name="close" size={16} color={C.suave} />
                  </TouchableOpacity>
                )}
              </View>
            ))}
            {!ro && (
              <TouchableOpacity style={estFicha.add} onPress={() => set('pericias', [...f.pericias, { nome: '', valor: 1 }])}>
                <Icone name="plus" size={14} color={C.destaque2} />
                <Text style={estFicha.addTxt}>Perícia</Text>
              </TouchableOpacity>
            )}

            {/* rolagem */}
            <View style={estFicha.rolador}>
              <TouchableOpacity style={estFicha.btnRolar} onPress={rolar}>
                <Icone name="dice-multiple" size={20} color="#fff" />
                <Text style={estFicha.btnRolarTxt}>Rolar 2d6</Text>
              </TouchableOpacity>
              <View style={{ flex: 1 }}>
                <Text style={estFicha.rolTxt}>
                  + {ATRIBUTOS.find((x) => x[0] === rolAttr)[1]} ({f[rolAttr] || 0})
                  {rolPer >= 0 && f.pericias[rolPer] ? ` + ${f.pericias[rolPer].nome || 'perícia'} (${f.pericias[rolPer].valor || 0})` : ''}
                </Text>
                {resultado && (
                  <Text style={estFicha.rolRes}>
                    [{resultado.a}+{resultado.b}] + {resultado.attr}
                    {resultado.per ? ` + ${resultado.per.valor || 0}` : ''} = <Text style={estFicha.rolTotal}>{resultado.total}</Text>
                  </Text>
                )}
              </View>
            </View>

            {/* recursos */}
            <Text style={estFicha.secao}>Recursos</Text>
            {f.recursos.map((r, i) => (
              <View key={i} style={estFicha.linhaItem}>
                {ro ? (
                  <Text style={[estFicha.itemTxt, { flex: 1 }]}>{r.nome}</Text>
                ) : (
                  <TextInput style={[estFicha.inputMini, { flex: 1 }]} value={r.nome} onChangeText={(t) => setLista('recursos', i, 'nome', t)} placeholder="Recurso" placeholderTextColor={C.suave} />
                )}
                <Contador valor={parseInt(r.atual, 10) || 0} onMudar={(v) => setLista('recursos', i, 'atual', v)} max={999} travado={ro} />
                <Text style={estFicha.barra}>/</Text>
                {ro ? (
                  <Text style={estFicha.itemTxt}>{r.max}</Text>
                ) : (
                  <TextInput
                    style={[estFicha.inputMini, { width: 46, textAlign: 'center' }]}
                    value={String(r.max)}
                    onChangeText={(t) => setLista('recursos', i, 'max', t.replace(/[^0-9]/g, ''))}
                    keyboardType="numeric"
                  />
                )}
                {!ro && (
                  <TouchableOpacity onPress={() => removerDaLista('recursos', i)} style={{ padding: 4 }}>
                    <Icone name="close" size={16} color={C.suave} />
                  </TouchableOpacity>
                )}
              </View>
            ))}
            {!ro && (
              <TouchableOpacity style={estFicha.add} onPress={() => set('recursos', [...f.recursos, { nome: '', atual: 5, max: 5 }])}>
                <Icone name="plus" size={14} color={C.destaque2} />
                <Text style={estFicha.addTxt}>Recurso</Text>
              </TouchableOpacity>
            )}

            {/* notas */}
            <Text style={estFicha.secao}>Notas</Text>
            {ro ? (
              <Text style={estFicha.notasRO}>{f.descricao || '—'}</Text>
            ) : (
              <TextInput
                style={[estFicha.input, { minHeight: 64, textAlignVertical: 'top' }]}
                value={f.descricao}
                onChangeText={(t) => set('descricao', t)}
                multiline
                placeholder="Equipamento, história, observações..."
                placeholderTextColor={C.suave}
              />
            )}
            {!!f.autor && <Text style={estFicha.autor}>Cadastrado por {f.autor}</Text>}
          </ScrollView>

          {!!erro && <Text style={{ color: C.perigo, marginTop: 6 }}>{erro}</Text>}
          <View style={estFicha.acoes}>
            {!!onApagar && !ro && (
              <TouchableOpacity style={[estFicha.btn, estFicha.btnPerigo]} onPress={apagar} disabled={ocupado}>
                <Text style={{ color: C.perigo, fontWeight: '700' }}>{confirmar ? 'Confirmar?' : 'Excluir'}</Text>
              </TouchableOpacity>
            )}
            {!!acaoExtra && (
              <TouchableOpacity style={[estFicha.btn, estFicha.btnSec]} onPress={acaoExtra.onPress} disabled={ocupado || acaoExtra.desativado}>
                <Icone name={acaoExtra.icone} size={16} color={C.destaque2} />
                <Text style={{ color: C.destaque2, fontWeight: '700' }}>{acaoExtra.rotulo}</Text>
              </TouchableOpacity>
            )}
            {!ro && (
              <TouchableOpacity style={[estFicha.btn, estFicha.btnPrim]} onPress={salvar} disabled={ocupado}>
                {ocupado ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '700' }}>Salvar</Text>}
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const estFicha = StyleSheet.create({
  fundo: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', alignItems: 'center', padding: 12 },
  modal: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '94%',
    backgroundColor: C.painel,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.borda,
    padding: 14,
  },
  topo: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  etiqueta: { color: C.destaque2, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  nome: { color: C.texto, fontSize: 18, fontWeight: '800', borderBottomWidth: 1, borderColor: C.borda, paddingVertical: 2 },
  nomeRO: { color: C.texto, fontSize: 18, fontWeight: '800' },
  conceitoRO: { color: C.suave, fontStyle: 'italic', marginBottom: 6 },
  secao: { color: C.suave, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', marginTop: 12, marginBottom: 6 },
  input: {
    backgroundColor: C.painel2,
    borderWidth: 1,
    borderColor: C.borda,
    color: C.texto,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  inputMini: {
    backgroundColor: C.painel2,
    borderWidth: 1,
    borderColor: C.borda,
    color: C.texto,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    fontSize: 13,
  },
  linhaWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  attr: { flex: 1, minWidth: 110, backgroundColor: C.painel2, borderRadius: 10, padding: 8, alignItems: 'center', borderWidth: 1, borderColor: 'transparent' },
  attrSel: { borderColor: C.destaque2 },
  attrCab: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  attrNome: { color: C.suave, fontSize: 12, fontWeight: '700' },
  contador: { alignItems: 'center' },
  contRot: { color: C.suave, fontSize: 11 },
  contLinha: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  contBtn: { width: 24, height: 24, borderRadius: 12, borderWidth: 1, borderColor: C.borda, alignItems: 'center', justifyContent: 'center' },
  contValor: { color: C.texto, fontWeight: '800', fontSize: 16, minWidth: 18, textAlign: 'center' },
  linhaItem: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4, paddingHorizontal: 4, borderRadius: 8 },
  linhaSel: { backgroundColor: 'rgba(34,211,238,0.1)' },
  itemTxt: { color: C.texto, fontSize: 14 },
  barra: { color: C.suave },
  vazio: { color: C.suave, fontSize: 12, fontStyle: 'italic' },
  add: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingVertical: 6 },
  addTxt: { color: C.destaque2, fontSize: 13, fontWeight: '700' },
  rolador: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: C.bg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.destaque,
    padding: 10,
    marginTop: 10,
  },
  btnRolar: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.destaque, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9 },
  btnRolarTxt: { color: '#fff', fontWeight: '800' },
  rolTxt: { color: C.suave, fontSize: 12 },
  rolRes: { color: C.texto, fontSize: 14, marginTop: 2 },
  rolTotal: { color: C.destaque2, fontWeight: '900', fontSize: 20 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.borda,
  },
  chipAtivo: { backgroundColor: C.destaque, borderColor: C.destaque },
  chipTxt: { color: C.suave, fontSize: 12, fontWeight: '600' },
  cor: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: 'transparent' },
  corSel: { borderColor: '#fff' },
  notasRO: { color: C.texto, fontSize: 13 },
  autor: { color: C.suave, fontSize: 11, fontStyle: 'italic', marginTop: 8 },
  acoes: { flexDirection: 'row', gap: 8, marginTop: 12 },
  btn: { flex: 1, flexDirection: 'row', gap: 6, borderRadius: 10, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  btnPrim: { backgroundColor: C.destaque },
  btnSec: { borderWidth: 1, borderColor: C.destaque2 },
  btnPerigo: { borderWidth: 1, borderColor: C.perigo },
});

// ================================================================
// src/utils/masmorra.js
// ================================================================
// Mapas em células (estilo "dungeon maker").
// Cada célula é um caractere:
//   '.' vazio (rocha)   '#' chão   '~' água   ',' terra   '^' lava   'D' porta   'S' escada
// Tudo que não é '.' conta como piso (as paredes são desenhadas na borda entre piso e vazio).

const VAZIO = '.';
const TERRENOS = [
  { id: '#', nome: 'Chão', icone: 'square' },
  { id: ',', nome: 'Terra', icone: 'grass' },
  { id: '~', nome: 'Água', icone: 'water' },
  { id: '^', nome: 'Lava', icone: 'fire' },
];
const ehPiso = (c) => !!c && c !== VAZIO;

// gerador pseudoaleatório com semente (mesma semente = mesmo mapa)
function aleatorio(semente) {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const entre = (r, min, max) => min + Math.floor(r() * (max - min + 1));

const gradeVazia = (cols, rows) => Array.from({ length: rows }, () => Array(cols).fill(VAZIO));
const paraLinhas = (g) => g.map((l) => l.join(''));
const deLinhas = (linhas) => linhas.map((l) => l.split(''));
const copiarGrade = (g) => g.map((l) => l.slice());

function preencherRet(g, x0, y0, x1, y1, c) {
  const rows = g.length;
  const cols = g[0].length;
  for (let y = Math.max(0, Math.min(y0, y1)); y <= Math.min(rows - 1, Math.max(y0, y1)); y++)
    for (let x = Math.max(0, Math.min(x0, x1)); x <= Math.min(cols - 1, Math.max(x0, x1)); x++) g[y][x] = c;
}

function pintar(g, cx, cy, raio, c) {
  preencherRet(g, cx - raio, cy - raio, cx + raio, cy + raio, c);
}

// ---------- gerador: masmorra (salas + corredores) ----------
function gerarMasmorra(cols, rows, semente, { salas = 9, portas = true } = {}) {
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
function gerarCaverna(cols, rows, semente, opcoes = {}) {
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
function gerarLabirinto(cols, rows, semente) {
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

const GERADORES = [
  { id: 'masmorra', nome: 'Masmorra', icone: 'castle', gerar: gerarMasmorra },
  { id: 'caverna', nome: 'Caverna', icone: 'terrain', gerar: gerarCaverna },
  { id: 'labirinto', nome: 'Labirinto', icone: 'puzzle-outline', gerar: gerarLabirinto },
];

// ================================================================
// src/components/MapaTiles.js
// ================================================================
// Desenha um mapa de células (criador de mapas) dentro de um <Svg>:
// piso com texturas por terreno, hachura e sombra nas paredes automáticas, grade no chão, portas e escadas.

const TEMAS_MAPA = {
  pedra: { nome: 'Pedra', fundo: '#24212c', chao: '#d6cfc0', parede: '#0d0b12', sombra: '#000000', grade: '#000000', gradeOp: 0.12, hachura: '#6b6478' },
  pergaminho: { nome: 'Pergaminho', fundo: '#e9dcc1', chao: '#fffaf0', parede: '#2d2418', sombra: '#7a6648', grade: '#2d2418', gradeOp: 0.15, hachura: '#2d2418' },
  caverna: { nome: 'Caverna', fundo: '#1b1712', chao: '#8b7a60', parede: '#0b0907', sombra: '#000000', grade: '#000000', gradeOp: 0.12, hachura: '#5a4c38' },
  floresta: { nome: 'Floresta', fundo: '#24391f', chao: '#b49a68', parede: '#142012', sombra: '#000000', grade: '#000000', gradeOp: 0.1, hachura: '#4d6b41' },
  scifi: { nome: 'Sci-fi', fundo: '#060912', chao: '#1d2740', parede: '#22d3ee', sombra: '#22d3ee', grade: '#22d3ee', gradeOp: 0.18, hachura: '#22d3ee' },
};
const COR_TERRENO = { ',': '#9a7b4f', '~': '#3b82f6', '^': '#ef4444' };

// junta segmentos colineares: mapa linha -> lista de [inicio, fim]
function juntar(segs) {
  const out = [];
  Object.keys(segs).forEach((k) => {
    const l = segs[k].sort((a, b) => a - b);
    let ini = l[0];
    let fim = l[0] + 1;
    for (let i = 1; i < l.length; i++) {
      if (l[i] === fim) fim++;
      else {
        out.push([Number(k), ini, fim]);
        ini = l[i];
        fim = l[i] + 1;
      }
    }
    if (l.length) out.push([Number(k), ini, fim]);
  });
  return out;
}

function calcularDesenho(linhas, cel) {
  const rows = linhas.length;
  const cols = rows ? linhas[0].length : 0;
  const at = (x, y) => (y < 0 || x < 0 || y >= rows || x >= cols ? VAZIO : linhas[y][x]);
  const pisos = {}; // cor -> d
  const paredeH = {};
  const paredeV = {};
  const gradeH = {};
  const gradeV = {};
  const portas = [];
  const escadas = [];

  for (let y = 0; y < rows; y++) {
    // piso em "corridas" horizontais de mesma cor
    let x = 0;
    while (x < cols) {
      const c = linhas[y][x];
      if (!ehPiso(c)) {
        x++;
        continue;
      }
      const chaveDe = (ch) => (COR_TERRENO[ch] ? ch : 'chao');
      const chave = chaveDe(c);
      let fim = x + 1;
      while (fim < cols && ehPiso(linhas[y][fim]) && chaveDe(linhas[y][fim]) === chave) fim++;
      pisos[chave] = (pisos[chave] || '') + `M${x * cel} ${y * cel}h${(fim - x) * cel}v${cel}h${-(fim - x) * cel}z`;
      x = fim;
    }
    for (let xx = 0; xx < cols; xx++) {
      const c = linhas[y][xx];
      if (!ehPiso(c)) continue;
      if (c === 'D') portas.push([xx, y, !ehPiso(at(xx - 1, y)) && !ehPiso(at(xx + 1, y))]);
      if (c === 'S') escadas.push([xx, y]);
      // bordas: parede se o vizinho não é piso; linha de grade se é piso
      if (!ehPiso(at(xx, y - 1))) (paredeH[y] = paredeH[y] || []).push(xx);
      else (gradeH[y] = gradeH[y] || []).push(xx);
      if (!ehPiso(at(xx, y + 1))) (paredeH[y + 1] = paredeH[y + 1] || []).push(xx);
      if (!ehPiso(at(xx - 1, y))) (paredeV[xx] = paredeV[xx] || []).push(y);
      else (gradeV[xx] = gradeV[xx] || []).push(y);
      if (!ehPiso(at(xx + 1, y))) (paredeV[xx + 1] = paredeV[xx + 1] || []).push(y);
    }
  }
  const linhasH = (m) => juntar(m).map(([y, a, b]) => `M${a * cel} ${y * cel}H${b * cel}`).join('');
  const linhasV = (m) => juntar(m).map(([x, a, b]) => `M${x * cel} ${a * cel}V${b * cel}`).join('');
  return {
    largura: cols * cel,
    altura: rows * cel,
    pisos,
    paredes: linhasH(paredeH) + linhasV(paredeV),
    grade: linhasH(gradeH) + linhasV(gradeV),
    portas,
    escadas,
  };
}

let contadorPadrao = 0;

// Texturas (padrões SVG do tamanho de uma célula), no estilo do Dungeondraft
function Padrao({ id, cel, tipo, cor, tinta }) {
  const c = cel;
  let desenho = null;
  if (tipo === 'lajota')
    desenho = <Path d={`M0 ${c / 2}H${c}M${c / 2} 0V${c / 2}M0 ${c}H${c}M${c * 0.15} ${c / 2}V${c}M${c * 0.75} ${c / 2}V${c}`} stroke={tinta} strokeOpacity={0.16} strokeWidth={c * 0.03} />;
  if (tipo === 'pedregulho')
    desenho = (
      <G fill={tinta} fillOpacity={0.13}>
        <Circle cx={c * 0.25} cy={c * 0.3} r={c * 0.08} />
        <Circle cx={c * 0.7} cy={c * 0.2} r={c * 0.05} />
        <Circle cx={c * 0.55} cy={c * 0.7} r={c * 0.1} />
        <Circle cx={c * 0.15} cy={c * 0.8} r={c * 0.04} />
      </G>
    );
  if (tipo === 'grama')
    desenho = <Path d={`M${c * 0.2} ${c * 0.35}l${c * 0.04} ${-c * 0.1}M${c * 0.65} ${c * 0.25}l${-c * 0.04} ${-c * 0.1}M${c * 0.45} ${c * 0.75}l${c * 0.04} ${-c * 0.1}M${c * 0.85} ${c * 0.7}l${-c * 0.03} ${-c * 0.09}`} stroke={tinta} strokeOpacity={0.35} strokeWidth={c * 0.03} strokeLinecap="round" />;
  if (tipo === 'placas')
    desenho = <Rect x={c * 0.06} y={c * 0.06} width={c * 0.88} height={c * 0.88} fill="none" stroke={tinta} strokeOpacity={0.35} strokeWidth={c * 0.03} />;
  if (tipo === 'terra')
    desenho = (
      <G fill={tinta} fillOpacity={0.25}>
        <Circle cx={c * 0.2} cy={c * 0.25} r={c * 0.035} />
        <Circle cx={c * 0.6} cy={c * 0.45} r={c * 0.03} />
        <Circle cx={c * 0.35} cy={c * 0.75} r={c * 0.04} />
        <Circle cx={c * 0.85} cy={c * 0.85} r={c * 0.025} />
      </G>
    );
  if (tipo === 'agua')
    desenho = <Path d={`M${c * 0.1} ${c * 0.35}q${c * 0.1} ${-c * 0.08} ${c * 0.2} 0t${c * 0.2} 0M${c * 0.45} ${c * 0.75}q${c * 0.1} ${-c * 0.08} ${c * 0.2} 0t${c * 0.2} 0`} stroke="#ffffff" strokeOpacity={0.35} strokeWidth={c * 0.035} fill="none" strokeLinecap="round" />;
  if (tipo === 'lava')
    desenho = <Path d={`M0 ${c * 0.3}L${c * 0.3} ${c * 0.45}L${c * 0.5} ${c * 0.2}L${c} ${c * 0.4}M${c * 0.2} ${c}L${c * 0.45} ${c * 0.65}L${c * 0.8} ${c * 0.8}`} stroke="#fde047" strokeOpacity={0.55} strokeWidth={c * 0.04} fill="none" />;
  return (
    <Pattern id={id} patternUnits="userSpaceOnUse" x={0} y={0} width={c} height={c}>
      <Rect x={0} y={0} width={c} height={c} fill={cor} />
      {desenho}
    </Pattern>
  );
}

const TEXTURA_CHAO = { pedra: 'lajota', pergaminho: 'lajota', caverna: 'pedregulho', floresta: 'grama', scifi: 'placas' };
const TEXTURA_TERRENO = { ',': 'terra', '~': 'agua', '^': 'lava' };

function MapaTilesSvg({ linhas, cel, tema = 'pedra', mostrarGrade = true, textura = true, x = 0, y = 0 }) {
  const t = TEMAS_MAPA[tema] || TEMAS_MAPA.pedra;
  const chave = (linhas || []).join('|');
  const d = useMemo(() => calcularDesenho(linhas || [], cel), [chave, cel]);
  const pref = useMemo(() => `mt${++contadorPadrao}`, []);
  const esp = cel * 0.14;
  const tinta = tema === 'scifi' ? t.parede : '#000000';
  const fillDe = (k) => {
    if (!textura) return k === 'chao' ? t.chao : COR_TERRENO[k];
    return `url(#${pref}_${k === 'chao' ? 'chao' : TEXTURA_TERRENO[k]})`;
  };
  return (
    <G transform={x || y ? `translate(${x} ${y})` : undefined}>
      {textura && (
        <Defs>
          <Padrao id={`${pref}_chao`} cel={cel} tipo={TEXTURA_CHAO[tema] || 'lajota'} cor={t.chao} tinta={tinta} />
          <Padrao id={`${pref}_terra`} cel={cel} tipo="terra" cor={COR_TERRENO[',']} tinta="#000000" />
          <Padrao id={`${pref}_agua`} cel={cel} tipo="agua" cor={COR_TERRENO['~']} tinta="#ffffff" />
          <Padrao id={`${pref}_lava`} cel={cel} tipo="lava" cor={COR_TERRENO['^']} tinta="#000000" />
          <Pattern id={`${pref}_hachura`} patternUnits="userSpaceOnUse" x={0} y={0} width={cel * 0.22} height={cel * 0.22}>
            <Path d={`M0 ${cel * 0.22}L${cel * 0.22} 0`} stroke={t.hachura || t.parede} strokeOpacity={0.8} strokeWidth={cel * 0.03} />
          </Pattern>
        </Defs>
      )}
      <Rect x={0} y={0} width={d.largura} height={d.altura} fill={t.fundo} />
      {/* hachura do lado de fora das paredes (fica escondida pelo piso do lado de dentro) */}
      {textura && !!d.paredes && <Path d={d.paredes} stroke={`url(#${pref}_hachura)`} strokeWidth={cel * 0.9} strokeLinecap="round" fill="none" />}
      {Object.keys(d.pisos).map((k) => (
        <Path key={k} d={d.pisos[k]} fill={fillDe(k)} />
      ))}
      {/* bordas suaves entre terrenos */}
      {Object.keys(d.pisos)
        .filter((k) => k !== 'chao')
        .map((k) => (
          <Path key={'b' + k} d={d.pisos[k]} fill="none" stroke={COR_TERRENO[k]} strokeOpacity={0.45} strokeWidth={cel * 0.22} strokeLinejoin="round" />
        ))}
      {mostrarGrade && !!d.grade && <Path d={d.grade} stroke={t.grade} strokeOpacity={t.gradeOp} strokeWidth={Math.max(0.5, cel * 0.02)} fill="none" />}
      {!!d.paredes && <Path d={d.paredes} stroke={t.sombra} strokeOpacity={0.3} strokeWidth={esp * 2.6} strokeLinecap="square" fill="none" />}
      {!!d.paredes && <Path d={d.paredes} stroke={t.parede} strokeWidth={esp} strokeLinecap="square" fill="none" />}
      {d.portas.map(([px, py, vertical]) => (
        <Rect
          key={`p${px}_${py}`}
          x={px * cel + (vertical ? cel * 0.1 : cel * 0.38)}
          y={py * cel + (vertical ? cel * 0.38 : cel * 0.1)}
          width={vertical ? cel * 0.8 : cel * 0.24}
          height={vertical ? cel * 0.24 : cel * 0.8}
          fill="#8b5a2b"
          stroke={t.parede}
          strokeWidth={esp * 0.5}
        />
      ))}
      {d.escadas.map(([sx, sy]) => (
        <Path
          key={`s${sx}_${sy}`}
          d={[0.2, 0.4, 0.6, 0.8].map((f) => `M${sx * cel + cel * 0.15} ${sy * cel + cel * f}H${sx * cel + cel * 0.85}`).join('')}
          stroke={t.parede}
          strokeWidth={esp * 0.6}
        />
      ))}
    </G>
  );
}

// ================================================================
// src/components/AssetMini.js
// ================================================================
// ---------- miniatura de qualquer asset ----------
function AssetMini({ asset, tamanho = 46 }) {
  const src = useImagem(asset.tipo === 'objeto' || asset.tipo === 'mapa' ? asset.img : '');
  if (asset.tipo === 'personagem') return <TokenMini item={asset} tamanho={tamanho} />;
  const tiles = asset.tipo === 'mapa' && !asset.img && (asset.itens || []).find((i) => i.type === 'tiles');
  if (tiles) {
    const cel = tamanho / Math.max(tiles.cols || 1, tiles.rows || 1);
    return (
      <View style={{ width: tamanho, height: tamanho, borderRadius: 10, overflow: 'hidden', backgroundColor: C.painel2, alignItems: 'center', justifyContent: 'center' }}>
        <Svg width={(tiles.cols || 1) * cel} height={(tiles.rows || 1) * cel}>
          <MapaTilesSvg linhas={tiles.linhas} cel={cel} tema={tiles.tema} mostrarGrade={false} />
        </Svg>
      </View>
    );
  }
  const caixaMini = {
    width: tamanho,
    height: tamanho,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: C.painel2,
    borderWidth: 1,
    borderColor: C.borda,
  };
  if (src) {
    return (
      <View style={caixaMini}>
        <Image source={{ uri: src }} style={{ width: tamanho, height: tamanho }} resizeMode="cover" />
      </View>
    );
  }
  if (asset.tipo === 'objeto') {
    return (
      <View style={caixaMini}>
        <Text style={{ fontSize: tamanho * 0.55 }}>{asset.emoji || '❔'}</Text>
      </View>
    );
  }
  return (
    <View style={[caixaMini, { backgroundColor: asset.tipo === 'estrutura' ? 'rgba(34,211,238,0.15)' : 'rgba(139,92,246,0.2)' }]}>
      <Icone name={asset.tipo === 'estrutura' ? 'home-city-outline' : 'map-outline'} size={tamanho * 0.5} color={asset.tipo === 'estrutura' ? C.destaque2 : C.destaque} />
    </View>
  );
}

// ================================================================
// src/components/ModalNome.js
// ================================================================
// ---------- modal simples de nome (salvar estrutura / mapa / renomear) ----------
function ModalNome({ titulo, valorInicial = '', rotuloBotao = 'Salvar', detalhe, onConfirmar, onFechar, onExcluir }) {
  const [nome, setNome] = useState(valorInicial);
  const [confirmar, setConfirmar] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState('');
  async function ok() {
    if (nome.trim().length < 2) return setErro('Digite um nome.');
    setOcupado(true);
    try {
      await onConfirmar(nome.trim());
    } catch (e) {
      setErro(e.message || 'Erro ao salvar.');
      setOcupado(false);
    }
  }
  return (
    <Modal transparent animationType="fade" onRequestClose={onFechar}>
      <View style={estModalNome.fundo}>
        <View style={[estModalNome.modal, { maxWidth: 380 }]}>
          <Text style={estModalNome.titulo}>{titulo}</Text>
          {!!detalhe && <Text style={{ color: C.suave, fontSize: 12, marginTop: 4 }}>{detalhe}</Text>}
          <TextInput style={[estModalNome.input, { marginTop: 12 }]} value={nome} onChangeText={setNome} autoFocus onSubmitEditing={ok} placeholder="Nome" placeholderTextColor={C.suave} />
          {!!erro && <Text style={{ color: C.perigo, marginTop: 6 }}>{erro}</Text>}
          <View style={estModalNome.acoes}>
            {onExcluir ? (
              <TouchableOpacity
                style={[estModalNome.btn, { borderWidth: 1, borderColor: C.perigo }]}
                onPress={() => (confirmar ? onExcluir() : setConfirmar(true))}
              >
                <Text style={{ color: C.perigo, fontWeight: '700' }}>{confirmar ? 'Confirmar?' : 'Excluir'}</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={[estModalNome.btn, { borderWidth: 1, borderColor: C.borda }]} onPress={onFechar}>
                <Text style={{ color: C.suave, fontWeight: '700' }}>Cancelar</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={[estModalNome.btn, { backgroundColor: C.destaque }]} onPress={ok} disabled={ocupado}>
              {ocupado ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '700' }}>{rotuloBotao}</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}


const estModalNome = StyleSheet.create({
  fundo: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', alignItems: 'center', padding: 14 },
  modal: { width: '100%', maxWidth: 460, maxHeight: '92%', backgroundColor: C.painel, borderRadius: 16, borderWidth: 1, borderColor: C.borda, padding: 16 },
  topo: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  titulo: { color: C.texto, fontWeight: '800', fontSize: 17, flex: 1 },
  rotulo: { color: C.suave, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', marginTop: 12, marginBottom: 6 },
  rotMini: { color: C.suave, fontSize: 12, width: 60 },
  input: { backgroundColor: C.painel2, borderWidth: 1, borderColor: C.borda, color: C.texto, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 },
  emojis: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 6 },
  emoji: { width: 40, height: 40, borderRadius: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'transparent' },
  emojiSel: { borderColor: C.destaque2, backgroundColor: 'rgba(34,211,238,0.12)' },
  linha: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  chip: { minWidth: 34, height: 30, borderRadius: 8, borderWidth: 1, borderColor: C.borda, alignItems: 'center', justifyContent: 'center' },
  chipAtivo: { borderColor: C.destaque, backgroundColor: 'rgba(139,92,246,0.3)' },
  chipTxt: { color: C.texto, fontWeight: '700' },
  acoes: { flexDirection: 'row', gap: 8, marginTop: 14 },
  btn: { flex: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
});

// ================================================================
// src/data/constantes.js
// ================================================================
// Tipos de asset, nichos de packs e ícones (emojis) para objetos
const TIPOS_ASSET = [
  { id: 'personagem', nome: 'Personagens', icone: 'account-group-outline' },
  { id: 'objeto', nome: 'Cenário', icone: 'pine-tree' },
  { id: 'estrutura', nome: 'Estruturas', icone: 'home-city-outline' },
  { id: 'mapa', nome: 'Mapas', icone: 'map-outline' },
];
const NOME_TIPO_ASSET = { personagem: 'Personagem', objeto: 'Cenário', estrutura: 'Estrutura', mapa: 'Mapa' };

const NICHOS = [
  { id: 'Fantasia', icone: 'sword' },
  { id: 'Masmorra', icone: 'castle' },
  { id: 'Natureza', icone: 'pine-tree' },
  { id: 'Cidade', icone: 'home-city' },
  { id: 'Sci-fi', icone: 'rocket-launch-outline' },
  { id: 'Horror', icone: 'ghost-outline' },
];
const ICONE_NICHO = Object.fromEntries(NICHOS.map((n) => [n.id, n.icone]));

const EMOJIS = [
  '🌲', '🌳', '🌴', '🌵', '🌿', '🍄', '🪨', '🪵', '🔥', '⛺',
  '🚪', '🧰', '💀', '🕯️', '⛓️', '🗿', '🕳️', '⚰️', '🛢️', '📦',
  '🪑', '🛏️', '🍺', '🍖', '📜', '💎', '🗡️', '🛡️', '🏹', '⚗️',
  '🐎', '🛶', '⛲', '🏛️', '🧱', '🪜', '🚀', '🤖', '👻', '🕸️',
];

// ================================================================
// src/mesa/ConfigMesa.js
// ================================================================
function ConfigMesa({ visivel, sala, codigo, autor, onSalvar, onFechar }) {
  const [f, setF] = useState(null);
  const [msg, setMsg] = useState('');

  // carrega os valores atuais sempre que abrir
  const dados = f || {
    nome: sala.nome || '',
    mapUrl: sala.mapUrl || '',
    mapW: String(sala.mapW || 1400),
    mapH: String(sala.mapH || 1000),
  };
  const set = (k, v) => setF({ ...dados, [k]: v });

  const salvar = () => {
    onSalvar({
      nome: dados.nome.trim() || sala.nome,
      mapUrl: (dados.mapUrl || '').trim(),
      mapW: Math.max(100, parseInt(dados.mapW, 10) || 1400),
      mapH: Math.max(100, parseInt(dados.mapH, 10) || 1000),
    });
    fechar();
  };

  const fechar = () => {
    setF(null);
    setMsg('');
    onFechar();
  };

  return (
    <Modal visible={visivel} transparent animationType="fade" onRequestClose={fechar}>
      <View style={estConfigMesa.fundo}>
        <View style={estConfigMesa.caixa}>
          <View style={estConfigMesa.cabeca}>
            <Icone name="cog-outline" size={20} color={C.destaque} />
            <Text style={estConfigMesa.titulo}>Configurar mesa</Text>
            <TouchableOpacity onPress={fechar}>
              <Icone name="close" size={20} color={C.suave} />
            </TouchableOpacity>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={estConfigMesa.codigo}>Código para os jogadores: <Text style={{ color: C.destaque2 }}>{codigo}</Text></Text>

            <Text style={estConfigMesa.rotulo}>Nome da mesa</Text>
            <TextInput style={estConfigMesa.input} value={dados.nome} onChangeText={(t) => set('nome', t)} />

            <CampoImagem
              valor={dados.mapUrl}
              largura={1600}
              autor={autor}
              rotulo="Imagem de fundo do mapa"
              onMudar={(ref, dim) => {
                setF({
                  ...dados,
                  mapUrl: ref,
                  ...(dim && dim.w ? { mapW: String(Math.round(dim.w)), mapH: String(Math.round(dim.h)) } : {}),
                });
                setMsg(dim && dim.w ? `Tamanho ajustado à imagem: ${Math.round(dim.w)} × ${Math.round(dim.h)}px` : '');
              }}
            />
            {!!msg && <Text style={[estConfigMesa.msg, { marginTop: 6 }]}>{msg}</Text>}

            <View style={[estConfigMesa.linha, { marginTop: 12 }]}>
              <View style={{ flex: 1 }}>
                <Text style={estConfigMesa.rotulo}>Largura</Text>
                <TextInput style={estConfigMesa.input} value={dados.mapW} onChangeText={(t) => set('mapW', t)} keyboardType="numeric" />
              </View>
              <View style={{ width: 10 }} />
              <View style={{ flex: 1 }}>
                <Text style={estConfigMesa.rotulo}>Altura</Text>
                <TextInput style={estConfigMesa.input} value={dados.mapH} onChangeText={(t) => set('mapH', t)} keyboardType="numeric" />
              </View>
            </View>
            <Text style={estConfigMesa.msg}>A grade (tipo, tamanho, cor, infinita) fica na aba Grade da mesa.</Text>
          </ScrollView>

          <TouchableOpacity style={estConfigMesa.btn} onPress={salvar}>
            <Text style={estConfigMesa.btnTxt}>Salvar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const estConfigMesa = StyleSheet.create({
  fundo: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  caixa: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '90%',
    backgroundColor: C.painel,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.borda,
    padding: 18,
  },
  cabeca: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  titulo: { color: C.texto, fontWeight: '700', fontSize: 17, flex: 1 },
  codigo: { color: C.suave, marginBottom: 14 },
  rotulo: { color: C.suave, fontSize: 12, marginBottom: 5, textTransform: 'uppercase' },
  input: {
    backgroundColor: C.painel2,
    borderWidth: 1,
    borderColor: C.borda,
    color: C.texto,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 12,
  },
  linha: { flexDirection: 'row' },
  btnSec: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginTop: -4, marginBottom: 8 },
  btnSecTxt: { color: C.destaque2, fontSize: 13 },
  msg: { color: C.suave, fontSize: 12, marginBottom: 10 },
  opcao: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 },
  opTxt: { color: C.texto },
  btn: { backgroundColor: C.destaque, borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 12 },
  btnTxt: { color: '#fff', fontWeight: '700' },
});

// ================================================================
// src/mesa/PainelCamadas.js
// ================================================================
// Outliner: camadas manuais (criar, renomear, ocultar, travar, reordenar)
// e a lista de itens dentro de cada camada.
function PainelCamadas({
  camadas,
  itens,
  camadaAtiva,
  setCamadaAtiva,
  selecionado,
  onSelecionar,
  onSalvarCamada,
  onNovaCamada,
  onApagarCamada,
  onMoverCamada,
  onFechar,
}) {
  const [abertas, setAbertas] = useState({});
  const [editando, setEditando] = useState(null);
  const [nomeTemp, setNomeTemp] = useState('');
  const [confirmar, setConfirmar] = useState(null);

  const doTopo = [...camadas].reverse(); // topo da pilha primeiro

  const confirmarNome = (cam) => {
    const n = nomeTemp.trim();
    if (n && n !== cam.nome) onSalvarCamada({ ...cam, nome: n });
    setEditando(null);
  };

  return (
    <View style={estPainelCamadas.painel}>
      <View style={estPainelCamadas.cabeca}>
        <Icone name="layers-triple-outline" size={20} color={C.destaque} />
        <Text style={estPainelCamadas.titulo}>Camadas</Text>
        <TouchableOpacity style={estPainelCamadas.btnNova} onPress={onNovaCamada}>
          <Icone name="plus" size={16} color="#fff" />
          <Text style={estPainelCamadas.btnNovaTxt}>Nova</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onFechar} style={{ padding: 4 }}>
          <Icone name="close" size={20} color={C.suave} />
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 30 }}>
        {doTopo.map((cam, idx) => {
          const ativa = cam.id === camadaAtiva;
          const aberta = !!abertas[cam.id];
          const seus = itens
            .filter((i) => i.camada === cam.id)
            .sort((a, b) => (b.z || 0) - (a.z || 0));

          return (
            <View key={cam.id} style={[estPainelCamadas.camada, ativa && estPainelCamadas.camadaAtiva]}>
              <View style={estPainelCamadas.linhaCamada}>
                <TouchableOpacity onPress={() => setAbertas({ ...abertas, [cam.id]: !aberta })} style={estPainelCamadas.ic}>
                  <Icone name={aberta ? 'chevron-down' : 'chevron-right'} size={18} color={C.suave} />
                </TouchableOpacity>

                <TouchableOpacity onPress={() => onSalvarCamada({ ...cam, visivel: !cam.visivel })} style={estPainelCamadas.ic}>
                  <Icone name={cam.visivel ? 'eye-outline' : 'eye-off-outline'} size={18} color={cam.visivel ? C.texto : C.suave} />
                </TouchableOpacity>

                <TouchableOpacity onPress={() => onSalvarCamada({ ...cam, travada: !cam.travada })} style={estPainelCamadas.ic}>
                  <Icone name={cam.travada ? 'lock' : 'lock-open-variant-outline'} size={17} color={cam.travada ? '#f59e0b' : C.suave} />
                </TouchableOpacity>

                {editando === cam.id ? (
                  <TextInput
                    style={estPainelCamadas.inputNome}
                    value={nomeTemp}
                    onChangeText={setNomeTemp}
                    autoFocus
                    onSubmitEditing={() => confirmarNome(cam)}
                    onBlur={() => confirmarNome(cam)}
                  />
                ) : (
                  <TouchableOpacity
                    style={{ flex: 1 }}
                    onPress={() => setCamadaAtiva(cam.id)}
                    onLongPress={() => {
                      setEditando(cam.id);
                      setNomeTemp(cam.nome);
                    }}
                  >
                    <Text style={[estPainelCamadas.nome, !cam.visivel && { opacity: 0.45 }]} numberOfLines={1}>
                      {cam.nome}
                    </Text>
                    <Text style={estPainelCamadas.contagem}>
                      {seus.length} {seus.length === 1 ? 'item' : 'itens'}
                      {ativa ? ' · ativa' : ''}
                    </Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  onPress={() => {
                    setEditando(cam.id);
                    setNomeTemp(cam.nome);
                  }}
                  style={estPainelCamadas.ic}
                >
                  <Icone name="pencil-outline" size={16} color={C.suave} />
                </TouchableOpacity>
                <TouchableOpacity disabled={idx === 0} onPress={() => onMoverCamada(cam.id, +1)} style={estPainelCamadas.ic}>
                  <Icone name="arrow-up" size={16} color={idx === 0 ? C.borda : C.suave} />
                </TouchableOpacity>
                <TouchableOpacity disabled={idx === doTopo.length - 1} onPress={() => onMoverCamada(cam.id, -1)} style={estPainelCamadas.ic}>
                  <Icone name="arrow-down" size={16} color={idx === doTopo.length - 1 ? C.borda : C.suave} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    if (confirmar === cam.id) {
                      onApagarCamada(cam.id);
                      setConfirmar(null);
                    } else {
                      setConfirmar(cam.id);
                      setTimeout(() => setConfirmar((c) => (c === cam.id ? null : c)), 2500);
                    }
                  }}
                  style={estPainelCamadas.ic}
                >
                  <Icone name={confirmar === cam.id ? 'check-bold' : 'trash-can-outline'} size={16} color={confirmar === cam.id ? C.perigo : C.suave} />
                </TouchableOpacity>
              </View>

              {confirmar === cam.id && (
                <Text style={estPainelCamadas.aviso}>Toque de novo para apagar a camada e seus itens</Text>
              )}

              {aberta && (
                <View style={estPainelCamadas.listaItens}>
                  {seus.length === 0 && <Text style={estPainelCamadas.vazio}>Camada vazia</Text>}
                  {seus.map((it) => (
                    <TouchableOpacity
                      key={it.id}
                      style={[estPainelCamadas.item, it.id === selecionado && estPainelCamadas.itemSel]}
                      onPress={() => onSelecionar(it.id)}
                    >
                      <View style={[estPainelCamadas.bolinha, { backgroundColor: it.cor }]} />
                      <Icone name={ICONE_TIPO[it.type] || 'shape-outline'} size={15} color={C.suave} />
                      <Text style={estPainelCamadas.itemTxt} numberOfLines={1}>
                        {it.rotulo || NOME_TIPO[it.type] || it.type}
                      </Text>
                      {!!it.autor && <Text style={estPainelCamadas.autor}>{it.autor}</Text>}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          );
        })}
        <Text style={estPainelCamadas.dica}>Toque no nome para ativar a camada (novos itens vão para ela). Segure ou use o lápis para renomear.</Text>
      </ScrollView>
    </View>
  );
}

const estPainelCamadas = StyleSheet.create({
  painel: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 300,
    maxWidth: '86%',
    backgroundColor: C.painel,
    borderLeftWidth: 1,
    borderColor: C.borda,
  },
  cabeca: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderColor: C.borda,
    gap: 8,
  },
  titulo: { color: C.texto, fontSize: 16, fontWeight: '700', flex: 1 },
  btnNova: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.destaque,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    gap: 4,
  },
  btnNovaTxt: { color: '#fff', fontWeight: '700', fontSize: 13 },
  camada: { borderBottomWidth: 1, borderColor: C.borda },
  camadaAtiva: { backgroundColor: C.painel2, borderLeftWidth: 3, borderLeftColor: C.destaque },
  linhaCamada: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingRight: 4 },
  ic: { paddingHorizontal: 4, paddingVertical: 4 },
  nome: { color: C.texto, fontWeight: '600', fontSize: 14 },
  contagem: { color: C.suave, fontSize: 11 },
  inputNome: {
    flex: 1,
    color: C.texto,
    backgroundColor: C.bg,
    borderWidth: 1,
    borderColor: C.destaque,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  aviso: { color: C.perigo, fontSize: 11, paddingHorizontal: 12, paddingBottom: 6 },
  listaItens: { paddingLeft: 30, paddingRight: 8, paddingBottom: 8 },
  vazio: { color: C.suave, fontSize: 12, fontStyle: 'italic', paddingVertical: 4 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 5,
    paddingHorizontal: 6,
    borderRadius: 6,
  },
  itemSel: { backgroundColor: 'rgba(34,211,238,0.15)' },
  bolinha: { width: 10, height: 10, borderRadius: 5 },
  itemTxt: { color: C.texto, fontSize: 13, flex: 1 },
  autor: { color: C.suave, fontSize: 10 },
  dica: { color: C.suave, fontSize: 11, padding: 12, lineHeight: 16 },
});

// ================================================================
// src/components/ItensSvg.js
// ================================================================
// Peças de SVG compartilhadas entre a mesa (Palco) e o criador de mapas:
// objetos de cenário, luzes e a camada de escuridão.

// Objeto (adereço): imagem ou ícone emoji, ocupando w×h, com rotação
function PropSvg({ it }) {
  const src = useImagem(it.img);
  const cx = it.x + it.w / 2;
  const cy = it.y + it.h / 2;
  return (
    <G transform={it.rot ? `rotate(${it.rot} ${cx} ${cy})` : undefined}>
      {src ? (
        <SvgImage href={{ uri: src }} x={it.x} y={it.y} width={it.w} height={it.h} preserveAspectRatio="xMidYMid meet" />
      ) : (
        <SvgText x={cx} y={cy + Math.min(it.w, it.h) * 0.3} fontSize={Math.min(it.w, it.h) * 0.85} textAnchor="middle">
          {it.emoji || '❔'}
        </SvgText>
      )}
    </G>
  );
}

// Luz: brilho colorido com raio it.r. mostrarCentro desenha o ponto para selecionar/mover.
function LuzSvg({ it, escala = 1, mostrarCentro }) {
  const gid = 'luzg_' + (it.id || `${Math.round(it.x)}_${Math.round(it.y)}`);
  const op = 0.45 * (it.intensidade || 1);
  return (
    <G>
      <Defs>
        <RadialGradient id={gid} cx={it.x} cy={it.y} r={it.r} fx={it.x} fy={it.y} gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={it.cor || '#ffd27a'} stopOpacity={op} />
          <Stop offset="0.6" stopColor={it.cor || '#ffd27a'} stopOpacity={op * 0.35} />
          <Stop offset="1" stopColor={it.cor || '#ffd27a'} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Circle cx={it.x} cy={it.y} r={it.r} fill={`url(#${gid})`} />
      {mostrarCentro && (
        <Circle cx={it.x} cy={it.y} r={8 / escala} fill={it.cor || '#ffd27a'} stroke="#000" strokeWidth={1.5 / escala} />
      )}
    </G>
  );
}

// Escuridão: cobre a área com preto e "abre buracos" onde há luzes
function EscuridaoSvg({ luzes, nivel, x, y, w, h }) {
  if (!nivel) return null;
  return (
    <G>
      <Defs>
        <RadialGradient id="buracoLuz" cx="0.5" cy="0.5" r="0.5">
          <Stop offset="0" stopColor="#000000" stopOpacity={1} />
          <Stop offset="0.55" stopColor="#000000" stopOpacity={0.85} />
          <Stop offset="1" stopColor="#000000" stopOpacity={0} />
        </RadialGradient>
        <Mask id="mascaraEscuro" maskUnits="userSpaceOnUse" x={x} y={y} width={w} height={h}>
          <Rect x={x} y={y} width={w} height={h} fill="#ffffff" />
          {luzes.map((l, i) => (
            <Circle key={l.id || i} cx={l.x} cy={l.y} r={l.r} fill="url(#buracoLuz)" />
          ))}
        </Mask>
      </Defs>
      <Rect x={x} y={y} width={w} height={h} fill="#000000" opacity={nivel} mask="url(#mascaraEscuro)" />
    </G>
  );
}

// Token simples (para o criador de mapas): círculo com cor, imagem ou iniciais
function TokenSimplesSvg({ it }) {
  const src = useImagem(it.img);
  const r = it.r;
  const clip = 'tkc_' + it.id;
  return (
    <G>
      <Circle cx={it.x} cy={it.y + r * 0.08} r={r} fill="rgba(0,0,0,0.45)" />
      <Circle cx={it.x} cy={it.y} r={r} fill={it.cor || '#8b5cf6'} />
      {src ? (
        <>
          <Defs>
            <ClipPath id={clip}>
              <Circle cx={it.x} cy={it.y} r={r * 0.9} />
            </ClipPath>
          </Defs>
          <SvgImage href={{ uri: src }} x={it.x - r} y={it.y - r} width={r * 2} height={r * 2} preserveAspectRatio="xMidYMid slice" clipPath={`url(#${clip})`} />
        </>
      ) : (
        <SvgText x={it.x} y={it.y + r * 0.18} fontSize={r * 0.55} fontWeight="bold" fill="#fff" textAnchor="middle">
          {(it.nome || '?').slice(0, 2).toUpperCase()}
        </SvgText>
      )}
      <Circle cx={it.x} cy={it.y} r={r} fill="none" stroke="#fff" strokeWidth={r * 0.08} />
    </G>
  );
}

// Forma vinda de uma estrutura (retângulo, círculo ou desenho), em escala k
function FormaSvg({ it }) {
  const k = it.k || 1;
  let corpo = null;
  if (it.tipoForma === 'rect') corpo = <Rect x={0} y={0} width={it.w} height={it.h} fill={it.cor} fillOpacity={0.25} stroke={it.cor} strokeWidth={it.espessura || 3} />;
  if (it.tipoForma === 'circle') corpo = <Circle cx={0} cy={0} r={it.r} fill={it.cor} fillOpacity={0.25} stroke={it.cor} strokeWidth={it.espessura || 3} />;
  if (it.tipoForma === 'draw')
    corpo = <Path d={it.d} fill="none" stroke={it.cor} strokeOpacity={it.opac || 1} strokeWidth={it.espessura || 4} strokeLinecap="round" strokeLinejoin="round" />;
  return <G transform={`translate(${it.x} ${it.y}) scale(${k})`}>{corpo}</G>;
}

// ================================================================
// src/utils/grade.js
// ================================================================
// Grade quadrada e hexagonal: valores padrão, encaixe e desenho da grade visível

// ---------- grade (quadrada / hexagonal) ----------
const GRADE_PADRAO = {
  grade: true,
  tipoGrade: 'quadrada', // 'quadrada' | 'hex'
  tamGrade: 70,
  corGrade: '#ffffff',
  opacGrade: 0.18,
  espGrade: 1,
  infinita: true,
  offX: 0,
  offY: 0,
  snap: true,
};

const lerGrade = (sala) => ({ ...GRADE_PADRAO, ...(sala || {}) });

// hexágono "pointy-top": cel = largura (distância entre lados paralelos)
const R3 = Math.sqrt(3);
const hexRaio = (cel) => cel / R3;

function hexCentro(q, r, g) {
  const w = g.tamGrade;
  const R = hexRaio(w);
  return { x: g.offX + w * (q + r / 2), y: g.offY + 1.5 * R * r };
}

function hexDoPonto(x, y, g) {
  const w = g.tamGrade;
  const R = hexRaio(w);
  const rf = (y - g.offY) / (1.5 * R);
  const qf = (x - g.offX) / w - rf / 2;
  // arredondamento em coordenadas cúbicas
  let rx = Math.round(qf);
  let rz = Math.round(rf);
  const ry = Math.round(-qf - rf);
  const dx = Math.abs(rx - qf);
  const dy = Math.abs(ry - (-qf - rf));
  const dz = Math.abs(rz - rf);
  if (dx > dy && dx > dz) rx = -ry - rz;
  else if (dy <= dz) rz = -rx - ry;
  return { q: rx, r: rz };
}

// Encaixa o centro de um token na grade atual
function encaixarPonto(x, y, g, tam = 1) {
  if (!g.grade || !g.snap) return { x, y };
  if (g.tipoGrade === 'hex') {
    const h = hexDoPonto(x, y, g);
    return hexCentro(h.q, h.r, g);
  }
  return {
    x: encaixar(x - g.offX, g.tamGrade, tam) + g.offX,
    y: encaixar(y - g.offY, g.tamGrade, tam) + g.offY,
  };
}

// Gera o "d" de um único Path com a grade visível (x0,y0)-(x1,y1) em coordenadas do mundo.
// Retorna '' se houver células demais (zoom muito afastado).
function caminhoGrade(g, x0, y0, x1, y1, mapW, mapH) {
  if (!g.grade) return '';
  if (!g.infinita) {
    x0 = Math.max(x0, 0);
    y0 = Math.max(y0, 0);
    x1 = Math.min(x1, mapW);
    y1 = Math.min(y1, mapH);
    if (x1 <= x0 || y1 <= y0) return '';
  }
  const w = g.tamGrade;
  const partes = [];

  if (g.tipoGrade === 'hex') {
    const R = hexRaio(w);
    const r0 = Math.floor((y0 - g.offY) / (1.5 * R)) - 1;
    const r1 = Math.ceil((y1 - g.offY) / (1.5 * R)) + 1;
    if ((r1 - r0) * ((x1 - x0) / w + 3) > 2500) return '';
    for (let r = r0; r <= r1; r++) {
      const q0 = Math.floor((x0 - g.offX) / w - r / 2) - 1;
      const q1 = Math.ceil((x1 - g.offX) / w - r / 2) + 1;
      for (let q = q0; q <= q1; q++) {
        const c = hexCentro(q, r, g);
        if (!g.infinita && (c.x < -w / 2 || c.y < -R || c.x > mapW + w / 2 || c.y > mapH + R)) continue;
        let d = '';
        for (let i = 0; i < 6; i++) {
          const ang = (Math.PI / 180) * (60 * i - 30);
          const px = (c.x + R * Math.cos(ang)).toFixed(1);
          const py = (c.y + R * Math.sin(ang)).toFixed(1);
          d += (i ? 'L' : 'M') + px + ' ' + py;
        }
        partes.push(d + 'Z');
      }
    }
    return partes.join('');
  }

  const i0 = Math.floor((x0 - g.offX) / w);
  const i1 = Math.ceil((x1 - g.offX) / w);
  const j0 = Math.floor((y0 - g.offY) / w);
  const j1 = Math.ceil((y1 - g.offY) / w);
  if (i1 - i0 + (j1 - j0) > 600) return '';
  for (let i = i0; i <= i1; i++) {
    const x = g.offX + i * w;
    if (!g.infinita && (x < 0 || x > mapW)) continue;
    partes.push(`M${x} ${y0}V${y1}`);
  }
  for (let j = j0; j <= j1; j++) {
    const y = g.offY + j * w;
    if (!g.infinita && (y < 0 || y > mapH)) continue;
    partes.push(`M${x0} ${y}H${x1}`);
  }
  return partes.join('');
}

// ================================================================
// src/mesa/Palco.js
// ================================================================
// Palco: renderiza a cena (mapa, grade, itens) e trata todos os gestos.
function Palco(props) {
  const P = useRef(props);
  P.current = props;

  const areaRef = useRef(null);
  const origem = useRef({ x: 0, y: 0 });
  const g = useRef({ modo: null });
  const [rascunho, setRascunho] = useState(null);
  const [area, setArea] = useState({ w: 800, h: 600 });

  const pontoTela = (pageX, pageY) => ({ x: pageX - origem.current.x, y: pageY - origem.current.y });
  const paraMundo = (t) => {
    const v = P.current.view;
    return { x: (t.x - v.x) / v.s, y: (t.y - v.y) / v.s };
  };

  const medir = () => {
    if (areaRef.current && areaRef.current.measure) {
      areaRef.current.measure((x, y, w, h, px, py) => {
        origem.current = { x: px || 0, y: py || 0 };
        if (w && h) setArea({ w, h });
        P.current.onTamanho && P.current.onTamanho(w, h);
      });
    }
  };

  const finalizar = () => {
    const st = g.current;
    const p = P.current;
    if (st.modo === 'arrastar') p.onSoltar(st.id);
    if (st.modo === 'desenho' && st.pts.length > 1) p.onCriarDesenho(st.pts);
    if (st.modo === 'forma') {
      if (st.tipo === 'captura') p.onCapturar(st.a, st.b);
      else p.onCriarForma(st.tipo, st.a, st.b);
    }
    if (st.modo === 'colocar' && st.ultimo) p.onColocar(st.ultimo);
    setRascunho(null);
    g.current = { modo: null };
  };

  const resp = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,

      onPanResponderGrant: (e) => {
        const p = P.current;
        const tela = pontoTela(e.nativeEvent.pageX, e.nativeEvent.pageY);
        const w = paraMundo(tela);
        const st = { modo: null, view0: p.view, ultimo: w, pts: [] };
        g.current = st;

        switch (p.ferramenta) {
          case 'mover': {
            const hit = p.acharItem(w.x, w.y);
            if (hit) {
              st.modo = 'arrastar';
              st.id = hit.id;
              st.off = { x: w.x - hit.x, y: w.y - hit.y };
              p.onSelecionar(hit.id);
              p.onIniciarArraste(hit.id);
            } else {
              st.modo = 'pan';
              p.onSelecionar(null);
            }
            break;
          }
          case 'pan':
            st.modo = 'pan';
            break;
          case 'desenho':
            st.modo = 'desenho';
            st.pts = [w];
            setRascunho({ type: 'draw', pts: [w] });
            break;
          case 'retangulo':
          case 'circulo':
          case 'capturar':
            st.modo = 'forma';
            st.tipo = p.ferramenta === 'retangulo' ? 'rect' : p.ferramenta === 'circulo' ? 'circle' : 'captura';
            st.a = w;
            st.b = w;
            setRascunho({ type: st.tipo, a: w, b: w });
            break;
          case 'colocar':
          case 'luz':
            st.modo = 'colocar';
            break;
          case 'borracha': {
            st.modo = 'borracha';
            const hit = p.acharItem(w.x, w.y);
            if (hit) p.onApagar(hit.id);
            break;
          }
        }
      },

      onPanResponderMove: (e, gs) => {
        const p = P.current;
        const st = g.current;
        const toques = e.nativeEvent.touches || [];

        // ---- pinça (zoom com dois dedos) ----
        if (toques.length >= 2) {
          const a = pontoTela(toques[0].pageX, toques[0].pageY);
          const b = pontoTela(toques[1].pageX, toques[1].pageY);
          const dist = Math.hypot(a.x - b.x, a.y - b.y);
          const meio = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
          if (st.modo !== 'pinca') {
            if (st.modo === 'arrastar') p.onSoltar(st.id);
            setRascunho(null);
            g.current = { modo: 'pinca', dist0: dist || 1, meio0: meio, view0: p.view };
            return;
          }
          const v0 = st.view0;
          const s = limitar(v0.s * (dist / st.dist0), 0.15, 6);
          const wx = (st.meio0.x - v0.x) / v0.s;
          const wy = (st.meio0.y - v0.y) / v0.s;
          p.setView({ s, x: meio.x - wx * s, y: meio.y - wy * s });
          return;
        }
        if (st.modo === 'pinca') return; // ignora o dedo restante

        const tela = pontoTela(e.nativeEvent.pageX, e.nativeEvent.pageY);
        const w = paraMundo(tela);
        st.ultimo = w;

        switch (st.modo) {
          case 'pan':
            p.setView({ ...st.view0, x: st.view0.x + gs.dx, y: st.view0.y + gs.dy });
            break;
          case 'arrastar':
            p.onMoverLocal(st.id, w.x - st.off.x, w.y - st.off.y);
            break;
          case 'desenho': {
            const ult = st.pts[st.pts.length - 1];
            if (Math.hypot(w.x - ult.x, w.y - ult.y) > 3 / p.view.s) {
              st.pts.push(w);
              setRascunho({ type: 'draw', pts: st.pts.slice() });
            }
            break;
          }
          case 'forma':
            st.b = w;
            setRascunho({ type: st.tipo, a: st.a, b: w });
            break;
          case 'borracha': {
            const hit = p.acharItem(w.x, w.y);
            if (hit) p.onApagar(hit.id);
            break;
          }
        }
      },

      onPanResponderRelease: finalizar,
      onPanResponderTerminate: finalizar,
    })
  ).current;

  // Zoom com a roda do mouse no navegador
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const el = areaRef.current;
    if (!el || !el.addEventListener) return;
    const roda = (ev) => {
      ev.preventDefault();
      const r = el.getBoundingClientRect();
      const px = ev.clientX - r.left;
      const py = ev.clientY - r.top;
      const v = P.current.view;
      const s = limitar(v.s * (ev.deltaY < 0 ? 1.1 : 1 / 1.1), 0.15, 6);
      const wx = (px - v.x) / v.s;
      const wy = (py - v.y) / v.s;
      P.current.setView({ s, x: px - wx * s, y: py - wy * s });
    };
    el.addEventListener('wheel', roda, { passive: false });
    return () => el.removeEventListener('wheel', roda);
  }, []);

  const { sala, itens, view, selecionado, cor, espessura } = props;
  const mapW = sala.mapW || 1400;
  const mapH = sala.mapH || 1000;
  const gr = lerGrade(sala);

  // Região visível do mundo, "quantizada" em blocos para não recalcular a grade a cada frame de arraste
  const bloco = gr.tamGrade * 8;
  const bx0 = Math.floor(-view.x / view.s / bloco) * bloco;
  const by0 = Math.floor(-view.y / view.s / bloco) * bloco;
  const bx1 = Math.ceil((area.w - view.x) / view.s / bloco) * bloco;
  const by1 = Math.ceil((area.h - view.y) / view.s / bloco) * bloco;
  const mapaSrc = useImagem(sala.mapUrl);
  const dGrade = useMemo(
    () => caminhoGrade(gr, bx0, by0, bx1, by1, mapW, mapH),
    [bx0, by0, bx1, by1, gr.grade, gr.tipoGrade, gr.tamGrade, gr.infinita, gr.offX, gr.offY, mapW, mapH]
  );

  const sel = itens.find((i) => i.id === selecionado);
  const selCaixa = sel ? caixa(sel) : null;

  return (
    <View
      ref={areaRef}
      style={estPalco.area}
      onLayout={medir}
      {...resp.panHandlers}
    >
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Svg width="100%" height="100%">
          <G transform={`translate(${view.x} ${view.y}) scale(${view.s})`}>
            {/* fundo do mapa */}
            <Rect x={0} y={0} width={mapW} height={mapH} fill="#1a1626" />
            {!!mapaSrc && (
              <SvgImage
                href={{ uri: mapaSrc }}
                x={0}
                y={0}
                width={mapW}
                height={mapH}
                preserveAspectRatio="xMidYMid slice"
              />
            )}
            {!!dGrade && (
              <Path
                d={dGrade}
                fill="none"
                stroke={gr.corGrade}
                strokeOpacity={gr.opacGrade}
                strokeWidth={gr.espGrade / view.s}
              />
            )}

            {/* itens já ordenados por camada e z */}
            {itens.map((it) => (
              <Item key={it.id} it={it} escala={view.s} mostrarLuzes={props.mostrarLuzes} />
            ))}

            {/* escuridão com as luzes abrindo a visão */}
            <EscuridaoSvg
              nivel={sala.escuridao || 0}
              luzes={itens.filter((i) => i.type === 'luz')}
              x={bx0 - bloco}
              y={by0 - bloco}
              w={bx1 - bx0 + bloco * 2}
              h={by1 - by0 + bloco * 2}
            />

            {/* rascunho do que está sendo desenhado */}
            {rascunho && <Rascunho r={rascunho} cor={cor} espessura={espessura} escala={view.s} />}

            {/* contorno de seleção */}
            {selCaixa && (
              <Rect
                x={selCaixa.x - 6}
                y={selCaixa.y - 6}
                width={selCaixa.w + 12}
                height={selCaixa.h + 12}
                fill="none"
                stroke={C.destaque2}
                strokeWidth={2 / view.s}
                strokeDasharray={`${8 / view.s} ${5 / view.s}`}
              />
            )}
          </G>
        </Svg>
      </View>
    </View>
  );
}

function Item({ it, escala, mostrarLuzes }) {
  switch (it.type) {
    case 'token':
      return <TokenItem it={it} escala={escala} />;
    case 'tiles':
      return <MapaTilesSvg linhas={it.linhas} cel={it.cel || 70} tema={it.tema} mostrarGrade={it.mostrarGrade !== false} textura={it.textura !== false} x={it.x} y={it.y} />;
    case 'prop':
      return <PropSvg it={it} />;
    case 'luz':
      return <LuzSvg it={it} escala={escala} mostrarCentro={mostrarLuzes} />;
    case 'rect':
      return (
        <Rect
          x={it.x}
          y={it.y}
          width={it.w}
          height={it.h}
          fill={it.cor}
          fillOpacity={0.25}
          stroke={it.cor}
          strokeWidth={it.espessura || 3}
        />
      );
    case 'circle':
      return (
        <Circle
          cx={it.x}
          cy={it.y}
          r={it.r}
          fill={it.cor}
          fillOpacity={0.25}
          stroke={it.cor}
          strokeWidth={it.espessura || 3}
        />
      );
    case 'draw':
      return (
        <G transform={`translate(${it.x} ${it.y}) scale(${it.escalaPath || 1})`}>
          <Path
            d={it.d}
            fill="none"
            strokeOpacity={it.opac || 1}
            stroke={it.cor}
            strokeWidth={it.espessura || 4}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </G>
      );
    default:
      return null;
  }
}

function TokenItem({ it, escala }) {
  const src = useImagem(it.img);
  const clip = 'clip_' + it.id;
  return (
    <G>
      <Circle cx={it.x} cy={it.y + it.r * 0.08} r={it.r} fill="rgba(0,0,0,0.45)" />
      <Circle cx={it.x} cy={it.y} r={it.r} fill={it.cor} />
      {!!src && (
        <>
          <Defs>
            <ClipPath id={clip}>
              <Circle cx={it.x} cy={it.y} r={it.r * 0.9} />
            </ClipPath>
          </Defs>
          <SvgImage
            href={{ uri: src }}
            x={it.x - it.r}
            y={it.y - it.r}
            width={it.r * 2}
            height={it.r * 2}
            preserveAspectRatio="xMidYMid slice"
            clipPath={`url(#${clip})`}
          />
        </>
      )}
      <Circle cx={it.x} cy={it.y} r={it.r} fill="none" stroke="#fff" strokeWidth={Math.max(2, it.r * 0.08)} />
      {!src && !!it.rotulo && (
        <SvgText x={it.x} y={it.y + it.r * 0.18} fontSize={it.r * 0.55} fontWeight="bold" fill="#fff" textAnchor="middle">
          {it.rotulo.slice(0, 2).toUpperCase()}
        </SvgText>
      )}
      <BarraRecurso it={it} escala={escala} />
      {!!it.rotulo && (
        <SvgText
          x={it.x}
          y={it.y + it.r + (it.ficha && it.ficha.recursos && it.ficha.recursos.length ? 26 : 16) / escala}
          fontSize={13 / escala}
          fill="#fff"
          stroke="#000"
          strokeWidth={0.6 / escala}
          textAnchor="middle"
        >
          {it.rotulo}
        </SvgText>
      )}
    </G>
  );
}

// Barra do 1º recurso da ficha (ex.: Vida) logo abaixo do token
function BarraRecurso({ it, escala }) {
  const rec = it.ficha && it.ficha.recursos && it.ficha.recursos[0];
  if (!rec || !rec.max) return null;
  const larg = it.r * 1.6;
  const alt = 6 / escala;
  const frac = Math.max(0, Math.min(1, (rec.atual || 0) / rec.max));
  const corBarra = frac > 0.5 ? '#22c55e' : frac > 0.25 ? '#eab308' : '#ef4444';
  const x = it.x - larg / 2;
  const y = it.y + it.r + 4 / escala;
  return (
    <G>
      <Rect x={x} y={y} width={larg} height={alt} rx={alt / 2} fill="rgba(0,0,0,0.7)" />
      <Rect x={x} y={y} width={larg * frac} height={alt} rx={alt / 2} fill={corBarra} />
    </G>
  );
}

function Rascunho({ r, cor, espessura, escala }) {
  if (r.type === 'captura') {
    return (
      <Rect
        x={Math.min(r.a.x, r.b.x)}
        y={Math.min(r.a.y, r.b.y)}
        width={Math.abs(r.b.x - r.a.x)}
        height={Math.abs(r.b.y - r.a.y)}
        fill="rgba(34,211,238,0.12)"
        stroke={C.destaque2}
        strokeWidth={2 / escala}
        strokeDasharray={`${10 / escala} ${6 / escala}`}
      />
    );
  }
  if (r.type === 'draw') {
    const d = r.pts.map((p, i) => `${i ? 'L' : 'M'}${p.x} ${p.y}`).join(' ');
    return <Path d={d} fill="none" stroke={cor} strokeWidth={espessura} strokeLinecap="round" strokeLinejoin="round" />;
  }
  if (r.type === 'rect') {
    return (
      <Rect
        x={Math.min(r.a.x, r.b.x)}
        y={Math.min(r.a.y, r.b.y)}
        width={Math.abs(r.b.x - r.a.x)}
        height={Math.abs(r.b.y - r.a.y)}
        fill={cor}
        fillOpacity={0.2}
        stroke={cor}
        strokeWidth={espessura}
        strokeDasharray={`${6 / escala} ${4 / escala}`}
      />
    );
  }
  if (r.type === 'circle') {
    return (
      <Circle
        cx={r.a.x}
        cy={r.a.y}
        r={Math.hypot(r.b.x - r.a.x, r.b.y - r.a.y)}
        fill={cor}
        fillOpacity={0.2}
        stroke={cor}
        strokeWidth={espessura}
        strokeDasharray={`${6 / escala} ${4 / escala}`}
      />
    );
  }
  return null;
}

const estPalco = StyleSheet.create({
  area: { flex: 1, backgroundColor: C.palco, overflow: 'hidden' },
});

// ================================================================
// src/data/sementes.js
// ================================================================
// Dados iniciais: packs oficiais e assets gravados no Firestore na 1ª vez que alguém abre os packs
const recVida = (nome, atual) => [{ nome, atual, max: atual }];
const PACKS_SEMENTE = [
  { id: 'pack_herois', nome: 'Heróis do Vórtice', nicho: 'Fantasia', cor: '#8b5cf6', icone: 'shield-sword-outline', descricao: 'Quatro aventureiros prontos para começar uma campanha.', ordem: 1 },
  { id: 'pack_bestiario', nome: 'Bestiário Inicial', nicho: 'Fantasia', cor: '#ef4444', icone: 'skull-outline', descricao: 'Inimigos e criaturas para os primeiros combates.', ordem: 2 },
  { id: 'pack_vila', nome: 'Taverna da Vila', nicho: 'Cidade', cor: '#f97316', icone: 'glass-mug-variant', descricao: 'NPCs e mobília para cenas na cidade.', ordem: 3 },
  { id: 'pack_floresta', nome: 'Floresta Antiga', nicho: 'Natureza', cor: '#22c55e', icone: 'pine-tree', descricao: 'Árvores, rochas e um acampamento pronto.', ordem: 4 },
  { id: 'pack_masmorra', nome: 'Masmorra Básica', nicho: 'Masmorra', cor: '#78716c', icone: 'castle', descricao: 'Portas, baús, armadilhas e uma sala do tesouro.', ordem: 5 },
].map((p) => ({ publicado: true, capa: '', autor: 'Mesa Vortex', criadoEm: 0, ...p }));

const fichaSemente = (id, pack, nome, tipo, tamanho, cor, corpo, precisao, essencia, pericias, vida, descricao) => ({
  id, pack, tipo: 'personagem', nome, categoria: tipo, tamanho, cor, corpo, precisao, essencia, pericias, recursos: recVida('Vida', vida), descricao,
});
const objSemente = (id, pack, nome, emoji, w = 1, h = 1) => ({ id, pack, tipo: 'objeto', nome, emoji, w, h, img: '' });

// Pastas dos assets iniciais (organização dentro de cada pack)
const PASTA_INICIAL = {
  a_cavaleira: 'Linha de frente', a_cleriga: 'Suporte', a_arqueiro: 'À distância', a_mago: 'À distância',
  a_goblin: 'Humanoides', a_ogro: 'Humanoides', a_esqueleto: 'Mortos-vivos', a_dragao: 'Chefes',
  a_lobo: 'Feras', a_aranha: 'Feras', a_golem: 'Constructos',
  a_taverneiro: 'NPCs', a_mercadora: 'NPCs',
  o_barril: 'Mobília', o_cadeira: 'Mobília', o_cama: 'Mobília', o_caneca: 'Utensílios',
  o_pinheiro: 'Vegetação', o_carvalho: 'Vegetação', o_arbusto: 'Vegetação', o_cogumelos: 'Vegetação',
  o_rocha: 'Terreno', o_tronco: 'Terreno', o_fogueira: 'Acampamento',
  o_porta: 'Passagens', o_alcapao: 'Passagens', o_bau: 'Tesouro', o_ossada: 'Decoração', o_vela: 'Decoração',
  o_correntes: 'Decoração', o_estatua: 'Decoração',
};

const ASSETS_SEMENTE = [
  fichaSemente('a_cavaleira', 'pack_herois', 'Cavaleira Errante', 'Aliado', 1, '#3b82f6', 3, 1, 0, [{ nome: 'Atletismo', valor: 2 }, { nome: 'Intimidação', valor: 1 }], 14, 'Guerreira de armadura pesada que protege os aliados na linha de frente.'),
  fichaSemente('a_arqueiro', 'pack_herois', 'Arqueiro Élfico', 'Aliado', 1, '#22c55e', 1, 3, 1, [{ nome: 'Pontaria', valor: 2 }, { nome: 'Furtividade', valor: 1 }], 10, 'Atirador ágil que prefere manter distância.'),
  fichaSemente('a_mago', 'pack_herois', 'Mago do Vórtice', 'Aliado', 1, '#8b5cf6', 0, 1, 3, [{ nome: 'Arcanismo', valor: 2 }, { nome: 'Conhecimento', valor: 2 }], 8, 'Estudioso das energias do Vórtice; frágil, mas devastador.'),
  fichaSemente('a_cleriga', 'pack_herois', 'Clériga da Aurora', 'Aliado', 1, '#eab308', 1, 1, 3, [{ nome: 'Cura', valor: 2 }, { nome: 'Persuasão', valor: 1 }], 11, 'Curandeira devota que protege o grupo com bênçãos de luz.'),
  fichaSemente('a_goblin', 'pack_bestiario', 'Goblin Saqueador', 'Inimigo', 1, '#84cc16', 1, 2, 0, [{ nome: 'Furtividade', valor: 2 }], 6, 'Pequeno, covarde e sempre em bando.'),
  fichaSemente('a_esqueleto', 'pack_bestiario', 'Esqueleto Guardião', 'Inimigo', 1, '#e5e7eb', 2, 1, 0, [{ nome: 'Lâminas', valor: 1 }], 8, 'Morto-vivo que vigia criptas antigas.'),
  fichaSemente('a_ogro', 'pack_bestiario', 'Ogro da Ponte', 'Inimigo', 2, '#a16207', 4, 0, 0, [{ nome: 'Atletismo', valor: 2 }], 22, 'Cobra pedágio de quem atravessa a ponte.'),
  fichaSemente('a_dragao', 'pack_bestiario', 'Dragão de Cinzas', 'Inimigo', 3, '#ef4444', 4, 2, 3, [{ nome: 'Sopro', valor: 3 }, { nome: 'Voo', valor: 2 }], 40, 'Dragão jovem que sopra brasas sufocantes.'),
  fichaSemente('a_lobo', 'pack_bestiario', 'Lobo das Sombras', 'Criatura', 1, '#1f2937', 2, 2, 1, [{ nome: 'Rastrear', valor: 2 }], 9, 'Caça em matilha e some na escuridão.'),
  fichaSemente('a_aranha', 'pack_bestiario', 'Aranha Gigante', 'Criatura', 2, '#6b21a8', 2, 2, 0, [{ nome: 'Escalar', valor: 3 }], 15, 'Tece teias que prendem quem entra em seu covil.'),
  fichaSemente('a_golem', 'pack_bestiario', 'Golem de Pedra', 'Criatura', 2, '#78716c', 4, 0, 1, [], 30, 'Construto lento e resistente, ativado por runas.'),
  fichaSemente('a_taverneiro', 'pack_vila', 'Taverneiro Bartolo', 'NPC', 1, '#f97316', 2, 0, 0, [{ nome: 'Boatos', valor: 3 }], 10, 'Sabe de todos os boatos da região.'),
  fichaSemente('a_mercadora', 'pack_vila', 'Mercadora Itinerante', 'NPC', 1, '#14b8a6', 0, 1, 1, [{ nome: 'Negociar', valor: 3 }], 8, 'Carroça cheia de itens raros (e preços salgados).'),
  objSemente('o_barril', 'pack_vila', 'Barril', '🛢️'),
  objSemente('o_cadeira', 'pack_vila', 'Cadeira', '🪑'),
  objSemente('o_caneca', 'pack_vila', 'Caneca', '🍺'),
  objSemente('o_cama', 'pack_vila', 'Cama', '🛏️', 1, 2),
  objSemente('o_pinheiro', 'pack_floresta', 'Pinheiro', '🌲', 2, 2),
  objSemente('o_carvalho', 'pack_floresta', 'Carvalho', '🌳', 2, 2),
  objSemente('o_rocha', 'pack_floresta', 'Rocha', '🪨'),
  objSemente('o_cogumelos', 'pack_floresta', 'Cogumelos', '🍄'),
  objSemente('o_arbusto', 'pack_floresta', 'Arbusto', '🌿'),
  objSemente('o_fogueira', 'pack_floresta', 'Fogueira', '🔥'),
  objSemente('o_tronco', 'pack_floresta', 'Tronco caído', '🪵', 2, 1),
  objSemente('o_porta', 'pack_masmorra', 'Porta', '🚪'),
  objSemente('o_bau', 'pack_masmorra', 'Baú', '🧰'),
  objSemente('o_ossada', 'pack_masmorra', 'Ossada', '💀'),
  objSemente('o_vela', 'pack_masmorra', 'Vela', '🕯️'),
  objSemente('o_correntes', 'pack_masmorra', 'Correntes', '⛓️'),
  objSemente('o_alcapao', 'pack_masmorra', 'Alçapão', '🕳️'),
  objSemente('o_estatua', 'pack_masmorra', 'Estátua', '🗿', 1, 2),
  {
    id: 'e_acampamento', pack: 'pack_floresta', tipo: 'estrutura', nome: 'Acampamento', cel: 70, w: 280, h: 210,
    itens: [
      { type: 'prop', x: 70, y: 0, w: 140, h: 140, emoji: '⛺', cor: '#22c55e' },
      { type: 'prop', x: 105, y: 140, w: 70, h: 70, emoji: '🔥', cor: '#f97316' },
      { type: 'prop', x: 0, y: 140, w: 70, h: 70, emoji: '🪵', cor: '#a16207' },
      { type: 'prop', x: 210, y: 140, w: 70, h: 70, emoji: '🪵', cor: '#a16207' },
    ],
  },
  {
    id: 'e_tesouro', pack: 'pack_masmorra', tipo: 'estrutura', nome: 'Sala do tesouro', cel: 70, w: 280, h: 210,
    itens: [
      { type: 'rect', x: 0, y: 0, w: 280, h: 210, cor: '#78716c', espessura: 8 },
      { type: 'prop', x: 105, y: 52, w: 70, h: 70, emoji: '🧰', cor: '#eab308' },
      { type: 'prop', x: 10, y: 10, w: 35, h: 35, emoji: '🕯️', cor: '#eab308' },
      { type: 'prop', x: 235, y: 10, w: 35, h: 35, emoji: '🕯️', cor: '#eab308' },
      { type: 'prop', x: 105, y: 175, w: 70, h: 35, emoji: '🚪', cor: '#a16207' },
    ],
  },
].map((a) => ({ autor: 'Mesa Vortex', criadoEm: 0, pasta: PASTA_INICIAL[a.id] || '', ...a }));

// ================================================================
// src/services/assets.js
// ================================================================
// Assets e packs: carregamento, regras de visibilidade/oficialização, notificações
// e conversões entre itens da mesa e estruturas/mapas.

const assetsDe = (usuario) => `${COL.usuarios}/${usuario}/assets`;


// ---------- carregamento ----------
// Packs com seus assets agrupados. incluirRascunhos: só para o admin.
// Todos os packs (oficiais e de jogadores) com seus assets agrupados
// Versão dos dados iniciais. Ao aumentar, os packs e assets básicos que faltarem são gravados de novo.
const SEMENTES_VERSAO = 2;
let sementesConferidas = false;

// Garante que os packs e assets básicos existam no banco (completa o que faltar, sem apagar nada)
async function garantirSementes(packs, assets) {
  if (sementesConferidas) return false;
  sementesConferidas = true;
  try {
    const marca = await lerDoc('config/sementes');
    const temPacks = new Set(packs.map((p) => p.id));
    const temAssets = {};
    assets.forEach((a) => (temAssets[a.id] = a));
    const faltando = PACKS_SEMENTE.some((p) => !temPacks.has(p.id)) || ASSETS_SEMENTE.some((a) => !temAssets[a.id]);
    if (marca && marca.versao >= SEMENTES_VERSAO && !faltando) return false;
    const tarefas = [];
    PACKS_SEMENTE.forEach((p) => !temPacks.has(p.id) && tarefas.push(salvar(`${COL.packs}/${p.id}`, p)));
    ASSETS_SEMENTE.forEach((a) => {
      const atual = temAssets[a.id];
      if (!atual) tarefas.push(salvar(`${COL.assets}/${a.id}`, a));
      else if (!atual.pasta && a.pasta) tarefas.push(atualizar(`${COL.assets}/${a.id}`, { pasta: a.pasta }));
    });
    await Promise.all(tarefas);
    await salvar('config/sementes', { versao: SEMENTES_VERSAO, em: Date.now() });
    return tarefas.length > 0;
  } catch (e) {
    return false;
  }
}

async function carregarTodosPacks() {
  let [packs, assets] = await Promise.all([listar(COL.packs), listar(COL.assets)]);
  if (await garantirSementes(packs, assets)) {
    [packs, assets] = await Promise.all([listar(COL.packs), listar(COL.assets)]);
  }
  const porPack = {};
  assets.forEach((a) => (porPack[a.pack] = porPack[a.pack] || []).push(a));
  return packs
    .sort((a, b) => (a.ordem || 0) - (b.ordem || 0) || (a.criadoEm || 0) - (b.criadoEm || 0))
    .map((p) => ({ ...p, assets: porNome(porPack[p.id] || []) }));
}

async function carregarMeusAssets(usuario) {
  return porNome(await listar(assetsDe(usuario)));
}

const packEstaAtivo = (ativos, id) => ativos === null || ativos.includes(id);

// Pack oficial = postado por admin ou aprovado na oficialização. Packs de jogadores têm oficial: false
const ehOficial = (p) => p.oficial !== false;
// O que um usuário pode ver/usar: oficiais publicados + os próprios packs
const packVisivelPara = (p, usuario) => (ehOficial(p) && p.publicado) || p.dono === usuario;

const STATUS_PACK = {
  privado: { nome: 'Privado', cor: '#6b7280', icone: 'lock-outline' },
  pendente: { nome: 'Aguardando análise', cor: '#eab308', icone: 'timer-sand' },
  ressalvas: { nome: 'Com ressalvas', cor: '#f97316', icone: 'message-alert-outline' },
  recusado: { nome: 'Recusado', cor: '#ef4444', icone: 'close-octagon-outline' },
  aceito: { nome: 'Oficial', cor: '#22c55e', icone: 'check-decagram' },
};
const statusDoPack = (p) => (ehOficial(p) ? 'aceito' : p.status || 'privado');

// ---------- notificações ----------
async function notificar(para, dados) {
  const id = gerarId();
  await salvar(`${COL.notificacoes}/${id}`, { para, lida: false, em: Date.now(), ...dados });
}

async function carregarNotificacoes(usuario, admin) {
  const [minhas, deAdmins] = await Promise.all([
    consultar(COL.notificacoes, 'para', usuario),
    admin ? consultar(COL.notificacoes, 'para', 'admins') : Promise.resolve([]),
  ]);
  return [...minhas, ...deAdmins].sort((a, b) => (b.em || 0) - (a.em || 0));
}

const marcarLida = (id) => atualizar(`${COL.notificacoes}/${id}`, { lida: true }).catch(() => {});

// ---------- conversões mesa <-> asset ----------
const CAMPOS_FORA = ['id', 'camada', 'z', 'autor'];
const limparItem = (it) => {
  const o = {};
  Object.keys(it).forEach((k) => !CAMPOS_FORA.includes(k) && (o[k] = it[k]));
  return o;
};

// Estrutura a partir de itens da mesa (posições relativas ao canto superior esquerdo)
function estruturaDosItens(itens, cel) {
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
function itensDaEstrutura(estr, x, y, cel, camada, autor) {
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
function mapaDaMesa(sala, camadasOrd, itens) {
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

function resumoAsset(a) {
  if (a.tipo === 'personagem') return `${a.categoria || a.tipo} · C${a.corpo || 0} P${a.precisao || 0} E${a.essencia || 0}`;
  if (a.tipo === 'objeto') return `${a.w || 1}×${a.h || 1} células`;
  if (a.tipo === 'estrutura') return `${(a.itens || []).length} elementos`;
  if (a.tipo === 'mapa') return `${(a.camadas || []).length} camadas · ${(a.itens || []).length} elementos`;
  return '';
}

// personagem no formato da ficha (categoria = Aliado/Inimigo/NPC/Criatura)
const fichaDoAsset = (a) => ({ ...a, tipo: a.categoria || 'Aliado' });
const assetDaFicha = (f, extra = {}) => {
  const { tipo, ...resto } = f;
  return { ...resto, ...extra, tipo: 'personagem', categoria: tipo || 'Aliado' };
};

// ================================================================
// src/services/dungeondraft.js
// ================================================================
// Importação de mapas do Dungeondraft (formato Universal VTT: .dd2vtt / .uvtt / .df2vtt).
// O arquivo é um JSON com a imagem do mapa em base64, o tamanho em células,
// pixels por célula, paredes (line_of_sight), portas (portals) e luzes (lights), tudo em unidades de grade.

const CEL = 70; // tamanho da célula na mesa

// Lê um arquivo local como texto sem depender do expo-file-system (XMLHttpRequest aceita file:// e blob:)
function lerTextoDeUri(uri) {
  return new Promise((ok, falha) => {
    const xhr = new XMLHttpRequest();
    xhr.onload = () => ok(xhr.responseText);
    xhr.onerror = () => falha(new Error('Não foi possível ler o arquivo.'));
    xhr.open('GET', uri);
    xhr.send();
  });
}

// Abre o seletor de arquivos e devolve { nome, dados } ou null se cancelado
async function escolherArquivoVtt() {
  const r = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true, multiple: false });
  if (!r || r.canceled || !r.assets || !r.assets.length) return null;
  const a = r.assets[0];
  const texto = Platform.OS === 'web' && a.file ? await a.file.text() : await lerTextoDeUri(a.uri);
  let dados;
  try {
    dados = JSON.parse(texto);
  } catch (e) {
    throw new Error('Arquivo inválido: exporte do Dungeondraft no formato Universal VTT (.dd2vtt).');
  }
  if (!dados.resolution || !dados.image) throw new Error('O arquivo não tem imagem ou resolução do mapa (precisa ser Universal VTT).');
  return { nome: (a.name || 'Mapa importado').replace(/\.(dd2vtt|df2vtt|uvtt|json)$/i, ''), dados };
}

// "ffeccd8b" (AARRGGBB) -> "#eccd8b"
const corDeArgb = (c) => {
  const s = String(c || '').replace('#', '');
  return s.length === 8 ? `#${s.slice(2)}` : s.length === 6 ? `#${s}` : '#ffd27a';
};
const ponto = (p, o) => ({ x: ((p && p.x) || 0) - o.x, y: ((p && p.y) || 0) - o.y });

// Converte o JSON do Dungeondraft num asset "mapa" e salva em Meus assets › Mapas
async function importarVtt(arquivo, { usuario, aoProgresso } = {}) {
  const d = arquivo.dados;
  const res = d.resolution;
  const origem = res.map_origin || { x: 0, y: 0 };
  const cols = (res.map_size && res.map_size.x) || 20;
  const rows = (res.map_size && res.map_size.y) || 15;
  const ppg = res.pixels_per_grid || 70;

  aoProgresso && aoProgresso('Comprimindo a imagem do mapa...');
  const largura = Math.min(2048, Math.round(cols * ppg));
  const img = await salvarImagemBase64(d.image, { largura, autor: usuario.nome });

  // paredes e portas ficam guardadas (em unidades da mesa) para recursos futuros como névoa/visão
  const paredes = [...(d.line_of_sight || []), ...(d.objects_line_of_sight || [])]
    .filter((l) => Array.isArray(l) && l.length > 1)
    .map((l) => ({ pts: l.map((p) => ponto(p, origem)).map((p) => [Math.round(p.x * CEL), Math.round(p.y * CEL)]).flat() })); // Firestore não aceita lista dentro de lista
  const portas = (d.portals || []).map((p) => ({
    pts: (p.bounds || []).map((b) => ponto(b, origem)).map((b) => [Math.round(b.x * CEL), Math.round(b.y * CEL)]).flat(),
    fechada: p.closed !== false,
  }));

  const luzes = (d.lights || []).map((l, i) => {
    const p = ponto(l.position, origem);
    return {
      type: 'luz',
      camada: 'luzes',
      x: p.x * CEL,
      y: p.y * CEL,
      r: Math.max(0.5, l.range || 4) * CEL,
      cor: corDeArgb(l.color),
      intensidade: Math.max(0.1, Math.min(1, l.intensity || 1)),
      z: i,
      rotulo: 'Luz',
    };
  });

  const id = gerarId();
  const asset = {
    id,
    tipo: 'mapa',
    nome: arquivo.nome,
    img: img.ref,
    origemImport: 'dungeondraft',
    sala: {
      mapUrl: img.ref,
      mapW: cols * CEL,
      mapH: rows * CEL,
      tamGrade: CEL,
      tipoGrade: 'quadrada',
      grade: true,
      infinita: false,
      opacGrade: 0.12,
      offX: 0,
      offY: 0,
      snap: true,
      escuridao: luzes.length ? 0.55 : 0,
    },
    camadas: [
      { chave: 'luzes', nome: 'Luzes', ordem: 0, visivel: true, travada: true },
      { chave: 'cenario', nome: 'Cenário', ordem: 1, visivel: true, travada: false },
      { chave: 'tokens', nome: 'Tokens', ordem: 2, visivel: true, travada: false },
    ],
    itens: luzes,
    paredes,
    portas,
    autor: usuario.nome,
    criadoEm: Date.now(),
  };
  aoProgresso && aoProgresso('Salvando o mapa...');
  await salvar(`${assetsDe(usuario.usuario)}/${id}`, asset);
  return asset;
}

// ================================================================
// src/services/auth.js
// ================================================================
// Sistema de contas da Mesa Vortex (coleção usuarios).
// Métodos de entrada:
//  - e-mail/usuário + senha: conta própria (salt + hash SHA-256 iterado, a senha nunca é salva)
//  - anônimo (visitante): Firebase Authentication via REST (Identity Toolkit), sem SDK

const CHAVE_SESSAO = 'mv_sessao';
const ROUNDS = 500;

// ---------- Firebase Authentication (REST) ----------
const FIREBASE_API_KEY = 'AIzaSyAyGf6liSbUvqQreQl68SOX3haLi94i29U';
const AUTH_URL = 'https://identitytoolkit.googleapis.com/v1/accounts';

function traduzirErroAuth(m = '') {
  if (m.includes('OPERATION_NOT_ALLOWED') || m.includes('ADMIN_ONLY_OPERATION')) {
    return 'Esse método de login não está ativado no Firebase.';
  }
  if (m.includes('API_KEY')) return 'Chave da API do Firebase inválida.';
  return 'Erro na autenticação' + (m ? `: ${m}` : '.');
}

async function chamarAuth(acao, corpo) {
  const r = await fetch(`${AUTH_URL}:${acao}?key=${FIREBASE_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...corpo, returnSecureToken: true }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(traduzirErroAuth(j.error && j.error.message));
  return j;
}

// ---------- SHA-256 em JS puro ----------
const SHA_K = [];
const SHA_H = [];
(function prepararSha() {
  const frac = (x) => ((x - Math.floor(x)) * 4294967296) | 0;
  let n = 2;
  let c = 0;
  while (c < 64) {
    let primo = true;
    for (let i = 2; i * i <= n; i++) if (n % i === 0) { primo = false; break; }
    if (primo) {
      if (c < 8) SHA_H[c] = frac(Math.pow(n, 1 / 2));
      SHA_K[c] = frac(Math.pow(n, 1 / 3));
      c++;
    }
    n++;
  }
})();

function utf8(str) {
  const out = [];
  for (const ch of str) {
    const cp = ch.codePointAt(0);
    if (cp < 0x80) out.push(cp);
    else if (cp < 0x800) out.push(0xc0 | (cp >> 6), 0x80 | (cp & 63));
    else if (cp < 0x10000) out.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
    else out.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 63), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
  }
  return out;
}

function sha256(texto) {
  const bytes = utf8(texto);
  const bits = bytes.length * 8;
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  const alto = Math.floor(bits / 4294967296);
  for (let i = 3; i >= 0; i--) bytes.push((alto >>> (i * 8)) & 255);
  for (let i = 3; i >= 0; i--) bytes.push((bits >>> (i * 8)) & 255);

  const h = SHA_H.slice();
  const w = new Array(64);
  const rot = (x, k) => (x >>> k) | (x << (32 - k));
  for (let o = 0; o < bytes.length; o += 64) {
    for (let i = 0; i < 16; i++) {
      w[i] = (bytes[o + i * 4] << 24) | (bytes[o + i * 4 + 1] << 16) | (bytes[o + i * 4 + 2] << 8) | bytes[o + i * 4 + 3];
    }
    for (let i = 16; i < 64; i++) {
      const s0 = rot(w[i - 15], 7) ^ rot(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rot(w[i - 2], 17) ^ rot(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
    }
    let [a, b, c, d, e, f, g, hh] = h;
    for (let i = 0; i < 64; i++) {
      const S1 = rot(e, 6) ^ rot(e, 11) ^ rot(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (hh + S1 + ch + SHA_K[i] + w[i]) | 0;
      const S0 = rot(a, 2) ^ rot(a, 13) ^ rot(a, 22);
      const mj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + mj) | 0;
      hh = g; g = f; f = e; e = (d + t1) | 0;
      d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    h[0] = (h[0] + a) | 0; h[1] = (h[1] + b) | 0; h[2] = (h[2] + c) | 0; h[3] = (h[3] + d) | 0;
    h[4] = (h[4] + e) | 0; h[5] = (h[5] + f) | 0; h[6] = (h[6] + g) | 0; h[7] = (h[7] + hh) | 0;
  }
  return h.map((x) => (x >>> 0).toString(16).padStart(8, '0')).join('');
}

const gerarSalt = () => {
  let t = '';
  for (let i = 0; i < 4; i++) t += Math.random().toString(36).slice(2, 10);
  return t + Date.now().toString(36);
};

function hashSenha(senha, salt) {
  let x = salt + ':' + senha;
  for (let i = 0; i < ROUNDS; i++) x = sha256(x + salt);
  return x;
}

// ---------- validações ----------
const RE_USUARIO = /^[a-z0-9_.]{3,20}$/;
const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function validarCadastro({ nome, email, usuario, senha, confirmar }) {
  if (nome.trim().length < 2) return 'Digite seu nome (mín. 2 letras).';
  if (!RE_EMAIL.test(email.trim())) return 'E-mail inválido.';
  if (!RE_USUARIO.test(usuario.trim().toLowerCase())) return 'Usuário: 3 a 20 caracteres (letras, números, _ ou .).';
  if (senha.length < 6) return 'A senha precisa de pelo menos 6 caracteres.';
  if (!/[0-9]/.test(senha) || !/[a-zA-Z]/.test(senha)) return 'A senha precisa ter letras e números.';
  if (senha !== confirmar) return 'As senhas não conferem.';
  return '';
}

// E-mails que sempre têm papel de admin (além das contas admin/dev criadas no início)
const EMAILS_ADMIN = ['jotalhaojogos@gmail.com'];
const ehEmailAdmin = (email) => EMAILS_ADMIN.includes((email || '').trim().toLowerCase());

const publico = (u) => ({
  usuario: u.usuario,
  nome: u.nome,
  email: u.email,
  cor: u.cor,
  criadoEm: u.criadoEm,
  papel: ehEmailAdmin(u.email) ? 'admin' : u.papel || 'jogador',
  provedor: u.provedor || 'senha',
  foto: u.foto || '',
});

// ---------- conta de desenvolvedor (admin) ----------
// Criada automaticamente na primeira execução. TROQUE A SENHA no "Meus dados" depois do 1º login.
// Outra conta vira admin trocando o campo papel para "admin" no Firestore.
const CONTAS_INICIAIS = [
  { usuario: 'admin', nome: 'Administrador', email: 'admin@mesavortex.app', senhaInicial: 'admin123', cor: '#ef4444' },
  { usuario: 'dev', nome: 'Desenvolvedor', email: 'dev@mesavortex.app', senhaInicial: 'vortex123', cor: '#8b5cf6' },
];
const RESERVADOS = ['dev', 'admin', 'root', 'sistema'];

// Cria as contas admin e dev (papel "admin") se ainda não existirem
async function garantirContaDev() {
  await Promise.all(
    CONTAS_INICIAIS.map(async (c) => {
      try {
        const existe = await lerDoc(`${COL.usuarios}/${c.usuario}`);
        if (existe) return;
        const salt = gerarSalt();
        await salvar(`${COL.usuarios}/${c.usuario}`, {
          usuario: c.usuario,
          nome: c.nome,
          email: c.email,
          salt,
          senhaHash: hashSenha(c.senhaInicial, salt),
          cor: c.cor,
          papel: 'admin',
          provedor: 'senha',
          recentes: [],
          criadoEm: Date.now(),
        });
      } catch (e) {}
    })
  );
}

// Packs que o usuário escolheu usar. null = nunca escolheu (todos os publicados ficam ativos)
async function lerPacksAtivos(usuario) {
  const conta = await lerDoc(`${COL.usuarios}/${usuario}`);
  return conta && Array.isArray(conta.packsAtivos) ? conta.packsAtivos : null;
}

async function salvarPacksAtivos(usuario, ids) {
  await atualizar(`${COL.usuarios}/${usuario}`, { packsAtivos: ids });
}

async function guardarSessao(sessao) {
  try {
    await AsyncStorage.setItem(CHAVE_SESSAO, JSON.stringify(sessao));
  } catch (e) {}
}

// ---------- operações ----------
async function cadastrar(dados) {
  const erro = validarCadastro(dados);
  if (erro) throw new Error(erro);
  const id = dados.usuario.trim().toLowerCase();
  const email = dados.email.trim().toLowerCase();
  if (RESERVADOS.includes(id)) throw new Error('Esse nome de usuário é reservado.');

  const [existente, mesmoEmail] = await Promise.all([
    lerDoc(`${COL.usuarios}/${id}`),
    consultar(COL.usuarios, 'email', email),
  ]);
  if (existente) throw new Error('Esse nome de usuário já está em uso.');
  if (mesmoEmail.length) throw new Error('Já existe uma conta com esse e-mail.');

  const salt = gerarSalt();
  const conta = {
    usuario: id,
    nome: dados.nome.trim(),
    email,
    salt,
    senhaHash: hashSenha(dados.senha, salt),
    cor: CORES[Math.floor(Math.random() * 9)],
    papel: ehEmailAdmin(email) ? 'admin' : 'jogador',
    provedor: 'senha',
    recentes: [],
    criadoEm: Date.now(),
    ultimoAcesso: Date.now(),
  };
  await salvar(`${COL.usuarios}/${id}`, conta);
  const sessao = publico(conta);
  await guardarSessao(sessao);
  return sessao;
}

// login aceita usuário OU e-mail
async function entrar(login, senha) {
  const chave = login.trim().toLowerCase();
  if (!chave || !senha) throw new Error('Preencha usuário/e-mail e senha.');
  let conta = null;
  if (chave.includes('@')) {
    const r = await consultar(COL.usuarios, 'email', chave);
    conta = r[0] || null;
  } else {
    conta = await lerDoc(`${COL.usuarios}/${chave}`);
  }
  if (conta && conta.provedor && conta.provedor !== 'senha') {
    throw new Error('Usuário ou senha incorretos.');
  }
  if (!conta || hashSenha(senha, conta.salt) !== conta.senhaHash) {
    throw new Error('Usuário ou senha incorretos.');
  }
  const extra = ehEmailAdmin(conta.email) && conta.papel !== 'admin' ? { papel: 'admin' } : {};
  atualizar(`${COL.usuarios}/${conta.usuario}`, { ultimoAcesso: Date.now(), ...extra }).catch(() => {});
  const sessao = publico(conta);
  await guardarSessao(sessao);
  return sessao;
}

async function sair() {
  try {
    await AsyncStorage.removeItem(CHAVE_SESSAO);
  } catch (e) {}
}

async function restaurarSessao() {
  try {
    const t = await AsyncStorage.getItem(CHAVE_SESSAO);
    if (!t) return null;
    const salva = JSON.parse(t);
    const conta = await lerDoc(`${COL.usuarios}/${salva.usuario}`);
    if (!conta) {
      await sair();
      return null;
    }
    return publico(conta);
  } catch (e) {
    return null;
  }
}

async function atualizarPerfil(usuario, { nome, cor }) {
  const parcial = {};
  if (nome !== undefined) {
    if (nome.trim().length < 2) throw new Error('Nome muito curto.');
    parcial.nome = nome.trim();
  }
  if (cor) parcial.cor = cor;
  await atualizar(`${COL.usuarios}/${usuario}`, parcial);
  const conta = await lerDoc(`${COL.usuarios}/${usuario}`);
  const sessao = publico(conta);
  await guardarSessao(sessao);
  return sessao;
}

async function trocarSenha(usuario, atual, nova, confirmar) {
  const conta = await lerDoc(`${COL.usuarios}/${usuario}`);
  if (!conta || hashSenha(atual, conta.salt) !== conta.senhaHash) throw new Error('Senha atual incorreta.');
  if (nova.length < 6 || !/[0-9]/.test(nova) || !/[a-zA-Z]/.test(nova)) {
    throw new Error('Nova senha: mín. 6 caracteres, com letras e números.');
  }
  if (nova !== confirmar) throw new Error('As senhas não conferem.');
  const salt = gerarSalt();
  await atualizar(`${COL.usuarios}/${usuario}`, { salt, senhaHash: hashSenha(nova, salt) });
}

async function registrarRecente(usuario, codigo) {
  const conta = await lerDoc(`${COL.usuarios}/${usuario}`);
  if (!conta) return;
  const recentes = [codigo, ...(conta.recentes || []).filter((c) => c !== codigo)].slice(0, 12);
  await atualizar(`${COL.usuarios}/${usuario}`, { recentes });
}

// ---------- visitante anônimo (Firebase Auth) ----------
// Cria (na 1ª vez) ou carrega o perfil no Firestore ligado ao uid do Firebase Auth
async function contaFirebase({ prefixo, localId, nome, email, foto, provedor }) {
  const id = `${prefixo}_${localId}`;
  let conta = await lerDoc(`${COL.usuarios}/${id}`);
  if (!conta) {
    conta = {
      usuario: id,
      uid: localId,
      nome,
      email: email || '',
      foto: foto || '',
      provedor,
      cor: CORES[Math.floor(Math.random() * 9)],
      papel: 'jogador',
      recentes: [],
      criadoEm: Date.now(),
      ultimoAcesso: Date.now(),
    };
    await salvar(`${COL.usuarios}/${id}`, conta);
  } else {
    atualizar(`${COL.usuarios}/${id}`, { ultimoAcesso: Date.now() }).catch(() => {});
  }
  const sessao = publico(conta);
  await guardarSessao(sessao);
  return sessao;
}

async function entrarAnonimo() {
  const j = await chamarAuth('signUp', {});
  return contaFirebase({
    prefixo: 'anon',
    localId: j.localId,
    nome: `Visitante ${j.localId.slice(-4).toUpperCase()}`,
    provedor: 'anonimo',
  });
}

// ================================================================
// src/utils/link.js
// ================================================================
// Links de convite para mesas: ...?mesa=CODIGO

// Lê o código da mesa do link que abriu o app (web ou celular)
async function mesaDoLink() {
  try {
    const url =
      Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.href : await Linking.getInitialURL();
    if (!url) return null;
    const m = url.match(/[?&]mesa=([A-Za-z0-9]{4,8})/);
    return m ? m[1].toUpperCase() : null;
  } catch (e) {
    return null;
  }
}

// Monta o link de convite de uma mesa
function linkDaMesa(codigo) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `${window.location.origin}${window.location.pathname}?mesa=${codigo}`;
  }
  return ExpoLinking.createURL('/', { queryParams: { mesa: codigo } });
}

// ================================================================
// src/mesa/Mesa.js
// ================================================================
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

function Mesa({ codigo, usuario, onSair, onEntrarConta, onCriarMapa }) {
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
      <View style={[estMesa.tela, { alignItems: 'center', justifyContent: 'center', padding: 24 }]}>
        <Icone name="map-marker-question-outline" size={48} color={C.suave} />
        <Text style={{ color: C.texto, fontSize: 17, fontWeight: '700', marginTop: 10 }}>Mesa não encontrada</Text>
        <Text style={{ color: C.suave, marginTop: 4, textAlign: 'center' }}>O código {codigo} não existe ou a mesa foi excluída.</Text>
        <TouchableOpacity onPress={onSair} style={[estMesa.chip, { marginTop: 16, paddingHorizontal: 16 }]}>
          <Text style={estMesa.chipTxt}>Voltar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!sala) {
    return (
      <View style={[estMesa.tela, { alignItems: 'center', justifyContent: 'center' }]}>
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
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={estMesa.baseConteudo}>
          <Ferramentas
            lista={[
              ['mover', 'cursor-default', 'Selecionar'],
              ['pan', 'hand-back-right-outline', 'Navegar'],
            ]}
            atual={ferramenta}
            onEscolher={setFerramenta}
          />
          <Text style={estMesa.dica}>{DICA_FERRAMENTA[ferramenta]}</Text>
        </ScrollView>
      );
    }

    if (aba === 'desenho') {
      return (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={estMesa.baseConteudo}>
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
            <View style={estMesa.grupo}>
              {[2, 4, 8, 14].map((e) => (
                <TouchableOpacity key={e} onPress={() => setEspessura(e)} style={[estMesa.chip, espessura === e && estMesa.chipAtivo]}>
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
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={estMesa.baseConteudo}>
          <TouchableOpacity style={[estMesa.btnGrande, ferramenta === 'capturar' && estMesa.btnGrandeAtivo]} onPress={() => setFerramenta('capturar')}>
            <Icone name="selection-drag" size={20} color={ferramenta === 'capturar' ? '#fff' : C.destaque2} />
            <Text style={[estMesa.btnGrandeTxt, ferramenta === 'capturar' && { color: '#fff' }]}>Capturar estrutura</Text>
          </TouchableOpacity>
          <TouchableOpacity style={estMesa.btnGrande} onPress={() => setSalvandoMapa(true)}>
            <Icone name="content-save-outline" size={20} color={C.destaque2} />
            <Text style={estMesa.btnGrandeTxt}>Salvar mesa como mapa</Text>
          </TouchableOpacity>
          <TouchableOpacity style={estMesa.btnGrande} onPress={importarDungeondraft}>
            <Icone name="file-import-outline" size={20} color={C.destaque2} />
            <Text style={estMesa.btnGrandeTxt}>Importar Dungeondraft (.dd2vtt)</Text>
          </TouchableOpacity>
          {!!onCriarMapa && (
            <TouchableOpacity style={estMesa.btnGrande} onPress={onCriarMapa}>
              <Icone name="map-plus" size={20} color={C.destaque2} />
              <Text style={estMesa.btnGrandeTxt}>Criador de mapas</Text>
            </TouchableOpacity>
          )}
          <Text style={[estMesa.dica, { maxWidth: 260 }]}>
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
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[estMesa.baseConteudo, { paddingBottom: 2, gap: 6 }]}>
          <FonteChip ativo={fonte === 'rapido'} icone="flash-outline" rotulo="Rápido" onPress={() => { setFonte('rapido'); setModelo(null); }} />
          {fontes.map((f) => (
            <FonteChip key={f.id} ativo={fonte === f.id} icone={f.icone || 'package-variant'} rotulo={f.nome} onPress={() => { setFonte(f.id); setModelo(null); }} />
          ))}
          <TouchableOpacity onPress={carregarFontes} style={{ padding: 6 }}>
            <Icone name="refresh" size={16} color={C.suave} />
          </TouchableOpacity>
        </ScrollView>

        {fonte === 'rapido' ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={estMesa.baseConteudo}>
            <TextInput
              style={[estMesa.inputBase, { width: 120 }]}
              value={rapido.nome}
              onChangeText={(t) => setRapido({ ...rapido, nome: t })}
              placeholder="Nome do token"
              placeholderTextColor={C.suave}
            />
            <View style={estMesa.grupo}>
              {[1, 2, 3, 4].map((t) => (
                <TouchableOpacity key={t} onPress={() => setRapido({ ...rapido, tam: t })} style={[estMesa.chip, rapido.tam === t && estMesa.chipAtivo]}>
                  <Text style={estMesa.chipTxt}>{t}×</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Paleta cor={cor} onCor={setCor} />
          </ScrollView>
        ) : (
          <View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[estMesa.baseConteudo, { paddingVertical: 2, gap: 4 }]}>
              {tiposDisp.map((t) => (
                <TouchableOpacity key={t.id} onPress={() => { setTipoAsset(t.id); setPastaAsset(null); }} style={[estMesa.tipoChip, tipoEfetivo === t.id && estMesa.tipoChipAtivo]}>
                  <Icone name={t.icone} size={14} color={tipoEfetivo === t.id ? C.destaque2 : C.suave} />
                  <Text style={[estMesa.tipoTxt, tipoEfetivo === t.id && { color: C.destaque2 }]}>{t.nome}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            {pastas.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[estMesa.baseConteudo, { paddingVertical: 2, gap: 4 }]}>
                {[null, ...pastas].map((p) => (
                  <TouchableOpacity key={p || 'todas'} onPress={() => setPastaAsset(p)} style={[estMesa.pastaChip, pastaEfetiva === p && estMesa.pastaChipAtiva]}>
                    <Icone name={p ? (pastaEfetiva === p ? 'folder-open' : 'folder-outline') : 'folder-multiple-outline'} size={13} color={pastaEfetiva === p ? '#fff' : C.suave} />
                    <Text style={[estMesa.pastaTxt, pastaEfetiva === p && { color: '#fff' }]}>{p || 'Todas'}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[estMesa.baseConteudo, { gap: 8 }]}>
              {lista.length === 0 && (
                <Text style={estMesa.dica}>
                  {fonte === 'meus' ? 'Nada aqui ainda. Crie em Meus assets ou pela aba Construir.' : 'Pack vazio.'}
                </Text>
              )}
              {lista.map((a) => (
                <TouchableOpacity key={a.id} onPress={() => setModelo(modelo && modelo.id === a.id ? null : a)} style={[estMesa.assetBtn, modelo && modelo.id === a.id && estMesa.assetBtnAtivo]}>
                  <AssetMini asset={a} tamanho={40} />
                  <Text style={estMesa.assetNome} numberOfLines={1}>{a.nome}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
        <Text style={[estMesa.dica, { paddingHorizontal: 12, paddingBottom: 6 }]}>
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
    <View style={estMesa.tela}>
      {/* ---------- barra superior ---------- */}
      <View style={estMesa.topo}>
        <TouchableOpacity onPress={onSair} style={estMesa.btnTopo}>
          <Icone name="arrow-left" size={20} color={C.texto} />
        </TouchableOpacity>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={estMesa.nomeMesa} numberOfLines={1}>{sala.nome}</Text>
          <Text style={estMesa.codigo} numberOfLines={1}>
            <Text style={{ color: online ? C.ok : C.perigo }}>● </Text>
            {codigo} · camada: {nomeCamadaAtiva}
          </Text>
        </View>
        <TouchableOpacity onPress={() => zoom(1 / 1.25)} style={estMesa.btnTopo}>
          <Icone name="minus" size={18} color={C.texto} />
        </TouchableOpacity>
        <TouchableOpacity onPress={centralizar} style={estMesa.btnTopo}>
          <Text style={estMesa.zoomTxt}>{Math.round(view.s * 100)}%</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => zoom(1.25)} style={estMesa.btnTopo}>
          <Icone name="plus" size={18} color={C.texto} />
        </TouchableOpacity>
        {mestre && (
          <TouchableOpacity onPress={() => setConfig(true)} style={estMesa.btnTopo}>
            <Icone name="cog-outline" size={20} color={C.texto} />
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={compartilhar} style={estMesa.btnTopo}>
          <Icone name="share-variant-outline" size={20} color={C.texto} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setPainel(!painel)} style={[estMesa.btnTopo, painel && estMesa.btnTopoAtivo]}>
          <Icone name="layers-triple-outline" size={20} color={painel ? '#fff' : C.texto} />
        </TouchableOpacity>
      </View>

      {visitante && faixaVisitante && (
        <View style={estMesa.faixaVisitante}>
          <Icone name="incognito" size={18} color="#fff" />
          <Text style={estMesa.faixaTxt}>
            Você está jogando como <Text style={{ fontWeight: '800' }}>visitante</Text>. Entrar é opcional, mas salva suas campanhas e assets.
          </Text>
          <TouchableOpacity style={estMesa.faixaBtn} onPress={onEntrarConta}>
            <Text style={estMesa.faixaBtnTxt}>Entrar / criar conta</Text>
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
          <View style={estMesa.aviso} pointerEvents="none">
            <Text style={estMesa.avisoTxt}>{aviso}</Text>
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
      <View style={estMesa.base}>
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
        <View style={estMesa.abasBar}>
          {ABAS.map((a) => (
            <TouchableOpacity key={a.id} style={[estMesa.abaBtn, aba === a.id && estMesa.abaBtnAtiva]} onPress={() => trocarAba(a.id)}>
              <Icone name={a.icone} size={20} color={aba === a.id ? C.destaque2 : C.suave} />
              <Text style={[estMesa.abaTxt, aba === a.id && { color: C.destaque2 }]}>{a.nome}</Text>
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
          <View style={estMesa.fundoModal}>
            <View style={estMesa.modal}>
              <Text style={estMesa.modalTitulo}>Aplicar mapa "{mapaPendente.nome}"</Text>
              <Text style={estMesa.dica}>{resumoAsset(mapaPendente)}</Text>
              {!mestre && <Text style={[estMesa.dica, { color: '#f59e0b', marginTop: 6 }]}>Só o mestre pode aplicar mapas nesta mesa.</Text>}
              <TouchableOpacity disabled={!mestre} style={[estMesa.opcaoMapa, !mestre && { opacity: 0.4 }]} onPress={() => aplicarMapa(mapaPendente, false)}>
                <Icone name="layers-plus" size={20} color={C.destaque2} />
                <View style={{ flex: 1 }}>
                  <Text style={estMesa.opcaoTit}>Adicionar à mesa</Text>
                  <Text style={estMesa.dica}>Cria as camadas do mapa por cima das atuais.</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity disabled={!mestre} style={[estMesa.opcaoMapa, !mestre && { opacity: 0.4 }]} onPress={() => aplicarMapa(mapaPendente, true)}>
                <Icone name="swap-horizontal" size={20} color={C.perigo} />
                <View style={{ flex: 1 }}>
                  <Text style={estMesa.opcaoTit}>Substituir tudo</Text>
                  <Text style={estMesa.dica}>Apaga camadas e itens atuais e carrega o mapa.</Text>
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
    <View style={estMesa.grupo}>
      {lista.map(([id, icone, rotulo]) => (
        <TouchableOpacity key={id} onPress={() => onEscolher(id)} style={[estMesa.ferr, atual === id && estMesa.ferrAtiva]}>
          <Icone name={icone} size={20} color={atual === id ? '#fff' : C.suave} />
          <Text style={[estMesa.ferrTxt, atual === id && { color: '#fff' }]}>{rotulo}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function FonteChip({ ativo, icone, rotulo, onPress }) {
  return (
    <TouchableOpacity onPress={onPress} style={[estMesa.fonte, ativo && estMesa.fonteAtiva]}>
      <Icone name={icone} size={14} color={ativo ? '#fff' : C.suave} />
      <Text style={[estMesa.fonteTxt, ativo && { color: '#fff' }]} numberOfLines={1}>{rotulo}</Text>
    </TouchableOpacity>
  );
}

function Paleta({ cor, onCor }) {
  return (
    <View style={estMesa.grupo}>
      {CORES.map((c) => (
        <TouchableOpacity key={c} onPress={() => onCor(c)} style={[estMesa.cor, { backgroundColor: c }, cor === c && estMesa.corSel]} />
      ))}
    </View>
  );
}

function Passo({ rotulo, valor, onMenos, onMais, desativado }) {
  return (
    <View style={[estMesa.passo, desativado && { opacity: 0.45 }]}>
      <Text style={estMesa.passoRot}>{rotulo}</Text>
      <View style={estMesa.grupo}>
        <TouchableOpacity disabled={desativado} onPress={onMenos} style={estMesa.passoBtn}>
          <Icone name="minus" size={14} color={C.texto} />
        </TouchableOpacity>
        <Text style={estMesa.passoVal}>{valor}</Text>
        <TouchableOpacity disabled={desativado} onPress={onMais} style={estMesa.passoBtn}>
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
      {!mestre && <Text style={[estMesa.dica, { paddingHorizontal: 12, paddingTop: 6, color: '#f59e0b' }]}>Só o mestre altera a grade desta mesa.</Text>}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={estMesa.baseConteudo}>
        <View style={estMesa.grupo}>
          {[
            ['grade', 'grid', 'Mostrar'],
            ['snap', 'magnet', 'Encaixar'],
            ['infinita', 'all-inclusive', 'Infinita'],
          ].map(([k, ic, rot]) => (
            <TouchableOpacity key={k} disabled={d} onPress={() => alterna(k)} style={[estMesa.ferr, g[k] && estMesa.ferrAtiva, d && { opacity: 0.45 }]}>
              <Icone name={ic} size={18} color={g[k] ? '#fff' : C.suave} />
              <Text style={[estMesa.ferrTxt, g[k] && { color: '#fff' }]}>{rot}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={estMesa.grupo}>
          {[
            ['quadrada', 'square-outline', 'Quadrada'],
            ['hex', 'hexagon-outline', 'Hexagonal'],
          ].map(([k, ic, rot]) => (
            <TouchableOpacity key={k} disabled={d} onPress={() => onMudar({ tipoGrade: k })} style={[estMesa.ferr, g.tipoGrade === k && estMesa.ferrAtiva, d && { opacity: 0.45 }]}>
              <Icone name={ic} size={18} color={g.tipoGrade === k ? '#fff' : C.suave} />
              <Text style={[estMesa.ferrTxt, g.tipoGrade === k && { color: '#fff' }]}>{rot}</Text>
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
        <View style={estMesa.grupo}>
          {CORES_GRADE.map((c) => (
            <TouchableOpacity key={c} disabled={d} onPress={() => onMudar({ corGrade: c })} style={[estMesa.cor, { backgroundColor: c }, g.corGrade === c && estMesa.corSel]} />
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
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={estMesa.baseConteudo}>
      <View>
        <Text style={estMesa.insTitulo} numberOfLines={1}>{it.rotulo || NOME_TIPO[it.type]}</Text>
        <Text style={estMesa.insCamada}>
          {NOME_TIPO[it.type]} · {camada ? camada.nome : '?'}
          {travada ? ' 🔒' : ''}
        </Text>
      </View>

      {it.type === 'token' && (
        <View style={estMesa.grupo}>
          <BtnIns icone="card-account-details-outline" rotulo="Ficha" cor={C.destaque2} onPress={onFicha} />
          {rec && (
            <View style={estMesa.recurso}>
              <TouchableOpacity onPress={() => mudarRecurso(-1)} style={estMesa.passoBtn}>
                <Icone name="minus" size={14} color={C.texto} />
              </TouchableOpacity>
              <View style={{ alignItems: 'center' }}>
                <Text style={estMesa.recNome}>{rec.nome}</Text>
                <Text style={estMesa.recVal}>
                  {rec.atual}/{rec.max}
                </Text>
              </View>
              <TouchableOpacity onPress={() => mudarRecurso(1)} style={estMesa.passoBtn}>
                <Icone name="plus" size={14} color={C.texto} />
              </TouchableOpacity>
            </View>
          )}
          {[1, 2, 3, 4].map((t) => (
            <TouchableOpacity key={t} onPress={() => onSalvar({ ...it, tam: t })} style={[estMesa.chip, (it.tam || 1) === t && estMesa.chipAtivo]}>
              <Text style={estMesa.chipTxt}>{t}×</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {it.type === 'luz' && (
        <View style={estMesa.grupo}>
          <BtnIns icone="minus-circle-outline" rotulo="Raio −" onPress={() => onSalvar({ ...it, r: Math.max(cel, it.r - cel) })} />
          <Text style={estMesa.recVal}>{Math.round(it.r / cel)} cél.</Text>
          <BtnIns icone="plus-circle-outline" rotulo="Raio +" onPress={() => onSalvar({ ...it, r: it.r + cel })} />
          <BtnIns
            icone="brightness-6"
            rotulo={`${Math.round((it.intensidade || 1) * 100)}%`}
            onPress={() => onSalvar({ ...it, intensidade: (it.intensidade || 1) >= 1 ? 0.4 : Math.round(((it.intensidade || 1) + 0.2) * 10) / 10 })}
          />
        </View>
      )}

      {it.type === 'prop' && (
        <View style={estMesa.grupo}>
          <BtnIns icone="rotate-left" rotulo="-45°" onPress={() => onSalvar({ ...it, rot: ((it.rot || 0) - 45) % 360 })} />
          <BtnIns icone="rotate-right" rotulo="+45°" onPress={() => onSalvar({ ...it, rot: ((it.rot || 0) + 45) % 360 })} />
          <BtnIns icone="magnify-minus-outline" rotulo="Menor" onPress={() => it.w > cel / 2 && onSalvar({ ...it, w: it.w - cel / 2, h: Math.max(cel / 2, it.h - cel / 2) })} />
          <BtnIns icone="magnify-plus-outline" rotulo="Maior" onPress={() => onSalvar({ ...it, w: it.w + cel / 2, h: it.h + cel / 2 })} />
        </View>
      )}

      {it.type !== 'prop' && <Paleta cor={it.cor} onCor={(c) => onSalvar({ ...it, cor: c })} />}

      <View style={estMesa.grupo}>
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
    <TouchableOpacity onPress={onPress} style={estMesa.btnIns}>
      <Icone name={icone} size={18} color={cor || C.texto} />
      <Text style={[estMesa.btnInsTxt, cor && { color: cor }]}>{rotulo}</Text>
    </TouchableOpacity>
  );
}

const estMesa = StyleSheet.create({
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

// ================================================================
// src/screens/Acesso.js
// ================================================================
// Tela de login / cadastro
function Acesso({ onLogado, mesaPendente, onContinuarVisitante }) {
  const [modo, setModo] = useState('entrar');
  const [f, setF] = useState({ login: '', nome: '', email: '', usuario: '', senha: '', confirmar: '' });
  const [verSenha, setVerSenha] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');

  const set = (k) => (v) => {
    setF({ ...f, [k]: v });
    setErro('');
  };

  async function enviar() {
    setErro('');
    if (modo === 'cadastro') {
      const e = validarCadastro(f);
      if (e) return setErro(e);
    }
    setCarregando(true);
    try {
      const sessao = modo === 'entrar' ? await entrar(f.login, f.senha) : await cadastrar(f);
      onLogado(sessao);
    } catch (e) {
      setErro(e.message && !e.message.startsWith('Firestore') ? e.message : 'Erro de conexão com o servidor.');
      setCarregando(false);
    }
  }

  async function visitante() {
    setErro('');
    setCarregando(true);
    try {
      onLogado(await entrarAnonimo());
    } catch (e) {
      setErro(e.message && !e.message.startsWith('Firestore') ? e.message : 'Erro de conexão com o servidor.');
      setCarregando(false);
    }
  }

  const trocar = (m) => {
    setModo(m);
    setErro('');
    setF({ ...f, senha: '', confirmar: '' });
  };

  const Campo = (icone, chave, placeholder, extra = {}) => (
    <View style={estAcesso.campo}>
      <Icone name={icone} size={18} color={C.suave} />
      <TextInput
        style={estAcesso.input}
        value={f[chave]}
        onChangeText={set(chave)}
        placeholder={placeholder}
        placeholderTextColor={C.suave}
        autoCapitalize="none"
        autoCorrect={false}
        onSubmitEditing={enviar}
        {...extra}
      />
    </View>
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={estAcesso.tela} keyboardShouldPersistTaps="handled">
        <View style={estAcesso.cartao}>
          <View style={{ alignItems: 'center' }}>
            <Logo tamanho={72} id="logoAcesso" />
          </View>
          <Text style={estAcesso.titulo}>Mesa Vortex</Text>
          <Text style={estAcesso.sub}>sua mesa de RPG virtual, no bolso</Text>

          {!!mesaPendente && (
            <View style={estAcesso.avisoMesa}>
              <Icone name="dice-d20-outline" size={18} color={C.destaque2} />
              <Text style={estAcesso.avisoMesaTxt}>
                Entre para salvar a mesa <Text style={{ fontWeight: '800' }}>{mesaPendente}</Text> na sua conta. É opcional: você pode continuar como visitante.
              </Text>
            </View>
          )}

          <View style={estAcesso.abas}>
            {[
              ['entrar', 'Entrar'],
              ['cadastro', 'Criar conta'],
            ].map(([m, rot]) => (
              <TouchableOpacity key={m} style={[estAcesso.aba, modo === m && estAcesso.abaAtiva]} onPress={() => trocar(m)}>
                <Text style={[estAcesso.abaTxt, modo === m && { color: '#fff' }]}>{rot}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {modo === 'entrar' ? (
            <>
              {Campo('account-outline', 'login', 'Usuário ou e-mail')}
            </>
          ) : (
            <>
              {Campo('card-account-details-outline', 'nome', 'Nome de exibição', { autoCapitalize: 'words' })}
              {Campo('email-outline', 'email', 'E-mail', { keyboardType: 'email-address' })}
              {Campo('at', 'usuario', 'Nome de usuário')}
            </>
          )}

          <View style={estAcesso.campo}>
            <Icone name="lock-outline" size={18} color={C.suave} />
            <TextInput
              style={estAcesso.input}
              value={f.senha}
              onChangeText={set('senha')}
              placeholder="Senha"
              placeholderTextColor={C.suave}
              secureTextEntry={!verSenha}
              autoCapitalize="none"
              onSubmitEditing={enviar}
            />
            <TouchableOpacity onPress={() => setVerSenha(!verSenha)}>
              <Icone name={verSenha ? 'eye-off-outline' : 'eye-outline'} size={18} color={C.suave} />
            </TouchableOpacity>
          </View>

          {modo === 'cadastro' && (
            <>
              {Campo('lock-check-outline', 'confirmar', 'Confirmar senha', { secureTextEntry: !verSenha })}
              <Text style={estAcesso.regra}>Senha: mínimo 6 caracteres, com letras e números.</Text>
            </>
          )}

          {!!erro && (
            <View style={estAcesso.erroCaixa}>
              <Icone name="alert-circle-outline" size={16} color={C.perigo} />
              <Text style={estAcesso.erro}>{erro}</Text>
            </View>
          )}

          <TouchableOpacity style={estAcesso.botao} onPress={enviar} disabled={carregando}>
            {carregando ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={estAcesso.botaoTxt}>{modo === 'entrar' ? 'Entrar' : 'Criar minha conta'}</Text>
            )}
          </TouchableOpacity>

          <View style={estAcesso.divisor}>
            <View style={estAcesso.linha} />
            <Text style={estAcesso.ou}>ou</Text>
            <View style={estAcesso.linha} />
          </View>

          {!onContinuarVisitante && (
            <TouchableOpacity style={estAcesso.btnVisitante} onPress={visitante} disabled={carregando}>
              <Icone name="incognito" size={20} color={C.texto} />
              <Text style={[estAcesso.btnAltTxt, { color: C.texto }]}>Entrar como visitante</Text>
            </TouchableOpacity>
          )}

          {!!onContinuarVisitante && (
            <TouchableOpacity onPress={onContinuarVisitante} style={{ marginTop: 14 }}>
              <Text style={[estAcesso.link, { marginTop: 0, color: C.suave }]}>← Voltar à mesa como visitante</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity onPress={() => trocar(modo === 'entrar' ? 'cadastro' : 'entrar')}>
            <Text style={estAcesso.link}>
              {modo === 'entrar' ? 'Ainda não tem conta? Cadastre-se' : 'Já tem conta? Entrar'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const estAcesso = StyleSheet.create({
  tela: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 20, backgroundColor: C.bg },
  cartao: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: C.painel,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.borda,
    padding: 24,
  },
  titulo: { color: C.texto, fontSize: 26, fontWeight: '800', textAlign: 'center', marginTop: 8 },
  sub: { color: C.suave, textAlign: 'center', marginBottom: 18 },
  abas: { flexDirection: 'row', backgroundColor: C.painel2, borderRadius: 10, padding: 4, marginBottom: 16 },
  aba: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  abaAtiva: { backgroundColor: C.destaque },
  abaTxt: { color: C.suave, fontWeight: '700' },
  campo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.painel2,
    borderWidth: 1,
    borderColor: C.borda,
    borderRadius: 10,
    paddingHorizontal: 12,
    marginBottom: 10,
    gap: 8,
  },
  input: { flex: 1, color: C.texto, paddingVertical: 11, fontSize: 15 },
  regra: { color: C.suave, fontSize: 11, marginBottom: 8 },
  erroCaixa: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  erro: { color: C.perigo, flex: 1, fontSize: 13 },
  botao: {
    backgroundColor: C.destaque,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 6,
  },
  botaoTxt: { color: '#fff', fontWeight: '700', fontSize: 15 },
  link: { color: C.destaque2, textAlign: 'center', marginTop: 16 },
  avisoMesa: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    backgroundColor: 'rgba(34,211,238,0.1)',
    borderWidth: 1,
    borderColor: C.destaque2,
    borderRadius: 10,
    padding: 10,
    marginBottom: 14,
  },
  avisoMesaTxt: { color: C.texto, fontSize: 12, flex: 1 },
  divisor: { flexDirection: 'row', alignItems: 'center', marginVertical: 14 },
  linha: { flex: 1, height: 1, backgroundColor: C.borda },
  ou: { color: C.suave, marginHorizontal: 10, fontSize: 12 },
  btnVisitante: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: C.borda,
    backgroundColor: C.painel2,
    borderRadius: 10,
    paddingVertical: 12,
  },
  btnAltTxt: { color: '#fff', fontWeight: '700', fontSize: 15 },
});

// ================================================================
// src/screens/Inicio.js
// ================================================================
const CAMADAS_PADRAO = ['Cenário', 'Desenhos', 'Tokens'];

// Tela de ações: campanhas do usuário + atalhos (assets, packs, meus dados, postagens do admin)
function Inicio({ usuario, onAbrirMesa, onMeusAssets, onPacks, onPostagens, onPerfil, onEntrarConta, onCriarMapa }) {
  const admin = usuario.papel === 'admin';
  const [codigo, setCodigo] = useState('');
  const [nomeMesa, setNomeMesa] = useState('');
  const [mesas, setMesas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState('');
  const [confirmar, setConfirmar] = useState(null);
  const [notificacoes, setNotificacoes] = useState([]);
  const [verNotif, setVerNotif] = useState(false);

  async function carregarNotif() {
    try {
      setNotificacoes(await carregarNotificacoes(usuario.usuario, admin));
    } catch (e) {}
  }
  useEffect(() => {
    carregarNotif();
    const t = setInterval(carregarNotif, 20000);
    return () => clearInterval(t);
  }, []);

  const naoLidas = notificacoes.filter((n) => !n.lida);
  const pedidosPendentes = naoLidas.filter((n) => n.tipo === 'pedido').length;

  function abrirNotificacao(n) {
    if (!n.lida && n.para !== 'admins') {
      marcarLida(n.id);
      setNotificacoes((l) => l.map((x) => (x.id === n.id ? { ...x, lida: true } : x)));
    }
    setVerNotif(false);
    if (n.tipo === 'pedido') onPostagens('pendentes');
    else if (n.tipo === 'revisao') onPacks('meus');
  }

  async function carregar() {
    setCarregando(true);
    try {
      const [minhas, conta] = await Promise.all([
        consultar(COL.mesas, 'criador', usuario.usuario),
        lerDoc(`${COL.usuarios}/${usuario.usuario}`),
      ]);
      const minhasIds = new Set(minhas.map((m) => m.id));
      const recentes = ((conta && conta.recentes) || []).filter((c) => !minhasIds.has(c));
      const outras = (await Promise.all(recentes.map((c) => lerDoc(`${COL.mesas}/${c}`).catch(() => null)))).filter(Boolean);
      setMesas(
        [...minhas.map((m) => ({ ...m, papel: 'Mestre' })), ...outras.map((m) => ({ ...m, papel: 'Jogador' }))].sort(
          (a, b) => (b.criadoEm || 0) - (a.criadoEm || 0)
        )
      );
      setErro('');
    } catch (e) {
      setErro('Erro ao carregar suas campanhas.');
    }
    setCarregando(false);
  }

  useEffect(() => {
    carregar();
  }, []);

  async function criar() {
    setOcupado(true);
    setErro('');
    try {
      const cod = gerarCodigo();
      await salvar(`${COL.mesas}/${cod}`, {
        nome: nomeMesa.trim() || `Mesa de ${usuario.nome}`,
        criador: usuario.usuario,
        mestre: usuario.nome,
        mapUrl: '',
        mapW: 1400,
        mapH: 1000,
        grade: true,
        tamGrade: 70,
        snap: true,
        criadoEm: Date.now(),
      });
      await Promise.all(
        CAMADAS_PADRAO.map((n, i) =>
          salvar(`${COL.mesas}/${cod}/camadas/${gerarId()}`, { nome: n, ordem: i, visivel: true, travada: false })
        )
      );
      setNomeMesa('');
      onAbrirMesa(cod);
    } catch (e) {
      setErro('Não foi possível criar a campanha.');
    }
    setOcupado(false);
  }

  async function entrarPorCodigo() {
    const cod = codigo.trim().toUpperCase();
    if (cod.length < 4) return setErro('Código inválido.');
    setOcupado(true);
    setErro('');
    try {
      const mesa = await lerDoc(`${COL.mesas}/${cod}`);
      if (!mesa) setErro('Campanha não encontrada.');
      else {
        if (mesa.criador !== usuario.usuario) await registrarRecente(usuario.usuario, cod);
        setCodigo('');
        onAbrirMesa(cod);
      }
    } catch (e) {
      setErro('Erro de conexão.');
    }
    setOcupado(false);
  }

  async function excluirMesa(m) {
    if (confirmar !== m.id) {
      setConfirmar(m.id);
      setTimeout(() => setConfirmar((c) => (c === m.id ? null : c)), 2500);
      return;
    }
    setOcupado(true);
    try {
      const base = `${COL.mesas}/${m.id}`;
      const [cams, its] = await Promise.all([listar(`${base}/camadas`), listar(`${base}/itens`)]);
      await Promise.all([
        ...cams.map((x) => apagar(`${base}/camadas/${x.id}`)),
        ...its.map((x) => apagar(`${base}/itens/${x.id}`)),
      ]);
      await apagar(base);
      setMesas((l) => l.filter((x) => x.id !== m.id));
    } catch (e) {
      setErro('Erro ao excluir a campanha.');
    }
    setConfirmar(null);
    setOcupado(false);
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={estInicio.topo}>
        <Logo tamanho={34} id="logoTopo" />
        <Text style={estInicio.marca}>Mesa Vortex</Text>
        <TouchableOpacity style={estInicio.sino} onPress={() => setVerNotif(true)}>
          <Icone name={naoLidas.length ? 'bell-ring-outline' : 'bell-outline'} size={22} color={naoLidas.length ? '#eab308' : C.suave} />
          {naoLidas.length > 0 && (
            <View style={estInicio.badge}>
              <Text style={estInicio.badgeTxt}>{naoLidas.length > 9 ? '9+' : naoLidas.length}</Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity style={estInicio.perfil} onPress={onPerfil}>
          <Text style={estInicio.perfilNome} numberOfLines={1}>{usuario.nome}</Text>
          <View style={[estInicio.avatar, { backgroundColor: usuario.cor || C.destaque }]}>
            <Text style={estInicio.avatarTxt}>{usuario.nome.slice(0, 1).toUpperCase()}</Text>
          </View>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={estInicio.conteudo} keyboardShouldPersistTaps="handled">
        <Text style={estInicio.ola}>Olá, {usuario.nome.split(' ')[0]}!</Text>
        <Text style={estInicio.olaSub}>Pronto para a próxima sessão?</Text>

        {usuario.provedor === 'anonimo' && (
          <View style={estInicio.visitante}>
            <Icone name="incognito" size={20} color="#f59e0b" />
            <Text style={estInicio.visitanteTxt}>
              Você está como visitante. Entrar é opcional, mas garante que suas campanhas e tokens não se percam.
            </Text>
            <TouchableOpacity style={estInicio.visitanteBtn} onPress={onEntrarConta}>
              <Text style={{ color: '#000', fontWeight: '800', fontSize: 12 }}>Entrar</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={estInicio.acoes}>
          {[
            { rot: 'Meus assets', sub: 'fichas, objetos, mapas', icone: 'treasure-chest', cor: C.destaque, acao: onMeusAssets },
            { rot: 'Packs', sub: 'usar e criar packs', icone: 'package-variant', cor: C.destaque2, acao: () => onPacks() },
            { rot: 'Criar mapa', sub: 'masmorras e cavernas', icone: 'map-plus', cor: '#22c55e', acao: onCriarMapa },
            { rot: 'Meus dados', sub: 'perfil e conta', icone: 'account-details-outline', cor: '#f59e0b', acao: onPerfil },
            ...(admin
              ? [{ rot: 'Postagens', sub: pedidosPendentes ? `${pedidosPendentes} pedido(s)` : 'packs oficiais', icone: 'shield-crown-outline', cor: '#ef4444', acao: () => onPostagens(pedidosPendentes ? 'pendentes' : 'oficiais'), badge: pedidosPendentes }]
              : []),
          ].map((a) => (
            <TouchableOpacity key={a.rot} style={[estInicio.acao, { borderColor: a.cor }]} onPress={a.acao}>
              {!!a.badge && (
                <View style={[estInicio.badge, { top: 6, right: 6 }]}>
                  <Text style={estInicio.badgeTxt}>{a.badge}</Text>
                </View>
              )}
              <Icone name={a.icone} size={28} color={a.cor} />
              <Text style={estInicio.acaoTit}>{a.rot}</Text>
              <Text style={estInicio.acaoSub}>{a.sub}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={estInicio.cartao}>
          <Text style={estInicio.secao}>Nova campanha</Text>
          <View style={estInicio.linha}>
            <TextInput
              style={[estInicio.input, { flex: 1 }]}
              value={nomeMesa}
              onChangeText={setNomeMesa}
              placeholder="Nome da campanha (opcional)"
              placeholderTextColor={C.suave}
            />
            <TouchableOpacity style={estInicio.btnPrim} onPress={criar} disabled={ocupado}>
              <Icone name="plus" size={20} color="#fff" />
            </TouchableOpacity>
          </View>

          <Text style={[estInicio.secao, { marginTop: 14 }]}>Entrar com código</Text>
          <View style={estInicio.linha}>
            <TextInput
              style={[estInicio.input, { flex: 1, letterSpacing: 4, textAlign: 'center' }]}
              value={codigo}
              onChangeText={(t) => setCodigo(t.toUpperCase())}
              placeholder="CÓDIGO"
              placeholderTextColor={C.suave}
              autoCapitalize="characters"
              maxLength={6}
              onSubmitEditing={entrarPorCodigo}
            />
            <TouchableOpacity style={estInicio.btnSec} onPress={entrarPorCodigo} disabled={ocupado}>
              <Icone name="login" size={20} color={C.destaque2} />
            </TouchableOpacity>
          </View>
          {ocupado && <ActivityIndicator color={C.destaque} style={{ marginTop: 10 }} />}
          {!!erro && <Text style={estInicio.erro}>{erro}</Text>}
        </View>

        <View style={estInicio.cabLista}>
          <Text style={estInicio.secao}>Suas campanhas ({mesas.length})</Text>
          <TouchableOpacity onPress={carregar}>
            <Icone name="refresh" size={18} color={C.suave} />
          </TouchableOpacity>
        </View>

        {carregando ? (
          <ActivityIndicator color={C.destaque} />
        ) : mesas.length === 0 ? (
          <Text style={estInicio.vazio}>Você ainda não criou nem entrou em nenhuma campanha.</Text>
        ) : (
          mesas.map((m) => (
            <TouchableOpacity key={m.id} style={estInicio.mesa} onPress={() => onAbrirMesa(m.id)}>
              <View style={[estInicio.mesaIcone, m.papel === 'Mestre' && { backgroundColor: 'rgba(139,92,246,0.25)' }]}>
                <Icone name={m.papel === 'Mestre' ? 'crown-outline' : 'dice-d20-outline'} size={22} color={m.papel === 'Mestre' ? C.destaque : C.destaque2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={estInicio.mesaNome} numberOfLines={1}>{m.nome}</Text>
                <Text style={estInicio.mesaInfo}>
                  {m.id} · {m.papel}
                  {m.papel === 'Jogador' && m.mestre ? ` · mestre: ${m.mestre}` : ''}
                </Text>
              </View>
              {m.papel === 'Mestre' && (
                <TouchableOpacity onPress={() => excluirMesa(m)} style={{ padding: 6 }}>
                  <Icone
                    name={confirmar === m.id ? 'check-bold' : 'trash-can-outline'}
                    size={18}
                    color={confirmar === m.id ? C.perigo : C.suave}
                  />
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          ))
        )}
        {!!confirmar && <Text style={estInicio.aviso}>Toque de novo na lixeira para excluir a campanha.</Text>}
      </ScrollView>

      <Modal visible={verNotif} transparent animationType="fade" onRequestClose={() => setVerNotif(false)}>
        <View style={estInicio.fundoNotif}>
          <View style={estInicio.caixaNotif}>
            <View style={[estInicio.linha, { justifyContent: 'space-between', marginBottom: 6 }]}>
              <Text style={[estInicio.ola, { fontSize: 18 }]}>Notificações</Text>
              <TouchableOpacity onPress={() => setVerNotif(false)}>
                <Icone name="close" size={22} color={C.suave} />
              </TouchableOpacity>
            </View>
            <ScrollView>
              {notificacoes.length === 0 && <Text style={estInicio.vazio}>Nada por aqui ainda.</Text>}
              {notificacoes.slice(0, 40).map((n) => {
                const icone =
                  n.tipo === 'pedido' ? 'inbox-arrow-down' : n.decisao === 'aprovado' ? 'check-decagram' : n.decisao === 'recusado' ? 'close-octagon-outline' : 'message-alert-outline';
                const cor = n.tipo === 'pedido' ? '#eab308' : n.decisao === 'aprovado' ? C.ok : n.decisao === 'recusado' ? C.perigo : '#f97316';
                return (
                  <TouchableOpacity key={n.id} style={[estInicio.notif, n.lida && { opacity: 0.5 }]} onPress={() => abrirNotificacao(n)}>
                    <Icone name={icone} size={22} color={cor} />
                    <View style={{ flex: 1 }}>
                      <Text style={estInicio.notifTxt}>{n.texto}</Text>
                      {!!n.comentario && <Text style={estInicio.notifCom}>"{n.comentario}" — {n.por}</Text>}
                      <Text style={estInicio.notifData}>{n.em ? new Date(n.em).toLocaleString('pt-BR') : ''}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const estInicio = StyleSheet.create({
  topo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: C.painel,
    borderBottomWidth: 1,
    borderColor: C.borda,
  },
  marca: { color: C.texto, fontWeight: '800', fontSize: 17, flex: 1 },
  perfil: { flexDirection: 'row', alignItems: 'center', gap: 8, maxWidth: '50%' },
  perfilNome: { color: C.suave, fontSize: 13, flexShrink: 1 },
  avatar: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
  avatarTxt: { color: '#fff', fontWeight: '800' },
  conteudo: { padding: 16, gap: 12, maxWidth: 560, width: '100%', alignSelf: 'center' },
  ola: { color: C.texto, fontSize: 24, fontWeight: '800' },
  olaSub: { color: C.suave, marginTop: -8, marginBottom: 4 },
  cartao: { backgroundColor: C.painel, borderRadius: 14, borderWidth: 1, borderColor: C.borda, padding: 16 },
  secao: { color: C.suave, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', marginBottom: 8 },
  linha: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: {
    backgroundColor: C.painel2,
    borderWidth: 1,
    borderColor: C.borda,
    color: C.texto,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  btnPrim: { backgroundColor: C.destaque, borderRadius: 10, padding: 11 },
  btnSec: { borderWidth: 1, borderColor: C.destaque2, borderRadius: 10, padding: 10 },
  erro: { color: C.perigo, marginTop: 10, textAlign: 'center' },
  acoes: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  sino: { padding: 6 },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: C.perigo,
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeTxt: { color: '#fff', fontSize: 10, fontWeight: '800' },
  fundoNotif: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  caixaNotif: { width: '100%', maxWidth: 440, maxHeight: '80%', backgroundColor: C.painel, borderRadius: 16, borderWidth: 1, borderColor: C.borda, padding: 16 },
  notif: { flexDirection: 'row', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderColor: C.borda },
  notifTxt: { color: C.texto, fontSize: 13 },
  notifCom: { color: C.suave, fontSize: 12, fontStyle: 'italic', marginTop: 3 },
  notifData: { color: C.suave, fontSize: 10, marginTop: 3 },
  visitante: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#f59e0b',
    backgroundColor: 'rgba(245,158,11,0.1)',
    borderRadius: 12,
    padding: 12,
  },
  visitanteTxt: { color: C.texto, fontSize: 12, flex: 1 },
  visitanteBtn: { backgroundColor: '#f59e0b', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  acao: {
    flexGrow: 1,
    flexBasis: '22%',
    minWidth: 78,
    alignItems: 'center',
    backgroundColor: C.painel,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 6,
    gap: 2,
  },
  acaoTit: { color: C.texto, fontWeight: '700', fontSize: 13, marginTop: 4, textAlign: 'center' },
  acaoSub: { color: C.suave, fontSize: 10, textAlign: 'center' },
  atalho: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: C.painel,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.destaque2,
    padding: 16,
  },
  atalhoTit: { color: C.texto, fontWeight: '700', fontSize: 15 },
  atalhoSub: { color: C.suave, fontSize: 12 },
  cabLista: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
  vazio: { color: C.suave, textAlign: 'center', paddingVertical: 20 },
  mesa: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: C.painel,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.borda,
    padding: 12,
  },
  mesaIcone: { width: 42, height: 42, borderRadius: 10, backgroundColor: 'rgba(34,211,238,0.15)', alignItems: 'center', justifyContent: 'center' },
  mesaNome: { color: C.texto, fontWeight: '700' },
  mesaInfo: { color: C.suave, fontSize: 12 },
  aviso: { color: C.perigo, fontSize: 12, textAlign: 'center' },
});

// ================================================================
// src/components/EditorObjeto.js
// ================================================================
// ---------- editor de objeto (adereço) ----------
function EditorObjeto({ asset, onSalvar, onApagar, onFechar, autor, pastas }) {
  const [f, setF] = useState({ nome: '', emoji: '🪨', img: '', w: 1, h: 1, ...asset });
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));

  async function salvarObj() {
    if (f.nome.trim().length < 2) return setErro('Dê um nome ao objeto.');
    setOcupado(true);
    try {
      await onSalvar({ ...f, tipo: 'objeto', nome: f.nome.trim() });
    } catch (e) {
      setErro('Erro ao salvar.');
      setOcupado(false);
    }
  }

  return (
    <Modal transparent animationType="fade" onRequestClose={onFechar}>
      <View style={estEditorObjeto.fundo}>
        <View style={estEditorObjeto.modal}>
          <View style={estEditorObjeto.topo}>
            <AssetMini asset={{ ...f, tipo: 'objeto' }} tamanho={46} />
            <Text style={estEditorObjeto.titulo}>{f.id ? 'Editar item de cenário' : 'Novo item de cenário'}</Text>
            <TouchableOpacity onPress={onFechar}>
              <Icone name="close" size={22} color={C.suave} />
            </TouchableOpacity>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={estEditorObjeto.rotulo}>Nome</Text>
            <TextInput style={estEditorObjeto.input} value={f.nome} onChangeText={(t) => set('nome', t)} placeholder="Ex.: Árvore antiga, mesa de pedra" placeholderTextColor={C.suave} />

            {!!pastas && <CampoPasta valor={f.pasta || ''} pastas={pastas} onMudar={(v) => set('pasta', v)} />}

            <Text style={estEditorObjeto.rotulo}>Ícone</Text>
            <View style={estEditorObjeto.emojis}>
              {EMOJIS.map((e) => (
                <TouchableOpacity key={e} onPress={() => set('emoji', e)} style={[estEditorObjeto.emoji, f.emoji === e && !f.img && estEditorObjeto.emojiSel]}>
                  <Text style={{ fontSize: 22 }}>{e}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <CampoImagem valor={f.img} onMudar={(ref) => set('img', ref)} largura={512} rotulo="Ou use uma imagem (substitui o ícone)" autor={autor} />

            <Text style={estEditorObjeto.rotulo}>Tamanho (células)</Text>
            <View style={estEditorObjeto.linha}>
              <Text style={estEditorObjeto.rotMini}>Largura</Text>
              {[1, 2, 3, 4].map((n) => (
                <TouchableOpacity key={'w' + n} onPress={() => set('w', n)} style={[estEditorObjeto.chip, f.w === n && estEditorObjeto.chipAtivo]}>
                  <Text style={estEditorObjeto.chipTxt}>{n}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={[estEditorObjeto.linha, { marginTop: 6 }]}>
              <Text style={estEditorObjeto.rotMini}>Altura</Text>
              {[1, 2, 3, 4].map((n) => (
                <TouchableOpacity key={'h' + n} onPress={() => set('h', n)} style={[estEditorObjeto.chip, f.h === n && estEditorObjeto.chipAtivo]}>
                  <Text style={estEditorObjeto.chipTxt}>{n}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
          {!!erro && <Text style={{ color: C.perigo, marginTop: 6 }}>{erro}</Text>}
          <View style={estEditorObjeto.acoes}>
            {!!onApagar && !!f.id && (
              <TouchableOpacity
                style={[estEditorObjeto.btn, { borderWidth: 1, borderColor: C.perigo }]}
                onPress={() => (confirmar ? onApagar() : setConfirmar(true))}
              >
                <Text style={{ color: C.perigo, fontWeight: '700' }}>{confirmar ? 'Confirmar?' : 'Excluir'}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={[estEditorObjeto.btn, { backgroundColor: C.destaque }]} onPress={salvarObj} disabled={ocupado}>
              {ocupado ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '700' }}>Salvar</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}


const estEditorObjeto = StyleSheet.create({
  fundo: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', alignItems: 'center', padding: 14 },
  modal: { width: '100%', maxWidth: 460, maxHeight: '92%', backgroundColor: C.painel, borderRadius: 16, borderWidth: 1, borderColor: C.borda, padding: 16 },
  topo: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  titulo: { color: C.texto, fontWeight: '800', fontSize: 17, flex: 1 },
  rotulo: { color: C.suave, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', marginTop: 12, marginBottom: 6 },
  rotMini: { color: C.suave, fontSize: 12, width: 60 },
  input: { backgroundColor: C.painel2, borderWidth: 1, borderColor: C.borda, color: C.texto, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 },
  emojis: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 6 },
  emoji: { width: 40, height: 40, borderRadius: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'transparent' },
  emojiSel: { borderColor: C.destaque2, backgroundColor: 'rgba(34,211,238,0.12)' },
  linha: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  chip: { minWidth: 34, height: 30, borderRadius: 8, borderWidth: 1, borderColor: C.borda, alignItems: 'center', justifyContent: 'center' },
  chipAtivo: { borderColor: C.destaque, backgroundColor: 'rgba(139,92,246,0.3)' },
  chipTxt: { color: C.texto, fontWeight: '700' },
  acoes: { flexDirection: 'row', gap: 8, marginTop: 14 },
  btn: { flex: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
});

// ================================================================
// src/screens/Packs.js
// ================================================================
const ICONES_PACK = ['cards-outline', 'shield-sword-outline', 'skull-outline', 'pine-tree', 'castle', 'glass-mug-variant', 'map-legend', 'rocket-launch-outline', 'ghost-outline', 'treasure-chest', 'home-city', 'dragon'];

function CapaPack({ pack, tamanho = 56 }) {
  const src = useImagem(pack.capa);
  return (
    <View style={[estPacks.capa, { width: tamanho, height: tamanho, backgroundColor: pack.cor || C.destaque }]}>
      {src ? (
        <Image source={{ uri: src }} style={{ width: tamanho, height: tamanho }} resizeMode="cover" />
      ) : (
        <Icone name={pack.icone || 'cards-outline'} size={tamanho * 0.5} color="#fff" />
      )}
    </View>
  );
}

const contagem = (assets) =>
  TIPOS_ASSET.map((t) => [t, assets.filter((a) => a.tipo === t.id).length])
    .filter(([, n]) => n)
    .map(([t, n]) => `${n} ${t.nome.toLowerCase()}`)
    .join(' · ') || 'vazio';

function SeloStatus({ pack }) {
  const st = STATUS_PACK[statusDoPack(pack)];
  return (
    <View style={[estPacks.seloStatus, { borderColor: st.cor }]}>
      <Icone name={st.icone} size={11} color={st.cor} />
      <Text style={[estPacks.seloStatusTxt, { color: st.cor }]}>{st.nome}</Text>
    </View>
  );
}

function FiltroNicho({ valor, onMudar }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingHorizontal: 12 }}>
      {[{ id: 'Todos', icone: 'apps' }, ...NICHOS].map((n) => (
        <TouchableOpacity key={n.id} onPress={() => onMudar(n.id)} style={[estPacks.chip, valor === n.id && estPacks.chipAtivo]}>
          <Icone name={n.icone} size={14} color={valor === n.id ? '#fff' : C.suave} />
          <Text style={[estPacks.chipTxt, valor === n.id && { color: '#fff' }]}>{n.id}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

function AbasTopo({ abas, atual, onMudar }) {
  return (
    <View style={estPacks.abasTopo}>
      {abas.map((a) => (
        <TouchableOpacity key={a.id} onPress={() => onMudar(a.id)} style={[estPacks.abaTopo, atual === a.id && estPacks.abaTopoAtiva]}>
          <Icone name={a.icone} size={18} color={atual === a.id ? C.destaque2 : C.suave} />
          <Text style={[estPacks.abaTopoTxt, atual === a.id && { color: C.destaque2 }]}>{a.nome}</Text>
          {!!a.badge && (
            <View style={estPacks.badge}>
              <Text style={estPacks.badgeTxt}>{a.badge}</Text>
            </View>
          )}
        </TouchableOpacity>
      ))}
    </View>
  );
}

// Lista de assets de um pack, separada por abas de tipo
function AssetsDoPack({ assets, renderAcoes, onAbrir }) {
  const tipos = TIPOS_ASSET.filter((t) => assets.some((a) => a.tipo === t.id));
  const [aba, setAba] = useState(tipos[0] ? tipos[0].id : 'personagem');
  const efetiva = tipos.some((t) => t.id === aba) ? aba : tipos[0] ? tipos[0].id : aba;
  const lista = assets.filter((a) => a.tipo === efetiva);
  if (!assets.length) return <Text style={estPacks.vazio}>Nenhum asset neste pack ainda.</Text>;
  return (
    <View>
      <View style={estPacks.abas}>
        {tipos.map((t) => (
          <TouchableOpacity key={t.id} onPress={() => setAba(t.id)} style={[estPacks.aba, efetiva === t.id && estPacks.abaAtiva]}>
            <Icone name={t.icone} size={14} color={efetiva === t.id ? C.destaque2 : C.suave} />
            <Text style={[estPacks.abaTxt, efetiva === t.id && { color: C.destaque2 }]}>{t.nome}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {agruparPorPasta(lista).map((g) => (
        <View key={g.pasta}>
          {(g.pasta !== SEM_PASTA || lista.some((a) => a.pasta)) && <CabecalhoPasta nome={g.pasta} quantidade={g.itens.length} />}
          {g.itens.map((a) => (
            <TouchableOpacity key={a.id} style={estPacks.assetLinha} onPress={() => onAbrir && onAbrir(a)} activeOpacity={onAbrir ? 0.6 : 1}>
              <AssetMini asset={a} tamanho={38} />
              <View style={{ flex: 1 }}>
                <Text style={estPacks.assetNome}>{a.nome}</Text>
                <Text style={estPacks.assetInfo}>{resumoAsset(a)}</Text>
              </View>
              {renderAcoes && renderAcoes(a)}
            </TouchableOpacity>
          ))}
        </View>
      ))}
    </View>
  );
}

// Caixa com a última revisão do admin (comentário + aceitos/não aceitos)
function CaixaRevisao({ revisao }) {
  if (!revisao) return null;
  const cor = revisao.decisao === 'aprovado' ? C.ok : revisao.decisao === 'recusado' ? C.perigo : '#f97316';
  const titulo = revisao.decisao === 'aprovado' ? 'Aprovado' : revisao.decisao === 'recusado' ? 'Recusado' : 'Devolvido com ressalvas';
  return (
    <View style={[estPacks.revisao, { borderColor: cor }]}>
      <View style={estPacks.linha}>
        <Icone name="comment-quote-outline" size={16} color={cor} />
        <Text style={[estPacks.revisaoTit, { color: cor }]}>{titulo}</Text>
        <Text style={estPacks.revisaoPor}>por {revisao.por}</Text>
      </View>
      {!!revisao.comentario && <Text style={estPacks.revisaoTxt}>"{revisao.comentario}"</Text>}
      <Text style={estPacks.revisaoNums}>
        ✓ {(revisao.aceitos || []).length} aceitos · ✗ {(revisao.recusados || []).length} não aceitos
      </Text>
    </View>
  );
}

// ======== Gerenciador de packs editáveis (admin: oficiais · jogador: meus packs) ========
function GerenciadorPacks({ usuario, lista, setTodos, meus, modoAdmin, novoPack, renderStatus, podeEditar, filtroNicho, vazio }) {
  const [aberto, setAberto] = useState(null);
  const [editPack, setEditPack] = useState(null);
  const [editFicha, setEditFicha] = useState(null); // { asset, pack }
  const [editObjeto, setEditObjeto] = useState(null);
  const [renomear, setRenomear] = useState(null);
  const [importarPara, setImportarPara] = useState(null);
  const [recemCriado, setRecemCriado] = useState(null);

  // manterAberto: ao criar um pack novo o editor continua aberto para adicionar tokens e fichas
  async function gravarPack(p, manterAberto = false) {
    const { assets, ...dados } = p;
    const final = { ...dados, id: p.id || gerarId(), autor: p.autor || usuario.nome, criadoEm: p.criadoEm || Date.now(), atualizadoEm: Date.now() };
    await salvar(`${COL.packs}/${final.id}`, final);
    setTodos((l) => {
      const antigo = l.find((x) => x.id === final.id);
      const novo = { ...final, assets: antigo ? antigo.assets : [] };
      return antigo ? l.map((x) => (x.id === final.id ? novo : x)) : [...l, novo];
    });
    if (manterAberto) {
      setEditPack(final);
      setAberto(final.id);
      setRecemCriado(final.id);
    } else {
      setEditPack(null);
      setRecemCriado(null);
    }
    return final;
  }

  async function excluirPack(p) {
    await Promise.all((p.assets || []).map((a) => apagar(`${COL.assets}/${a.id}`)));
    await apagar(`${COL.packs}/${p.id}`);
    setTodos((l) => l.filter((x) => x.id !== p.id));
    setEditPack(null);
  }

  async function gravarAsset(asset, packId) {
    const final = { ...asset, id: asset.id || gerarId(), pack: packId, autor: asset.autor || usuario.nome, criadoEm: asset.criadoEm || Date.now(), atualizadoEm: Date.now() };
    await salvar(`${COL.assets}/${final.id}`, final);
    setTodos((l) =>
      l.map((p) => (p.id === packId ? { ...p, assets: [...p.assets.filter((a) => a.id !== final.id), final].sort((a, b) => a.nome.localeCompare(b.nome)) } : p))
    );
  }

  async function excluirAsset(asset) {
    await apagar(`${COL.assets}/${asset.id}`);
    setTodos((l) => l.map((p) => ({ ...p, assets: p.assets.filter((a) => a.id !== asset.id) })));
  }

  async function importar(asset, pack) {
    const { origem, adicionadoEm, ...resto } = asset;
    await gravarAsset({ ...resto, id: gerarId(), criadoEm: Date.now() }, pack.id);
  }

  const visiveis = lista.filter((p) => filtroNicho === 'Todos' || p.nicho === filtroNicho);
  const marcaDe = (p, a) => {
    const r = p.revisao;
    if (!r || ehOficial(p)) return null;
    if ((r.aceitos || []).includes(a.id)) return 'ok';
    if ((r.recusados || []).includes(a.id)) return 'nao';
    return 'novo';
  };

  return (
    <View style={{ gap: 12 }}>
      <TouchableOpacity style={estPacks.btnNovo} onPress={() => setEditPack(novoPack())}>
        <Icone name="plus" size={20} color="#fff" />
        <Text style={{ color: '#fff', fontWeight: '800' }}>Novo pack</Text>
      </TouchableOpacity>
      {visiveis.length === 0 && <Text style={estPacks.vazio}>{vazio}</Text>}

      {visiveis.map((p) => {
        const editavel = podeEditar(p);
        return (
          <View key={p.id} style={estPacks.card}>
            <TouchableOpacity style={estPacks.cardTopo} onPress={() => setAberto(aberto === p.id ? null : p.id)}>
              <CapaPack pack={p} />
              <View style={{ flex: 1 }}>
                <Text style={estPacks.packNome}>{p.nome}</Text>
                <View style={estPacks.linha}>
                  <Icone name={ICONE_NICHO[p.nicho] || 'tag-outline'} size={12} color={C.destaque2} />
                  <Text style={estPacks.nicho}>{p.nicho || 'Outros'}</Text>
                  {modoAdmin ? (
                    <Text style={[estPacks.selo, p.publicado ? estPacks.seloPub : estPacks.seloRasc]}>{p.publicado ? 'Publicado' : 'Rascunho'}</Text>
                  ) : (
                    <SeloStatus pack={p} />
                  )}
                </View>
                <Text style={estPacks.packInfo}>
                  {contagem(p.assets)}
                  {modoAdmin && p.dono ? ` · de ${p.autor}` : ''}
                </Text>
              </View>
              {editavel && (
                <TouchableOpacity onPress={() => setEditPack(p)} style={{ padding: 6 }}>
                  <Icone name="pencil-outline" size={20} color={C.suave} />
                </TouchableOpacity>
              )}
            </TouchableOpacity>

            {modoAdmin && (
              <TouchableOpacity style={[estPacks.btnUsar, p.publicado && estPacks.btnUsarOn]} onPress={() => gravarPack({ ...p, publicado: !p.publicado })}>
                <Icone name={p.publicado ? 'earth' : 'earth-off'} size={18} color={p.publicado ? '#fff' : C.destaque2} />
                <Text style={[estPacks.btnUsarTxt, p.publicado && { color: '#fff' }]}>{p.publicado ? 'Publicado (toque para despublicar)' : 'Publicar para todos'}</Text>
              </TouchableOpacity>
            )}

            {renderStatus && renderStatus(p, gravarPack)}

            {aberto === p.id && (
              <View style={{ marginTop: 10 }}>
                {editavel ? (
                  <View style={estPacks.acoesPack}>
                    <BotaoMini icone="account-plus-outline" rotulo="Personagem (com ficha)" onPress={() => setEditFicha({ asset: { tipo: 'Inimigo', recursos: [{ nome: 'Vida', atual: 10, max: 10 }] }, pack: p })} />
                    <BotaoMini icone="pine-tree" rotulo="Cenário" onPress={() => setEditObjeto({ asset: {}, pack: p })} />
                    <BotaoMini icone="import" rotulo="Dos meus assets" onPress={() => setImportarPara(p)} />
                  </View>
                ) : (
                  <Text style={[estPacks.dica, { marginBottom: 6, marginTop: 0 }]}>
                    {statusDoPack(p) === 'pendente' ? 'Em análise: não dá para editar até a resposta do admin.' : 'Pack oficial: a edição agora é feita pelos admins.'}
                  </Text>
                )}
                <AssetsDoPack
                  key={p.assets.length}
                  assets={p.assets}
                  onAbrir={
                    editavel
                      ? (a) => {
                          if (a.tipo === 'personagem') setEditFicha({ asset: fichaDoAsset(a), pack: p });
                          else if (a.tipo === 'objeto') setEditObjeto({ asset: a, pack: p });
                          else setRenomear(a);
                        }
                      : null
                  }
                  renderAcoes={(a) => {
                    const m = marcaDe(p, a);
                    if (m === 'ok') return <Icone name="check-circle" size={18} color={C.ok} />;
                    if (m === 'nao') return <Icone name="close-circle" size={18} color={C.perigo} />;
                    if (m === 'novo') return <Text style={estPacks.novoTxt}>novo</Text>;
                    return editavel ? <Icone name="pencil-outline" size={16} color={C.suave} /> : null;
                  }}
                />
                {editavel && <Text style={estPacks.dica}>Estruturas e mapas são criados na mesa (aba Construir), salvos em Meus assets e trazidos com "Dos meus assets".</Text>}
              </View>
            )}
          </View>
        );
      })}

      {editPack && (
        <EditorPack
          key={editPack.id || 'novo'}
          pack={editPack}
          autor={usuario.nome}
          podePublicar={modoAdmin}
          recemCriado={recemCriado === editPack.id}
          assets={editPack.id ? ((lista.find((x) => x.id === editPack.id) || {}).assets || []) : []}
          onSalvar={(dados) => gravarPack(dados, !dados.id)}
          onExcluir={editPack.id ? () => excluirPack(editPack) : null}
          onNovoToken={() => setEditFicha({ asset: { tipo: 'Inimigo', recursos: [{ nome: 'Vida', atual: 10, max: 10 }] }, pack: editPack })}
          onNovoObjeto={() => setEditObjeto({ asset: {}, pack: editPack })}
          onImportar={() => setImportarPara(editPack)}
          onAbrirAsset={(a) => {
            if (a.tipo === 'personagem') setEditFicha({ asset: fichaDoAsset(a), pack: editPack });
            else if (a.tipo === 'objeto') setEditObjeto({ asset: a, pack: editPack });
            else setRenomear(a);
          }}
          onFechar={() => {
            setEditPack(null);
            setRecemCriado(null);
          }}
        />
      )}

      {editFicha && (
        <FichaVortex
          ficha={editFicha.asset}
          titulo={`Personagem · ${editFicha.pack.nome}`}
          pastas={pastasDe(((lista.find((x) => x.id === editFicha.pack.id) || {}).assets || []).filter((a) => a.tipo === 'personagem'))}
          onSalvar={async (f) => {
            await gravarAsset(assetDaFicha(f, { pack: editFicha.pack.id }), editFicha.pack.id);
            setEditFicha(null);
          }}
          onApagar={
            editFicha.asset.id
              ? async () => {
                  await excluirAsset(editFicha.asset);
                  setEditFicha(null);
                }
              : null
          }
          onFechar={() => setEditFicha(null)}
        />
      )}

      {editObjeto && (
        <EditorObjeto
          asset={editObjeto.asset}
          autor={usuario.nome}
          pastas={pastasDe(((lista.find((x) => x.id === editObjeto.pack.id) || {}).assets || []).filter((a) => a.tipo === 'objeto'))}
          onSalvar={async (o) => {
            await gravarAsset(o, editObjeto.pack.id);
            setEditObjeto(null);
          }}
          onApagar={async () => {
            await excluirAsset(editObjeto.asset);
            setEditObjeto(null);
          }}
          onFechar={() => setEditObjeto(null)}
        />
      )}

      {renomear && (
        <ModalNome
          titulo={`${NOME_TIPO_ASSET[renomear.tipo]}: ${renomear.nome}`}
          valorInicial={renomear.nome}
          detalhe="Renomeie ou exclua este asset do pack."
          onConfirmar={async (n) => {
            await gravarAsset({ ...renomear, nome: n }, renomear.pack);
            setRenomear(null);
          }}
          onExcluir={async () => {
            await excluirAsset(renomear);
            setRenomear(null);
          }}
          onFechar={() => setRenomear(null)}
        />
      )}

      {importarPara && (
        <Modal transparent animationType="fade" onRequestClose={() => setImportarPara(null)}>
          <View style={estPacks.fundo}>
            <View style={estPacks.modal}>
              <View style={estPacks.linhaTopo}>
                <Text style={estPacks.modalTitulo}>Enviar para "{importarPara.nome}"</Text>
                <TouchableOpacity onPress={() => setImportarPara(null)}>
                  <Icone name="close" size={22} color={C.suave} />
                </TouchableOpacity>
              </View>
              <ScrollView>
                {meus.length === 0 && <Text style={estPacks.vazio}>Você ainda não tem assets próprios. Crie na mesa (aba Construir) ou em Meus assets.</Text>}
                {meus.map((a) => (
                  <TouchableOpacity
                    key={a.id}
                    style={estPacks.assetLinha}
                    onPress={async () => {
                      await importar(a, importarPara);
                      setImportarPara(null);
                    }}
                  >
                    <AssetMini asset={a} tamanho={38} />
                    <View style={{ flex: 1 }}>
                      <Text style={estPacks.assetNome}>{a.nome}</Text>
                      <Text style={estPacks.assetInfo}>{NOME_TIPO_ASSET[a.tipo]} · {resumoAsset(a)}</Text>
                    </View>
                    <Icone name="send" size={18} color={C.destaque2} />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

// ================= Packs (usuário): Oficiais + Meus packs =================
function PacksUsuario({ usuario, onVoltar, abaInicial }) {
  const [aba, setAba] = useState(abaInicial || 'oficiais');
  const [todos, setTodos] = useState([]);
  const [ativos, setAtivos] = useState(null);
  const [meus, setMeus] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [nicho, setNicho] = useState('Todos');
  const [aberto, setAberto] = useState(null);
  const [vendo, setVendo] = useState(null);
  const [confirmarEnvio, setConfirmarEnvio] = useState(null);

  async function recarregar() {
    setCarregando(true);
    setErro('');
    try {
      const [p, at, m] = await Promise.all([carregarTodosPacks(), lerPacksAtivos(usuario.usuario), carregarMeusAssets(usuario.usuario)]);
      setTodos(p);
      setAtivos(at);
      setMeus(m);
    } catch (e) {
      setErro('Não foi possível carregar os packs.');
    }
    setCarregando(false);
  }
  useEffect(() => {
    recarregar();
  }, []);

  const oficiais = todos.filter((p) => ehOficial(p) && p.publicado);
  const meusPacks = todos.filter((p) => p.dono === usuario.usuario);
  const copiados = {};
  meus.forEach((m) => m.origem && (copiados[m.origem] = true));

  function alternar(p) {
    const usaveis = todos.filter((x) => (ehOficial(x) && x.publicado) || x.dono === usuario.usuario).map((x) => x.id);
    const atual = ativos === null ? usaveis : ativos;
    const novo = atual.includes(p.id) ? atual.filter((x) => x !== p.id) : [...atual, p.id];
    setAtivos(novo);
    salvarPacksAtivos(usuario.usuario, novo).catch(() => setErro('Erro ao salvar sua escolha.'));
  }

  async function copiar(a) {
    const { pack, ...resto } = a;
    const id = `pk_${a.id}`;
    await salvar(`${assetsDe(usuario.usuario)}/${id}`, { ...resto, id, origem: a.id, adicionadoEm: Date.now() });
    setMeus((l) => [...l, { ...resto, id, origem: a.id }]);
  }

  async function oficializar(p, gravarPack) {
    setConfirmarEnvio(null);
    if (!p.assets.length) return setErro('Adicione ao menos um asset antes de pedir a oficialização.');
    await gravarPack({ ...p, status: 'pendente', enviadoEm: Date.now() });
    await notificar('admins', {
      tipo: 'pedido',
      packId: p.id,
      texto: `${usuario.nome} enviou o pack "${p.nome}" (${p.assets.length} assets) para oficialização.`,
    });
  }

  const botaoUsar = (p) => {
    const ativo = packEstaAtivo(ativos, p.id);
    return (
      <TouchableOpacity style={[estPacks.btnUsar, ativo && estPacks.btnUsarOn]} onPress={() => alternar(p)}>
        <Icone name={ativo ? 'check-circle' : 'plus-circle-outline'} size={18} color={ativo ? '#fff' : C.destaque2} />
        <Text style={[estPacks.btnUsarTxt, ativo && { color: '#fff' }]}>{ativo ? 'Usando na mesa' : 'Usar na mesa'}</Text>
      </TouchableOpacity>
    );
  };

  const nAtivos = oficiais.filter((p) => packEstaAtivo(ativos, p.id)).length;
  const nRetornos = meusPacks.filter((p) => p.status === 'ressalvas' || p.status === 'recusado').length;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Topo titulo="Packs de assets" sub={`${nAtivos} oficiais em uso · ${meusPacks.length} seus`} onVoltar={onVoltar} onRecarregar={recarregar} />
      <AbasTopo
        abas={[
          { id: 'oficiais', nome: 'Oficiais', icone: 'check-decagram' },
          { id: 'meus', nome: 'Meus packs', icone: 'package-variant-closed', badge: nRetornos || null },
        ]}
        atual={aba}
        onMudar={setAba}
      />
      <View style={{ paddingVertical: 8 }}>
        <FiltroNicho valor={nicho} onMudar={setNicho} />
      </View>
      {carregando ? (
        <ActivityIndicator color={C.destaque} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={estPacks.lista}>
          {!!erro && <Text style={estPacks.erro}>{erro}</Text>}

          {aba === 'oficiais' ? (
            <>
              <Text style={estPacks.explica}>Packs ativados aparecem na aba Assets da mesa, prontos para colocar no mapa.</Text>
              {oficiais.filter((p) => nicho === 'Todos' || p.nicho === nicho).length === 0 && <Text style={estPacks.vazio}>Nenhum pack neste nicho.</Text>}
              {oficiais
                .filter((p) => nicho === 'Todos' || p.nicho === nicho)
                .map((p) => {
                  const ativo = packEstaAtivo(ativos, p.id);
                  return (
                    <View key={p.id} style={[estPacks.card, ativo && { borderColor: p.cor || C.destaque }]}>
                      <TouchableOpacity style={estPacks.cardTopo} onPress={() => setAberto(aberto === p.id ? null : p.id)}>
                        <CapaPack pack={p} />
                        <View style={{ flex: 1 }}>
                          <Text style={estPacks.packNome}>{p.nome}</Text>
                          <View style={estPacks.linha}>
                            <Icone name={ICONE_NICHO[p.nicho] || 'tag-outline'} size={12} color={C.destaque2} />
                            <Text style={estPacks.nicho}>{p.nicho || 'Outros'}</Text>
                            {!!p.dono && <Text style={estPacks.packInfo}> · por {p.autor}</Text>}
                          </View>
                          <Text style={estPacks.packInfo}>{contagem(p.assets)}</Text>
                        </View>
                        <Icone name={aberto === p.id ? 'chevron-up' : 'chevron-down'} size={20} color={C.suave} />
                      </TouchableOpacity>
                      {!!p.descricao && <Text style={estPacks.desc}>{p.descricao}</Text>}
                      <View style={estPacks.previa}>
                        {p.assets.slice(0, 7).map((a) => (
                          <AssetMini key={a.id} asset={a} tamanho={30} />
                        ))}
                      </View>
                      {botaoUsar(p)}
                      {aberto === p.id && (
                        <View style={{ marginTop: 10 }}>
                          <AssetsDoPack
                            assets={p.assets}
                            onAbrir={(a) => setVendo(a)}
                            renderAcoes={(a) => (
                              <TouchableOpacity onPress={() => !copiados[a.id] && copiar(a)} style={{ padding: 6 }}>
                                <Icone name={copiados[a.id] ? 'check' : 'content-copy'} size={18} color={copiados[a.id] ? C.ok : C.suave} />
                              </TouchableOpacity>
                            )}
                          />
                          <Text style={estPacks.dica}>Toque em um personagem para ver a ficha. O ícone de copiar leva o asset para Meus assets.</Text>
                        </View>
                      )}
                    </View>
                  );
                })}
            </>
          ) : (
            <>
              <Text style={estPacks.explica}>
                Crie seus próprios packs e use na mesa. Quando estiver pronto, toque em "Oficializar" para enviar aos admins: se aprovado, ele fica disponível para todos.
              </Text>
              <GerenciadorPacks
                usuario={usuario}
                lista={meusPacks}
                setTodos={setTodos}
                meus={meus}
                filtroNicho={nicho}
                vazio="Você ainda não criou nenhum pack."
                podeEditar={(p) => !ehOficial(p) && p.status !== 'pendente'}
                novoPack={() => ({
                  nome: '',
                  nicho: nicho === 'Todos' ? 'Fantasia' : nicho,
                  descricao: '',
                  cor: CORES[7],
                  icone: 'cards-outline',
                  capa: '',
                  publicado: false,
                  oficial: false,
                  status: 'privado',
                  dono: usuario.usuario,
                  autor: usuario.nome,
                })}
                renderStatus={(p, gravarPack) => {
                  const st = statusDoPack(p);
                  return (
                    <View style={{ marginTop: 8, gap: 8 }}>
                      <CaixaRevisao revisao={p.revisao} />
                      {botaoUsar(p)}
                      {(st === 'privado' || st === 'ressalvas' || st === 'recusado') && (
                        <TouchableOpacity style={estPacks.btnOficializar} onPress={() => setConfirmarEnvio({ p, gravarPack })}>
                          <Icone name="check-decagram-outline" size={18} color="#000" />
                          <Text style={estPacks.btnOficializarTxt}>{p.revisao ? 'Reenviar para oficialização' : 'Oficializar'}</Text>
                        </TouchableOpacity>
                      )}
                      {st === 'pendente' && (
                        <TouchableOpacity style={[estPacks.btnUsar, { borderColor: C.suave }]} onPress={() => gravarPack({ ...p, status: p.revisao ? 'ressalvas' : 'privado' })}>
                          <Icone name="undo" size={16} color={C.suave} />
                          <Text style={[estPacks.btnUsarTxt, { color: C.suave }]}>Cancelar envio</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                }}
              />
            </>
          )}
        </ScrollView>
      )}

      {vendo && vendo.tipo === 'personagem' && (
        <FichaVortex
          ficha={fichaDoAsset(vendo)}
          titulo="Ficha do pack"
          somenteLeitura
          acaoExtra={{
            rotulo: copiados[vendo.id] ? 'Já copiado' : 'Copiar para Meus assets',
            icone: copiados[vendo.id] ? 'check' : 'content-copy',
            desativado: copiados[vendo.id],
            onPress: () => copiar(vendo).then(() => setVendo(null)),
          }}
          onFechar={() => setVendo(null)}
        />
      )}

      {confirmarEnvio && (
        <ModalNome
          titulo={`Oficializar "${confirmarEnvio.p.nome}"?`}
          valorInicial={confirmarEnvio.p.nome}
          rotuloBotao="Enviar aos admins"
          detalhe={`${contagem(confirmarEnvio.p.assets)}. Enquanto estiver em análise, o pack não pode ser editado. Confirme o nome do pack:`}
          onConfirmar={async (n) => {
            await oficializar({ ...confirmarEnvio.p, nome: n }, confirmarEnvio.gravarPack);
          }}
          onFechar={() => setConfirmarEnvio(null)}
        />
      )}
    </View>
  );
}

// ================= Postagens (admin): Oficiais + Pendentes =================
function Postagens({ usuario, onVoltar, abaInicial }) {
  const [aba, setAba] = useState(abaInicial || 'oficiais');
  const [todos, setTodos] = useState([]);
  const [meus, setMeus] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [nicho, setNicho] = useState('Todos');

  async function recarregar() {
    setCarregando(true);
    setErro('');
    try {
      const [p, m] = await Promise.all([carregarTodosPacks(), carregarMeusAssets(usuario.usuario)]);
      setTodos(p);
      setMeus(m);
    } catch (e) {
      setErro('Não foi possível carregar as postagens.');
    }
    setCarregando(false);
  }
  useEffect(() => {
    recarregar();
  }, []);

  const oficiais = todos.filter(ehOficial);
  const pendentes = todos.filter((p) => !ehOficial(p) && p.status === 'pendente').sort((a, b) => (a.enviadoEm || 0) - (b.enviadoEm || 0));

  // decisão sobre um pedido de oficialização
  async function decidir(p, decisao, marcas, comentario) {
    const aceitos = p.assets.filter((a) => marcas[a.id] !== false).map((a) => a.id);
    const recusados = p.assets.filter((a) => marcas[a.id] === false).map((a) => a.id);
    if (decisao === 'aprovado' && !aceitos.length) throw new Error('Marque ao menos um asset para aprovar.');
    if (decisao === 'ressalvas' && !comentario.trim()) throw new Error('Escreva as ressalvas no comentário.');
    const revisao = { decisao, comentario: comentario.trim(), aceitos, recusados, por: usuario.nome, em: Date.now() };
    const { assets, ...dados } = p;
    let novo;
    let assetsFinais = p.assets;

    if (decisao === 'aprovado') {
      // assets não aceitos saem do pack e voltam para os assets pessoais do criador
      const fora = p.assets.filter((a) => recusados.includes(a.id));
      await Promise.all(
        fora.map(async (a) => {
          const { pack, ...resto } = a;
          await salvar(`${assetsDe(p.dono)}/${a.id}`, resto);
          await apagar(`${COL.assets}/${a.id}`);
        })
      );
      assetsFinais = p.assets.filter((a) => aceitos.includes(a.id));
      novo = { ...dados, status: 'aceito', oficial: true, publicado: true, revisao, oficializadoEm: Date.now() };
    } else {
      novo = { ...dados, status: decisao, revisao };
    }
    await salvar(`${COL.packs}/${p.id}`, novo);
    setTodos((l) => l.map((x) => (x.id === p.id ? { ...novo, assets: assetsFinais } : x)));

    const textos = {
      aprovado: `Seu pack "${p.nome}" foi oficializado! ✓ ${aceitos.length} aceitos${recusados.length ? `, ✗ ${recusados.length} voltaram para Meus assets` : ''}.`,
      ressalvas: `Seu pack "${p.nome}" voltou com ressalvas: ✓ ${aceitos.length} aceitos, ✗ ${recusados.length} não aceitos.`,
      recusado: `Seu pack "${p.nome}" não foi aceito.`,
    };
    await notificar(p.dono, { tipo: 'revisao', decisao, packId: p.id, texto: textos[decisao], comentario: revisao.comentario, por: usuario.nome });

    // o pedido some da caixa de todos os admins
    const pedidos = await consultar(COL.notificacoes, 'para', 'admins');
    await Promise.all(pedidos.filter((n) => n.packId === p.id && !n.lida).map((n) => atualizar(`${COL.notificacoes}/${n.id}`, { lida: true })));
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Topo titulo="Postagens" sub="Packs oficiais e pedidos de oficialização" onVoltar={onVoltar} onRecarregar={recarregar} />
      <View style={estPacks.faixaAdmin}>
        <Icone name="shield-crown-outline" size={16} color="#fff" />
        <Text style={estPacks.faixaAdminTxt}>ADMIN · rascunhos só aparecem para os admins até serem publicados</Text>
      </View>
      <AbasTopo
        abas={[
          { id: 'oficiais', nome: 'Oficiais', icone: 'check-decagram' },
          { id: 'pendentes', nome: 'Pedidos', icone: 'inbox-arrow-down', badge: pendentes.length || null },
        ]}
        atual={aba}
        onMudar={setAba}
      />
      {aba === 'oficiais' && (
        <View style={{ paddingVertical: 8 }}>
          <FiltroNicho valor={nicho} onMudar={setNicho} />
        </View>
      )}
      {carregando ? (
        <ActivityIndicator color={C.destaque} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={estPacks.lista}>
          {!!erro && <Text style={estPacks.erro}>{erro}</Text>}
          {aba === 'oficiais' ? (
            <GerenciadorPacks
              usuario={usuario}
              lista={oficiais}
              setTodos={setTodos}
              meus={meus}
              modoAdmin
              filtroNicho={nicho}
              vazio="Nenhum pack oficial neste nicho."
              podeEditar={() => true}
              novoPack={() => ({
                nome: '',
                nicho: nicho === 'Todos' ? 'Fantasia' : nicho,
                descricao: '',
                cor: CORES[7],
                icone: 'cards-outline',
                capa: '',
                publicado: false,
                oficial: true,
                ordem: oficiais.length + 1,
              })}
            />
          ) : (
            <>
              {pendentes.length === 0 && (
                <View style={{ alignItems: 'center', paddingVertical: 30, gap: 6 }}>
                  <Icone name="inbox-outline" size={40} color={C.suave} />
                  <Text style={estPacks.vazio}>Nenhum pedido de oficialização.</Text>
                </View>
              )}
              {pendentes.map((p) => (
                <CartaoRevisao key={p.id} pack={p} onDecidir={(d, m, c) => decidir(p, d, m, c)} />
              ))}
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}

// Cartão de análise de um pedido: marca cada asset como aceito/não aceito + comentário
function CartaoRevisao({ pack, onDecidir }) {
  const [marcas, setMarcas] = useState({});
  const [comentario, setComentario] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState('');
  const [vendo, setVendo] = useState(null);
  const aceitosN = pack.assets.filter((a) => marcas[a.id] !== false).length;

  async function enviar(decisao) {
    setErro('');
    setOcupado(true);
    try {
      await onDecidir(decisao, marcas, comentario);
    } catch (e) {
      setErro(e.message || 'Erro ao registrar a decisão.');
      setOcupado(false);
    }
  }

  return (
    <View style={[estPacks.card, { borderColor: '#eab308' }]}>
      <View style={estPacks.cardTopo}>
        <CapaPack pack={pack} />
        <View style={{ flex: 1 }}>
          <Text style={estPacks.packNome}>{pack.nome}</Text>
          <Text style={estPacks.packInfo}>
            por {pack.autor} · {pack.nicho} · enviado em {pack.enviadoEm ? new Date(pack.enviadoEm).toLocaleDateString('pt-BR') : '—'}
          </Text>
          <Text style={estPacks.packInfo}>{contagem(pack.assets)}</Text>
        </View>
      </View>
      {!!pack.descricao && <Text style={estPacks.desc}>{pack.descricao}</Text>}
      {pack.revisao && (
        <View style={{ marginTop: 8 }}>
          <Text style={estPacks.dica}>Reenvio. Revisão anterior:</Text>
          <CaixaRevisao revisao={pack.revisao} />
        </View>
      )}

      <Text style={estPacks.rotulo}>Assets ({aceitosN} de {pack.assets.length} aceitos)</Text>
      <AssetsDoPack
        assets={pack.assets}
        onAbrir={(a) => a.tipo === 'personagem' && setVendo(a)}
        renderAcoes={(a) => {
          const ok = marcas[a.id] !== false;
          return (
            <TouchableOpacity onPress={() => setMarcas({ ...marcas, [a.id]: !ok })} style={[estPacks.marca, { borderColor: ok ? C.ok : C.perigo }]}>
              <Icone name={ok ? 'check' : 'close'} size={16} color={ok ? C.ok : C.perigo} />
              <Text style={{ color: ok ? C.ok : C.perigo, fontSize: 11, fontWeight: '700' }}>{ok ? 'Aceito' : 'Não'}</Text>
            </TouchableOpacity>
          );
        }}
      />

      <Text style={estPacks.rotulo}>Comentário para o criador</Text>
      <TextInput
        style={[estPacks.input, { minHeight: 60, textAlignVertical: 'top' }]}
        value={comentario}
        onChangeText={setComentario}
        multiline
        placeholder="Ex.: o dragão está forte demais para um pack inicial; ajuste a Vida."
        placeholderTextColor={C.suave}
      />
      {!!erro && <Text style={[estPacks.erro, { marginTop: 6 }]}>{erro}</Text>}
      <View style={[estPacks.acoes, { flexWrap: 'wrap' }]}>
        <TouchableOpacity style={[estPacks.btnDecisao, { borderColor: C.perigo }]} onPress={() => enviar('recusado')} disabled={ocupado}>
          <Icone name="close-octagon-outline" size={16} color={C.perigo} />
          <Text style={[estPacks.btnDecisaoTxt, { color: C.perigo }]}>Recusar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[estPacks.btnDecisao, { borderColor: '#f97316' }]} onPress={() => enviar('ressalvas')} disabled={ocupado}>
          <Icone name="message-alert-outline" size={16} color="#f97316" />
          <Text style={[estPacks.btnDecisaoTxt, { color: '#f97316' }]}>Ressalvas</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[estPacks.btnDecisao, { backgroundColor: C.ok, borderColor: C.ok }]} onPress={() => enviar('aprovado')} disabled={ocupado}>
          {ocupado ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Icone name="check-decagram" size={16} color="#fff" />
              <Text style={[estPacks.btnDecisaoTxt, { color: '#fff' }]}>{aceitosN === pack.assets.length ? 'Aprovar' : `Aprovar ${aceitosN}`}</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
      <Text style={estPacks.dica}>
        Aprovar: o pack vira oficial com os assets marcados; os não aceitos voltam para Meus assets do criador. Ressalvas: o pack volta ao criador com o comentário e as marcações para ajustar e reenviar.
      </Text>

      {vendo && <FichaVortex ficha={fichaDoAsset(vendo)} titulo="Ficha enviada" somenteLeitura onFechar={() => setVendo(null)} />}
    </View>
  );
}

// Resumo da ficha atrelada ao token (para a lista do editor de pack)
function resumoFicha(a) {
  const vida = (a.recursos || [])[0];
  return `${a.categoria || 'Aliado'} · ${a.tamanho || 1}×${a.tamanho || 1} · C${a.corpo || 0} P${a.precisao || 0} E${a.essencia || 0}${
    vida ? ` · ${vida.nome} ${vida.max}` : ''
  }${(a.pericias || []).length ? ` · ${a.pericias.length} perícia(s)` : ''}`;
}

function EditorPack({ pack, autor, podePublicar, recemCriado, assets = [], onSalvar, onExcluir, onNovoToken, onNovoObjeto, onImportar, onAbrirAsset, onFechar }) {
  const [f, setF] = useState(pack);
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));

  async function ok() {
    if ((f.nome || '').trim().length < 2) return setErro('Dê um nome ao pack.');
    setOcupado(true);
    try {
      await onSalvar({ ...f, nome: f.nome.trim(), descricao: (f.descricao || '').trim() });
    } catch (e) {
      setErro('Erro ao salvar.');
    }
    setOcupado(false);
  }

  const personagens = assets.filter((a) => a.tipo === 'personagem');
  const objetos = assets.filter((a) => a.tipo === 'objeto');
  const outros = assets.filter((a) => a.tipo !== 'personagem' && a.tipo !== 'objeto');

  return (
    <Modal transparent animationType="fade" onRequestClose={onFechar}>
      <View style={estPacks.fundo}>
        <View style={estPacks.modal}>
          <View style={estPacks.linhaTopo}>
            <CapaPack pack={f} tamanho={44} />
            <Text style={estPacks.modalTitulo}>{f.id ? 'Editar pack' : 'Novo pack'}</Text>
            <TouchableOpacity onPress={onFechar}>
              <Icone name="close" size={22} color={C.suave} />
            </TouchableOpacity>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={estPacks.rotulo}>Nome</Text>
            <TextInput style={estPacks.input} value={f.nome} onChangeText={(t) => set('nome', t)} placeholder="Ex.: Cidade Portuária" placeholderTextColor={C.suave} />
            <Text style={estPacks.rotulo}>Nicho</Text>
            <View style={estPacks.wrap}>
              {NICHOS.map((n) => (
                <TouchableOpacity key={n.id} onPress={() => set('nicho', n.id)} style={[estPacks.chip, f.nicho === n.id && estPacks.chipAtivo]}>
                  <Icone name={n.icone} size={13} color={f.nicho === n.id ? '#fff' : C.suave} />
                  <Text style={[estPacks.chipTxt, f.nicho === n.id && { color: '#fff' }]}>{n.id}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={estPacks.rotulo}>Descrição</Text>
            <TextInput style={[estPacks.input, { minHeight: 56, textAlignVertical: 'top' }]} value={f.descricao} onChangeText={(t) => set('descricao', t)} multiline />
            <Text style={estPacks.rotulo}>Cor e ícone</Text>
            <View style={estPacks.wrap}>
              {CORES.map((c) => (
                <TouchableOpacity key={c} onPress={() => set('cor', c)} style={[estPacks.cor, { backgroundColor: c }, f.cor === c && estPacks.corSel]} />
              ))}
            </View>
            <View style={[estPacks.wrap, { marginTop: 8 }]}>
              {ICONES_PACK.map((i) => (
                <TouchableOpacity key={i} onPress={() => set('icone', i)} style={[estPacks.iconeOp, f.icone === i && estPacks.chipAtivo]}>
                  <Icone name={i} size={20} color={f.icone === i ? '#fff' : C.suave} />
                </TouchableOpacity>
              ))}
            </View>
            <View style={{ marginTop: 10 }}>
              <CampoImagem valor={f.capa} onMudar={(ref) => set('capa', ref)} largura={600} rotulo="Capa (opcional, substitui o ícone)" autor={autor} />
            </View>
            {podePublicar && (
              <TouchableOpacity style={[estPacks.btnUsar, f.publicado && estPacks.btnUsarOn, { marginTop: 14 }]} onPress={() => set('publicado', !f.publicado)}>
                <Icone name={f.publicado ? 'earth' : 'earth-off'} size={18} color={f.publicado ? '#fff' : C.destaque2} />
                <Text style={[estPacks.btnUsarTxt, f.publicado && { color: '#fff' }]}>{f.publicado ? 'Publicado' : 'Rascunho (não publicado)'}</Text>
              </TouchableOpacity>
            )}

            {/* tokens e fichas atrelados ao pack */}
            {f.id ? (
              <View style={estPacks.secaoAssets}>
                {recemCriado && (
                  <View style={estPacks.avisoNovo}>
                    <Icone name="check-circle-outline" size={18} color={C.ok} />
                    <Text style={estPacks.avisoNovoTxt}>Pack criado! Agora adicione os tokens e as fichas deles.</Text>
                  </View>
                )}
                <Text style={estPacks.rotulo}>Adicionar ao pack</Text>
                <View style={estPacks.escolhaTipo}>
                  <TouchableOpacity style={[estPacks.opcaoTipo, { borderColor: C.destaque }]} onPress={onNovoToken}>
                    <Icone name="account-plus-outline" size={26} color={C.destaque} />
                    <Text style={estPacks.opcaoTipoTit}>Personagem</Text>
                    <Text style={estPacks.opcaoTipoSub}>token + ficha Vortex</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[estPacks.opcaoTipo, { borderColor: C.ok }]} onPress={onNovoObjeto}>
                    <Icone name="pine-tree" size={26} color={C.ok} />
                    <Text style={estPacks.opcaoTipoTit}>Cenário</Text>
                    <Text style={estPacks.opcaoTipoSub}>árvores, móveis, portas...</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity style={{ alignSelf: 'flex-start', marginTop: 6 }} onPress={onImportar}>
                  <Text style={[estPacks.dica, { marginTop: 0, color: C.destaque2 }]}>+ Trazer de Meus assets (estruturas, mapas...)</Text>
                </TouchableOpacity>

                <Text style={estPacks.rotulo}>Personagens ({personagens.length})</Text>
                {personagens.length === 0 && <Text style={[estPacks.dica, { marginTop: 0 }]}>Nenhum personagem ainda. Cada token tem a sua ficha.</Text>}
                {agruparPorPasta(personagens).map((g) => (
                  <View key={g.pasta}>
                    <CabecalhoPasta nome={g.pasta} quantidade={g.itens.length} />
                    {g.itens.map((a) => (
                      <TouchableOpacity key={a.id} style={estPacks.assetLinha} onPress={() => onAbrirAsset(a)}>
                        <AssetMini asset={a} tamanho={40} />
                        <View style={{ flex: 1 }}>
                          <Text style={estPacks.assetNome}>{a.nome}</Text>
                          <Text style={estPacks.assetInfo}>{resumoFicha(a)}</Text>
                        </View>
                        <Icone name="card-account-details-outline" size={18} color={C.destaque2} />
                      </TouchableOpacity>
                    ))}
                  </View>
                ))}

                <Text style={estPacks.rotulo}>Cenário ({objetos.length})</Text>
                {objetos.length === 0 && <Text style={[estPacks.dica, { marginTop: 0 }]}>Nenhum item de cenário ainda.</Text>}
                {agruparPorPasta(objetos).map((g) => (
                  <View key={g.pasta}>
                    <CabecalhoPasta nome={g.pasta} quantidade={g.itens.length} />
                    <View style={estPacks.previa}>
                      {g.itens.map((a) => (
                        <TouchableOpacity key={a.id} onPress={() => onAbrirAsset(a)} style={{ alignItems: 'center', width: 58 }}>
                          <AssetMini asset={a} tamanho={40} />
                          <Text style={[estPacks.assetInfo, { textAlign: 'center' }]} numberOfLines={1}>{a.nome}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                ))}
                {outros.length > 0 && <Text style={estPacks.dica}>Também no pack: {contagem(outros)}.</Text>}
              </View>
            ) : (
              <View style={[estPacks.avisoNovo, { marginTop: 14 }]}>
                <Icone name="information-outline" size={18} color={C.destaque2} />
                <Text style={estPacks.avisoNovoTxt}>Ao criar o pack, você já adiciona os tokens e as fichas atreladas a eles aqui mesmo.</Text>
              </View>
            )}
          </ScrollView>
          {!!erro && <Text style={estPacks.erro}>{erro}</Text>}
          <View style={estPacks.acoes}>
            {!!onExcluir && (
              <TouchableOpacity style={[estPacks.btn, { borderWidth: 1, borderColor: C.perigo }]} onPress={() => (confirmar ? onExcluir() : setConfirmar(true))}>
                <Text style={{ color: C.perigo, fontWeight: '700' }}>{confirmar ? 'Excluir pack e assets?' : 'Excluir'}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={[estPacks.btn, { backgroundColor: C.destaque }]} onPress={ok} disabled={ocupado}>
              {ocupado ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={{ color: '#fff', fontWeight: '700' }}>{f.id ? 'Salvar e fechar' : 'Criar e adicionar tokens'}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function BotaoMini({ icone, rotulo, onPress }) {
  return (
    <TouchableOpacity style={estPacks.botaoMini} onPress={onPress}>
      <Icone name={icone} size={16} color={C.destaque2} />
      <Text style={estPacks.botaoMiniTxt}>{rotulo}</Text>
    </TouchableOpacity>
  );
}

function Topo({ titulo, sub, onVoltar, onRecarregar, direita }) {
  return (
    <View style={estPacks.topo}>
      <TouchableOpacity onPress={onVoltar} style={{ padding: 6 }}>
        <Icone name="arrow-left" size={22} color={C.texto} />
      </TouchableOpacity>
      <View style={{ flex: 1 }}>
        <Text style={estPacks.titulo}>{titulo}</Text>
        {!!sub && <Text style={estPacks.sub}>{sub}</Text>}
      </View>
      {direita}
      {!!onRecarregar && (
        <TouchableOpacity onPress={onRecarregar} style={{ padding: 6 }}>
          <Icone name="refresh" size={20} color={C.suave} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const estPacks = StyleSheet.create({
  topo: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 10, backgroundColor: C.painel, borderBottomWidth: 1, borderColor: C.borda },
  titulo: { color: C.texto, fontWeight: '700', fontSize: 17 },
  sub: { color: C.suave, fontSize: 11 },
  explica: { color: C.suave, fontSize: 12 },
  abasTopo: { flexDirection: 'row', backgroundColor: C.painel, borderBottomWidth: 1, borderColor: C.borda },
  abaTopo: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderBottomWidth: 2, borderColor: 'transparent' },
  abaTopoAtiva: { borderColor: C.destaque2 },
  abaTopoTxt: { color: C.suave, fontWeight: '700', fontSize: 13 },
  badge: { backgroundColor: C.perigo, borderRadius: 9, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  badgeTxt: { color: '#fff', fontSize: 10, fontWeight: '800' },
  faixaAdmin: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.destaque, paddingHorizontal: 12, paddingVertical: 6 },
  faixaAdminTxt: { color: '#fff', fontSize: 11, fontWeight: '700', flex: 1 },
  lista: { padding: 12, paddingBottom: 60, gap: 12, maxWidth: 680, width: '100%', alignSelf: 'center' },
  card: { backgroundColor: C.painel, borderRadius: 14, borderWidth: 1, borderColor: C.borda, padding: 12 },
  cardTopo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  capa: { borderRadius: 12, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  packNome: { color: C.texto, fontWeight: '800', fontSize: 16 },
  linha: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2, flexWrap: 'wrap' },
  nicho: { color: C.destaque2, fontSize: 12 },
  packInfo: { color: C.suave, fontSize: 11, marginTop: 2 },
  desc: { color: C.suave, fontSize: 12, marginTop: 8 },
  previa: { flexDirection: 'row', gap: 4, marginTop: 10, flexWrap: 'wrap' },
  btnUsar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderColor: C.destaque2, borderRadius: 10, paddingVertical: 9, marginTop: 10 },
  btnUsarOn: { backgroundColor: C.destaque, borderColor: C.destaque },
  btnUsarTxt: { color: C.destaque2, fontWeight: '800', fontSize: 13 },
  btnOficializar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#eab308', borderRadius: 10, paddingVertical: 10 },
  btnOficializarTxt: { color: '#000', fontWeight: '800', fontSize: 13 },
  selo: { fontSize: 10, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6, marginLeft: 8, overflow: 'hidden', fontWeight: '700' },
  seloPub: { color: '#fff', backgroundColor: C.ok },
  seloRasc: { color: '#000', backgroundColor: '#f59e0b' },
  seloStatus: { flexDirection: 'row', alignItems: 'center', gap: 3, borderWidth: 1, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 1, marginLeft: 8 },
  seloStatusTxt: { fontSize: 10, fontWeight: '800' },
  revisao: { borderWidth: 1, borderRadius: 10, padding: 10, backgroundColor: C.bg, gap: 4 },
  revisaoTit: { fontWeight: '800', fontSize: 13 },
  revisaoPor: { color: C.suave, fontSize: 11, marginLeft: 4 },
  revisaoTxt: { color: C.texto, fontSize: 13, fontStyle: 'italic' },
  revisaoNums: { color: C.suave, fontSize: 11 },
  novoTxt: { color: C.destaque2, fontSize: 10, fontWeight: '800' },
  marca: { flexDirection: 'row', alignItems: 'center', gap: 3, borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  abas: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 6 },
  aba: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderBottomWidth: 2, borderColor: 'transparent' },
  abaAtiva: { borderColor: C.destaque2 },
  abaTxt: { color: C.suave, fontSize: 12, fontWeight: '700' },
  assetLinha: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  assetNome: { color: C.texto, fontWeight: '600' },
  assetInfo: { color: C.suave, fontSize: 11 },
  dica: { color: C.suave, fontSize: 11, marginTop: 8, fontStyle: 'italic' },
  vazio: { color: C.suave, textAlign: 'center', paddingVertical: 16 },
  erro: { color: C.perigo, textAlign: 'center' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: C.borda },
  chipAtivo: { backgroundColor: C.destaque, borderColor: C.destaque },
  chipTxt: { color: C.suave, fontSize: 12, fontWeight: '600' },
  btnNovo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: C.destaque, borderRadius: 12, paddingVertical: 12 },
  acoesPack: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  botaoMini: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: C.destaque2, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  botaoMiniTxt: { color: C.destaque2, fontSize: 12, fontWeight: '700' },
  btnDecisao: { flex: 1, minWidth: 96, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderWidth: 1, borderRadius: 10, paddingVertical: 10 },
  btnDecisaoTxt: { fontWeight: '800', fontSize: 13 },
  fundo: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', alignItems: 'center', padding: 14 },
  modal: { width: '100%', maxWidth: 460, maxHeight: '92%', backgroundColor: C.painel, borderRadius: 16, borderWidth: 1, borderColor: C.borda, padding: 16 },
  linhaTopo: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  modalTitulo: { color: C.texto, fontWeight: '800', fontSize: 17, flex: 1 },
  rotulo: { color: C.suave, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', marginTop: 12, marginBottom: 6 },
  input: { backgroundColor: C.painel2, borderWidth: 1, borderColor: C.borda, color: C.texto, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  cor: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: 'transparent' },
  corSel: { borderColor: '#fff' },
  iconeOp: { width: 38, height: 38, borderRadius: 8, borderWidth: 1, borderColor: C.borda, alignItems: 'center', justifyContent: 'center' },
  acoes: { flexDirection: 'row', gap: 8, marginTop: 14 },
  btn: { flex: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  secaoAssets: { marginTop: 14, borderTopWidth: 1, borderColor: C.borda, paddingTop: 4 },
  avisoNovo: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.bg, borderRadius: 10, padding: 10, marginTop: 8 },
  avisoNovoTxt: { color: C.texto, fontSize: 12, flex: 1 },
  escolhaTipo: { flexDirection: 'row', gap: 8 },
  opcaoTipo: { flex: 1, alignItems: 'center', borderWidth: 1, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 6, backgroundColor: C.bg },
  opcaoTipoTit: { color: C.texto, fontWeight: '800', marginTop: 4 },
  opcaoTipoSub: { color: C.suave, fontSize: 10, textAlign: 'center' },
  btnToken: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: C.destaque, borderRadius: 10, paddingVertical: 10, marginTop: 6 },
  btnTokenTxt: { color: '#fff', fontWeight: '800' },
});

// ================================================================
// src/screens/MeusAssets.js
// ================================================================
// "Meus assets": personagens (fichas), objetos, estruturas e mapas do próprio usuário
function MeusAssets({ usuario, onVoltar, onAbrirPacks, onCriarMapa }) {
  const caminho = assetsDe(usuario.usuario);
  const [lista, setLista] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [busca, setBusca] = useState('');
  const [aba, setAba] = useState('personagem');
  const [editFicha, setEditFicha] = useState(null);
  const [editObjeto, setEditObjeto] = useState(null);
  const [renomear, setRenomear] = useState(null);
  const [origem, setOrigem] = useState('meus'); // 'meus' | 'basicos' (assets dos packs em uso)
  const [basicos, setBasicos] = useState([]);
  const [vendoBasico, setVendoBasico] = useState(null);
  const [aviso, setAviso] = useState('');

  async function recarregar() {
    setCarregando(true);
    setErro('');
    try {
      const [meus, packs, ativos] = await Promise.all([carregarMeusAssets(usuario.usuario), carregarTodosPacks(), lerPacksAtivos(usuario.usuario)]);
      setLista(meus);
      setBasicos(
        packs
          .filter((p) => packVisivelPara(p, usuario.usuario) && packEstaAtivo(ativos, p.id))
          .flatMap((p) => p.assets.map((a) => ({ ...a, nomePack: p.nome })))
      );
      if (!meus.length) setOrigem('basicos');
    } catch (e) {
      setErro('Não foi possível carregar seus assets.');
    }
    setCarregando(false);
  }

  const copiados = useMemo(() => {
    const m = {};
    lista.forEach((a) => a.origem && (m[a.origem] = true));
    return m;
  }, [lista]);

  async function copiarBasico(a) {
    if (copiados[a.id]) return;
    const { pack, nomePack, ...resto } = a;
    const id = `pk_${a.id}`;
    const novo = { ...resto, id, origem: a.id, adicionadoEm: Date.now() };
    await salvar(`${caminho}/${id}`, novo);
    setLista((l) => porNome([...l, novo]));
    setAviso(`"${a.nome}" copiado para Meus assets`);
    setTimeout(() => setAviso(''), 2500);
  }
  useEffect(() => {
    recarregar();
  }, []);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const fonte = origem === 'meus' ? lista : basicos;
    return fonte.filter((a) => a.tipo === aba && (!q || (a.nome || '').toLowerCase().includes(q)));
  }, [lista, basicos, origem, busca, aba]);

  async function gravar(asset) {
    const final = { ...asset, id: asset.id || gerarId(), autor: asset.autor || usuario.nome, criadoEm: asset.criadoEm || Date.now(), atualizadoEm: Date.now() };
    await salvar(`${caminho}/${final.id}`, final);
    setLista((l) => porNome([...l.filter((x) => x.id !== final.id), final]));
  }

  async function remover(asset) {
    await apagar(`${caminho}/${asset.id}`);
    setLista((l) => l.filter((x) => x.id !== asset.id));
  }

  const [importando, setImportando] = useState(false);
  async function importarDD() {
    setErro('');
    try {
      const arq = await escolherArquivoVtt();
      if (!arq) return;
      setImportando(true);
      const m = await importarVtt(arq, { usuario });
      setLista((l) => porNome([...l, m]));
    } catch (e) {
      setErro(e.message || 'Não foi possível importar o mapa do Dungeondraft.');
    }
    setImportando(false);
  }

  function abrir(a) {
    if (origem === 'basicos') {
      if (a.tipo === 'personagem') setVendoBasico(a);
      else copiarBasico(a);
      return;
    }
    if (a.tipo === 'personagem') setEditFicha(fichaDoAsset(a));
    else if (a.tipo === 'objeto') setEditObjeto(a);
    else if (a.tipo === 'mapa' && (a.itens || []).some((i) => i.type === 'tiles') && onCriarMapa) onCriarMapa(a);
    else setRenomear(a);
  }

  const contar = (t) => (origem === 'meus' ? lista : basicos).filter((a) => a.tipo === t).length;
  const tipoAtual = TIPOS_ASSET.find((t) => t.id === aba);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Topo
        titulo="Meus assets"
        sub={`${lista.length} no total`}
        onVoltar={onVoltar}
        onRecarregar={recarregar}
        direita={
          <TouchableOpacity onPress={onAbrirPacks} style={estMeusAssets.btnPacks}>
            <Icone name="package-variant" size={18} color={C.destaque2} />
            <Text style={{ color: C.destaque2, fontWeight: '700', fontSize: 13 }}>Packs</Text>
          </TouchableOpacity>
        }
      />

      <View style={estMeusAssets.abas}>
        {TIPOS_ASSET.map((t) => (
          <TouchableOpacity key={t.id} onPress={() => setAba(t.id)} style={[estMeusAssets.aba, aba === t.id && estMeusAssets.abaAtiva]}>
            <Icone name={t.icone} size={18} color={aba === t.id ? C.destaque2 : C.suave} />
            <Text style={[estMeusAssets.abaTxt, aba === t.id && { color: C.destaque2 }]}>{t.nome}</Text>
            <Text style={estMeusAssets.abaNum}>{contar(t.id)}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={estMeusAssets.origens}>
        {[
          ['meus', 'account-box-outline', `Meus (${lista.length})`],
          ['basicos', 'package-variant', `Básicos e packs (${basicos.length})`],
        ].map(([id, ic, rot]) => (
          <TouchableOpacity key={id} onPress={() => setOrigem(id)} style={[estMeusAssets.origem, origem === id && estMeusAssets.origemAtiva]}>
            <Icone name={ic} size={15} color={origem === id ? '#fff' : C.suave} />
            <Text style={[estMeusAssets.origemTxt, origem === id && { color: '#fff' }]}>{rot}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {origem === 'basicos' && (
        <Text style={estMeusAssets.explicaBasicos}>
          Assets dos packs que você está usando. Toque para copiar para Meus assets (personagens abrem a ficha). Na mesa e no criador de mapas eles já aparecem direto.
        </Text>
      )}
      {!!aviso && <Text style={[estMeusAssets.explicaBasicos, { color: C.ok }]}>{aviso}</Text>}
      <View style={estMeusAssets.busca}>
        <Icone name="magnify" size={18} color={C.suave} />
        <TextInput style={estMeusAssets.buscaInput} value={busca} onChangeText={setBusca} placeholder={`Buscar em ${tipoAtual.nome.toLowerCase()}`} placeholderTextColor={C.suave} />
      </View>

      {carregando ? (
        <ActivityIndicator color={C.destaque} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={estMeusAssets.lista}>
          {!!erro && <Text style={{ color: C.perigo, textAlign: 'center' }}>{erro}</Text>}
          {filtrados.length === 0 && !erro && (
            <View style={estMeusAssets.vazioCaixa}>
              <Icone name={tipoAtual.icone} size={40} color={C.suave} />
              <Text style={estMeusAssets.vazio}>Nada em {tipoAtual.nome.toLowerCase()} ainda.</Text>
              <Text style={estMeusAssets.vazioSub}>
                {aba === 'mapa'
                  ? 'Crie no botão + (criador de mapas), importe do Dungeondraft (botão de cima), salve a mesa pela aba Construir ou copie de um pack.'
                  : aba === 'estrutura'
                  ? 'Monte na mesa e salve pela aba Construir, ou copie de um pack.'
                  : 'Crie no botão + ou copie de um pack.'}
              </Text>
              <TouchableOpacity style={estMeusAssets.btnVazio} onPress={onAbrirPacks}>
                <Text style={{ color: '#fff', fontWeight: '700' }}>Ver packs</Text>
              </TouchableOpacity>
            </View>
          )}
          {agruparPorPasta(filtrados).map((g) => (
            <View key={g.pasta} style={{ gap: 10 }}>
              {(g.pasta !== SEM_PASTA || filtrados.some((a) => a.pasta)) && <CabecalhoPasta nome={g.pasta} quantidade={g.itens.length} />}
          {g.itens.map((a) => (
            <TouchableOpacity key={a.id} style={estMeusAssets.card} onPress={() => abrir(a)}>
              <AssetMini asset={a} tamanho={46} />
              <View style={{ flex: 1 }}>
                <Text style={estMeusAssets.nome}>{a.nome}</Text>
                <Text style={estMeusAssets.info}>{resumoAsset(a)}</Text>
                {!!a.descricao && a.tipo === 'personagem' && (
                  <Text style={estMeusAssets.desc} numberOfLines={2}>
                    {a.descricao}
                  </Text>
                )}
              </View>
              {origem === 'basicos' ? (
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <Text style={[estMeusAssets.selo, estMeusAssets.seloPack]} numberOfLines={1}>{a.nomePack}</Text>
                  <Icone name={copiados[a.id] ? 'check' : 'content-copy'} size={18} color={copiados[a.id] ? C.ok : C.suave} />
                </View>
              ) : (
                <Text style={[estMeusAssets.selo, a.origem ? estMeusAssets.seloPack : estMeusAssets.seloMeu]}>{a.origem ? 'de pack' : 'seu'}</Text>
              )}
            </TouchableOpacity>
          ))}
            </View>
          ))}
        </ScrollView>
      )}

      {origem === 'meus' && aba === 'mapa' && !!onCriarMapa && (
        <TouchableOpacity style={estMeusAssets.fab} onPress={() => onCriarMapa(null)}>
          <Icone name="map-plus" size={26} color="#fff" />
        </TouchableOpacity>
      )}
      {origem === 'meus' && aba === 'mapa' && (
        <TouchableOpacity style={[estMeusAssets.fab, { bottom: 92, backgroundColor: C.painel2, borderWidth: 1, borderColor: C.destaque2 }]} onPress={importarDD}>
          {importando ? <ActivityIndicator color={C.destaque2} /> : <Icone name="file-import-outline" size={24} color={C.destaque2} />}
        </TouchableOpacity>
      )}
      {origem === 'meus' && (aba === 'personagem' || aba === 'objeto') && (
        <TouchableOpacity
          style={estMeusAssets.fab}
          onPress={() => (aba === 'personagem' ? setEditFicha({ ...FICHA_VAZIA }) : setEditObjeto({}))}
        >
          <Icone name="plus" size={28} color="#fff" />
        </TouchableOpacity>
      )}

      {vendoBasico && (
        <FichaVortex
          ficha={fichaDoAsset(vendoBasico)}
          titulo={`Ficha · ${vendoBasico.nomePack}`}
          somenteLeitura
          acaoExtra={{
            rotulo: copiados[vendoBasico.id] ? 'Já está em Meus assets' : 'Copiar para Meus assets',
            icone: copiados[vendoBasico.id] ? 'check' : 'content-copy',
            desativado: copiados[vendoBasico.id],
            onPress: () => copiarBasico(vendoBasico).then(() => setVendoBasico(null)),
          }}
          onFechar={() => setVendoBasico(null)}
        />
      )}
      {editFicha && (
        <FichaVortex
          pastas={pastasDe(lista.filter((x) => x.tipo === 'personagem'))}
          ficha={editFicha}
          titulo={editFicha.origem ? 'Sua cópia (de um pack)' : 'Ficha Vortex'}
          onSalvar={async (f) => {
            await gravar(assetDaFicha(f));
            setEditFicha(null);
          }}
          onApagar={
            editFicha.id
              ? async () => {
                  await remover(editFicha);
                  setEditFicha(null);
                }
              : null
          }
          onFechar={() => setEditFicha(null)}
        />
      )}
      {editObjeto && (
        <EditorObjeto
          pastas={pastasDe(lista.filter((x) => x.tipo === 'objeto'))}
          asset={editObjeto}
          autor={usuario.nome}
          onSalvar={async (o) => {
            await gravar(o);
            setEditObjeto(null);
          }}
          onApagar={async () => {
            await remover(editObjeto);
            setEditObjeto(null);
          }}
          onFechar={() => setEditObjeto(null)}
        />
      )}
      {renomear && (
        <ModalNome
          titulo={renomear.nome}
          valorInicial={renomear.nome}
          detalhe={resumoAsset(renomear)}
          onConfirmar={async (nome) => {
            await gravar({ ...renomear, nome });
            setRenomear(null);
          }}
          onExcluir={async () => {
            await remover(renomear);
            setRenomear(null);
          }}
          onFechar={() => setRenomear(null)}
        />
      )}
    </View>
  );
}

const estMeusAssets = StyleSheet.create({
  btnPacks: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: C.destaque2, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5 },
  abas: { flexDirection: 'row', backgroundColor: C.painel, borderBottomWidth: 1, borderColor: C.borda },
  aba: { flex: 1, alignItems: 'center', paddingVertical: 8, borderBottomWidth: 2, borderColor: 'transparent' },
  abaAtiva: { borderColor: C.destaque2 },
  abaTxt: { color: C.suave, fontSize: 11, fontWeight: '700', marginTop: 2 },
  abaNum: { color: C.suave, fontSize: 10 },
  busca: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: C.painel,
    borderWidth: 1,
    borderColor: C.borda,
    borderRadius: 10,
    paddingHorizontal: 10,
    margin: 12,
  },
  buscaInput: { flex: 1, color: C.texto, paddingVertical: 9 },
  lista: { paddingHorizontal: 12, paddingBottom: 100, gap: 10, maxWidth: 640, width: '100%', alignSelf: 'center' },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.painel, borderRadius: 14, borderWidth: 1, borderColor: C.borda, padding: 12 },
  nome: { color: C.texto, fontWeight: '700', fontSize: 15 },
  info: { color: C.destaque2, fontSize: 12, marginTop: 2 },
  desc: { color: C.suave, fontSize: 12, marginTop: 4 },
  selo: { fontSize: 10, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, overflow: 'hidden', fontWeight: '700' },
  seloPack: { color: C.destaque2, backgroundColor: 'rgba(34,211,238,0.12)' },
  seloMeu: { color: C.destaque, backgroundColor: 'rgba(139,92,246,0.15)' },
  vazioCaixa: { alignItems: 'center', paddingVertical: 30, gap: 6 },
  vazio: { color: C.suave, textAlign: 'center' },
  vazioSub: { color: C.suave, fontSize: 12, textAlign: 'center' },
  btnVazio: { backgroundColor: C.destaque, borderRadius: 10, paddingHorizontal: 18, paddingVertical: 10, marginTop: 8 },
  origens: { flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingTop: 10 },
  origem: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: C.borda },
  origemAtiva: { backgroundColor: C.destaque, borderColor: C.destaque },
  origemTxt: { color: C.suave, fontWeight: '700', fontSize: 12 },
  explicaBasicos: { color: C.suave, fontSize: 11, paddingHorizontal: 14, paddingTop: 6 },
  fab: { position: 'absolute', right: 20, bottom: 24, width: 58, height: 58, borderRadius: 29, backgroundColor: C.destaque, alignItems: 'center', justifyContent: 'center', elevation: 6 },
});

// ================================================================
// src/screens/Perfil.js
// ================================================================
function Perfil({ usuario, onAtualizado, onVoltar, onSair }) {
  const [nome, setNome] = useState(usuario.nome);
  const [cor, setCor] = useState(usuario.cor || C.destaque);
  const [senhas, setSenhas] = useState({ atual: '', nova: '', confirmar: '' });
  const [msg, setMsg] = useState({ txt: '', ok: true });
  const [ocupado, setOcupado] = useState(false);
  const [stats, setStats] = useState(null);
  const [confirmarSaida, setConfirmarSaida] = useState(false);

  useEffect(() => {
    Promise.all([
      consultar(COL.mesas, 'criador', usuario.usuario),
      listar(assetsDe(usuario.usuario)),
      lerDoc(`${COL.usuarios}/${usuario.usuario}`),
      lerPacksAtivos(usuario.usuario),
    ])
      .then(([mesas, tokens, conta, packs]) =>
        setStats({
          mestre: mesas.length,
          jogador: ((conta && conta.recentes) || []).length,
          tokens: tokens.length,
          criados: tokens.filter((x) => !x.origem).length,
          packs: packs === null ? 'todos' : packs.length,
          ultimo: conta && conta.ultimoAcesso,
        })
      )
      .catch(() => {});
  }, []);

  async function salvarPerfil() {
    setOcupado(true);
    try {
      const sessao = await atualizarPerfil(usuario.usuario, { nome, cor });
      onAtualizado(sessao);
      setMsg({ txt: 'Perfil atualizado!', ok: true });
    } catch (e) {
      setMsg({ txt: e.message, ok: false });
    }
    setOcupado(false);
  }

  async function mudarSenha() {
    setOcupado(true);
    try {
      await trocarSenha(usuario.usuario, senhas.atual, senhas.nova, senhas.confirmar);
      setSenhas({ atual: '', nova: '', confirmar: '' });
      setMsg({ txt: 'Senha alterada com sucesso!', ok: true });
    } catch (e) {
      setMsg({ txt: e.message, ok: false });
    }
    setOcupado(false);
  }

  const desde = usuario.criadoEm ? new Date(usuario.criadoEm).toLocaleDateString('pt-BR') : '—';

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={estPerfil.topo}>
        <TouchableOpacity onPress={onVoltar} style={{ padding: 6 }}>
          <Icone name="arrow-left" size={22} color={C.texto} />
        </TouchableOpacity>
        <Text style={estPerfil.titulo}>Meus dados</Text>
      </View>

      <ScrollView contentContainerStyle={estPerfil.conteudo}>
        <View style={estPerfil.cabeca}>
          <View style={[estPerfil.avatar, { backgroundColor: cor }]}>
            <Text style={estPerfil.avatarTxt}>{(nome || '?').slice(0, 1).toUpperCase()}</Text>
          </View>
          <Text style={estPerfil.nome}>{nome}</Text>
          <Text style={estPerfil.info}>
            {usuario.provedor === 'anonimo'
              ? 'Conta de visitante (anônima)'
              : `@${usuario.usuario} · ${usuario.email}`}
          </Text>
          <Text style={estPerfil.info}>membro desde {desde}</Text>
          <View style={[estPerfil.papel, usuario.papel === 'admin' && { backgroundColor: C.destaque }]}>
            <Icone name={usuario.papel === 'admin' ? 'shield-crown-outline' : 'dice-d20-outline'} size={13} color="#fff" />
            <Text style={estPerfil.papelTxt}>{usuario.papel === 'admin' ? 'Desenvolvedor' : 'Jogador'}</Text>
          </View>
        </View>

        <View style={estPerfil.stats}>
          {[
            ['crown-outline', 'Mestre em', stats ? stats.mestre : '…', 'campanhas'],
            ['dice-d20-outline', 'Jogador em', stats ? stats.jogador : '…', 'campanhas'],
            ['treasure-chest', 'Meus assets', stats ? stats.tokens : '…', `${stats ? stats.criados : '…'} criados`],
            ['package-variant', 'Packs em uso', stats ? stats.packs : '…', 'na mesa'],
          ].map(([ic, rot, val, uni]) => (
            <View key={rot} style={estPerfil.stat}>
              <Icone name={ic} size={18} color={C.destaque2} />
              <Text style={estPerfil.statVal}>{val}</Text>
              <Text style={estPerfil.statRot}>{rot}</Text>
              <Text style={estPerfil.statUni}>{uni}</Text>
            </View>
          ))}
        </View>

        <View style={estPerfil.cartao}>
          <Text style={estPerfil.secao}>Dados</Text>
          <Text style={estPerfil.rotulo}>Nome de exibição</Text>
          <TextInput style={estPerfil.input} value={nome} onChangeText={setNome} />
          <Text style={estPerfil.rotulo}>Cor do avatar</Text>
          <View style={estPerfil.cores}>
            {CORES.slice(0, 9).map((c) => (
              <TouchableOpacity key={c} onPress={() => setCor(c)} style={[estPerfil.cor, { backgroundColor: c }, cor === c && estPerfil.corSel]} />
            ))}
          </View>
          <TouchableOpacity style={estPerfil.botao} onPress={salvarPerfil} disabled={ocupado}>
            <Text style={estPerfil.botaoTxt}>Salvar dados</Text>
          </TouchableOpacity>
        </View>

        {usuario.provedor === 'anonimo' && (
          <View style={[estPerfil.cartao, { borderColor: '#f59e0b' }]}>
            <Text style={[estPerfil.secao, { color: '#f59e0b' }]}>Você está como visitante</Text>
            <Text style={estPerfil.info}>
              Seus assets e campanhas ficam salvos enquanto você não sair. Se sair da conta, não será possível voltar a ela.
            </Text>
          </View>
        )}

        {usuario.provedor === 'senha' && (
        <View style={estPerfil.cartao}>
          <Text style={estPerfil.secao}>Trocar senha</Text>
          {[
            ['atual', 'Senha atual'],
            ['nova', 'Nova senha'],
            ['confirmar', 'Confirmar nova senha'],
          ].map(([k, p]) => (
            <TextInput
              key={k}
              style={estPerfil.input}
              value={senhas[k]}
              onChangeText={(t) => setSenhas({ ...senhas, [k]: t })}
              placeholder={p}
              placeholderTextColor={C.suave}
              secureTextEntry
              autoCapitalize="none"
            />
          ))}
          <TouchableOpacity style={[estPerfil.botao, estPerfil.botaoSec]} onPress={mudarSenha} disabled={ocupado}>
            <Text style={[estPerfil.botaoTxt, { color: C.destaque2 }]}>Alterar senha</Text>
          </TouchableOpacity>
        </View>
        )}

        {ocupado && <ActivityIndicator color={C.destaque} />}
        {!!msg.txt && <Text style={[estPerfil.msg, { color: msg.ok ? C.ok : C.perigo }]}>{msg.txt}</Text>}

        <TouchableOpacity
          style={estPerfil.sair}
          onPress={() => {
            if (usuario.provedor === 'anonimo' && !confirmarSaida) return setConfirmarSaida(true);
            onSair();
          }}
        >
          <Icone name="logout" size={18} color={C.perigo} />
          <Text style={{ color: C.perigo, fontWeight: '700' }}>
            {confirmarSaida ? 'Toque de novo para sair (a conta de visitante será perdida)' : 'Sair da conta'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const estPerfil = StyleSheet.create({
  topo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    backgroundColor: C.painel,
    borderBottomWidth: 1,
    borderColor: C.borda,
  },
  titulo: { color: C.texto, fontWeight: '700', fontSize: 17 },
  conteudo: { padding: 16, gap: 14, maxWidth: 520, width: '100%', alignSelf: 'center' },
  cabeca: { alignItems: 'center', paddingVertical: 8 },
  avatar: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#fff' },
  avatarTxt: { color: '#fff', fontSize: 32, fontWeight: '800' },
  nome: { color: C.texto, fontSize: 20, fontWeight: '700', marginTop: 8 },
  info: { color: C.suave, fontSize: 12, marginTop: 2 },
  papel: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.painel2, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 3, marginTop: 8 },
  papelTxt: { color: '#fff', fontSize: 11, fontWeight: '700' },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  stat: { flexGrow: 1, flexBasis: '22%', minWidth: 72, backgroundColor: C.painel, borderRadius: 12, borderWidth: 1, borderColor: C.borda, padding: 10, alignItems: 'center' },
  statVal: { color: C.texto, fontSize: 22, fontWeight: '800', marginTop: 2 },
  statRot: { color: C.suave, fontSize: 11 },
  statUni: { color: C.suave, fontSize: 10 },
  cartao: { backgroundColor: C.painel, borderRadius: 14, borderWidth: 1, borderColor: C.borda, padding: 16 },
  secao: { color: C.destaque2, fontWeight: '700', marginBottom: 10 },
  rotulo: { color: C.suave, fontSize: 12, marginBottom: 5, textTransform: 'uppercase' },
  input: {
    backgroundColor: C.painel2,
    borderWidth: 1,
    borderColor: C.borda,
    color: C.texto,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 9,
    marginBottom: 10,
  },
  cores: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  cor: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: 'transparent' },
  corSel: { borderColor: '#fff' },
  botao: { backgroundColor: C.destaque, borderRadius: 10, paddingVertical: 11, alignItems: 'center' },
  botaoSec: { backgroundColor: 'transparent', borderWidth: 1, borderColor: C.destaque2 },
  botaoTxt: { color: '#fff', fontWeight: '700' },
  msg: { textAlign: 'center' },
  sair: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 14 },
});

// ================================================================
// src/screens/CriadorMapas.js
// ================================================================
// Criador de mapas no estilo do Dungeondraft:
// gere masmorras, cavernas e labirintos; pinte salas e terrenos com textura; coloque objetos de cenário
// dos seus packs; trace caminhos (estradas, rios); posicione luzes; trabalhe em vários andares;
// use qualquer asset (cenário, personagens com ficha, estruturas inteiras);
// importe mapas exportados do próprio Dungeondraft (.dd2vtt). Tudo é salvo em Meus assets › Mapas.

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

function CriadorMapas({ usuario, asset, onVoltar }) {
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
  const [fonte, setFonte] = useState('meus');
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
        setFontes([
          { id: 'meus', nome: 'Meus assets', assets: objetos(meus) },
          ...packs
            .filter((p) => packVisivelPara(p, usuario.usuario) && packEstaAtivo(ativos, p.id))
            .map((p) => ({ id: p.id, nome: p.nome, assets: objetos(p.assets) }))
            .filter((f) => f.assets.length),
        ]);
      } catch (e) {}
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
          <TouchableOpacity style={estCriadorMapas.btnSalvar} onPress={salvarMapa} disabled={salvando}>
            {salvando ? <ActivityIndicator color="#fff" /> : <Icone name="content-save-outline" size={18} color="#fff" />}
            <Text style={estCriadorMapas.btnSalvarTxt}>Salvar</Text>
          </TouchableOpacity>
        }
      />
      <View style={estCriadorMapas.linhaNome}>
        <TextInput style={estCriadorMapas.inputNome} value={nome} onChangeText={setNome} placeholder="Nome do mapa (ex.: Cripta do Rei)" placeholderTextColor={C.suave} />
        {niveis.current.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginTop: 6 }}>
            {niveis.current.map((nv, i) => (
              <TouchableOpacity key={i} onPress={() => { setNivel(i); setSel(null); }} style={[estCriadorMapas.chipAndar, nivel === i && estCriadorMapas.chipAndarAtivo]}>
                <Icone name="stairs" size={13} color={nivel === i ? '#fff' : C.suave} />
                <Text style={[estCriadorMapas.chipTxt, nivel === i && { color: '#fff' }]}>{nv.nome}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>

      {/* ---------- canvas ---------- */}
      <View
        ref={caixaRef}
        style={estCriadorMapas.canvas}
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
        <View style={estCriadorMapas.zoom} pointerEvents="box-none">
          <TouchableOpacity style={estCriadorMapas.zoomBtn} onPress={() => zoom(1.25)}>
            <Icone name="plus" size={18} color={C.texto} />
          </TouchableOpacity>
          <TouchableOpacity style={estCriadorMapas.zoomBtn} onPress={() => zoom(0.8)}>
            <Icone name="minus" size={18} color={C.texto} />
          </TouchableOpacity>
          <TouchableOpacity style={estCriadorMapas.zoomBtn} onPress={() => ajustar()}>
            <Icone name="fit-to-screen-outline" size={18} color={C.texto} />
          </TouchableOpacity>
          <TouchableOpacity style={estCriadorMapas.zoomBtn} onPress={desfazer}>
            <Icone name="undo" size={18} color={C.texto} />
          </TouchableOpacity>
        </View>
        {!!msg && (
          <View style={estCriadorMapas.aviso} pointerEvents="none">
            <Text style={{ color: C.texto, textAlign: 'center' }}>{msg}</Text>
          </View>
        )}
      </View>

      {/* ---------- painel ---------- */}
      <View style={estCriadorMapas.painel}>
        {/* ações do item selecionado */}
        {selecionado && (aba === 'cenario' || aba === 'detalhes') && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[estCriadorMapas.faixa, { borderBottomWidth: 1, borderColor: C.borda }]}>
            <Text style={estCriadorMapas.selTxt}>
              {sel.tipo === 'luz' ? 'Luz' : sel.tipo === 'forma' ? 'Forma' : selecionado.nome || (sel.tipo === 'objeto' ? 'Objeto' : sel.tipo === 'token' ? 'Token' : 'Caminho')}
            </Text>
            {sel.tipo === 'token' && (
              <>
                {[1, 2, 3, 4].map((t2) => (
                  <TouchableOpacity key={t2} onPress={() => alterarSel((tk) => { tk.tam = t2; tk.r = t2 * 0.45; })} style={[estCriadorMapas.chip, selecionado.tam === t2 && estCriadorMapas.chipAtivo]}>
                    <Text style={estCriadorMapas.chipTxt}>{t2}×</Text>
                  </TouchableOpacity>
                ))}
                {!!selecionado.ficha && <Text style={estCriadorMapas.dica}>com ficha</Text>}
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
                <Text style={estCriadorMapas.chipTxt}>{selecionado.r} cél.</Text>
                <OpcaoCriador icone="plus-circle-outline" rotulo="Raio +" onPress={() => alterarSel((l) => (l.r = Math.min(30, l.r + 1)))} />
                <View style={estCriadorMapas.grupo}>
                  {CORES_LUZ.map((c) => (
                    <TouchableOpacity key={c} onPress={() => alterarSel((l) => (l.cor = c))} style={[estCriadorMapas.cor, { backgroundColor: c }, selecionado.cor === c && estCriadorMapas.corSel]} />
                  ))}
                </View>
              </>
            )}
            <OpcaoCriador icone="trash-can-outline" rotulo="Apagar" onPress={apagarSel} cor={C.perigo} />
            <OpcaoCriador icone="close" rotulo="Soltar" onPress={() => setSel(null)} />
          </ScrollView>
        )}

        {aba === 'gerar' && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={estCriadorMapas.faixa}>
            <View style={estCriadorMapas.grupo}>
              {GERADORES.map((gen) => (
                <OpcaoCriador key={gen.id} ativo={gerador === gen.id} icone={gen.icone} rotulo={gen.nome} onPress={() => setGerador(gen.id)} />
              ))}
            </View>
            <View style={estCriadorMapas.grupo}>
              {TAMANHOS.map(([c, r]) => (
                <TouchableOpacity key={c} onPress={() => gerar(c, r)} style={[estCriadorMapas.chip, cols === c && rows === r && estCriadorMapas.chipAtivo]}>
                  <Text style={estCriadorMapas.chipTxt}>{c}×{r}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {gerador === 'masmorra' && <PassoCriador rotulo="Salas" valor={salas} onMenos={() => setSalas(Math.max(2, salas - 1))} onMais={() => setSalas(Math.min(30, salas + 1))} />}
            {gerador === 'caverna' && <OpcaoCriador ativo={agua} icone="water" rotulo="Água" onPress={() => setAgua(!agua)} />}
            <View style={estCriadorMapas.passo}>
              <Text style={estCriadorMapas.passoRot}>Semente</Text>
              <Text style={[estCriadorMapas.passoVal, { minWidth: 80 }]}>{semente}</Text>
            </View>
            <TouchableOpacity
              style={estCriadorMapas.btnGerar}
              onPress={() => {
                const sem = novaSemente();
                setSemente(sem);
                gerar(cols, rows, sem);
              }}
            >
              <Icone name="dice-multiple" size={18} color="#fff" />
              <Text style={estCriadorMapas.btnGerarTxt}>Gerar novo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[estCriadorMapas.btnGerar, estCriadorMapas.btnSec]} onPress={() => gerar()}>
              <Icone name="refresh" size={18} color={C.destaque2} />
              <Text style={[estCriadorMapas.btnGerarTxt, { color: C.destaque2 }]}>Mesma semente</Text>
            </TouchableOpacity>
          </ScrollView>
        )}

        {aba === 'pintar' && (
          <View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={estCriadorMapas.faixa}>
              <View style={estCriadorMapas.grupo}>
                {FERRAMENTAS_PINTAR.map((f) => (
                  <OpcaoCriador key={f.id} ativo={ferramenta === f.id} icone={f.icone} rotulo={f.nome} onPress={() => setFerramenta(f.id)} />
                ))}
              </View>
            </ScrollView>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[estCriadorMapas.faixa, { paddingTop: 0 }]}>
              <View style={estCriadorMapas.grupo}>
                {TERRENOS.map((t) => (
                  <OpcaoCriador key={t.id} ativo={terreno === t.id} icone={t.icone} rotulo={t.nome} onPress={() => setTerreno(t.id)} />
                ))}
              </View>
              <View style={estCriadorMapas.grupo}>
                {[0, 1, 2].map((r) => (
                  <TouchableOpacity key={r} onPress={() => setRaio(r)} style={[estCriadorMapas.chip, raio === r && estCriadorMapas.chipAtivo]}>
                    <Text style={estCriadorMapas.chipTxt}>{r * 2 + 1}×{r * 2 + 1}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity style={[estCriadorMapas.chip, { paddingHorizontal: 10 }]} onPress={limpar}>
                <Text style={[estCriadorMapas.chipTxt, { color: C.perigo }]}>Limpar andar</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        )}

        {aba === 'cenario' && (
          <View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={estCriadorMapas.faixa}>
              <OpcaoCriador ativo={ferramenta === 'objeto'} icone="stamper" rotulo="Colocar" onPress={() => setFerramenta('objeto')} />
              <OpcaoCriador ativo={ferramenta === 'selecionar'} icone="cursor-default-click-outline" rotulo="Selecionar" onPress={() => setFerramenta('selecionar')} />
              <OpcaoCriador ativo={encaixar} icone="magnet" rotulo="Encaixar" onPress={() => setEncaixar(!encaixar)} />
              {TIPOS_USO.map((tu) => (
                <OpcaoCriador key={tu.id} ativo={tipoUso === tu.id} icone={tu.icone} rotulo={tu.nome} onPress={() => { setTipoUso(tu.id); setPastaObj(null); setModelo(null); setFerramenta('objeto'); }} />
              ))}
              {fontes.map((f) => (
                <TouchableOpacity key={f.id} onPress={() => { setFonte(f.id); setPastaObj(null); }} style={[estCriadorMapas.chipAndar, fonteAtual && fonteAtual.id === f.id && estCriadorMapas.chipAndarAtivo]}>
                  <Text style={[estCriadorMapas.chipTxt, fonteAtual && fonteAtual.id === f.id && { color: '#fff' }]} numberOfLines={1}>{f.nome}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            {pastas.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[estCriadorMapas.faixa, { paddingTop: 0, gap: 4 }]}>
                {[null, ...pastas].map((p) => (
                  <TouchableOpacity key={p || 'todas'} onPress={() => setPastaObj(p)} style={[estCriadorMapas.pasta, pastaObj === p && estCriadorMapas.pastaAtiva]}>
                    <Icone name={p ? 'folder-outline' : 'folder-multiple-outline'} size={12} color={pastaObj === p ? '#fff' : C.suave} />
                    <Text style={[estCriadorMapas.pastaTxt, pastaObj === p && { color: '#fff' }]}>{p || 'Todas'}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[estCriadorMapas.faixa, { paddingTop: 0 }]}>
              {objsVisiveis.length === 0 && (
                <Text style={estCriadorMapas.dica}>
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
                  style={[estCriadorMapas.assetBtn, modelo && modelo.id === a.id && estCriadorMapas.assetBtnAtivo]}
                >
                  <AssetMini asset={a} tamanho={36} />
                  <Text style={estCriadorMapas.assetNome} numberOfLines={1}>{a.nome}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {aba === 'detalhes' && (
          <View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={estCriadorMapas.faixa}>
              <OpcaoCriador ativo={ferramenta === 'caminho'} icone="vector-polyline" rotulo="Caminho" onPress={() => setFerramenta('caminho')} />
              <OpcaoCriador ativo={ferramenta === 'luz'} icone="lightbulb-on-outline" rotulo="Luz" onPress={() => setFerramenta('luz')} />
              <OpcaoCriador ativo={ferramenta === 'selecionar'} icone="cursor-default-click-outline" rotulo="Selecionar" onPress={() => setFerramenta('selecionar')} />
              <OpcaoCriador ativo={ferramenta === 'mover'} icone="hand-back-right-outline" rotulo="Mover" onPress={() => setFerramenta('mover')} />
            </ScrollView>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[estCriadorMapas.faixa, { paddingTop: 0 }]}>
              {ferramenta === 'luz' ? (
                <>
                  <PassoCriador rotulo="Raio" valor={`${raioLuz} cél.`} onMenos={() => setRaioLuz(Math.max(1, raioLuz - 1))} onMais={() => setRaioLuz(Math.min(30, raioLuz + 1))} />
                  <View style={estCriadorMapas.grupo}>
                    {CORES_LUZ.map((c) => (
                      <TouchableOpacity key={c} onPress={() => setCorLuz(c)} style={[estCriadorMapas.cor, { backgroundColor: c }, corLuz === c && estCriadorMapas.corSel]} />
                    ))}
                  </View>
                  <PassoCriador rotulo="Escuridão" valor={`${Math.round(escuridao * 100)}%`} onMenos={() => setEscuridao(Math.max(0, Math.round((escuridao - 0.1) * 10) / 10))} onMais={() => setEscuridao(Math.min(0.95, Math.round((escuridao + 0.1) * 10) / 10))} />
                </>
              ) : (
                <View style={estCriadorMapas.grupo}>
                  {CAMINHOS.map((c) => (
                    <TouchableOpacity key={c.id} onPress={() => { setTipoCaminho(c.id); setFerramenta('caminho'); }} style={[estCriadorMapas.opcao, tipoCaminho === c.id && ferramenta === 'caminho' && estCriadorMapas.opcaoAtiva]}>
                      <Icone name={c.icone} size={18} color={c.cor} />
                      <Text style={[estCriadorMapas.opcaoTxt, tipoCaminho === c.id && ferramenta === 'caminho' && { color: '#fff' }]}>{c.nome}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </ScrollView>
          </View>
        )}

        {aba === 'mapa' && (
          <View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={estCriadorMapas.faixa}>
              <TextInput style={[estCriadorMapas.inputNome, { width: 140, paddingVertical: 5 }]} value={n.nome} onChangeText={renomearAndar} placeholder="Nome do andar" placeholderTextColor={C.suave} />
              <OpcaoCriador icone="layers-plus" rotulo="Novo andar" onPress={novoAndar} />
              <OpcaoCriador icone="layers-remove" rotulo="Apagar andar" onPress={apagarAndar} cor={C.perigo} />
              <View style={estCriadorMapas.grupo}>
                {TAMANHOS.map(([c, r]) => (
                  <TouchableOpacity key={c} onPress={() => redimensionar(c, r)} style={[estCriadorMapas.chip, cols === c && rows === r && estCriadorMapas.chipAtivo]}>
                    <Text style={estCriadorMapas.chipTxt}>{c}×{r}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity style={[estCriadorMapas.btnGerar, estCriadorMapas.btnSec]} onPress={importar}>
                <Icone name="file-import-outline" size={18} color={C.destaque2} />
                <Text style={[estCriadorMapas.btnGerarTxt, { color: C.destaque2 }]}>Importar Dungeondraft</Text>
              </TouchableOpacity>
            </ScrollView>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[estCriadorMapas.faixa, { paddingTop: 0 }]}>
              {Object.entries(TEMAS_MAPA).map(([id, t]) => (
                <TouchableOpacity key={id} onPress={() => setTema(id)} style={[estCriadorMapas.tema, tema === id && { borderColor: C.destaque2 }]}>
                  <View style={[estCriadorMapas.temaAmostra, { backgroundColor: t.fundo }]}>
                    <View style={{ width: 22, height: 14, backgroundColor: t.chao, borderWidth: 2, borderColor: t.parede }} />
                  </View>
                  <Text style={estCriadorMapas.temaTxt}>{t.nome}</Text>
                </TouchableOpacity>
              ))}
              <OpcaoCriador ativo={textura} icone="texture-box" rotulo="Texturas" onPress={() => setTextura(!textura)} />
              <OpcaoCriador ativo={mostrarGrade} icone="grid" rotulo="Grade" onPress={() => setMostrarGrade(!mostrarGrade)} />
            </ScrollView>
          </View>
        )}

        <View style={estCriadorMapas.abas}>
          {ABAS_CRIADOR.map((a) => (
            <TouchableOpacity key={a.id} style={[estCriadorMapas.aba, aba === a.id && estCriadorMapas.abaAtiva]} onPress={() => trocarAba(a.id)}>
              <Icone name={a.icone} size={20} color={aba === a.id ? C.destaque2 : C.suave} />
              <Text style={[estCriadorMapas.abaTxt, aba === a.id && { color: C.destaque2 }]} numberOfLines={1}>{a.nome}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );
}

function OpcaoCriador({ ativo, icone, rotulo, onPress, cor }) {
  return (
    <TouchableOpacity onPress={onPress} style={[estCriadorMapas.opcao, ativo && estCriadorMapas.opcaoAtiva]}>
      <Icone name={icone} size={18} color={ativo ? '#fff' : cor || C.suave} />
      <Text style={[estCriadorMapas.opcaoTxt, ativo && { color: '#fff' }, cor && !ativo && { color: cor }]}>{rotulo}</Text>
    </TouchableOpacity>
  );
}

function PassoCriador({ rotulo, valor, onMenos, onMais }) {
  return (
    <View style={estCriadorMapas.passo}>
      <Text style={estCriadorMapas.passoRot}>{rotulo}</Text>
      <View style={estCriadorMapas.grupo}>
        <TouchableOpacity onPress={onMenos} style={estCriadorMapas.passoBtn}>
          <Icone name="minus" size={14} color={C.texto} />
        </TouchableOpacity>
        <Text style={estCriadorMapas.passoVal}>{valor}</Text>
        <TouchableOpacity onPress={onMais} style={estCriadorMapas.passoBtn}>
          <Icone name="plus" size={14} color={C.texto} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const estCriadorMapas = StyleSheet.create({
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

// ================================================================
// App.js
// ================================================================
export default function App() {
  const [usuario, setUsuario] = useState(null);
  const [iniciando, setIniciando] = useState(true);
  const [tela, setTela] = useState({ nome: 'inicio' }); // inicio | meus | packs | postagens | perfil | mesa | acesso | mapas
  const [mesaPendente, setMesaPendente] = useState(null); // mesa a abrir depois de um login

  function abrirMesa(codigo, u) {
    setTela({ nome: 'mesa', codigo });
    if (u) registrarRecente(u.usuario, codigo).catch(() => {});
  }

  useEffect(() => {
    (async () => {
      await garantirContaDev();
      let u = await restaurarSessao();
      const codigo = await mesaDoLink();
      if (codigo) {
        // Abriu pelo link: quem não está logado entra como visitante (anônimo) automaticamente
        if (!u) {
          try {
            u = await entrarAnonimo();
          } catch (e) {
            setMesaPendente(codigo); // anônimo indisponível: pede login e abre a mesa depois
          }
        }
        if (u) abrirMesa(codigo, u);
      }
      if (u) setUsuario(u);
      setIniciando(false);
    })();
  }, []);

  function logado(u) {
    setUsuario(u);
    if (mesaPendente) {
      abrirMesa(mesaPendente, u);
      setMesaPendente(null);
    } else {
      setTela({ nome: 'inicio' });
    }
  }

  async function deslogar() {
    await sair();
    setUsuario(null);
    setTela({ nome: 'inicio' });
  }

  let conteudo;
  if (iniciando) {
    conteudo = (
      <View style={estApp.splash}>
        <Logo tamanho={96} id="logoSplash" />
        <ActivityIndicator color={C.destaque} style={{ marginTop: 20 }} />
      </View>
    );
  } else if (!usuario) {
    conteudo = <Acesso onLogado={logado} mesaPendente={mesaPendente} />;
  } else if (tela.nome === 'acesso') {
    // visitante numa mesa decidiu entrar / criar conta
    conteudo = (
      <Acesso
        onLogado={logado}
        mesaPendente={mesaPendente}
        onContinuarVisitante={() => {
          setTela(mesaPendente ? { nome: 'mesa', codigo: mesaPendente } : { nome: 'inicio' });
          setMesaPendente(null);
        }}
      />
    );
  } else if (tela.nome === 'mesa') {
    conteudo = (
      <Mesa
        key={tela.codigo + usuario.usuario}
        codigo={tela.codigo}
        usuario={usuario}
        onSair={() => setTela({ nome: 'inicio' })}
        onEntrarConta={() => {
          setMesaPendente(tela.codigo);
          setTela({ nome: 'acesso' });
        }}
        onCriarMapa={() => setTela({ nome: 'mapas', de: 'mesa', codigo: tela.codigo })}
      />
    );
  } else if (tela.nome === 'meus') {
    conteudo = (
      <MeusAssets
        usuario={usuario}
        onVoltar={() => setTela({ nome: 'inicio' })}
        onAbrirPacks={() => setTela({ nome: 'packs', de: 'meus' })}
        onCriarMapa={(asset) => setTela({ nome: 'mapas', asset, de: 'meus' })}
      />
    );
  } else if (tela.nome === 'mapas') {
    conteudo = (
      <CriadorMapas
        key={(tela.asset && tela.asset.id) || 'novo'}
        usuario={usuario}
        asset={tela.asset}
        onVoltar={() => setTela(tela.de === 'mesa' ? { nome: 'mesa', codigo: tela.codigo } : { nome: tela.de || 'inicio' })}
      />
    );
  } else if (tela.nome === 'packs') {
    conteudo = <PacksUsuario usuario={usuario} abaInicial={tela.aba} onVoltar={() => setTela({ nome: tela.de || 'inicio' })} />;
  } else if (tela.nome === 'postagens' && usuario.papel === 'admin') {
    conteudo = <Postagens usuario={usuario} abaInicial={tela.aba} onVoltar={() => setTela({ nome: 'inicio' })} />;
  } else if (tela.nome === 'perfil') {
    conteudo = (
      <Perfil usuario={usuario} onAtualizado={setUsuario} onVoltar={() => setTela({ nome: 'inicio' })} onSair={deslogar} />
    );
  } else {
    conteudo = (
      <Inicio
        usuario={usuario}
        onAbrirMesa={(codigo) => setTela({ nome: 'mesa', codigo })}
        onMeusAssets={() => setTela({ nome: 'meus' })}
        onPacks={(aba) => setTela({ nome: 'packs', aba })}
        onPostagens={(aba) => setTela({ nome: 'postagens', aba })}
        onCriarMapa={() => setTela({ nome: 'mapas' })}
        onPerfil={() => setTela({ nome: 'perfil' })}
        onEntrarConta={() => setTela({ nome: 'acesso' })}
      />
    );
  }

  return (
    <SafeAreaView style={estApp.raiz}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />
      {conteudo}
    </SafeAreaView>
  );
}

const estApp = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: C.bg },
  splash: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
