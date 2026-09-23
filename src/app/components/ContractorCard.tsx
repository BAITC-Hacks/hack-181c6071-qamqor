import type { ContractorMatch } from "@/lib/types";
import styles from "./SearchForm.module.css";

export default function ContractorCard({ match }: { match: ContractorMatch }) {
  const { contractor } = match;
  const imputed = contractor.cityImputed || contractor.priceImputed;

  return (
    <article className={styles.card}>
      <div className={styles.cardTopline}>
        <span>{contractor.categories.join(", ")}</span>
        <span>{contractor.city}</span>
      </div>
      <h3>{contractor.name}</h3>
      <p className={styles.price}>от {formatMoney(contractor.priceFromKzt)}</p>
      <p className={styles.explanation}>{match.explanation}</p>
      {(contractor.synthetic || imputed) && (
        <div className={styles.badges} aria-label="Особенности данных">
          {contractor.synthetic && <span>Синтетический профиль</span>}
          {imputed && <span>Часть данных восстановлена</span>}
        </div>
      )}
    </article>
  );
}

function formatMoney(amount: number) {
  return new Intl.NumberFormat("ru-KZ", {
    style: "currency",
    currency: "KZT",
    maximumFractionDigits: 0,
  }).format(amount);
}
