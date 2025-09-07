import React, { useMemo, useState } from "react";
import { Hand } from "pokersolver";

const SUITS = ["s", "h", "d", "c"];
const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K", "A"];
const ALL_CARDS = RANKS.flatMap((r) => SUITS.map((s) => r + s));

function makeDeck(exclude = new Set()) {
  return ALL_CARDS.filter((c) => !exclude.has(c));
}

function shuffleInPlace(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function formatPct(x) {
  if (!isFinite(x)) return "0%";
  return (x * 100).toFixed(2) + "%";
}

function cardLabel(c) {
  if (!c) return "--";
  const rank = c[0];
  const suit = c[1];
  const suitMap = { s: "♠", h: "♥", d: "♦", c: "♣" };
  return rank + suitMap[suit];
}

function CardPicker({ value, onChange, disabled, used }) {
  const [open, setOpen] = useState(false);
  const options = useMemo(() => ALL_CARDS, []);

  const isUsed = (c) => used?.has(c) && c !== value;

  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={
          "px-3 py-2 rounded-2xl border shadow-sm text-sm font-medium min-w-[64px] text-left " +
          (disabled ? "opacity-50 cursor-not-allowed " : "hover:shadow ") +
          (value ? "bg-white" : "bg-gray-50")
        }
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {value ? cardLabel(value) : "Pick"}
      </button>
      {open && (
        <div className="absolute z-30 mt-2 max-h-64 w-56 overflow-auto rounded-2xl border bg-white p-2 shadow-xl grid grid-cols-4 gap-2">
          {options.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => {
                onChange(c);
                setOpen(false);
              }}
              disabled={isUsed(c)}
              className={
                "rounded-xl border px-2 py-1 text-sm " +
                (isUsed(c)
                  ? "opacity-30 cursor-not-allowed"
                  : value === c
                  ? "ring-2 ring-indigo-500"
                  : "hover:bg-gray-50")
              }
            >
              {cardLabel(c)}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              onChange("");
              setOpen(false);
            }}
            className="col-span-4 mt-2 rounded-xl border px-2 py-1 text-sm hover:bg-gray-50"
          >
            Clear
          </button>
        </div>
      )}
    </div>
  );
}

function simulateEquity({ players, hero, board, iterations }) {
  const known = new Set([...hero, ...board].filter(Boolean));
  if (known.size !== [...hero, ...board].filter(Boolean).length) {
    throw new Error("Duplicate cards detected. Please fix your selections.");
  }
  if (players < 2 || players > 10) {
    throw new Error("Players must be between 2 and 10.");
  }
  if (!hero[0] || !hero[1]) {
    throw new Error("Please choose both of your hole cards.");
  }

  let wins = 0, ties = 0, losses = 0;

  for (let t = 0; t < iterations; t++) {
    const deck = shuffleInPlace(makeDeck(known).slice());

    let idx = 0;
    const simBoard = board.slice();
    for (let i = 0; i < 5; i++) {
      if (!simBoard[i]) simBoard[i] = deck[idx++];
    }

    const opponents = [];
    for (let p = 0; p < players - 1; p++) {
      const c1 = deck[idx++];
      const c2 = deck[idx++];
      opponents.push([c1, c2]);
    }

    const heroHand = Hand.solve([...hero, ...simBoard]);
    const oppHands = opponents.map((h) => Hand.solve([...h, ...simBoard]));

    const all = [heroHand, ...oppHands];
    const winners = Hand.winners(all);

    if (winners.length === 1) {
      if (winners[0] === heroHand) wins++;
      else losses++;
    } else {
      if (winners.includes(heroHand)) ties++;
      else losses++;
    }
  }

  const win = wins / iterations;
  const tie = ties / iterations;
  const loss = losses / iterations;
  const equity = win + tie / 2;
  return { win, tie, loss, equity, iterations };
}

function Stat({ label, value }) {
  return (
    <div className="rounded-2xl border p-4 text-center">
      <div className="text-2xl font-semibold">{value}</div>
      <div className="mt-1 text-xs text-slate-500">{label}</div>
    </div>
  );
}

export default function App() {
  const [players, setPlayers] = useState(6);
  const [hero, setHero] = useState(["As", "Ks"]);
  const [board, setBoard] = useState(["", "", "", "", ""]);
  const [iters, setIters] = useState(20000);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const used = useMemo(() => new Set([...hero, ...board].filter(Boolean)), [hero, board]);

  const run = async () => {
    setError("");
    setResult(null);
    setBusy(true);
    try {
      const res = await new Promise((resolve) => {
        setTimeout(() => {
          const out = simulateEquity({
            players,
            hero,
            board,
            iterations: Math.max(1000, Math.min(200000, Number(iters) || 0)),
          });
          resolve(out);
        }, 10);
      });
      setResult(res);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  const clearAll = () => {
    setHero(["", ""]);
    setBoard(["", "", "", "", ""]);
    setResult(null);
    setError("");
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-slate-50 to-white text-slate-800 p-6">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Texas Hold’em Odds Simulator</h1>
            <p className="text-sm text-slate-600 mt-1">
              Enter players, your hand, and known board cards (flop/turn/river). Run a Monte Carlo
              simulation to estimate your equity against random opponents.
            </p>
          </div>
          <button
            onClick={clearAll}
            className="rounded-2xl border px-3 py-2 text-sm shadow-sm hover:shadow"
          >
            Reset
          </button>
        </header>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <h2 className="font-medium mb-3">Table</h2>
            <label className="block text-sm mb-1">Number of players (2–10)</label>
            <input
              type="number"
              min={2}
              max={10}
              value={players}
              onChange={(e) => setPlayers(Math.max(2, Math.min(10, Number(e.target.value))))}
              className="w-full rounded-xl border px-3 py-2"
            />
            <div className="text-xs text-slate-500 mt-2">
              Includes you. Opponents are assumed to have random hole cards from the remaining deck.
            </div>
          </div>

          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <h2 className="font-medium mb-3">Your Hand</h2>
            <div className="flex gap-3">
              <CardPicker
                value={hero[0]}
                used={used}
                onChange={(c) => setHero(([_, b]) => [c, b])}
              />
              <CardPicker
                value={hero[1]}
                used={used}
                onChange={(c) => setHero(([a]) => [a, c])}
              />
            </div>
            <div className="text-xs text-slate-500 mt-2">Example: As = Ace of spades, Kh = King of hearts.</div>
          </div>

          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <h2 className="font-medium mb-3">Board (Flop · Turn · River)</h2>
            <div className="grid grid-cols-5 gap-2">
              {board.map((c, i) => (
                <CardPicker
                  key={i}
                  value={c}
                  used={used}
                  onChange={(v) => setBoard((arr) => arr.map((x, j) => (i === j ? v : x)))}
                />
              ))}
            </div>
            <div className="text-xs text-slate-500 mt-2">Leave unknown cards blank.</div>
          </div>
        </section>

        <section className="rounded-2xl border bg-white p-4 shadow-sm mb-6">
          <h2 className="font-medium mb-3">Simulation</h2>
          <div className="flex flex-col sm:flex-row items-start gap-4 sm:items-end">
            <div>
              <label className="block text-sm mb-1">Iterations (1,000 – 200,000)</label>
              <input
                type="number"
                value={iters}
                onChange={(e) => setIters(Number(e.target.value))}
                className="w-40 rounded-xl border px-3 py-2"
                min={1000}
                max={200000}
                step={1000}
              />
              <div className="text-xs text-slate-500 mt-2 max-w-sm">
                More iterations = higher accuracy but slower. 20,000 is a good balance.
              </div>
            </div>
            <button
              onClick={run}
              disabled={busy}
              className={
                "rounded-2xl border px-4 py-2 text-sm font-medium shadow-sm " +
                (busy ? "opacity-60 cursor-not-allowed" : "hover:shadow")
              }
            >
              {busy ? "Running…" : "Run Simulation"}
            </button>
          </div>
          {error && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}
        </section>

        {result && (
          <section className="rounded-2xl border bg-white p-4 shadow-sm">
            <h2 className="font-medium mb-3">Results</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Stat label="Win %" value={formatPct(result.win)} />
              <Stat label="Tie %" value={formatPct(result.tie)} />
              <Stat label="Loss %" value={formatPct(result.loss)} />
              <Stat label="Equity (win + ½ tie)" value={formatPct(result.equity)} />
            </div>
            <div className="text-xs text-slate-500 mt-3">
              Based on {result.iterations.toLocaleString()} simulations. Ties are counted as half a win for equity.
            </div>
          </section>
        )}

        <footer className="mt-8 text-xs text-slate-500">
          Built with Monte Carlo simulation and <code>pokersolver</code> for hand ranking.
        </footer>
      </div>
    </div>
  );
}
