// Links de convite para mesas: ...?mesa=CODIGO
import { Platform, Linking } from 'react-native';
import * as ExpoLinking from 'expo-linking';

// Lê o código da mesa do link que abriu o app (web ou celular)
export async function mesaDoLink() {
  try {
    const url =
      Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.href : await Linking.getInitialURL();
    if (!url) return null;
    const m = url.match(/[?&]mesa=([A-Za-z0-9]{4,8})/);
    return m ? m[1].toUpperCase() : null;
  } catch (e) {
    return null;
  }
}

// Monta o link de convite de uma mesa
export function linkDaMesa(codigo) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `${window.location.origin}${window.location.pathname}?mesa=${codigo}`;
  }
  return ExpoLinking.createURL('/', { queryParams: { mesa: codigo } });
}
