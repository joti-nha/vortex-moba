import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { MaterialCommunityIcons as Icone } from '@expo/vector-icons';
import { C } from '../config/theme';
import { apagar } from '../services/firestore';
import { ICONE_TIPO, NOME_TIPO } from '../utils/util';

// Outliner: camadas manuais (criar, renomear, ocultar, travar, reordenar)
// e a lista de itens dentro de cada camada.
export default function PainelCamadas({
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
    <View style={s.painel}>
      <View style={s.cabeca}>
        <Icone name="layers-triple-outline" size={20} color={C.destaque} />
        <Text style={s.titulo}>Camadas</Text>
        <TouchableOpacity style={s.btnNova} onPress={onNovaCamada}>
          <Icone name="plus" size={16} color="#fff" />
          <Text style={s.btnNovaTxt}>Nova</Text>
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
            <View key={cam.id} style={[s.camada, ativa && s.camadaAtiva]}>
              <View style={s.linhaCamada}>
                <TouchableOpacity onPress={() => setAbertas({ ...abertas, [cam.id]: !aberta })} style={s.ic}>
                  <Icone name={aberta ? 'chevron-down' : 'chevron-right'} size={18} color={C.suave} />
                </TouchableOpacity>

                <TouchableOpacity onPress={() => onSalvarCamada({ ...cam, visivel: !cam.visivel })} style={s.ic}>
                  <Icone name={cam.visivel ? 'eye-outline' : 'eye-off-outline'} size={18} color={cam.visivel ? C.texto : C.suave} />
                </TouchableOpacity>

                <TouchableOpacity onPress={() => onSalvarCamada({ ...cam, travada: !cam.travada })} style={s.ic}>
                  <Icone name={cam.travada ? 'lock' : 'lock-open-variant-outline'} size={17} color={cam.travada ? '#f59e0b' : C.suave} />
                </TouchableOpacity>

                {editando === cam.id ? (
                  <TextInput
                    style={s.inputNome}
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
                    <Text style={[s.nome, !cam.visivel && { opacity: 0.45 }]} numberOfLines={1}>
                      {cam.nome}
                    </Text>
                    <Text style={s.contagem}>
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
                  style={s.ic}
                >
                  <Icone name="pencil-outline" size={16} color={C.suave} />
                </TouchableOpacity>
                <TouchableOpacity disabled={idx === 0} onPress={() => onMoverCamada(cam.id, +1)} style={s.ic}>
                  <Icone name="arrow-up" size={16} color={idx === 0 ? C.borda : C.suave} />
                </TouchableOpacity>
                <TouchableOpacity disabled={idx === doTopo.length - 1} onPress={() => onMoverCamada(cam.id, -1)} style={s.ic}>
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
                  style={s.ic}
                >
                  <Icone name={confirmar === cam.id ? 'check-bold' : 'trash-can-outline'} size={16} color={confirmar === cam.id ? C.perigo : C.suave} />
                </TouchableOpacity>
              </View>

              {confirmar === cam.id && (
                <Text style={s.aviso}>Toque de novo para apagar a camada e seus itens</Text>
              )}

              {aberta && (
                <View style={s.listaItens}>
                  {seus.length === 0 && <Text style={s.vazio}>Camada vazia</Text>}
                  {seus.map((it) => (
                    <TouchableOpacity
                      key={it.id}
                      style={[s.item, it.id === selecionado && s.itemSel]}
                      onPress={() => onSelecionar(it.id)}
                    >
                      <View style={[s.bolinha, { backgroundColor: it.cor }]} />
                      <Icone name={ICONE_TIPO[it.type] || 'shape-outline'} size={15} color={C.suave} />
                      <Text style={s.itemTxt} numberOfLines={1}>
                        {it.rotulo || NOME_TIPO[it.type] || it.type}
                      </Text>
                      {!!it.autor && <Text style={s.autor}>{it.autor}</Text>}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          );
        })}
        <Text style={s.dica}>Toque no nome para ativar a camada (novos itens vão para ela). Segure ou use o lápis para renomear.</Text>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
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
