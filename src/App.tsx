import { Fragment, useRef, useState } from "react";
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

  return (
    <div className="App">
      <header className="App-header">
        <div className="selections">
          {selections.map(([selectionStart, selectionEnd]) => {
            const start =
              refs.current?.[c_key(selectionStart)]?.getBoundingClientRect();
            const end =
              refs.current?.[c_key(selectionEnd)]?.getBoundingClientRect();

            if (!start || !end) return;

            const dy = end.top - start.top;
            const dx = end.left - start.left;
            const radius = (start.bottom - start.top) / 2;

            const length = Math.sqrt(dx ** 2 + dy ** 2);

            const rad = Math.atan2(dy, dx) - Math.PI / 2;

            const k = c_key(selectionStart) + c_key(selectionEnd);

            return (
              <Fragment key={k}>
                <div
                  style={{
                    top: start.top,
                    left: start.left,
                    transform: `rotate(${rad}rad)`,
                  }}
                  className="selection-half selection-start"
                />
                <svg width="0" height="0">
                  <defs>
                    <clipPath id={"capsule" + k}>
                      <circle cx={radius} cy={radius} r={radius} />
                      <rect
                        x="0"
                        y={radius}
                        width={2 * radius}
                        height={length}
                      />
                      <circle cx={radius} cy={length + radius} r={radius} />
                    </clipPath>
                  </defs>
                </svg>
                <div
                  style={{
                    top: start.top + radius,
                    left: start.left,
                    height: length + 2 * radius,
                    transform: `rotate(${rad}rad) translateY(${-radius}px)`,
                    clipPath: `url(#${"capsule" + k})`,
                  }}
                  className="selection-firkant capsule"
                />
                <div
                  style={{
                    top: end.top,
                    left: end.left,
                    transform: `rotate(${rad}rad)`,
                  }}
                  className="selection-half selection-end"
                />
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
