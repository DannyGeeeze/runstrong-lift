# RunStrong Lift

A phone-first web app that builds today's strength session from your Strava run, your race schedule, and the RunStrong coach's training system.

- **Setup and deploy:** [SETUP.md](SETUP.md)
- **Choices made where the brief left room:** [DECISIONS.md](DECISIONS.md)
- **The coach's rules:** [`lib/rules/rules.ts`](lib/rules/rules.ts) (when to lift) and [`lib/rules/sessions.ts`](lib/rules/sessions.ts) (what goes in each session)
- **Exercise bank:** [`data/runstrong_exercises.json`](data/runstrong_exercises.json). To add an exercise, add an entry to the JSON. No code changes needed.
- **Storage:** [`lib/storage.ts`](lib/storage.ts) is the only file that touches localStorage. Swap it out to move to a database.

```bash
npm install
npm run dev
```

```bash
npm test
```
