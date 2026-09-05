# New contact with a holder from the workbook

From the managing person's Excel row, choose Crear ficha con titular del Excel and select another workbook row as holder. Only contacts eligible for explicit separate creation are offered this action. Existing CRM matches are preserved. Invalid rows and self-pairing are rejected. Explicit relationship and final import confirmations required.

Creates one records row using the managing person's data and existing TPFContactParty validation for the holder. Notes and observations from both are combined using existing append-only diff logic. Contact phone remains the recipient, holder name/DNI/phone stay in TPF_TITULAR. Existing CRM rows are not deleted. Only the managing row's labels/custom fields are imported, as with normal creation.

Before writes, prevents selecting the holder row separately or using the same holder row in two pair creations in one batch. Both source rows marked completed after successful insert. Reanalysis and identity protections retained. Local pure tests: tests/import-excel-pair.cjs plus existing import review tests. No E2E, customer writes or messages in verification.
