import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

// ── Deterministic circuit physics (real, not AI-guessed) ────────────────────
// Series loop: battery → (resistor|jumper) → LED. Ohm's law + a ~2 V LED
// forward drop + polarity. Kept as a PURE function of the board state.
const VF = 2.0;              // LED forward voltage (red)
const SAFE_LO = 5, SAFE_HI = 20, WARN = 25, BURN = 35; // mA

type PartId = 'battery' | 'resistor' | 'led' | 'jumper';
type Slot = PartId | null;
type LedState = 'off' | 'on' | 'burnt';
type Status = 'idle' | 'good' | 'warn' | 'bad';

interface Board { slots: Slot[]; ledFlipped: boolean; vbat: number; rval: number; }
interface Result { current: number; vled: number; status: Status; msg: string; formula: string; led: LedState; }

const PART_LABEL: Record<PartId, string> = {
  battery: 'Battery', resistor: 'Resistor', led: 'LED', jumper: 'Jumper wire',
};

function simulate(b: Board): Result {
  const placed = b.slots.filter(Boolean) as PartId[];
  const hasBattery = placed.includes('battery');
  const hasLed = placed.includes('led');
  const open = b.slots.includes(null);
  const out: Result = { current: 0, vled: 0, status: 'idle', msg: '', formula: '', led: 'off' };

  if (!hasBattery) { out.msg = 'No power source — drop the battery into a slot.'; return out; }
  if (!hasLed) { out.msg = "Add the LED — that's the part you're lighting up."; return out; }
  if (open) { out.msg = 'The loop is open. Fill all three slots so current has a path all the way round.'; return out; }

  if (b.ledFlipped) {
    out.status = 'warn';
    out.msg = 'LED is reverse-biased — a diode only conducts one way, so no current flows. Flip its polarity.';
    out.formula = 'Reverse-biased diode → I ≈ 0';
    return out;
  }

  let R = 0;
  placed.forEach((id) => { if (id === 'resistor') R += b.rval; });

  if (b.vbat <= VF) {
    out.status = 'warn';
    out.msg = "Battery voltage is below the LED's ~2 V forward drop, so it can't turn on. Raise the voltage.";
    out.formula = `V_batt (${b.vbat.toFixed(1)} V) ≤ V_f (2.0 V) → no conduction`;
    return out;
  }

  const drive = b.vbat - VF;
  if (R <= 0) {
    out.status = 'bad'; out.led = 'burnt'; out.current = 999;
    out.msg = 'No current-limiting resistor! With nothing to hold it back, current spikes and the LED instantly burns out.';
    out.formula = 'R = 0 Ω → I = (V_batt − V_f) / 0 → ∞';
    return out;
  }

  const mA = (drive / R) * 1000;
  out.current = mA; out.vled = VF;
  if (mA >= BURN) {
    out.status = 'bad'; out.led = 'burnt';
    out.msg = 'Too much current — the LED overheats and burns out. Use a bigger resistor.';
  } else if (mA > WARN) {
    out.status = 'bad'; out.led = 'on';
    out.msg = "Over its safe limit (~20 mA). It glows bright but it's cooking — bump the resistor up.";
  } else if (mA >= SAFE_LO) {
    out.status = 'good'; out.led = 'on';
    out.msg = 'Lit and safe. Current is in the healthy 5–20 mA band.';
  } else if (mA > 0.3) {
    out.status = 'warn'; out.led = 'on';
    out.msg = 'It lights, but very dimly — the resistor is large, so little current flows. Lower it for a brighter glow.';
  } else {
    out.status = 'warn'; out.led = 'off';
    out.msg = 'Barely any current — the resistor is far too large.';
  }
  out.formula = `I = (V_batt − V_f) / R = (${b.vbat.toFixed(1)} − 2.0) / ${Math.round(R)} Ω = ${mA.toFixed(1)} mA`;
  return out;
}

// ── Component SVG icons ─────────────────────────────────────────────────────
function PartIcon({ kind, flipped }: { kind: PartId; flipped?: boolean }) {
  if (kind === 'battery') return (
    <svg viewBox="0 0 60 40" className="w-11 h-7"><g fill="none" stroke="var(--cl-copper)" strokeWidth="3"><line x1="6" y1="20" x2="22" y2="20" /><line x1="38" y1="20" x2="54" y2="20" /><line x1="24" y1="8" x2="24" y2="32" /><line x1="30" y1="13" x2="30" y2="27" /><line x1="36" y1="8" x2="36" y2="32" /></g><text x="14" y="14" fill="var(--cl-live)" fontSize="11" fontFamily="monospace">+</text></svg>
  );
  if (kind === 'resistor') return (
    <svg viewBox="0 0 60 40" className="w-11 h-7"><g fill="none" stroke="var(--text-primary)" strokeWidth="3" strokeLinejoin="round"><line x1="4" y1="20" x2="14" y2="20" /><polyline points="14,20 19,10 24,30 29,10 34,30 39,10 44,20" /><line x1="44" y1="20" x2="56" y2="20" /></g></svg>
  );
  if (kind === 'jumper') return (
    <svg viewBox="0 0 60 40" className="w-11 h-7"><line x1="5" y1="20" x2="55" y2="20" stroke="var(--cl-copper)" strokeWidth="3.5" /></svg>
  );
  return (
    <svg viewBox="0 0 60 40" className="w-11 h-7"><g transform={flipped ? 'translate(60,0) scale(-1,1)' : undefined} fill="none" stroke="var(--cl-led)" strokeWidth="3" strokeLinejoin="round"><line x1="4" y1="20" x2="20" y2="20" /><polygon points="20,10 20,30 36,20" fill="var(--cl-led)" fillOpacity="0.25" /><line x1="36" y1="9" x2="36" y2="31" /><line x1="36" y1="20" x2="56" y2="20" /><g strokeWidth="2"><line x1="40" y1="6" x2="46" y2="1" /><line x1="45" y1="8" x2="51" y2="3" /></g></g></svg>
  );
}

function Chip({ id, flipped }: { id: PartId; flipped?: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 select-none pointer-events-none">
      <PartIcon kind={id} flipped={flipped} />
      <span className="text-[10.5px] font-bold text-[var(--text-primary)]">{PART_LABEL[id]}</span>
    </div>
  );
}

const RES_STEPS = [100, 220, 330, 470, 680, 1000, 2200, 4700, 10000];

export default function CircuitLab() {
  const [slots, setSlots] = useState<Slot[]>([null, null, null]);
  const [tray, setTray] = useState<PartId[]>(['battery', 'resistor', 'led', 'jumper']);
  const [selected, setSelected] = useState<PartId | null>(null);
  const [ledFlipped, setLedFlipped] = useState(false);
  const [vbat, setVbat] = useState(9);
  const [rIdx, setRIdx] = useState(3); // 470 Ω
  const [verdict, setVerdict] = useState<{ pass: boolean; text: string } | null>(null);

  const rval = RES_STEPS[rIdx];
  const r = useMemo(() => simulate({ slots, ledFlipped, vbat, rval }), [slots, ledFlipped, vbat, rval]);

  const socketRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [overSlot, setOverSlot] = useState<number | null>(null);
  const [drag, setDrag] = useState<{ id: PartId; x: number; y: number; sx: number; sy: number; moved: boolean } | null>(null);

  // ── placement helpers (immutable) ──
  const place = useCallback((id: PartId, idx: number) => {
    setSlots((prev) => {
      const next = prev.map((s) => (s === id ? null : s));
      const displaced = next[idx];
      next[idx] = id;
      setTray((t) => {
        const cleaned = t.filter((p) => p !== id);
        if (displaced && displaced !== id) cleaned.push(displaced);
        return cleaned;
      });
      return next;
    });
    setSelected(null);
    setVerdict(null);
  }, []);

  const returnToTray = useCallback((id: PartId) => {
    setSlots((prev) => prev.map((s) => (s === id ? null : s)));
    setTray((t) => (t.includes(id) ? t : [...t, id]));
    setSelected(null);
    setVerdict(null);
  }, []);

  const reset = () => {
    setSlots([null, null, null]);
    setTray(['battery', 'resistor', 'led', 'jumper']);
    setSelected(null); setLedFlipped(false); setVbat(9); setRIdx(3); setVerdict(null);
  };

  const socketAt = (x: number, y: number): number | null => {
    for (let i = 0; i < socketRefs.current.length; i++) {
      const el = socketRefs.current[i];
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) return i;
    }
    return null;
  };

  // ── pointer drag ──
  const startDrag = (id: PartId, e: React.PointerEvent) => {
    setDrag({ id, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, moved: false });
  };

  useEffect(() => {
    if (!drag) return;
    const onMove = (e: PointerEvent) => {
      setDrag((d) => {
        if (!d) return d;
        const moved = d.moved || Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > 6;
        return { ...d, x: e.clientX, y: e.clientY, moved };
      });
      setOverSlot(socketAt(e.clientX, e.clientY));
    };
    const onUp = (e: PointerEvent) => {
      setOverSlot(null);
      setDrag((d) => {
        if (!d) return null;
        if (!d.moved) {
          // tap: a tray chip selects; a placed chip returns to tray
          if (slots.includes(d.id)) returnToTray(d.id);
          else setSelected((s) => (s === d.id ? null : d.id));
          return null;
        }
        const idx = socketAt(e.clientX, e.clientY);
        if (idx !== null) place(d.id, idx);
        else returnToTray(d.id);
        return null;
      });
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [drag, slots, place, returnToTray]);

  const check = () => {
    const pass = r.led === 'on' && r.current >= 10 && r.current <= SAFE_HI && !ledFlipped;
    let text: string;
    if (pass) text = `✓ ${r.current.toFixed(1)} mA — safe and bright. That resistor lands you right in the 10–20 mA band. Lesson cleared.`;
    else if (r.led === 'burnt') text = '✗ You burnt the LED. The whole point of the resistor is to limit current — rebuild with it in the loop.';
    else if (ledFlipped) text = "✗ The LED's backwards, so nothing lights. Diodes are one-way — flip it and try again.";
    else if (r.led !== 'on') text = '✗ The LED isn\'t lit yet. ' + r.msg;
    else if (r.current > SAFE_HI) text = `✗ ${r.current.toFixed(1)} mA is too hot — over the 20 mA ceiling. Go up a resistor value.`;
    else text = `✗ ${r.current.toFixed(1)} mA is below target — too dim. Lower the resistor to push more current (stay under 20 mA).`;
    setVerdict({ pass, text });
  };

  const flowing = r.led === 'on' && r.current > 0.3;
  const flowCol = r.status === 'good' ? 'var(--color-green)' : r.status === 'bad' ? '#ef4444' : 'var(--cl-live)';
  const flowDur = Math.max(0.25, 1.4 - Math.min(1.1, r.current / 20));
  const resistorPlaced = slots.includes('resistor');

  const statusRing = r.status === 'good'
    ? 'border-[var(--color-green)]/50'
    : r.status === 'bad' ? 'border-red-500/50' : 'border-[var(--border)]';

  const wireStyle = (on: boolean): React.CSSProperties => on
    ? { ['--flow-col' as string]: flowCol, ['--flow-dur' as string]: `${flowDur.toFixed(2)}s` }
    : {};

  return (
    <div
      className="w-full"
      style={{
        ['--cl-copper' as string]: '#c8804a',
        ['--cl-live' as string]: '#f59e0b',
        ['--cl-led' as string]: '#ff5a4d',
      }}
    >
      <style>{`
        @keyframes cl-flow { to { transform: translateX(16px); } }
        .cl-wire { position: relative; height: 4px; border-radius: 3px; overflow: hidden;
          background: color-mix(in srgb, var(--cl-copper) 45%, var(--border)); }
        .cl-wire.on::after { content:""; position:absolute; inset:0;
          background: repeating-linear-gradient(90deg, transparent 0 6px, var(--flow-col) 6px 10px, transparent 10px 16px);
          animation: cl-flow var(--flow-dur,1s) linear infinite; opacity:.9; }
        @media (prefers-reduced-motion: reduce) { .cl-wire.on::after { animation: none; } }
      `}</style>

      <div className="grid lg:grid-cols-[1.35fr_1fr] gap-4 items-start">
        {/* Bench */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4 sm:p-5">
          <h3 className="text-[11px] uppercase tracking-wider text-[var(--text-muted)] font-bold mb-4">The bench</h3>

          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] p-4 sm:p-5">
            <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-0">
              {[0, 1, 2].map((i) => (
                <div key={i} className="contents">
                  <button
                    ref={(el) => { socketRefs.current[i] = el; }}
                    onClick={() => { if (selected && !slots[i]) place(selected, i); }}
                    onPointerDown={(e) => { const id = slots[i]; if (id) startDrag(id, e); }}
                    className={cn(
                      'relative aspect-square w-full max-w-[104px] mx-auto rounded-xl grid place-items-center text-[11px] font-semibold transition-all',
                      slots[i] ? 'border border-[var(--border-strong)] bg-[var(--bg-card)]' : 'border-[1.6px] border-dashed border-[var(--border)] text-[var(--text-muted)]',
                      overSlot === i && 'border-[var(--color-brand)] bg-[var(--color-brand)]/10',
                      i === 0 && !slots[i] && 'ring-0'
                    )}
                  >
                    {i === 0 && <span className="absolute -top-2 left-2.5 text-[var(--cl-live)] font-extrabold font-mono text-sm">+</span>}
                    {slots[i]
                      ? <Chip id={slots[i] as PartId} flipped={slots[i] === 'led' ? ledFlipped : false} />
                      : <span>{i === 0 ? 'Battery' : i === 2 ? 'LED' : 'Part'}</span>}
                    {slots[i] === 'led' && r.led === 'on' && (
                      <span aria-hidden className="absolute inset-0 rounded-xl pointer-events-none"
                        style={{ boxShadow: `0 0 ${Math.min(26, 6 + r.current).toFixed(0)}px var(--cl-led)` }} />
                    )}
                  </button>
                  {i < 2 && <div className={cn('cl-wire', flowing && 'on')} style={wireStyle(flowing)} />}
                </div>
              ))}
            </div>
            <div className={cn('cl-wire mt-4', flowing && 'on')} style={wireStyle(flowing)} />
          </div>

          {/* Tray */}
          <p className="text-xs text-[var(--text-muted)] mt-4 mb-2">Drag a part into a slot — or tap a part, then tap a slot.</p>
          <div className="flex flex-wrap gap-2.5">
            {tray.map((id) => (
              <button
                key={id}
                onPointerDown={(e) => startDrag(id, e)}
                className={cn(
                  'w-[92px] h-20 rounded-xl border bg-[var(--bg-card)] grid place-items-center cursor-grab touch-none',
                  selected === id ? 'border-[var(--color-brand)] ring-2 ring-[var(--color-brand)]/40' : 'border-[var(--border)]',
                  drag?.id === id && 'opacity-40'
                )}
              >
                <Chip id={id} flipped={id === 'led' ? ledFlipped : false} />
              </button>
            ))}
          </div>

          {/* Controls */}
          <div className="grid gap-4 mt-5">
            <label className="grid gap-1.5">
              <div className="flex justify-between items-baseline">
                <span className="text-xs font-medium text-[var(--text-muted)]">Battery voltage</span>
                <span className="font-mono text-[13px] text-[var(--text-primary)] tabular-nums">{vbat.toFixed(1)} V</span>
              </div>
              <input type="range" min={1.5} max={12} step={0.5} value={vbat}
                onChange={(e) => { setVbat(parseFloat(e.target.value)); setVerdict(null); }}
                className="w-full accent-[var(--color-brand)]" />
            </label>
            <label className={cn('grid gap-1.5', !resistorPlaced && 'opacity-40')}>
              <div className="flex justify-between items-baseline">
                <span className="text-xs font-medium text-[var(--text-muted)]">Resistor value</span>
                <span className="font-mono text-[13px] text-[var(--text-primary)] tabular-nums">{rval.toLocaleString()} Ω</span>
              </div>
              <input type="range" min={0} max={RES_STEPS.length - 1} step={1} value={rIdx} disabled={!resistorPlaced}
                onChange={(e) => { setRIdx(parseInt(e.target.value, 10)); setVerdict(null); }}
                className="w-full accent-[var(--color-brand)]" />
            </label>
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => { setLedFlipped((f) => !f); setVerdict(null); }}
                className="px-3 py-2 rounded-lg border border-[var(--border)] text-[13px] font-semibold text-[var(--text-primary)] hover:border-[var(--color-brand)] transition-colors">
                ⟲ Flip LED polarity
              </button>
              <button onClick={reset}
                className="px-3 py-2 rounded-lg border border-[var(--border)] text-[13px] font-semibold text-[var(--text-primary)] hover:border-[var(--color-brand)] transition-colors">
                Reset bench
              </button>
            </div>
          </div>
        </div>

        {/* Meter + challenge */}
        <div className="grid gap-4">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4 sm:p-5">
            <h3 className="text-[11px] uppercase tracking-wider text-[var(--text-muted)] font-bold mb-3.5">Live readout</h3>
            <div className="grid grid-cols-2 gap-2.5">
              <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] px-3.5 py-3">
                <div className="text-[11px] uppercase text-[var(--text-muted)] font-semibold">Current</div>
                <div className="font-mono text-[22px] font-semibold tabular-nums text-[var(--text-primary)] mt-0.5">
                  {r.current >= 999 ? '∞' : r.current.toFixed(1)}<span className="text-xs text-[var(--text-muted)] font-normal"> mA</span>
                </div>
              </div>
              <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] px-3.5 py-3">
                <div className="text-[11px] uppercase text-[var(--text-muted)] font-semibold">Across LED</div>
                <div className="font-mono text-[22px] font-semibold tabular-nums text-[var(--text-primary)] mt-0.5">
                  {(r.vled || 0).toFixed(1)}<span className="text-xs text-[var(--text-muted)] font-normal"> V</span>
                </div>
              </div>
            </div>
            <div className={cn('mt-3.5 rounded-xl border bg-[var(--bg-secondary)] px-3.5 py-3 text-[13.5px] flex gap-2.5 items-start', statusRing)}>
              <span className={cn('flex-none mt-1 w-2.5 h-2.5 rounded-full',
                r.status === 'good' ? 'bg-[var(--color-green)]' : r.status === 'bad' ? 'bg-red-500' : r.status === 'warn' ? 'bg-[var(--cl-live)]' : 'bg-[var(--text-muted)]')} />
              <span className="text-[var(--text-secondary)]">{r.msg}</span>
            </div>
            {r.formula && <div className="font-mono text-[12px] text-[var(--text-muted)] mt-2"><b className="text-[var(--text-primary)]">{r.formula}</b></div>}
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4 sm:p-5">
            <h3 className="text-[11px] uppercase tracking-wider text-[var(--text-muted)] font-bold mb-3.5">Challenge</h3>
            <div className="flex gap-3 items-start">
              <div className="flex-none w-10 h-10 rounded-xl bg-[var(--color-brand)] grid place-items-center text-white font-extrabold">M</div>
              <div>
                <div className="text-[11px] uppercase tracking-wider text-[var(--color-brand)] font-bold">May</div>
                <p className="text-sm text-[var(--text-secondary)] mt-1">Light the LED <b className="text-[var(--text-primary)]">safely</b> from the 9 V battery — aim for <b className="text-[var(--text-primary)]">10–20 mA</b>. Pick the right part and dial in a resistor that gets you there.</p>
              </div>
            </div>
            <button onClick={check}
              className="mt-3.5 px-4 py-2.5 rounded-xl bg-[var(--color-brand)] text-white font-semibold text-sm hover:bg-[var(--color-brand-hover)] transition-colors">
              Check my circuit
            </button>
            {verdict && (
              <p className={cn('mt-3 text-[13.5px]', verdict.pass ? 'text-[var(--color-green)]' : 'text-[var(--cl-live)]')}>{verdict.text}</p>
            )}
          </div>
        </div>
      </div>

      {/* drag ghost */}
      {drag?.moved && (
        <div className="fixed z-50 pointer-events-none w-24 h-20 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] grid place-items-center shadow-xl"
          style={{ left: drag.x - 48, top: drag.y - 40 }}>
          <Chip id={drag.id} flipped={drag.id === 'led' ? ledFlipped : false} />
        </div>
      )}
    </div>
  );
}
