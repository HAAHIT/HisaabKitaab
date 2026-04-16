import { PurchaseBillForm } from "@/components/bills/PurchaseBillForm";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "New Purchase Bill - HisaabKitaab",
  description: "Create a new purchase bill",
};

export default function NewPurchasePage() {
  return <PurchaseBillForm />;
}
