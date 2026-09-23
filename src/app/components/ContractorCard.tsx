import styles from "./SearchForm.module.css";
import type { ContractorMatch } from "@/lib/types";

export default function ContractorCard({ match }: { match: ContractorMatch }) {
  const { contractor } = match;
  return (
    <article className={styles.card}>
      <div className={styles.cardTopline}>
        <span>{contractor.categories.join(", ")}</span>
        <span>{contractor.city}</span>
      </div>
      <h3>{contractor.name}</h3>
      <p className={styles.price}>от {formatMoney(contractor.priceFromKzt)}</p>
      <p className={styles.explanation}>{match.explanation}</p>
      {(contractor.synthetic || contractor.cityImputed || contractor.priceImputed) && (
        <div className={styles.badges} aria-label="Особенности данных">
          {contractor.synthetic && <span>Синтетический профиль</span>}
          {(contractor.cityImputed || contractor.priceImputed) && <span>Часть данных восстановлена</span>}
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
