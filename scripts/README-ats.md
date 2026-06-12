# Local ATS Scoring

This script scores applicant resumes locally. It does not run on Railway.

It:

- reads applications and jobs from MongoDB;
- downloads resumes from Google Drive;
- calculates one explainable hybrid ATS score out of 10;
- stores `atsScore` and `atsScoredAt` in MongoDB;
- writes the score into the existing `Applications` Google Sheet;
- renames legacy ROS developer application titles to `Robotics Engineer`.

## Setup

From the backend directory:

```powershell
python -m venv .venv-ats
.\.venv-ats\Scripts\Activate.ps1
pip install -r requirements-ats.txt
```

The script uses the existing backend `.env` and Google credentials.
For resume downloads it first uses `GOOGLE_DRIVE_CREDENTIALS_PATH`, then the
local `google-drive-credentials.json`, and finally the existing Drive OAuth
values from `.env`.

The hybrid score uses:

- required skills: 40%;
- preferred skills: 10%;
- local `all-MiniLM-L6-v2` semantic responsibility/project relevance: 35%;
- education and practical evidence: 15%.

When an existing score is replaced, it is preserved as `previousAtsScore` and
`previousAtsScoredAt`. The score breakdown and matched/missing skills are also
stored in MongoDB.

## Run

Preview changes without writing:

```powershell
python scripts\score_applications.py --dry-run
```

Score applicants that do not yet have an ATS score:

```powershell
python scripts\score_applications.py
```

Recalculate every applicant:

```powershell
python scripts\score_applications.py --rescore
```

Always preview rescoring first:

```powershell
python scripts\score_applications.py --rescore --dry-run
```

Use `--limit 5` to process only a small batch.

The spreadsheet row is matched by applicant email and normalized job title.
Duplicate applications are paired in chronological order. Missing rows are
skipped and reported instead of updating the wrong applicant.
