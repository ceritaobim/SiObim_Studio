import { PageHeader } from "@/components/ui/page-header";
import { CharactersManager } from "@/features/characters/characters-manager";
import { listStudioCharacters } from "@/lib/characters/character-store";

export const dynamic = "force-dynamic";

export default async function CharactersPage() {
  const characters = listStudioCharacters();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Karakter Utama & Sampingan (Origami Cast)"
        subtitle="Upload gambar referensi karakter, beri nama, atur ciri visual kertas origami & sifatnya, serta tambahkan karakter sampingan agar konsisten di semua prompt video Google Flow."
        milestoneLabel="Identitas Karakter"
        statusLabel={`${characters.length} Karakter Tersimpan`}
      />

      <CharactersManager initialCharacters={characters} />
    </div>
  );
}
