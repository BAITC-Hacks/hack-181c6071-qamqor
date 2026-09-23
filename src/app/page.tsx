import SearchForm from "./components/SearchForm";
import { loadContractors } from "@/lib/csv";

export default async function Home() {
  const contractors = await loadContractors();
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
    catalogStats={{
      profiles: contractors.length,
      categories: new Set(contractors.flatMap((item) => item.categories)).size,
      cities: new Set(contractors.map((item) => item.city)).size,
    }}
  />;
}
