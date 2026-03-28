"""
app/services/plan_generator.py

HTML academic plan generation.
REQ-077

Generates a complete styled HTML document as a string using Python f-strings.
Inline CSS only, no external dependencies, @media print block included.
No JavaScript in the generated HTML.
"""

from __future__ import annotations

import html
from datetime import datetime, timezone


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _esc(value: object) -> str:
    """HTML-escape any value for safe embedding."""
    return html.escape(str(value) if value is not None else "")


def _pct(score: float | None) -> str:
    """Format a 0.0-1.0 score as percentage string."""
    if score is None:
        return "N/A"
    return f"{score * 100:.1f}%"


# ---------------------------------------------------------------------------
# Action item builder
# ---------------------------------------------------------------------------

def _build_action_items(student: dict, match_results: list) -> list[dict]:
    """
    Generate action items:
    - For each subject below grade 4: "Improve {subject} to Grade 4+" due next mock
    - For each school with IELTS gap: "Achieve IELTS {target}"
    - Generic: "Prepare personal statement", "Research {school} application"
    Returns list of {task, deadline, related_school, priority}
    """
    items: list[dict] = []
    current_year = datetime.now(timezone.utc).year

    # Subject improvement tasks
    grades = student.get("subject_grades") or []
    for grade in grades:
        raw = grade.get("raw_grade") or grade.get("predicted_grade") or ""
        subject_name = grade.get("subject_name") or grade.get("subject_code") or "Subject"
        # Grades below 4 need improvement
        from app.services.hkdse_service import grade_to_int
        if raw and grade_to_int(raw) < 4:
            items.append({
                "task": f"Improve {subject_name} to Grade 4 or above",
                "deadline": f"Next Mock Exam ({current_year})",
                "related_school": None,
                "priority": "High",
            })

    # IELTS gap tasks
    for result in match_results[:5]:
        school_name = getattr(result, "school_name", None) or (result.get("school_name") if isinstance(result, dict) else None) or "School"
        comp = getattr(result, "component_scores", {}) or (result.get("component_scores", {}) if isinstance(result, dict) else {})
        lang_fit = comp.get("language_fit", 1.0) if comp else 1.0

        if lang_fit < 1.0:
            target_ielts = "7.0"  # recommend aiming higher
            items.append({
                "task": f"Achieve IELTS overall band {target_ielts} for {school_name}",
                "deadline": f"By {current_year + 1}",
                "related_school": school_name,
                "priority": "High",
            })

        items.append({
            "task": f"Research {school_name} application requirements and deadlines",
            "deadline": f"Q3 {current_year}",
            "related_school": school_name,
            "priority": "Medium",
        })

    # Generic tasks
    items.append({
        "task": "Prepare personal statement draft",
        "deadline": f"Q4 {current_year}",
        "related_school": None,
        "priority": "High",
    })
    items.append({
        "task": "Gather reference letters from teachers",
        "deadline": f"Q3 {current_year}",
        "related_school": None,
        "priority": "Medium",
    })

    return items


# ---------------------------------------------------------------------------
# Section builders
# ---------------------------------------------------------------------------

def _section_student_summary(student: dict, best5: int) -> str:
    name = _esc(student.get("name") or student.get("full_name") or "Student")
    year = _esc(student.get("year_of_study") or "N/A")
    grade_system = "HKDSE"
    return f"""
    <section class="section">
      <h2>1. Student Summary</h2>
      <table class="summary-table">
        <tr><th>Name</th><td>{name}</td></tr>
        <tr><th>Year of Study</th><td>{year}</td></tr>
        <tr><th>Grade System</th><td>{grade_system}</td></tr>
        <tr><th>Best-5 Aggregate</th><td>{best5}</td></tr>
      </table>
    </section>"""


def _section_academic_profile(student: dict) -> str:
    grades = student.get("subject_grades") or []
    rows = ""
    if grades:
        for g in grades:
            subj = _esc(g.get("subject_name") or g.get("subject_code") or "")
            sitting = _esc(g.get("sitting") or "")
            raw = _esc(g.get("raw_grade") or "")
            predicted = _esc(g.get("predicted_grade") or "")
            is_pred = "Yes" if g.get("predicted_grade") else "No"
            rows += f"<tr><td>{subj}</td><td>{sitting}</td><td>{raw}</td><td>{is_pred}</td><td>{predicted}</td></tr>"
    else:
        rows = '<tr><td colspan="5">No grade records on file.</td></tr>'

    return f"""
    <section class="section">
      <h2>2. Academic Profile</h2>
      <table class="data-table">
        <thead>
          <tr>
            <th>Subject</th><th>Sitting</th><th>Grade</th>
            <th>Predicted?</th><th>Predicted Grade</th>
          </tr>
        </thead>
        <tbody>{rows}</tbody>
      </table>
    </section>"""


def _section_recommended_schools(match_results: list, student: dict) -> str:
    content = '<section class="section"><h2>3. Recommended Schools</h2>'

    from app.services.hkdse_service import grade_to_int

    grades = student.get("subject_grades") or []
    grades_by_code: dict[str, int] = {}
    for g in grades:
        code = g.get("subject_code") or ""
        raw = g.get("raw_grade") or g.get("predicted_grade") or "U"
        if code:
            grades_by_code[code] = grade_to_int(raw)

    top_schools = [r for r in match_results if (
        getattr(r, "eligibility_pass", False) if not isinstance(r, dict) else r.get("eligibility_pass", False)
    )][:5]

    for idx, result in enumerate(top_schools, 1):
        if isinstance(result, dict):
            school_name = _esc(result.get("school_name", ""))
            fit_score = result.get("fit_score", 0.0)
            eligibility = result.get("eligibility_pass", False)
            rationale = _esc(result.get("rationale", ""))
            req_subjects = result.get("required_subjects") or []
            failing = result.get("failing_criteria") or []
            intended_majors = result.get("intended_majors") or []
        else:
            school_name = _esc(getattr(result, "school_name", ""))
            fit_score = getattr(result, "fit_score", 0.0)
            eligibility = getattr(result, "eligibility_pass", False)
            rationale = _esc(getattr(result, "rationale", ""))
            req_subjects = []
            failing = getattr(result, "failing_criteria") or []
            intended_majors = []

        elig_badge = (
            '<span class="badge badge-pass">ELIGIBLE</span>'
            if eligibility
            else '<span class="badge badge-fail">INELIGIBLE</span>'
        )

        # Gap analysis table
        gap_rows = ""
        if req_subjects:
            for req in req_subjects:
                code = req.get("subject_code", "")
                min_grade = req.get("min_grade", "")
                student_val = grades_by_code.get(code)
                student_display = str(student_val) if student_val is not None else "N/A"
                from app.services.hkdse_service import grade_to_int
                min_val = grade_to_int(min_grade)
                gap_class = "gap-ok" if student_val is not None and student_val >= min_val else "gap-fail"
                gap_rows += (
                    f'<tr class="{gap_class}">'
                    f"<td>{_esc(code)}</td>"
                    f"<td>{_esc(min_grade)}</td>"
                    f"<td>{_esc(student_display)}</td>"
                    f"</tr>"
                )

        gap_table = ""
        if gap_rows:
            gap_table = f"""
            <h4>Gap Analysis</h4>
            <table class="data-table gap-table">
              <thead><tr><th>Subject</th><th>Required</th><th>Your Grade</th></tr></thead>
              <tbody>{gap_rows}</tbody>
            </table>"""

        actions = ""
        for fc in failing:
            actions += f'<li class="action-item">{_esc(fc)}</li>'
        if not actions:
            actions = "<li>Continue current preparation. Apply early.</li>"

        majors_html = ""
        if intended_majors:
            if isinstance(intended_majors, list):
                majors_display = _esc(", ".join(str(m) for m in intended_majors if m))
            else:
                majors_display = _esc(str(intended_majors))
            majors_html = f'<p><strong>Intended Major(s):</strong> {majors_display}</p>'

        content += f"""
        <div class="school-card">
          <h3>{idx}. {school_name} {elig_badge}</h3>
          <p><strong>Fit Score:</strong> {_pct(fit_score)}</p>
          {majors_html}
          <p><strong>Why this school fits:</strong> {rationale}</p>
          {gap_table}
          <h4>Recommended Actions</h4>
          <ul>{actions}</ul>
        </div>"""

    if not top_schools:
        content += "<p>No eligible school matches found. Consider broadening criteria.</p>"

    content += "</section>"
    return content


def _section_action_plan(action_items: list) -> str:
    if not action_items:
        return '<section class="section"><h2>4. Action Plan Timeline</h2><p>No action items generated.</p></section>'

    # Group by quarter extracted from deadline string
    from collections import defaultdict
    quarters: dict[str, list] = defaultdict(list)
    for item in action_items:
        deadline = item.get("deadline") or "General"
        quarters[deadline].append(item)

    rows = ""
    for deadline, items in sorted(quarters.items()):
        for item in items:
            task = _esc(item.get("task") or "")
            school = _esc(item.get("related_school") or "General")
            priority = _esc(item.get("priority") or "Medium")
            priority_class = f"priority-{priority.lower()}"
            rows += (
                f"<tr>"
                f"<td>{_esc(deadline)}</td>"
                f"<td>{task}</td>"
                f'<td><span class="{priority_class}">{priority}</span></td>'
                f"<td>{school}</td>"
                f"</tr>"
            )

    return f"""
    <section class="section">
      <h2>4. Action Plan Timeline</h2>
      <table class="data-table">
        <thead>
          <tr><th>Deadline</th><th>Task</th><th>Priority</th><th>Related School</th></tr>
        </thead>
        <tbody>{rows}</tbody>
      </table>
    </section>"""


def _section_skill_gaps(student: dict, match_results: list) -> str:
    extra = student.get("extra_curricular") or []
    awards = student.get("awards") or []
    student_activities = set()
    for ec in extra:
        if isinstance(ec, dict):
            student_activities.add((ec.get("activity") or "").lower())
        else:
            student_activities.add(str(ec).lower())

    gaps_content = ""
    top_schools = [r for r in match_results if (
        getattr(r, "eligibility_pass", False) if not isinstance(r, dict) else r.get("eligibility_pass", False)
    )][:5]

    for result in top_schools:
        school_name = getattr(result, "school_name", "") if not isinstance(result, dict) else result.get("school_name", "")
        notable = []  # Would be populated from school data
        if notable:
            gaps_content += f"<li><strong>{_esc(school_name)}:</strong> Consider joining relevant clubs or activities aligned with programs offered.</li>"

    if not gaps_content:
        if not extra and not awards:
            gaps_content = "<li>No extracurricular activities recorded. Consider joining clubs, sports, or community service to strengthen your profile.</li>"
        else:
            gaps_content = "<li>Extracurricular profile looks solid. Continue building on existing activities.</li>"

    return f"""
    <section class="section">
      <h2>5. Skill &amp; Activity Gaps</h2>
      <ul>{gaps_content}</ul>
    </section>"""


def _section_language_readiness(student: dict, match_results: list) -> str:
    student_ielts = student.get("ielts_score")
    ielts_overall = None
    if isinstance(student_ielts, dict):
        ielts_overall = student_ielts.get("overall")
    elif student_ielts is not None:
        try:
            ielts_overall = float(student_ielts)
        except (TypeError, ValueError):
            pass

    ielts_display = f"{ielts_overall}" if ielts_overall is not None else "Not on file"

    rows = ""
    top_schools = [r for r in match_results if (
        getattr(r, "eligibility_pass", False) if not isinstance(r, dict) else r.get("eligibility_pass", False)
    )][:5]

    for result in top_schools:
        school_name = getattr(result, "school_name", "") if not isinstance(result, dict) else result.get("school_name", "")
        comp = getattr(result, "component_scores", {}) if not isinstance(result, dict) else result.get("component_scores", {})
        lang_fit = comp.get("language_fit", 1.0) if comp else 1.0
        status = "Met" if lang_fit >= 1.0 else "Below Requirement"
        status_class = "gap-ok" if lang_fit >= 1.0 else "gap-fail"
        rows += f'<tr class="{status_class}"><td>{_esc(school_name)}</td><td>{_esc(status)}</td></tr>'

    if not rows:
        rows = '<tr><td colspan="2">No language requirement data available.</td></tr>'

    return f"""
    <section class="section">
      <h2>6. Language Readiness</h2>
      <p><strong>Your IELTS Overall Band:</strong> {_esc(ielts_display)}</p>
      <table class="data-table">
        <thead><tr><th>School</th><th>IELTS Status</th></tr></thead>
        <tbody>{rows}</tbody>
      </table>
    </section>"""


def _section_appendix(student: dict) -> str:
    grades = student.get("subject_grades") or []
    rows = ""
    for g in grades:
        subj = _esc(g.get("subject_name") or g.get("subject_code") or "")
        raw = _esc(g.get("raw_grade") or "")
        sitting = _esc(g.get("sitting") or "")
        year = _esc(g.get("year_of_exam") or "")
        rows += f"<tr><td>{subj}</td><td>{sitting}</td><td>{raw}</td><td>{year}</td></tr>"
    if not rows:
        rows = '<tr><td colspan="4">No grade records.</td></tr>'

    return f"""
    <section class="section">
      <h2>7. Appendix</h2>
      <h3>Raw Grade Table</h3>
      <table class="data-table">
        <thead><tr><th>Subject</th><th>Sitting</th><th>Grade</th><th>Year</th></tr></thead>
        <tbody>{rows}</tbody>
      </table>
      <h3>Data Sources</h3>
      <p>School profile data sourced from HKEAA, JUPAS, and individual university admissions pages. Last refreshed: {_esc(str(datetime.now(timezone.utc).date()))}.</p>
    </section>"""


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

def generate_html_plan(student: dict, match_results: list, action_items: list) -> str:
    """
    Returns complete HTML string with inline CSS and @media print.
    REQ-077
    """
    if not action_items:
        action_items = _build_action_items(student, match_results)

    # Compute best-5 aggregate for display
    from app.services.hkdse_service import compute_best5_aggregate, grade_to_int
    grades = student.get("subject_grades") or []
    grade_dicts = []
    for g in grades:
        code = g.get("subject_code") or ""
        raw = g.get("raw_grade") or g.get("predicted_grade") or "U"
        category = g.get("category") or "ELECTIVE"
        is_compulsory = g.get("is_compulsory") or False
        grade_dicts.append({
            "subject_code": code,
            "numeric_value": grade_to_int(raw),
            "is_compulsory": is_compulsory,
            "category": category,
        })
    best5 = compute_best5_aggregate(grade_dicts)

    student_name = student.get("name") or student.get("full_name") or "Student"
    generated_at = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

    css = """
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', Arial, sans-serif;
      color: #1a1a2e;
      background: #f8f9fa;
      line-height: 1.6;
      padding: 24px;
    }
    .header {
      background: linear-gradient(135deg, #0f3460, #16213e);
      color: white;
      padding: 32px 40px;
      border-radius: 8px;
      margin-bottom: 32px;
    }
    .header h1 { font-size: 28px; margin-bottom: 4px; }
    .header .subtitle { opacity: 0.8; font-size: 14px; }
    .section {
      background: white;
      border-radius: 8px;
      padding: 24px;
      margin-bottom: 24px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.08);
    }
    .section h2 {
      font-size: 18px;
      color: #0f3460;
      border-bottom: 2px solid #e0e0e0;
      padding-bottom: 8px;
      margin-bottom: 16px;
    }
    .section h3 { font-size: 15px; color: #333; margin: 16px 0 8px 0; }
    .section h4 { font-size: 13px; color: #555; margin: 12px 0 6px 0; }
    .summary-table, .data-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 14px;
    }
    .summary-table th, .data-table th {
      background: #0f3460;
      color: white;
      padding: 8px 12px;
      text-align: left;
    }
    .summary-table td, .data-table td {
      padding: 8px 12px;
      border-bottom: 1px solid #e0e0e0;
    }
    .summary-table tr:nth-child(even) td,
    .data-table tr:nth-child(even) td { background: #f5f5f5; }
    .school-card {
      border: 1px solid #e0e0e0;
      border-radius: 6px;
      padding: 16px;
      margin-bottom: 16px;
    }
    .school-card h3 { color: #0f3460; font-size: 16px; margin-bottom: 8px; }
    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: bold;
      margin-left: 8px;
    }
    .badge-pass { background: #d4edda; color: #155724; }
    .badge-fail { background: #f8d7da; color: #721c24; }
    .gap-ok td { color: #155724; }
    .gap-fail td { color: #721c24; }
    .gap-table { margin-top: 8px; }
    .action-item { margin: 4px 0; }
    ul { padding-left: 20px; }
    li { margin: 4px 0; font-size: 14px; }
    .priority-high { color: #c0392b; font-weight: bold; }
    .priority-medium { color: #e67e22; }
    .priority-low { color: #27ae60; }
    .footer {
      text-align: center;
      font-size: 12px;
      color: #888;
      margin-top: 24px;
      padding: 16px;
    }
    @media print {
      body { background: white; padding: 0; font-size: 12px; }
      .header { background: #0f3460 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .section { box-shadow: none; border: 1px solid #ccc; page-break-inside: avoid; }
      .school-card { page-break-inside: avoid; }
      .badge { border: 1px solid currentColor; }
    }
    """

    sections = "".join([
        _section_student_summary(student, best5),
        _section_academic_profile(student),
        _section_recommended_schools(match_results, student),
        _section_action_plan(action_items),
        _section_skill_gaps(student, match_results),
        _section_language_readiness(student, match_results),
        _section_appendix(student),
    ])

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Academic Plan — {_esc(student_name)}</title>
  <style>{css}</style>
</head>
<body>
  <div class="header">
    <h1>Academic Advising Plan</h1>
    <div class="subtitle">{_esc(student_name)} &mdash; Generated {_esc(generated_at)}</div>
  </div>
  {sections}
  <div class="footer">
    Generated by Intelligent Academic Advisor &bull; {_esc(generated_at)}
  </div>
</body>
</html>"""
