/**
 * Demo Mode E2E checks against a running Next.js server.
 * Usage: node scripts/test-demo-mode.mjs
 */
import { chromium } from "playwright";

const BASE = process.env.SMOKE_BASE_URL || "http://localhost:3001";
const results = [];

function ok(name, detail = "") {
  results.push({ name, pass: true, detail });
  console.log(`PASS  ${name}${detail ? " — " + detail : ""}`);
}
function fail(name, detail = "") {
  results.push({ name, pass: false, detail });
  console.error(`FAIL  ${name}${detail ? " — " + detail : ""}`);
}

async function main() {
  console.log(`\n=== Demo Mode E2E @ ${BASE} ===\n`);
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.setDefaultTimeout(30000);

  try {
    // 1) Entry page
    await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
    const loginHtml = await page.content();
    if (/Explore Demo Portals/i.test(loginHtml)) ok("Login shows Explore Demo Portals");
    else fail("Login shows Explore Demo Portals");

    if (/Choose any role to enter Demo Mode/i.test(loginHtml)) {
      ok("Login shows Demo Mode explanation copy");
    } else fail("Login shows Demo Mode explanation copy");

    if (/Welcome back/i.test(loginHtml) && /Sign In/i.test(loginHtml)) {
      ok("Normal email/password login form still present");
    } else fail("Normal email/password login form still present");

    // Portal cards (5)
    const portalButtons = page.locator("form button.login-portal-card");
    const portalCount = await portalButtons.count();
    if (portalCount === 5) ok("Five demo portal cards present", String(portalCount));
    else fail("Five demo portal cards present", `got ${portalCount}`);

    // 2) Enter via Executive / Manager (first card)
    await portalButtons.nth(0).click();
    await page.waitForURL(/\/dashboard/, { timeout: 45000 });
    ok("Portal card enters dashboard without credentials");

    // Demo selector visible
    const demoBadge = page.getByText("Demo Mode", { exact: false }).first();
    if (await demoBadge.isVisible()) ok("Demo Mode badge visible after entry");
    else fail("Demo Mode badge visible after entry");

    const roleSelect = page.locator('select[aria-label="Demo Role"]');
    if (await roleSelect.isVisible()) ok("Demo Role selector visible");
    else fail("Demo Role selector visible");

    const identity = await page.locator(".navbar").innerText();
    if (/Morgan Manager/i.test(identity)) ok("Identity is Morgan Manager", "manager");
    else fail("Identity is Morgan Manager", identity.slice(0, 200));

    // Sidebar manager links
    const side = await page.locator(".drawer-side").innerText();
    if (/Profitability/i.test(side) && /Approvals/i.test(side)) {
      ok("Manager nav includes Profitability & Approvals");
    } else fail("Manager nav includes Profitability & Approvals", side.slice(0, 300));

    // 3) Switch through all roles
    const roles = [
      { value: "broker", name: "Blake Broker", navHint: /Broker Operations Dashboard/i },
      { value: "billing", name: "Bailey Billing", navHint: /Billing & Accounting Dashboard|Accounts Receivable/i },
      { value: "customer", name: "Casey Customer", navHint: /Shipper Dashboard|My Shipments/i },
      { value: "carrier", name: "Chris Carrier", navHint: /Carrier Dashboard|My Deliveries|Documents/i },
      { value: "manager", name: "Morgan Manager", navHint: /Executive Dashboard|Profitability/i },
    ];

    for (const role of roles) {
      await roleSelect.selectOption(role.value);
      await page.waitForFunction(
        (name) => (document.body?.innerText || "").includes(name),
        role.name,
        { timeout: 60000 },
      );
      const navText = await page.locator(".navbar").innerText();
      const sideText = await page.locator(".drawer-side").innerText();
      if (navText.includes(role.name)) ok(`Switch to ${role.value} updates identity`, role.name);
      else fail(`Switch to ${role.value} updates identity`, navText.slice(0, 220));

      if (role.navHint.test(sideText)) ok(`Switch to ${role.value} updates sidebar`);
      else fail(`Switch to ${role.value} updates sidebar`, sideText.slice(0, 220));

      if (await roleSelect.isVisible()) ok(`Selector still present as ${role.value}`);
      else fail(`Selector still present as ${role.value}`);
    }

    // 4) Refresh keeps demo mode
    await page.reload({ waitUntil: "networkidle" });
    if (await page.locator('select[aria-label="Demo Role"]').isVisible()) {
      ok("Demo Role selector survives refresh");
    } else fail("Demo Role selector survives refresh");

    const afterRefresh = await page.locator(".navbar").innerText();
    if (/Morgan Manager/i.test(afterRefresh)) ok("Identity survives refresh", "manager");
    else fail("Identity survives refresh", afterRefresh.slice(0, 200));

    // 5) Exit Demo
    await page.getByRole("button", { name: /Exit Demo/i }).click();
    await page.waitForURL(/\/login/, { timeout: 45000 });
    ok("Exit Demo returns to login page");

    if (!(await page.locator('select[aria-label="Demo Role"]').count())) {
      ok("Demo Role selector gone after exit");
    } else fail("Demo Role selector gone after exit");

    // 6) Protected route gated when logged out
    await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
    const url = page.url();
    if (/login/i.test(url)) ok("Dashboard redirects to login when logged out");
    else fail("Dashboard redirects to login when logged out", url);

    // 7) Normal login should NOT show demo selector
    // Use a demo account via password form but without demo cookie — signIn clears demo mode
    await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
    await page.fill('input[name="email"]', "manager@freightflow.example");
    await page.fill('input[name="password"]', "FreightDemo2026!");
    await page.getByRole("button", { name: /^Sign In$/i }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 45000 });
    ok("Normal Sign In reaches dashboard");

    const demoSelectCount = await page.locator('select[aria-label="Demo Role"]').count();
    if (demoSelectCount === 0) ok("Normal Sign In does not show Demo Role selector");
    else fail("Normal Sign In does not show Demo Role selector", `count=${demoSelectCount}`);

    const signOut = page.getByRole("button", { name: /Sign out/i });
    if (await signOut.isVisible()) ok("Normal user sees Sign out (not Exit Demo)");
    else fail("Normal user sees Sign out (not Exit Demo)");

    await signOut.click();
    await page.waitForURL(/\/login/, { timeout: 45000 });
    ok("Normal Sign out returns to login");
  } catch (e) {
    fail("Unhandled test error", e.stack || e.message);
    try {
      await page.screenshot({ path: "scripts/demo-mode-failure.png", fullPage: true });
      console.error("Screenshot: scripts/demo-mode-failure.png");
    } catch {
      /* ignore */
    }
  } finally {
    await browser.close();
  }

  const failed = results.filter((r) => !r.pass).length;
  console.log(`\n=== ${results.length - failed}/${results.length} passed ===\n`);
  process.exit(failed ? 1 : 0);
}

main();
