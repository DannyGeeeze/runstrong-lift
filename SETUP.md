# Setup

You can try the app right now with demo data, with no Strava account needed. Connecting your real runs takes about 10 minutes.

## 1. Run it locally (demo data)

You need Node.js 20 or newer.

```bash
npm install
npm run dev
```

Open http://localhost:3000. With no Strava keys set, the app uses demo runs automatically and shows a "Demo data" banner. On the **Races** tab, tap **Add a sample season** to get some races to plan around.

Run the rules tests with:

```bash
npm test
```

## 2. Create a Strava API app

1. Go to https://www.strava.com/settings/api (log in to Strava first).
2. Fill in the form:
   - **Application Name**: `RunStrong Lift` (anything works)
   - **Category**: Training
   - **Website**: your Vercel URL if you have one, otherwise `http://localhost:3000`
   - **Authorization Callback Domain**:
     - For local only: `localhost`
     - Once deployed: your Vercel domain with **no** `https://` and **no** path, for example `runstrong-lift.vercel.app`

     Strava allows one callback domain per app, but it always allows `localhost`, so setting it to your Vercel domain still lets local development work.
3. Upload any icon if Strava asks for one, then save.
4. On the app page, copy the **Client ID** and **Client Secret**. Treat the secret like a password: it only ever goes in environment variables, never in code.

## 3. Environment variables

Create `.env.local` in the project folder by copying the example:

```bash
cp .env.example .env.local
```

Then fill it in:

| Variable | What it is |
|---|---|
| `STRAVA_CLIENT_ID` | Client ID from strava.com/settings/api |
| `STRAVA_CLIENT_SECRET` | Client Secret from the same page |
| `SESSION_SECRET` | A long random string used to encrypt the Strava login cookie. Generate one with the command below. |
| `APP_URL` | Optional. Only needed with a custom domain, e.g. `https://lift.example.com`. Leave it out otherwise. |

```bash
openssl rand -base64 32
```

Restart `npm run dev`, go to **Settings → Strava**, and tap **Connect Strava**. Strava asks for permission to "View data about your private activities". Keep that box ticked, since the app needs `activity:read_all` to see all your runs.

If the demo banner still shows, turn off **Demo data** in Settings.

## 4. Deploy to Vercel (free tier)

### Option A: from the Vercel website

1. Go to https://vercel.com/new and import the `runstrong-lift` GitHub repo. Vercel detects Next.js, so leave the build settings as they are.
2. Before the first deploy, open **Environment Variables** and add `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET` and `SESSION_SECRET`. Use a **new** `SESSION_SECRET` rather than your local one.
3. Click **Deploy**.
4. Copy your production domain (for example `runstrong-lift.vercel.app`) into the **Authorization Callback Domain** on strava.com/settings/api.

### Option B: from the terminal

```bash
npm i -g vercel@latest
```

```bash
vercel link
```

```bash
vercel env add STRAVA_CLIENT_ID production
```

```bash
vercel env add STRAVA_CLIENT_SECRET production
```

```bash
vercel env add SESSION_SECRET production
```

```bash
vercel --prod
```

Then set the Strava callback domain to the production domain the deploy prints.

### Notes

- **Use the production URL to connect Strava.** Preview deployments get different domains, and Strava rejects callbacks from domains that don't match the callback domain.
- On your phone, open the site and use **Share → Add to Home Screen** so it opens like an app.
- **Your data stays on the device.** Races, settings and lift history are saved in that browser's storage. Use **Settings → Export JSON** to back up, and **Import JSON** to move to another phone or browser.

## Troubleshooting

| What you see | Fix |
|---|---|
| Strava says "redirect_uri invalid" | The callback domain on strava.com/settings/api doesn't match the site you're on. |
| "Couldn't finish connecting to Strava" | The Client ID or Secret is wrong, or the env vars weren't added before the deploy. Redeploy after adding them. |
| "Please allow View data about your private activities" | You unticked that permission. Connect again and leave it ticked. |
| Strava connected, but today's run is missing | Strava may not have synced from your watch yet. Reload the page, or pick the day type with the chips. |
