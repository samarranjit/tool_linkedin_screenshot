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


        // 👇 Paste these debug logs here
        console.log("URL:", page.url());
        console.log("Title:", await page.title());
        console.log("User agent set.");
        const countUls = await page.$$eval("ul", (uls) => uls.length);
        console.log("UL count on page:", countUls);


        // gentle scroll to trigger lazy loading
        await page.mouse.wheel({ deltaY: 1200 });
        await sleep(800);

        // Step 3 — find all candidate <ul> and pick the one with the most direct <li> children
        // Preferred selector (when classes match)
        let ul = await page.$('ul.display-flex.flex-wrap.list-style-none.justify-center');

        // Fallback: pick the <ul> that has the MOST direct <li> children
        if (!ul) {
            const handle = await page.evaluateHandle(() => {
                const all = Array.from(document.querySelectorAll("ul"));
                all.sort((a, b) =>
                    (b.querySelectorAll(":scope > li").length) - (a.querySelectorAll(":scope > li").length)
                );
                return all[0] || null;
            });
            const asElement = handle.asElement?.();
            if (asElement) ul = asElement;
        }

        if (!ul) throw new Error("Could not find a UL. Check debug/landing.html & debug/uls.json.");

        // Only direct <li> children of THAT ul
        let liHandles = await ul.$$(":scope > li");

        // (Optional) if still too few, do a light scroll loop to trigger lazy loading
        let attempts = 0;
        while (liHandles.length < (Number(process.env.numPosts) || 3) && attempts < 4) {
            await page.mouse.wheel({ deltaY: 1400 });
            await sleep(700);
            liHandles = await ul.$$(":scope > li");
            attempts++;
        }

        if (!liHandles.length) throw new Error("No direct <li> children under the chosen UL.");
        const topN = liHandles.slice(0, Number(process.env.numPosts) || 3);
        // const top3 = liHandles.slice(0, process.env.NUM_POSTS);


        const base = sanitize(TARGET_URL.replace(/^https?:\/\//, ""));
        let idx = 1;

        for (const li of topN) {
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
