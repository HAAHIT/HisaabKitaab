"use client";

import { use } from "react";
import { BillFormPage } from "@/app/(app)/bills/new/page";

export default function EditBillPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <BillFormPage editBillId={id} />;
}
