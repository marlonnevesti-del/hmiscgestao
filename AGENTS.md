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
- SUS billing (BPA/AIH/APAC) rows, DATASUS pending-issue rules and positional export files live in src/lib/sus-billing.ts; /faturamento-sus shares the faturamento access area so admin area grants stay consistent.
- NIR admission flow: doctors call requestAdmission (no bed); only the nir action authorizes a bed via authorizeAdmission/rejectAdmission in hospital-store, so bed allocation stays centralized.
- Hotelaria bed reads use an approved-user server function and server-only origin/token, with a validated read-only snapshot polled in NIR; NIR authorization reserves the bed atomically in Hotelaria first (reserveHotelariaBed) and only then records it locally, preventing double allocation.

- Admission authorization (NIR or direct) closes the BAA and opens a separately sequenced FIA record on the encounter via openFia in hospital-store, so the FIA is the single official inpatient document and billing never double-counts.
- Care units (Ambulatório, Pronto socorro, Maternidade) share one patient registry and encounter flow; CareUnitPage filters reception, acolhimento and medical queues by encounter.type, and ambulatory specialties/agenda/SADT rules live in src/lib/ambulatorio.ts so pharmacy and billing stay unit-agnostic.
- CME rules (kit status, autoclave cycles, validity, biological block, barcode) live in src/lib/cme.ts; kit use is registered on the surgery via registerCmeKitUse in hospital-store so traceability stays centralized.
- Controlled-cabinet items come from src/lib/controlled-catalog.json merged into the pharmacy stock (location "Armário de Controlados"); expiry status, lot map and monthly consumption/purchase suggestion rules live in src/lib/controlled.ts; dispensations log 'consumo' and expiry write-offs log 'vencimento' movements so the report reads one history.
