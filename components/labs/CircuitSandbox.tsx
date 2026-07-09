import { useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { solveDC, type Comp } from '@/lib/circuit/solver';

// ── Free-form circuit sandbox ───────────────────────────────────────────────
// Drop parts on a grid, wire their terminals (or abut two terminals on the same
// grid point like breadboard holes), and the netlist is extracted (union-find
// over connected terminals) and solved live by lib/circuit/solver.
const CELL = 24;
const TERM = 96;         // terminal separation (2·CELL each side → stays on grid)
const VB_W = 720, VB_H = 448;
const snap = (v: number) => Math.round(v / CELL) * CELL;

type Kind = 'source' | 'resistor' | 'led' | 'switch';
interface Placed { id: string; kind: Kind; x: number; y: number; value: number; flipped?: boolean; closed?: boolean; }
interface Wire { id: string; from: string; to: string; } // from/to = terminal keys "id:a"|"id:b"
type TermSide = 'a' | 'b';

const KIND_META: Record<Kind, { label: string; emoji: string; def: number; unit: string }> = {
  source: { label: 'Battery', emoji: '🔋', def: 9, unit: 'V' },
  resistor: { label: 'Resistor', emoji: '〰️', def: 470, unit: 'Ω' },
  led: { label: 'LED', emoji: '💡', def: 0, unit: '' },
  switch: { label: 'Switch', emoji: '🔀', def: 0, unit: '' },
};

const termKey = (id: string, t: TermSide) => `${id}:${t}`;
function termPos(p: Placed) {
  return { a: { x: p.x - TERM / 2, y: p.y }, b: { x: p.x + TERM / 2, y: p.y } };
}

// Union-find
function makeDSU() {
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    if (!parent.has(x)) { parent.set(x, x); return x; }
    let r = x;
    while (parent.get(r) !== r) r = parent.get(r)!;
    while (parent.get(x) !== r) { const nx = parent.get(x)!; parent.set(x, r); x = nx; }
    return r;
  };
  const union = (a: string, b: string) => { parent.set(find(a), find(b)); };
  return { find, union, parent };
}

interface SolveOut {
  ok: boolean;
  reason?: string;
  nodeOf: Map<string, number>;      // terminal key → node id
  voltage: number[];                // node id → volts
  currents: Record<string, number>; // component id → amps (a→b)
}

function buildAndSolve(placed: Placed[], wires: Wire[]): SolveOut {
  const empty: SolveOut = { ok: false, nodeOf: new Map(), voltage: [], currents: {} };
  const sources = placed.filter((p) => p.kind === 'source');
  if (sources.length === 0) return { ...empty, reason: 'Add a battery to power the circuit.' };

  const dsu = makeDSU();
  // register terminals + union terminals sharing a grid coordinate (breadboard holes)
  const coordMap = new Map<string, string[]>();
  for (const p of placed) {
    const t = termPos(p);
    for (const side of ['a', 'b'] as TermSide[]) {
      const k = termKey(p.id, side);
      dsu.find(k);
      const pos = side === 'a' ? t.a : t.b;
      const ck = `${pos.x},${pos.y}`;
      (coordMap.get(ck) ?? coordMap.set(ck, []).get(ck)!).push(k);
    }
  }
  for (const group of Array.from(coordMap.values())) for (let i = 1; i < group.length; i++) dsu.union(group[0], group[i]);
  for (const w of wires) dsu.union(w.from, w.to);

  // node numbering — ground = the first battery's − terminal (side b)
  const groundRoot = dsu.find(termKey(sources[0].id, 'b'));
  const rootToNode = new Map<string, number>();
  rootToNode.set(groundRoot, 0);
  let next = 1;
  const nodeOf = new Map<string, number>();
  for (const p of placed) for (const side of ['a', 'b'] as TermSide[]) {
    const k = termKey(p.id, side);
    const root = dsu.find(k);
    if (!rootToNode.has(root)) rootToNode.set(root, next++);
    nodeOf.set(k, rootToNode.get(root)!);
  }

  const comps: Comp[] = [];
  for (const p of placed) {
    const na = nodeOf.get(termKey(p.id, 'a'))!;
    const nb = nodeOf.get(termKey(p.id, 'b'))!;
    if (na === nb) continue; // shorted component contributes nothing meaningful
    if (p.kind === 'source') comps.push({ id: p.id, type: 'V', a: na, b: nb, value: p.value });
    else if (p.kind === 'resistor') comps.push({ id: p.id, type: 'R', a: na, b: nb, value: Math.max(p.value, 1) });
    else if (p.kind === 'switch') comps.push({ id: p.id, type: 'SW', a: na, b: nb, closed: !!p.closed });
    else if (p.kind === 'led') {
      const anode = p.flipped ? nb : na;
      const cathode = p.flipped ? na : nb;
      comps.push({ id: p.id, type: 'D', a: anode, b: cathode, is: 1e-18, n: 2 });
    }
  }
  if (comps.every((c) => c.type !== 'V')) return { ...empty, reason: 'Connect the battery into the circuit.' };

  const res = solveDC(comps);
  return { ok: res.converged, reason: res.converged ? undefined : 'Circuit could not be solved — check the wiring.', nodeOf, voltage: res.nodeVoltages, currents: res.currents };
}

export default function CircuitSandbox() {
  const [placed, setPlaced] = useState<Placed[]>([]);
  const [wires, setWires] = useState<Wire[]>([]);
  const [sel, setSel] = useState<{ kind: 'comp' | 'wire'; id: string } | null>(null);
  const [pending, setPending] = useState<string | null>(null); // terminal key mid-wire
  const [ptr, setPtr] = useState<{ x: number; y: number } | null>(null);
  const drag = useRef<{ id: string; ox: number; oy: number; sx: number; sy: number; moved: boolean } | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const counter = useRef(0);

  const sol = useMemo(() => buildAndSolve(placed, wires), [placed, wires]);

  const toVB = (e: { clientX: number; clientY: number }) => {
    const rect = svgRef.current!.getBoundingClientRect();
    return { x: (e.clientX - rect.left) * (VB_W / rect.width), y: (e.clientY - rect.top) * (VB_H / rect.height) };
  };

  const addPart = (kind: Kind) => {
    const n = counter.current++;
    setPlaced((prev) => [...prev, {
      id: `c${n}`, kind,
      x: snap(160 + (n % 4) * TERM * 0.9), y: snap(96 + (n % 3) * 72),
      value: KIND_META[kind].def, flipped: false, closed: kind === 'switch' ? true : undefined,
    }]);
  };

  const updateSel = (patch: Partial<Placed>) => {
    if (sel?.kind !== 'comp') return;
    setPlaced((prev) => prev.map((p) => (p.id === sel.id ? { ...p, ...patch } : p)));
  };
  const deleteSel = () => {
    if (!sel) return;
    if (sel.kind === 'comp') {
      setPlaced((prev) => prev.filter((p) => p.id !== sel.id));
      setWires((prev) => prev.filter((w) => !w.from.startsWith(sel.id + ':') && !w.to.startsWith(sel.id + ':')));
    } else {
      setWires((prev) => prev.filter((w) => w.id !== sel.id));
    }
    setSel(null);
  };
  const clearAll = () => { setPlaced([]); setWires([]); setSel(null); setPending(null); };

  // ── terminal click → wire ──
  const onTermDown = (e: React.PointerEvent, key: string) => {
    e.stopPropagation();
    if (pending === null) { setPending(key); setPtr(toVB(e)); return; }
    if (pending === key) { setPending(null); return; }
    // avoid duplicate wire
    setWires((prev) => {
      if (prev.some((w) => (w.from === pending && w.to === key) || (w.from === key && w.to === pending))) return prev;
      return [...prev, { id: `w${counter.current++}`, from: pending, to: key }];
    });
    setPending(null);
  };

  // ── component body drag ──
  const onBodyDown = (e: React.PointerEvent, p: Placed) => {
    e.stopPropagation();
    const m = toVB(e);
    drag.current = { id: p.id, ox: m.x - p.x, oy: m.y - p.y, sx: e.clientX, sy: e.clientY, moved: false };
    // Capture on the SVG so a fast drag that leaves the canvas keeps tracking
    // and the pointerup still fires (otherwise drag.current would get stuck).
    svgRef.current?.setPointerCapture(e.pointerId);
  };
  const onSvgMove = (e: React.PointerEvent) => {
    const m = toVB(e);
    if (pending) { setPtr(m); return; }
    const d = drag.current;
    if (!d) return;
    // Ignore sub-threshold jitter so a tap reliably selects instead of nudging.
    if (!d.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 5) return;
    d.moved = true;
    setPlaced((prev) => prev.map((p) => (p.id === d.id ? { ...p, x: snap(m.x - d.ox), y: snap(m.y - d.oy) } : p)));
  };
  const onSvgUp = () => {
    const d = drag.current;
    if (d && !d.moved) setSel({ kind: 'comp', id: d.id });
    drag.current = null;
  };
  const onSvgClick = () => { if (pending) setPending(null); else setSel(null); };

  const selPart = sel?.kind === 'comp' ? placed.find((p) => p.id === sel.id) : null;
  const mA = (a: number) => (Math.abs(a) >= 999 ? '∞' : (a * 1000).toFixed(1));

  // Global circuit state → drives the flowing-wire animation + the meter.
  const totalI = sol.ok ? placed.reduce((m, p) => Math.max(m, Math.abs(sol.currents[p.id] ?? 0)), 0) : 0;
  const overI = totalI > 0.03;
  const flowing = sol.ok && totalI > 0.0003;
  const flowCol = overI ? '#ef4444' : 'var(--color-green)';
  const flowDur = Math.max(0.35, 0.95 - Math.min(0.6, totalI * 12));
  const litLed = placed.some((p) => p.kind === 'led' && Math.abs(sol.currents[p.id] ?? 0) > 0.0008);

  let statusKind: 'idle' | 'good' | 'warn' | 'bad' = 'idle';
  let statusMsg = sol.reason ?? 'Drop in a battery, a resistor and an LED — then wire them into a loop.';
  if (sol.ok) {
    if (overI) { statusKind = 'bad'; statusMsg = 'Very high current — add (or increase) a resistor before something burns out.'; }
    else if (flowing) { statusKind = 'good'; statusMsg = litLed ? 'Lit up! Current is flowing through your circuit.' : 'Current is flowing through your circuit.'; }
    else { statusKind = 'warn'; statusMsg = 'Loop is complete, but no current — check the battery voltage, the resistor, or the LED polarity.'; }
  }

  return (
    <div className="w-full" style={{ ['--cl-led' as string]: '#ff5a4d', ['--cl-copper' as string]: '#c8804a', ['--cl-live' as string]: '#f59e0b' }}>
      <style>{`
        @keyframes cs-flow { to { stroke-dashoffset: -16; } }
        .cs-flow { stroke-dasharray: 7 9; animation: cs-flow var(--cs-dur, .8s) linear infinite; }
        @media (prefers-reduced-motion: reduce) { .cs-flow { animation: none; } }
      `}</style>

      <div className="grid lg:grid-cols-[1fr_252px] gap-4 items-start">
        {/* The bench */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-3 sm:p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[11px] uppercase tracking-wider text-[var(--text-muted)] font-bold">The bench</h3>
            <button onClick={clearAll} className="text-[12px] font-semibold text-[var(--text-muted)] hover:text-red-500 transition-colors">Clear</button>
          </div>

          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] overflow-hidden">
            <svg
              ref={svgRef} viewBox={`0 0 ${VB_W} ${VB_H}`} className="w-full touch-none block"
              style={{ aspectRatio: `${VB_W} / ${VB_H}` }}
              onPointerMove={onSvgMove} onPointerUp={onSvgUp} onClick={onSvgClick}
            >
              <defs>
                <pattern id="cs-grid" width={CELL} height={CELL} patternUnits="userSpaceOnUse">
                  <circle cx={CELL / 2} cy={CELL / 2} r={1} fill="var(--border-strong)" opacity={0.45} />
                </pattern>
              </defs>
              <rect width={VB_W} height={VB_H} fill="url(#cs-grid)" />

              {/* wires — copper base + animated current overlay when energized */}
              {wires.map((w) => {
                const [fid, fs] = w.from.split(':'); const [tid, ts] = w.to.split(':');
                const fp = placed.find((p) => p.id === fid); const tp = placed.find((p) => p.id === tid);
                if (!fp || !tp) return null;
                const a = termPos(fp)[fs as TermSide]; const b = termPos(tp)[ts as TermSide];
                const wsel = sel?.kind === 'wire' && sel.id === w.id;
                return (
                  <g key={w.id} className="cursor-pointer" onClick={(e) => { e.stopPropagation(); setSel({ kind: 'wire', id: w.id }); }}>
                    <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="transparent" strokeWidth={16} />
                    <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={wsel ? 'var(--color-brand)' : 'var(--cl-copper)'} strokeWidth={wsel ? 5 : 3.5} strokeLinecap="round" />
                    {flowing && !wsel && (
                      <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={flowCol} strokeWidth={3.5} strokeLinecap="round" className="cs-flow" style={{ ['--cs-dur' as string]: `${flowDur}s` }} />
                    )}
                  </g>
                );
              })}

              {/* in-progress wire */}
              {pending && ptr && (() => {
                const [pid, ps] = pending.split(':'); const pp = placed.find((p) => p.id === pid);
                if (!pp) return null; const a = termPos(pp)[ps as TermSide];
                return <line x1={a.x} y1={a.y} x2={ptr.x} y2={ptr.y} stroke="var(--color-brand)" strokeWidth={2.5} strokeDasharray="5 4" strokeLinecap="round" />;
              })()}

              {/* components */}
              {placed.map((p) => {
                const t = termPos(p);
                const selected = sel?.kind === 'comp' && sel.id === p.id;
                const cur = sol.currents[p.id] ?? 0;
                const carries = flowing && Math.abs(cur) > 0.0003;
                const lit = p.kind === 'led' && sol.ok && Math.abs(cur) > 0.0008;
                return (
                  <g key={p.id}>
                    {/* connecting body line (copper + flow overlay) */}
                    <line x1={t.a.x} y1={t.a.y} x2={t.b.x} y2={t.b.y} stroke="var(--cl-copper)" strokeWidth={3} strokeLinecap="round" />
                    {carries && <line x1={t.a.x} y1={t.a.y} x2={t.b.x} y2={t.b.y} stroke={flowCol} strokeWidth={3} strokeLinecap="round" className="cs-flow" style={{ ['--cs-dur' as string]: `${flowDur}s` }} />}
                    {/* symbol + hit area (drag/select) */}
                    <g onPointerDown={(e) => onBodyDown(e, p)} className="cursor-move">
                      <rect x={p.x - 30} y={p.y - 20} width={60} height={40} fill="transparent" />
                      <PartSymbol p={p} lit={lit} current={Math.abs(cur)} selected={selected} />
                    </g>
                    {/* current label */}
                    {sol.ok && p.kind !== 'source' && Math.abs(cur) > 1e-6 && (
                      <text x={p.x} y={p.y - 27} textAnchor="middle" fontSize={11} fontFamily="monospace" fill="var(--text-muted)">{mA(cur)} mA</text>
                    )}
                    {/* terminals */}
                    {(['a', 'b'] as TermSide[]).map((side) => {
                      const pos = t[side];
                      const isGround = sol.ok && sol.nodeOf.get(termKey(p.id, side)) === 0;
                      return (
                        <circle key={side} cx={pos.x} cy={pos.y} r={6.5}
                          fill={pending === termKey(p.id, side) ? 'var(--color-brand)' : isGround ? 'var(--text-muted)' : 'var(--bg-card)'}
                          stroke={p.kind === 'source' ? (side === 'a' ? '#ef4444' : 'var(--text-muted)') : 'var(--color-brand)'}
                          strokeWidth={2.5} className="cursor-crosshair"
                          onPointerDown={(e) => onTermDown(e, termKey(p.id, side))} />
                      );
                    })}
                    {p.kind === 'source' && (
                      <text x={t.a.x} y={t.a.y - 13} textAnchor="middle" fontSize={14} fontWeight={800} fill="#ef4444" fontFamily="monospace">+</text>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Tray / palette */}
          <p className="text-xs text-[var(--text-muted)] mt-3 mb-2">Tap a part to drop it in, then drag to move. Click a terminal, then another, to wire them.</p>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(KIND_META) as Kind[]).map((k) => (
              <button key={k} onClick={() => addPart(k)}
                className="px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] text-[13px] font-semibold text-[var(--text-primary)] hover:border-[var(--color-brand)] transition-colors flex items-center gap-1.5">
                <span>{KIND_META[k].emoji}</span> {KIND_META[k].label}
              </button>
            ))}
          </div>
        </div>

        {/* Meter + inspector */}
        <div className="grid gap-3">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
            <h3 className="text-[11px] uppercase tracking-wider text-[var(--text-muted)] font-bold mb-3">Live readout</h3>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] px-3.5 py-3">
              <div className="text-[11px] uppercase text-[var(--text-muted)] font-semibold">Circuit current</div>
              <div className="font-mono text-[22px] font-semibold tabular-nums text-[var(--text-primary)] mt-0.5">
                {sol.ok ? mA(totalI) : '—'}<span className="text-xs text-[var(--text-muted)] font-normal"> mA</span>
              </div>
            </div>
            <div className="mt-3 flex gap-2.5 items-start text-[13px]">
              <span className={cn('flex-none mt-1 w-2.5 h-2.5 rounded-full',
                statusKind === 'good' ? 'bg-[var(--color-green)]' : statusKind === 'bad' ? 'bg-red-500' : statusKind === 'warn' ? 'bg-[var(--cl-live)]' : 'bg-[var(--text-muted)]')} />
              <span className="text-[var(--text-secondary)]">{statusMsg}</span>
            </div>
          </div>

          {selPart && (
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-[var(--text-primary)]">{KIND_META[selPart.kind].label}</h3>
                <button onClick={deleteSel} className="text-[12px] font-semibold text-red-500 hover:underline">Delete</button>
              </div>

              {(selPart.kind === 'source' || selPart.kind === 'resistor') && (
                <label className="grid gap-1.5">
                  <div className="flex justify-between items-baseline">
                    <span className="text-xs text-[var(--text-muted)]">{selPart.kind === 'source' ? 'Voltage' : 'Resistance'}</span>
                    <span className="font-mono text-[13px] text-[var(--text-primary)] tabular-nums">{selPart.value.toLocaleString()} {KIND_META[selPart.kind].unit}</span>
                  </div>
                  {selPart.kind === 'source'
                    ? <input type="range" min={1} max={24} step={0.5} value={selPart.value} onChange={(e) => updateSel({ value: parseFloat(e.target.value) })} className="w-full accent-[var(--color-brand)]" />
                    : <input type="range" min={10} max={4700} step={10} value={selPart.value} onChange={(e) => updateSel({ value: parseFloat(e.target.value) })} className="w-full accent-[var(--color-brand)]" />}
                </label>
              )}
              {selPart.kind === 'led' && (
                <button onClick={() => updateSel({ flipped: !selPart.flipped })} className="w-full py-2 rounded-lg border border-[var(--border)] text-[13px] font-semibold text-[var(--text-primary)] hover:border-[var(--color-brand)]">⟲ Flip polarity</button>
              )}
              {selPart.kind === 'switch' && (
                <button onClick={() => updateSel({ closed: !selPart.closed })} className="w-full py-2 rounded-lg border border-[var(--border)] text-[13px] font-semibold text-[var(--text-primary)] hover:border-[var(--color-brand)]">{selPart.closed ? 'Open switch' : 'Close switch'}</button>
              )}

              {sol.ok && (
                <div className="mt-3 pt-3 border-t border-[var(--border)] grid grid-cols-2 gap-2 text-center">
                  <div>
                    <div className="text-[10px] uppercase text-[var(--text-muted)]">Current</div>
                    <div className="font-mono text-[15px] text-[var(--text-primary)] tabular-nums">{mA(sol.currents[selPart.id] ?? 0)} mA</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase text-[var(--text-muted)]">Voltage</div>
                    <div className="font-mono text-[15px] text-[var(--text-primary)] tabular-nums">
                      {Math.abs((sol.voltage[sol.nodeOf.get(termKey(selPart.id, 'a')) ?? 0] ?? 0) - (sol.voltage[sol.nodeOf.get(termKey(selPart.id, 'b')) ?? 0] ?? 0)).toFixed(2)} V
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PartSymbol({ p, lit, current, selected }: { p: Placed; lit: boolean; current: number; selected: boolean }) {
  const cx = p.x, cy = p.y;
  const stroke = selected ? 'var(--color-brand)' : 'var(--text-primary)';
  if (p.kind === 'resistor') {
    return <polyline points={`${cx - 24},${cy} ${cx - 18},${cy - 10} ${cx - 6},${cy + 10} ${cx + 6},${cy - 10} ${cx + 18},${cy + 10} ${cx + 24},${cy}`} fill="none" stroke={stroke} strokeWidth={2.5} strokeLinejoin="round" />;
  }
  if (p.kind === 'source') {
    return <g stroke={stroke} strokeWidth={2.5}><line x1={cx - 6} y1={cy - 16} x2={cx - 6} y2={cy + 16} /><line x1={cx + 6} y1={cy - 8} x2={cx + 6} y2={cy + 8} /></g>;
  }
  if (p.kind === 'switch') {
    return <g stroke={stroke} strokeWidth={2.5} strokeLinecap="round"><line x1={cx - 16} y1={cy} x2={cx + (p.closed ? 16 : 10)} y2={cy - (p.closed ? 0 : 12)} /><circle cx={cx - 16} cy={cy} r={2.5} fill={stroke} /><circle cx={cx + 16} cy={cy} r={2.5} fill={stroke} /></g>;
  }
  // led — glow scales with current
  const dir = p.flipped ? -1 : 1;
  const glow = Math.min(18, 5 + current * 900);
  return (
    <g stroke={lit ? 'var(--cl-led)' : stroke} strokeWidth={2.5} strokeLinejoin="round"
      style={lit ? { filter: `drop-shadow(0 0 ${glow.toFixed(0)}px var(--cl-led))` } : undefined}>
      <polygon points={`${cx - 12 * dir},${cy - 12} ${cx - 12 * dir},${cy + 12} ${cx + 12 * dir},${cy}`} fill={lit ? 'var(--cl-led)' : 'none'} fillOpacity={lit ? 0.3 : 0} />
      <line x1={cx + 12 * dir} y1={cy - 12} x2={cx + 12 * dir} y2={cy + 12} />
    </g>
  );
}
