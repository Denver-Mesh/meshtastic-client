import { useVirtualizer } from '@tanstack/react-virtual';
import { useCallback, useMemo, useRef, useState } from 'react';

import type { RxPacketEntry } from '../hooks/useMeshCore';

const ROUTE_LABEL: Record<string, string> = {
  FLOOD: 'FLOOD',
  DIRECT: 'DIRECT',
  TRANSPORT_FLOOD: 'T_FLOOD',
  TRANSPORT_DIRECT: 'T_DIRECT',
};

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function formatTs(ts: number): string {
  return new Date(ts).toISOString().slice(11, 23);
}

export default function RawPacketLogPanel({
  packets,
  onClear,
}: {
  packets: RxPacketEntry[];
  onClear: () => void;
}) {
  const [filter, setFilter] = useState('');
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);

  const filtered = useMemo(() => {
    if (!filter.trim()) return packets;
    const q = filter.trim().toUpperCase();
    return packets.filter(
      (p) =>
        (p.routeTypeString ?? '').includes(q) ||
        (p.payloadTypeString ?? '').includes(q) ||
        toHex(p.raw).includes(filter.trim().toLowerCase()),
    );
  }, [packets, filter]);

  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 36,
    overscan: 12,
  });

  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
  }, []);

  const handleClear = useCallback(() => {
    setExpandedIdx(null);
    onClear();
  }, [onClear]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-gray-700 px-3 py-2">
        <input
          type="search"
          placeholder="Filter by type or hex..."
          value={filter}
          onChange={(e) => {
            setFilter(e.target.value);
          }}
          aria-label="Filter packets"
          className="min-w-0 flex-1 rounded border border-gray-600 bg-slate-800 px-2 py-1 font-mono text-xs text-gray-200 placeholder-gray-500 focus:border-blue-500 focus:outline-none"
        />
        <span className="text-muted shrink-0 text-[10px]">{filtered.length}</span>
        <button
          type="button"
          onClick={handleClear}
          disabled={packets.length === 0}
          aria-label="Clear packet log"
          className="shrink-0 rounded border border-gray-600 bg-slate-800 px-2 py-1 text-xs text-gray-300 hover:bg-slate-700 disabled:opacity-40"
        >
          Clear
        </button>
      </div>

      {packets.length === 0 ? (
        <div className="text-muted flex flex-1 items-center justify-center text-xs">
          No RF packets received yet. Connect to a MeshCore device to capture packets.
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-muted flex flex-1 items-center justify-center text-xs">
          No packets match the current filter.
        </div>
      ) : (
        <div
          ref={scrollRef}
          onScroll={onScroll}
          className="min-h-0 flex-1 overflow-auto font-mono text-[11px] text-gray-300"
          role="log"
          aria-live="polite"
          aria-relevant="additions"
        >
          <div className="relative w-full" style={{ height: `${virtualizer.getTotalSize()}px` }}>
            {virtualizer.getVirtualItems().map((vi) => {
              const p = filtered[vi.index];
              const isExpanded = expandedIdx === vi.index;
              const routeLabel =
                p.routeTypeString != null
                  ? (ROUTE_LABEL[p.routeTypeString] ?? p.routeTypeString)
                  : '?';
              const payloadLabel = p.payloadTypeString ?? '?';
              const hexRaw = toHex(p.raw);

              return (
                <div
                  key={`${vi.index}-${p.ts}`}
                  data-index={vi.index}
                  ref={virtualizer.measureElement}
                  className="absolute top-0 left-0 w-full border-b border-gray-800"
                  style={{ transform: `translateY(${vi.start}px)` }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setExpandedIdx(isExpanded ? null : vi.index);
                    }}
                    className="flex w-full items-start gap-2 px-3 py-1.5 text-left hover:bg-slate-800/60"
                    aria-expanded={isExpanded}
                  >
                    <span className="text-muted w-[90px] shrink-0 text-[10px]">
                      {formatTs(p.ts)}
                    </span>
                    <span
                      className={`w-[72px] shrink-0 rounded px-1 text-[10px] font-semibold ${
                        p.routeTypeString === 'FLOOD' || p.routeTypeString === 'TRANSPORT_FLOOD'
                          ? 'bg-blue-900/50 text-blue-300'
                          : p.routeTypeString === 'DIRECT' ||
                              p.routeTypeString === 'TRANSPORT_DIRECT'
                            ? 'bg-green-900/50 text-green-300'
                            : 'bg-gray-700 text-gray-400'
                      }`}
                    >
                      {routeLabel}
                    </span>
                    <span className="w-[80px] shrink-0 text-yellow-300/80">{payloadLabel}</span>
                    <span className="text-muted flex-1">
                      {p.hopCount > 0 ? `hops=${p.hopCount} ` : ''}
                      SNR={p.snr.toFixed(1)} RSSI={p.rssi}
                    </span>
                    <span className="text-muted shrink-0 text-[10px]">{p.raw.length}B</span>
                  </button>
                  {isExpanded && (
                    <div className="bg-slate-900/60 px-3 pb-2">
                      <p className="text-muted mb-1 text-[10px]">Raw hex ({p.raw.length} bytes):</p>
                      <p className="text-[10px] break-all text-gray-400">{hexRaw}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
