import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';

import cs from '../locales/cs/translation.json';
import de from '../locales/de/translation.json';
import en from '../locales/en/translation.json';
import es from '../locales/es/translation.json';
import fr from '../locales/fr/translation.json';
import id from '../locales/id/translation.json';
import it from '../locales/it/translation.json';
import ja from '../locales/ja/translation.json';
import ko from '../locales/ko/translation.json';
import nl from '../locales/nl/translation.json';
import pl from '../locales/pl/translation.json';
import ptBR from '../locales/pt-BR/translation.json';
import ru from '../locales/ru/translation.json';
import tr from '../locales/tr/translation.json';
import uk from '../locales/uk/translation.json';
import zh from '../locales/zh/translation.json';
import { getAppSettingsRaw } from './appSettingsStorage';
import { DEFAULT_APP_SETTINGS_SHARED } from './defaultAppSettings';
import { parseStoredJson } from './parseStoredJson';

const stored = parseStoredJson<{ locale?: string }>(getAppSettingsRaw(), 'i18n init');
const lng = stored?.locale ?? DEFAULT_APP_SETTINGS_SHARED.locale;

void i18next.use(initReactI18next).init({
  lng,
  fallbackLng: 'en',
  resources: {
    en: { translation: en },
    es: { translation: es },
    uk: { translation: uk },
    de: { translation: de },
    zh: { translation: zh },
    'pt-BR': { translation: ptBR },
    fr: { translation: fr },
    it: { translation: it },
    pl: { translation: pl },
    cs: { translation: cs },
    ja: { translation: ja },
    ru: { translation: ru },
    nl: { translation: nl },
    ko: { translation: ko },
    tr: { translation: tr },
    id: { translation: id },
  },
  interpolation: { escapeValue: false },
});

export default i18next;
