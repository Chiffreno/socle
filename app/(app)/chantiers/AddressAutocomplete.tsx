"use client";

import { useEffect, useRef, useState } from "react";

// Réponse de l'API Adresse (api-adresse.data.gouv.fr) — champs utilisés.
type ApiFeature = {
  properties: {
    label?: string;
    name?: string;
    postcode?: string;
    city?: string;
  };
};
type ApiResponse = { features?: ApiFeature[] };

type Suggestion = {
  label: string;
  adresse: string;
  codePostal: string;
  ville: string;
};

type Props = {
  id?: string;
  value: string;
  /** Saisie libre (toujours possible, y compris si l'API ne répond pas). */
  onChange: (v: string) => void;
  /** Choix d'une suggestion → remplit adresse + CP + ville d'un coup. */
  onSelect: (v: { adresse: string; codePostal: string; ville: string }) => void;
  placeholder?: string;
};

/**
 * Champ adresse avec autocomplétion via l'API Adresse du gouvernement
 * (gratuite, sans clé). Debounce 300ms, annulation des réponses obsolètes,
 * dégradation propre : si l'API échoue, on garde la saisie manuelle.
 */
export default function AddressAutocomplete({
  id,
  value,
  onChange,
  onSelect,
  placeholder,
}: Props) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const skipNext = useRef(false); // ne pas refetch juste après une sélection
  const reqId = useRef(0); // ignore les réponses arrivées en retard

  useEffect(() => {
    const q = value.trim();
    if (skipNext.current) {
      skipNext.current = false;
      return;
    }
    if (q.length < 3) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    const myReq = ++reqId.current;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(
            q
          )}&limit=5`
        );
        if (!res.ok) throw new Error("api error");
        const data: ApiResponse = await res.json();
        if (myReq !== reqId.current) return; // réponse obsolète
        const list: Suggestion[] = (data.features ?? []).map((f) => ({
          label: f.properties.label ?? "",
          adresse: f.properties.name ?? "",
          codePostal: f.properties.postcode ?? "",
          ville: f.properties.city ?? "",
        }));
        setSuggestions(list);
        setOpen(list.length > 0);
      } catch {
        // Dégradation propre : pas de suggestions, saisie manuelle conservée.
        if (myReq === reqId.current) {
          setSuggestions([]);
          setOpen(false);
        }
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [value]);

  const choose = (s: Suggestion) => {
    skipNext.current = true;
    onSelect({ adresse: s.adresse || s.label, codePostal: s.codePostal, ville: s.ville });
    setOpen(false);
    setSuggestions([]);
  };

  return (
    <div className="addr-ac">
      <input
        id={id}
        type="text"
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => {
          if (suggestions.length) setOpen(true);
        }}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
      />
      {open && suggestions.length > 0 && (
        <ul className="addr-ac-list">
          {suggestions.map((s, i) => (
            <li
              key={i}
              // onMouseDown (avant blur) pour que le clic enregistre le choix.
              onMouseDown={(e) => {
                e.preventDefault();
                choose(s);
              }}
            >
              {s.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
