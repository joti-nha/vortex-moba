import React, { useState } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { MaterialCommunityIcons as Icone } from '@expo/vector-icons';
import { CampoImagem } from '../components/CampoImagem';
import { C } from '../config/theme';
import { salvar } from '../services/firestore';

export default function ConfigMesa({ visivel, sala, codigo, autor, onSalvar, onFechar }) {
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
      <View style={s.fundo}>
        <View style={s.caixa}>
          <View style={s.cabeca}>
            <Icone name="cog-outline" size={20} color={C.destaque} />
            <Text style={s.titulo}>Configurar mesa</Text>
            <TouchableOpacity onPress={fechar}>
              <Icone name="close" size={20} color={C.suave} />
            </TouchableOpacity>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={s.codigo}>Código para os jogadores: <Text style={{ color: C.destaque2 }}>{codigo}</Text></Text>

            <Text style={s.rotulo}>Nome da mesa</Text>
            <TextInput style={s.input} value={dados.nome} onChangeText={(t) => set('nome', t)} />

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
            {!!msg && <Text style={[s.msg, { marginTop: 6 }]}>{msg}</Text>}

            <View style={[s.linha, { marginTop: 12 }]}>
              <View style={{ flex: 1 }}>
                <Text style={s.rotulo}>Largura</Text>
                <TextInput style={s.input} value={dados.mapW} onChangeText={(t) => set('mapW', t)} keyboardType="numeric" />
              </View>
              <View style={{ width: 10 }} />
              <View style={{ flex: 1 }}>
                <Text style={s.rotulo}>Altura</Text>
                <TextInput style={s.input} value={dados.mapH} onChangeText={(t) => set('mapH', t)} keyboardType="numeric" />
              </View>
            </View>
            <Text style={s.msg}>A grade (tipo, tamanho, cor, infinita) fica na aba Grade da mesa.</Text>
          </ScrollView>

          <TouchableOpacity style={s.btn} onPress={salvar}>
            <Text style={s.btnTxt}>Salvar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
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
