# O*NET data for ACRDS career skill requirements

Public data used to validate the skill requirement levels in
`app/components/career/data/career_requirements.json`.

| File | What it is |
|---|---|
| `onet_career_skills.csv` | 10 careers x 9 skills: O*NET importance (1-5), O*NET level (0-7), rounded requirement, and the hand-set level |
| `onet_elements_extract.csv` | The raw O*NET rows these were computed from (only the occupations and elements ACRDS uses) |
| `raw/` | Full O*NET text files (~29 MB). Not committed; re-downloaded by the script |

Rebuild from `backend/`:

    python -m ml_training.career.build_onet_requirements

Results and method: `ml_training/career/reports/onet_requirements_report.md`.

## Source and download links

O*NET 30.2 Database - U.S. Department of Labor, Employment and Training Administration.

- Database page: https://www.onetcenter.org/database.html
- Skills: https://www.onetcenter.org/dl_files/database/db_30_2_text/Skills.txt
- Abilities: https://www.onetcenter.org/dl_files/database/db_30_2_text/Abilities.txt
- Knowledge: https://www.onetcenter.org/dl_files/database/db_30_2_text/Knowledge.txt
- Work Activities: https://www.onetcenter.org/dl_files/database/db_30_2_text/Work%20Activities.txt
- Occupation Data: https://www.onetcenter.org/dl_files/database/db_30_2_text/Occupation%20Data.txt

## Licence and attribution

This work includes information from the O*NET 30.2 Database by the U.S. Department of Labor,
Employment and Training Administration (USDOL/ETA), used under the CC BY 4.0 license.
O*NET(R) is a trademark of USDOL/ETA. The information has been modified (occupations and
elements selected and averaged); USDOL/ETA has not approved, endorsed, or tested these modifications.
