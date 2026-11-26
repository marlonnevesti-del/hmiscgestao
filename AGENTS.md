<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## Project rules
- AIH downloads use aih-export.ts for Salux-style filenames, single-byte TXT and identical ZIP contents; retain the official 1800-position interface until Salux's extra control algorithm is validated, never fabricate its signature.
- Billing identifiers are shared through institution.ts; SUS exports and TISS guides must use the same CNES to prevent divergence.
- Reception CPF autofill uses exact normalized matches from patient-registration-mapping; ambiguous matches require selection and identifier changes detach the previous identity to avoid mixed records.
- ICU/UCI prescription shortcuts use the PEP search parameter `aba=prescricao`, opening the shared prescription tab without changing clinical status or prescribing permissions.
- ICU teaching cases are static, isolated documents in icu-examples.ts, exposed in PEP, admissions and SUS billing through virtual chart IDs and training views, never clinical snapshot rows or export inputs, so simulations cannot occupy beds or contaminate billing.
- Medical SIGTAP uses the existing encounter.sigtapCode; shared selection and store guards preserve explicit blanks and block completion, avoiding UI-only validation.
- Maternity assessments use versioned pure rules in `src/lib/maternity.ts` and append-only encounter.maternity entries via saveMaternityRecord; the sector and PEP share them, MEOWS uses color triggers rather than a summed score, and the bed view reads existing CO/FIA assignments without changing NIR reservations.
- Physiotherapy evolution identification is composed by `identifiedPhysioEvolution` from the current patient when a template is selected; this keeps all three models consistent without changing saved evolutions or clinical text.
- Imported physician identifiers stay only in the approved-user clinical snapshot; deduplicate by CRM/UF, match login by council or exact unique name, and never autofill missing, invalid or shared CNS to avoid billing misidentification.
- Clinical/billing catalogs live in `src/lib/hospital-data.ts`, BE transition rules in `src/lib/care-flow.ts`, and the single reactive in-memory clinical state in `src/lib/hospital-store.ts`; screens use `useStore` and centralized actions to prevent sector queues from diverging. Clinical state is persisted as one snapshot row (clinical_state, approved employees only) synced by src/lib/clinical-sync.ts every 3s, last write wins; keeps schema portable to a self-hosted Postgres.
- Employee removal uses the authenticated transactional `remove_employee_access` database function; revoke access and roles while retaining profile history, and protect the principal administrator and caller's own account.
- Profile permissions are centralized in `can(profile, action)`; screens never hardcode role checks.
- Module visibility and direct-URL access use `canAccessPage`; care-unit tabs use `canAccessUnitTab` with "unit:tab" area ids (UNIT_AREAS). Admin-chosen access_areas (set only via set_employee_areas, which whitelists ids) override function-derived defaults from `can`; employee function changes use an authenticated transactional database function so clients cannot change their own permissions.
- App shell (sidebar + topbar) is `src/components/AppShell.tsx`, mounted once by `EmployeeAccessBoundary`, which `__root.tsx` renders.
- Employee identities and approval are persisted in Cloud profiles, with roles in a separate protected user_roles table; only server-authorized operations change access to prevent self-approval.
- The client-only _authenticated layout validates identity and approval before clinical routes; EmployeeAccessBoundary owns the sole auth listener and mounts AppShell only for approved users, preventing public clinical rendering.
- Employee registration validation is shared with its server function; admin review and role grants use transactional authenticated database functions to prevent privilege escalation.
- Registration origins are validated by protocol, not deployment hostnames, so ephemeral HTTPS previews can register employees; the administrator list refreshes every second, including in background tabs, to expose new pending profiles without manual refresh.
- Patient demographics use the shared registration schema, mapping and field editor; store them additively in the clinical snapshot and update clinical display fields centrally to retain legacy records and keep queues consistent.
- Loan returns use the centralized stock action with cumulative returned quantities and per-return history in the clinical snapshot; only the returned quantity changes stock and legacy settled loans remain fully returned.
- NIR admission flow: doctors call requestAdmission (no bed); only the nir action authorizes a bed via authorizeAdmission/rejectAdmission in hospital-store, so bed allocation stays centralized.
- Hotelaria bed reads use an approved-user server function and server-only origin/token, with a validated read-only snapshot polled in NIR; NIR authorization reserves the bed atomically in Hotelaria first (reserveHotelariaBed) and only then records it locally, preventing double allocation.
- Bed occupancy counts come from hotelariaOccupancy/hotelariaOccupancyRate over Hotelaria statuses, so beds the hospital marked occupied there appear in NIR and the census even with no local patient; Hotelaria sends no patient name, so those beds are labelled by source, not by patient.

- Admission authorization (NIR or direct) closes the BAA and opens a separately sequenced FIA record on the encounter via openFia in hospital-store, so the FIA is the single official inpatient document and billing never double-counts.
- Care units (Ambulatório, Pronto socorro, Maternidade) share one patient registry and encounter flow; CareUnitPage filters reception, acolhimento and medical queues by encounter.type, and ambulatory specialties/agenda/SADT rules live in src/lib/ambulatorio.ts so pharmacy and billing stay unit-agnostic.

- Warehouse request categories per user come from `allowedRequestCategories` in src/lib/warehouse-categories.ts: admin-granted "pedido:<categoria>" areas replace job-function defaults, so exceptions need no code changes.
- SCIRAS/CCIH rules (antimicrobial lists, mandatory ATB fields, MDR readmission alert, bundles) live in src/lib/sciras.ts; ATB data rides on the prescription item and isolates/cases/bundles on patient.sciras, so pharmacy blocks restricted drugs via atbBlocksPharmacy without a separate queue.
- Surgical center rules (suspension, SAEP counts, SRPA Aldrete-Kroulik, CO beds, Robson, CC/CO reports) live in src/lib/surgical-center.ts; SAEP/SRPA/obstetric data ride on the Surgery record (CO bed = surgery.coBed) so no new snapshot keys are needed.
- Pronto-Socorro Infantil rules (15 beds: 13 observation and 2 isolation, pediatric scales, sepsis bundles, PCACR/outcome goals, coordination report) live in src/lib/ps-infantil.ts; PS data rides on encounter.ps and the report filters by encounter.type so other doors never mix in.
- Inpatient clinical documents (UTI bed request, surgical description, SOAP evolution, social work, referral) are field configs in src/lib/inpatient-docs.ts stored on encounter.clinicalDocs via saveClinicalDoc; /internacoes (census + readmissions) shares the nir access area, so new documents need no new snapshot keys.
- UTI Pediátrica, UCI and UTI Neonatal are separate configs in src/lib/uti-uci.ts (scales, bundles, balance, evolution templates); their records ride on patient.intensive via addIntensive so no new snapshot keys are needed; /uti-uci shares the enfermagem access area.
- Clinical snapshot changes push instantly via Realtime on clinical_state (3s poll is fallback); BAA/FIA numbers come from the atomic next_clinical_number counter via sequence-pool.ts (pre-reserved so openEncounter stays sync).
