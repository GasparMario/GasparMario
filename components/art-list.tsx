import { DtfArt, formatDate } from "@/lib/dtf";

type ArtListProps = {
  items: DtfArt[];
};

export function ArtList({ items }: ArtListProps) {
  if (items.length === 0) {
    return <p className="empty-state">Nenhuma arte encontrada.</p>;
  }

  return (
    <ul className="art-list">
      {items.map((art) => (
        <li key={art.id} className="art-card">
          <div>
            <h3>{art.nome}</h3>
            <p>Tags: {art.tags || "sem tags"}</p>
            <p>Cadastrado em: {formatDate(art.created_at)}</p>
          </div>
          <a href={art.download_url} target="_blank" rel="noreferrer" className="button-secondary">
            Baixar PDF
          </a>
        </li>
      ))}
    </ul>
  );
}
