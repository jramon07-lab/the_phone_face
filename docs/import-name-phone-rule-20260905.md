# Revised contact identity rule

User correction: matching normalized full name and any phone confirms a duplicate unless both nonempty DNIs disagree. Missing DNI is allowed; incoming DNI can complete an empty CRM DNI. Name-only matches are surfaced for review, never confirmed solely by name. Multiple confirmed CRM targets remain ambiguous. Confirmed matches cannot create a separate contact through import. Existing append-only notes/observations and explicit selected fields are preserved.

Tests: tests/import-review.cjs includes missing DNI on one/both sides, conflicting DNI, name-only candidates, enrichment and note preservation. No contacts imported or CRM data changed during validation. Predecessor: 24d9066a29fa35ac03a84b996353672907c627f5; fixed Preview retained at https://the-phone-face-app-whatsapp-fotos-y-multimedia-dzo88i9s5.vercel.app/.
