// Acesso ao Firestore via REST (sem SDK), compatível com o Expo Snack
const PROJETO_ID = 'vortex-mobile-21f79';
const FIRESTORE_URL = `https://firestore.googleapis.com/v1/projects/${PROJETO_ID}/databases/(default)/documents`;

// Coleções do banco principal (vortex-mobile-21f79)
export const COL = {
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
export async function lerDoc(caminho) {
  const r = await fetch(`${FIRESTORE_URL}/${caminho}`);
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`Firestore ${r.status}`);
  const j = await r.json();
  return { id: idDoNome(j.name), ...deCampos(j.fields || {}) };
}

export async function listar(caminho) {
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
export async function salvar(caminho, dados) {
  const r = await fetch(`${FIRESTORE_URL}/${caminho}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: paraCampos(semId(dados)) }),
  });
  if (!r.ok) throw new Error(`Firestore ${r.status}`);
}

// Atualiza só os campos enviados
export async function atualizar(caminho, parcial) {
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
export async function consultar(colecao, campo, valor) {
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

export async function apagar(caminho) {
  const r = await fetch(`${FIRESTORE_URL}/${caminho}`, { method: 'DELETE' });
  if (!r.ok && r.status !== 404) throw new Error(`Firestore ${r.status}`);
}
