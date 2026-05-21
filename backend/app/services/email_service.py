"""
app/services/email_service.py

Send credential emails via Resend. Falls back gracefully if RESEND_API_KEY is not set.
"""
from __future__ import annotations

import os
from typing import Optional


def send_credentials_email(
    to_email: str,
    student_name: str,
    login_id: str,
    password: str,
    org_name: Optional[str] = None,
) -> dict:
    """Send account credentials to a student or teacher via Resend.

    Returns {"sent": True, "id": "..."} on success,
    or {"sent": False, "error": "..."} on failure.
    """
    api_key = os.environ.get("RESEND_API_KEY")
    if not api_key:
        return {"sent": False, "error": "RESEND_API_KEY not configured"}

    from_email = os.environ.get("RESEND_FROM_EMAIL", "noreply@schoolchoice.app")

    import resend
    resend.api_key = api_key

    school_line = f" at {org_name}" if org_name else ""

    try:
        result = resend.Emails.send({
            "from": from_email,
            "to": [to_email],
            "subject": f"Your SchoolChoice Account Credentials",
            "html": f"""
            <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
                <h2 style="color: #1e40af;">SchoolChoice Account</h2>
                <p>Hello {student_name},</p>
                <p>Your account{school_line} has been created. Here are your login credentials:</p>
                <div style="background: #f3f4f6; border-radius: 8px; padding: 16px; margin: 16px 0;">
                    <p style="margin: 4px 0;"><strong>Login ID:</strong> {login_id}</p>
                    <p style="margin: 4px 0;"><strong>Password:</strong> <code>{password}</code></p>
                </div>
                <p>Please log in and change your password after first login.</p>
                <p style="color: #6b7280; font-size: 12px; margin-top: 24px;">
                    This is an automated message. Please do not reply.
                </p>
            </div>
            """,
        })
        return {"sent": True, "id": result.get("id") if isinstance(result, dict) else str(result)}
    except Exception as e:
        return {"sent": False, "error": str(e)}
