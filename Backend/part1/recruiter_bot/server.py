"""Tiny JSON API on the stdlib http.server (no framework, no dependencies)."""

import json
import re
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

from . import db

MAX_BODY = 1_000_000  # bytes
DEFAULT_LIMIT, MAX_LIMIT = 10, 100

# Each route is a regex. (\d+) captures the numeric id, e.g. /jobs/12/matches gives 12.
ROUTE_JOB_MATCHES = re.compile(r"^/jobs/(\d+)/matches$")
ROUTE_CAND_MATCHES = re.compile(r"^/candidates/(\d+)/matches$")
ROUTE_JOB = re.compile(r"^/jobs/(\d+)$")
ROUTE_CAND = re.compile(r"^/candidates/(\d+)$")


# Raise this anywhere in a request to send a specific HTTP status and message back.
class HttpError(Exception):
    def __init__(self, status: int, message: str):
        self.status, self.message = status, message


def make_handler():
    # A new Handler object is created for each incoming request.
    class Handler(BaseHTTPRequestHandler):
        server_version = "RecruiterBot/1.0"

        def log_message(self, fmt, *args):  # quieter default logging
            sys.stderr.write("%s %s\n" % (self.command, self.path))

        # one short-lived connection per request (threads never share one)
        def _conn(self):
            return db.connect()

        def _send(self, status: int, body: object) -> None:
            # Length is in bytes, which is what Content-Length needs (not characters).
            data = json.dumps(body, indent=2).encode()
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        def _query_params(self, query: str) -> tuple[int, float]:
            # Turns "limit=3&min_score=40" into a dict. Missing keys use the defaults below.
            qs = parse_qs(query)
            try:
                limit = int(qs.get("limit", [DEFAULT_LIMIT])[0])
                min_score = float(qs.get("min_score", [0])[0])
            except ValueError:
                raise HttpError(400, "'limit' must be an integer and 'min_score' a number")
            if not 1 <= limit <= MAX_LIMIT:
                raise HttpError(400, f"'limit' must be between 1 and {MAX_LIMIT}")
            if not 0 <= min_score <= 100:
                raise HttpError(400, "'min_score' must be between 0 and 100")
            return limit, min_score

        def _dispatch(self, method: str) -> None:
            try:
                url = urlparse(self.path)
                path = url.path.rstrip("/") or "/"
                # One connection per request, closed in the finally block below.
                conn = self._conn()
                try:
                    status, body = self._route(conn, method, path, url.query)
                finally:
                    conn.close()
                self._send(status, body)
            except HttpError as e:
                self._send(e.status, {"error": e.message})
            except db.ValidationError as e:
                # Include the per-record problems when there are any.
                body = {"error": str(e)}
                if e.details:
                    body["details"] = e.details
                self._send(400, body)
            except Exception as e:  # never leak a traceback to the client
                sys.stderr.write(f"internal error: {e!r}\n")
                self._send(500, {"error": "internal server error"})

        def _route(self, conn, method: str, path: str, query: str):
            # Routes are checked in order; the first match handles the request.
            if method == "GET":
                if path == "/health":
                    return 200, {"status": "ok"}
                if path == "/candidates":
                    return 200, db.list_candidates(conn)
                if path == "/jobs":
                    return 200, db.list_jobs(conn)
                # The walrus operator stores the regex match in m and tests it in one step.
                if m := ROUTE_CAND.match(path):
                    c = db.get_candidate(conn, int(m[1]))
                    if c is None:
                        raise HttpError(404, f"candidate {m[1]} not found")
                    return 200, c
                if m := ROUTE_JOB.match(path):
                    j = db.get_job(conn, int(m[1]))
                    if j is None:
                        raise HttpError(404, f"job {m[1]} not found")
                    return 200, j
                if m := ROUTE_JOB_MATCHES.match(path):
                    job = db.get_job(conn, int(m[1]))
                    if job is None:
                        raise HttpError(404, f"job {m[1]} not found")
                    limit, min_score = self._query_params(query)
                    return 200, {
                        "job": {"id": job["id"], "external_id": job["external_id"], "title": job["title"]},
                        "matches": db.matches_for_job(conn, job["id"], limit, min_score),
                    }
                if m := ROUTE_CAND_MATCHES.match(path):
                    cand = db.get_candidate(conn, int(m[1]))
                    if cand is None:
                        raise HttpError(404, f"candidate {m[1]} not found")
                    limit, min_score = self._query_params(query)
                    return 200, {
                        "candidate": {"id": cand["id"], "external_id": cand["external_id"], "name": cand["name"]},
                        "matches": db.matches_for_candidate(conn, cand["id"], limit, min_score),
                    }
            elif method == "POST":
                if path == "/ingest":
                    return 201, db.ingest(conn, self._read_json())
            raise HttpError(404, "not found")

        def _read_json(self) -> object:
            try:
                length = int(self.headers.get("Content-Length", 0))
            except ValueError:
                raise HttpError(400, "invalid Content-Length")
            # No body was sent, so there is nothing to ingest.
            if length <= 0:
                raise HttpError(400, "request body required")
            if length > MAX_BODY:
                raise HttpError(413, "body too large")
            try:
                # Read exactly the announced number of bytes, then parse them as JSON.
                return json.loads(self.rfile.read(length))
            except json.JSONDecodeError:
                raise HttpError(400, "body is not valid JSON")

        def do_GET(self):
            self._dispatch("GET")

        def do_POST(self):
            self._dispatch("POST")

    return Handler


def main() -> None:
    import argparse

    # Command-line options. Every one has a default, so plain "python -m recruiter_bot" works.
    p = argparse.ArgumentParser(description="Recruiter Bot API")
    p.add_argument("--host", default="127.0.0.1")
    p.add_argument("--port", type=int, default=8000)
    p.add_argument("--no-seed", action="store_true", help="do not auto-seed an empty database")
    a = p.parse_args()

    # Startup: make sure the database and tables exist before accepting requests.
    db.create_database_if_missing(db.config()["database"])
    conn = db.connect()
    db.init_schema(conn)
    if not a.no_seed and db.is_empty(conn):
        print("empty database, seeding:", db.seed(conn))
    conn.close()

    # One thread per request, so one slow request doesn't hold up the others.
    srv = ThreadingHTTPServer((a.host, a.port), make_handler())
    print(f"Recruiter Bot listening on http://{a.host}:{a.port} (mysql: {db.config()["host"]}:{db.config()["port"]}/{db.config()["database"]})")
    # Ctrl+C stops the server quietly instead of printing a traceback.
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass
