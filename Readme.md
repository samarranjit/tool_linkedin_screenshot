# LinkedIn Activity Screenshot Bot

Automate screenshots of the latest post cards from a target LinkedIn profile activity page and save them to `screens/` for personal portfolio usage.

This project uses `puppeteer` to:

- sign in to LinkedIn,
- open a target profile’s `recent-activity/all` page,
- detect post list items (`<li>`),
- capture screenshots for the first N items,
- and (optionally, via GitHub Actions) commit updated images back to the repository.

## Responsible Use

This tool is intended **only for personal, legitimate use** (for example, maintaining your own portfolio assets).

- Do not use this project to attack, abuse, scrape at scale, evade protections, or automate harmful behavior on any website.
- Use it only with accounts and content you are authorized to access.
- Follow LinkedIn’s Terms of Service and all applicable laws/policies.

## Repository Structure

- `shot.js` — main Puppeteer automation script.
- `.github/workflows/bot.yml` — GitHub Actions workflow to run the script and push image changes.
- `screens/` — generated screenshots.
- `run_shot_and_push.sh` — optional local/server automation script.
- `package.json` — dependencies and metadata.

## Prerequisites

- Node.js `18+` (workflow uses Node 18).
- npm.
- A LinkedIn account able to access the target activity page.

Install dependencies:

```bash
npm ci
```

## Environment Variables

Create a local `.env` file in the project root:

```env
LINKEDIN_USER=your_login_email_or_username
LINKEDIN_PASS=your_linkedin_password
TARGET_USER=linkedin-profile-slug-only
NUM_POSTS=5
numPosts=5
```

### Variable Notes

- `TARGET_USER` should be only the profile slug (example: `eunsang-cho-b455a8126`), not the full URL.
- Current `shot.js` reads post count in two places with different keys:
  - scroll loop uses `process.env.numPosts`
  - final slice uses `process.env.NUM_POSTS`
- To avoid mismatch, set **both** `NUM_POSTS` and `numPosts` to the same value.

## Local Usage

Run once:

```bash
node shot.js
```

Expected output:

- logs page URL/title,
- captures screenshots as files like:
  - `screens/www.linkedin.com_in_<slug>_recent-activity_all___li1.png`
  - `screens/www.linkedin.com_in_<slug>_recent-activity_all___li2.png`

## GitHub Actions Usage

Workflow file: `.github/workflows/bot.yml`

Currently configured trigger:

- `workflow_dispatch` (manual run)

Optional schedule is present but commented out.

### Required Repository Secrets

Add these in **GitHub → Settings → Secrets and variables → Actions → Repository secrets**:

- `LINKEDIN_USER`
- `LINKEDIN_PASS`
- `TARGET_USER`
- `NUM_POSTS`

### Manual Trigger (without waiting for schedule)

1. Push code to GitHub.
2. Open the repository `Actions` tab.
3. Select **Update Linkedin Screenshots List** workflow.
4. Click **Run workflow**.

The workflow already handles “no screenshot change” cases safely:

- if `screens/` has no diff, it skips commit/push and exits successfully.

## Known Limitations

Because LinkedIn may challenge or block automated logins, you may see login/authwall pages instead of activity content.

Typical symptoms:

- URL contains `/login` or `/authwall`
- title is `LinkedIn Login` / `Sign Up`
- errors like `Node is either not visible or not an HTMLElement`

In these cases, the script is not on the target activity page and cannot capture expected post cards.

## Troubleshooting

### 1) `Missing LINKEDIN_USER or LINKEDIN_PASS in .env`

Ensure `.env` contains exact names:

- `LINKEDIN_USER`
- `LINKEDIN_PASS`

### 2) Workflow fails at git commit with “nothing to commit”

Already fixed in workflow by checking staged diff before commit.

### 3) `git pull` says local screenshots would be overwritten

You have local image changes. Choose one path:

Keep local changes:

```bash
git add screens/
git commit -m "Local screenshot updates"
git pull --rebase origin main
```

Discard local changes:

```bash
git fetch origin
git reset --hard origin/main
git clean -fd
```

## Optional: Local Automation Script

`run_shot_and_push.sh` demonstrates a local/server loop style:

- load `.env`,
- rebase,
- run `node shot.js`,
- commit/push only if `screens/` changed.

Review and update `REPO_DIR` before using it in your environment.

## Security Notes

- Never commit `.env` or credentials.
- Prefer repository secrets for GitHub Actions.
- Consider a dedicated account for personal automation tasks.
