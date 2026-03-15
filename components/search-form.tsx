"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";

export function SearchForm() {
  const params = useSearchParams();
  const router = useRouter();
  const [term, setTerm] = useState(params.get("q") ?? "");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const url = term.trim() ? `/?q=${encodeURIComponent(term.trim())}` : "/";
    router.push(url);
  }

  return (
    <form className="search-form" onSubmit={handleSubmit}>
      <input
        type="text"
        value={term}
        onChange={(event) => setTerm(event.target.value)}
        placeholder="Pesquisar por nome da arte"
        className="text-input"
      />
      <button type="submit" className="button-primary">
        Pesquisar
      </button>
    </form>
  );
}
