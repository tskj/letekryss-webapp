import { ReactNode, useEffect, useState } from "react";

export const Modal = ({
  onClose,
  children,
}: {
  onClose: () => void;
  children: ReactNode;
}) => {
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", listener);
    return () => document.removeEventListener("keydown", listener);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <button className="modal-close" onClick={onClose} aria-label="Lukk">
          ×
        </button>
        {children}
      </div>
    </div>
  );
};

export const Rules = ({ onClose }: { onClose: () => void }) => (
  <Modal onClose={onClose}>
    <h2>Slik spiller du</h2>
    <p>Finn de 10 ordene som er gjemt blant bokstavene.</p>
    <ul>
      <li>
        Ordene går bortover, nedover eller på skrå, og både forlengs og
        baklengs. Alle er minst fire bokstaver lange.
      </li>
      <li>
        Dra over et ord for å markere det. Dra over det samme en gang til for å
        fjerne markeringen.
      </li>
      <li>
        Treffer du et av ordene, blir bokstavene røde og ordet dukker opp under
        brettet.
      </li>
      <li>
        Det finnes ingen andre ord på brettet, bortsett fra kortere ord som står
        inni de 10. Finner du UGLE uten at den blir rød, sitter den kanskje
        inni en FUGLEHUND.
      </li>
      <li>Det kommer et nytt brett hver dag ved midnatt.</li>
      <li>
        Står du fast, kan du sjekke fasiten etter klokka 19, men tidligst et
        kvarter etter at du begynte. Da er dagens spill over.
      </li>
    </ul>
    <p>
      Når du er ferdig, kan du dele resultatet ditt uten å røpe noen ord. Hver
      pil er et ord du fant eller en bom, i den rekkefølgen det skjedde, og
      viser hvilken vei du markerte. Under pila viser fargen hvor lang tid du
      brukte på ordet:
    </p>
    <p className="legend">
      🟩 under 1 min &nbsp; 🟨 1–3 min &nbsp; 🟧 3–10 min &nbsp; 🟥 over 10 min
      &nbsp; ⬛ ikke funnet &nbsp; 💥 bom
    </p>
    <button className="modal-button" onClick={onClose}>
      SPILL
    </button>
  </Modal>
);

const share_or_copy = async (text: string): Promise<"shared" | "copied"> => {
  const is_mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (is_mobile && navigator.share) {
    try {
      await navigator.share({ text });
      return "shared";
    } catch (e) {
      // the user closed the share sheet
      if (e instanceof DOMException && e.name === "AbortError") return "shared";
    }
  }
  await navigator.clipboard.writeText(text);
  return "copied";
};

export const Result = ({
  onClose,
  foundCount,
  total,
  text,
}: {
  onClose: () => void;
  foundCount: number;
  total: number;
  text: string;
}) => {
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");

  return (
    <Modal onClose={onClose}>
      <h2>{foundCount === total ? "Gratulerer!" : "Bra forsøk!"}</h2>
      <p>
        Du fant {foundCount} av {total} ord.
      </p>
      <pre className="share-preview">{text}</pre>
      <button
        className="modal-button"
        onClick={() =>
          share_or_copy(text).then(
            (r) => setStatus(r === "copied" ? "copied" : "idle"),
            () => setStatus("failed")
          )
        }
      >
        {status === "copied" ? "KOPIERT!" : "DEL RESULTAT"}
      </button>
      {status === "failed" && (
        <p className="legend">Klarte ikke å kopiere, men du kan merke teksten over.</p>
      )}
    </Modal>
  );
};
