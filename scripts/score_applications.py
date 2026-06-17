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
from sentence_transformers import SentenceTransformer, util


BACKEND_DIR = Path(__file__).resolve().parents[1]
APPLICATION_TAB = "Applications"
LEGACY_JOB_TITLES = {
    "ros developer engineer",
    "ros developer",
    "ros engineer",
}
CURRENT_JOB_TITLE = "Robotics Engineer"
SCORING_VERSION = "hybrid-minilm-v1"
MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"
ROLE_PROFILES = {
    "Electronics Engineer": {
        "required": ["embedded c++", "microcontroller", "stm32", "electronics", "communication protocols"],
        "preferred": ["nvidia jetson", "rtos", "motor control", "linux", "pcb"],
        "education": ["electronics", "electrical", "embedded", "instrumentation"],
    },
    "UI Developer": {
        "required": ["html", "css", "javascript", "frontend framework", "responsive design", "figma"],
        "preferred": ["websocket", "python", "ros 2", "linux", "rest api"],
        "education": ["computer science", "information technology", "software", "design"],
    },
    "Robotics Engineer": {
        "required": ["ros 2", "moveit 2", "cad", "stm32", "robotics", "mechanical engineering"],
        "preferred": ["python", "c++", "gazebo", "rviz", "ros control", "can bus", "hardware abstraction layer"],
        "education": ["robotics", "mechatronics", "computer science", "electronics", "mechanical"],
    },
    "Technical Sales Engineer": {
        "required": ["robotics", "automation", "technical sales", "technical proposals", "customer demos"],
        "preferred": ["manufacturing", "cad", "crm", "b2b sales", "industrial equipment"],
        "education": ["mechanical", "mechatronics", "electronics", "robotics", "business"],
    },
    "Mechanical Engineer": {
        "required": ["cad", "solidworks", "fea", "gd&t", "dfm", "mechanical engineering"],
        "preferred": ["prototyping", "gear design", "fusion 360", "robotics", "manufacturing"],
        "education": ["mechanical", "mechatronics", "production", "manufacturing"],
    },
}
SKILL_ALIASES = {
    "embedded c++": ["embedded c++", "embedded c", "embedded c/c++", "firmware"],
    "microcontroller": ["microcontroller", "microcontrollers", "mcu"],
    "stm32": ["stm32", "stm 32"],
    "electronics": ["electronics", "electronic circuits", "digital circuits", "analog circuits"],
    "communication protocols": ["uart", "can", "can bus", "spi", "i2c", "modbus", "ethernet"],
    "nvidia jetson": ["nvidia jetson", "jetson", "jetpack"],
    "rtos": ["rtos", "real time operating system", "free rtos", "freertos"],
    "motor control": ["motor control", "bldc", "servo motor", "stepper motor", "pid control"],
    "pcb": ["pcb", "printed circuit board", "schematic"],
    "html": ["html", "html5"],
    "css": ["css", "css3", "tailwind", "bootstrap"],
    "javascript": ["javascript", "typescript", "js", "ts"],
    "frontend framework": ["react", "reactjs", "react.js", "angular", "vue", "vue.js"],
    "responsive design": ["responsive design", "responsive web", "mobile responsive"],
    "figma": ["figma", "adobe xd"],
    "websocket": ["websocket", "websockets", "socket.io"],
    "rest api": ["rest api", "restful api", "api integration"],
    "ros 2": ["ros 2", "ros2", "robot operating system 2"],
    "python": ["python"],
    "c++": ["c++", "cpp", "c plus plus"],
    "moveit 2": ["moveit 2", "moveit2", "moveit"],
    "gazebo": ["gazebo", "ignition gazebo"],
    "robotics": ["robotics", "robotic", "robot"],
    "docker": ["docker", "containerization", "containerisation"],
    "rviz": ["rviz", "rviz2"],
    "ros control": ["ros control", "ros2 control", "ros_control", "ros2_control"],
    "can bus": ["can bus", "canbus", "can protocol", "cia 402", "cia402"],
    "hardware abstraction layer": ["hardware abstraction layer", "hal", "hardware interface"],
    "cad": ["cad", "computer aided design"],
    "solidworks": ["solidworks", "solid works"],
    "fea": ["fea", "finite element analysis"],
    "gd&t": ["gd&t", "gdt", "geometric dimensioning and tolerancing"],
    "dfm": ["dfm", "dfma", "design for manufacturing", "design for manufacturability"],
    "mechanical engineering": ["mechanical engineering", "mechanical engineer"],
    "prototyping": ["prototyping", "prototype"],
    "gear design": ["gear design", "gearbox", "harmonic drive", "cycloidal"],
    "fusion 360": ["fusion 360", "fusion360"],
    "manufacturing": ["manufacturing", "production engineering"],
    "linux": ["linux", "ubuntu"],
    "automation": ["automation", "industrial automation"],
    "technical sales": ["technical sales", "sales engineer", "sales engineering"],
    "technical proposals": ["technical proposal", "technical proposals", "proposal", "quotation"],
    "customer demos": ["customer demo", "customer demos", "demo", "demonstration"],
    "crm": ["crm", "customer relationship management"],
    "b2b sales": ["b2b sales", "business development", "lead generation"],
    "industrial equipment": ["industrial equipment", "machine tools", "factory equipment"],
}
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
        *(job.get("educationRequirements", []) if job else []),
        *(job.get("additionalSkills", []) if job else []),
        *(job.get("tags", []) if job else []),
    ]
    return "\n".join(str(value) for value in values if value)


def contains_phrase(text, phrase):
    pattern = rf"(?<!\w){re.escape(normalized(phrase))}(?!\w)"
    return re.search(pattern, text) is not None


def matched_skills(resume_text, skills):
    text = normalized(resume_text)
    matched = []
    missing = []
    for skill in skills:
        aliases = SKILL_ALIASES.get(skill, [skill])
        target = matched if any(contains_phrase(text, alias) for alias in aliases) else missing
        target.append(skill)
    return matched, missing


def text_chunks(text, max_chars=650):
    lines = [line.strip() for line in re.split(r"[\r\n]+", text) if line.strip()]
    chunks = []
    current = []
    current_length = 0
    for line in lines:
        if current and current_length + len(line) > max_chars:
            chunks.append(" ".join(current))
            current = []
            current_length = 0
        current.append(line)
        current_length += len(line) + 1
    if current:
        chunks.append(" ".join(current))
    return chunks or [text[:max_chars]]


def semantic_relevance(model, resume_text, job):
    responsibilities = [
        str(value).strip()
        for value in [
            job.get("overview", ""),
            *job.get("responsibilities", []),
        ]
        if str(value).strip()
    ]
    chunks = text_chunks(resume_text)
    if not responsibilities or not chunks:
        return 0

    resume_embeddings = model.encode(chunks, convert_to_tensor=True, show_progress_bar=False)
    responsibility_embeddings = model.encode(
        responsibilities, convert_to_tensor=True, show_progress_bar=False
    )
    similarities = util.cos_sim(responsibility_embeddings, resume_embeddings)
    best_matches = similarities.max(dim=1).values
    raw_similarity = float(best_matches.mean())

    # MiniLM similarities around 0.20 are weak and 0.65+ are usually strongly relevant.
    return min(1, max(0, (raw_similarity - 0.20) / 0.45))


def education_and_evidence_score(resume_text, profile, required_matches):
    text = normalized(resume_text)
    education_terms = profile.get("education", [])
    generic_degree_terms = ["bachelor", "b.tech", "btech", "master", "m.tech", "mtech", "degree"]
    if any(contains_phrase(text, term) for term in education_terms):
        education = 1
    elif any(contains_phrase(text, term) for term in generic_degree_terms):
        education = 0.6
    else:
        education = 0.2

    evidence_terms = [
        "project",
        "experience",
        "internship",
        "developed",
        "designed",
        "built",
        "implemented",
        "research",
    ]
    has_practical_evidence = any(contains_phrase(text, term) for term in evidence_terms)
    if required_matches and has_practical_evidence:
        evidence = 1
    elif required_matches or has_practical_evidence:
        evidence = 0.5
    else:
        evidence = 0
    return (education + evidence) / 2


def scoring_profile(job, fallback_title):
    title = canonical_job_title(job.get("title") if job else fallback_title)
    profile = ROLE_PROFILES.get(title)
    if profile:
        return profile
    return {
        "required": [normalized(tag) for tag in job.get("tags", []) if str(tag).strip()],
        "preferred": [],
        "education": [],
    }


def score_resume(model, resume_text, job, fallback_title):
    profile = scoring_profile(job, fallback_title)
    required_matches, required_missing = matched_skills(resume_text, profile["required"])
    preferred_matches, preferred_missing = matched_skills(resume_text, profile["preferred"])

    required_ratio = len(required_matches) / len(profile["required"]) if profile["required"] else 0
    preferred_ratio = len(preferred_matches) / len(profile["preferred"]) if profile["preferred"] else 0
    semantic_ratio = semantic_relevance(model, resume_text, job)
    evidence_ratio = education_and_evidence_score(resume_text, profile, required_matches)

    score = (
        (required_ratio * 4.0)
        + (preferred_ratio * 1.0)
        + (semantic_ratio * 3.5)
        + (evidence_ratio * 1.5)
    )
    if required_ratio == 0:
        score = min(score, 4.5)
    elif required_ratio < 0.34:
        score = min(score, 6.5)

    return {
        "score": round(min(10, max(0, score)), 1),
        "matchedSkills": required_matches + preferred_matches,
        "missingSkills": required_missing + preferred_missing,
        "breakdown": {
            "requiredSkills": round(required_ratio * 10, 1),
            "preferredSkills": round(preferred_ratio * 10, 1),
            "semanticRelevance": round(semantic_ratio * 10, 1),
            "educationAndEvidence": round(evidence_ratio * 10, 1),
        },
    }


def ensure_sheet_headers(sheets, spreadsheet_id, dry_run):
    result = sheets.spreadsheets().values().get(
        spreadsheetId=spreadsheet_id,
        range=f"'{APPLICATION_TAB}'!A1:ZZ20",
    ).execute()
    candidate_rows = result.get("values", [])
    headers = None
    header_row_number = None
    for row_number, row in enumerate(candidate_rows, start=1):
        resolved = resolve_header_map(row)
        if {"Email", "Job Title"}.issubset(resolved):
            headers = row
            header_row_number = row_number
            break

    if headers is None:
        raise RuntimeError("Could not locate the Applications spreadsheet header row")

    if "ATS Score" not in headers:
        headers.append("ATS Score")
        if not dry_run:
            sheets.spreadsheets().values().update(
                spreadsheetId=spreadsheet_id,
                range=f"'{APPLICATION_TAB}'!A{header_row_number}",
                valueInputOption="RAW",
                body={"values": [headers]},
            ).execute()

    return headers, header_row_number


def load_sheet_rows(sheets, spreadsheet_id):
    result = sheets.spreadsheets().values().get(
        spreadsheetId=spreadsheet_id,
        range=f"'{APPLICATION_TAB}'!A:ZZ",
    ).execute()
    return result.get("values", [])


def sheet_row_matches(rows, header_row_number, header_map, application, claimed_rows):
    email = normalized(application.get("email"))
    job_title = normalized(canonical_job_title(application.get("jobTitle")))
    matches = []

    for row_number, row in enumerate(rows, start=1):
        if row_number == header_row_number or row_number in claimed_rows:
            continue
        email_candidates = {
            normalized(row[index])
            for index in {header_map["Email"], 6}
            if len(row) > index
        }
        title_candidates = {
            normalized(canonical_job_title(row[index]))
            for index in {header_map["Job Title"], 10}
            if len(row) > index
        }
        if email in email_candidates and job_title in title_candidates:
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


def migrate_sheet_titles(sheets, spreadsheet_id, rows, header_row_number, header_map, dry_run):
    title_column = header_map["Job Title"]
    updates = []
    for row_number, row in enumerate(rows[header_row_number:], start=header_row_number + 1):
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
    print(f"Loading local semantic model: {MODEL_NAME}")
    model = SentenceTransformer(MODEL_NAME)

    headers, header_row_number = ensure_sheet_headers(sheets, spreadsheet_id, args.dry_run)
    header_map = resolve_header_map(headers)
    required_headers = {"Email", "Job Title", "ATS Score"}
    if not required_headers.issubset(header_map):
        raise RuntimeError(
            f"Applications sheet must contain headers: {sorted(required_headers)}. "
            f"Found: {headers}"
        )
    rows = load_sheet_rows(sheets, spreadsheet_id)
    sheet_title_updates = migrate_sheet_titles(
        sheets, spreadsheet_id, rows, header_row_number, header_map, args.dry_run
    )

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

            result = score_resume(model, resume_text, job, title)
            score = result["score"]
            matches = sheet_row_matches(
                rows,
                header_row_number,
                header_map,
                {**application, "jobTitle": title},
                claimed_sheet_rows,
            )
            if not matches:
                raise ValueError("No unclaimed spreadsheet row found")
            row_number = matches[0]
            claimed_sheet_rows.add(row_number)

            if not args.dry_run:
                score_fields = {
                    "jobTitle": title,
                    "atsScore": score,
                    "atsScoredAt": datetime.now(timezone.utc),
                    "atsScoringVersion": SCORING_VERSION,
                    "atsMatchedSkills": result["matchedSkills"],
                    "atsMissingSkills": result["missingSkills"],
                    "atsScoreBreakdown": result["breakdown"],
                }
                if application.get("atsScore") is not None:
                    score_fields["previousAtsScore"] = application["atsScore"]
                    score_fields["previousAtsScoredAt"] = application.get("atsScoredAt")
                applications.update_one(
                    {"_id": application["_id"]},
                    {"$set": score_fields},
                )
                update_sheet_row(sheets, spreadsheet_id, header_map, row_number, title, score)

            counters["scored"] += 1
            old_score = application.get("atsScore")
            change = f" (was {old_score:.1f})" if old_score is not None else ""
            matched = ", ".join(result["matchedSkills"]) or "none"
            print(f"SCORED {score:.1f}/10{change} | {label} | matched: {matched}")
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
