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

/*
Ø  K  Ø  X  I  T  V  A  H  E  P  E  B  N  Y
K  A  C  O  U  H  S  V  G  W  B  E  C  D  Ø
F  A  K  W  Z  P  A  K  X  Z  Z  N  H  V  Ø
E  C  S  M  I  U  I  V  X  Ø  J  Z  Ø  C  Q
I  Z  C  G  M  K  Z  Å  X  G  V  Y  Æ  D  B
B  X  D  B  D  T  M  Z  K  I  A  O  X  W  M
V  K  X  X  L  Y  G  W  M  D  U  G  S  Ø  T
I  J  F  W  Æ  G  S  F  M  V  K  X  U  U  O
Y  X  K  Q  L  T  B  F  L  R  Y  X  R  G  Y
T  U  H  G  O  Q  T  Å  V  Z  G  J  X  E  A
W  R  J  K  H  C  W  J  J  T  T  X  G  J  V
G  M  K  Y  S  F  Z  G  N  O  Ø  C  Z  N  Q
S  Q  M  S  R  A  X  H  O  D  T  O  Æ  E  A
L  W  B  I  Å  W  Æ  R  Ø  C  N  M  U  S  Ø
L  J  X  Ø  Æ  Ø  Y  Æ  B  G  G  H  U  Æ  Ø
*/
