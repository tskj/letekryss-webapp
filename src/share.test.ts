import { share_text, timeline, word_direction } from "./share";

const min = 60 * 1000;
const right = { di: 1, dj: 0 };
const down = { di: 0, dj: 1 };
const up_left = { di: -1, dj: -1 };

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

test("the timeline mixes found words and misses in the order they happened", () => {
  const events = timeline({
    found: [
      { at: 5 * min, direction: down },
      { at: 30 * 1000, direction: right },
      { at: undefined, direction: up_left },
    ],
    misses: [{ at: 2 * min, direction: up_left }],
    startedAt: 0,
  });

  expect(events).toEqual([
    { kind: "found", direction: right, durationMs: 30 * 1000 },
    { kind: "miss", direction: up_left },
    // a word's time is counted from the previous word, misses included
    { kind: "found", direction: down, durationMs: 5 * min - 30 * 1000 },
    // no timestamp, so it goes last
    { kind: "found", direction: up_left, durationMs: null },
  ]);
});

test("share text has arrows over tempo squares, with misses in between", () => {
  const text = share_text({
    date: "2026-10-21",
    events: [
      { kind: "found", direction: right, durationMs: 30 * 1000 },
      { kind: "miss", direction: { di: -1, dj: 0 } },
      { kind: "found", direction: down, durationMs: 2 * min },
      { kind: "found", direction: { di: -1, dj: 1 }, durationMs: 5 * min },
      { kind: "found", direction: up_left, durationMs: 12 * min },
      { kind: "found", direction: { di: 1, dj: -1 }, durationMs: null },
    ],
    total: 7,
    totalMs: 83 * min,
  });

  expect(text).toBe(
    [
      "Letekryss 21.10  5/7",
      "",
      "➡️⬅️⬇️↙️↖️↗️❌❌",
      "🟩💥🟨🟧🟥⬜⬛⬛",
      "",
      "⏱ 1 t 23 min",
      "letekryss.no",
    ].join("\n")
  );
});

test("long results are split evenly into lines of at most 10, keeping the rows lined up", () => {
  const text = share_text({
    date: "2026-10-21",
    events: [
      ...Array.from({ length: 4 }, () => ({ kind: "miss" as const, direction: down })),
      ...Array.from({ length: 10 }, () => ({ kind: "found" as const, direction: right, durationMs: 0 })),
    ],
    total: 10,
    totalMs: null,
  });

  expect(text.split("\n")).toEqual([
    "Letekryss 21.10  10/10",
    "",
    "⬇️⬇️⬇️⬇️➡️➡️➡️",
    "💥💥💥💥🟩🟩🟩",
    "",
    "➡️➡️➡️➡️➡️➡️➡️",
    "🟩🟩🟩🟩🟩🟩🟩",
    "",
    "letekryss.no",
  ]);
});

test("no misses is worth mentioning", () => {
  const text = share_text({
    date: "2026-10-21",
    events: [{ kind: "found", direction: right, durationMs: 0 }],
    total: 1,
    totalMs: 3 * min,
  });
  expect(text.split("\n").at(-2)).toBe("⏱ 3 min · 🎯 feilfritt");
});
