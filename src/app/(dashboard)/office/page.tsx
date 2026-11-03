import { VirtualOfficeManager } from "@/features/office/virtual-office-manager";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Kantor Virtual — CeritaObim Studio",
  description: "Markas agensi virtual Si Obim: Manajer, Produser, Audio, Kreatif & IT",
};

export default function OfficePage() {
  return <VirtualOfficeManager />;
}
