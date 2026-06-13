// ============================================================
// SOCLE — Contrat uniforme des box de configuration "segments"
//
// Tous les configurateurs à segments (cloisons, faux-plafond, ITI…) exposent
// la MÊME interface → l'éditeur les branche via un registre, sans code en dur
// par lot. Chaque box lit ses réglages dans `o` (chute/entraxe/bandes/…) et
// remonte : un nouveau segment configuré (onAdd) et les réglages lot (onPatchO).
// ============================================================

export interface SegmentConfigBoxProps {
  /** `lot.o` du lot courant (réglages niveau lot : chute, entraxe, bandes…). */
  o: Record<string, unknown>;
  /** Ajoute un segment configuré (cumul géré côté éditeur). cfg = dims de config. */
  onAdd: (cfg: Record<string, unknown>) => void;
  /** Patch des réglages niveau lot (ex. { chute }, { entraxe }, { bandes }). */
  onPatchO: (patch: Record<string, unknown>) => void;
}
