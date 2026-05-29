"use client";

import { useState } from "react";
import { repository } from "@/lib/devis/repository";
import type {
  Chantier,
  ChantierInput,
  ChantierStatut,
  Client,
  ClientInput,
  ClientType,
} from "@/lib/devis/types";
import AddressAutocomplete from "./AddressAutocomplete";

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
  // Liste locale (pour refléter un client créé à la volée sans recharger).
  const [clientList, setClientList] = useState<Client[]>(clients);

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

  // ── Mini-formulaire « Nouveau client » ──
  const [showClientForm, setShowClientForm] = useState(false);
  const [clType, setClType] = useState<ClientType>("particulier");
  const [clNom, setClNom] = useState("");
  const [clPrenom, setClPrenom] = useState("");
  const [clContact, setClContact] = useState("");
  const [clEmail, setClEmail] = useState("");
  const [clTel, setClTel] = useState("");
  const [clError, setClError] = useState<string | null>(null);
  const [clSaving, setClSaving] = useState(false);

  const resetClientForm = () => {
    setClType("particulier");
    setClNom("");
    setClPrenom("");
    setClContact("");
    setClEmail("");
    setClTel("");
    setClError(null);
  };

  const createClient = async () => {
    if (!clNom.trim()) {
      setClError("Le nom du client est obligatoire.");
      return;
    }
    setClSaving(true);
    const input: ClientInput = {
      type: clType,
      nom: clNom.trim(),
      prenom: clPrenom.trim(),
      contact: clContact.trim(),
      email: clEmail.trim(),
      telephone: clTel.trim(),
      adresse: "",
      codePostal: "",
      ville: "",
      siren: "",
      notes: "",
    };
    try {
      const created = await repository.clients.create(input);
      setClientList((prev) => [...prev, created]);
      setClientId(created.id); // sélection automatique du client créé
      setShowClientForm(false);
      resetClientForm();
      setClSaving(false);
    } catch {
      setClError("Une erreur est survenue à la création du client.");
      setClSaving(false);
    }
  };

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
          <div className="label-row">
            <label htmlFor="ch-client">Client</label>
            {!showClientForm && (
              <button
                type="button"
                className="btn-link"
                onClick={() => setShowClientForm(true)}
              >
                <i className="ti ti-plus" aria-hidden="true" /> Nouveau client
              </button>
            )}
          </div>
          {!showClientForm ? (
            <select
              id="ch-client"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
            >
              <option value="">— Aucun client —</option>
              {clientList.map((c) => (
                <option key={c.id} value={c.id}>
                  {clientLabel(c)}
                </option>
              ))}
            </select>
          ) : (
            <div className="client-subform">
              <div className="field">
                <label htmlFor="cl-type">Type</label>
                <select
                  id="cl-type"
                  value={clType}
                  onChange={(e) => setClType(e.target.value as ClientType)}
                >
                  <option value="particulier">Particulier</option>
                  <option value="professionnel">Professionnel</option>
                </select>
              </div>
              <div className="field field-row">
                <div>
                  <label htmlFor="cl-nom">Nom</label>
                  <input
                    id="cl-nom"
                    type="text"
                    value={clNom}
                    onChange={(e) => setClNom(e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="cl-prenom">Prénom</label>
                  <input
                    id="cl-prenom"
                    type="text"
                    value={clPrenom}
                    onChange={(e) => setClPrenom(e.target.value)}
                  />
                </div>
              </div>
              <div className="field">
                <label htmlFor="cl-contact">Contact</label>
                <input
                  id="cl-contact"
                  type="text"
                  value={clContact}
                  onChange={(e) => setClContact(e.target.value)}
                />
              </div>
              <div className="field field-row">
                <div>
                  <label htmlFor="cl-email">Email</label>
                  <input
                    id="cl-email"
                    type="email"
                    value={clEmail}
                    onChange={(e) => setClEmail(e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="cl-tel">Téléphone</label>
                  <input
                    id="cl-tel"
                    type="tel"
                    value={clTel}
                    onChange={(e) => setClTel(e.target.value)}
                  />
                </div>
              </div>
              {clError && <div className="err">{clError}</div>}
              <div className="subform-actions">
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => {
                    setShowClientForm(false);
                    resetClientForm();
                  }}
                  disabled={clSaving}
                >
                  Annuler
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={createClient}
                  disabled={clSaving}
                >
                  {clSaving ? "Création…" : "Créer le client"}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="field">
          <label htmlFor="ch-adresse">Adresse</label>
          <AddressAutocomplete
            id="ch-adresse"
            value={adresse}
            placeholder="Commence à taper l'adresse…"
            onChange={setAdresse}
            onSelect={(v) => {
              setAdresse(v.adresse);
              setCodePostal(v.codePostal);
              setVille(v.ville);
            }}
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
            {saving
              ? "Enregistrement…"
              : mode === "edit"
                ? "Enregistrer"
                : "Créer le chantier"}
          </button>
        </div>
      </div>
    </div>
  );
}
