// Imagens: galeria, câmera ou URL.
// Imagens enviadas do aparelho são redimensionadas, comprimidas (JPEG) e salvas em base64
// na coleção "imagens" do Firestore. Os itens guardam só a referência "fs:ID".
import { useEffect, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';
import { lerDoc, salvar } from './firestore';
import { gerarId } from '../utils/util';

const COL_IMAGENS = 'imagens';
const LIMITE = 900000; // caracteres de base64 (documento do Firestore tem limite de 1 MB)

// ---------- cache de imagens já baixadas ----------
const cacheImg = {};
const pendentesImg = {};

export async function resolverImagem(ref) {
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
export function useImagem(ref) {
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
export async function escolherImagem(origem, { largura = 512, autor = '' } = {}) {
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
export async function salvarImagemDeUri(uri, { largura = 1024, autor = '' } = {}) {
  const r = await comprimir(uri, largura);
  const id = gerarId();
  const dados = `data:image/jpeg;base64,${r.base64}`;
  await salvar(`${COL_IMAGENS}/${id}`, { dados, largura: r.width, altura: r.height, autor, criadoEm: Date.now() });
  cacheImg[id] = dados;
  return { ref: `fs:${id}`, w: r.width, h: r.height };
}

// Tipo da imagem pelo início do base64
export function mimeDoBase64(b64) {
  if (b64.startsWith('/9j/')) return 'image/jpeg';
  if (b64.startsWith('UklGR')) return 'image/webp';
  return 'image/png';
}

// Imagem que chega em base64 (ex.: mapa do Dungeondraft). No celular vira arquivo temporário antes de comprimir.
export async function salvarImagemBase64(b64, opcoes = {}) {
  const mime = mimeDoBase64(b64);
  if (Platform.OS === 'web') return salvarImagemDeUri(`data:${mime};base64,${b64}`, opcoes);
  const arq = new File(Paths.cache, `import_${Date.now()}.${mime.split('/')[1]}`);
  arq.create({ overwrite: true });
  await arq.write(b64, { encoding: 'base64' });
  try {
    return await salvarImagemDeUri(arq.uri, opcoes);
  } finally {
    try {
      arq.delete();
    } catch (e) {}
  }
}
