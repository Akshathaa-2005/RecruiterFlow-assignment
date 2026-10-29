# Recruiter Bot: Part 2 (SQL Detective)

Five SQL questions about a small hiring dataset. Both files are hand-written MySQL 8.0+ SQL. There is no application code.

- `hiring_ops_setup.sql` creates the `hiring_ops` database and loads the dataset exactly as given.
- `sql_detective.sql` holds one query per question, each preceded by a `-- Qn` comment.

## Run it

Requires a running **MySQL 8.0+** server. From the `Backend/part2` folder:

```bash
mysql -u root -p < hiring_ops_setup.sql
mysql -u root -p -t < sql_detective.sql
```

If `mysql` is not on your PATH, use the MySQL app's client, for example `/usr/local/mysql/bin/mysql`. You can also open the two files in MySQL Workbench and run them in that order.

## Answers

| Question | Answer |
|---|---|
| Q1: open job postings with their recruiter | Jobs 1, 2, 4 and 5 (Priya Shah, Daniel Ortiz, Priya Shah, Wei Zhang) |
| Q2: applicants who reached Final, per job | Jobs 1 to 7: 2, 2, 1, 2, 0, 0, 2 |
| Q3: people who applied to more than one job | Ananya Rao (jobs 1, 4), Ben Turner (jobs 1, 3), Elena Popescu (jobs 2, 7) |
| Q4: Final-stage conversion, recruiters with at least 3 Final interviews | Priya Shah 0.75, Daniel Ortiz 0.50 |
| Q5 (bonus): top recruiter by Final placements per department | Data: Fatima Al-Sayed (1). Engineering: Priya Shah (3) |

## Decisions in the data

- **Ananya Rao appears twice.** The two rows have the same email in different case. People are identified by `LOWER(TRIM(email))`, which is why Q2 and Q3 use it.
- **Interviews are the only link to a job.** There's no separate applications table, so "applied to a job" means "has an interview for it".
- **Jobs with no Finals still appear.** Q2 uses a `LEFT JOIN`, so job 5 and job 6 show `0` rather than disappearing.
- **Q4 keeps pending and no-show Finals in the denominator.** Those were Final interviews that did not convert.
- **Q5 uses `RANK()`, not `ROW_NUMBER()`.** Ties on placements are all kept rather than broken arbitrarily. Recruiters with no placements are not considered.

## AI tools

Written with the help of Claude Code 