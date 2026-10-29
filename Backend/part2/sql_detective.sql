-- Part 2: SQL Detective (MySQL 8.0+). Run against the dataset in hiring_ops_setup.sql.
--
-- Data quirks that shape the answers below:
--   * Ananya Rao is two applicant rows (ids 1 and 2) with the same email in a
--     different case. A person is identified by LOWER(TRIM(email)), not by id.
--   * Interviews link applicants to jobs; there is no separate "applications"
--     table, so "applied to / reached a stage for a job" is read from interviews.
--   * Job 6 has no interviews at all and must still appear where asked "for each job".

USE hiring_ops;

-- Q1: All currently open job postings with the owning recruiter's name.
SELECT jp.id,
       jp.title,
       jp.department,
       jp.opened_date,
       r.name AS recruiter
FROM job_postings jp
JOIN recruiters r ON r.id = jp.recruiter_id
WHERE jp.status = 'open'
ORDER BY jp.id;

-- Q2: For each job posting, how many applicants reached the Final stage?
-- "Reached" = has a Final-stage interview, whatever its outcome. People are
-- de-duplicated by email so a duplicate applicant row cannot be counted twice.
-- LEFT JOIN keeps jobs where nobody reached Final (count 0).
SELECT jp.id,
       jp.title,
       jp.status,
       COUNT(DISTINCT LOWER(TRIM(a.email))) AS applicants_reaching_final
FROM job_postings jp
LEFT JOIN interviews i
       ON i.job_posting_id = jp.id
      AND i.stage = 'Final'
LEFT JOIN applicants a ON a.id = i.applicant_id
GROUP BY jp.id, jp.title, jp.status
ORDER BY jp.id;

-- Q3: Every person who effectively applied to more than one job posting.
-- Identity = normalised email (collapses Ananya's two rows). A person "applied"
-- to a posting if they have at least one interview for it.
SELECT LOWER(TRIM(a.email))                       AS person_email,
       MIN(a.full_name)                           AS full_name,
       COUNT(DISTINCT i.job_posting_id)           AS postings_applied_to,
       GROUP_CONCAT(DISTINCT i.job_posting_id ORDER BY i.job_posting_id) AS posting_ids
FROM applicants a
JOIN interviews i ON i.applicant_id = a.id
GROUP BY LOWER(TRIM(a.email))
HAVING COUNT(DISTINCT i.job_posting_id) > 1
ORDER BY full_name;

-- Q4: Final-stage conversion rate per recruiter (passed / total Final interviews),
-- only recruiters with at least 3 Final-stage interviews. Pending (NULL) and
-- no_show Finals count in the denominator: they were Final interviews that
-- did not convert.
SELECT r.id,
       r.name,
       COUNT(*)                                        AS final_interviews,
       SUM(i.outcome = 'passed')                       AS passed,
       ROUND(SUM(i.outcome = 'passed') / COUNT(*), 4)  AS conversion_rate
FROM recruiters r
JOIN job_postings jp ON jp.recruiter_id = r.id
JOIN interviews  i   ON i.job_posting_id = jp.id AND i.stage = 'Final'
GROUP BY r.id, r.name
HAVING COUNT(*) >= 3
ORDER BY conversion_rate DESC, r.name;

-- Q5 (Bonus): Recruiter with the most successful placements (Final passed) per
-- department, using a window function. RANK() keeps ties (all tied recruiters
-- are returned); recruiters with 0 placements are not considered.
SELECT department, recruiter, placements
FROM (
    SELECT jp.department,
           r.name AS recruiter,
           COUNT(*) AS placements,
           RANK() OVER (PARTITION BY jp.department ORDER BY COUNT(*) DESC) AS rnk
    FROM interviews i
    JOIN job_postings jp ON jp.id = i.job_posting_id
    JOIN recruiters   r  ON r.id = jp.recruiter_id
    WHERE i.stage = 'Final' AND i.outcome = 'passed'
    GROUP BY jp.department, r.id, r.name
) ranked
WHERE rnk = 1
ORDER BY department;
