// Importação de mapas do Dungeondraft (formato Universal VTT: .dd2vtt / .uvtt / .df2vtt).
// O arquivo é um JSON com a imagem do mapa em base64, o tamanho em células,
// pixels por célula, paredes (line_of_sight), portas (portals) e luzes (lights), tudo em unidades de grade.
import { Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { salvar } from './firestore';
import { assetsDe } from './assets';
import { salvarImagemBase64 } from './imagens';
import { gerarId } from '../utils/util';

const CEL = 70; // tamanho da célula na mesa

// Abre o seletor de arquivos e devolve { nome, dados } ou null se cancelado
export async function escolherArquivoVtt() {
  const r = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true, multiple: false });
  if (!r || r.canceled || !r.assets || !r.assets.length) return null;
  const a = r.assets[0];
  let texto;
  if (Platform.OS === 'web') {
    texto = a.file ? await a.file.text() : await (await fetch(a.uri)).text();
  } else {
    texto = await new File(a.uri).text();
  }
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
export async function importarVtt(arquivo, { usuario, aoProgresso } = {}) {
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
