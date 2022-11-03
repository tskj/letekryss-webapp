import { useEffect, useState } from "react";
import "./App.css";

export const App = () => {
  const [antallTrykk, setAntallTrykk] = useState(-10);

  return (
    <div className="App">
      <header className="App-header">
        <p>Hei hei hei</p>
        <div>{antallTrykk}</div>
        <button onClick={() => setAntallTrykk(antallTrykk + 1)}>
          Klikk her +
        </button>
        <MinKomponent navn={antallTrykk < 10 ? "maren" : "tarjei"} />
      </header>
    </div>
  );
};

type Props = {
  navn: string;
};
const MinKomponent = ({ navn }: Props) => {
  useEffect(() => {
    document.title = navn;
  });

  return <div>hei på deg, {navn}...</div>;
};
