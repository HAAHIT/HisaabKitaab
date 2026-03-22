import { db } from "./src/lib/db";

async function checkDirty() {
  const m = await db.measurements.where("isDirty").equals(1).count();
  const p = await db.parties.where("isDirty").equals(1).count();
  const b = await db.bills.where("isDirty").equals(1).count();
  const pay = await db.payments.where("isDirty").equals(1).count();

  const mt = await db.measurements.where("isDirty").equals(true).count();
  const pt = await db.parties.where("isDirty").equals(true).count();
  const bt = await db.bills.where("isDirty").equals(true).count();
  const payt = await db.payments.where("isDirty").equals(true).count();

  console.log("Dirty (1):", { measurements: m, parties: p, bills: b, payments: pay });
  console.log("Dirty (true):", { measurements: mt, parties: pt, bills: bt, payments: payt });
}

checkDirty();
