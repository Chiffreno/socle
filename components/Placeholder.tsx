import styles from "./Placeholder.module.css";

export default function Placeholder({
  icon,
  title,
  subtitle,
}: {
  icon: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className={styles.wrap}>
      <div className={styles.icon}>
        <i className={`ti ti-${icon}`} aria-hidden="true" />
      </div>
      <div className={styles.eyebrow}>Bientôt disponible</div>
      <h1 className={styles.title}>{title}</h1>
      {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
    </div>
  );
}
