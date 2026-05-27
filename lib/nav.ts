export type NavItem = {
  label: string;
  href: string;
  icon: string; // Tabler icon class suffix (e.g. "checklist" => ti ti-checklist)
  badge?: string;
};

export type NavGroup = {
  label?: string; // section eyebrow ; undefined = no header (ex: Dashboard)
  items: NavItem[];
};

export const NAV_GROUPS: NavGroup[] = [
  {
    items: [{ label: "Dashboard", href: "/dashboard", icon: "layout-dashboard" }],
  },
  {
    label: "Construction",
    items: [
      { label: "Checklist", href: "/construction/checklist", icon: "checklist" },
      { label: "CGV", href: "/construction/cgv", icon: "file-description" },
      { label: "Prévisionnel", href: "/construction/previsionnel", icon: "chart-bar" },
      { label: "Taux Horaire", href: "/construction/taux-horaire", icon: "clock-hour-4" },
      { label: "Décennale", href: "/construction/decennale", icon: "shield-check" },
    ],
  },
  {
    label: "Chantier",
    items: [
      { label: "Prix Matériaux", href: "/chantier/materiaux", icon: "package" },
      { label: "Devis", href: "/chantier/devis", icon: "file-text" },
      { label: "Facture", href: "/chantier/facture", icon: "receipt" },
    ],
  },
  {
    label: "Après",
    items: [
      { label: "PV Réception", href: "/apres/pv-reception", icon: "clipboard-check" },
      { label: "Bibliothèque DTU", href: "/apres/dtu", icon: "book" },
    ],
  },
];

export const NAV_BOTTOM: NavItem[] = [
  { label: "Paramètres", href: "/parametres", icon: "settings" },
  { label: "Déconnexion", href: "/", icon: "logout" },
];
