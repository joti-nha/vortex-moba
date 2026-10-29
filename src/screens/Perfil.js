import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { MaterialCommunityIcons as Icone } from '@expo/vector-icons';
import { C, CORES } from '../config/theme';
import { assetsDe } from '../services/assets';
import { atualizarPerfil, lerPacksAtivos, sair, trocarSenha } from '../services/auth';
import { COL, consultar, lerDoc, listar } from '../services/firestore';

export default function Perfil({ usuario, onAtualizado, onVoltar, onSair }) {
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
      <View style={s.topo}>
        <TouchableOpacity onPress={onVoltar} style={{ padding: 6 }}>
          <Icone name="arrow-left" size={22} color={C.texto} />
        </TouchableOpacity>
        <Text style={s.titulo}>Meus dados</Text>
      </View>

      <ScrollView contentContainerStyle={s.conteudo}>
        <View style={s.cabeca}>
          <View style={[s.avatar, { backgroundColor: cor }]}>
            <Text style={s.avatarTxt}>{(nome || '?').slice(0, 1).toUpperCase()}</Text>
          </View>
          <Text style={s.nome}>{nome}</Text>
          <Text style={s.info}>
            {usuario.provedor === 'anonimo'
              ? 'Conta de visitante (anônima)'
              : `@${usuario.usuario} · ${usuario.email}`}
          </Text>
          <Text style={s.info}>membro desde {desde}</Text>
          <View style={[s.papel, usuario.papel === 'admin' && { backgroundColor: C.destaque }]}>
            <Icone name={usuario.papel === 'admin' ? 'shield-crown-outline' : 'dice-d20-outline'} size={13} color="#fff" />
            <Text style={s.papelTxt}>{usuario.papel === 'admin' ? 'Desenvolvedor' : 'Jogador'}</Text>
          </View>
        </View>

        <View style={s.stats}>
          {[
            ['crown-outline', 'Mestre em', stats ? stats.mestre : '…', 'campanhas'],
            ['dice-d20-outline', 'Jogador em', stats ? stats.jogador : '…', 'campanhas'],
            ['treasure-chest', 'Meus assets', stats ? stats.tokens : '…', `${stats ? stats.criados : '…'} criados`],
            ['package-variant', 'Packs em uso', stats ? stats.packs : '…', 'na mesa'],
          ].map(([ic, rot, val, uni]) => (
            <View key={rot} style={s.stat}>
              <Icone name={ic} size={18} color={C.destaque2} />
              <Text style={s.statVal}>{val}</Text>
              <Text style={s.statRot}>{rot}</Text>
              <Text style={s.statUni}>{uni}</Text>
            </View>
          ))}
        </View>

        <View style={s.cartao}>
          <Text style={s.secao}>Dados</Text>
          <Text style={s.rotulo}>Nome de exibição</Text>
          <TextInput style={s.input} value={nome} onChangeText={setNome} />
          <Text style={s.rotulo}>Cor do avatar</Text>
          <View style={s.cores}>
            {CORES.slice(0, 9).map((c) => (
              <TouchableOpacity key={c} onPress={() => setCor(c)} style={[s.cor, { backgroundColor: c }, cor === c && s.corSel]} />
            ))}
          </View>
          <TouchableOpacity style={s.botao} onPress={salvarPerfil} disabled={ocupado}>
            <Text style={s.botaoTxt}>Salvar dados</Text>
          </TouchableOpacity>
        </View>

        {usuario.provedor === 'anonimo' && (
          <View style={[s.cartao, { borderColor: '#f59e0b' }]}>
            <Text style={[s.secao, { color: '#f59e0b' }]}>Você está como visitante</Text>
            <Text style={s.info}>
              Seus assets e campanhas ficam salvos enquanto você não sair. Se sair da conta, não será possível voltar a ela.
            </Text>
          </View>
        )}

        {usuario.provedor === 'senha' && (
        <View style={s.cartao}>
          <Text style={s.secao}>Trocar senha</Text>
          {[
            ['atual', 'Senha atual'],
            ['nova', 'Nova senha'],
            ['confirmar', 'Confirmar nova senha'],
          ].map(([k, p]) => (
            <TextInput
              key={k}
              style={s.input}
              value={senhas[k]}
              onChangeText={(t) => setSenhas({ ...senhas, [k]: t })}
              placeholder={p}
              placeholderTextColor={C.suave}
              secureTextEntry
              autoCapitalize="none"
            />
          ))}
          <TouchableOpacity style={[s.botao, s.botaoSec]} onPress={mudarSenha} disabled={ocupado}>
            <Text style={[s.botaoTxt, { color: C.destaque2 }]}>Alterar senha</Text>
          </TouchableOpacity>
        </View>
        )}

        {ocupado && <ActivityIndicator color={C.destaque} />}
        {!!msg.txt && <Text style={[s.msg, { color: msg.ok ? C.ok : C.perigo }]}>{msg.txt}</Text>}

        <TouchableOpacity
          style={s.sair}
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

const s = StyleSheet.create({
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
