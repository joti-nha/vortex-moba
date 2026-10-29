// Sistema de contas da Mesa Vortex (coleção usuarios).
// Métodos de entrada:
//  - e-mail/usuário + senha: conta própria (salt + hash SHA-256 iterado, a senha nunca é salva)
//  - anônimo (visitante): Firebase Authentication via REST (Identity Toolkit), sem SDK
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CORES } from '../config/theme';
import { COL, atualizar, consultar, lerDoc, salvar } from './firestore';

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

export function sha256(texto) {
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

export function validarCadastro({ nome, email, usuario, senha, confirmar }) {
  if (nome.trim().length < 2) return 'Digite seu nome (mín. 2 letras).';
  if (!RE_EMAIL.test(email.trim())) return 'E-mail inválido.';
  if (!RE_USUARIO.test(usuario.trim().toLowerCase())) return 'Usuário: 3 a 20 caracteres (letras, números, _ ou .).';
  if (senha.length < 6) return 'A senha precisa de pelo menos 6 caracteres.';
  if (!/[0-9]/.test(senha) || !/[a-zA-Z]/.test(senha)) return 'A senha precisa ter letras e números.';
  if (senha !== confirmar) return 'As senhas não conferem.';
  return '';
}

// E-mails que sempre têm papel de admin (além das contas admin/dev criadas no início)
export const EMAILS_ADMIN = ['jotalhaojogos@gmail.com'];
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
export const CONTAS_INICIAIS = [
  { usuario: 'admin', nome: 'Administrador', email: 'admin@mesavortex.app', senhaInicial: 'admin123', cor: '#ef4444' },
  { usuario: 'dev', nome: 'Desenvolvedor', email: 'dev@mesavortex.app', senhaInicial: 'vortex123', cor: '#8b5cf6' },
];
const RESERVADOS = ['dev', 'admin', 'root', 'sistema'];

// Cria as contas admin e dev (papel "admin") se ainda não existirem
export async function garantirContaDev() {
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
export async function lerPacksAtivos(usuario) {
  const conta = await lerDoc(`${COL.usuarios}/${usuario}`);
  return conta && Array.isArray(conta.packsAtivos) ? conta.packsAtivos : null;
}

export async function salvarPacksAtivos(usuario, ids) {
  await atualizar(`${COL.usuarios}/${usuario}`, { packsAtivos: ids });
}

async function guardarSessao(sessao) {
  try {
    await AsyncStorage.setItem(CHAVE_SESSAO, JSON.stringify(sessao));
  } catch (e) {}
}

// ---------- operações ----------
export async function cadastrar(dados) {
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
export async function entrar(login, senha) {
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

export async function sair() {
  try {
    await AsyncStorage.removeItem(CHAVE_SESSAO);
  } catch (e) {}
}

export async function restaurarSessao() {
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

export async function atualizarPerfil(usuario, { nome, cor }) {
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

export async function trocarSenha(usuario, atual, nova, confirmar) {
  const conta = await lerDoc(`${COL.usuarios}/${usuario}`);
  if (!conta || hashSenha(atual, conta.salt) !== conta.senhaHash) throw new Error('Senha atual incorreta.');
  if (nova.length < 6 || !/[0-9]/.test(nova) || !/[a-zA-Z]/.test(nova)) {
    throw new Error('Nova senha: mín. 6 caracteres, com letras e números.');
  }
  if (nova !== confirmar) throw new Error('As senhas não conferem.');
  const salt = gerarSalt();
  await atualizar(`${COL.usuarios}/${usuario}`, { salt, senhaHash: hashSenha(nova, salt) });
}

export async function registrarRecente(usuario, codigo) {
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

export async function entrarAnonimo() {
  const j = await chamarAuth('signUp', {});
  return contaFirebase({
    prefixo: 'anon',
    localId: j.localId,
    nome: `Visitante ${j.localId.slice(-4).toUpperCase()}`,
    provedor: 'anonimo',
  });
}
