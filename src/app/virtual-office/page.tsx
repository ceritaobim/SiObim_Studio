import { VirtualOfficeView } from "@/features/virtual-office/VirtualOfficeView";

export const metadata = {
  title: "Obim Studio 3D Virtual Office — Game Simulation",
  description:
    "Simulasi Kantor Virtual 3D Interaktif CeritaObim Studio: 11 Profil Chrome Video, Tim Produser, Lounge Istirahat & AI Telegram.",
};

export const dynamic = "force-dynamic";

export default function VirtualOfficeStandalonePage() {
  return (
    <main className="w-screen h-screen overflow-hidden bg-[#0a0f18] select-none">
      <VirtualOfficeView />
    </main>
  );
}
