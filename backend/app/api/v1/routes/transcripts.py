"""
app/api/v1/routes/transcripts.py

Transcript upload and async parsing endpoints.
REQ-067
"""

from __future__ import annotations

import os
import re
from pathlib import Path
from uuid import UUID, uuid4

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.models import User
from app.db.models_v2 import Transcript
from app.db.session import SessionLocal, get_db
from app.schemas.v2.transcripts import (
    ParsedGradeSuggestion,
    TranscriptParsedResponse,
    TranscriptUploadResponse,
)
from app.services import student_service

router = APIRouter(prefix="/students", tags=["transcripts-v2"])

_ALLOWED_CONTENT_TYPES = {
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/tiff",
    "image/gif",
}
_MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB

# ---------------------------------------------------------------------------
# Grade pattern regex for simple text extraction
# ---------------------------------------------------------------------------

# Matches lines like: "English Language    5*"  or  "Mathematics (M1)  5**"
_GRADE_PATTERN = re.compile(
    r"(?P<subject>[A-Za-z][\w\s,\(\)&\-]{2,60}?)\s+"
    r"(?P<grade>5\*\*|5\*|[1-5]|U|X|Attained with Distinction|Attained)\b",
    re.IGNORECASE,
)

# Known subject code keywords for matching
_SUBJECT_KEYWORDS: dict[str, str] = {
    "chinese language": "CHLA",
    "english language": "ENGL",
    "mathematics": "MATH",
    "citizenship": "CSD",
    "liberal studies": "CSD",
    "biology": "BIOL",
    "chemistry": "CHEM",
    "physics": "PHYS",
    "economics": "ECON",
    "history": "HIST",
    "geography": "GEOG",
    "bafs": "BAFS",
    "business": "BAFS",
    "ict": "ICT",
    "music": "MUSC",
    "visual arts": "VART",
    "chinese history": "CHIH",
    "physical education": "PE",
}


def _guess_subject_code(name: str) -> str | None:
    """Attempt to map a subject name to a known code."""
    lower = name.lower().strip()
    for keyword, code in _SUBJECT_KEYWORDS.items():
        if keyword in lower:
            return code
    return None


# ---------------------------------------------------------------------------
# Background parsing task
# ---------------------------------------------------------------------------

def _parse_transcript_task(transcript_id: UUID, file_path: str) -> None:
    """
    Background task: attempt to parse the transcript file.
    Uses regex on extracted text. Updates Transcript.parsed_data.
    Parsed grades are NEVER auto-saved to StudentSubjectGrade (REQ-067).
    """
    db: Session = SessionLocal()
    try:
        transcript = db.query(Transcript).filter(Transcript.id == transcript_id).first()
        if not transcript:
            return

        transcript.processing_status = "PROCESSING"
        db.commit()

        raw_text = ""
        suggestions: list[dict] = []
        confidence = 0.0

        ext = Path(file_path).suffix.lower()

        try:
            if ext == ".pdf":
                # Attempt pdfplumber if available
                try:
                    import pdfplumber  # type: ignore
                    with pdfplumber.open(file_path) as pdf:
                        for page in pdf.pages:
                            page_text = page.extract_text() or ""
                            raw_text += page_text + "\n"
                    confidence = 0.85
                except ImportError:
                    raw_text = "(PDF parsing requires pdfplumber — not installed)"
                    confidence = 0.0
            else:
                # Image: attempt pytesseract if available
                try:
                    from PIL import Image  # type: ignore
                    import pytesseract  # type: ignore
                    img = Image.open(file_path)
                    raw_text = pytesseract.image_to_string(img)
                    confidence = 0.65
                except ImportError:
                    raw_text = "(Image OCR requires pytesseract and Pillow — not installed)"
                    confidence = 0.0

            # Apply regex grade extraction
            for m in _GRADE_PATTERN.finditer(raw_text):
                subject_name = m.group("subject").strip()
                raw_grade = m.group("grade").strip()
                code = _guess_subject_code(subject_name)
                suggestions.append({
                    "subject_name": subject_name,
                    "subject_code": code,
                    "raw_grade": raw_grade,
                })

        except Exception as parse_exc:
            raw_text = f"Parse error: {parse_exc}"
            confidence = 0.0

        transcript.parsed_data = {
            "suggested_grades": suggestions,
            "parser_confidence": confidence,
            "raw_text_excerpt": raw_text[:500],
        }
        transcript.processing_status = "DONE"
        db.commit()

    except Exception as exc:
        try:
            transcript = db.query(Transcript).filter(Transcript.id == transcript_id).first()
            if transcript:
                transcript.processing_status = "FAILED"
                transcript.parsed_data = {"error": str(exc)}
                db.commit()
        except Exception:
            pass
    finally:
        db.close()


# ---------------------------------------------------------------------------
# POST /students/{student_id}/transcript
# ---------------------------------------------------------------------------

@router.post(
    "/{student_id}/transcript",
    response_model=TranscriptUploadResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def upload_transcript(
    student_id: UUID,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Accept multipart transcript upload, save to disk, launch async parse.
    REQ-067
    """
    student_service.get_student(db, student_id=student_id, user_id=current_user.id)

    # Validate file type
    content_type = file.content_type or ""
    if content_type not in _ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported file type: {content_type}. Allowed: PDF or image.",
        )

    # Read file content with size limit
    content = await file.read(_MAX_FILE_SIZE + 1)
    if len(content) > _MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds maximum size of {_MAX_FILE_SIZE // 1024 // 1024} MB",
        )

    # Determine upload directory
    upload_dir = os.environ.get("UPLOAD_DIR", "/tmp/advisor_uploads")
    student_dir = Path(upload_dir) / "transcripts" / str(student_id)
    student_dir.mkdir(parents=True, exist_ok=True)

    transcript_id = uuid4()
    safe_filename = re.sub(r"[^\w\.\-]", "_", file.filename or "transcript")
    dest_path = student_dir / f"{transcript_id}_{safe_filename}"

    with open(dest_path, "wb") as f_out:
        f_out.write(content)

    # Relative path stored in DB
    relative_path = str(dest_path.relative_to(upload_dir))

    transcript = Transcript(
        id=transcript_id,
        student_id=student_id,
        file_path=relative_path,
        processing_status="PENDING",
    )
    db.add(transcript)
    db.commit()
    db.refresh(transcript)

    background_tasks.add_task(_parse_transcript_task, transcript.id, str(dest_path))

    return TranscriptUploadResponse(job_id=transcript.id, status=transcript.processing_status)


# ---------------------------------------------------------------------------
# GET /students/{student_id}/transcript
# ---------------------------------------------------------------------------

@router.get(
    "/{student_id}/transcript",
    response_model=TranscriptParsedResponse,
    status_code=status.HTTP_200_OK,
)
def get_transcript(
    student_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Return latest Transcript record with parse_status and parsed_data suggestions.
    REQ-067
    """
    student_service.get_student(db, student_id=student_id, user_id=current_user.id)

    transcript = (
        db.query(Transcript)
        .filter(Transcript.student_id == student_id)
        .order_by(Transcript.uploaded_at.desc())
        .first()
    )
    if not transcript:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No transcript found for this student",
        )

    parsed_data = transcript.parsed_data or {}
    raw_suggestions = parsed_data.get("suggested_grades") or []
    suggestions = [
        ParsedGradeSuggestion(
            subject_name=s.get("subject_name", ""),
            subject_code=s.get("subject_code"),
            raw_grade=s.get("raw_grade", ""),
        )
        for s in raw_suggestions
    ]

    return TranscriptParsedResponse(
        id=transcript.id,
        student_id=transcript.student_id,
        processing_status=transcript.processing_status,
        uploaded_at=transcript.uploaded_at,
        suggestions=suggestions,
        parser_confidence=parsed_data.get("parser_confidence"),
        raw_text_excerpt=parsed_data.get("raw_text_excerpt"),
    )
