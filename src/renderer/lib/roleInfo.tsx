interface RoleInfo {
  label: string;
  colorClass: string;
  isBadge: boolean;
  badgeClass?: string;
}

const ROLE_INFO: Record<number, RoleInfo> = {
  0:  { label: "Client",           colorClass: "text-gray-400",   isBadge: false },
  1:  { label: "Client Mute",      colorClass: "text-gray-400",   isBadge: false },
  2:  { label: "Router",           colorClass: "text-blue-400",   isBadge: true,  badgeClass: "bg-blue-900/60 text-blue-300 border border-blue-700/40" },
  3:  { label: "Router Client",    colorClass: "text-blue-300",   isBadge: false },
  4:  { label: "Repeater",         colorClass: "text-orange-400", isBadge: true,  badgeClass: "bg-orange-900/60 text-orange-300 border border-orange-700/40" },
  5:  { label: "Tracker",          colorClass: "text-green-400",  isBadge: false },
  6:  { label: "Sensor",           colorClass: "text-teal-400",   isBadge: false },
  7:  { label: "TAK Tracker",      colorClass: "text-red-400",    isBadge: true,  badgeClass: "bg-red-900/60 text-red-300 border border-red-700/40" },
  8:  { label: "Power Stress",     colorClass: "text-yellow-400", isBadge: false },
  9:  { label: "Non-Routing",      colorClass: "text-gray-400",   isBadge: false },
  10: { label: "Repeater Stealth", colorClass: "text-purple-400", isBadge: false },
  11: { label: "Lost and Found",   colorClass: "text-pink-400",   isBadge: true,  badgeClass: "bg-pink-900/60 text-pink-300 border border-pink-700/40" },
  12: { label: "TAK Relay",        colorClass: "text-red-300",    isBadge: true,  badgeClass: "bg-red-950/70 text-red-200 border border-red-800/50" },
};

export function getRoleInfo(role: number | undefined): RoleInfo {
  if (role !== undefined && role in ROLE_INFO) return ROLE_INFO[role];
  return {
    label: role !== undefined ? `Unknown (${role})` : "-",
    colorClass: "text-gray-500",
    isBadge: false,
  };
}

export function RoleIcon({ role }: { role: number | undefined }) {
  const p = {
    className: "w-3.5 h-3.5",
    fill: "none",
    viewBox: "0 0 24 24",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (role) {
    case 0: // Client — person silhouette
      return (
        <svg {...p}>
          <circle cx="12" cy="8" r="4" />
          <path d="M4 20c0-4 3.58-7 8-7s8 3 8 7" />
        </svg>
      );
    case 1: // Client Mute — person + diagonal slash
      return (
        <svg {...p}>
          <circle cx="12" cy="8" r="4" />
          <path d="M4 20c0-4 3.58-7 8-7s8 3 8 7" />
          <line x1="2" y1="2" x2="22" y2="22" />
        </svg>
      );
    case 2: // Router — radio tower
      return (
        <svg {...p}>
          <path d="M5 12.55a11 11 0 0 1 14.08 0" />
          <path d="M1.42 9a16 16 0 0 1 21.16 0" />
          <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
          <line x1="12" y1="20" x2="12" y2="12" />
        </svg>
      );
    case 3: // Router Client — server stack
      return (
        <svg {...p}>
          <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
          <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
          <line x1="6" y1="6" x2="6.01" y2="6" />
          <line x1="6" y1="18" x2="6.01" y2="18" />
        </svg>
      );
    case 4: // Repeater — circular arrows
      return (
        <svg {...p}>
          <polyline points="17 1 21 5 17 9" />
          <path d="M3 11V9a4 4 0 0 1 4-4h14" />
          <polyline points="7 23 3 19 7 15" />
          <path d="M21 13v2a4 4 0 0 1-4 4H3" />
        </svg>
      );
    case 5: // Tracker — map pin
      return (
        <svg {...p}>
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
      );
    case 6: // Sensor — pulse/activity wave
      return (
        <svg {...p}>
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
        </svg>
      );
    case 7: // TAK Tracker — crosshair
      return (
        <svg {...p}>
          <circle cx="12" cy="12" r="10" />
          <line x1="22" y1="12" x2="18" y2="12" />
          <line x1="6" y1="12" x2="2" y2="12" />
          <line x1="12" y1="6" x2="12" y2="2" />
          <line x1="12" y1="22" x2="12" y2="18" />
        </svg>
      );
    case 8: // Power Stress — warning triangle
      return (
        <svg {...p}>
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      );
    case 9: // Non-Routing — user with X
      return (
        <svg {...p}>
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <line x1="17" y1="11" x2="23" y2="17" />
          <line x1="23" y1="11" x2="17" y2="17" />
        </svg>
      );
    case 10: // Repeater Stealth — eye with slash
      return (
        <svg {...p}>
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
          <line x1="1" y1="1" x2="23" y2="23" />
        </svg>
      );
    case 11: // Lost and Found — life ring
      return (
        <svg {...p}>
          <circle cx="12" cy="12" r="10" />
          <circle cx="12" cy="12" r="4" />
          <line x1="4.93" y1="4.93" x2="9.17" y2="9.17" />
          <line x1="14.83" y1="14.83" x2="19.07" y2="19.07" />
          <line x1="14.83" y1="9.17" x2="19.07" y2="4.93" />
          <line x1="4.93" y1="19.07" x2="9.17" y2="14.83" />
        </svg>
      );
    case 12: // TAK Relay — shield
      return (
        <svg {...p}>
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      );
    default: // Unknown — question mark in circle
      return (
        <svg {...p}>
          <circle cx="12" cy="12" r="10" />
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      );
  }
}

export function RoleDisplay({ role }: { role: number | undefined }) {
  if (role === undefined) {
    return <span className="text-gray-600 text-xs">-</span>;
  }
  const info = getRoleInfo(role);
  if (info.isBadge && info.badgeClass) {
    return (
      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium ${info.badgeClass}`}>
        <RoleIcon role={role} />
        {info.label}
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center gap-1 text-xs ${info.colorClass}`}>
      <RoleIcon role={role} />
      {info.label}
    </span>
  );
}
