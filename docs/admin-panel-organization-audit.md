# Admin panel organization — phase 1 audit

Repository: `hamzawysat/sonaa-backend-v2`
Working branch: `admin-panel-organization-2026-11-14`
Baseline: `backup/admin-organization-before-phase1-2026-11-14`

## Navigation inventory

Seven navigation groups, 29 tabs:

| Group | Tabs |
|---|---|
| الرئيسية | dashboard, stats |
| إدارة العملاء | clients, clientWallet, orders |
| الاشتراكات والمتجر | commercePlans, commerceSubscriptions, store, storeOrders |
| إدارة الفنيين | fannis, pending, profileEdits, disabled, levels, offers, wallets, topups |
| إدارة الخدمات والمناطق | services, regions |
| خدمة العملاء والتواصل | complaints, support, notifications, content |
| إعدادات وإدارة المنصة | pricing, reports, pageVisits, security, settings, roles |

## Frontend module map

The active admin page loads 12 classic-script modules in dependency order:
- `admin-core.js`: shared state, API wrapper, section registry, permission mapping and guards.
- `admin-shell.js`: authenticated shell, navigation rendering, dashboard and tab dispatch.
- `admin-people.js`: technician, admin-role and support-password views.
- `admin-orders.js`: orders, offers, pricing, technician wallets, topups and complaints.
- `admin-platform.js`: services, regions, notifications, settings, security, reports, visits, support, content, clients and stats.
- `admin-store.js`: store catalog, store orders and store notification counts.
- `admin-navigation.js`: tab changes, filters, refresh and auto-refresh.
- `admin-entity-actions.js`: technician/order/client/topup/complaint actions.
- `admin-platform-actions.js`: services, regions, platform, support, pricing, notifications and client actions.
- `admin-client-wallet.js`: client wallet operations and ledger.
- `admin-commerce.js`: subscription catalog and client subscriptions.
- `admin-auth.js`: admin login.

The frontend modules contain approximately 236 top-level function declarations and call a broad API surface (67 distinct literal route prefixes/paths found in the modules). Preserve classic-script ordering and global function names during reorganization; these files are not ES modules.

## Backend route map

Admin routes are composed in `src/routes/admin.js` and delegated to 15 route modules: services, platform, operations, orders, users, clients, wallet, clientWallet, commerce, store, fanniManagement, fanniProfiles, offers, complaints and uiLayout.

Fine-grained authorization is enforced in `src/middleware/auth.js` through `PERMISSION_SECTIONS`, role defaults and sparse custom overrides. The UI also has a separate tab-to-permission map in `admin-core.js`; both layers must remain aligned. Unknown backend endpoints are intentionally denied to non-root admin roles.

## Duplicate and serving-path findings

- `frontend/admin.html` and root `admin.html` are not identical (32,486 vs 32,277 bytes at audit time); the frontend copy has three additional script tags.
- The production build copies `frontend/` into `frontend-dist/`; the server prefers `frontend-dist` and separately serves the repository frontend for editor preview. The root-level HTML file is not copied by the frontend build.
- The admin page is intentionally hidden from public static URLs and served only through the configured private admin path; do not expose it while reorganizing files.
- The current admin page had a 29,687-byte inline style block, 386 `!important` declarations, and 20 script tags. The inline style block has now been extracted to `frontend/css/admin-layout.css`; the stylesheet is linked before the shared theme and brand styles, preserving cascade order. No inline style block or style attribute remains in `frontend/admin.html`.

## Constraints for subsequent phases

1. Preserve all tab IDs, labels, counts, API URLs, request payloads, permission keys, global handler names and script execution order.
2. Do not merge to `main` or deploy during this work.
3. Do not delete duplicate or legacy files until the full reference/dependency audit and behavior checks prove they are unused.
4. Do not delete old backups until final verification; at the end retain only the newest verified backup.
5. Do not use echo; do not interrupt for routine progress updates.
