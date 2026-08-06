/**
 * Full RowanLane role + feature E2E suite.
 * Usage: node scripts/test-full-app.mjs
 */
import { chromium } from "playwright";

const BASE = process.env.SMOKE_BASE_URL || "http://localhost:3001";

const ALLOWED = {
  manager: [
    "/dashboard",
    "/warnings",
    "/approvals",
    "/controls",
    "/coverage",
    "/customers",
    "/carriers",
    "/contracts",
    "/shipments",
    "/invoices",
    "/ar",
    "/disputes",
    "/support",
    "/accounting",
    "/reports",
    "/profitability",
    "/risk",
    "/settings",
  ],
  broker: [
    "/dashboard",
    "/warnings",
    "/risk",
    "/coverage",
    "/customers",
    "/contracts",
    "/shipments",
    "/carriers",
    "/support",
    "/settings",
  ],
  billing: [
    "/dashboard",
    "/warnings",
    "/shipments",
    "/invoices",
    "/ar",
    "/disputes",
    "/support",
    "/accounting",
    "/profitability",
    "/settings",
  ],
  customer: ["/dashboard", "/warnings", "/shipments", "/invoices", "/coverage", "/support", "/settings"],
  carrier: ["/dashboard", "/warnings", "/shipments", "/documents", "/support", "/settings"],
};

const ROLES = [
  {
    role: "manager",
    cardIndex: 0,
    name: "Morgan Manager",
    dashboardHint: /Executive|Profitability|Morning|KPI|Approvals|margin/i,
    forbidden: ["/documents"],
  },
  {
    role: "broker",
    cardIndex: 1,
    name: "Blake Broker",
    dashboardHint: /Broker|Operations|Task|Shipment|Carrier/i,
    forbidden: ["/invoices", "/ar", "/profitability", "/documents", "/approvals", "/controls"],
  },
  {
    role: "billing",
    cardIndex: 2,
    name: "Bailey Billing",
    dashboardHint: /Billing|Invoice|AR|Collection|Unbilled|Receivable/i,
    forbidden: ["/customers", "/carriers", "/contracts", "/documents", "/approvals", "/controls", "/risk", "/coverage"],
  },
  {
    role: "customer",
    cardIndex: 3,
    name: "Casey Customer",
    dashboardHint: /Customer|Shipment|Invoice|My |Track|coverage/i,
    forbidden: ["/approvals", "/customers", "/carriers", "/ar", "/profitability", "/documents", "/accounting", "/controls", "/risk"],
  },
  {
    role: "carrier",
    cardIndex: 4,
    name: "Chris Carrier",
    dashboardHint: /Carrier|Load|Deliver|Assigned|Document|Pickup/i,
    forbidden: ["/approvals", "/customers", "/invoices", "/ar", "/profitability", "/accounting", "/controls", "/risk", "/coverage"],
  },
];

const ERROR_PATTERNS = [
  /Application error/i,
  /Internal Server Error/i,
  /Unhandled Runtime Error/i,
  /Something went wrong/i,
  /Cannot read propert/i,
  /Server Error/i,
  /Missing Supabase/i,
];

const results = [];
function ok(name, detail = "") {
  results.push({ name, pass: true, detail });
  console.log(`PASS  ${name}${detail ? " — " + detail : ""}`);
}
function fail(name, detail = "") {
  results.push({ name, pass: false, detail });
  console.error(`FAIL  ${name}${detail ? " — " + detail : ""}`);
}

async function bodyText(page) {
  return page.evaluate(() => document.body?.innerText || "");
}

async function pageLooksBroken(page) {
  const text = await bodyText(page);
  for (const re of ERROR_PATTERNS) {
    if (re.test(text)) return re.toString();
  }
  return null;
}

async function visitAndCheck(page, path, label) {
  const res = await page.goto(`${BASE}${path}`, {
    waitUntil: "networkidle",
    timeout: 90000,
  });
  await page.waitForSelector(".navbar, main, form", { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(300);
  const status = res?.status() ?? 0;
  const broken = await pageLooksBroken(page);
  const text = (await bodyText(page)).trim();

  if (status >= 500) {
    fail(`${label} ${path}`, `HTTP ${status}`);
    return false;
  }
  if (broken) {
    fail(`${label} ${path}`, broken);
    return false;
  }
  if (text.length < 40) {
    fail(`${label} ${path}`, `thin content (${text.length} chars)`);
    return false;
  }
  // Must still look like the app shell when authenticated
  if (!/RowanLane/i.test(text) && !/Sign|Welcome|Create/i.test(text)) {
    fail(`${label} ${path}`, "missing RowanLane chrome");
    return false;
  }
  ok(`${label} ${path}`, `HTTP ${status || "ok"} · ${text.length} chars`);
  return true;
}

async function enterDemoViaCard(page, cardIndex) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  if (/dashboard/i.test(page.url())) {
    const btn = page.getByRole("button", { name: /Exit Demo|Sign out/i });
    if (await btn.count()) {
      await btn.first().click();
      await page.waitForURL(/\/login/, { timeout: 45000 }).catch(() => {});
    }
  }
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.locator("button.login-portal-card").nth(cardIndex).click();
  await page.waitForURL(/\/dashboard/, { timeout: 90000 });
  await page.waitForFunction(
    () => (document.body?.innerText || "").length > 80,
    null,
    { timeout: 30000 },
  );
}

async function switchDemoRole(page, role, expectedName) {
  await page.locator('select[aria-label="Demo Role"]').selectOption(role);
  await page.waitForFunction(
    (name) => (document.body?.innerText || "").includes(name),
    expectedName,
    { timeout: 90000 },
  );
  await page.waitForTimeout(500);
}

async function main() {
  console.log(`\n=== RowanLane FULL E2E @ ${BASE} ===\n`);
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.setDefaultTimeout(90000);

  try {
    await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
    const loginText = await page.content();
    /Explore Demo Portals/i.test(loginText) ? ok("Login: demo portals") : fail("Login: demo portals");
    /Sign In/i.test(loginText) ? ok("Login: sign-in form") : fail("Login: sign-in form");
    /Today.?s Snapshot|Move freight/i.test(loginText)
      ? ok("Login: hero content")
      : fail("Login: hero content");
    (await page.locator("button.login-portal-card").count()) === 5
      ? ok("Login: 5 portal cards")
      : fail("Login: 5 portal cards");

    await visitAndCheck(page, "/signup", "public");

    for (const cfg of ROLES) {
      console.log(`\n--- Role: ${cfg.role} ---`);
      await enterDemoViaCard(page, cfg.cardIndex);

      const nav = await page.locator(".navbar").innerText();
      nav.includes(cfg.name)
        ? ok(`${cfg.role}: identity`, cfg.name)
        : fail(`${cfg.role}: identity`, nav.slice(0, 160));

      (await page.locator('select[aria-label="Demo Role"]').isVisible())
        ? ok(`${cfg.role}: demo selector`)
        : fail(`${cfg.role}: demo selector`);

      const dashText = await bodyText(page);
      cfg.dashboardHint.test(dashText)
        ? ok(`${cfg.role}: dashboard content`)
        : fail(`${cfg.role}: dashboard content`, dashText.slice(0, 240));

      for (const path of ALLOWED[cfg.role]) {
        await visitAndCheck(page, path, cfg.role);
      }

      if (["manager", "broker", "billing"].includes(cfg.role)) {
        (await page.locator(".navbar input").count()) > 0
          ? ok(`${cfg.role}: header search present`)
          : fail(`${cfg.role}: header search present`);
      }

      await page.goto(`${BASE}/shipments`, { waitUntil: "networkidle" });
      const shipLink = page.locator('main a[href^="/shipments/"]').first();
      if (await shipLink.count()) {
        const href = await shipLink.getAttribute("href");
        if (href && !href.endsWith("/new")) {
          await visitAndCheck(page, href, `${cfg.role} detail`);
        } else ok(`${cfg.role}: shipments list ok`);
      } else ok(`${cfg.role}: shipments list ok`);

      for (const bad of cfg.forbidden) {
        await page.goto(`${BASE}${bad}`, { waitUntil: "networkidle" });
        await page.waitForTimeout(400);
        const url = page.url();
        /\/dashboard/.test(url) || !url.includes(bad)
          ? ok(`${cfg.role}: blocked ${bad}`)
          : fail(`${cfg.role}: blocked ${bad}`, url);
      }
    }

    console.log(`\n--- Role switching ---`);
    await enterDemoViaCard(page, 0);
    for (const cfg of ROLES) {
      await switchDemoRole(page, cfg.role, cfg.name);
      const nav = await page.locator(".navbar").innerText();
      nav.includes(cfg.name)
        ? ok(`switch→${cfg.role} identity`)
        : fail(`switch→${cfg.role} identity`, nav.slice(0, 120));
      const sample =
        ALLOWED[cfg.role].find((p) => p !== "/dashboard" && p !== "/settings") ||
        "/dashboard";
      await visitAndCheck(page, sample, `switch→${cfg.role}`);
    }

    await page.reload({ waitUntil: "networkidle" });
    (await page.locator('select[aria-label="Demo Role"]').isVisible())
      ? ok("Demo mode survives refresh")
      : fail("Demo mode survives refresh");

    await page.getByRole("button", { name: /Exit Demo/i }).click();
    await page.waitForURL(/\/login/, { timeout: 60000 });
    ok("Exit Demo → login");

    console.log(`\n--- Normal login ---`);
    await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
    await page.fill('input[name="email"]', "manager@rowanlane.example");
    await page.fill('input[name="password"]', "FreightDemo2026!");
    await page.getByRole("button", { name: /^Sign In$/i }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 60000 });
    ok("Password login works");
    // Demo portal emails keep Demo Mode (role selector + Exit Demo), not a normal Sign out.
    (await page.locator('select[aria-label="Demo Role"]').count()) > 0
      ? ok("Password login keeps demo selector for demo accounts")
      : fail("Password login keeps demo selector for demo accounts");
    await visitAndCheck(page, "/profitability", "password-login");
    await visitAndCheck(page, "/approvals", "password-login");
    await page.getByRole("button", { name: /Exit Demo|Sign out/i }).click();
    await page.waitForURL(/\/login/, { timeout: 60000 });
    ok("Sign out works");

    await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
    /login/i.test(page.url())
      ? ok("Logged-out dashboard gated")
      : fail("Logged-out dashboard gated", page.url());

    await enterDemoViaCard(page, 1);
    await visitAndCheck(page, "/shipments/new", "broker");
    await page.getByRole("button", { name: /Exit Demo/i }).click();
    await page.waitForURL(/\/login/).catch(() => {});
  } catch (e) {
    fail("Unhandled suite error", e.stack || e.message);
    await page.screenshot({ path: "scripts/full-app-failure.png", fullPage: true }).catch(() => {});
  } finally {
    await browser.close();
  }

  const failed = results.filter((r) => !r.pass);
  console.log(`\n=== ${results.length - failed.length}/${results.length} passed ===`);
  if (failed.length) {
    console.log("\nFailed checks:");
    for (const f of failed) console.log(` - ${f.name}: ${f.detail}`);
  }
  process.exit(failed.length ? 1 : 0);
}

main();
