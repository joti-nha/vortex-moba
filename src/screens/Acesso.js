import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { MaterialCommunityIcons as Icone } from '@expo/vector-icons';
import Logo from '../components/Logo';
import { C } from '../config/theme';
import Mesa from '../mesa/Mesa';
import { cadastrar, entrar, entrarAnonimo, validarCadastro } from '../services/auth';
import { salvar } from '../services/firestore';

// Tela de login / cadastro
export default function Acesso({ onLogado, mesaPendente, onContinuarVisitante }) {
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
    <View style={s.campo}>
      <Icone name={icone} size={18} color={C.suave} />
      <TextInput
        style={s.input}
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
      <ScrollView contentContainerStyle={s.tela} keyboardShouldPersistTaps="handled">
        <View style={s.cartao}>
          <View style={{ alignItems: 'center' }}>
            <Logo tamanho={72} id="logoAcesso" />
          </View>
          <Text style={s.titulo}>Mesa Vortex</Text>
          <Text style={s.sub}>sua mesa de RPG virtual, no bolso</Text>

          {!!mesaPendente && (
            <View style={s.avisoMesa}>
              <Icone name="dice-d20-outline" size={18} color={C.destaque2} />
              <Text style={s.avisoMesaTxt}>
                Entre para salvar a mesa <Text style={{ fontWeight: '800' }}>{mesaPendente}</Text> na sua conta. É opcional: você pode continuar como visitante.
              </Text>
            </View>
          )}

          <View style={s.abas}>
            {[
              ['entrar', 'Entrar'],
              ['cadastro', 'Criar conta'],
            ].map(([m, rot]) => (
              <TouchableOpacity key={m} style={[s.aba, modo === m && s.abaAtiva]} onPress={() => trocar(m)}>
                <Text style={[s.abaTxt, modo === m && { color: '#fff' }]}>{rot}</Text>
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

          <View style={s.campo}>
            <Icone name="lock-outline" size={18} color={C.suave} />
            <TextInput
              style={s.input}
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
              <Text style={s.regra}>Senha: mínimo 6 caracteres, com letras e números.</Text>
            </>
          )}

          {!!erro && (
            <View style={s.erroCaixa}>
              <Icone name="alert-circle-outline" size={16} color={C.perigo} />
              <Text style={s.erro}>{erro}</Text>
            </View>
          )}

          <TouchableOpacity style={s.botao} onPress={enviar} disabled={carregando}>
            {carregando ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={s.botaoTxt}>{modo === 'entrar' ? 'Entrar' : 'Criar minha conta'}</Text>
            )}
          </TouchableOpacity>

          <View style={s.divisor}>
            <View style={s.linha} />
            <Text style={s.ou}>ou</Text>
            <View style={s.linha} />
          </View>

          {!onContinuarVisitante && (
            <TouchableOpacity style={s.btnVisitante} onPress={visitante} disabled={carregando}>
              <Icone name="incognito" size={20} color={C.texto} />
              <Text style={[s.btnAltTxt, { color: C.texto }]}>Entrar como visitante</Text>
            </TouchableOpacity>
          )}

          {!!onContinuarVisitante && (
            <TouchableOpacity onPress={onContinuarVisitante} style={{ marginTop: 14 }}>
              <Text style={[s.link, { marginTop: 0, color: C.suave }]}>← Voltar à mesa como visitante</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity onPress={() => trocar(modo === 'entrar' ? 'cadastro' : 'entrar')}>
            <Text style={s.link}>
              {modo === 'entrar' ? 'Ainda não tem conta? Cadastre-se' : 'Já tem conta? Entrar'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
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
