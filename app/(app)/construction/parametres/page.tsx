"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { repository } from "@/lib/devis/repository";
import type { Entreprise, EntrepriseInput } from "@/lib/devis/types";
import "./parametres.css";

// Suggestions de datalist (saisie libre autorisée).
const FORMES = ["Micro-entreprise", "EI", "EURL", "SARL", "SAS", "SASU"];

const DEFAULT_FORM: EntrepriseInput = {
  raisonSociale: "",
  formeJuridique: "",
  siren: "",
  siret: "",
  tvaIntracom: "",
  capital: null,
  adresse: "",
  codePostal: "",
  ville: "",
  email: "",
  telephone: "",
  siteWeb: "",
  assuranceCompagnie: "",
  assurancePolice: "",
  assuranceZone: "",
  validiteJours: 30,
  acomptePct: 30,
  margePct: 30,
  tauxHoraire: 0,
  iban: "",
  cgv: "",
};

type SaveStatus = "idle" | "saving" | "saved";

function toInput(e: Entreprise): EntrepriseInput {
  // On retire id/timestamps pour ne garder que les champs éditables.
  const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = e;
  void _id;
  void _c;
  void _u;
  return rest;
}

function relTime(ts: number): string {
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 5) return "à l'instant";
  if (s < 60) return `il y a ${s} s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60);
  return `il y a ${h} h`;
}

export default function ParametresPage() {
  const [form, setForm] = useState<EntrepriseInput>(DEFAULT_FORM);
  const formRef = useRef<EntrepriseInput>(DEFAULT_FORM);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [, setTick] = useState(0);

  // Chargement initial (client uniquement → pas de mismatch d'hydratation).
  useEffect(() => {
    let active = true;
    repository.entreprise.get().then((e) => {
      if (!active || !e) return;
      const data = toInput(e);
      formRef.current = data;
      setForm(data);
    });
    return () => {
      active = false;
    };
  }, []);

  // Rafraîchit le libellé "il y a Xs".
  useEffect(() => {
    const i = setInterval(() => setTick((t) => t + 1), 5000);
    return () => clearInterval(i);
  }, []);

  // Mise à jour synchrone de la ref + de l'état (save() lit toujours la dernière valeur).
  const set = useCallback((patch: Partial<EntrepriseInput>) => {
    const next = { ...formRef.current, ...patch };
    formRef.current = next;
    setForm(next);
  }, []);

  const save = useCallback(async () => {
    setStatus("saving");
    try {
      await repository.entreprise.save(formRef.current);
      setSavedAt(Date.now());
      setStatus("saved");
    } catch {
      setStatus("idle");
    }
  }, []);

  // Warnings non bloquants.
  const sirenWarn =
    form.siren.length > 0 && !/^\d{9}$/.test(form.siren)
      ? "9 chiffres attendus"
      : null;
  const siretWarn =
    form.siret.length > 0 && !/^\d{14}$/.test(form.siret)
      ? "14 chiffres attendus"
      : null;
  const ibanWarn =
    form.iban.length > 0 &&
    !/^FR[0-9A-Z]{25}$/i.test(form.iban.replace(/\s/g, ""))
      ? "Format FR + 25 caractères attendu"
      : null;
  const emailWarn =
    form.email.length > 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)
      ? "Format e-mail invalide"
      : null;

  const indicatorLabel =
    status === "saving"
      ? "Enregistrement…"
      : savedAt
        ? `Enregistré ${relTime(savedAt)}`
        : "Jamais enregistré";

  return (
    <div className="params-tool">
      <header className="page-header">
        <div className="page-eyebrow">Construction · Paramètres</div>
        <h1 className="page-title">Paramètres entreprise</h1>
        <p className="page-sub">
          Ces informations alimentent tes devis et leurs mentions légales
          obligatoires. Tout est enregistré automatiquement.
        </p>
      </header>

      {/* IDENTITÉ */}
      <section className="section">
        <div className="section-title">Identité</div>
        <div className="field">
          <label className="field-label">Raison sociale</label>
          <input
            className="input"
            value={form.raisonSociale}
            onChange={(e) => set({ raisonSociale: e.target.value })}
            onBlur={save}
            placeholder="Ex. SAS Dupont Bâtiment"
          />
        </div>
        <div className="field">
          <label className="field-label">Forme juridique</label>
          <input
            className="input"
            list="formes-juridiques"
            value={form.formeJuridique}
            onChange={(e) => set({ formeJuridique: e.target.value })}
            onBlur={save}
            placeholder="Ex. SASU (saisie libre)"
          />
          <datalist id="formes-juridiques">
            {FORMES.map((f) => (
              <option key={f} value={f} />
            ))}
          </datalist>
        </div>
        <div className="field">
          <label className="field-label">Capital social</label>
          <div className="input-suffix">
            <input
              className="input mono"
              type="number"
              min={0}
              step={100}
              value={form.capital ?? ""}
              onChange={(e) =>
                set({
                  capital: e.target.value === "" ? null : Number(e.target.value),
                })
              }
              onBlur={save}
            />
            <span className="suffix">€</span>
          </div>
        </div>
      </section>

      {/* IDENTIFICATION FISCALE */}
      <section className="section">
        <div className="section-title">Identification fiscale</div>
        <div className="field">
          <label className="field-label">SIREN</label>
          <div className="siren-row">
            <input
              className="input mono"
              value={form.siren}
              onChange={(e) => set({ siren: e.target.value })}
              onBlur={save}
              placeholder="123456789"
              inputMode="numeric"
            />
            <button
              type="button"
              className="btn-secondary"
              disabled
              title="Bientôt disponible (API Sirene INSEE)"
            >
              <i className="ti ti-wand" aria-hidden="true" />
              Auto-compléter
            </button>
          </div>
          {sirenWarn && (
            <div className="field-warn">
              <i className="ti ti-alert-triangle" aria-hidden="true" />
              {sirenWarn}
            </div>
          )}
        </div>
        <div className="field">
          <label className="field-label">SIRET</label>
          <input
            className="input mono"
            value={form.siret}
            onChange={(e) => set({ siret: e.target.value })}
            onBlur={save}
            placeholder="12345678900012"
            inputMode="numeric"
          />
          {siretWarn && (
            <div className="field-warn">
              <i className="ti ti-alert-triangle" aria-hidden="true" />
              {siretWarn}
            </div>
          )}
        </div>
        <div className="field">
          <label className="field-label">TVA intracommunautaire</label>
          <input
            className="input mono"
            value={form.tvaIntracom}
            onChange={(e) => set({ tvaIntracom: e.target.value })}
            onBlur={save}
            placeholder="FR00123456789"
          />
        </div>
      </section>

      {/* COORDONNÉES */}
      <section className="section">
        <div className="section-title">Coordonnées</div>
        <div className="field">
          <label className="field-label">Adresse</label>
          <input
            className="input"
            value={form.adresse}
            onChange={(e) => set({ adresse: e.target.value })}
            onBlur={save}
            placeholder="12 rue des Artisans"
          />
        </div>
        <div className="row cp-ville">
          <div className="field">
            <label className="field-label">Code postal</label>
            <input
              className="input mono"
              value={form.codePostal}
              onChange={(e) => set({ codePostal: e.target.value })}
              onBlur={save}
              placeholder="75011"
              inputMode="numeric"
            />
          </div>
          <div className="field">
            <label className="field-label">Ville</label>
            <input
              className="input"
              value={form.ville}
              onChange={(e) => set({ ville: e.target.value })}
              onBlur={save}
              placeholder="Paris"
            />
          </div>
        </div>
        <div className="row cols-2">
          <div className="field">
            <label className="field-label">E-mail</label>
            <input
              className="input"
              type="email"
              value={form.email}
              onChange={(e) => set({ email: e.target.value })}
              onBlur={save}
              placeholder="contact@entreprise.fr"
            />
            {emailWarn && (
              <div className="field-warn">
                <i className="ti ti-alert-triangle" aria-hidden="true" />
                {emailWarn}
              </div>
            )}
          </div>
          <div className="field">
            <label className="field-label">Téléphone</label>
            <input
              className="input mono"
              value={form.telephone}
              onChange={(e) => set({ telephone: e.target.value })}
              onBlur={save}
              placeholder="06 12 34 56 78"
              inputMode="tel"
            />
          </div>
        </div>
        <div className="field">
          <label className="field-label">Site web</label>
          <input
            className="input"
            value={form.siteWeb}
            onChange={(e) => set({ siteWeb: e.target.value })}
            onBlur={save}
            placeholder="https://…"
          />
        </div>
      </section>

      {/* ASSURANCE DÉCENNALE */}
      <section className="section">
        <div className="section-title">Assurance décennale</div>
        <div className="field">
          <label className="field-label">Compagnie</label>
          <input
            className="input"
            value={form.assuranceCompagnie}
            onChange={(e) => set({ assuranceCompagnie: e.target.value })}
            onBlur={save}
            placeholder="Ex. SMABTP"
          />
        </div>
        <div className="row cols-2">
          <div className="field">
            <label className="field-label">N° de police</label>
            <input
              className="input mono"
              value={form.assurancePolice}
              onChange={(e) => set({ assurancePolice: e.target.value })}
              onBlur={save}
            />
          </div>
          <div className="field">
            <label className="field-label">Zone de couverture</label>
            <input
              className="input"
              value={form.assuranceZone}
              onChange={(e) => set({ assuranceZone: e.target.value })}
              onBlur={save}
              placeholder="France métropolitaine"
            />
          </div>
        </div>
      </section>

      {/* PRÉFÉRENCES DEVIS */}
      <section className="section">
        <div className="section-title">Préférences devis</div>
        <div className="row cols-2">
          <div className="field">
            <label className="field-label">Validité par défaut</label>
            <div className="input-suffix">
              <input
                className="input mono"
                type="number"
                min={1}
                max={365}
                value={form.validiteJours}
                onChange={(e) => set({ validiteJours: Number(e.target.value) })}
                onBlur={save}
              />
              <span className="suffix">jours</span>
            </div>
          </div>
          <div className="field">
            <label className="field-label">Acompte par défaut</label>
            <div className="input-suffix">
              <input
                className="input mono"
                type="number"
                min={0}
                max={100}
                value={form.acomptePct}
                onChange={(e) => set({ acomptePct: Number(e.target.value) })}
                onBlur={save}
              />
              <span className="suffix">%</span>
            </div>
          </div>
        </div>
        <div className="row cols-2">
          <div className="field">
            <label className="field-label">Marge par défaut</label>
            <div className="input-suffix">
              <input
                className="input mono"
                type="number"
                min={0}
                value={form.margePct}
                onChange={(e) => set({ margePct: Number(e.target.value) })}
                onBlur={save}
              />
              <span className="suffix">%</span>
            </div>
          </div>
          <div className="field">
            <label className="field-label">Taux horaire</label>
            <div className="input-suffix">
              <input
                className="input mono"
                type="number"
                min={0}
                step={1}
                value={form.tauxHoraire}
                onChange={(e) => set({ tauxHoraire: Number(e.target.value) })}
                onBlur={save}
              />
              <span className="suffix">€/h</span>
            </div>
          </div>
        </div>
      </section>

      {/* BANQUE */}
      <section className="section">
        <div className="section-title">Banque</div>
        <div className="field">
          <label className="field-label">IBAN</label>
          <input
            className="input mono"
            value={form.iban}
            onChange={(e) => set({ iban: e.target.value })}
            onBlur={save}
            placeholder="FR76 1234 5678 9012 3456 7890 123"
          />
          {ibanWarn && (
            <div className="field-warn">
              <i className="ti ti-alert-triangle" aria-hidden="true" />
              {ibanWarn}
            </div>
          )}
        </div>
      </section>

      {/* CGV */}
      <section className="section">
        <div className="section-title">Conditions générales de vente</div>
        <div className="field">
          <label className="field-label">
            Texte des CGV (annexé aux devis)
          </label>
          <textarea
            className="textarea"
            value={form.cgv}
            onChange={(e) => set({ cgv: e.target.value })}
            onBlur={save}
            placeholder="Colle ici tes conditions générales de vente…"
          />
        </div>
      </section>

      <div
        className={`save-indicator${status === "saved" ? " saved" : ""}${
          status === "saving" ? " saving" : ""
        }`}
      >
        <span className="save-dot" />
        {indicatorLabel}
      </div>
    </div>
  );
}
