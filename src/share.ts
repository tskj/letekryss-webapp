type Coordinate = { i: number; j: number };
type Selection = readonly [Coordinate, Coordinate];

// unit step, e.g. { di: 1, dj: 0 } is ➡️
export type Direction = { di: number; dj: number };

/**
 * one column in the shared result: a word that was found, with how long it
 * took since the previous word (or since starting), or a miss
 */
export type ShareEvent =
  | { kind: "found"; direction: Direction | null; durationMs: number | null }
  | { kind: "miss"; direction: Direction };

const arrows: Record<string, string> = {
  "1,0": "➡️",
  "-1,0": "⬅️",
  "0,1": "⬇️",
  "0,-1": "⬆️",
  "1,1": "↘️",
  "-1,-1": "↖️",
  "1,-1": "↗️",
  "-1,1": "↙️",
};

const arrow = (direction: Direction | null) =>
  direction ? arrows[`${direction.di},${direction.dj}`] ?? "❔" : "❔";

const minute = 60 * 1000;

const tempo_square = (durationMs: number | null) => {
  if (durationMs === null) return "⬜";
  if (durationMs < 1 * minute) return "🟩";
  if (durationMs < 3 * minute) return "🟨";
  if (durationMs < 10 * minute) return "🟧";
  return "🟥";
};

const format_duration = (ms: number) => {
  const total_minutes = Math.max(1, Math.round(ms / minute));
  const hours = Math.floor(total_minutes / 60);
  const minutes = total_minutes % 60;
  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return `${hours} t`;
  return `${hours} t ${minutes} min`;
};

export const selection_direction = ([start, end]: Selection): Direction => ({
  di: Math.sign(end.i - start.i),
  dj: Math.sign(end.j - start.j),
});

/**
 * the direction the word is read in, which is the direction of the
 * selection unless the user dragged from the last letter to the first
 */
export const word_direction = (
  word: string,
  selection: Selection,
  letters: string[]
): Direction => {
  const { di, dj } = selection_direction(selection);
  return letters.join("") === word ? { di, dj } : { di: -di, dj: -dj };
};

/**
 * found words and misses in the order they happened. found words without
 * a timestamp (found before we recorded them) go last
 */
export const timeline = ({
  found,
  misses,
  startedAt,
}: {
  found: { at: number | undefined; direction: Direction | null }[];
  misses: { at: number; direction: Direction }[];
  startedAt: number;
}): ShareEvent[] => {
  const happened = [
    ...found
      .filter((f) => f.at !== undefined)
      .map((f) => ({ at: f.at as number, found: f })),
    ...misses.map((m) => ({ at: m.at, miss: m })),
  ].sort((a, b) => a.at - b.at);

  let previous_found = startedAt;
  const events: ShareEvent[] = happened.map((e) => {
    if ("miss" in e) return { kind: "miss", direction: e.miss.direction };
    const durationMs = Math.max(0, e.at - previous_found);
    previous_found = e.at;
    return { kind: "found", direction: e.found.direction, durationMs };
  });

  return [
    ...events,
    ...found
      .filter((f) => f.at === undefined)
      .map((f): ShareEvent => ({ kind: "found", direction: f.direction, durationMs: null })),
  ];
};

// so the two rows still line up when a chat app wraps long lines
const COLUMNS_PER_LINE = 10;

export const share_text = ({
  date,
  events,
  total,
  totalMs,
}: {
  // yyyy-mm-dd
  date: string;
  events: ShareEvent[];
  total: number;
  totalMs: number | null;
}) => {
  const [, month, day] = date.split("-");
  const found_count = events.filter((e) => e.kind === "found").length;
  const miss_count = events.length - found_count;

  const columns = [
    ...events.map((e) =>
      e.kind === "found"
        ? { top: arrow(e.direction), bottom: tempo_square(e.durationMs) }
        : { top: arrow(e.direction), bottom: "💥" }
    ),
    ...Array.from({ length: Math.max(0, total - found_count) }, () => ({
      top: "❌",
      bottom: "⬛",
    })),
  ];

  const lines: string[] = [];
  for (let k = 0; k < columns.length; k += COLUMNS_PER_LINE) {
    const chunk = columns.slice(k, k + COLUMNS_PER_LINE);
    if (k > 0) lines.push("");
    lines.push(chunk.map((c) => c.top).join(""));
    lines.push(chunk.map((c) => c.bottom).join(""));
  }

  const stats = [
    totalMs !== null ? `⏱ ${format_duration(totalMs)}` : null,
    miss_count === 0 ? "🎯 feilfritt" : null,
  ]
    .filter((x) => x !== null)
    .join(" · ");

  return [
    `Letekryss ${day}.${month}  ${found_count}/${total}`,
    "",
    ...lines,
    "",
    ...(stats ? [stats] : []),
    "letekryss.no",
  ].join("\n");
};
