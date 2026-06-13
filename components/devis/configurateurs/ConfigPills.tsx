"use client";

// ============================================================
// SOCLE — ConfigPills : groupe de pills de configuration (générique)
//
// Extrait du configurateur cloisons (patron segments) pour être partagé par
// tous les lots à segments (cloisons, faux-plafond, ITI…). Un libellé, un
// indice optionnel, une liste d'options exclusives sous forme de pills.
// ============================================================

interface Props<T extends string> {
  label: string;
  hint?: string;
  options: ReadonlyArray<{ v: T; l: string }>;
  value: T;
  onChange: (v: T) => void;
}

export default function ConfigPills<T extends string>({
  label,
  hint,
  options,
  value,
  onChange,
}: Props<T>) {
  return (
    <div className="dee-cfg-field">
      <span className="dee-cfg-flabel">
        {label}
        {hint && <em className="dee-cfg-hint">{hint}</em>}
      </span>
      <div className="dee-cfg-pills">
        {options.map((o) => (
          <button
            key={o.v}
            type="button"
            className={`dee-cfg-pill${value === o.v ? " is-active" : ""}`}
            onClick={() => onChange(o.v)}
          >
            {o.l}
          </button>
        ))}
      </div>
    </div>
  );
}
