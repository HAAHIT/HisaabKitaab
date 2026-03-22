import { redirect } from "next/navigation";

export default function LegacyMeasurementsNewPage() {
  redirect("/measurements/upload");
}
