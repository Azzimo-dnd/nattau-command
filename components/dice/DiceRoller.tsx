"use client";

import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";

type DieType = 4 | 6 | 8 | 10 | 12 | 20 | 100;

type RollMode = "normal" | "advantage" | "disadvantage";

type DiceGroup = {
  diceCount: number;
  sides: DieType;
};

type RolledGroup = {
  diceCount: number;
  sides: DieType;
  results: number[];
};

type ParsedExpression = {
  groups: DiceGroup[];
  modifier: number;
  normalizedExpression: string;
};

type RollResult = {
  id: string;
  label: string;
  expression: string;
  mode: RollMode;
  groups: RolledGroup[];
  dice: number[];
  keptDice?: number[];
  modifier: number;
  total: number;
  createdAt: string;
};

const STORAGE_KEY = "nattau-dice-roll-history";

const quickDice: DieType[] = [4, 6, 8, 10, 12, 20, 100];

function rollDie(sides: number) {
  return Math.floor(Math.random() * sides) + 1;
}

function wait(milliseconds: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function formatModifier(modifier: number) {
  if (modifier === 0) {
    return "";
  }

  return modifier > 0 ? `+${modifier}` : `${modifier}`;
}

function isSupportedDie(sides: number): sides is DieType {
  return [4, 6, 8, 10, 12, 20, 100].includes(sides);
}

function normalizeExpression(expression: string) {
  return expression.replace(/\s/g, "").toLowerCase();
}

function parseExpression(expression: string): ParsedExpression | null {
  const cleanedExpression = normalizeExpression(expression);

  if (!cleanedExpression) {
    return null;
  }

  const tokens = cleanedExpression.match(/[+-]?[^+-]+/g);

  if (!tokens) {
    return null;
  }

  const groups: DiceGroup[] = [];
  let modifier = 0;

  for (const token of tokens) {
    const sign = token.startsWith("-") ? -1 : 1;
    const cleanToken = token.replace(/^[+-]/, "");

    const diceMatch = cleanToken.match(/^(\d*)d(\d+)$/);

    if (diceMatch) {
      if (sign === -1) {
        return null;
      }

      const diceCount = diceMatch[1] === "" ? 1 : Number(diceMatch[1]);
      const sides = Number(diceMatch[2]);

      if (!isSupportedDie(sides)) {
        return null;
      }

      if (diceCount < 1 || diceCount > 30) {
        return null;
      }

      groups.push({
        diceCount,
        sides,
      });

      continue;
    }

    const numberMatch = cleanToken.match(/^\d+$/);

    if (numberMatch) {
      modifier += Number(cleanToken) * sign;
      continue;
    }

    return null;
  }

  if (groups.length === 0) {
    return null;
  }

  const totalDiceCount = groups.reduce(
    (sum, group) => sum + group.diceCount,
    0
  );

  if (totalDiceCount > 60) {
    return null;
  }

  return {
    groups,
    modifier,
    normalizedExpression: cleanedExpression,
  };
}

function getModeLabel(mode: RollMode) {
  switch (mode) {
    case "advantage":
      return "Advantage";
    case "disadvantage":
      return "Disadvantage";
    default:
      return "Normal";
  }
}

function getModeClass(mode: RollMode) {
  switch (mode) {
    case "advantage":
      return "border-green-500 bg-green-500/10 text-green-300";
    case "disadvantage":
      return "border-red-500 bg-red-500/10 text-red-300";
    default:
      return "border-slate-700 bg-slate-950/70 text-slate-300";
  }
}

function createId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatGroup(group: RolledGroup) {
  return `${group.diceCount}d${group.sides}: ${group.results.join(", ")}`;
}

function canUseAdvantage(parsed: ParsedExpression) {
  return (
    parsed.groups.length === 1 &&
    parsed.groups[0].diceCount === 1 &&
    parsed.groups[0].sides === 20
  );
}

function getRollingGroups(parsed: ParsedExpression, requestedMode: RollMode) {
  if (canUseAdvantage(parsed) && requestedMode !== "normal") {
    return [
      {
        diceCount: 2,
        sides: 20 as DieType,
      },
    ];
  }

  return parsed.groups;
}

function getDieShapeStyle(sides: DieType): CSSProperties {
  switch (sides) {
    case 4:
      return {
        clipPath: "polygon(50% 5%, 95% 88%, 5% 88%)",
      };
    case 8:
      return {
        clipPath: "polygon(50% 3%, 96% 50%, 50% 97%, 4% 50%)",
      };
    case 10:
      return {
        clipPath:
          "polygon(50% 2%, 92% 28%, 82% 88%, 50% 98%, 18% 88%, 8% 28%)",
      };
    case 12:
      return {
        clipPath:
          "polygon(50% 2%, 85% 15%, 98% 50%, 85% 85%, 50% 98%, 15% 85%, 2% 50%, 15% 15%)",
      };
    case 20:
      return {
        clipPath:
          "polygon(50% 2%, 78% 12%, 96% 36%, 92% 68%, 70% 94%, 30% 94%, 8% 68%, 4% 36%, 22% 12%)",
      };
    default:
      return {};
  }
}

function RollingDie({
  sides,
  index,
}: {
  sides: DieType;
  index: number;
}) {
  const delay = `${(index % 8) * 70}ms`;

  return (
    <div className="flex flex-col items-center gap-1">
      <span
        className="dice-roll-token flex h-12 w-12 items-center justify-center border border-yellow-400/70 bg-yellow-500/20 text-sm font-black text-yellow-200 shadow-lg shadow-yellow-950/30 sm:h-14 sm:w-14"
        style={{
          ...getDieShapeStyle(sides),
          animationDelay: delay,
        }}
      >
        d{sides}
      </span>

      <span className="text-[10px] uppercase tracking-wide text-slate-500">
        d{sides}
      </span>
    </div>
  );
}

function RollingTray({ groups }: { groups: DiceGroup[] }) {
  let visualIndex = 0;

  return (
    <div className="mt-5 rounded-2xl border border-yellow-600/30 bg-yellow-500/10 p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-yellow-300">
            Rolling dice...
          </p>

          <p className="mt-1 text-xs text-slate-500">
            The tray shows the number and type of dice from the current formula.
          </p>
        </div>

        <span className="rounded-full border border-yellow-600/40 bg-slate-950 px-3 py-1 text-xs text-yellow-300">
          rolling
        </span>
      </div>

      <div className="mt-5 space-y-4">
        {groups.map((group, groupIndex) => (
          <div
            key={`${group.sides}-${groupIndex}`}
            className="rounded-xl border border-slate-800 bg-slate-950/60 p-3"
          >
            <p className="mb-3 text-xs uppercase tracking-wide text-slate-500">
              {group.diceCount}d{group.sides}
            </p>

            <div className="flex flex-wrap gap-3">
              {Array.from({ length: group.diceCount }, () => {
                const currentIndex = visualIndex;
                visualIndex += 1;

                return (
                  <RollingDie
                    key={`${group.sides}-${currentIndex}`}
                    sides={group.sides}
                    index={currentIndex}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <style jsx>{`
        .dice-roll-token {
          border-radius: 0.85rem;
          animation: dice-roll 720ms ease-in-out infinite;
          transform-origin: center;
        }

        @keyframes dice-roll {
          0% {
            transform: translateX(0) translateY(0) rotate(0deg) scale(1);
          }
          20% {
            transform: translateX(8px) translateY(-10px) rotate(72deg)
              scale(1.08);
          }
          40% {
            transform: translateX(-6px) translateY(4px) rotate(145deg)
              scale(0.96);
          }
          60% {
            transform: translateX(10px) translateY(-5px) rotate(218deg)
              scale(1.05);
          }
          80% {
            transform: translateX(-4px) translateY(6px) rotate(300deg)
              scale(0.98);
          }
          100% {
            transform: translateX(0) translateY(0) rotate(360deg) scale(1);
          }
        }
      `}</style>
    </div>
  );
}

export function DiceRoller() {
  const [expression, setExpression] = useState("1d20");
  const [modifier, setModifier] = useState(0);
  const [mode, setMode] = useState<RollMode>("normal");
  const [history, setHistory] = useState<RollResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isRolling, setIsRolling] = useState(false);
  const [rollingGroups, setRollingGroups] = useState<DiceGroup[]>([]);

  useEffect(() => {
    const savedHistory = sessionStorage.getItem(STORAGE_KEY);

    if (!savedHistory) {
      return;
    }

    try {
      const parsedHistory = JSON.parse(savedHistory) as RollResult[];

      if (!Array.isArray(parsedHistory)) {
        sessionStorage.removeItem(STORAGE_KEY);
        return;
      }

      const validHistory = parsedHistory.filter((roll) =>
        Array.isArray(roll.groups)
      );

      setHistory(validHistory);
    } catch {
      sessionStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  }, [history]);

  const latestRoll = useMemo(() => history[0], [history]);

  async function performRoll(customExpression?: string, customMode?: RollMode) {
    if (isRolling) {
      return;
    }

    const usedExpression = customExpression ?? expression;
    const parsed = parseExpression(usedExpression);

    if (!parsed) {
      setError(
        "Use a valid dice formula, for example: 1d20, 2d6+3, 2d4+3d8 or 1d20+2d6+4."
      );
      return;
    }

    const usedMode = customMode ?? mode;
    const advantageAllowed = canUseAdvantage(parsed);
    const finalMode = advantageAllowed ? usedMode : "normal";

    setError(null);
    setRollingGroups(getRollingGroups(parsed, usedMode));
    setIsRolling(true);

    await wait(900);

    const expressionModifier = parsed.modifier;
    const finalModifier = expressionModifier + modifier;

    let groups: RolledGroup[] = [];
    let dice: number[] = [];
    let keptDice: number[] | undefined;
    let total = 0;

    if (advantageAllowed && finalMode !== "normal") {
      const firstRoll = rollDie(20);
      const secondRoll = rollDie(20);

      dice = [firstRoll, secondRoll];

      const kept =
        finalMode === "advantage"
          ? Math.max(firstRoll, secondRoll)
          : Math.min(firstRoll, secondRoll);

      keptDice = [kept];

      groups = [
        {
          diceCount: 2,
          sides: 20,
          results: dice,
        },
      ];

      total = kept + finalModifier;
    } else {
      groups = parsed.groups.map((group) => {
        const results = Array.from({ length: group.diceCount }, () =>
          rollDie(group.sides)
        );

        return {
          ...group,
          results,
        };
      });

      dice = groups.flatMap((group) => group.results);

      total =
        groups.reduce(
          (sum, group) =>
            sum +
            group.results.reduce((groupSum, value) => groupSum + value, 0),
          0
        ) + finalModifier;
    }

    const result: RollResult = {
      id: createId(),
      label: `${parsed.normalizedExpression}${formatModifier(modifier)}`,
      expression: parsed.normalizedExpression,
      mode: finalMode,
      groups,
      dice,
      keptDice,
      modifier: finalModifier,
      total,
      createdAt: new Date().toLocaleTimeString(),
    };

    setHistory((currentHistory) => [result, ...currentHistory].slice(0, 30));
    setIsRolling(false);
    setRollingGroups([]);
  }

  function rollQuickDie(sides: DieType) {
    const quickExpression = `1d${sides}`;

    setExpression(quickExpression);
    performRoll(quickExpression, sides === 20 ? mode : "normal");
  }

  function clearHistory() {
    setHistory([]);
    setRollingGroups([]);
    sessionStorage.removeItem(STORAGE_KEY);
  }

  return (
    <section className="grid gap-6 xl:grid-cols-[380px_1fr]">
      <div className="space-y-6">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <p className="text-xs uppercase tracking-[0.35em] text-yellow-500">
            Roll Command
          </p>

          <h2 className="mt-3 text-2xl font-bold">Prepare Roll</h2>

          <div className="mt-5 space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-300">
                Dice formula
              </label>

              <input
                value={expression}
                disabled={isRolling}
                onChange={(event) => setExpression(event.target.value)}
                placeholder="1d20, 2d6+3, 2d4+3d8"
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-yellow-500 disabled:cursor-not-allowed disabled:opacity-60"
              />

              <p className="mt-2 text-xs text-slate-500">
                Supported examples: 1d20, d8, 2d6+3, 2d4+3d8,
                1d20+2d6+4.
              </p>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-300">
                Extra modifier
              </label>

              <input
                type="number"
                value={modifier}
                disabled={isRolling}
                onChange={(event) => setModifier(Number(event.target.value))}
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none transition focus:border-yellow-500 disabled:cursor-not-allowed disabled:opacity-60"
              />

              <p className="mt-2 text-xs text-slate-500">
                This modifier is added on top of any modifier written in the
                formula.
              </p>
            </div>

            <div>
              <p className="text-sm font-medium text-slate-300">Roll mode</p>

              <div className="mt-2 grid grid-cols-3 gap-2">
                {(["normal", "advantage", "disadvantage"] as RollMode[]).map(
                  (rollMode) => (
                    <button
                      key={rollMode}
                      type="button"
                      disabled={isRolling}
                      onClick={() => setMode(rollMode)}
                      className={`rounded-xl border px-3 py-2 text-xs transition disabled:cursor-not-allowed disabled:opacity-60 ${
                        mode === rollMode
                          ? getModeClass(rollMode)
                          : "border-slate-700 bg-slate-950/70 text-slate-400 hover:border-yellow-600/40 hover:text-yellow-300"
                      }`}
                    >
                      {getModeLabel(rollMode)}
                    </button>
                  )
                )}
              </div>

              <p className="mt-2 text-xs text-slate-500">
                Advantage and disadvantage apply only to pure 1d20 rolls.
              </p>
            </div>

            {error && (
              <p className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {error}
              </p>
            )}

            <button
              type="button"
              disabled={isRolling}
              onClick={() => performRoll()}
              className="w-full rounded-xl border border-yellow-500 bg-yellow-500 px-4 py-3 font-bold text-slate-950 transition hover:bg-yellow-400 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isRolling ? "Rolling..." : "Roll Dice"}
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <p className="text-xs uppercase tracking-[0.35em] text-yellow-500">
            Quick Dice
          </p>

          <div className="mt-4 grid grid-cols-4 gap-2">
            {quickDice.map((sides) => (
              <button
                key={sides}
                type="button"
                disabled={isRolling}
                onClick={() => rollQuickDie(sides)}
                className="rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-3 font-bold text-slate-200 transition hover:border-yellow-500 hover:text-yellow-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                d{sides}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-yellow-500">
                Latest Result
              </p>

              <h2 className="mt-3 text-2xl font-bold">Roll Outcome</h2>
            </div>

            <button
              type="button"
              onClick={clearHistory}
              disabled={isRolling}
              className="rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-2 text-sm text-slate-300 transition hover:border-red-500/50 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Clear History
            </button>
          </div>

          {isRolling ? (
            <RollingTray groups={rollingGroups} />
          ) : latestRoll ? (
            <div className="mt-5 rounded-2xl border border-yellow-600/30 bg-yellow-500/10 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-slate-400">
                    {latestRoll.expression} · {getModeLabel(latestRoll.mode)}
                  </p>

                  <h3 className="mt-2 text-5xl font-black text-yellow-300">
                    {latestRoll.total}
                  </h3>
                </div>

                <span className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-xs text-slate-400">
                  {latestRoll.createdAt}
                </span>
              </div>

              <div className="mt-5 space-y-3">
                {latestRoll.groups.map((group, groupIndex) => (
                  <div
                    key={`${latestRoll.id}-${groupIndex}`}
                    className="rounded-xl border border-slate-800 bg-slate-950/60 p-3"
                  >
                    <p className="mb-2 text-xs uppercase tracking-wide text-slate-500">
                      {group.diceCount}d{group.sides}
                    </p>

                    <div className="flex flex-wrap gap-2">
                      {group.results.map((die, index) => {
                        const isKept =
                          !latestRoll.keptDice ||
                          latestRoll.keptDice.includes(die);

                        return (
                          <span
                            key={`${latestRoll.id}-${groupIndex}-${index}`}
                            className={`rounded-xl border px-4 py-2 font-bold ${
                              isKept
                                ? "border-yellow-500 bg-yellow-500/15 text-yellow-300"
                                : "border-slate-700 bg-slate-950/70 text-slate-500"
                            }`}
                          >
                            {die}
                          </span>
                        );
                      })}

                      {group.results.length > 1 && (
                        <span className="rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-2 font-bold text-slate-300">
                          subtotal:{" "}
                          {group.results.reduce(
                            (sum, value) => sum + value,
                            0
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                ))}

                {latestRoll.modifier !== 0 && (
                  <span className="inline-flex rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-2 font-bold text-slate-300">
                    Modifier: {formatModifier(latestRoll.modifier)}
                  </span>
                )}
              </div>
            </div>
          ) : (
            <p className="mt-5 rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-500">
              No rolls yet. The dice are waiting.
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <p className="text-xs uppercase tracking-[0.35em] text-yellow-500">
            Session Log
          </p>

          <h2 className="mt-3 text-2xl font-bold">Roll History</h2>

          <div className="mt-5 space-y-3">
            {history.length === 0 ? (
              <p className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-500">
                The session log is empty.
              </p>
            ) : (
              history.map((roll) => (
                <article
                  key={roll.id}
                  className="rounded-xl border border-slate-800 bg-slate-950/60 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-bold text-slate-100">
                        {roll.expression} · {getModeLabel(roll.mode)}
                      </p>

                      <p className="mt-1 text-sm text-slate-500">
                        {roll.groups.map(formatGroup).join(" | ")}
                        {roll.modifier !== 0 &&
                          ` · Modifier: ${formatModifier(roll.modifier)}`}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-2xl font-black text-yellow-300">
                        {roll.total}
                      </p>

                      <p className="text-xs text-slate-500">
                        {roll.createdAt}
                      </p>
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
