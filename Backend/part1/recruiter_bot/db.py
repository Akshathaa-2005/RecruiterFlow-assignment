import json
import os
from dataclasses import dataclass
from pathlib import Path

import pymysql
import pymysql.cursors

from . import scoring

# Paths are built from this file's location, so they work from any folder.
HERE = Path(__file__).parent
SCHEMA_PATH = HERE / "schema.sql"
SEED_PATH = HERE / "seed_data.json"


# Raised when input data is wrong. The server turns it into an HTTP 400.
class ValidationError(ValueError):
    """Bad input. `details` lists every problem, with each record's position, when there are several."""

    def __init__(self, message: str, details: list[dict] | None = None):
        super().__init__(message)
        self.details = details or []


# A shorter name for the connection type, used in the type hints.
Conn = pymysql.connections.Connection


def config(database: str | None = None) -> dict:
    """Connection settings from env vars (defaults suit a local MySQL install)."""
    return {
        "host": os.environ.get("MYSQL_HOST", "127.0.0.1"),
        "port": int(os.environ.get("MYSQL_PORT", "3306")),
        "user": os.environ.get("MYSQL_USER", "root"),
        "password": os.environ.get("MYSQL_PASSWORD", ""),
        # An explicit name wins; otherwise the env var; otherwise the default.
        "database": database or os.environ.get("MYSQL_DATABASE", "recruiter_bot"),
    }


def connect(database: str | None = None) -> Conn:
    # autocommit is off: writes are explicit transactions (see ingest()).
    return pymysql.connect(
        **config(database),
        charset="utf8mb4",
        cursorclass=pymysql.cursors.DictCursor,
        autocommit=False,
    )


def create_database_if_missing(database: str) -> None:
    # Connect without choosing a database, because it may not exist yet.
    cfg = config()
    cfg.pop("database")
    conn = pymysql.connect(**cfg, charset="utf8mb4")
    try:
        with conn.cursor() as cur:
            # The name comes from config, not user input, so building the string is safe.
            cur.execute(f"CREATE DATABASE IF NOT EXISTS `{database}` CHARACTER SET utf8mb4")
    finally:
        conn.close()


def q(conn: Conn, sql: str, params=None) -> list[dict]:
    """Run one hand-written statement; return all rows (empty for writes)."""
    with conn.cursor() as cur:
        # The driver escapes params, which is what prevents SQL injection.
        cur.execute(sql, params)
        return list(cur.fetchall())


def qone(conn: Conn, sql: str, params=None) -> dict | None:
    rows = q(conn, sql, params)
    return rows[0] if rows else None


def qmany(conn: Conn, sql: str, rows: list) -> None:
    """Run one statement once per row, e.g. to bulk-insert the match scores."""
    with conn.cursor() as cur:
        cur.executemany(sql, rows)


def _check_not_old_schema(conn: Conn) -> None:
    """Fail clearly if an existing table predates external_id.

    CREATE TABLE IF NOT EXISTS leaves old tables alone, so they would otherwise fail later.
    """
    for table in ("candidates", "jobs"):
        exists = qone(conn, f"SHOW TABLES LIKE '{table}'")
        if exists and qone(conn, f"SHOW COLUMNS FROM {table} LIKE 'external_id'") is None:
            raise RuntimeError(
                f"The '{table}' table was created by an older schema (no external_id column). "
                "Drop the recruiter_bot database and start the server again."
            )


def init_schema(conn: Conn) -> None:
    _check_not_old_schema(conn)
    # DDL is split on ";" at end of line (the file has no ";" inside statements).
    stmts = [s.strip() for s in SCHEMA_PATH.read_text().split(";\n")]
    for stmt in stmts:
        if stmt and not all(ln.startswith("--") for ln in stmt.splitlines() if ln.strip()):
            q(conn, stmt)
    conn.commit()


# --------------------------------------------------------------- validation

# These helpers record each problem in `errs` and return a safe placeholder,
# so one pass over a record can report every problem in it.

def _require_str(obj: dict, key: str, errs: list[str]) -> str:
    """Return obj[key] as trimmed text. Record a problem if it is missing or blank."""
    v = obj.get(key)
    if not isinstance(v, str) or not v.strip():
        errs.append(f"'{key}' must be a non-empty string")
        return ""
    return v.strip()


def _require_external_id(obj: dict, errs: list[str]) -> str:
    """Return the source system's id for a record: text of at most 64 characters."""
    ext = _require_str(obj, "external_id", errs)
    if len(ext) > 64:
        errs.append("'external_id' must be at most 64 characters")
    return ext


def _require_int(obj: dict, key: str, errs: list[str]) -> int:
    """Return obj[key] as a non-negative whole number. Record a problem otherwise."""
    v = obj.get(key)
    # bool is a subclass of int in Python, so True would pass as 1 without this check.
    if isinstance(v, bool) or not isinstance(v, int) or v < 0:
        errs.append(f"'{key}' must be a non-negative integer")
        return 0
    return v


def _tags(obj: dict, key: str, errs: list[str], required: bool = True) -> list[str]:
    """Return a cleaned list of tags: trimmed, lower-case, no duplicates, sorted.
    required=False lets the field be missing or empty."""
    v = obj.get(key, [])
    if not isinstance(v, list) or not all(isinstance(x, str) and x.strip() for x in v):
        errs.append(f"'{key}' must be a list of non-empty strings")
        return []
    # The set removes duplicates; sorting keeps the order predictable.
    out = sorted({x.strip().lower() for x in v})
    if required and not out:
        errs.append(f"'{key}' must not be empty")
    return out


def _validate_candidate(c: object, errs: list[str]) -> dict:
    """Check one candidate. Problems go into errs; the returned dict is only used when errs is empty."""
    if not isinstance(c, dict):
        errs.append("must be an object")
        return {}
    ext_id = _require_external_id(c, errs)
    name = _require_str(c, "name", errs)
    availability = _require_str(c, "availability", errs)
    # Must be one of the values the schema's ENUM accepts.
    if availability and availability not in scoring.AVAILABILITY_SCORE:
        errs.append(f"'availability' must be one of {sorted(scoring.AVAILABILITY_SCORE)}")
    # quirk is optional, so anything that isn't text is stored as NULL.
    quirk = c.get("quirk")
    return {
        "ext_id": ext_id,
        "name": name,
        "skills": _tags(c, "skills", errs),
        "years": _require_int(c, "experience_years", errs),
        "availability": availability,
        "traits": _tags(c, "traits", errs, required=False),
        "quirk": quirk if isinstance(quirk, str) else None,
    }


def _validate_job(j: object, errs: list[str]) -> dict:
    """Check one job. Problems go into errs; the returned dict is only used when errs is empty."""
    if not isinstance(j, dict):
        errs.append("must be an object")
        return {}
    ext_id = _require_external_id(j, errs)
    title = _require_str(j, "title", errs)
    tagline = j.get("tagline")
    return {
        "ext_id": ext_id,
        "title": title,
        "skills": _tags(j, "required_skills", errs),
        "min_exp": _require_int(j, "min_experience", errs),
        "keywords": _tags(j, "culture_keywords", errs, required=False),
        "tagline": tagline if isinstance(tagline, str) else None,
    }


def _validate_list(raw: list, kind: str, validate, label_key: str) -> tuple[list[dict], list[dict]]:
    """Check every record in a list. Return (valid records, problems).

    Each problem gives the record's position in the list, its name or title,
    and every error found in that record.
    """
    good, problems = [], []
    for i, rec in enumerate(raw):
        errs: list[str] = []
        clean = validate(rec, errs)
        if errs:
            label = rec.get(label_key) if isinstance(rec, dict) else None
            problems.append({"list": kind, "index": i, "record": label, "errors": errs})
        else:
            good.append(clean)
    return good, problems


def _duplicate_problems(raw: list, kind: str, label_key: str) -> list[dict]:
    """Report records whose external_id already appeared earlier in the same batch."""
    seen: dict[str, int] = {}
    problems = []
    for i, rec in enumerate(raw):
        ext = rec.get("external_id") if isinstance(rec, dict) else None
        if not isinstance(ext, str) or not ext.strip():
            continue  # a missing or blank id is already reported by validation
        ext = ext.strip()
        if ext in seen:
            problems.append({
                "list": kind, "index": i, "record": rec.get(label_key),
                "errors": [f"'external_id' '{ext}' is already used at index {seen[ext]} in this batch"],
            })
        else:
            seen[ext] = i
    return problems


# ---------------------------------------------------------------- ingestion

def _skill_id(conn: Conn, name: str) -> int:
    """Return the id of a skill, creating the skill if it is new."""
    # INSERT IGNORE skips the insert if the name already exists (the name is UNIQUE).
    q(conn, "INSERT IGNORE INTO skills (name) VALUES (%s)", (name,))
    row = qone(conn, "SELECT id FROM skills WHERE name = %s", (name,))
    assert row is not None
    return row["id"]


def _upsert_candidate(conn: Conn, c: dict) -> int:
    """Insert the candidate, or update it if its external_id exists. The name can change.

    Then replace its skill and trait links. Returns the candidate's id.
    """
    q(
        conn,
        """INSERT INTO candidates (external_id, name, experience_years, availability, quirk)
           VALUES (%(ext_id)s, %(name)s, %(years)s, %(availability)s, %(quirk)s)
           ON DUPLICATE KEY UPDATE
               name             = VALUES(name),
               experience_years = VALUES(experience_years),
               availability     = VALUES(availability),
               quirk            = VALUES(quirk)""",
        c,
    )
    row = qone(conn, "SELECT id FROM candidates WHERE external_id = %s", (c["ext_id"],))
    assert row is not None
    cid = row["id"]
    # Clear the old links. The new ones are inserted below.
    q(conn, "DELETE FROM candidate_skills WHERE candidate_id = %s", (cid,))
    q(conn, "DELETE FROM candidate_traits WHERE candidate_id = %s", (cid,))
    for s in c["skills"]:
        q(conn, "INSERT INTO candidate_skills (candidate_id, skill_id) VALUES (%s, %s)",
          (cid, _skill_id(conn, s)))
    for t in c["traits"]:
        q(conn, "INSERT INTO candidate_traits (candidate_id, trait) VALUES (%s, %s)", (cid, t))
    return cid


def _upsert_job(conn: Conn, j: dict) -> int:
    """Insert the job, or update it if its external_id exists. The title can change.

    Then replace its skill and keyword links. Returns the job's id.
    """
    q(
        conn,
        """INSERT INTO jobs (external_id, title, min_experience, tagline)
           VALUES (%(ext_id)s, %(title)s, %(min_exp)s, %(tagline)s)
           ON DUPLICATE KEY UPDATE
               title          = VALUES(title),
               min_experience = VALUES(min_experience),
               tagline        = VALUES(tagline)""",
        j,
    )
    row = qone(conn, "SELECT id FROM jobs WHERE external_id = %s", (j["ext_id"],))
    assert row is not None
    jid = row["id"]
    # Clear the old links. The new ones are inserted below.
    q(conn, "DELETE FROM job_skills WHERE job_id = %s", (jid,))
    q(conn, "DELETE FROM job_culture_keywords WHERE job_id = %s", (jid,))
    for s in j["skills"]:
        q(conn, "INSERT INTO job_skills (job_id, skill_id) VALUES (%s, %s)",
          (jid, _skill_id(conn, s)))
    for k in j["keywords"]:
        q(conn, "INSERT INTO job_culture_keywords (job_id, keyword) VALUES (%s, %s)", (jid, k))
    return jid


def ingest(conn: Conn, payload: object) -> dict:
    """Upsert candidates/jobs (keyed by external_id) and recalculate the scores they affect.

    Every record is checked first. If any record has problems, nothing is written and
    the error lists all of them. Otherwise everything is written in one transaction.
    """
    if not isinstance(payload, dict):
        raise ValidationError("body must be a JSON object")
    raw_c = payload.get("candidates", [])
    raw_j = payload.get("jobs", [])
    if not isinstance(raw_c, list) or not isinstance(raw_j, list):
        raise ValidationError("'candidates' and 'jobs' must be lists")
    if not raw_c and not raw_j:
        raise ValidationError("provide at least one candidate or job")

    # Stage 1: check every record. Nothing is written if any record has a problem.
    candidates, problems = _validate_list(raw_c, "candidates", _validate_candidate, "name")
    jobs, job_problems = _validate_list(raw_j, "jobs", _validate_job, "title")
    problems += job_problems
    problems += _duplicate_problems(raw_c, "candidates", "name")
    problems += _duplicate_problems(raw_j, "jobs", "title")
    if problems:
        raise ValidationError(
            f"{len(problems)} record(s) are invalid; nothing was saved", details=problems
        )

    # Stage 2: write everything in one transaction, then rescore only what changed.
    changed_c: set[int] = set()
    changed_j: set[int] = set()
    try:
        for c in candidates:
            changed_c.add(_upsert_candidate(conn, c))
        for j in jobs:
            changed_j.add(_upsert_job(conn, j))
        n = refresh_matches(conn, changed_c, changed_j)
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    return {"candidates": len(candidates), "jobs": len(jobs), "matches": n}


def seed(conn: Conn) -> dict:
    """Load the bundled seed file. It goes through the same checks and writes as /ingest."""
    return ingest(conn, json.loads(SEED_PATH.read_text()))


def is_empty(conn: Conn) -> bool:
    """True when there are no candidates yet. Startup uses this to decide whether to seed."""
    row = qone(conn, "SELECT COUNT(*) AS n FROM candidates")
    return row is not None and row["n"] == 0


# ----------------------------------------------------------------- matching

@dataclass
class _ScoringData:
    """Everything the scorer needs, loaded once per ingest and keyed by id."""
    cands: dict[int, dict]
    jobs: dict[int, dict]
    cand_skills: dict[int, set[str]]
    cand_traits: dict[int, set[str]]
    job_skills: dict[int, set[str]]
    job_kw: dict[int, set[str]]


def _load_scoring_data(conn: Conn) -> _ScoringData:
    """Read every candidate, job and link into dictionaries, so scoring needs no query per pair."""
    cand_skills: dict[int, set[str]] = {}
    for r in q(
        conn,
        """SELECT cs.candidate_id, s.name
           FROM candidate_skills cs JOIN skills s ON s.id = cs.skill_id""",
    ):
        cand_skills.setdefault(r["candidate_id"], set()).add(r["name"])
    cand_traits: dict[int, set[str]] = {}
    for r in q(conn, "SELECT candidate_id, trait FROM candidate_traits"):
        cand_traits.setdefault(r["candidate_id"], set()).add(r["trait"])
    job_skills: dict[int, set[str]] = {}
    for r in q(
        conn, "SELECT js.job_id, s.name FROM job_skills js JOIN skills s ON s.id = js.skill_id"
    ):
        job_skills.setdefault(r["job_id"], set()).add(r["name"])
    job_kw: dict[int, set[str]] = {}
    for r in q(conn, "SELECT job_id, keyword FROM job_culture_keywords"):
        job_kw.setdefault(r["job_id"], set()).add(r["keyword"])

    cands = {r["id"]: r for r in q(conn, "SELECT id, experience_years, availability FROM candidates")}
    jobs = {r["id"]: r for r in q(conn, "SELECT id, min_experience FROM jobs")}
    return _ScoringData(cands, jobs, cand_skills, cand_traits, job_skills, job_kw)


def _score_row(data: _ScoringData, cand_id: int, job_id: int) -> tuple:
    """Score one candidate-job pair and return the values for one matches row."""
    c = data.cands[cand_id]
    j = data.jobs[job_id]
    req = data.job_skills.get(job_id, set())
    s = scoring.score_match(
        data.cand_skills.get(cand_id, set()),
        c["experience_years"],
        data.cand_traits.get(cand_id, set()),
        c["availability"],
        req,
        j["min_experience"],
        data.job_kw.get(job_id, set()),
    )
    reason = scoring.build_reason(
        s, c["experience_years"], j["min_experience"], c["availability"], len(req)
    )
    return (cand_id, job_id, s.total, s.skill, s.experience, s.culture,
            s.availability, len(s.matched_skills), reason)


def _placeholders(ids: set[int]) -> str:
    """Return '%s, %s, ...' with one placeholder per id. The ids are still passed as parameters."""
    return ", ".join(["%s"] * len(ids))


def refresh_matches(conn: Conn, candidate_ids: set[int], job_ids: set[int]) -> int:
    """Recalculate only the scores that involve a changed candidate or job.

    A score depends only on its own candidate and job, so every other row is still
    correct and is left alone. Returns the number of rows recalculated.
    """
    data = _load_scoring_data(conn)
    # Every pair with a changed candidate, plus every pair with a changed job
    # and an unchanged candidate (so no pair is computed twice).
    pairs = [(c, j) for c in candidate_ids for j in data.jobs]
    pairs += [(c, j) for c in data.cands if c not in candidate_ids for j in job_ids]

    # Remove the stale rows for the changed records, then insert the fresh ones.
    if candidate_ids:
        q(conn, f"DELETE FROM matches WHERE candidate_id IN ({_placeholders(candidate_ids)})",
          tuple(candidate_ids))
    if job_ids:
        q(conn, f"DELETE FROM matches WHERE job_id IN ({_placeholders(job_ids)})",
          tuple(job_ids))
    rows = [_score_row(data, c, j) for c, j in pairs]
    if rows:
        qmany(
            conn,
            """INSERT INTO matches (candidate_id, job_id, score, skill_score, experience_score,
                                    culture_score, availability_score, matched_skills, reason)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)""",
            rows,
        )
    return len(rows)


# ------------------------------------------------------------------ queries

# One fixed query per skill table, so no identifier is ever built from input.
_CAND_SKILLS_SQL = (
    "SELECT s.name FROM candidate_skills t JOIN skills s ON s.id = t.skill_id "
    "WHERE t.candidate_id = %s ORDER BY s.name"
)
_JOB_SKILLS_SQL = (
    "SELECT s.name FROM job_skills t JOIN skills s ON s.id = t.skill_id "
    "WHERE t.job_id = %s ORDER BY s.name"
)


def list_candidates(conn: Conn) -> list[dict]:
    return [candidate_dict(conn, r) for r in q(conn, "SELECT * FROM candidates ORDER BY id")]


def list_jobs(conn: Conn) -> list[dict]:
    return [job_dict(conn, r) for r in q(conn, "SELECT * FROM jobs ORDER BY id")]


def candidate_dict(conn: Conn, r: dict) -> dict:
    """Turn one candidates row into the JSON shape the API returns, with its skills and traits."""
    traits = q(
        conn, "SELECT trait FROM candidate_traits WHERE candidate_id = %s ORDER BY trait", (r["id"],)
    )
    return {
        "id": r["id"],
        "external_id": r["external_id"],
        "name": r["name"],
        "skills": [x["name"] for x in q(conn, _CAND_SKILLS_SQL, (r["id"],))],
        "experience_years": r["experience_years"],
        "availability": r["availability"],
        "traits": [t["trait"] for t in traits],
        "quirk": r["quirk"],
    }


def job_dict(conn: Conn, r: dict) -> dict:
    """Turn one jobs row into the JSON shape the API returns, with its skills and keywords."""
    kws = q(
        conn, "SELECT keyword FROM job_culture_keywords WHERE job_id = %s ORDER BY keyword", (r["id"],)
    )
    return {
        "id": r["id"],
        "external_id": r["external_id"],
        "title": r["title"],
        "required_skills": [x["name"] for x in q(conn, _JOB_SKILLS_SQL, (r["id"],))],
        "min_experience": r["min_experience"],
        "culture_keywords": [k["keyword"] for k in kws],
        "tagline": r["tagline"],
    }


def get_candidate(conn: Conn, id_: int) -> dict | None:
    r = qone(conn, "SELECT * FROM candidates WHERE id = %s", (id_,))
    return candidate_dict(conn, r) if r else None


def get_job(conn: Conn, id_: int) -> dict | None:
    r = qone(conn, "SELECT * FROM jobs WHERE id = %s", (id_,))
    return job_dict(conn, r) if r else None


def _breakdown(r: dict) -> dict:
    """Format a stored match row for the API. Values are rounded for display only."""
    return {
        "score": round(r["score"], 1),
        "reason": r["reason"],
        "breakdown": {
            "skills": round(r["skill_score"], 3),
            "experience": round(r["experience_score"], 3),
            "culture": round(r["culture_score"], 3),
            "availability": round(r["availability_score"], 3),
        },
    }


# Deterministic ranking. Ties on score fall through to: more required skills
# covered, sooner availability, better experience fit, then name/title and id
# so the order is always stable and never depends on insertion order.
def matches_for_job(conn: Conn, job_id: int, limit: int, min_score: float) -> list[dict]:
    """Best candidates for one job, highest score first, capped at limit."""
    rows = q(
        conn,
        """SELECT c.id, c.external_id, c.name, c.experience_years, c.availability,
                  m.score, m.skill_score, m.experience_score, m.culture_score,
                  m.availability_score, m.reason
           FROM matches m JOIN candidates c ON c.id = m.candidate_id
           WHERE m.job_id = %s AND m.score >= %s AND m.score > 0
           ORDER BY m.score DESC, m.skill_score DESC, m.availability_score DESC,
                    m.experience_score DESC, c.name ASC, c.id ASC
           LIMIT %s""",
        (job_id, min_score, limit),
    )
    return [
        {
            "rank": i,
            "candidate": {
                "id": r["id"], "external_id": r["external_id"], "name": r["name"],
                "experience_years": r["experience_years"], "availability": r["availability"],
            },
            **_breakdown(r),
        }
        for i, r in enumerate(rows, 1)
    ]


def matches_for_candidate(
    conn: Conn, candidate_id: int, limit: int, min_score: float
) -> list[dict]:
    """Best jobs for one candidate, highest score first, capped at limit."""
    rows = q(
        conn,
        """SELECT j.id, j.external_id, j.title, j.min_experience,
                  m.score, m.skill_score, m.experience_score, m.culture_score,
                  m.availability_score, m.reason
           FROM matches m JOIN jobs j ON j.id = m.job_id
           WHERE m.candidate_id = %s AND m.score >= %s AND m.score > 0
           ORDER BY m.score DESC, m.skill_score DESC, m.experience_score DESC,
                    j.title ASC, j.id ASC
           LIMIT %s""",
        (candidate_id, min_score, limit),
    )
    return [
        {
            "rank": i,
            "job": {"id": r["id"], "external_id": r["external_id"], "title": r["title"],
                    "min_experience": r["min_experience"]},
            **_breakdown(r),
        }
        for i, r in enumerate(rows, 1)
    ]
