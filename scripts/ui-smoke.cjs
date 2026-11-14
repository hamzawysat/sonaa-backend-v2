'use strict';

const { chromium } = require('playwright');

const BASE = process.env.SONAA_SMOKE_BASE || 'http://127.0.0.1:4173';
const pages = [
  { path: '/index.html', name: 'home' },
  { path: '/client.html', name: 'client' },
  { path: '/fanni.html', name: 'technician' },
  { path: '/admin-smoke-panel-20261105', name: 'admin' },
  { path: '/password.html?role=client', name: 'password' },
  { path: '/support.html', name: 'support' },
  { path: '/admin-setup.html', name: 'admin-setup' }
];

function apiResponse(pathname) {
  if (pathname.endsWith('/services')) {
    return { categories: [{ label: 'اختبار', services: ['كهرباء'] }], services: ['كهرباء'] };
  }
  if (pathname.endsWith('/areas')) return { areas: ['القاهرة', 'الجيزة'] };
  if (pathname.endsWith('/content')) return { content: [] };
  if (pathname.endsWith('/wallet-settings')) return {};
  if (pathname.includes('/notifications')) return { notifications: [], unreadCount: 0 };
  if (pathname.includes('/page-visits')) return { ok: true };
  return { ok: true, data: [], requests: [], cases: [], recoveries: [] };
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const failures = [];
  const overflow = [];

  try {
    for (const viewport of [
      { name: 'desktop', width: 1365, height: 900 },
      { name: 'mobile', width: 360, height: 800 }
    ]) {
      for (const target of pages) {
        const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
        if (target.name === 'technician' && viewport.name === 'mobile') {
          await page.addInitScript(() => {
            const nativeSetInterval = window.setInterval.bind(window);
            window.__sonaaIntervalDelays = [];
            window.setInterval = (handler, delay, ...args) => {
              window.__sonaaIntervalDelays.push(Number(delay));
              return nativeSetInterval(handler, delay, ...args);
            };
          });
        }
        const pageErrors = [];
        const badLocalResponses = [];

        page.on('pageerror', error => pageErrors.push(error.message));
        page.on('response', response => {
          const url = new URL(response.url());
          if (url.origin === BASE && (response.status() === 404 || response.status() >= 500)) {
            badLocalResponses.push(response.status() + ' ' + url.pathname);
          }
        });

        if (process.env.SONAA_SMOKE_REAL_API !== '1') {
          await page.route('**/api/**', async route => {
            const url = new URL(route.request().url());
            await route.fulfill({
              status: 200,
              contentType: 'application/json; charset=utf-8',
              body: JSON.stringify(apiResponse(url.pathname))
            });
          });
        }

        try {
          const response = await page.goto(BASE + target.path, { waitUntil: 'domcontentloaded', timeout: 20000 });
          if (!response || response.status() !== 200) {
            failures.push(target.name + '/' + viewport.name + ': page did not return HTTP 200');
          }
          await page.waitForTimeout(900);

          if (target.name !== 'home' && !await page.locator('#app, #setupForm, #main, main.wrap').count()) {
            failures.push(target.name + '/' + viewport.name + ': expected page root was not rendered');
          }

          const dimensions = await page.evaluate(() => ({
            viewport: document.documentElement.clientWidth,
            document: document.documentElement.scrollWidth
          }));
          if (dimensions.document > dimensions.viewport + 2) {
            overflow.push(target.name + '/' + viewport.name + ': ' + dimensions.document + 'px content in ' + dimensions.viewport + 'px viewport');
          }

          if (viewport.name === 'desktop') {
            if (target.name === 'client') {
              await page.locator('#accountPhone').fill('123');
              await page.locator('#accountPassword').fill('x');
              await page.locator('.account-submit').click();
              await page.getByText('رقم الموبايل غير صحيح؛ اكتب 11 رقمًا يبدأ بـ 01.').waitFor({ state: 'visible', timeout: 3000 });

              const clientHeadStyles = await page.locator('head link[rel="stylesheet"]').evaluateAll(items => items.map(item => new URL(item.href).pathname));
              const clientStyleOrder = [
                '/css/client-foundation.css',
                '/css/client-layout.css',
                '/css/theme.css',
                '/css/hamzawy-sat-brand.css',
                '/css/client-components.css'
              ].map(path => clientHeadStyles.indexOf(path));
              const clientHtmlSource = await (await page.request.get(BASE + '/client.html')).text();
              const clientActionsSource = await (await page.request.get(BASE + '/js/client-actions.js')).text();
              const clientAccountSource = await (await page.request.get(BASE + '/js/client-account.js')).text();
              const clientComponentsSource = await (await page.request.get(BASE + '/css/client-components.css')).text();
              const orderPollingIntervals = (clientActionsSource.match(/},\\s*25000\\);/g) || []).length;
              if (clientStyleOrder.some(index => index < 0) ||
                  clientStyleOrder.some((index, position) => position > 0 && index <= clientStyleOrder[position - 1]) ||
                  /<style\\b/i.test(clientHtmlSource) ||
                  /<style\\b/i.test(clientAccountSource) ||
                  clientHtmlSource.includes(':root{--navy:') ||
                  clientHtmlSource.includes('#app .client-section-tabs{') ||
                  orderPollingIntervals < 2 ||
                  !/setInterval\\(refreshTrackedChatSilently,\\s*10000\\)/.test(clientActionsSource) ||
                  clientActionsSource.includes('},3000);') ||
                  clientActionsSource.includes('},2000);' ) ||
                  !clientComponentsSource.includes('@keyframes client-refresh-spin')) {
                failures.push('client/desktop: extracted styles or 25s/10s polling cadence is incorrect');
              }

              const editorSectionValues = {
                new: 'client:new-order',
                orders: 'client:my-orders',
                track: 'client:track',
                wallet: 'client:wallet',
                subscriptions: 'client:subscriptions',
                store: 'client:store',
                complaint: 'client:complaint'
              };
              const clientSections = Object.keys(editorSectionValues);
              const editorOptions = await page.evaluate(async () => {
                const response = await fetch('/editor.html');
                const markup = await response.text();
                const editorDocument = new DOMParser().parseFromString(markup, 'text/html');
                return [...editorDocument.querySelectorAll('#subPageSelect option')].map(option => option.value);
              });
              const editorScript = await (await page.request.get(BASE + '/js/editor.js')).text();
              for (const section of clientSections) {
                const optionValue = editorSectionValues[section];
                if (!editorOptions.includes(optionValue) || !editorScript.includes(optionValue)) {
                  failures.push('client/desktop: shared editor is missing the ' + section + ' section');
                }
                const previewResponse = await page.goto(BASE + '/client.html?preview=true&section=' + section, {
                  waitUntil: 'domcontentloaded', timeout: 15000
                });
                if (!previewResponse || previewResponse.status() !== 200) {
                  failures.push('client/desktop: preview route failed for ' + section);
                  continue;
                }
                await page.waitForFunction(expected => window.IS_EDITOR_PREVIEW === true && state.tab === expected,
                  section, { timeout: 5000 });
              }

              await page.goto(BASE + '/client.html?preview=true&section=new', { waitUntil: 'domcontentloaded' });
              await page.waitForFunction(() => state.tab === 'new', { timeout: 5000 });
              await page.evaluate(() => window.postMessage({ action: 'openSection', section: 'wallet' }, '*'));
              await page.waitForFunction(() => state.tab === 'wallet', { timeout: 5000 });
              await page.goto(BASE + '/client.html', { waitUntil: 'domcontentloaded' });
              await page.locator('#accountPhone').waitFor({ state: 'visible', timeout: 5000 });

              if (process.env.SONAA_SMOKE_REAL_API === '1') {
                await page.locator('#accountPhone').fill('01012345670');
                await page.locator('#accountPassword').fill('ClientSmokePass123');
                await page.locator('.account-submit').click();
                await page.waitForFunction(() => !!localStorage.getItem('sonaa_client_account_token'), { timeout: 10000 });
              }
            } else if (target.name === 'technician') {
              await page.locator('#fanniLoginPhone').fill('123');
              await page.locator('#fanniLoginPassword').fill('x');
              await page.getByRole('button', { name: 'دخول إلى حسابي' }).click();
              await page.getByText('رقم التليفون غير صحيح').waitFor({ state: 'visible', timeout: 3000 });
              if (process.env.SONAA_SMOKE_REAL_API === '1') {
                await page.locator('#fanniLoginPhone').fill('01012345671');
                await page.locator('#fanniLoginPassword').fill('FanniSmokePass123');
                await page.getByRole('button', { name: 'دخول إلى حسابي' }).click();
                await page.waitForFunction(() => !!localStorage.getItem('fanni_token_v4'), { timeout: 10000 });
                const technicianNavigation = await page.evaluate(() => ({
                  tabs: typeof TECHNICIAN_TAB_DEFINITIONS !== 'undefined' ? TECHNICIAN_TAB_DEFINITIONS.map(tab => tab.id) : [],
                  notificationBell: !!document.querySelector('button[aria-label="الإشعارات"]'),
                  supportLink: !!document.querySelector('a.support-float[href="support.html?role=fanni"]')
                }));
                if (technicianNavigation.tabs.join(',') !== 'home,available,myOrders,wallet,store,profile,support' ||
                    !technicianNavigation.notificationBell || !technicianNavigation.supportLink) {
                  failures.push('technician/desktop: dashboard sections or notification/support placement is incorrect');
                }
                const initialTab = await page.evaluate(() => state.tab);
            if (initialTab !== 'home') failures.push('technician/mobile: dashboard did not open on the home section');
                const pollingStarted = await page.evaluate(() => !!fanniChatsPollTimer && !!fanniMessagesPollTimer);
                if (!pollingStarted) failures.push('technician: chat/message polling did not start after login');
                await page.getByRole('button', { name: /الدعم الفني/ }).first().waitFor({ state: 'visible', timeout: 3000 });
                await page.evaluate(() => setTab('myOrders'));
                await page.getByRole('button', { name: /المهام المكتملة/ }).click();
                await page.getByRole('heading', { name: 'المهام المكتملة' }).waitFor({ state: 'visible', timeout: 3000 });
                await page.getByRole('button', { name: /العروض الجارية/ }).click();
                await page.getByRole('heading', { name: 'عروضي' }).waitFor({ state: 'visible', timeout: 3000 });
                await page.evaluate(() => setTab('profile'));
                await page.getByRole('button', { name: /تغيير كلمة المرور/ }).waitFor({ state: 'visible', timeout: 3000 });
                await page.locator('button[onclick="beginEditProfile()"]').click();
                await page.locator('#fanniEditPhone').fill('01012345672');
                await page.locator('button[onclick="saveProfileChanges()"]').click();
                await page.locator('button[onclick="beginEditProfile()"]').waitFor({ state: 'visible', timeout: 10000 });
                await page.locator('#toast').getByText(/تم إرسال طلب تعديل بيانات/).waitFor({ state: 'visible', timeout: 3000 });
                await page.route('**/api/areas', route => route.fulfill({
                  status: 200,
                  contentType: 'application/json; charset=utf-8',
                  body: JSON.stringify({ message: 'فشل اختبار تحميل المناطق' })
                }));
                await page.locator('#global-refresh').click();
                await page.locator('#toast').getByText(/تعذر تحديث: مناطق العمل/).waitFor({ state: 'visible', timeout: 8000 });
                await page.unroute('**/api/areas');
              }
            } else if (target.name === 'admin') {
              await page.locator('#login-btn').click();
              await page.getByText('اكتب البيانات').waitFor({ state: 'visible', timeout: 3000 });
              if (process.env.SONAA_SMOKE_REAL_API === '1') {
                await page.locator('#login-phone').fill('01012345678');
                await page.locator('#login-pass').fill('AdminSmokePass123');
                await page.locator('#login-btn').click();
                await page.waitForFunction(() => !!localStorage.getItem('admin_token_v3'), { timeout: 10000 });
                await page.waitForTimeout(1200);
              }
            }
          }

          if (viewport.name === 'mobile' && target.name === 'client') {
            const clientTabs = ['new', 'orders', 'track', 'wallet', 'subscriptions', 'store', 'complaint'];
            const loadedClientCss = await page.locator('link[rel="stylesheet"]').evaluateAll(items =>
              items.map(item => new URL(item.href).pathname));
            if (!loadedClientCss.includes('/css/client-foundation.css') ||
                !loadedClientCss.includes('/css/client-layout.css') ||
                !loadedClientCss.includes('/css/client-components.css')) {
              failures.push('client/mobile: one or more extracted client stylesheets are missing');
            }
            for (const tab of clientTabs) {
              await page.goto(BASE + '/client.html?preview=true&section=' + tab, {
                waitUntil: 'domcontentloaded', timeout: 15000
              });
              await page.waitForFunction(expected => window.IS_EDITOR_PREVIEW === true && state.tab === expected,
                tab, { timeout: 5000 });
              const tabDimensions = await page.evaluate(() => ({
                viewport: document.documentElement.clientWidth,
                document: document.documentElement.scrollWidth
              }));
              if (tabDimensions.document > tabDimensions.viewport + 2) {
                overflow.push('client/' + tab + '/mobile: ' + tabDimensions.document + 'px content in ' + tabDimensions.viewport + 'px viewport');
              }
            }
            await page.goto(BASE + '/client.html?preview=true&section=new', { waitUntil: 'domcontentloaded' });
            await page.waitForFunction(() => state.tab === 'new', { timeout: 5000 });
            await page.evaluate(() => window.postMessage({ action: 'openSection', section: 'wallet' }, '*'));
            await page.waitForFunction(() => state.tab === 'wallet', { timeout: 5000 });
          }

          if (viewport.name === 'mobile' && target.name === 'technician' && process.env.SONAA_SMOKE_REAL_API === '1') {
            await page.locator('#fanniLoginPhone').fill('01012345671');
            await page.locator('#fanniLoginPassword').fill('FanniSmokePass123');
            await page.getByRole('button', { name: 'دخول إلى حسابي' }).click();
            await page.waitForFunction(() => !!localStorage.getItem('fanni_token_v4'), { timeout: 10000 });
            await page.waitForFunction(() => state.tab === 'home', { timeout: 5000 });

            const resources = await page.evaluate(() => ({
              css: [...document.querySelectorAll('link[rel="stylesheet"]')].map(item => item.href).filter(url => url.includes('/css/fanni-')),
              scripts: [...document.querySelectorAll('script[src]')].map(item => item.src).filter(url => url.includes('/js/fanni-'))
            }));
            if (new Set(resources.css).size !== resources.css.length || new Set(resources.scripts).size !== resources.scripts.length) {
              failures.push('technician/mobile: duplicate CSS or JavaScript module references detected');
            }

            const expectedTabs = [
              ['الرئيسية', 'home'],
              ['فرص العمل', 'available'],
              ['طلباتي', 'myOrders'],
              ['المحفظة', 'wallet'],
              ['المتجر', 'store'],
              ['حسابي', 'profile']
            ];
            for (const [label, tab] of expectedTabs) {
              try {
                const tabButton = page.locator(`button[onclick="openTechnicianSection('${tab}')"]`).first();
                await tabButton.click({ timeout: 8000 });
                await page.waitForTimeout(120);
                const isActive = await page.evaluate(expected => [...document.querySelectorAll('button')]
                  .some(button => button.getAttribute('onclick') === "openTechnicianSection('" + expected + "')" &&
                    String(button.className).includes('from-[#C9A34F]')), tab);
                if (!isActive) failures.push('technician/mobile: navigation did not activate the ' + tab + ' section');
              } catch (error) {
                failures.push('technician/mobile: ' + tab + ' navigation click failed: ' + error.message);
                throw error;
              }
            }

            const polling = await page.evaluate(() => ({
              chats: !!fanniChatsPollTimer,
              messages: !!fanniMessagesPollTimer,
              bell: !!document.querySelector('button[aria-label="الإشعارات"]'),
              intervals: window.__sonaaIntervalDelays || []
            }));
            if (!polling.chats || !polling.messages || !polling.bell ||
                polling.intervals.filter(delay => delay === 25000).length !== 1 ||
                polling.intervals.filter(delay => delay === 10000).length !== 1) {
              failures.push('technician/mobile: polling timers must run once at 25s and 10s and keep the notification bell');
            }

            await page.evaluate(() => {
              Object.defineProperty(document, 'hidden', { configurable: true, value: true });
              document.dispatchEvent(new Event('visibilitychange'));
            });
            const stopped = await page.evaluate(() => !fanniChatsPollTimer && !fanniMessagesPollTimer);
            await page.evaluate(() => {
              Object.defineProperty(document, 'hidden', { configurable: true, value: false });
              document.dispatchEvent(new Event('visibilitychange'));
            });
            const resumed = await page.evaluate(() => !!fanniChatsPollTimer && !!fanniMessagesPollTimer);
            if (!stopped || !resumed) failures.push('technician/mobile: polling did not stop/resume with page visibility');

            await page.locator('button[onclick="openTechnicianSection(\'support\')"]:visible').first().click({ timeout: 8000 });
            await page.waitForURL(url => url.pathname.endsWith('/support.html') && url.searchParams.get('role') === 'fanni', { timeout: 5000 });
          }

          if (pageErrors.length) failures.push(target.name + '/' + viewport.name + ': ' + pageErrors.join(' | '));
          if (badLocalResponses.length) failures.push(target.name + '/' + viewport.name + ': ' + badLocalResponses.join(', '));
        } catch (error) {
          failures.push(target.name + '/' + viewport.name + ': ' + error.message);
        } finally {
          await page.close();
        }
      }
    }
  } finally {
    await browser.close();
  }

  if (overflow.length) {
    console.log('RESPONSIVE OVERFLOW WARNINGS:');
    for (const item of overflow) console.log('- ' + item);
  }

  if (failures.length) {
    console.error('FRONTEND BROWSER SMOKE TESTS FAILED:');
    for (const item of failures) console.error('- ' + item);
    process.exitCode = 1;
  } else {
    console.log('Frontend browser smoke tests passed: ' + pages.length + ' pages x 2 viewports = ' + (pages.length * 2) + ' page loads.');
    console.log('Responsive overflow warnings: ' + overflow.length);
  }
})();
