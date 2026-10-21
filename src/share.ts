type Coordinate = { i: number; j: number };
type Selection = readonly [Coordinate, Coordinate];

export type FoundWord = {
  // unit step from the word's first letter to its last, e.g. { di: 1, dj: 0 } is ➡️
  direction: { di: number; dj: number } | null;
  // how long this word took, since the previous word (or since starting)
  durationMs: number | null;
};

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

/**
 * the direction the word is read in, which is the direction of the
 * selection unless the user dragged from the last letter to the first
 */
export const word_direction = (
  word: string,
  selection: Selection,
  letters: string[]
) => {
  const [start, end] = selection;
  const di = Math.sign(end.i - start.i);
  const dj = Math.sign(end.j - start.j);
  return letters.join("") === word ? { di, dj } : { di: -di, dj: -dj };
};

/**
 * found words in the order they were found, each with how long it took,
 * so that we can show how the game went without spoiling the words
 */
export const found_words_in_order = (
  words: string[],
  foundAt: Record<string, number>,
  startedAt: number,
  direction_of: (word: string) => FoundWord["direction"]
): FoundWord[] => {
  const sorted = [...words].sort(
    (a, b) => (foundAt[a] ?? Infinity) - (foundAt[b] ?? Infinity)
  );

  let previous = startedAt;
  return sorted.map((word) => {
    const at = foundAt[word];
    const durationMs = at === undefined ? null : Math.max(0, at - previous);
    if (at !== undefined) previous = at;
    return { direction: direction_of(word), durationMs };
  });
};

export const share_text = ({
  date,
  found,
  total,
  totalMs,
  misses,
}: {
  // yyyy-mm-dd
  date: string;
  found: FoundWord[];
  total: number;
  totalMs: number | null;
  misses: number;
}) => {
  const [, month, day] = date.split("-");
  const not_found = Math.max(0, total - found.length);

  const direction_row =
    found
      .map((f) =>
        f.direction ? arrows[`${f.direction.di},${f.direction.dj}`] ?? "❔" : "❔"
      )
      .join("") + "❌".repeat(not_found);

  const tempo_row =
    found.map((f) => tempo_square(f.durationMs)).join("") +
    "⬛".repeat(not_found);

  const stats = [
    totalMs !== null ? `⏱ ${format_duration(totalMs)}` : null,
    `🎯 ${misses} bom`,
  ]
    .filter((x) => x !== null)
    .join(" · ");

  return [
    `Letekryss ${day}.${month}  ${found.length}/${total}`,
    "",
    direction_row,
    tempo_row,
    "",
    stats,
    "letekryss.no",
  ].join("\n");
};
