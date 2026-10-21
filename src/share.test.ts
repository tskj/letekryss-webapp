import { found_words_in_order, share_text, word_direction } from "./share";

const min = 60 * 1000;

test("word direction follows the word, not the drag", () => {
  const selection = [
    { i: 0, j: 0 },
    { i: 3, j: 3 },
  ] as const;
  expect(word_direction("HEST", selection, ["H", "E", "S", "T"])).toEqual({
    di: 1,
    dj: 1,
  });
  // dragged from the last letter to the first
  expect(word_direction("HEST", selection, ["T", "S", "E", "H"])).toEqual({
    di: -1,
    dj: -1,
  });
});

test("words are ordered by when they were found, with time since previous", () => {
  const found = found_words_in_order(
    ["B", "A", "C"],
    { A: 30 * 1000, B: 5 * min, C: 20 * min },
    0,
    () => ({ di: 1, dj: 0 })
  );
  expect(found.map((f) => f.durationMs)).toEqual([
    30 * 1000,
    5 * min - 30 * 1000,
    15 * min,
  ]);
});

test("share text has a direction row and a tempo row of the same length", () => {
  const text = share_text({
    date: "2026-10-21",
    found: [
      { direction: { di: 1, dj: 0 }, durationMs: 30 * 1000 },
      { direction: { di: 0, dj: 1 }, durationMs: 2 * min },
      { direction: { di: -1, dj: 1 }, durationMs: 5 * min },
      { direction: { di: -1, dj: -1 }, durationMs: 12 * min },
      { direction: { di: 1, dj: -1 }, durationMs: null },
    ],
    total: 7,
    totalMs: 83 * min,
    misses: 3,
  });

  expect(text).toBe(
    [
      "Letekryss 21.10  5/7",
      "",
      "➡️⬇️↙️↖️↗️❌❌",
      "🟩🟨🟧🟥⬜⬛⬛",
      "",
      "⏱ 1 t 23 min · 🎯 3 bom",
      "letekryss.no",
    ].join("\n")
  );
});
