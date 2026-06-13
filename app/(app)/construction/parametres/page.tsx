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
  assujettiTVA: false,
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
  logo: "",
  couleurAccent: "#1a7a3c",
  penalitesRetardTaux: null,
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

  const [logoWarn, setLogoWarn] = useState<string | null>(null);
  // Logo : redimensionné (max 240 px) + compressé + plafonné base64 (localStorage).
  const onLogoFile = useCallback(
    async (file: File) => {
      setLogoWarn(null);
      try {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const r = new FileReader();
          r.onload = () => resolve(String(r.result));
          r.onerror = () => reject(new Error("read"));
          r.readAsDataURL(file);
        });
        const img = new Image();
        await new Promise<void>((res, rej) => {
          img.onload = () => res();
          img.onerror = () => rej(new Error("img"));
          img.src = dataUrl;
        });
        const maxW = 240;
        const scale = Math.min(1, maxW / (img.width || maxW));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("ctx");
        ctx.fillStyle = "#ffffff"; // fond blanc (doc imprimé sur blanc)
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        let out = canvas.toDataURL("image/png");
        if (out.length > 160_000) out = canvas.toDataURL("image/jpeg", 0.82);
        if (out.length > 200_000) {
          setLogoWarn("Image trop lourde même après compression — essaie un logo plus simple.");
          return;
        }
        set({ logo: out });
        save();
      } catch {
        setLogoWarn("Impossible de lire cette image.");
      }
    },
    [set, save]
  );

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

      {/* LOGO & MARQUE */}
      <section className="section">
        <div className="section-title">Logo &amp; marque</div>
        <div className="field">
          <label className="field-label">Logo (en-tête du devis)</label>
          <div className="logo-row">
            {form.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={form.logo} alt="Logo" className="logo-preview" />
            ) : (
              <div className="logo-preview is-empty">Aucun logo</div>
            )}
            <div className="logo-actions">
              <label className="btn-secondary logo-upload">
                <i className="ti ti-upload" aria-hidden="true" />
                {form.logo ? "Remplacer" : "Charger un logo"}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onLogoFile(f);
                    e.target.value = "";
                  }}
                />
              </label>
              {form.logo && (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    set({ logo: "" });
                    save();
                  }}
                >
                  <i className="ti ti-trash" aria-hidden="true" />
                  Retirer
                </button>
              )}
            </div>
          </div>
          {logoWarn ? (
            <div className="field-warn">
              <i className="ti ti-alert-triangle" aria-hidden="true" />
              {logoWarn}
            </div>
          ) : (
            <div className="field-hint">
              PNG ou JPEG — redimensionné automatiquement (max 240 px) et stocké
              localement. Sans logo, l&apos;en-tête affiche le nom de
              l&apos;entreprise.
            </div>
          )}
        </div>
        <div className="field">
          <label className="field-label">Couleur d&apos;accent du devis</label>
          <div className="color-row">
            <input
              type="color"
              className="color-input"
              value={form.couleurAccent}
              onChange={(e) => set({ couleurAccent: e.target.value })}
              onBlur={save}
              aria-label="Couleur d'accent"
            />
            <input
              className="input mono color-hex"
              value={form.couleurAccent}
              onChange={(e) => set({ couleurAccent: e.target.value })}
              onBlur={save}
            />
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                set({ couleurAccent: "#1a7a3c" });
                save();
              }}
            >
              Réinitialiser
            </button>
          </div>
          <div className="field-hint">
            Pilote les accents du document client (filets, en-têtes de tableau,
            numéros de lot, total TTC). Le corps reste noir/gris. Défaut : vert
            SOCLE.
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
        <div className="row cols-2">
          <div className="field">
            <label className="field-label">Pénalités de retard</label>
            <div className="input-suffix">
              <input
                className="input mono"
                type="number"
                min={0}
                step={0.5}
                value={form.penalitesRetardTaux ?? ""}
                placeholder="—"
                onChange={(e) =>
                  set({
                    penalitesRetardTaux:
                      e.target.value === "" ? null : Number(e.target.value),
                  })
                }
                onBlur={save}
              />
              <span className="suffix">% / mois</span>
            </div>
            <div className="field-hint">
              Affiché dans les conditions du devis. Vide → « à préciser ».
            </div>
          </div>
          <div className="field" />
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
