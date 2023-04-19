import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";

import {
  array,
  DecoderFunction,
  decodeType,
  number,
  record,
  string,
} from "typescript-json-decoder";
import "./App.css";

var r = document.querySelector(":root") as any;
r.style.setProperty("--board-size", 15);
r.style.setProperty("--letter-size", "50px");

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

const all_coordinates = ([start, end]: [Coordinate, Coordinate]) => {
  const dir_i = Math.sign(end.i - start.i);
  const dir_j = Math.sign(end.j - start.j);
  const len = Math.max(Math.abs(end.i - start.i), Math.abs(end.j - start.j));

  const coordinates = [];
  for (let k = 0; k <= len; k++) {
    coordinates.push({ i: start.i + dir_i * k, j: start.j + dir_j * k });
  }
  return coordinates;
};

const collect_letters =
  (board: string[][]) => (s: [Coordinate, Coordinate]) => {
    const all = all_coordinates(s);
    const letters = [];
    for (const { j, i } of all) {
      letters.push(board[j][i]);
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

// TODO: move types and make decoders for all types
const coordinateDecoder = record({ i: number, j: number });

type Selection = decodeType<typeof selectionDecoder>;
const selectionDecoder = array([coordinateDecoder, coordinateDecoder]);

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
    (value) => {
      localStorage.setItem(key, JSON.stringify(value));
      setState(value);
    },
  ];
};

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

  const [selections, setSelections] = usePersistenState<Selection>(
    "selection" + date,
    [],
    selectionDecoder
  );

  const refs = useRef<Record<string, HTMLDivElement>>({});

  type MousePos = { clientX: number; clientY: number };
  const mouseCoord = useRef<MousePos>(null);
  const update = useRef<(m: MousePos) => void>(() => {});
  (update.current as any) = () => {};
  useEffect(() => {
    document.addEventListener("mousemove", (e) => {
      (mouseCoord.current as any) = { clientX: e.clientX, clientY: e.clientY };
      update.current({ clientX: e.clientX, clientY: e.clientY });
    });
  }, []);

  const [fasit, setFasit] = useState([]);
  useEffect(() => {
    const found_words = selections.map(collect_letters(brett));
    const body = JSON.stringify(
      found_words.flatMap((x) => [x.join(""), x.reverse().join("")])
    );
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
      .then((x) => x.correct)
      .then(setFasit);
  }, [brett, date, selections, userId]);

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
              </Fragment>
            );
          })}
        </div>
        <div className="grid">
          {(loading ? waitingBoard : brett).flatMap((row, j) =>
            row.map((bokstav, i) => {
              const inside_selections = selections.filter(([a, b]) =>
                all_coordinates([a, b]).find((c) => c.i === i && c.j === j)
              );
              const depth_in_selection =
                inside_selections.length > 0 &&
                all_coordinates(
                  inside_selections[inside_selections.length - 1]
                ).findIndex((c) => c.i === i && c.j === j);

              // TODO: cache math random here based on i and j, so that multiple
              // renders don't mess with visuals
              const r = Math.random();

              return (
                <div
                  ref={(r) => {
                    if (r && refs.current) refs.current[c_key({ i, j })] = r;
                  }}
                  key={c_key({ i, j })}
                  style={{
                    // transitionDelay: `calc(${Math.random()} * 0.3s)`,
                    transitionProperty:
                      depth_in_selection !== false ? "color" : "opacity",
                    transitionDelay:
                      depth_in_selection !== false
                        ? `calc(${depth_in_selection} * 0.03s)`
                        : `calc(${r} * 0.3s + 0.2s)`,
                    animationDelay:
                      depth_in_selection !== false
                        ? `calc(${depth_in_selection} * 0.03s)`
                        : `calc(${r} * 0.3s)`,
                  }}
                  className={classnames(
                    {
                      selected:
                        inside_selections.length > 0 &&
                        !loading &&
                        !animationLoadingDelay,
                      loading: loading,
                      loaded: !loading,
                    },
                    "bokstav"
                  )}
                  onMouseDown={() => {
                    if (!isSelecting) {
                      setIsSelecting(true);
                      setStart({ i, j });
                    } else if (c_eq(start, { i, j })) {
                      setIsSelecting(false);
                    }
                  }}
                  onMouseUp={() => {
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
                        }, r * 300 + 200);
                      }
                    }}
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
          </div>
        </div>
      </header>
    </div>
  );
};
