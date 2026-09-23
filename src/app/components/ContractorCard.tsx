import styles from "./SearchForm.module.css";
import type { ContractorMatch } from "@/lib/types";

export default function ContractorCard({ match }: { match: ContractorMatch }) {
  const { contractor, facts } = match;
  const budgetKzt = contractor.priceFromKzt + facts.withinBudgetByKzt;
  const budgetShare = budgetKzt > 0
    ? Math.min(100, Math.round((contractor.priceFromKzt / budgetKzt) * 100))
    : 0;
  return (
    <article className={styles.card}>
      <div className={styles.cardTopline}>
        <span>{contractor.categories.join(", ")}</span>
        <span>{contractor.city}</span>
      </div>
      <h3>{contractor.name}</h3>
      <p className={styles.price}>от {formatMoney(contractor.priceFromKzt)}</p>
      <div className={styles.budgetBreakdown} aria-label="Сметный ориентир">
        <div className={styles.budgetLine}>
          <span>Лимит на подрядчика</span>
          <strong>{formatMoney(budgetKzt)}</strong>
        </div>
        <div className={styles.budgetTrack} aria-hidden="true">
          <span style={{ width: `${budgetShare}%` }} />
        </div>
        <div className={styles.budgetLine}>
          <span>Остаток до лимита от стартовой цены</span>
          <strong>{formatMoney(facts.withinBudgetByKzt)}</strong>
        </div>
      </div>
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
