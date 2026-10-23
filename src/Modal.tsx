import { ReactNode, useCallback, useEffect, useState } from "react";
import { share_text } from "./share";

// children can be a function to get the animated close, for buttons inside the modal
export const Modal = ({
  onClose,
  children,
}: {
  onClose: () => void;
  children: ReactNode | ((close: () => void) => ReactNode);
}) => {
  // closing plays the exit animation, and onClose runs when it's done
  const [closing, setClosing] = useState(false);
  const close = useCallback(() => setClosing(true), []);

  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", listener);
    return () => document.removeEventListener("keydown", listener);
  }, [close]);

  return (
    <div
      className={closing ? "modal-backdrop closing" : "modal-backdrop"}
      onClick={close}
      onAnimationEnd={(e) => {
        if (closing && e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <button className="modal-close" onClick={close} aria-label="Lukk">
          ×
        </button>
        {typeof children === "function" ? children(close) : children}
      </div>
    </div>
  );
};

const minute = 60 * 1000;
const example_share_text = share_text({
  date: "2026-10-22",
  events: [
    { kind: "found", direction: { di: 1, dj: 0 }, durationMs: 0.5 * minute },
    { kind: "found", direction: { di: 0, dj: 1 }, durationMs: 2 * minute },
    { kind: "miss", direction: { di: 1, dj: 1 } },
    { kind: "found", direction: { di: -1, dj: -1 }, durationMs: 4 * minute },
    { kind: "found", direction: { di: -1, dj: 0 }, durationMs: 0.7 * minute },
    { kind: "found", direction: { di: 1, dj: -1 }, durationMs: 1.5 * minute },
    { kind: "found", direction: { di: 0, dj: -1 }, durationMs: 6 * minute },
    { kind: "found", direction: { di: 1, dj: 0 }, durationMs: 0.4 * minute },
    { kind: "found", direction: { di: -1, dj: 1 }, durationMs: 14 * minute },
  ],
  total: 10,
  totalMs: 29 * minute,
});

export const Rules = ({ onClose }: { onClose: () => void }) => (
  <Modal onClose={onClose}>
    {(close) => (
      <>
        <h2>Slik spiller du</h2>
        <p>
          Finn de 10 norske ordene som er gjemt blant bokstavene. Alle er
          vanlige ord fra ordboka.
        </p>
        <p>
          <strong>Her står ingenting tilfeldig.</strong> I et vanlig letekryss
          kan bokstavene danne ord ved et uhell, men ikke her. Ser du et norsk
          ord på minst fire bokstaver, hører det til et av de 10: enten er det
          ordet selv, eller så sitter det inni det. Lyser ikke UGLE opp, så let
          rundt det. Kanskje er det en del av FUGLEHUND, eller det står
          baklengs i JUBELGUTT.
        </p>
        <ul>
          <li>
            Ordene går bortover, nedover eller på skrå, og både forlengs og
            baklengs. Alle er minst fire bokstaver lange.
          </li>
          <li>
            Dra over et ord for å markere det. Dra over det samme en gang til
            for å fjerne markeringen.
          </li>
          <li>
            Treffer du et av ordene, lyser bokstavene opp og ordet dukker opp
            under brettet.
          </li>
          <li>Det kommer et nytt brett hver dag ved midnatt.</li>
          <li>
            Står du fast, kan du sjekke fasiten etter klokka 19, men tidligst et
            kvarter etter at du begynte. Da er dagens spill over.
          </li>
        </ul>
        <p>
          Når du er ferdig, kan du dele resultatet ditt uten å røpe noen ord.
          Hver pil er et ord du fant eller en bom, i den rekkefølgen det
          skjedde, og viser hvilken vei du markerte. Under pila viser fargen
          hvor lang tid du brukte på ordet:
        </p>
        <p className="legend">
          🟩 under 1 min &nbsp; 🟨 1–3 min &nbsp; 🟧 3–10 min &nbsp; 🟥 over 10
          min &nbsp; ⬛ ikke funnet &nbsp; 💥 bom
        </p>
        <p>
          For eksempel: her ble åtte ord funnet, med én bom underveis, og to ble
          aldri funnet.
        </p>
        <pre className="share-preview">{example_share_text}</pre>
        <button className="modal-button" onClick={close}>
          SPILL
        </button>
      </>
    )}
  </Modal>
);

// phones get the share sheet, everything else copies to the clipboard
const opens_share_sheet = () =>
  /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) && !!navigator.share;

const share_or_copy = async (text: string): Promise<"shared" | "copied"> => {
  if (opens_share_sheet()) {
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
  inProgress,
}: {
  onClose: () => void;
  foundCount: number;
  total: number;
  text: string;
  inProgress: boolean;
}) => {
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");

  return (
    <Modal onClose={onClose}>
      <h2>
        {inProgress
          ? "Så langt"
          : foundCount === total
            ? "Gratulerer!"
            : "Bra forsøk!"}
      </h2>
      {inProgress ? (
        <p>
          Du har funnet {foundCount} av {total} ord. Del det du har, og let
          videre etterpå.
        </p>
      ) : (
        <p>
          Du fant {foundCount} av {total} ord.
        </p>
      )}
      <pre className="share-preview">{text}</pre>
      <button
        className="modal-button"
        onClick={() =>
          share_or_copy(text).then(
            (r) => setStatus(r === "copied" ? "copied" : "idle"),
            () => setStatus("failed"),
          )
        }
      >
        {status === "copied" ? (
          <CheckIcon />
        ) : opens_share_sheet() ? (
          <ShareIcon />
        ) : (
          <CopyIcon />
        )}
        {status === "copied" ? "KOPIERT!" : "DEL RESULTAT"}
      </button>
      {status === "failed" && (
        <p className="legend">
          Klarte ikke å kopiere, men du kan merke teksten over.
        </p>
      )}
    </Modal>
  );
};

const icon_props = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

const CopyIcon = () => (
  <svg {...icon_props}>
    <rect x="9" y="9" width="12" height="12" rx="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

export const ShareIcon = () => (
  <svg {...icon_props}>
    <path d="M12 3v12" />
    <path d="M8 7l4-4 4 4" />
    <path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
  </svg>
);

const CheckIcon = () => (
  <svg {...icon_props}>
    <path d="M5 12l5 5L20 7" />
  </svg>
);
