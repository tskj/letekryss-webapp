import { Fragment, useEffect, useRef, useState } from "react";
import "./App.css";

var r = document.querySelector(":root") as any;
r.style.setProperty("--board-size", 15);

const brett = [
  ["V", "P", "H", "N", "N", "A", "G", "N", "I", "R", "G", "N", "I", "F", "Ø"],
  ["N", "A", "I", "S", "R", "P", "H", "O", "R", "N", "S", "U", "N", "D", "S"],
  ["J", "D", "R", "G", "J", "K", "R", "I", "J", "R", "E", "D", "N", "N", "Y"],
  ["S", "N", "Z", "G", "N", "Å", "E", "D", "X", "Å", "F", "U", "N", "E", "G"],
  ["Q", "L", "N", "Æ", "E", "I", "N", "T", "P", "H", "E", "E", "E", "C", "K"],
  ["Ø", "M", "T", "J", "F", "N", "R", "K", "I", "J", "I", "L", "Æ", "A", "P"],
  ["O", "N", "D", "R", "L", "E", "R", "E", "J", "O", "J", "K", "P", "K", "D"],
  ["N", "D", "N", "F", "E", "R", "K", "U", "P", "R", "L", "A", "Ø", "N", "Æ"],
  ["L", "K", "K", "E", "Y", "J", "B", "R", "W", "E", "B", "J", "S", "O", "H"],
  ["E", "K", "K", "S", "M", "W", "S", "N", "K", "L", "L", "N", "V", "T", "I"],
  ["Æ", "Å", "J", "F", "K", "E", "P", "N", "E", "D", "U", "S", "R", "T", "G"],
  ["Ø", "E", "R", "L", "D", "P", "D", "S", "A", "B", "P", "T", "M", "E", "Å"],
  ["S", "J", "A", "S", "S", "E", "T", "N", "M", "R", "P", "K", "N", "N", "G"],
  ["G", "E", "F", "G", "E", "E", "Å", "D", "U", "V", "T", "V", "R", "Y", "M"],
  ["A", "M", "M", "J", "O", "E", "Y", "O", "G", "H", "I", "F", "G", "J", "I"],
];

type Coordinate = {
  i: number;
  j: number;
};

const c_key = ({ i, j }: Coordinate) => `i:${i},j:${j}`;

export const App = () => {
  const [isSelecting, setIsSelecting] = useState(false);
  const [start, setStart] = useState<Coordinate>({ i: -1, j: -1 });

  const [selections, setSelections] = useState<[Coordinate, Coordinate][]>([]);

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
            const end = refs.current?.[
              c_key(selectionEnd)
            ]?.getBoundingClientRect() ?? {
              top: mouseCoord.current?.clientY,
              left: mouseCoord.current?.clientX,
            };

            if (!start || !end) return;

            const dy = end.top - start.top;
            const dx = end.left - start.left;

            const calc = (dx: number, dy: number) => {
              const radius = (start.bottom - start.top) / 2;

              const length = Math.sqrt(dx ** 2 + dy ** 2);
              const orientation = Math.atan2(dy, dx) - Math.PI / 2;

              const transform = `rotate(${orientation}rad) translateY(${-radius}px)`;
              return { radius, length, transform };
            };

            const { radius, length, transform } = calc(dx, dy);

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
                            const { length, transform } = calc(
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
                            const { length, radius: r } = calc(
                              m.clientX - start.left - radius,
                              m.clientY - start.top - radius
                            );
                            x.setAttribute("cy", `${length + r}`);
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
                    transform,
                  }}
                  ref={(x) => {
                    if (!x) return;
                    if (!is_active_drag) return;

                    const f = update.current;
                    const new_f = (m: MousePos) => {
                      f(m);
                      const {
                        length,
                        radius: r,
                        transform,
                      } = calc(
                        m.clientX - start.left - radius,
                        m.clientY - start.top - radius
                      );
                      x.style.height = `${length + 2 * r}px`;
                      x.style.transform = transform;
                    };
                    update.current = new_f;
                  }}
                >
                  <div
                    // må deles opp for å unngå rendering artifacts i firefox
                    className="selection-capsule"
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
          {brett.map((row, j) =>
            row.map((bokstav, i) => (
              <div
                ref={(r) => {
                  if (r && refs.current) refs.current[c_key({ i, j })] = r;
                }}
                key={c_key({ i, j })}
                className={
                  "bokstav" +
                  (selections.find(
                    ([a, b]) =>
                      (a.i === i && a.j === j) || (b.i === i && b.j === j)
                  )
                    ? " selected"
                    : "")
                }
                onClick={() => {
                  if (!isSelecting) {
                    setIsSelecting(true);
                    setStart({ i, j });
                  } else {
                    setIsSelecting(false);
                    setSelections([...selections, [start, { i, j }]]);
                  }
                }}
              >
                <div>{bokstav}</div>
              </div>
            ))
          )}
        </div>
      </header>
    </div>
  );
};
