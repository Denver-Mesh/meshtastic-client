import { useTranslation } from 'react-i18next';

interface NotificationToggleProps {
  notifMuted: boolean;
  onToggle: (muted: boolean) => void;
}

export default function NotificationToggle({ notifMuted, onToggle }: NotificationToggleProps) {
  const { t } = useTranslation();
  const label = notifMuted ? t('chatPanel.unmuteNotifications') : t('chatPanel.muteNotifications');
  return (
    <button
      type="button"
      aria-pressed={notifMuted}
      aria-label={label}
      title={label}
      onClick={() => {
        onToggle(!notifMuted);
      }}
      className={`rounded-lg p-1.5 transition-colors ${
        notifMuted
          ? 'text-gray-600 hover:text-gray-300'
          : 'text-muted hover:bg-secondary-dark hover:text-gray-200'
      }`}
    >
      <svg
        className="h-4 w-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
        aria-hidden="true"
      >
        {notifMuted ? (
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15zM17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"
          />
        ) : (
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15.536 8.464a5 5 0 010 7.072M12 6v12m-3.536-9.536a5 5 0 000 7.072M4 12H2"
          />
        )}
      </svg>
    </button>
  );
}
