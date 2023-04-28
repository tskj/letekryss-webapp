import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { v4 as uuidv4 } from "uuid";

import {
  array,
  boolean,
  DecoderFunction,
  decodeType,
  number,
  record,
  string,
  tuple,
} from "typescript-json-decoder";
import "./App.css";

// TODO: denne må bestemmes fra faktiske brettet eller backenden
const boardSize = 15;

var r = document.querySelector(":root") as any;
r.style.setProperty("--board-size", boardSize);
r.style.setProperty(
  "--letter-size",
  // plus 3 for three letter heights for fasit (should be enough)
  // 1 for header
  "clamp(20px, min(calc(100vh / (var(--board-size) + 3 + 1)), calc(100vw / (var(--board-size) + 1))), 50px)"
);

// used to disable mouse gestures
let thisIsATouchDevice = false;
// this will be set when clicking a letter
let calculatedSize = 0;

const classnames = (
  classes: Record<string, boolean>,
  ...moreClasses: string[]
) => {
  let cns = [];
  for (const [cn, t] of Object.entries(classes)) {
    if (t) {
      cns.push(cn);
    }
  }
  cns = cns.concat(moreClasses);
  return cns.join(" ");
};

const all_coordinates = ([start, end]: Selection) => {
  const dir_i = Math.sign(end.i - start.i);
  const dir_j = Math.sign(end.j - start.j);
  const len = Math.max(Math.abs(end.i - start.i), Math.abs(end.j - start.j));

  const coordinates = [];
  for (let k = 0; k <= len; k++) {
    coordinates.push({ i: start.i + dir_i * k, j: start.j + dir_j * k });
  }
  return coordinates;
};

const collect_letters = (board: string[][]) => (s: Selection) => {
  const all = all_coordinates(s);
  const letters = [];
  for (const { j, i } of all) {
    const row = board[j];
    if (row) {
      const letter = row[i];
      if (letter) letters.push(letter);
    }
  }
  return letters;
};

const alphabet = "abcdefghijklmnopqrstuvwxyzæøå".toUpperCase().split("");

const waitingLetter = alphabet[Math.floor(Math.random() * alphabet.length)];
const waitingBoard = Array.from({ length: 15 }).map(() =>
  Array.from({ length: 15 }).map(() => waitingLetter)
);

type Coordinate = {
  i: number;
  j: number;
};

const c_key = ({ i, j }: Coordinate) => `i:${i},j:${j}`;

const c_eq = (a: Coordinate, b: Coordinate) => a.i === b.i && a.j === b.j;
const s_eq =
  (a: readonly [Coordinate, Coordinate]) => (b: [Coordinate, Coordinate]) =>
    (c_eq(a[0], b[0]) && c_eq(a[1], b[1])) ||
    (c_eq(a[1], b[0]) && c_eq(a[0], b[1]));

const s_key = ([c1, c2]: Selection) => `start:${c_key(c1)};end:${c_key(c2)}`;

// TODO: move types and make decoders for all types
const coordinateDecoder = record({ i: number, j: number });

type Selection = decodeType<typeof selectionDecoder>;
const selectionDecoder = tuple(coordinateDecoder, coordinateDecoder);

type Selections = decodeType<typeof selectionsDecoder>;
const selectionsDecoder = array(selectionDecoder);

/** ================== use effect hook ================== */

/**
 * defaultValue has same semantics as regular intial value to
 * useState
 *
 * if key changes, stuff should update accordingly
 *
 * stuff is written to localStorage all the time, but only read when key changes
 * (and initial load)
 */
const usePersistenState = <T extends unknown>(
  key: string,
  defaultValue: T,
  decoder: DecoderFunction<T>
): [T, (v: T) => void] => {
  const [initialDefaultValue] = useState(defaultValue);

  const calcCurrentValue = useCallback(() => {
    const existingEncoded = localStorage.getItem(key);
    const existingValue =
      existingEncoded !== null ? decoder(JSON.parse(existingEncoded)) : null;
    return existingValue ?? initialDefaultValue;
  }, [key, initialDefaultValue, decoder]);

  const [state, setState] = useState(calcCurrentValue);

  // key's changed
  useEffect(() => {
    const v = calcCurrentValue();
    localStorage.setItem(key, JSON.stringify(v));
    setState(v);
  }, [key, calcCurrentValue]);

  return [
    state,
    useCallback(
      (value) => {
        localStorage.setItem(key, JSON.stringify(value));
        setState(value);
      },
      [key]
    ),
  ];
};

const useRerender = () => {
  const [, setB] = useState(false);
  return useCallback(() => setB((b) => !b), []);
};

/**
 * runs effect only once ever and only once bool becomes true
 */
const useEffectOnceWhen = (bool: boolean, cb: () => void) => {
  const hasRun = useRef(false);
  useEffect(() => {
    if (bool && !hasRun.current) {
      hasRun.current = true;
      cb();
    }
  }, [bool, cb]);
};

/** =================== */

const clamp_to_axis = (dx: number, dy: number) => {
  const centroid = (a: [number, number], b: [number, number]) =>
    [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] as const;
  const dist = (a: readonly [number, number], b: [number, number]) =>
    Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2);
  const clampToAxis = [
    [dx, 0],
    centroid([dx, dx], [dy, dy]),
    [0, dy],
    centroid([dx, -dx], [-dy, dy]),
  ] as const;

  let smallestDist = Infinity;
  let closestClamp: null | readonly [number, number] = null;
  for (const clamp of clampToAxis) {
    const d = dist(clamp, [dx, dy]);
    if (d < 50 && d <= smallestDist) {
      closestClamp = clamp;
      smallestDist = d;
    }
  }

  return closestClamp;
};

const logistic = (x: number) => {
  const ex = Math.exp(-10 * (x - 0.5));
  return 1 / (1 + ex);
};

/**
 * the point of this function is to normalize the
 * probability density function so that it always produces a
 * value in the range [0, 1)
 */
const normalizePdf =
  <T extends unknown>(f: (x: T) => number) =>
  (x: T): number => {
    const y = f(x);

    if (y < 0 || 1 <= y) {
      return normalizePdf(f)(x);
    }

    return y;
  };

/**
 * Box-Muller transformation
 */
const normalRandom = normalizePdf<{ mean: number; stdDev: number }>(
  ({ mean, stdDev }) => {
    const u1 = Math.random();
    const u2 = Math.random();

    const z1 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);

    return z1 * stdDev + mean;
  }
);

const memoize = <T extends unknown>(
  hash: (x: T) => string,
  f: (x: T) => number
) => {
  const cache = new Map<string, number>();
  return (x: T) => {
    const key = hash(x);
    if (cache.has(key)) {
      return cache.get(key) as number;
    } else {
      const v = f(x);
      cache.set(key, v);
      return v;
    }
  };
};

const fade_in_delay = memoize<{ bokstav: string; i: number; j: number }>(
  ({ bokstav, i, j }) => `${bokstav}:${i}:${j}`,
  Math.random
);

const celebration_delay = memoize<Coordinate>(
  ({ i, j }) => `${i}:${j}`,
  ({ i, j }) => {
    let z = (i - j + boardSize - 1) / boardSize;
    return 1 + 1.7 * logistic(z) + normalRandom({ mean: 0.5, stdDev: 0.4 });
  }
);

export const App = () => {
  const [userId] = usePersistenState("user-id", uuidv4(), string);

  const [isSelecting, setIsSelecting] = useState(false);
  const [start, setStart] = useState<Coordinate>({ i: -1, j: -1 });

  const [loading, setLoading] = useState(true);

  /**
   * we gotta delay fade-in of existing selections a little bit so they don't
   * jump around
   */
  const [animationLoadingDelay, setAnimationLoadingDelay] = useState(true);
  useEffect(() => {
    if (!loading && animationLoadingDelay) {
      setTimeout(() => {
        setAnimationLoadingDelay(false);
      }, 800);
    }
  }, [loading, animationLoadingDelay]);

  const [date, setDate] = useState("");
  const [brett, setBrett] = useState([]);
  useEffect(() => {
    fetch("https://letekryss-api.tskj.io/daily-board")
      .then((x) => x.json())
      .then((x) => {
        setBrett(x.board);
        setDate(x.date);
        setLoading(false);
      });
  }, []);

  /**
   * deselect with esc
   */
  useEffect(() => {
    const listener = (e: any) => {
      if (isSelecting && e.key === "Escape") {
        setIsSelecting(false);
      }
    };
    document.addEventListener("keydown", listener);
    return () => document.removeEventListener("keydown", listener);
  }, [isSelecting]);

  useEffect(() => {
    const listener = (e: any) => {
      if (
        e.target.contains &&
        e.target.contains(document.getElementsByClassName("grid")[0]) &&
        isSelecting
      ) {
        setIsSelecting(false);
      }
    };
    document.addEventListener("mouseup", listener);
    return () => document.removeEventListener("mouseup", listener);
  }, [isSelecting]);

  const [selections, setSelections] = usePersistenState<Selections>(
    "selection" + date,
    [],
    selectionsDecoder
  );

  /**
   * we go over the existing selections and compare them to the last selection
   * (last in list) to see if they overlap, in which case we either combine
   * them to make one longer selection, or we remove them completely
   */
  useLayoutEffect(() => {
    if (selections.length === 0) return;

    const forDeletion = new Set<string>();
    const forCreation: Selection[] = [];

    const selection_a = selections[selections.length - 1];

    const key_a = s_key(selection_a);

    const h = selection_a[1].j - selection_a[0].j;
    const w = selection_a[1].i - selection_a[0].i;
    const isSecondDiagonal =
      Math.sign(h) !== Math.sign(w) && h !== 0 && w !== 0;

    for (const selection_b of selections) {
      const key_b = s_key(selection_b);

      if (key_a === key_b) continue;

      const coordinates_a = all_coordinates(selection_a).map(c_key);
      const coordinates_b = all_coordinates(selection_b).map(c_key);

      if (coordinates_a.every((a) => coordinates_b.includes(a))) {
        forDeletion.add(key_a);
        forDeletion.add(key_b);

        continue;
      }

      const min_i = Math.min(
        ...selection_a.map((s) => s.i),
        ...selection_b.map((s) => s.i)
      );
      const min_j = Math.min(
        ...selection_a.map((s) => s.j),
        ...selection_b.map((s) => s.j)
      );
      const max_i = Math.max(
        ...selection_a.map((s) => s.i),
        ...selection_b.map((s) => s.i)
      );
      const max_j = Math.max(
        ...selection_a.map((s) => s.j),
        ...selection_b.map((s) => s.j)
      );

      const continuousStart = {
        i: min_i,
        j: !isSecondDiagonal ? min_j : max_j,
      };
      const continuousEnd = { i: max_i, j: !isSecondDiagonal ? max_j : min_j };

      const continuousLine = all_coordinates([
        continuousStart,
        continuousEnd,
      ]).map(c_key);

      // they're the same line essentially
      if (
        continuousLine.every(
          (c) => coordinates_a.includes(c) || coordinates_b.includes(c)
        ) &&
        coordinates_a.every((a) => continuousLine.includes(a)) &&
        coordinates_b.every((b) => continuousLine.includes(b))
      ) {
        forDeletion.add(key_a);
        forDeletion.add(key_b);
        forCreation.push([continuousStart, continuousEnd]);
      }
    }

    if (forDeletion.size > 0) {
      const afterDeletion = selections.filter(
        (s) => !forDeletion.has(s_key(s))
      );
      if (forCreation.length > 0) {
        setSelections(afterDeletion.concat(forCreation));
      } else setSelections(afterDeletion);
    }
  }, [selections, setSelections]);

  const refs = useRef<Record<string, HTMLDivElement>>({});
  const selectionRefs = useRef<Record<string, HTMLDivElement>>({});

  type MousePos = { clientX: number; clientY: number };
  const mouseCoord_start = useRef<MousePos>(null);
  const mouseCoord = useRef<MousePos>(null);
  const update = useRef<(m: MousePos) => void>(() => {});
  (update.current as any) = () => {};
  useEffect(() => {
    document.addEventListener("mousemove", (e) => {
      (mouseCoord.current as any) = { clientX: e.clientX, clientY: e.clientY };
      update.current({ clientX: e.clientX, clientY: e.clientY });
    });
  }, []);
  useEffect(() => {
    document.addEventListener("touchstart", (e) => {
      (mouseCoord.current as any) = {
        clientX: e.touches[0].clientX,
        clientY: e.touches[0].clientY,
      };
    });
  }, []);

  useEffect(() => {
    document.addEventListener("touchmove", (e) => {
      e.preventDefault();
      (mouseCoord.current as any) = {
        clientX: e.touches[0].clientX,
        clientY: e.touches[0].clientY,
      };
      update.current({
        clientX: e.touches[0].clientX,
        clientY: e.touches[0].clientY,
      });
    });
  }, []);

  const [shouldShowCheckFasit, setShouldShowCheckFasit] = useState(false);
  const [startedAt, setStartedAt] = useState<Date>(new Date());
  useEffect(() => {
    const now = new Date();
    const hoursUntilSevenPm = 19 - now.getHours();
    const ms_until_15_minutes_after_start =
      startedAt.getTime() + 15 * 60 * 1000 - now.getTime();

    const timeUntilAllowed = Math.max(
      hoursUntilSevenPm * 60 * 60 * 1000,
      ms_until_15_minutes_after_start
    );
    const timeout = setTimeout(() => {
      setShouldShowCheckFasit(true);
    }, timeUntilAllowed);
    return () => clearTimeout(timeout);
  }, [startedAt]);

  const [isDone, setIsDone] = usePersistenState(
    "has-completed:" + date,
    false,
    boolean
  );
  const [isCelebrating, setIsCelebrating] = useState(false);
  const [fasit, setFasit] = useState<string[]>([]);
  const fasitUnracer = useRef(0);
  useEffect(() => {
    const found_words = selections.map(collect_letters(brett));
    const body = JSON.stringify(
      found_words.flatMap((x) => [x.join(""), x.reverse().join("")])
    );
    fasitUnracer.current++;
    const thisRacer = fasitUnracer.current;
    fetch(
      `https://letekryss-api.tskj.io/check-solution/${date}?userId=${userId}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body,
      }
    )
      .then((x) => x.json())
      .then((x) => {
        if (fasitUnracer.current === thisRacer) {
          setFasit(x.correct);
          if (x.startedAt) setStartedAt(new Date(x.startedAt ?? null));

          // TODO: send actual number from backend
          if (x.correct.length === 10) {
            if (!isDone) setIsCelebrating(true);
            setIsDone(true);
          }
        }
      });
  }, [brett, date, selections, userId, isDone, setIsDone]);

  const rerender = useRerender();
  useEffect(() => {
    window.onresize = () => {
      rerender();
    };
  }, [rerender]);

  const gridRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;

    let x = grid.getBoundingClientRect().x;
    let y = grid.getBoundingClientRect().y;

    for (const div of Object.values(selectionRefs.current ?? {})) {
      div.style.top = "0";
      div.style.left = "0";
    }

    const onscroll = () => {
      const dx = grid.getBoundingClientRect().x - x;
      const dy = grid.getBoundingClientRect().y - y;

      for (const div of Object.values(selectionRefs.current ?? {})) {
        div.style.top = `${dy}px`;
        div.style.left = `${dx}px`;
      }
    };

    window.addEventListener("scroll", onscroll);
    return () => window.removeEventListener("scroll", onscroll);
  });

  const giveup = () => {
    setIsDone(true);
  };

  const [givenUpWords_selections, setGivenUpWords_selections] = useState<
    Selection[]
  >([]);
  const [givenUpWords, setGivenUpWords] = useState<string[]>([]);
  useEffectOnceWhen(
    !loading && isDone && !isCelebrating && fasit.length > 0,
    async () => {
      const d = await fetch(
        `https://letekryss-api.tskj.io/solution?userId=${userId}`
      )
        .then((x) => x.json())
        .then(array(string));

      const givenUpWords = d.filter((x) => !fasit.includes(x));
      setGivenUpWords(givenUpWords);

      const givenUpWords_both = givenUpWords.concat(
        givenUpWords.map((s) => s.split("").reverse().join(""))
      );

      const selections: Selection[] = [];

      Array.from({ length: boardSize })
        .map((_, j) => j)
        .forEach((j) => {
          Array.from({ length: boardSize })
            .map((_, i) => i)
            .forEach((i) => {
              Array.from({ length: boardSize - 1 })
                .map((_, k) => k + 1)
                .forEach((k) => {
                  const rowSelection: Selection = [
                    { i, j },
                    { i: i + k, j },
                  ];
                  const colSelection: Selection = [
                    { i, j },
                    { i, j: j + k },
                  ];
                  const diaSelection: Selection = [
                    { i, j },
                    { i: i + k, j: j + k },
                  ];

                  const row = collect_letters(brett)(rowSelection);
                  const col = collect_letters(brett)(colSelection);
                  const dia = collect_letters(brett)(diaSelection);

                  if (givenUpWords_both.includes(row.join("")))
                    selections.push(rowSelection);
                  if (givenUpWords_both.includes(col.join("")))
                    selections.push(colSelection);
                  if (givenUpWords_both.includes(dia.join("")))
                    selections.push(diaSelection);
                });
            });
        });

      setGivenUpWords_selections(selections);
    }
  );

  return (
    <div className="App">
      <header className="App-header">
        <div className="selections">
          {[
            ...selections,
            ...(isSelecting ? [[start, { i: -1, j: -1 }]] : []),
          ].map(([selectionStart, selectionEnd]) => {
            const start =
              refs.current?.[c_key(selectionStart)]?.getBoundingClientRect();
            const radius = (start.bottom - start.top) / 2;
            const end = refs.current?.[
              c_key(selectionEnd)
            ]?.getBoundingClientRect() ?? {
              top: (mouseCoord.current?.clientY ?? 0) - radius,
              left: (mouseCoord.current?.clientX ?? 0) - radius,
            };

            if (!start || !end) return null;

            const dy = end.top - start.top;
            const dx = end.left - start.left;

            const calc = (dx: number, dy: number) => {
              const closestClamp = clamp_to_axis(dx, dy);
              if (closestClamp) {
                dx = closestClamp[0];
                dy = closestClamp[1];
              }

              const length = Math.sqrt(dx ** 2 + dy ** 2);
              const orientation = Math.atan2(dy, dx) - Math.PI / 2;

              const transform = `rotate(${orientation}rad) translateY(${-radius}px)`;
              return { length, transform };
            };

            const { length, transform } = calc(dx, dy);

            const k = c_key(selectionStart) + c_key(selectionEnd);
            const is_active_drag =
              selectionEnd.i === -1 && selectionEnd.j === -1;

            return (
              <Fragment key={k}>
                <svg width="0" height="0">
                  <defs>
                    <clipPath id={"capsule" + k}>
                      <circle cx={radius} cy={radius} r={radius} />
                      <rect
                        ref={(x) => {
                          if (!x) return;
                          if (!is_active_drag) return;

                          const f = update.current;
                          const new_f = (m: MousePos) => {
                            f(m);
                            const { length } = calc(
                              m.clientX - start.left - radius,
                              m.clientY - start.top - radius
                            );
                            x.setAttribute("height", `${length}px`);
                          };
                          update.current = new_f;
                        }}
                        x="0"
                        y={radius}
                        width={2 * radius}
                        height={length}
                      />
                      <circle
                        ref={(x) => {
                          if (!x) return;
                          if (!is_active_drag) return;

                          const f = update.current;
                          const new_f = (m: MousePos) => {
                            f(m);
                            const { length } = calc(
                              m.clientX - start.left - radius,
                              m.clientY - start.top - radius
                            );
                            x.setAttribute("cy", `${length + radius}`);
                          };
                          update.current = new_f;
                        }}
                        cx={radius}
                        cy={length + radius}
                        r={radius}
                      />
                    </clipPath>
                  </defs>
                </svg>
                <div
                  style={{ position: "fixed" }}
                  ref={(r) => {
                    if (r && selectionRefs.current)
                      selectionRefs.current[
                        s_key([selectionStart, selectionEnd])
                      ] = r;
                  }}
                >
                  <div
                    className="selection-firkant"
                    style={{
                      top: start.top + radius,
                      left: start.left,
                      height: length + 2 * radius,
                      transform: !animationLoadingDelay ? transform : "",
                    }}
                    ref={(x) => {
                      if (!x) return;
                      if (!is_active_drag) return;

                      const f = update.current;
                      const new_f = (m: MousePos) => {
                        f(m);
                        const { length, transform } = calc(
                          m.clientX - start.left - radius,
                          m.clientY - start.top - radius
                        );
                        x.style.height = `${length + 2 * radius}px`;
                        x.style.transform = transform;
                      };
                      update.current = new_f;
                    }}
                  >
                    <div
                      // må deles opp for å unngå rendering artifacts i firefox
                      className={classnames(
                        {
                          "selection-hidden": loading || animationLoadingDelay,
                          "selection-not-hidden": !(
                            loading || animationLoadingDelay
                          ),
                        },
                        "selection-capsule"
                      )}
                      style={{
                        clipPath: `url(#${"capsule" + k})`,
                      }}
                    />
                  </div>
                </div>
              </Fragment>
            );
          })}
        </div>
        <div className="grid" ref={gridRef}>
          {(loading ? waitingBoard : brett).flatMap((row, j) =>
            row.map((bokstav, i) => {
              const inside_selections = selections.filter(([a, b]) =>
                all_coordinates([a, b]).find((c) => c.i === i && c.j === j)
              );

              const selected =
                inside_selections
                  .map(collect_letters(brett))
                  .flatMap((x) => [x.join(""), x.reverse().join("")])
                  .some((x) => fasit.includes(x)) ||
                givenUpWords_selections
                  .flatMap(all_coordinates)

                  .some((x) => x.i === i && x.j === j);

              const r = fade_in_delay({ bokstav, i, j });
              const r_c = celebration_delay({ i, j });

              return (
                <div
                  ref={(ref) => {
                    if (ref && refs.current)
                      refs.current[c_key({ i, j })] = ref;
                  }}
                  key={c_key({ i, j })}
                  style={
                    loading
                      ? {}
                      : !isCelebrating
                      ? {
                          animation: "spin 0.4s linear forwards",
                          animationDelay: `${0.3 * r}s`,
                        }
                      : {
                          animation: "celebration 1.8s linear forwards",
                          animationDelay: `${0.4 * r_c}s`,
                        }
                  }
                  className={classnames(
                    {
                      loading: loading,
                      loaded: !loading && !isDone,
                      celebrating: isCelebrating,
                    },
                    "bokstav"
                  )}
                  onMouseDown={(e) => {
                    if (thisIsATouchDevice) return;

                    (mouseCoord.current as any) = {
                      clientX: e.clientX,
                      clientY: e.clientY,
                    };

                    if (isSelecting) {
                      const touch = e;
                      let touchX = touch.clientX;
                      let touchY = touch.clientY;

                      const begin_drag = mouseCoord_start.current;
                      if (begin_drag) {
                        const clamp = clamp_to_axis(
                          touchX - begin_drag.clientX,
                          touchY - begin_drag.clientY
                        );
                        if (clamp) {
                          touchX =
                            begin_drag.clientX +
                            Math.round(clamp[0] / calculatedSize) *
                              calculatedSize;
                          touchY =
                            begin_drag.clientY +
                            Math.round(clamp[1] / calculatedSize) *
                              calculatedSize;
                        }
                      }

                      const element = document.elementFromPoint(
                        touchX,
                        touchY
                      ) as HTMLDivElement;

                      if (element) {
                        const str_i =
                          element.getAttribute("data-i") ??
                          element.offsetParent?.getAttribute("data-i") ??
                          "-1";
                        const n_i = parseInt(str_i, 10);
                        const str_j =
                          element.getAttribute("data-j") ??
                          element.offsetParent?.getAttribute("data-j") ??
                          "-1";
                        const n_j = parseInt(str_j, 10);
                        if (n_i !== -1 && n_j !== -1) {
                          i = n_i;
                          j = n_j;
                        }
                      }
                    }

                    if (!isSelecting) {
                      const bounding = document
                        .elementFromPoint(
                          mouseCoord.current?.clientX ?? -1,
                          mouseCoord.current?.clientY ?? -1
                        )
                        ?.getBoundingClientRect();

                      if (bounding) {
                        const top = bounding.top;
                        const left = bounding.left;
                        const width = bounding.width;
                        const height = bounding.height;

                        calculatedSize = width;

                        (mouseCoord_start.current as any) = {
                          clientX: left + width / 2,
                          clientY: top + height / 2,
                        };
                      }
                    }

                    if (!isSelecting) {
                      setIsSelecting(true);
                      setStart({ i, j });
                    } else if (c_eq(start, { i, j })) {
                      setIsSelecting(false);
                    }
                  }}
                  onMouseUp={(e) => {
                    if (thisIsATouchDevice) return;

                    const touch = e;
                    let touchX = touch.clientX;
                    let touchY = touch.clientY;

                    const begin_drag = mouseCoord_start.current;
                    if (begin_drag) {
                      const clamp = clamp_to_axis(
                        touchX - begin_drag.clientX,
                        touchY - begin_drag.clientY
                      );
                      if (clamp) {
                        touchX =
                          begin_drag.clientX +
                          Math.round(clamp[0] / calculatedSize) *
                            calculatedSize;
                        touchY =
                          begin_drag.clientY +
                          Math.round(clamp[1] / calculatedSize) *
                            calculatedSize;
                      }
                    }

                    const element = document.elementFromPoint(
                      touchX,
                      touchY
                    ) as HTMLDivElement;

                    if (element) {
                      const str_i =
                        element.getAttribute("data-i") ??
                        element.offsetParent?.getAttribute("data-i") ??
                        "-1";
                      const n_i = parseInt(str_i, 10);
                      const str_j =
                        element.getAttribute("data-j") ??
                        element.offsetParent?.getAttribute("data-j") ??
                        "-1";
                      const n_j = parseInt(str_j, 10);
                      if (n_i !== -1 && n_j !== -1) {
                        i = n_i;
                        j = n_j;
                      }
                    }

                    const not_on_start = i !== start.i || j !== start.j;
                    const is_on_diagonal_or_straight =
                      i === start.i ||
                      j === start.j ||
                      Math.abs(i - start.i) === Math.abs(j - start.j);

                    if (!is_on_diagonal_or_straight) {
                      setIsSelecting(false);
                      return;
                    }

                    if (not_on_start && isSelecting) {
                      setIsSelecting(false);

                      if (isDone) return;

                      const new_selection: [Coordinate, Coordinate] = [
                        start,
                        { i, j },
                      ];

                      const selection_exists = selections.some(
                        s_eq(new_selection)
                      );
                      if (selection_exists) {
                        setSelections([
                          ...selections.filter((s) => !s_eq(new_selection)(s)),
                        ]);
                      } else {
                        setSelections([...selections, new_selection]);
                      }
                    }
                  }}
                  onTouchStart={(e) => {
                    (mouseCoord.current as any) = {
                      clientX: e.touches[0].clientX,
                      clientY: e.touches[0].clientY,
                    };

                    const bounding = document
                      .elementFromPoint(
                        mouseCoord.current?.clientX ?? -1,
                        mouseCoord.current?.clientY ?? -1
                      )
                      ?.getBoundingClientRect();

                    if (bounding) {
                      const top = bounding.top;
                      const left = bounding.left;
                      const width = bounding.width;
                      const height = bounding.height;

                      calculatedSize = width;

                      (mouseCoord_start.current as any) = {
                        clientX: left + width / 2,
                        clientY: top + height / 2,
                      };
                    }

                    // Add a class to the body with the required CSS to disable scrolling
                    document.body.classList.add("disable-scrolling");
                    thisIsATouchDevice = true;

                    if (!isSelecting) {
                      setIsSelecting(true);
                      setStart({ i, j });
                    } else if (c_eq(start, { i, j })) {
                      setIsSelecting(false);
                    }
                  }}
                  data-i={i}
                  data-j={j}
                  onTouchEnd={async (e) => {
                    const touch = e.changedTouches[0];
                    let touchX = touch.clientX;
                    let touchY = touch.clientY;

                    const begin_drag = mouseCoord_start.current;
                    if (begin_drag) {
                      const clamp =
                        mouseCoord_start.current &&
                        clamp_to_axis(
                          touchX - mouseCoord_start.current?.clientX,
                          touchY - mouseCoord_start.current.clientY
                        );
                      if (clamp) {
                        touchX =
                          begin_drag.clientX +
                          Math.round(clamp[0] / calculatedSize) *
                            calculatedSize;
                        touchY =
                          begin_drag.clientY +
                          Math.round(clamp[1] / calculatedSize) *
                            calculatedSize;
                      }
                    }

                    await new Promise((res) => setTimeout(res, 0));

                    // Find the element under the user's finger when the touch ends
                    const element = document.elementFromPoint(
                      touchX,
                      touchY
                    ) as HTMLDivElement;

                    const str_i =
                      element?.getAttribute("data-i") ??
                      element?.offsetParent?.getAttribute("data-i") ??
                      "-1";
                    const n_i = parseInt(str_i, 10);
                    const str_j =
                      element?.getAttribute("data-j") ??
                      element?.offsetParent?.getAttribute("data-j") ??
                      "-1";
                    const n_j = parseInt(str_j, 10);
                    i = n_i;
                    j = n_j;
                    /** ^^ above hacks needed because onTouchEnd fires on
                     * same element as you start dragging, not where you let go */

                    if (i === -1 || j === -1) {
                      setIsSelecting(false);
                      return;
                    }

                    const on_start = i === start.i && j === start.j;
                    const is_on_diagonal_or_straight =
                      i === start.i ||
                      j === start.j ||
                      Math.abs(i - start.i) === Math.abs(j - start.j);

                    if (!is_on_diagonal_or_straight || on_start) {
                      setIsSelecting(false);
                      return;
                    }

                    if (isSelecting) {
                      setIsSelecting(false);

                      if (isDone) return;

                      const new_selection: [Coordinate, Coordinate] = [
                        start,
                        { i, j },
                      ];

                      const selection_exists = selections.some(
                        s_eq(new_selection)
                      );
                      if (selection_exists) {
                        setSelections([
                          ...selections.filter((s) => !s_eq(new_selection)(s)),
                        ]);
                      } else {
                        setSelections([...selections, new_selection]);
                      }
                    }
                  }}
                >
                  <div
                    ref={(bokstavDiv) => {
                      if (!loading) {
                        setTimeout(() => {
                          if (bokstavDiv) bokstavDiv.innerText = bokstav;
                        }, r * 300 + 400 / 2);
                      }
                    }}
                    className={classnames({
                      selected: selected && !loading && !animationLoadingDelay,
                    })}
                  >
                    {waitingLetter}
                  </div>
                </div>
              );
            })
          )}
        </div>
        <div className="fasit-container">
          <div className="fasit">
            {fasit.map((f, i) => (
              <div
                key={f}
                style={{
                  animationDelay: `calc(${i} * 0.1s)`,
                }}
              >
                {f}
              </div>
            ))}
            {givenUpWords.map((g, i) => (
              <div
                key={g}
                style={{
                  color: "red",
                  animationDelay: `calc(${i + fasit.length} * 0.3s)`,
                }}
              >
                {g}
              </div>
            ))}
          </div>
        </div>
        <button
          className={classnames(
            {
              show:
                !isDone &&
                !loading &&
                !animationLoadingDelay &&
                fasit.length > 0 &&
                shouldShowCheckFasit,
            },
            "giveup-button"
          )}
          onClick={giveup}
        >
          SJEKK FASIT
        </button>
      </header>
    </div>
  );
};
