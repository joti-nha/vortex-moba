import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Modal, Image, ActivityIndicator } from 'react-native';
import { MaterialCommunityIcons as Icone } from '@expo/vector-icons';
import { CampoImagem } from './CampoImagem';
import { CampoPasta } from './CampoPasta';
import { C, CORES } from '../config/theme';
import { useImagem } from '../services/imagens';

// ---------- Ficha reduzida do Vortex ----------
// Teste: 2d6 + Atributo + Perícia · Atributos: Corpo, Precisão, Essência
export const TIPOS = ['Aliado', 'Inimigo', 'NPC', 'Criatura'];
export const ICONE_CATEGORIA = { Aliado: 'shield-account', Inimigo: 'sword-cross', NPC: 'account-tie', Criatura: 'paw' };
export const ATRIBUTOS = [
  ['corpo', 'Corpo', 'arm-flex-outline'],
  ['precisao', 'Precisão', 'bullseye-arrow'],
  ['essencia', 'Essência', 'creation'],
];

export const FICHA_VAZIA = {
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

export function normalizarFicha(f = {}) {
  return {
    ...FICHA_VAZIA,
    ...f,
    pericias: Array.isArray(f.pericias) ? f.pericias : [],
    recursos: Array.isArray(f.recursos) ? f.recursos : FICHA_VAZIA.recursos,
  };
}

export const porNome = (l) => l.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));

// Só os dados de jogo (o que vai junto do token na mesa)
export const dadosDeJogo = (f) => ({
  conceito: f.conceito || '',
  tipo: f.tipo || 'Aliado',
  corpo: f.corpo || 0,
  precisao: f.precisao || 0,
  essencia: f.essencia || 0,
  pericias: f.pericias || [],
  recursos: f.recursos || [],
  descricao: f.descricao || '',
});

export function TokenMini({ item, tamanho = 44 }) {
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

export function Contador({ rotulo, valor, onMudar, min = 0, max = 6, travado }) {
  return (
    <View style={s.contador}>
      {!!rotulo && <Text style={s.contRot}>{rotulo}</Text>}
      <View style={s.contLinha}>
        {!travado && (
          <TouchableOpacity onPress={() => onMudar(Math.max(min, valor - 1))} style={s.contBtn}>
            <Icone name="minus" size={14} color={C.texto} />
          </TouchableOpacity>
        )}
        <Text style={s.contValor}>{valor}</Text>
        {!travado && (
          <TouchableOpacity onPress={() => onMudar(Math.min(max, valor + 1))} style={s.contBtn}>
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
export default function FichaVortex({ ficha, titulo, somenteLeitura, acaoExtra, onSalvar, onApagar, onFechar, onRolagem, pastas }) {
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
      <View style={s.fundo}>
        <View style={s.modal}>
          {/* cabeçalho */}
          <View style={s.topo}>
            <TokenMini item={f} tamanho={46} />
            <View style={{ flex: 1 }}>
              <Text style={s.etiqueta}>{titulo || 'Ficha Vortex'}</Text>
              {ro ? (
                <Text style={s.nomeRO}>{f.nome}</Text>
              ) : (
                <TextInput style={s.nome} value={f.nome} onChangeText={(t) => set('nome', t)} placeholder="Nome" placeholderTextColor={C.suave} />
              )}
            </View>
            <TouchableOpacity onPress={onFechar}>
              <Icone name="close" size={22} color={C.suave} />
            </TouchableOpacity>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled">
            {ro ? (
              !!f.conceito && <Text style={s.conceitoRO}>{f.conceito}</Text>
            ) : (
              <TextInput
                style={s.input}
                value={f.conceito}
                onChangeText={(t) => set('conceito', t)}
                placeholder="Conceito (ex.: guerreira exilada do norte)"
                placeholderTextColor={C.suave}
              />
            )}

            {/* token */}
            <Text style={s.secao}>Token (visual na mesa)</Text>
            <View style={s.linhaWrap}>
              {TIPOS.map((t) => (
                <TouchableOpacity key={t} disabled={ro} onPress={() => set('tipo', t)} style={[s.chip, f.tipo === t && s.chipAtivo]}>
                  <Icone name={ICONE_CATEGORIA[t]} size={13} color={f.tipo === t ? '#fff' : C.suave} />
                  <Text style={[s.chipTxt, f.tipo === t && { color: '#fff' }]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={[s.linhaWrap, { marginTop: 8 }]}>
              {[1, 2, 3, 4].map((t) => (
                <TouchableOpacity key={t} disabled={ro} onPress={() => set('tamanho', t)} style={[s.chip, f.tamanho === t && s.chipAtivo]}>
                  <Text style={[s.chipTxt, f.tamanho === t && { color: '#fff' }]}>{t}×{t}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {!ro && (
              <>
                <View style={[s.linhaWrap, { marginTop: 8 }]}>
                  {CORES.map((c) => (
                    <TouchableOpacity key={c} onPress={() => set('cor', c)} style={[s.cor, { backgroundColor: c }, f.cor === c && s.corSel]} />
                  ))}
                </View>
                <View style={{ marginTop: 10 }}>
                  <CampoImagem valor={f.img} onMudar={(ref) => set('img', ref)} largura={256} rotulo="Imagem do token" redondo />
                </View>
              </>
            )}
            {!!pastas && !ro && <CampoPasta valor={f.pasta || ''} pastas={pastas} onMudar={(v) => set('pasta', v)} />}

            {/* atributos (ficha) */}
            <Text style={[s.secao, { color: C.destaque2, marginTop: 18 }]}>Ficha Vortex</Text>
            {/* atributos */}
            <Text style={s.secao}>Atributos</Text>
            <View style={s.linhaWrap}>
              {ATRIBUTOS.map(([k, rot, ic]) => (
                <View key={k} style={[s.attr, rolAttr === k && s.attrSel]}>
                  <TouchableOpacity onPress={() => setRolAttr(k)} style={s.attrCab}>
                    <Icone name={ic} size={14} color={rolAttr === k ? C.destaque2 : C.suave} />
                    <Text style={[s.attrNome, rolAttr === k && { color: C.destaque2 }]}>{rot}</Text>
                  </TouchableOpacity>
                  <Contador valor={f[k] || 0} onMudar={(v) => set(k, v)} travado={ro} />
                </View>
              ))}
            </View>

            {/* perícias */}
            <Text style={s.secao}>Perícias</Text>
            {f.pericias.length === 0 && <Text style={s.vazio}>Nenhuma perícia.</Text>}
            {f.pericias.map((p, i) => (
              <View key={i} style={[s.linhaItem, rolPer === i && s.linhaSel]}>
                <TouchableOpacity onPress={() => setRolPer(rolPer === i ? -1 : i)} style={{ padding: 2 }}>
                  <Icone name={rolPer === i ? 'checkbox-marked-circle' : 'checkbox-blank-circle-outline'} size={18} color={rolPer === i ? C.destaque2 : C.suave} />
                </TouchableOpacity>
                {ro ? (
                  <Text style={[s.itemTxt, { flex: 1 }]}>{p.nome}</Text>
                ) : (
                  <TextInput style={[s.inputMini, { flex: 1 }]} value={p.nome} onChangeText={(t) => setLista('pericias', i, 'nome', t)} placeholder="Perícia" placeholderTextColor={C.suave} />
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
              <TouchableOpacity style={s.add} onPress={() => set('pericias', [...f.pericias, { nome: '', valor: 1 }])}>
                <Icone name="plus" size={14} color={C.destaque2} />
                <Text style={s.addTxt}>Perícia</Text>
              </TouchableOpacity>
            )}

            {/* rolagem */}
            <View style={s.rolador}>
              <TouchableOpacity style={s.btnRolar} onPress={rolar}>
                <Icone name="dice-multiple" size={20} color="#fff" />
                <Text style={s.btnRolarTxt}>Rolar 2d6</Text>
              </TouchableOpacity>
              <View style={{ flex: 1 }}>
                <Text style={s.rolTxt}>
                  + {ATRIBUTOS.find((x) => x[0] === rolAttr)[1]} ({f[rolAttr] || 0})
                  {rolPer >= 0 && f.pericias[rolPer] ? ` + ${f.pericias[rolPer].nome || 'perícia'} (${f.pericias[rolPer].valor || 0})` : ''}
                </Text>
                {resultado && (
                  <Text style={s.rolRes}>
                    [{resultado.a}+{resultado.b}] + {resultado.attr}
                    {resultado.per ? ` + ${resultado.per.valor || 0}` : ''} = <Text style={s.rolTotal}>{resultado.total}</Text>
                  </Text>
                )}
              </View>
            </View>

            {/* recursos */}
            <Text style={s.secao}>Recursos</Text>
            {f.recursos.map((r, i) => (
              <View key={i} style={s.linhaItem}>
                {ro ? (
                  <Text style={[s.itemTxt, { flex: 1 }]}>{r.nome}</Text>
                ) : (
                  <TextInput style={[s.inputMini, { flex: 1 }]} value={r.nome} onChangeText={(t) => setLista('recursos', i, 'nome', t)} placeholder="Recurso" placeholderTextColor={C.suave} />
                )}
                <Contador valor={parseInt(r.atual, 10) || 0} onMudar={(v) => setLista('recursos', i, 'atual', v)} max={999} travado={ro} />
                <Text style={s.barra}>/</Text>
                {ro ? (
                  <Text style={s.itemTxt}>{r.max}</Text>
                ) : (
                  <TextInput
                    style={[s.inputMini, { width: 46, textAlign: 'center' }]}
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
              <TouchableOpacity style={s.add} onPress={() => set('recursos', [...f.recursos, { nome: '', atual: 5, max: 5 }])}>
                <Icone name="plus" size={14} color={C.destaque2} />
                <Text style={s.addTxt}>Recurso</Text>
              </TouchableOpacity>
            )}

            {/* notas */}
            <Text style={s.secao}>Notas</Text>
            {ro ? (
              <Text style={s.notasRO}>{f.descricao || '—'}</Text>
            ) : (
              <TextInput
                style={[s.input, { minHeight: 64, textAlignVertical: 'top' }]}
                value={f.descricao}
                onChangeText={(t) => set('descricao', t)}
                multiline
                placeholder="Equipamento, história, observações..."
                placeholderTextColor={C.suave}
              />
            )}
            {!!f.autor && <Text style={s.autor}>Cadastrado por {f.autor}</Text>}
          </ScrollView>

          {!!erro && <Text style={{ color: C.perigo, marginTop: 6 }}>{erro}</Text>}
          <View style={s.acoes}>
            {!!onApagar && !ro && (
              <TouchableOpacity style={[s.btn, s.btnPerigo]} onPress={apagar} disabled={ocupado}>
                <Text style={{ color: C.perigo, fontWeight: '700' }}>{confirmar ? 'Confirmar?' : 'Excluir'}</Text>
              </TouchableOpacity>
            )}
            {!!acaoExtra && (
              <TouchableOpacity style={[s.btn, s.btnSec]} onPress={acaoExtra.onPress} disabled={ocupado || acaoExtra.desativado}>
                <Icone name={acaoExtra.icone} size={16} color={C.destaque2} />
                <Text style={{ color: C.destaque2, fontWeight: '700' }}>{acaoExtra.rotulo}</Text>
              </TouchableOpacity>
            )}
            {!ro && (
              <TouchableOpacity style={[s.btn, s.btnPrim]} onPress={salvar} disabled={ocupado}>
                {ocupado ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '700' }}>Salvar</Text>}
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
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
