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
const COLUMNS_PER_LINE = 12;

export const share_text = ({
  date,
  events,
  total,
  inProgress = false,
}: {
  // yyyy-mm-dd
  date: string;
  events: ShareEvent[];
  total: number;
  // shared before finishing
  inProgress?: boolean;
}) => {
  const [, month, day] = date.split("-");
  const found_count = events.filter((e) => e.kind === "found").length;

  const columns = [
    ...events.map((e) =>
      e.kind === "found"
        ? { top: arrow(e.direction), bottom: tempo_square(e.durationMs) }
        : { top: arrow(e.direction), bottom: "❌" }
    ),
    // mid-game the header's count says how many are left, so only a
    // finished game marks the words that were never found
    ...Array.from(
      { length: inProgress ? 0 : Math.max(0, total - found_count) },
      () => ({ top: "🙈", bottom: "⬛" })
    ),
  ];

  // as few lines as fit, with the columns spread evenly across them, so a
  // single miss doesn't push one lonely column onto a line of its own
  const line_count = Math.ceil(columns.length / COLUMNS_PER_LINE);
  const per_line = Math.ceil(columns.length / line_count);
  const lines: string[] = [];
  for (let k = 0; k < columns.length; k += per_line) {
    const chunk = columns.slice(k, k + per_line);
    if (k > 0) lines.push("");
    lines.push(chunk.map((c) => c.top).join(""));
    lines.push(chunk.map((c) => c.bottom).join(""));
  }

  // the address doubles as the title, so the share links back to the game
  return [
    `https://letekryss.no ${day}.${month}  ${found_count}/${total}`,
    "",
    ...lines,
  ].join("\n");
};

/**
 * 83456 ms is "1:23,4", the tenths with a norwegian decimal comma
 */
export const format_time = (ms: number) => {
  const tenths = Math.floor(ms / 100);
  const minutes = Math.floor(tenths / 600);
  const seconds = Math.floor(tenths / 10) % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")},${tenths % 10}`;
};

/**
 * lyn has one word, so the result is the time, with the misses before it: a
 * trap is a miss on one of the decoys. no arrows, the way the word goes would
 * give it away
 */
export const lyn_share_text = ({
  date,
  timeMs,
  misses,
  gaveUp,
  vrien = false,
}: {
  // yyyy-mm-dd
  date: string;
  timeMs: number | null;
  misses: ("miss" | "trap")[];
  gaveUp: boolean;
  vrien?: boolean;
}) => {
  const [, month, day] = date.split("-");
  const result = gaveUp ? "🏳️" : timeMs !== null ? `⚡ ${format_time(timeMs)}` : "⏱️";

  const marks = [
    // a miss on a decoy goes off
    ...misses.map((m) => (m === "trap" ? "💥" : "❌")),
    ...(gaveUp ? ["⬛"] : timeMs !== null ? ["🟩"] : []),
  ];

  return [
    `https://letekryss.no/lyn${vrien ? "/vrien" : ""} ${day}.${month}  ${result}`,
    ...(marks.length > 0 ? ["", marks.join("")] : []),
  ].join("\n");
};
