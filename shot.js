// shot.js
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const readline = require("readline-sync");
const puppeteer = require("puppeteer");


const sleep = (ms) => new Promise((res) => setTimeout(res, ms));



const OUT_DIR = path.join(__dirname, "screens"); // <- screenshots go here
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR);

const TARGET_URL = `https://www.linkedin.com/in/${process.env.TARGET_USER}/recent-activity/all/`;
// const UL_SELECTOR = "ul.display-flex.flex-wrap.list-style-none.justify-center, ul.display-flex";


const USER = process.env.LINKEDIN_USER;
const PASS = process.env.LINKEDIN_PASS;
if (!USER || !PASS) {
    console.error("Missing LINKEDIN_USER or LINKEDIN_PASS in .env");
    process.exit(1);
}

function sanitize(name) {
    return name.replace(/[^\w.-]+/g, "_").slice(0, 120);
}

async function loginIfNeeded(page) {
    page.setDefaultNavigationTimeout(120000);
    page.setDefaultTimeout(120000);

    await page.setUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
    );
    await page.setExtraHTTPHeaders({ "Accept-Language": "en-US,en;q=0.9" });

    // Go to /login directly (fewer redirects)
    await page.goto("https://www.linkedin.com/login", { waitUntil: "domcontentloaded", timeout: 120000 });

    // If already logged in, /login may redirect to /feed and #username won’t exist.
    const needsLogin = await page.$("#username");
    if (!needsLogin) return;

    await page.type("#username", USER, { delay: 20 });
    await page.type("#password", PASS, { delay: 20 });
    await Promise.all([
        page.click('button[type="submit"]'),
        page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 120000 }),
    ]);

    // 2FA (if shown)
    const pinInput = await page.$('input[name="pin"]');
    if (pinInput) {
        const code = readline.question("Enter your LinkedIn 2FA code: ");
        await page.type('input[name="pin"]', code, { delay: 20 });
        const submitSel = 'button[type="submit"], button[aria-label*="Verify"], button[aria-label*="submit"]';
        if (await page.$(submitSel)) {
            await Promise.all([
                page.click(submitSel),
                page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 120000 }),
            ]);
        }
    }
}


(async () => {
    const USER_DATA = path.join(__dirname, "user_data");

    const browser = await puppeteer.launch({
        headless: true,
        defaultViewport: { width: 1366, height: 2200, deviceScaleFactor: 2 },
        args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            // `--user-data-dir=${USER_DATA}`,   // <— add this
        ],
    });

    try {
        const page = await browser.newPage();
        page.setDefaultNavigationTimeout(120000);
        page.setDefaultTimeout(120000);
        await loginIfNeeded(page);


        await page.goto(TARGET_URL, { waitUntil: "domcontentloaded", timeout: 120000 });
        await sleep(1500);

        // gentle scroll to trigger lazy loading
        await page.mouse.wheel({ deltaY: 1200 });
        await sleep(800);

        // Step 3 — find all candidate <ul> and pick the one with the most direct <li> children
        const UL_EXACT = 'ul.display-flex.flex-wrap.list-style-none.justify-center';
        await page.waitForSelector(UL_EXACT, { timeout: 30000 });

        const uls = await page.$$(UL_EXACT);
        if (!uls.length) throw new Error("No matching <ul> found.");

        let ul = null;
        let bestCount = -1;

        for (const candidate of uls) {
            const count = await candidate.evaluate(el => el.querySelectorAll(':scope > li').length);
            if (count > bestCount) {
                bestCount = count;
                ul = candidate;
            }
        }

        if (!ul) throw new Error("Could not choose a target <ul>.");

        // Now only take the direct <li> children of that UL
        const liHandles = await ul.$$(':scope > li');
        if (!liHandles.length) throw new Error("No direct <li> children found under the target <ul>.");

        // keep the rest the same
        const top3 = liHandles.slice(0, process.env.NUM_POSTS);


        const base = sanitize(TARGET_URL.replace(/^https?:\/\//, ""));
        let idx = 1;

        for (const li of top3) {
            // Ensure in view
            await li.evaluate((el) => el.scrollIntoView({ block: "center" }));
            // await page.waitForTimeout(600);
            await sleep(600);



            const outPath = path.join(OUT_DIR, `${base}__li${idx}.png`);
            // Move mouse away to avoid hover tooltips
            // close overlays & move cursor away (steps 2–3)
            await page.keyboard.press('Escape');
            await page.mouse.move(0, 0);
            await sleep(120);

            await li.screenshot({ path: outPath });
            console.log("✓ Saved:", outPath);
            idx += 1;
            // await page.waitForTimeout(400);
            await sleep(400);

        }
    } catch (err) {
        console.error("Error:", err.message);
    } finally {
        await browser.close();
    }
})();
