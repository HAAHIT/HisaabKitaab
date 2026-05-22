---
name: Credit notes — no bill validation
description: User does not want credit/debit notes validated against original bill amount or linked to Bill records
type: feedback
---

Do not validate credit note / debit note amounts against the original invoice amount, and do not link credit notes to actual Bill records via foreign key. The `originalInvoiceNo` field should remain free-text.

**Why:** User considers this intentional — advance adjustments and partial returns are valid business scenarios that would be blocked by strict bill linking.

**How to apply:** Skip edge case #13 (uncapped credit notes) and #32 (unlinked credit notes) in any future audit or fix pass. Do not add FK constraints or amount caps to credit/debit note creation.
