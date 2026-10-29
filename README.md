# Mesa Vortex

Tabletop virtual (releitura do Owlbear Rodeo) para o sistema de RPG **Vortex**, feito em **React Native / Expo** com **Firestore via REST** (sem SDK do Firebase, compatível com o Expo Snack).

## Funcionalidades

- **Contas**: cadastro próprio (e-mail, usuário e senha com salt + SHA-256), visitante anônimo (Firebase Auth REST) e sessão salva no aparelho.
- **Admins**: contas `admin` e `dev` criadas na primeira execução, mais qualquer conta com e-mail listado em `EMAILS_ADMIN` (`src/services/auth.js`).
- **Campanhas (mesas)**: criar, entrar por código ou link (`?mesa=CODIGO`). Quem abre o link sem login entra como visitante.
- **Mesa** com abas de mecanismos:
  - **Mover**: selecionar, arrastar, navegar, zoom.
  - **Assets**: colocar personagens, objetos, estruturas e mapas dos packs ativos e de Meus assets.
  - **Desenho**: lápis, retângulo, círculo, borracha.
  - **Grade**: quadrada ou hexagonal, infinita, tamanho, cor, opacidade, espessura, deslocamento, encaixe.
  - **Construir**: capturar área como estrutura e salvar a mesa inteira como mapa.
  - Camadas manuais (outliner), ficha no token, barra de vida, rolagem 2d6 compartilhada.
- **Ficha reduzida do Vortex**: Corpo, Precisão, Essência, perícias, recursos e rolagem `2d6 + Atributo + Perícia`.
- **Packs de assets por nicho** (Fantasia, Masmorra, Natureza, Cidade, Sci-fi, Horror):
  - Oficiais (postados pelos admins) e packs próprios dos jogadores.
  - Cada usuário escolhe quais packs usar na mesa.
  - **Oficialização**: o jogador envia o pack; os admins recebem uma notificação e podem **aprovar**, **devolver com ressalvas** (comentário + cada asset marcado como aceito/não aceito) ou **recusar**.
- **Criador de mapas** (estilo dungeon maker): geradores com semente (masmorra com salas e corredores, caverna, labirinto), pincel de terreno (chão, terra, água, lava), salas por retângulo, borracha, portas e escadas, paredes automáticas, 5 temas (pedra, pergaminho, caverna, floresta, sci-fi) e desfazer. O mapa vai para Meus assets › Mapas e é aplicado na mesa pela aba Assets.
- **Imagens**: galeria, câmera ou URL. As imagens enviadas são comprimidas e guardadas na coleção `imagens` (sem precisar do Firebase Storage).

## Estrutura

```
App.js                 navegação entre telas
index.js               entrada do Expo
src/
  config/theme.js      cores e paleta
  data/
    constantes.js      tipos de asset, nichos, emojis
    sementes.js        packs e assets iniciais (gravados na 1ª execução)
  services/
    firestore.js       REST do Firestore (PROJETO_ID) e nomes das coleções
    auth.js            contas, sessão, visitante, admins, packs ativos
    assets.js          packs, oficialização, notificações, estruturas e mapas
    imagens.js         escolher, comprimir, salvar e exibir imagens
  utils/
    util.js            ids, caixas, colisão
    grade.js           grade quadrada/hexagonal e encaixe
    link.js            links de convite
    masmorra.js        geradores de mapa (masmorra, caverna, labirinto) e pintura de células
  components/          Logo, Ficha (FichaVortex), CampoImagem, CampoPasta, AssetMini, EditorObjeto, ModalNome, MapaTiles
  screens/             Acesso, Inicio, Perfil, Packs (Packs + Postagens), MeusAssets, CriadorMapas
  mesa/                Mesa, Palco (SVG + gestos), PainelCamadas, ConfigMesa
scripts/arquivo-unico.js   gera snack/App.js (tudo em um arquivo)
snack/App.js               versão de arquivo único, pronta para colar no Snack
```

## Firebase

- Projeto: `vortex-mobile-21f79` (em `src/services/firestore.js`).
- Crie o **Firestore** e, para desenvolvimento, use regras abertas (`allow read, write: if true;`).
- Ative o login **Anônimo** em Authentication para o modo visitante.
- Coleções: `usuarios` (com a subcoleção `assets`), `mesas` (com `camadas` e `itens`), `packs`, `assets`, `notificacoes`, `imagens`.

> Com as regras abertas, as permissões (admin, dono do pack) só existem dentro do app.

## Como rodar

**Expo Snack**
- Opção 1: importe este repositório no Snack (Import git repository).
- Opção 2: cole o conteúdo de `snack/App.js` no `App.js` de um Snack novo.

Dependências: `react-native-svg`, `@react-native-async-storage/async-storage`, `expo-linking`, `expo-image-picker`, `expo-image-manipulator`.

**Local**
```
npm install
npx expo install --fix
npx expo start
```

**Atualizar o arquivo único** depois de editar `src/`:
```
node scripts/arquivo-unico.js
```

## Contas iniciais

| Usuário | Senha inicial | Papel |
|---|---|---|
| `admin` | `admin123` | admin |
| `dev` | `vortex123` | admin |

Troque as senhas em **Meus dados** no primeiro login.
