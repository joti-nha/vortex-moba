import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView, Modal } from 'react-native';
import { MaterialCommunityIcons as Icone } from '@expo/vector-icons';
import Logo from '../components/Logo';
import { C } from '../config/theme';
import Mesa from '../mesa/Mesa';
import { carregarNotificacoes, marcarLida } from '../services/assets';
import { registrarRecente } from '../services/auth';
import { COL, apagar, consultar, lerDoc, listar, salvar } from '../services/firestore';
import { gerarCodigo, gerarId } from '../utils/util';

const CAMADAS_PADRAO = ['Cenário', 'Desenhos', 'Tokens'];

// Tela de ações: campanhas do usuário + atalhos (assets, packs, meus dados, postagens do admin)
export default function Inicio({ usuario, onAbrirMesa, onMeusAssets, onPacks, onPostagens, onPerfil, onEntrarConta }) {
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
      <View style={s.topo}>
        <Logo tamanho={34} id="logoTopo" />
        <Text style={s.marca}>Mesa Vortex</Text>
        <TouchableOpacity style={s.sino} onPress={() => setVerNotif(true)}>
          <Icone name={naoLidas.length ? 'bell-ring-outline' : 'bell-outline'} size={22} color={naoLidas.length ? '#eab308' : C.suave} />
          {naoLidas.length > 0 && (
            <View style={s.badge}>
              <Text style={s.badgeTxt}>{naoLidas.length > 9 ? '9+' : naoLidas.length}</Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity style={s.perfil} onPress={onPerfil}>
          <Text style={s.perfilNome} numberOfLines={1}>{usuario.nome}</Text>
          <View style={[s.avatar, { backgroundColor: usuario.cor || C.destaque }]}>
            <Text style={s.avatarTxt}>{usuario.nome.slice(0, 1).toUpperCase()}</Text>
          </View>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.conteudo} keyboardShouldPersistTaps="handled">
        <Text style={s.ola}>Olá, {usuario.nome.split(' ')[0]}!</Text>
        <Text style={s.olaSub}>Pronto para a próxima sessão?</Text>

        {usuario.provedor === 'anonimo' && (
          <View style={s.visitante}>
            <Icone name="incognito" size={20} color="#f59e0b" />
            <Text style={s.visitanteTxt}>
              Você está como visitante. Entrar é opcional, mas garante que suas campanhas e tokens não se percam.
            </Text>
            <TouchableOpacity style={s.visitanteBtn} onPress={onEntrarConta}>
              <Text style={{ color: '#000', fontWeight: '800', fontSize: 12 }}>Entrar</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={s.acoes}>
          {[
            { rot: 'Meus assets', sub: 'fichas, objetos, mapas', icone: 'treasure-chest', cor: C.destaque, acao: onMeusAssets },
            { rot: 'Packs', sub: 'usar e criar packs', icone: 'package-variant', cor: C.destaque2, acao: () => onPacks() },
            { rot: 'Meus dados', sub: 'perfil e conta', icone: 'account-details-outline', cor: '#f59e0b', acao: onPerfil },
            ...(admin
              ? [{ rot: 'Postagens', sub: pedidosPendentes ? `${pedidosPendentes} pedido(s)` : 'packs oficiais', icone: 'shield-crown-outline', cor: '#ef4444', acao: () => onPostagens(pedidosPendentes ? 'pendentes' : 'oficiais'), badge: pedidosPendentes }]
              : []),
          ].map((a) => (
            <TouchableOpacity key={a.rot} style={[s.acao, { borderColor: a.cor }]} onPress={a.acao}>
              {!!a.badge && (
                <View style={[s.badge, { top: 6, right: 6 }]}>
                  <Text style={s.badgeTxt}>{a.badge}</Text>
                </View>
              )}
              <Icone name={a.icone} size={28} color={a.cor} />
              <Text style={s.acaoTit}>{a.rot}</Text>
              <Text style={s.acaoSub}>{a.sub}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={s.cartao}>
          <Text style={s.secao}>Nova campanha</Text>
          <View style={s.linha}>
            <TextInput
              style={[s.input, { flex: 1 }]}
              value={nomeMesa}
              onChangeText={setNomeMesa}
              placeholder="Nome da campanha (opcional)"
              placeholderTextColor={C.suave}
            />
            <TouchableOpacity style={s.btnPrim} onPress={criar} disabled={ocupado}>
              <Icone name="plus" size={20} color="#fff" />
            </TouchableOpacity>
          </View>

          <Text style={[s.secao, { marginTop: 14 }]}>Entrar com código</Text>
          <View style={s.linha}>
            <TextInput
              style={[s.input, { flex: 1, letterSpacing: 4, textAlign: 'center' }]}
              value={codigo}
              onChangeText={(t) => setCodigo(t.toUpperCase())}
              placeholder="CÓDIGO"
              placeholderTextColor={C.suave}
              autoCapitalize="characters"
              maxLength={6}
              onSubmitEditing={entrarPorCodigo}
            />
            <TouchableOpacity style={s.btnSec} onPress={entrarPorCodigo} disabled={ocupado}>
              <Icone name="login" size={20} color={C.destaque2} />
            </TouchableOpacity>
          </View>
          {ocupado && <ActivityIndicator color={C.destaque} style={{ marginTop: 10 }} />}
          {!!erro && <Text style={s.erro}>{erro}</Text>}
        </View>

        <View style={s.cabLista}>
          <Text style={s.secao}>Suas campanhas ({mesas.length})</Text>
          <TouchableOpacity onPress={carregar}>
            <Icone name="refresh" size={18} color={C.suave} />
          </TouchableOpacity>
        </View>

        {carregando ? (
          <ActivityIndicator color={C.destaque} />
        ) : mesas.length === 0 ? (
          <Text style={s.vazio}>Você ainda não criou nem entrou em nenhuma campanha.</Text>
        ) : (
          mesas.map((m) => (
            <TouchableOpacity key={m.id} style={s.mesa} onPress={() => onAbrirMesa(m.id)}>
              <View style={[s.mesaIcone, m.papel === 'Mestre' && { backgroundColor: 'rgba(139,92,246,0.25)' }]}>
                <Icone name={m.papel === 'Mestre' ? 'crown-outline' : 'dice-d20-outline'} size={22} color={m.papel === 'Mestre' ? C.destaque : C.destaque2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.mesaNome} numberOfLines={1}>{m.nome}</Text>
                <Text style={s.mesaInfo}>
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
        {!!confirmar && <Text style={s.aviso}>Toque de novo na lixeira para excluir a campanha.</Text>}
      </ScrollView>

      <Modal visible={verNotif} transparent animationType="fade" onRequestClose={() => setVerNotif(false)}>
        <View style={s.fundoNotif}>
          <View style={s.caixaNotif}>
            <View style={[s.linha, { justifyContent: 'space-between', marginBottom: 6 }]}>
              <Text style={[s.ola, { fontSize: 18 }]}>Notificações</Text>
              <TouchableOpacity onPress={() => setVerNotif(false)}>
                <Icone name="close" size={22} color={C.suave} />
              </TouchableOpacity>
            </View>
            <ScrollView>
              {notificacoes.length === 0 && <Text style={s.vazio}>Nada por aqui ainda.</Text>}
              {notificacoes.slice(0, 40).map((n) => {
                const icone =
                  n.tipo === 'pedido' ? 'inbox-arrow-down' : n.decisao === 'aprovado' ? 'check-decagram' : n.decisao === 'recusado' ? 'close-octagon-outline' : 'message-alert-outline';
                const cor = n.tipo === 'pedido' ? '#eab308' : n.decisao === 'aprovado' ? C.ok : n.decisao === 'recusado' ? C.perigo : '#f97316';
                return (
                  <TouchableOpacity key={n.id} style={[s.notif, n.lida && { opacity: 0.5 }]} onPress={() => abrirNotificacao(n)}>
                    <Icone name={icone} size={22} color={cor} />
                    <View style={{ flex: 1 }}>
                      <Text style={s.notifTxt}>{n.texto}</Text>
                      {!!n.comentario && <Text style={s.notifCom}>"{n.comentario}" — {n.por}</Text>}
                      <Text style={s.notifData}>{n.em ? new Date(n.em).toLocaleString('pt-BR') : ''}</Text>
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

const s = StyleSheet.create({
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
