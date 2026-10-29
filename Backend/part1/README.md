# Recruiter Bot: Part 1 (matching API)

A small service that loads candidates and jobs into **MySQL** and ranks the best matches in both directions. Python 3.12+ with the standard library HTTP server, plus **PyMySQL**, a plain database driver. **No ORM and no query builder: every schema statement and query is hand-written SQL** (`recruiter_bot/schema.sql`, `recruiter_bot/db.py`).

## Run it

Requires Python 3.12+ and a running **MySQL 8.0+** server (for example the MySQL app). The database user needs permission to create databases, because the app creates `recruiter_bot` and its tables on first start.

```bash
cd Backend/part1
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# connection settings (defaults: 127.0.0.1:3306, user root, empty password)
export MYSQL_PASSWORD='your-password'
# optional: MYSQL_HOST, MYSQL_PORT, MYSQL_USER, MYSQL_DATABASE (default recruiter_bot)

python -m recruiter_bot --port 8000    # creates tables, seeds an empty DB, serves the API
```

## API

| Method | Path | Purpose |
|---|---|---|
| GET | `/jobs/{id}/matches` | Ranked candidates for a job (score, reason, breakdown) |
| GET | `/candidates/{id}/matches` | Ranked jobs for a candidate (reverse direction) |
| POST | `/ingest` | Upsert candidates and/or jobs (JSON), then re-score the changed records |
| GET | `/candidates`, `/jobs`, `/candidates/{id}`, `/jobs/{id}`, `/health` | Browse the data |

Match endpoints take `?limit=` (1-100, default 10) and `?min_score=` (0-100, default 0). Errors are JSON: `400` bad input, `404` unknown id or route, `413` oversized body.

A bad `/ingest` batch returns every problem at once, with each record's zero-based `index` in its list, and nothing is written:

```json
{
  "error": "2 record(s) are invalid; nothing was saved",
  "details": [
    {"list": "candidates", "index": 0, "record": "Jim H.", "errors": ["'availability' must be one of ['2 weeks', 'Immediate', 'Not looking']"]},
    {"list": "jobs", "index": 3, "record": null, "errors": ["'title' must be a non-empty string"]}
  ]
}
```

Examples:

```bash
curl -s localhost:8000/jobs/1/matches                       # Backend Detective -> Sherlock H. first
curl -s "localhost:8000/jobs/5/matches?limit=3"             # First 3 best matches for Incident Commander
curl -s localhost:8000/candidates/8/matches                 # MacGyver's best jobs

# To ingest Data through JSON 
curl -s -XPOST localhost:8000/ingest -H 'Content-Type: application/json' -d '{
  "candidates": [{"external_id":"c-101","name":"Jim H.","skills":["sales","public-speaking"],"experience_years":6,
                  "availability":"Immediate","traits":["persistent"]}],
  "jobs": [{"external_id":"j-101","title":"Duct Tape Engineer","required_skills":["resourcefulness"],
            "min_experience":1,"culture_keywords":["calm"]}]
}'
```

Example item from `/jobs/1/matches`:

```json
{ "rank": 1,
  "candidate": {"id": 1, "external_id": "cand-001", "name": "Sherlock H.", "experience_years": 8, "availability": "Immediate"},
  "score": 95.0,
  "reason": "3/3 required skills (deduction, forensics, pattern-recognition); 8 yrs vs 3 min; culture: analytical; availability: Immediate",
  "breakdown": {"skills": 1.0, "experience": 1.0, "culture": 0.5, "availability": 1.0} }
```

## Expected output (seed data)

Ranked results after seeding (score out of 100; candidates with no overlapping required skill are not listed):

| Job | Ranking |
|---|---|
| Backend Detective | 1. Sherlock H. 95.0, 2. Sheldon C. 30.0 |
| Rapid Prototyping Engineer | 1. Rick S. 87.5, 2. MacGyver 87.0, 3. Tony S. 83.3 |
| Developer Relations Lead | 1. Elle W. 92.5, 2. Hermione G. 87.0, 3. Leslie K. 45.0, ... |
| Engineering Manager, Chaos Team | 1. Miranda P. 54.2, 2. Leslie K. 31.7, 3. Ted L. 31.7, ... |
| Incident Commander | 1. Olivia P. 91.7, 2. Katniss E. 65.0, 3. Dwight S. 30.0, ... |
| Sales Engineer | 1. Dwight S. 60.0, 2. Michael S. 57.4, 3. Ted L. 31.7, ... |

Reverse direction: Sherlock H. -> Backend Detective 95.0; MacGyver -> Rapid Prototyping Engineer 87.0; Tony S. -> Rapid Prototyping Engineer 83.3, then Engineering Manager 27.3.

## Schema (`recruiter_bot/schema.sql`)

`candidates` and `jobs`, a normalised `skills` dictionary with `candidate_skills` and `job_skills` join tables, free-form tag tables `candidate_traits` and `job_culture_keywords`, and `matches`.

A **match is a stored, scored (candidate, job) pair**. Scores are recalculated when data is ingested, for the records that changed. A score depends only on its own candidate and job, so an ingest that adds one candidate rescores that candidate against each job, and an ingest that changes a job rescores that job against each candidate. Other rows are left alone. Both match endpoints are one indexed `SELECT ... JOIN ... ORDER BY`, and the per-component scores stay inspectable in plain SQL.

Every candidate and job has a required `external_id`, the stable ID from the source system. Sending the same `external_id` updates that record, so a changed name or title updates the row in place. A batch that uses the same `external_id` twice is rejected. IDs are case-sensitive, so `CAND-001` and `cand-001` are different records.

Skills and tags are lower-cased and trimmed on the way in. Ingestion checks every record first and reports all problems with their positions. If any record is invalid, nothing is written. Otherwise the batch is written in one transaction.

## Matching algorithm: decisions and trade-offs

Each component is 0..1, and the final score is 0..100:

```
score = 100 * skill * ( 0.55 + 0.25*experience + 0.10*culture + 0.10*availability )
```

- **Skill coverage (`skill`)**: the share of the job's required skills the candidate has. It is also a **gate and a multiplier**. Zero overlap means score 0 and the pair is not returned, and the other terms count only in proportion to skills covered. My first version was a plain weighted sum. It scored a candidate with 1 of 3 skills at about 63/100 when their experience, culture and availability were perfect, which was too high. Multiplying fixed that. Trade-off: skills now dominate more than the nominal 55%, and extra skills beyond those required earn nothing. Coverage is used rather than Jaccard, because a job lists requirements, not an exhaustive profile.
- **Experience fit**: ramps linearly up to the minimum (2 of 4 years = 0.5), is 1.0 from the minimum up to 3x the minimum, then tapers 5% per extra multiple to a floor of 0.8. Seniority is a mild flight-risk signal, never a disqualifier (Rick, 20 yrs, still ranks #1 for a 2-year-minimum prototyping role).
- **Culture (10%)**: culture keywords against traits. An exact match earns full credit, and a small hand-written synonym group (for example `calm` ~ `calm-under-pressure`, `genius` ~ `innovative`) earns half credit, shown as `(~)` in the reason. The weight is small because tags are fuzzy and the synonym list is subjective.
- **Availability (10%)**: Immediate 1.0, 2 weeks 0.7, Not looking 0.2. "Not looking" is penalised but not excluded, because a recruiter may still want to approach a strong passive candidate. Miranda (18 yrs) is the top Engineering Manager result with "availability: Not looking" in her reason.
- **Tie-breaking** is deterministic, never insertion order: score, then skill coverage, availability, experience fit, then name or title and id.
- **Not used**: the `quirk` text. It is flavour, and keyword-scanning it would be wrong. Katniss's quirk says she is terrible with public speaking.
- **Weights are judgement calls**, not trained. They are constants at the top of `recruiter_bot/scoring.py`. Scoring is pure Python with no database access. Data fetch and store is SQL in `recruiter_bot/db.py`.

Other decisions: the standard-library `http.server` keeps the dependencies to one database driver (production would use an ASGI server and a connection pool). Each request uses its own short-lived database connection. Error responses never leak tracebacks.

## Not done yet

No pagination cursor and no authentication. Anyone who can reach the port can write data. 
The synonym groups are hand-curated. 

## AI tools

This implementation was written with Claude Code (an AI coding assistant), including the schema, API, scoring and this write-up. The scoring change from a weighted sum to the skill-multiplied form came from inspecting the first version's output and few more added features after reviewing the workflow.