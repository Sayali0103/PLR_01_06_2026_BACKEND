"""Locally score applicant resumes and sync scores to MongoDB and Google Sheets."""

import argparse
import io
import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

from docx import Document
from dotenv import load_dotenv
from google.oauth2 import service_account
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload
from pymongo import MongoClient
from pypdf import PdfReader
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity


BACKEND_DIR = Path(__file__).resolve().parents[1]
APPLICATION_TAB = "Applications"
LEGACY_JOB_TITLES = {
    "ros developer engineer",
    "ros developer",
    "ros engineer",
}
CURRENT_JOB_TITLE = "Robotics Engineer"
HEADER_ALIASES = {
    "Email": {
        "email",
        "college email id : please enter correct email id only",
    },
    "Job Title": {
        "job title",
        "which role you are applying for?",
    },
    "ATS Score": {
        "ats score",
    },
}


def parse_args():
    parser = argparse.ArgumentParser(
        description="Score resumes locally and sync ATS scores to MongoDB and Google Sheets."
    )
    parser.add_argument(
        "--rescore",
        action="store_true",
        help="Recalculate applications that already have an ATS score.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Calculate and report changes without writing to MongoDB or Google Sheets.",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=0,
        help="Process at most this many applications; 0 processes all.",
    )
    return parser.parse_args()


def required_env(name):
    value = os.getenv(name)
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


def normalized(value):
    return re.sub(r"\s+", " ", str(value or "").strip().lower())


def canonical_job_title(title):
    return CURRENT_JOB_TITLE if normalized(title) in LEGACY_JOB_TITLES else str(title or "").strip()


def column_letter(index):
    result = ""
    while index:
        index, remainder = divmod(index - 1, 26)
        result = chr(65 + remainder) + result
    return result


def resolve_header_map(headers):
    normalized_headers = {normalized(header): index for index, header in enumerate(headers)}
    resolved = {}
    for logical_name, aliases in HEADER_ALIASES.items():
        for alias in aliases:
            if normalized(alias) in normalized_headers:
                resolved[logical_name] = normalized_headers[normalized(alias)]
                break
    return resolved


def sheets_credentials():
    credentials_json = os.getenv("GOOGLE_SHEETS_CREDENTIALS_JSON")
    if credentials_json:
        info = json.loads(credentials_json)
        return service_account.Credentials.from_service_account_info(
            info, scopes=["https://www.googleapis.com/auth/spreadsheets"]
        )

    path = os.getenv("GOOGLE_SHEETS_CREDENTIALS_PATH") or os.getenv("GOOGLE_CREDENTIALS_PATH")
    if not path:
        raise RuntimeError("Missing Google Sheets credentials path or JSON")
    path = Path(path)
    if not path.is_absolute():
        path = BACKEND_DIR / path
    return service_account.Credentials.from_service_account_file(
        path, scopes=["https://www.googleapis.com/auth/spreadsheets"]
    )


def drive_credentials():
    service_account_path = os.getenv("GOOGLE_DRIVE_CREDENTIALS_PATH")
    if service_account_path:
        service_account_path = Path(service_account_path)
    else:
        service_account_path = BACKEND_DIR / "google-drive-credentials.json"

    if not service_account_path.is_absolute():
        service_account_path = BACKEND_DIR / service_account_path
    if service_account_path.exists():
        return service_account.Credentials.from_service_account_file(
            service_account_path,
            scopes=["https://www.googleapis.com/auth/drive.readonly"],
        )

    return Credentials(
        token=None,
        refresh_token=required_env("GOOGLE_DRIVE_REFRESH_TOKEN"),
        token_uri="https://oauth2.googleapis.com/token",
        client_id=required_env("GOOGLE_DRIVE_CLIENT_ID"),
        client_secret=required_env("GOOGLE_DRIVE_CLIENT_SECRET"),
        scopes=["https://www.googleapis.com/auth/drive.readonly"],
    )


def download_drive_file(drive, file_id):
    request = drive.files().get_media(fileId=file_id)
    output = io.BytesIO()
    downloader = MediaIoBaseDownload(output, request)
    done = False
    while not done:
        _, done = downloader.next_chunk()
    return output.getvalue()


def extract_resume_text(content, filename):
    suffix = Path(filename or "").suffix.lower()
    stream = io.BytesIO(content)

    if suffix == ".pdf" or content.startswith(b"%PDF"):
        return "\n".join(page.extract_text() or "" for page in PdfReader(stream).pages).strip()
    if suffix == ".docx" or content.startswith(b"PK\x03\x04"):
        return "\n".join(paragraph.text for paragraph in Document(stream).paragraphs).strip()

    raise ValueError(f"Unsupported resume format: {suffix or 'unknown'}")


def job_description(job, fallback_title):
    values = [
        job.get("title") if job else fallback_title,
        job.get("overview") if job else "",
        *(job.get("responsibilities", []) if job else []),
        *(job.get("requiredSkills", []) if job else []),
        *(job.get("additionalSkills", []) if job else []),
        *(job.get("tags", []) if job else []),
    ]
    return "\n".join(str(value) for value in values if value)


def meaningful_terms(text):
    return {
        token
        for token in re.findall(r"[a-zA-Z][a-zA-Z0-9+#.-]{1,}", normalized(text))
        if len(token) > 2
    }


def score_resume(resume_text, description, job):
    vectorizer = TfidfVectorizer(stop_words="english", ngram_range=(1, 2))
    matrix = vectorizer.fit_transform([resume_text, description])
    similarity = float(cosine_similarity(matrix[0:1], matrix[1:2])[0][0])

    skill_phrases = []
    if job:
        skill_phrases = [
            str(skill).strip()
            for skill in job.get("tags", [])
            if str(skill).strip()
        ]

    resume_normalized = normalized(resume_text)
    if skill_phrases:
        matched = sum(normalized(skill) in resume_normalized for skill in skill_phrases)
        skills_ratio = matched / len(skill_phrases)
    else:
        description_terms = meaningful_terms(description)
        resume_terms = meaningful_terms(resume_text)
        skills_ratio = (
            len(description_terms & resume_terms) / len(description_terms)
            if description_terms
            else 0
        )

    # Resume/JD cosine values are usually well below 1, so normalize 0.5 as a strong match.
    normalized_similarity = min(similarity / 0.5, 1)
    return round(min(10, max(0, 10 * ((0.7 * normalized_similarity) + (0.3 * skills_ratio)))), 1)


def ensure_sheet_headers(sheets, spreadsheet_id, dry_run):
    result = sheets.spreadsheets().values().get(
        spreadsheetId=spreadsheet_id,
        range=f"'{APPLICATION_TAB}'!1:1",
    ).execute()
    headers = result.get("values", [[]])[0]

    if "ATS Score" not in headers:
        headers.append("ATS Score")
        if not dry_run:
            sheets.spreadsheets().values().update(
                spreadsheetId=spreadsheet_id,
                range=f"'{APPLICATION_TAB}'!A1",
                valueInputOption="RAW",
                body={"values": [headers]},
            ).execute()

    return headers


def load_sheet_rows(sheets, spreadsheet_id):
    result = sheets.spreadsheets().values().get(
        spreadsheetId=spreadsheet_id,
        range=f"'{APPLICATION_TAB}'!A:ZZ",
    ).execute()
    return result.get("values", [])


def sheet_row_matches(rows, header_map, application, claimed_rows):
    email = normalized(application.get("email"))
    job_title = normalized(canonical_job_title(application.get("jobTitle")))
    matches = []

    for row_number, row in enumerate(rows[1:], start=2):
        if row_number in claimed_rows:
            continue
        row_email = normalized(row[header_map["Email"]]) if len(row) > header_map["Email"] else ""
        raw_row_title = row[header_map["Job Title"]] if len(row) > header_map["Job Title"] else ""
        row_title = normalized(canonical_job_title(raw_row_title))
        if row_email == email and row_title == job_title:
            matches.append(row_number)
    return matches


def update_sheet_row(sheets, spreadsheet_id, header_map, row_number, title, score):
    updates = [
        {
            "range": f"'{APPLICATION_TAB}'!{column_letter(header_map['Job Title'] + 1)}{row_number}",
            "values": [[title]],
        },
        {
            "range": f"'{APPLICATION_TAB}'!{column_letter(header_map['ATS Score'] + 1)}{row_number}",
            "values": [[f"{score:.1f}/10"]],
        },
    ]
    sheets.spreadsheets().values().batchUpdate(
        spreadsheetId=spreadsheet_id,
        body={"valueInputOption": "RAW", "data": updates},
    ).execute()


def migrate_sheet_titles(sheets, spreadsheet_id, rows, header_map, dry_run):
    title_column = header_map["Job Title"]
    updates = []
    for row_number, row in enumerate(rows[1:], start=2):
        title = row[title_column] if len(row) > title_column else ""
        if normalized(title) in LEGACY_JOB_TITLES:
            updates.append(
                {
                    "range": (
                        f"'{APPLICATION_TAB}'!"
                        f"{column_letter(title_column + 1)}{row_number}"
                    ),
                    "values": [[CURRENT_JOB_TITLE]],
                }
            )

    if updates and not dry_run:
        sheets.spreadsheets().values().batchUpdate(
            spreadsheetId=spreadsheet_id,
            body={"valueInputOption": "RAW", "data": updates},
        ).execute()
    return len(updates)


def main():
    args = parse_args()
    load_dotenv(BACKEND_DIR / ".env")

    mongo = MongoClient(required_env("MONGO_URI"))
    database = mongo.get_default_database()
    applications = database["applications"]
    jobs = database["jobs"]

    sheets = build("sheets", "v4", credentials=sheets_credentials(), cache_discovery=False)
    drive = build("drive", "v3", credentials=drive_credentials(), cache_discovery=False)
    spreadsheet_id = required_env("GOOGLE_SHEET_ID")

    headers = ensure_sheet_headers(sheets, spreadsheet_id, args.dry_run)
    header_map = resolve_header_map(headers)
    required_headers = {"Email", "Job Title", "ATS Score"}
    if not required_headers.issubset(header_map):
        raise RuntimeError(
            f"Applications sheet must contain headers: {sorted(required_headers)}. "
            f"Found: {headers}"
        )
    rows = load_sheet_rows(sheets, spreadsheet_id)
    sheet_title_updates = migrate_sheet_titles(sheets, spreadsheet_id, rows, header_map, args.dry_run)

    query = {} if args.rescore else {"atsScore": {"$exists": False}}
    cursor = applications.find(query).sort("createdAt", 1)
    if args.limit:
        cursor = cursor.limit(args.limit)

    counters = {"scored": 0, "skipped": 0, "failed": 0, "titles": 0}
    claimed_sheet_rows = set()
    for application in cursor:
        label = f"{application.get('email', 'unknown')} | {application.get('jobTitle', 'unknown')}"
        try:
            title = canonical_job_title(application.get("jobTitle"))
            if title != application.get("jobTitle"):
                counters["titles"] += 1

            file_id = application.get("attachmentDriveFileId")
            if not file_id:
                raise ValueError("No Google Drive resume file ID")

            job = jobs.find_one({"_id": application.get("jobId")}) or {}
            description = job_description(job, title)
            if not description.strip():
                raise ValueError("No job description available")

            resume = download_drive_file(drive, file_id)
            resume_text = extract_resume_text(resume, application.get("attachmentFileName"))
            if not resume_text:
                raise ValueError("Resume contains no extractable text")

            score = score_resume(resume_text, description, job)
            matches = sheet_row_matches(
                rows,
                header_map,
                {**application, "jobTitle": title},
                claimed_sheet_rows,
            )
            if not matches:
                raise ValueError("No unclaimed spreadsheet row found")
            row_number = matches[0]
            claimed_sheet_rows.add(row_number)

            if not args.dry_run:
                applications.update_one(
                    {"_id": application["_id"]},
                    {
                        "$set": {
                            "jobTitle": title,
                            "atsScore": score,
                            "atsScoredAt": datetime.now(timezone.utc),
                        }
                    },
                )
                update_sheet_row(sheets, spreadsheet_id, header_map, row_number, title, score)

            counters["scored"] += 1
            print(f"SCORED {score:.1f}/10 | {label}")
        except Exception as error:
            counters["failed"] += 1
            print(f"FAILED | {label} | {error}", file=sys.stderr)

    # Title-only migration also covers already-scored applications.
    if not args.dry_run:
        title_result = applications.update_many(
            {"jobTitle": {"$in": [re.compile(f"^{re.escape(title)}$", re.I) for title in LEGACY_JOB_TITLES]}},
            {"$set": {"jobTitle": CURRENT_JOB_TITLE}},
        )
        counters["titles"] += title_result.modified_count
    counters["titles"] += sheet_title_updates

    print(
        f"Done: {counters['scored']} scored, {counters['failed']} failed, "
        f"{counters['titles']} legacy title updates{' (dry run)' if args.dry_run else ''}."
    )


if __name__ == "__main__":
    main()
