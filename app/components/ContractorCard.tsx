import styles from "./SearchForm.module.css";

export type ContractorMatch = {
  id: string;
  name: string;
  category: string;
  city: string;
  priceKzt: number;
  explanation: string;
  synthetic?: boolean;
  imputed?: boolean;
};

export default function ContractorCard({ match }: { match: ContractorMatch }) {
  return (
    <article className={styles.card}>
      <div className={styles.cardTopline}>
        <span>{match.category}</span>
        <span>{match.city}</span>
      </div>
      <h3>{match.name}</h3>
      <p className={styles.price}>{formatMoney(match.priceKzt)}</p>
      <p className={styles.explanation}>{match.explanation}</p>
      {(match.synthetic || match.imputed) && (
        <div className={styles.badges} aria-label="Особенности данных">
          {match.synthetic && <span>Синтетический профиль</span>}
          {match.imputed && <span>Часть данных восстановлена</span>}
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
