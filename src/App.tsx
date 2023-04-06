import { useEffect, useState } from "react";
import "./App.css";

export const App = () => {
  const [antallTrykk, setAntallTrykk] = useState(-10);

  return (
    <div className="App">
      <header className="App-header">
        <div className="grid">{y}</div>
      </header>
    </div>
  );
};

var r = document.querySelector(":root") as any;
r.style.setProperty("--board-size", 15);

const brett = [
  ["V", "P", "H", "N", "N", "A", "G", "N", "I", "R", "G", "N", "I", "F", "Ø"],
  ["N", "A", "I", "S", "R", "P", "H", "O", "R", "N", "S", "U", "N", "D", "S"],
  ["J", "D", "R", "G", "J", "K", "R", "I", "J", "R", "E", "D", "N", "N", "Y"],
  ["S", "N", "Z", "G", "N", "Å", "E", "D", "X", "Å", "F", "U", "N", "E", "G"],
  ["Ø", "L", "N", "Æ", "E", "I", "N", "T", "P", "H", "E", "E", "E", "C", "K"],
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

const y = brett.map((row) => row.map((bokstav) => <div>{bokstav}</div>));
