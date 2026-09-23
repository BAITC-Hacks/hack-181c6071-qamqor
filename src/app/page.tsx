import SearchForm from "./components/SearchForm";
import { loadContractors } from "@/lib/csv";

export default async function Home() {
  const contractors = await loadContractors();
  const categoryCounts = new Map<string, number>();
  for (const contractor of contractors) {
    for (const category of contractor.categories) {
      categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1);
    }
  }
  const catalogCategories = [...categoryCounts].sort(([left], [right]) => left.localeCompare(right, "ru"))
    .map(([name, count]) => ({ name, count }));
  const featuredIds = ["HK-80581", "HK-44733", "HK-39372"];
  const featured = featuredIds.flatMap((id) => {
    const contractor = contractors.find((item) => item.id === id);
    return contractor ? [{
      id: contractor.id,
      name: contractor.name,
      category: contractor.categories[0],
      city: contractor.city,
      priceFromKzt: contractor.priceFromKzt,
      priceImputed: contractor.priceImputed,
    }] : [];
  });

  return <SearchForm
    featured={featured}
    catalogCategories={catalogCategories}
    catalogStats={{
      profiles: contractors.length,
      categories: catalogCategories.length,
      cities: new Set(contractors.map((item) => item.city)).size,
    }}
  />;
}
