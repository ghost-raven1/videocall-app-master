const { chromium } = require("playwright-core");

const baseUrl = process.env.E2E_BASE_URL || "http://192.168.0.105";
const password = process.env.E2E_PASSWORD || "dev_admin_password";
const executablePath =
  process.env.CHROME_EXECUTABLE ||
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const statusCandidates = new Set([
  "Initializing...",
  "Connecting...",
  "Connected",
  "Disconnected",
  "Connection failed",
  "Connection closed",
]);

async function getStatus(page) {
  try {
    return await page.evaluate((statuses) => {
      const nodes = Array.from(document.querySelectorAll("header span, header p, header div"));
      for (const node of nodes) {
        const text = (node.textContent || "").trim();
        if (statuses.includes(text)) return text;
      }
      return null;
    }, Array.from(statusCandidates));
  } catch {
    return null;
  }
}

async function login(page, label) {
  await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded" });
  await page.locator("#password").fill(password);
  await page.locator("button[type='submit']").click();
  await page.waitForTimeout(1200);
  console.log(`[${label}] after login URL:`, page.url());
}

async function run() {
  const browser = await chromium.launch({
    executablePath,
    headless: true,
    args: [
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
      "--allow-insecure-localhost",
      "--autoplay-policy=no-user-gesture-required",
    ],
  });

  const ctx1 = await browser.newContext({ permissions: ["camera", "microphone"] });
  const ctx2 = await browser.newContext({ permissions: ["camera", "microphone"] });
  const page1 = await ctx1.newPage();
  const page2 = await ctx2.newPage();

  try {
    await login(page1, "P1");
    await login(page2, "P2");

    await page1.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded" });
    await page1.getByRole("button", { name: /Создать звонок/i }).click();
    await page1.waitForURL(/\/join\//, { timeout: 20000 });

    const joinUrl = page1.url();
    const shortCode = joinUrl.split("/join/")[1] && joinUrl.split("/join/")[1].split(/[?#]/)[0];
    if (!shortCode) {
      throw new Error("Failed to extract room short code");
    }
    console.log("Room short code:", shortCode);

    await page1.getByRole("button", { name: /Присоединиться к звонку|Join call/i }).click();
    await page1.waitForURL(/\/call\//, { timeout: 25000 });
    console.log("[P1] call URL:", page1.url());

    await page2.goto(`${baseUrl}/join/${shortCode}`, { waitUntil: "domcontentloaded" });
    await page2.getByRole("button", { name: /Присоединиться к звонку|Join call/i }).click();
    await page2.waitForURL(/\/call\//, { timeout: 25000 });
    console.log("[P2] call URL:", page2.url());

    let p1 = null;
    let p2 = null;
    for (let i = 0; i < 35; i += 1) {
      await page1.waitForTimeout(1000);
      p1 = await getStatus(page1);
      p2 = await getStatus(page2);

      if (i % 5 === 0) {
        const v1 = await page1.evaluate(() => document.querySelectorAll("video").length);
        const v2 = await page2.evaluate(() => document.querySelectorAll("video").length);
        console.log(`t=${i}s statuses: P1=${p1} P2=${p2} videos: P1=${v1} P2=${v2}`);
      }

      if (p1 === "Connected" && p2 === "Connected") break;
    }

    const v1 = await page1.evaluate(() => document.querySelectorAll("video").length);
    const v2 = await page2.evaluate(() => document.querySelectorAll("video").length);
    console.log("FINAL", { p1, p2, v1, v2 });

    if (p1 !== "Connected" || p2 !== "Connected") {
      throw new Error(`Not connected: p1=${p1} p2=${p2}`);
    }

    console.log("E2E_RESULT: PASS");
  } finally {
    await ctx1.close().catch(() => {});
    await ctx2.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}

run().catch((err) => {
  console.error("E2E_RESULT: FAIL", err);
  process.exit(1);
});

