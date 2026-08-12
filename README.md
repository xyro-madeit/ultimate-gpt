# AI Signal Lab

A Vercel-ready AI-writing analysis dashboard.

## What it does
- Runs 120 local stylometric detector signals.
- Produces a combined screening score.
- Highlights the passages that contributed most and explains why.
- Shows the top 25 **gross** local signal scores.
- Can aggregate real external AI-detector APIs when you configure them.
- If the ensemble stays below the display threshold, it intentionally shows no flag list.

## Important limitation
There is no reliable scientific way to prove that text was written by AI from text alone. AI detectors can false-positive on polished, formulaic, ESL, academic, or heavily edited writing. This app is a screening/analysis tool, not evidence of misconduct.

## Deploy to Vercel
1. Unzip this folder.
2. Push it to GitHub, or import the folder directly into Vercel.
3. Deploy. No build step is needed.

## Add real external detector APIs
In Vercel, add an environment variable named `AI_CHECKER_ENDPOINTS` containing JSON like:

```json
[
  {
    "name": "My Detector API",
    "url": "https://api.example.com/check",
    "apiKeyEnv": "MY_DETECTOR_KEY",
    "authHeader": "authorization",
    "authPrefix": "Bearer ",
    "scorePath": "result.ai_probability"
  }
]
```

Then add `MY_DETECTOR_KEY` as another Vercel secret.

The generic adapter sends:

```json
{"text":"..."}
```

and expects either `score`, `ai_probability`, `probability`, or the custom `scorePath`. Values can be 0–1 or 0–100.

You can configure up to 40 external APIs per request in the starter. Raise that number carefully because Vercel execution time and provider rate limits still apply.

## About “100+ sources”
The bundled app runs 120 local models/signals. It does **not** falsely claim those are 120 independent commercial AI-checker companies. Real external sources only appear when their APIs actually respond.
