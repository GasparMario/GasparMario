import { ArtList } from "@/components/art-list";
import { Header } from "@/components/header";
import { SearchForm } from "@/components/search-form";
import { listArts } from "@/lib/dtf-repository";
import { DtfArt } from "@/lib/dtf";

type HomeProps = {
  searchParams?: {
    q?: string;
  };
};

export default async function HomePage({ searchParams }: HomeProps) {
  const query = searchParams?.q?.trim() || "";

  let items: DtfArt[] = [];
  let errorMessage = "";

  try {
    items = await listArts(query);
  } catch (error) {
    errorMessage =
      error instanceof Error
        ? error.message
        : "Não foi possível carregar as artes. Verifique a configuração do Supabase.";
  }

  return (
    <>
      <Header />
      <main className="container main-content">
        <section className="panel">
          <h1>Gerenciador de estampas DTF</h1>
          <p>Pesquise artes cadastradas e baixe os PDFs em um clique.</p>
          <SearchForm />
          {errorMessage ? <p className="feedback error">{errorMessage}</p> : null}
        </section>

        <section className="panel">
          <h2>Artes cadastradas</h2>
          <ArtList items={items} />
        </section>
      </main>
    </>
  );
}
