"use client";

import { useState } from "react";
import { repository } from "@/lib/devis/repository";
import type {
  Chantier,
  ChantierInput,
  ChantierStatut,
  Client,
} from "@/lib/devis/types";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function clientLabel(c: Client): string {
  const full = [c.prenom, c.nom].filter(Boolean).join(" ").trim();
  return full || c.contact || "(client sans nom)";
}

type Props = {
  mode: "create" | "edit";
  /** Chantier à éditer (mode "edit"). */
  chantier?: Chantier;
  /** Clients existants pour le select (rattachement). */
  clients: Client[];
  onClose: () => void;
  onSaved: (chantier: Chantier) => void;
};

export default function ChantierFormModal({
  mode,
  chantier,
  clients,
  onClose,
  onSaved,
}: Props) {
  const [nom, setNom] = useState(chantier?.nom ?? "");
  const [clientId, setClientId] = useState<string>(chantier?.clientId ?? "");
  const [adresse, setAdresse] = useState(chantier?.adresse ?? "");
  const [codePostal, setCodePostal] = useState(chantier?.codePostal ?? "");
  const [ville, setVille] = useState(chantier?.ville ?? "");
  const [dateDebut, setDateDebut] = useState(chantier?.dateDebut ?? "");
  const [dateFin, setDateFin] = useState(chantier?.dateFin ?? "");
  const [statut, setStatut] = useState<ChantierStatut>(
    chantier?.statut ?? "actif"
  );
  const [notes, setNotes] = useState(chantier?.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!nom.trim()) {
      setError("Le nom du chantier est obligatoire.");
      return;
    }
    setSaving(true);
    const input: ChantierInput = {
      nom: nom.trim(),
      clientId: clientId || null,
      adresse: adresse.trim(),
      codePostal: codePostal.trim(),
      ville: ville.trim(),
      dateCreation: chantier?.dateCreation ?? todayISO(),
      dateDebut: dateDebut || null,
      dateFin: dateFin || null,
      statut,
      notes: notes.trim(),
    };
    try {
      const saved =
        mode === "edit" && chantier
          ? await repository.chantiers.update(chantier.id, input)
          : await repository.chantiers.create(input);
      onSaved(saved);
    } catch {
      setError("Une erreur est survenue à l'enregistrement.");
      setSaving(false);
    }
  };

  return (
    <div
      className="chantiers-modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="chantiers-modal" role="dialog" aria-modal="true">
        <h3>{mode === "edit" ? "Modifier le chantier" : "Nouveau chantier"}</h3>

        <div className="field">
          <label htmlFor="ch-nom">Nom du chantier</label>
          <input
            id="ch-nom"
            type="text"
            value={nom}
            placeholder="Ex. Rénovation appartement Dupont"
            onChange={(e) => setNom(e.target.value)}
            autoFocus
          />
        </div>

        <div className="field">
          <label htmlFor="ch-client">Client</label>
          <select
            id="ch-client"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
          >
            <option value="">— Aucun client —</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {clientLabel(c)}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="ch-adresse">Adresse</label>
          <input
            id="ch-adresse"
            type="text"
            value={adresse}
            onChange={(e) => setAdresse(e.target.value)}
          />
        </div>

        <div className="field field-row">
          <div>
            <label htmlFor="ch-cp">Code postal</label>
            <input
              id="ch-cp"
              type="text"
              value={codePostal}
              onChange={(e) => setCodePostal(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="ch-ville">Ville</label>
            <input
              id="ch-ville"
              type="text"
              value={ville}
              onChange={(e) => setVille(e.target.value)}
            />
          </div>
        </div>

        <div className="field field-row dates">
          <div>
            <label htmlFor="ch-debut">Début (prévu)</label>
            <input
              id="ch-debut"
              type="date"
              value={dateDebut ?? ""}
              onChange={(e) => setDateDebut(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="ch-fin">Fin (prévue)</label>
            <input
              id="ch-fin"
              type="date"
              value={dateFin ?? ""}
              onChange={(e) => setDateFin(e.target.value)}
            />
          </div>
        </div>

        <div className="field">
          <label htmlFor="ch-statut">Statut</label>
          <select
            id="ch-statut"
            value={statut}
            onChange={(e) => setStatut(e.target.value as ChantierStatut)}
          >
            <option value="actif">Actif</option>
            <option value="clos">Clos</option>
          </select>
        </div>

        <div className="field">
          <label htmlFor="ch-notes">Notes</label>
          <textarea
            id="ch-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        {error && <div className="err">{error}</div>}

        <div className="modal-actions">
          <button className="btn-ghost" onClick={onClose} disabled={saving}>
            Annuler
          </button>
          <button className="btn-primary" onClick={submit} disabled={saving}>
            {saving ? "Enregistrement…" : mode === "edit" ? "Enregistrer" : "Créer le chantier"}
          </button>
        </div>
      </div>
    </div>
  );
}
