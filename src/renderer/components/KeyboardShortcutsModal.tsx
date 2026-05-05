import { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';

const DEFAULT_TAB_NAMES = [
  'Connection',
  'Chat',
  'Nodes',
  'Map',
  'Radio',
  'Modules',
  'Telemetry',
  'Security',
  'TAK',
  'App',
  'Diagnostics',
  'Stats',
  'Sniffer',
];

interface KeyboardShortcutsModalProps {
  onClose: () => void;
  /** Current tab labels (e.g. from App). When in MeshCore mode, tab 6 is "Repeaters" instead of "Modules". */
  tabNames?: string[];
}

export default function KeyboardShortcutsModal({ onClose, tabNames }: KeyboardShortcutsModalProps) {
  const { t } = useTranslation();
  const dialogRef = useRef<HTMLDivElement>(null);

  const shortcuts = useMemo(() => {
    const currentNames = tabNames ?? DEFAULT_TAB_NAMES;
    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', 'A', 'M', 'S'];
    const tabShortcuts = DEFAULT_TAB_NAMES.map((name, i) => {
      const currentTabIndex = currentNames.indexOf(name);
      const currentTabAtPosition = currentNames[i];
      const displayName = name === 'Sniffer' ? t('shortcuts.packetSniffer') : name;
      let suffix = '';
      if (currentTabAtPosition !== name) {
        if (i === 7 && currentTabIndex === -1) {
          suffix = t('shortcuts.notInMeshCore');
        } else if (i === 8 && currentTabIndex === -1) {
          suffix = t('shortcuts.notInMeshCore');
        } else if (i === 5 && currentTabAtPosition === 'Repeaters') {
          suffix = t('shortcuts.meshCoreRepeaters');
        }
      }
      return {
        keys: `Cmd/Ctrl + ${keys[i]}`,
        action: t('shortcuts.switchToTab', { name: displayName }) + suffix,
      };
    });
    const otherShortcuts = [
      { keys: 'Cmd/Ctrl + Shift + F', action: t('shortcuts.toggleSearch') },
      { keys: 'Escape', action: t('shortcuts.closeSearch') },
      { keys: 'Enter', action: t('shortcuts.sendMessage') },
      { keys: 'Shift + Enter', action: t('shortcuts.newLine') },
      { keys: '?', action: t('shortcuts.openHelp') },
      { keys: 'Cmd/Ctrl + [', action: t('shortcuts.switchMeshtastic') },
      { keys: 'Cmd/Ctrl + ]', action: t('shortcuts.switchMeshCore') },
    ];
    return [...tabShortcuts, ...otherShortcuts];
  }, [tabNames, t]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  useEffect(() => {
    const root = dialogRef.current;
    if (!root) return;
    const focusables = Array.from(
      root.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled])',
      ),
    ).filter((el) => el.offsetParent !== null || root.contains(el));
    if (focusables.length > 0) {
      focusables[0].focus();
    }
    const onTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    root.addEventListener('keydown', onTab);
    return () => {
      root.removeEventListener('keydown', onTab);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label={t('aria.closeDialog')}
        className="absolute inset-0 cursor-pointer border-0 bg-black/50 p-0 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-title"
        className="bg-deep-black relative z-10 w-full max-w-md rounded-xl border border-gray-700 shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-gray-700 px-5 py-4">
          <h2 id="shortcuts-title" className="text-lg font-semibold text-gray-100">
            {t('shortcuts.title')}
          </h2>
          <button
            onClick={onClose}
            aria-label={t('aria.closeDialog')}
            className="hover:bg-secondary-dark text-muted rounded-lg p-1.5 transition-colors hover:text-gray-200"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">
          <table className="w-full text-sm">
            <caption className="sr-only">{t('shortcuts.caption')}</caption>
            <thead>
              <tr className="text-muted border-b border-gray-700 text-left text-xs tracking-wider uppercase">
                <th scope="col" className="pb-2 font-medium">
                  {t('shortcuts.shortcutColumn')}
                </th>
                <th scope="col" className="pb-2 pl-4 font-medium">
                  {t('shortcuts.actionColumn')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700/50">
              {shortcuts.map(({ keys, action }) => (
                <tr key={keys}>
                  <td className="py-2 pr-4">
                    <kbd className="bg-secondary-dark rounded border border-gray-600 px-1.5 py-0.5 font-mono text-xs whitespace-nowrap text-gray-300">
                      {keys}
                    </kbd>
                  </td>
                  <td className="py-2 pl-4 text-gray-300">{action}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-muted mt-3 text-xs leading-relaxed">{t('shortcuts.footerNote')}</p>
        </div>
      </div>
    </div>
  );
}
