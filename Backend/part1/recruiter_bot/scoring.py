"""Pure scoring functions: no I/O, no SQL. Everything is 0..1 until the end."""

from dataclasses import dataclass

# Weights sum to 1. Skills dominate: a job is first about "can you do it".
W_SKILL = 0.55
W_EXPERIENCE = 0.25
W_CULTURE = 0.10
W_AVAILABILITY = 0.10

# "Not looking" is penalised, not excluded: a recruiter may still want to
# approach a perfect-fit passive candidate, they just rank below ready ones.
AVAILABILITY_SCORE = {"Immediate": 1.0, "2 weeks": 0.7, "Not looking": 0.2}

# Experience above 3x the minimum is slightly discounted (overqualified /
# flight risk), but never below this floor: seniority is not a defect.
OVERQUALIFIED_RATIO = 3.0
OVERQUALIFIED_FLOOR = 0.8

# Hand-picked groups of near-synonymous tags. Exact tag match earns full
# credit, same-group earns SYNONYM_CREDIT. Deliberately tiny and explicit.
SYNONYM_GROUPS = [
    {"calm", "calm-under-pressure", "resilient"},
    {"innovative", "genius", "improviser"},
    {"enthusiastic", "energetic", "optimistic"},
    {"persistent", "tenacious"},
    {"organized", "detail-oriented"},
    {"decisive", "confident"},
]
SYNONYM_CREDIT = 0.5


# A plain container for one score and its parts. frozen=True means it can't be changed afterwards.
@dataclass(frozen=True)
class Score:
    total: float  # 0..100
    skill: float
    experience: float
    culture: float
    availability: float
    matched_skills: tuple[str, ...]
    missing_skills: tuple[str, ...]
    shared_culture: tuple[str, ...]


def skill_coverage(candidate_skills: set[str], required: set[str]) -> float:
    """Share of the job's required skills the candidate has (0..1)."""
    if not required:
        return 0.0
    # & is set intersection: the skills that both sides have.
    return len(candidate_skills & required) / len(required)


def experience_fit(years: int, minimum: int) -> float:
    """Linear ramp up to the minimum, flat 1.0 after, mild overqualified taper."""
    if minimum <= 0:
        return 1.0
    ratio = years / minimum
    # Below the minimum: a proportional penalty, e.g. 2 years against a minimum of 4 gives 0.5.
    if ratio < 1:
        return ratio
    # Between the minimum and 3x it: full credit.
    if ratio <= OVERQUALIFIED_RATIO:
        return 1.0
    # Far above the minimum: lose 5% per extra multiple, but never drop below the floor.
    return max(OVERQUALIFIED_FLOOR, 1.0 - 0.05 * (ratio - OVERQUALIFIED_RATIO))


def _same_group(a: str, b: str) -> bool:
    """True if both tags are in the same synonym group."""
    return any(a in g and b in g for g in SYNONYM_GROUPS)


def culture_fit(traits: set[str], keywords: set[str]) -> tuple[float, tuple[str, ...]]:
    """Average best credit per culture keyword; returns score and shared tags."""
    if not keywords:
        return 0.0, ()
    total = 0.0
    shared = []
    for kw in sorted(keywords):
        if kw in traits:
            total += 1.0
            shared.append(kw)
        elif any(_same_group(kw, t) for t in traits):
            total += SYNONYM_CREDIT
            shared.append(kw + " (~)")
    # Average over every keyword, so each missing keyword lowers the score.
    return total / len(keywords), tuple(shared)


def score_match(
    cand_skills: set[str],
    cand_years: int,
    cand_traits: set[str],
    availability: str,
    job_skills: set[str],
    job_min_exp: int,
    job_keywords: set[str],
) -> Score:
    """Combine the four factors into one 0-100 score, keeping the parts for the explanation."""
    skill = skill_coverage(cand_skills, job_skills)
    exp = experience_fit(cand_years, job_min_exp)
    culture, shared = culture_fit(cand_traits, job_keywords)
    avail = AVAILABILITY_SCORE.get(availability, 0.0)

    # Gate: zero required-skill overlap is never a match, whatever else fits.
    if skill == 0:
        total = 0.0
    else:
        # Experience/culture/availability only count in proportion to the skills
        # actually covered: a perfectly available, senior person who has 1 of 3
        # required skills must not look like a near-match.
        total = 100 * skill * (
            W_SKILL + W_EXPERIENCE * exp + W_CULTURE * culture + W_AVAILABILITY * avail
        )
    # Keep the individual parts, so build_reason can explain the score.
    return Score(
        total=total,
        skill=skill,
        experience=exp,
        culture=culture,
        availability=avail,
        matched_skills=tuple(sorted(cand_skills & job_skills)),
        missing_skills=tuple(sorted(job_skills - cand_skills)),
        shared_culture=shared,
    )


def build_reason(s: Score, years: int, minimum: int, availability: str, n_required: int) -> str:
    """Write the short reason shown in API results, e.g. '3/3 required skills; 8 yrs vs 3 min; ...'."""
    # Each part is one short fact. They are joined with semicolons at the end.
    parts = [f"{len(s.matched_skills)}/{n_required} required skills"]
    if s.matched_skills:
        parts[0] += f" ({', '.join(s.matched_skills)})"
    if s.missing_skills:
        parts.append(f"missing {', '.join(s.missing_skills)}")
    if years >= minimum:
        parts.append(f"{years} yrs vs {minimum} min")
    else:
        parts.append(f"under-experienced: {years} yrs vs {minimum} min")
    if s.shared_culture:
        parts.append(f"culture: {', '.join(s.shared_culture)}")
    parts.append(f"availability: {availability}")
    return "; ".join(parts)
