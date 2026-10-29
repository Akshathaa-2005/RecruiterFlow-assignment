# Recruiter Bot: Part 1 (matching API)

Loads candidates and jobs into **MySQL** and ranks the best matches in both directions. Python 3.12+, the standard-library HTTP server and **PyMySQL**. No ORM: all SQL is hand-written (`recruiter_bot/schema.sql`, `recruiter_bot/db.py`).

## Run it

Needs Python 3.12+ and MySQL 8.0+. The app creates the `recruiter_bot` database and tables on first start.

```bash
cd Backend/part1
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
export MYSQL_PASSWORD='your-password'   # optional: MYSQL_HOST, MYSQL_PORT, MYSQL_USER, MYSQL_DATABASE
python -m recruiter_bot --port 8000     # creates tables, seeds an empty DB, serves the API
```

## API

- `GET /jobs/{id}/matches`: ranked candidates for a job.
- `GET /candidates/{id}/matches`: ranked jobs for a candidate.
- `POST /ingest`: upsert candidates and/or jobs, then re-score what changed.
- `GET /candidates`, `/jobs`, `/candidates/{id}`, `/jobs/{id}`, `/health`: browse data.

Match endpoints take `?limit=` (1-100, default 10) and `?min_score=` (0-100). Errors are JSON: `400`, `404`, `413`. An invalid `/ingest` batch returns every problem at once with each record's zero-based `index`, and writes nothing.

```bash
curl -s localhost:8000/jobs/1/matches                # Sherlock H. ranks first
curl -s "localhost:8000/jobs/5/matches?limit=3"
curl -s -XPOST localhost:8000/ingest -H 'Content-Type: application/json' -d '{
  "candidates": [{"external_id":"c-101","name":"Jim H.","skills":["sales"],
                  "experience_years":6,"availability":"Immediate","traits":["persistent"]}]}'
```

Each match has `rank`, `candidate`, `score`, a plain-English `reason` and a per-component `breakdown`.

## Schema

`candidates`, `jobs`, a `skills` dictionary with join tables, tag tables, and `matches`: a stored, scored (candidate, job) pair. A score depends only on its own pair, so an ingest rescores only changed records, and both match endpoints are one indexed `SELECT ... JOIN ... ORDER BY`.

Every record has a required, case-sensitive `external_id`; re-sending it updates the row. Skills and tags are lower-cased and trimmed. A batch is validated first, then written in one transaction.

## Matching: decisions and trade-offs

```
score = 100 * skill * ( 0.55 + 0.25*experience + 0.10*culture + 0.10*availability )
```

- **Skill coverage** is the share of required skills the candidate has, used as a gate and multiplier: zero overlap means no match. My first version was a plain weighted sum and gave a 1-of-3-skills candidate about 63/100, which was too high. Trade-off: extra skills earn nothing.
- **Experience** ramps up to the minimum, is full to 3x the minimum, then tapers to 0.8. Seniority never disqualifies.
- **Culture:** exact trait match earns full credit; a small hand-written synonym group earns half. Weighted low because tags are fuzzy.
- **Availability:** Immediate 1.0, 2 weeks 0.7, Not looking 0.2. Penalised, not excluded, since a recruiter may still approach a strong passive candidate.
- **Ties** break deterministically: score, skills, availability, experience, name, id.
- **Not used:** the `quirk` text. It is flavour, and keyword-scanning it would mislead.
- Weights are judgement calls, kept in `recruiter_bot/scoring.py`. Scoring is pure Python; SQL stays in `db.py`.

## Not done

No pagination cursor and no authentication. Synonym groups are hand-curated.

## AI tools

Written with Claude Code, including the schema, API, scoring and this write-up. The skill-multiplied score came from inspecting the first version's output.
