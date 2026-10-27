import { share_text, timeline, word_direction, format_time, lyn_share_text } from "./share";

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
  });

  expect(text).toBe(
    [
      "https://letekryss.no 21.10  5/7",
      "",
      "➡️⬅️⬇️↙️↖️↗️🙈🙈",
      "🟩❌🟨🟧🟥⬜⬛⬛",
    ].join("\n")
  );
});

test("long results are split evenly into lines of at most 12, keeping the rows lined up", () => {
  const text = share_text({
    date: "2026-10-21",
    events: [
      ...Array.from({ length: 4 }, () => ({ kind: "miss" as const, direction: down })),
      ...Array.from({ length: 10 }, () => ({ kind: "found" as const, direction: right, durationMs: 0 })),
    ],
    total: 10,
  });

  expect(text.split("\n")).toEqual([
    "https://letekryss.no 21.10  10/10",
    "",
    "⬇️⬇️⬇️⬇️➡️➡️➡️",
    "❌❌❌❌🟩🟩🟩",
    "",
    "➡️➡️➡️➡️➡️➡️➡️",
    "🟩🟩🟩🟩🟩🟩🟩",
  ]);
});

test("a full game with a miss or two still fits on one line", () => {
  const text = share_text({
    date: "2026-10-21",
    events: [
      { kind: "miss", direction: down },
      { kind: "miss", direction: down },
      ...Array.from({ length: 10 }, () => ({ kind: "found" as const, direction: right, durationMs: 0 })),
    ],
    total: 10,
  });
  expect(text.split("\n").slice(2, 4)).toEqual([
    "⬇️⬇️➡️➡️➡️➡️➡️➡️➡️➡️➡️➡️",
    "❌❌🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩",
  ]);
});

test("a result shared mid-game shows only what happened", () => {
  const text = share_text({
    date: "2026-10-21",
    events: [{ kind: "found", direction: right, durationMs: 0 }],
    total: 10,
    inProgress: true,
  });
  expect(text.split("\n")).toEqual([
    "https://letekryss.no 21.10  1/10",
    "",
    // no columns for the words not found yet
    "➡️",
    "🟩",
  ]);
});

test("times are minutes, seconds and tenths", () => {
  expect(format_time(0)).toBe("0:00,0");
  expect(format_time(9_999)).toBe("0:09,9");
  expect(format_time(83_456)).toBe("1:23,4");
  expect(format_time(61 * 60_000)).toBe("61:00,0");
});

test("a lyn result is the time, with the misses before it", () => {
  const text = lyn_share_text({
    date: "2026-10-27",
    timeMs: 42_300,
    misses: ["miss", "trap"],
    gaveUp: false,
  });
  // no arrows, the way the word goes would give it away
  expect(text.split("\n")).toEqual([
    "https://letekryss.no/lyn 27.10  ⚡ 0:42,3",
    "",
    "❌💥🟩",
  ]);
});

test("vrien links to vrien", () => {
  const text = lyn_share_text({
    date: "2026-10-27",
    timeMs: 42_300,
    misses: [],
    gaveUp: false,
    vrien: true,
  });
  expect(text.split("\n").at(0)).toBe("https://letekryss.no/lyn/vrien 27.10  ⚡ 0:42,3");
});

test("a lyn given up has no time", () => {
  const text = lyn_share_text({
    date: "2026-10-27",
    timeMs: null,
    misses: [],
    gaveUp: true,
  });
  expect(text.split("\n")).toEqual([
    "https://letekryss.no/lyn 27.10  🏳️",
    "",
    "⬛",
  ]);
});
