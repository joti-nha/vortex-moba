import React, { useEffect, useState } from 'react';
import { SafeAreaView, StatusBar, StyleSheet, View, ActivityIndicator } from 'react-native';
import Logo from './src/components/Logo';
import { C } from './src/config/theme';
import Mesa from './src/mesa/Mesa';
import Acesso from './src/screens/Acesso';
import Inicio from './src/screens/Inicio';
import MeusAssets from './src/screens/MeusAssets';
import { PacksUsuario, Postagens } from './src/screens/Packs';
import Perfil from './src/screens/Perfil';
import { entrarAnonimo, garantirContaDev, registrarRecente, restaurarSessao, sair } from './src/services/auth';
import { mesaDoLink } from './src/utils/link';

export default function App() {
  const [usuario, setUsuario] = useState(null);
  const [iniciando, setIniciando] = useState(true);
  const [tela, setTela] = useState({ nome: 'inicio' }); // inicio | meus | packs | postagens | perfil | mesa | acesso
  const [mesaPendente, setMesaPendente] = useState(null); // mesa a abrir depois de um login

  function abrirMesa(codigo, u) {
    setTela({ nome: 'mesa', codigo });
    if (u) registrarRecente(u.usuario, codigo).catch(() => {});
  }

  useEffect(() => {
    (async () => {
      await garantirContaDev();
      let u = await restaurarSessao();
      const codigo = await mesaDoLink();
      if (codigo) {
        // Abriu pelo link: quem não está logado entra como visitante (anônimo) automaticamente
        if (!u) {
          try {
            u = await entrarAnonimo();
          } catch (e) {
            setMesaPendente(codigo); // anônimo indisponível: pede login e abre a mesa depois
          }
        }
        if (u) abrirMesa(codigo, u);
      }
      if (u) setUsuario(u);
      setIniciando(false);
    })();
  }, []);

  function logado(u) {
    setUsuario(u);
    if (mesaPendente) {
      abrirMesa(mesaPendente, u);
      setMesaPendente(null);
    } else {
      setTela({ nome: 'inicio' });
    }
  }

  async function deslogar() {
    await sair();
    setUsuario(null);
    setTela({ nome: 'inicio' });
  }

  let conteudo;
  if (iniciando) {
    conteudo = (
      <View style={s.splash}>
        <Logo tamanho={96} id="logoSplash" />
        <ActivityIndicator color={C.destaque} style={{ marginTop: 20 }} />
      </View>
    );
  } else if (!usuario) {
    conteudo = <Acesso onLogado={logado} mesaPendente={mesaPendente} />;
  } else if (tela.nome === 'acesso') {
    // visitante numa mesa decidiu entrar / criar conta
    conteudo = (
      <Acesso
        onLogado={logado}
        mesaPendente={mesaPendente}
        onContinuarVisitante={() => {
          setTela(mesaPendente ? { nome: 'mesa', codigo: mesaPendente } : { nome: 'inicio' });
          setMesaPendente(null);
        }}
      />
    );
  } else if (tela.nome === 'mesa') {
    conteudo = (
      <Mesa
        key={tela.codigo + usuario.usuario}
        codigo={tela.codigo}
        usuario={usuario}
        onSair={() => setTela({ nome: 'inicio' })}
        onEntrarConta={() => {
          setMesaPendente(tela.codigo);
          setTela({ nome: 'acesso' });
        }}
      />
    );
  } else if (tela.nome === 'meus') {
    conteudo = (
      <MeusAssets
        usuario={usuario}
        onVoltar={() => setTela({ nome: 'inicio' })}
        onAbrirPacks={() => setTela({ nome: 'packs', de: 'meus' })}
      />
    );
  } else if (tela.nome === 'packs') {
    conteudo = <PacksUsuario usuario={usuario} abaInicial={tela.aba} onVoltar={() => setTela({ nome: tela.de || 'inicio' })} />;
  } else if (tela.nome === 'postagens' && usuario.papel === 'admin') {
    conteudo = <Postagens usuario={usuario} abaInicial={tela.aba} onVoltar={() => setTela({ nome: 'inicio' })} />;
  } else if (tela.nome === 'perfil') {
    conteudo = (
      <Perfil usuario={usuario} onAtualizado={setUsuario} onVoltar={() => setTela({ nome: 'inicio' })} onSair={deslogar} />
    );
  } else {
    conteudo = (
      <Inicio
        usuario={usuario}
        onAbrirMesa={(codigo) => setTela({ nome: 'mesa', codigo })}
        onMeusAssets={() => setTela({ nome: 'meus' })}
        onPacks={(aba) => setTela({ nome: 'packs', aba })}
        onPostagens={(aba) => setTela({ nome: 'postagens', aba })}
        onPerfil={() => setTela({ nome: 'perfil' })}
        onEntrarConta={() => setTela({ nome: 'acesso' })}
      />
    );
  }

  return (
    <SafeAreaView style={s.raiz}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />
      {conteudo}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: C.bg },
  splash: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
