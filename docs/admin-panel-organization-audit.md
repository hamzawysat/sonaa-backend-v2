# Admin panel organization — phase 1 audit

Repository: `hamzawysat/sonaa-backend-v2`
Working branch: `admin-panel-organization-2026-11-14`
Baseline: `backup/admin-organization-before-phase1-2026-11-14`

## Navigation inventory

Eight navigation groups, 29 tabs:

| Group | Tabs |
|---|---|
| الرئيسية | dashboard, stats |
| إدارة العملاء | clients, orders |
| إدارة الفنيين | fannis, pending, profileEdits, disabled, levels, offers |
| الإدارة المالية | clientWallet, wallets, topups |
| الاشتراكات والمتجر | commercePlans, commerceSubscriptions, store, storeOrders |
| إدارة الخدمات والمناطق | services, regions |
| خدمة العملاء والتواصل | complaints, support, notifications, content |
| إعدادات وإدارة المنصة | pricing, reports, pageVisits, security, settings, roles |

## Frontend module map

The active admin page loads 12 classic-script modules in dependency order from the new `frontend/js/admin/` domain folders (source files were copied without changing their contents):
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

Current directory grouping: `core/`, `dashboard/`, `technicians/`, `orders/`, `system/`, `commerce/`, `navigation/` and `finance/`. The original flat source files are intentionally retained until the final duplicate/reference audit and behavior verification.

The frontend modules contain approximately 236 top-level function declarations and call a broad API surface (67 distinct literal route prefixes/paths found in the modules). Preserve classic-script ordering and global function names during reorganization; these files are not ES modules.

## Backend route map

Admin routes are composed in `src/routes/admin.js` and delegated to 15 route modules: services, platform, operations, orders, users, clients, wallet, clientWallet, commerce, store, fanniManagement, fanniProfiles, offers, complaints and uiLayout.

Fine-grained authorization is enforced in `src/middleware/auth.js` through `PERMISSION_SECTIONS`, role defaults and sparse custom overrides. The UI also has a separate tab-to-permission map in `admin-core.js`; both layers must remain aligned. Unknown backend endpoints are intentionally denied to non-root admin roles.

## Duplicate and serving-path findings

- `frontend/admin.html` and root `admin.html` are not identical (32,486 vs 32,277 bytes at audit time); the frontend copy has three additional script tags.
- The production build copies `frontend/` into `frontend-dist/`; the server prefers `frontend-dist` and separately serves the repository frontend for editor preview. The root-level HTML file is not copied by the frontend build.
- The admin page is intentionally hidden from public static URLs and served only through the configured private admin path; do not expose it while reorganizing files.
- The current admin page had a 29,687-byte inline style block, 386 `!important` declarations, and 20 script tags. The inline style block has now been extracted to `frontend/css/admin-layout.css`; the stylesheet is linked before the shared theme and brand styles, preserving cascade order. No inline style block or style attribute remains in `frontend/admin.html`. The 12 new module paths were checked against all script references and each file exists. Script execution order is unchanged.

## Constraints for subsequent phases

1. Preserve all tab IDs, labels, counts, API URLs, request payloads, permission keys, global handler names and script execution order.
2. Do not merge to `main` or deploy during this work.
3. Do not delete duplicate or legacy files until the full reference/dependency audit and behavior checks prove they are unused.
4. Do not delete old backups until final verification; at the end retain only the newest verified backup.
5. Do not use echo; do not interrupt for routine progress updates.

## Static verification after the first organization pass

- 8 navigation groups and 29 tabs remain registered.
- All 29 tabs have a render path. All regular tabs have a frontend permission key; `security` and `roles` intentionally remain root-admin-only and are denied to subordinate roles.
- 185 inline event-handler attributes were found across the admin module templates, calling 115 distinct handler names. The only statically unbound handler name is `openFanniProfileEditor`, which is intentionally exported as `window.openFanniProfileEditor`.
- 12 new script paths are present and resolve to files in the frontend source tree.
- The server prefers `frontend-dist`, then `frontend`; the build script recursively copies the entire frontend tree, so nested admin JS paths are included automatically.
- GitHub Actions returned no workflow runs for the organization commit. At the first-pass checkpoint, browser-level and local Node verification had not yet run; final CI verification is recorded below.

## Permission alignment correction found during the API audit

The client-service refund action calls `/api/admin/client-wallet/orders/:sn/refund`. The backend classifies all `/client-wallet/*` routes under the `wallet` permission, while the frontend had a one-off override that classified this refund endpoint as `orders`. The override was removed. The refund button now also requires wallet write permission in addition to the current order-tab write guard, and the backend permission suite now includes explicit read-only-denied / wallet-manager-allowed assertions for this refund route.

## Duplicate cleanup performed

After confirming the server always selects the existing `frontend-dist/` or `frontend/` directory before the repository root, and confirming no active frontend page references the legacy root scripts, the unreachable root `admin.html` and its root-level admin script duplicates were removed. The original flat admin JS files under `frontend/js/` were also removed after the new nested files were verified to be byte-for-byte copies and all 12 HTML script references were confirmed to resolve. Regression assertions were added to `src/tests/runTests.js` to keep these paths and removals consistent.

The unreachable root-level `css/theme.css` and `css/hamzawy-sat-brand.css` copies were also removed. The active stylesheet copies remain under `frontend/css/`, which is the static source directory selected by the server and copied by the frontend build.

The same serving-path proof was applied to the repository-root copies of `index.html`, `client.html`, `fanni.html`, `technicians.html`, `password.html`, `support.html` and `editor.html`: every server page lookup resolves the corresponding existing `frontend/` copy first, and the server's static middleware serves only `frontend-dist/` or `frontend/`. Those unreachable root copies were removed, with regression assertions added. The dedicated `frontend/download.html` route remains intact.

Root-level copies of `web-push.js`, `page-visit.js`, `manifest.webmanifest`, `service-worker.js`, `robots.txt`, `js/preview-bootstrap.js`, `js/shared-editor-bridge.js`, `js/ui-layout-loader.js` and `js/shared-preview-links.js` were removed after confirming their active counterparts remain under `frontend/` and the server does not register direct root-file routes for them. The explicitly served `frontend/download.html`, frontend service worker, frontend manifest, and public image assets were preserved.

A baseline-to-work-branch comparison confirmed that 11 of the 12 reorganized JS modules are byte-for-byte identical to their previous source files; the remaining core module differs only by the refund permission alignment correction described above. The extracted stylesheet is an exact copy of the former inline style block, and the 12-script execution order is unchanged.

The refresh/notification wiring audit confirmed that the admin-wide refresh remains at 60 seconds with visibility/focus recovery, store order-count and new-order notification polling remains at 15 seconds with visibility recovery, and the admin page still loads the web-push and page-visit clients. Regression tests were added for these contracts; they are static checks and do not replace browser runtime testing.

## UI permission guard audit

The event-handler audit found several mutating actions that were protected by the API but missing from the UI's disabled-button guard list. The list now covers subscription creation/detail edits, client wallet debit/settlement, password changes/support-password issuance, announcement changes, service-category ordering, region restore and bulk region actions. Cross-domain actions now also check their backend permission key: wallet mutations/read ledger, commerce subscription creation, support-password read/write, and client profile details. This keeps disabled-state feedback aligned with server authorization rather than relying only on the current tab's permission.

A second pass across all 12 frontend modules found no remaining mutating template handlers outside the write-action guard list. Remaining unlisted handlers are read, search/filter, navigation, selection or modal controls; the three cross-domain read actions (client profile, wallet ledger and support-password reveal) have explicit permission checks.

## Final navigation correction

The approved eight-group structure separates finance from client and technician management without changing any of the 29 tab IDs, labels, API endpoints or permission keys. The dedicated `الإدارة المالية` group now contains `clientWallet`, `wallets` and `topups`; client management contains only clients and orders, and technician management contains only technician operations. Pending-count badges were reassigned to the group that now owns each queue. The structure regression test now asserts all eight group IDs and the three finance tabs.

## Final dependency cleanup and verification

The final reference pass removed only files proven redundant or unreachable: root-level copies of assets already served from `frontend/`; the unused legacy `admin-audio-review.js` (the active audio-review UI and handlers are already implemented in `admin-orders.js`); the unreferenced palette preview utility; and the old editor backup copies. The active `frontend/admin-setup.html`, `frontend/customers.html`, Google site-verification file, sitemap, shared logo, and all assets referenced by the live pages were retained. The logo placeholder remains because active pages reference `/images/LOGO_UPLOAD_HERE/logo.png`.

The final navigation order is: الرئيسية, إدارة العملاء, إدارة الفنيين, الإدارة المالية, الاشتراكات والمتجر, إدارة الخدمات والمناطق, خدمة العملاء والتواصل, إعدادات وإدارة المنصة. The finance group owns client wallet, technician wallet and wallet top-up tabs; all 29 tab IDs and permission mappings remain unchanged.

GitHub Actions run `43538810367` completed successfully on the eight-group revision: dependency installation, backend integration/security tests, frontend browser smoke tests, and the high-severity dependency audit all passed. This is CI verification; no production deployment or merge was performed.

The browser-navigation pass exposed that the web back button could not return from a section to the group menu. `goBack()` now returns web users to the eight-group home navigation; the native WebView back-message/history behavior is preserved. The browser smoke test opens each of the 29 tabs and returns to the home navigation between tabs.
