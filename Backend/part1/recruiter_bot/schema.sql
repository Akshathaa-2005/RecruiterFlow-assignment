-- Recruiter Bot schema (hand-written DDL, MySQL 8.0+, InnoDB, utf8mb4).
-- Statements are separated by ";" at end of line and executed one by one.
-- Skills are normalised into one dictionary table so "pattern-recognition" is
-- stored once and overlap is a plain JOIN. Traits and culture keywords are
-- free-form tags, so they live in simple child tables.

-- external_id is the stable ID from the source system. It identifies the row,
-- so the name can change without creating a new candidate. utf8mb4_bin makes it
-- case-sensitive, so 'CAND-001' and 'cand-001' are different IDs.
CREATE TABLE IF NOT EXISTS candidates (
    id               INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    external_id      VARCHAR(64)  NOT NULL COLLATE utf8mb4_bin,
    name             VARCHAR(100) NOT NULL,
    experience_years INT UNSIGNED NOT NULL,
    availability     ENUM('Immediate', '2 weeks', 'Not looking') NOT NULL,
    quirk            VARCHAR(500) NULL,
    UNIQUE KEY uq_candidates_external_id (external_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS jobs (
    id             INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    external_id    VARCHAR(64)  NOT NULL COLLATE utf8mb4_bin,
    title          VARCHAR(150) NOT NULL,
    min_experience INT UNSIGNED NOT NULL,
    tagline        VARCHAR(500) NULL,
    UNIQUE KEY uq_jobs_external_id (external_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS skills (
    id   INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    UNIQUE KEY uq_skills_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS candidate_skills (
    candidate_id INT UNSIGNED NOT NULL,
    skill_id     INT UNSIGNED NOT NULL,
    PRIMARY KEY (candidate_id, skill_id),
    KEY idx_candidate_skills_skill (skill_id),
    CONSTRAINT fk_cs_candidate FOREIGN KEY (candidate_id) REFERENCES candidates (id) ON DELETE CASCADE,
    CONSTRAINT fk_cs_skill     FOREIGN KEY (skill_id)     REFERENCES skills (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS job_skills (
    job_id   INT UNSIGNED NOT NULL,
    skill_id INT UNSIGNED NOT NULL,
    PRIMARY KEY (job_id, skill_id),
    KEY idx_job_skills_skill (skill_id),
    CONSTRAINT fk_js_job   FOREIGN KEY (job_id)   REFERENCES jobs (id) ON DELETE CASCADE,
    CONSTRAINT fk_js_skill FOREIGN KEY (skill_id) REFERENCES skills (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS candidate_traits (
    candidate_id INT UNSIGNED NOT NULL,
    trait        VARCHAR(100) NOT NULL,
    PRIMARY KEY (candidate_id, trait),
    CONSTRAINT fk_ct_candidate FOREIGN KEY (candidate_id) REFERENCES candidates (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS job_culture_keywords (
    job_id  INT UNSIGNED NOT NULL,
    keyword VARCHAR(100) NOT NULL,
    PRIMARY KEY (job_id, keyword),
    CONSTRAINT fk_jck_job FOREIGN KEY (job_id) REFERENCES jobs (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- A "match" is a materialised, scored (candidate, job) pair. Scoring is cheap
-- but stored so both API directions are one indexed SELECT, and so the score
-- breakdown is inspectable with plain SQL. Rows for changed records are recalculated on each ingestion.
CREATE TABLE IF NOT EXISTS matches (
    candidate_id       INT UNSIGNED NOT NULL,
    job_id             INT UNSIGNED NOT NULL,
    score              DOUBLE NOT NULL,
    skill_score        DOUBLE NOT NULL,
    experience_score   DOUBLE NOT NULL,
    culture_score      DOUBLE NOT NULL,
    availability_score DOUBLE NOT NULL,
    matched_skills     INT UNSIGNED NOT NULL,
    reason             VARCHAR(1000) NOT NULL,
    PRIMARY KEY (candidate_id, job_id),
    -- Serve "ranked list for X" without sorting the whole table.
    KEY idx_matches_job       (job_id, score DESC),
    KEY idx_matches_candidate (candidate_id, score DESC),
    CONSTRAINT chk_matches_score CHECK (score BETWEEN 0 AND 100),
    CONSTRAINT fk_m_candidate FOREIGN KEY (candidate_id) REFERENCES candidates (id) ON DELETE CASCADE,
    CONSTRAINT fk_m_job       FOREIGN KEY (job_id)       REFERENCES jobs (id)       ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;