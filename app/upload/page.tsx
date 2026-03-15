import { Header } from "@/components/header";
import { UploadForm } from "@/components/upload-form";

export default function UploadPage() {
  return (
    <>
      <Header />
      <main className="container main-content">
        <section className="panel">
          <h1>Novo upload de arte DTF</h1>
          <p>Preencha os dados abaixo para armazenar seu PDF no Supabase.</p>
          <UploadForm />
        </section>
      </main>
    </>
  );
}
