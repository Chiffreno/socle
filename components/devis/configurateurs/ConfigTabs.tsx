"use client";

// ============================================================
// SOCLE — ConfigTabs : onglets de FAMILLE (niveau « quelle prestation »)
//
// Frère de ConfigPills, mais pour le niveau supérieur d'un configurateur à
// familles (carrelage / faïence / parquet). Onglets SOULIGNÉS — volontairement
// distincts des pills de sous-choix : filet de séparation sous la barre, actif =
// texte vert + soulignement, inactifs gris. Partagé, jamais dupliqué par lot.
// Même signature générique que ConfigPills (options / value / onChange).
// ============================================================

interface Props<T extends string> {
  options: ReadonlyArray<{ v: T; l: string }>;
  value: T;
  onChange: (v: T) => void;
  ariaLabel?: string;
}

export default function ConfigTabs<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: Props<T>) {
  return (
    <div className="dee-cfg-tabs" role="tablist" aria-label={ariaLabel}>
      {options.map((o) => {
        const active = value === o.v;
        return (
          <button
            key={o.v}
            type="button"
            role="tab"
            aria-selected={active}
            className={`dee-cfg-tab${active ? " is-active" : ""}`}
            onClick={() => onChange(o.v)}
          >
            {o.l}
          </button>
        );
      })}
    </div>
  );
}
