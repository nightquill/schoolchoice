"""
app/services/plan_generator.py

HTML academic plan generation.
REQ-077

Generates a complete styled HTML document as a string using Python f-strings.
Inline CSS for base styling; Chart.js (CDN v4) for UNIVERSITY plan charts.
@media print block included.
"""

from __future__ import annotations

import html
import json
from datetime import datetime, timezone


# ---------------------------------------------------------------------------
# Template definitions (Point 17)
# ---------------------------------------------------------------------------

TEMPLATES: dict[str, dict[str, str]] = {
    "professional": {
        "--plan-bg": "#ffffff",
        "--plan-heading-color": "#1e3a5f",
        "--plan-accent": "#1e3a5f",
        "--plan-font-body": "Georgia, serif",
        "--plan-font-heading": "Georgia, serif",
        "--plan-section-padding": "28px 32px",
        "--plan-section-gap": "32px",
        "--plan-line-height": "1.8",
        "--plan-letter-spacing": "0.01em",
    },
    "modern": {
        "--plan-bg": "#f5f5f5",
        "--plan-heading-color": "#0d9488",
        "--plan-accent": "#0d9488",
        "--plan-font-body": "Inter, sans-serif",
        "--plan-font-heading": "Inter, sans-serif",
        "--plan-section-padding": "36px 40px",
        "--plan-section-gap": "40px",
        "--plan-line-height": "1.7",
        "--plan-letter-spacing": "0em",
    },
    "minimal": {
        "--plan-bg": "#ffffff",
        "--plan-heading-color": "#000000",
        "--plan-accent": "#000000",
        "--plan-font-body": "Arial, sans-serif",
        "--plan-font-heading": "Arial, sans-serif",
        "--plan-section-padding": "12px 16px",
        "--plan-section-gap": "16px",
        "--plan-line-height": "1.5",
        "--plan-letter-spacing": "0em",
    },
}


def _get_template_css(template_id: str) -> str:
    """Return a <style> block with CSS variable overrides for the given template."""
    tpl = TEMPLATES.get(template_id) or TEMPLATES["professional"]
    vars_css = "\n    ".join(f"{k}: {v};" for k, v in tpl.items())
    minimal_extra = ""
    if template_id == "minimal":
        minimal_extra = """
  .section { box-shadow: none !important; border: 1px solid #e5e7eb !important; border-radius: 0 !important; }
  .header { background: #000 !important; }"""
    return f"""<style>
  :root {{
    {vars_css}
  }}
  body {{
    background: var(--plan-bg);
    font-family: var(--plan-font-body, 'Segoe UI', Arial, sans-serif);
    line-height: var(--plan-line-height, 1.6);
    letter-spacing: var(--plan-letter-spacing, 0);
  }}
  h1, h2, h3, h4, h5, h6 {{
    font-family: var(--plan-font-heading, 'Segoe UI', Arial, sans-serif);
  }}
  .section {{
    padding: var(--plan-section-padding, 24px);
    margin-bottom: var(--plan-section-gap, 24px);
  }}
  .section h2 {{
    color: var(--plan-heading-color);
  }}
  .section h3 {{
    color: var(--plan-heading-color);
  }}
  .school-card h3 {{
    color: var(--plan-heading-color);
  }}
  .summary-table th, .data-table th {{
    background: var(--plan-accent);
  }}
  .header {{
    background: var(--plan-heading-color) !important;
  }}{minimal_extra}
</style>"""


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
# Chart helpers (Point 15)
# ---------------------------------------------------------------------------

def _derive_quarter(deadline: str | None, current_year: int) -> str:
    """
    Try to extract a quarter label from a deadline string.
    Recognises patterns like 'Q1 2026', 'Q3 2025', 'Next Mock Exam (2026)', 'By 2027'.
    Returns 'Q1 YYYY'–'Q4 YYYY' or 'TBD'.
    """
    if not deadline:
        return "TBD"
    dl = deadline.strip()
    # Explicit Qn pattern
    import re
    m = re.search(r"Q([1-4])\s*(\d{4})", dl)
    if m:
        return f"Q{m.group(1)} {m.group(2)}"
    # "Next Mock Exam (YYYY)"
    m2 = re.search(r"\((\d{4})\)", dl)
    if m2:
        return f"Q2 {m2.group(1)}"
    # "By YYYY"
    m3 = re.search(r"[Bb]y\s+(\d{4})", dl)
    if m3:
        return f"Q1 {m3.group(1)}"
    # bare year
    m4 = re.search(r"(\d{4})", dl)
    if m4:
        return f"Q2 {m4.group(1)}"
    return "TBD"


def _gantt_svg(action_items: list, current_year: int) -> str:
    """
    Build an SVG Gantt chart grouping action items by quarter.
    Quarters shown on X-axis: Q1–Q4 for current_year and current_year+1.
    Each item bar is coloured by priority.
    Returns an SVG string.
    """
    quarters = [
        f"Q1 {current_year}", f"Q2 {current_year}",
        f"Q3 {current_year}", f"Q4 {current_year}",
        f"Q1 {current_year + 1}", f"Q2 {current_year + 1}",
        f"Q3 {current_year + 1}", f"Q4 {current_year + 1}",
    ]
    quarter_index = {q: i for i, q in enumerate(quarters)}

    priority_colors = {
        "High": "#dc2626",
        "Medium": "#d97706",
        "Low": "#16a34a",
    }

    svg_width = 700
    left_margin = 160   # space for task label
    right_margin = 20
    chart_width = svg_width - left_margin - right_margin
    bar_height = 18
    row_gap = 6
    header_height = 40
    col_width = chart_width / len(quarters)

    # Assign each item a quarter index (items with TBD get placed at index -1 for last col)
    rows = []
    for item in action_items:
        dl = item.get("deadline") or ""
        qkey = _derive_quarter(dl, current_year)
        qidx = quarter_index.get(qkey, len(quarters) - 1)
        task = item.get("task") or ""
        truncated = task[:50] + ("…" if len(task) > 50 else "")
        priority = item.get("priority") or "Medium"
        color = priority_colors.get(priority, "#6b7280")
        rows.append((qidx, truncated, color))

    total_height = header_height + len(rows) * (bar_height + row_gap) + 20

    lines = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{svg_width}" height="{total_height}" style="font-family:Arial,sans-serif;font-size:11px;">',
        # Background
        f'<rect width="{svg_width}" height="{total_height}" fill="#f9fafb" rx="4"/>',
        # Column headers
    ]

    for i, q in enumerate(quarters):
        x = left_margin + i * col_width
        lines.append(f'<text x="{x + col_width / 2:.1f}" y="20" text-anchor="middle" font-size="10" fill="#6b7280">{_esc(q)}</text>')
        # Vertical grid lines
        lines.append(f'<line x1="{x:.1f}" y1="28" x2="{x:.1f}" y2="{total_height}" stroke="#e5e7eb" stroke-width="1"/>')

    # Rows
    for row_idx, (qidx, task_label, color) in enumerate(rows):
        y = header_height + row_idx * (bar_height + row_gap)
        bar_x = left_margin + qidx * col_width
        bar_w = col_width * 0.85
        # Task label (left column)
        lines.append(
            f'<text x="{left_margin - 6}" y="{y + bar_height - 4}" '
            f'text-anchor="end" font-size="10" fill="#374151">{_esc(task_label[:40])}</text>'
        )
        # Bar
        lines.append(
            f'<rect x="{bar_x:.1f}" y="{y}" width="{bar_w:.1f}" height="{bar_height}" '
            f'fill="{color}" rx="3" opacity="0.85"/>'
        )

    lines.append("</svg>")
    return "\n".join(lines)


def _charts_html_for_school(result, school_index: int, student: dict) -> str:
    """
    Build Chart.js canvas elements and data scripts for a single school result.
    Returns HTML string with canvas divs (scripts are collected separately).
    """
    from app.services.hkdse_service import grade_to_int

    # Access component scores safely (same pattern as _shap_section_html)
    if isinstance(result, dict):
        comp = result.get("component_scores") or {}
        min_entry = result.get("minimum_entry_score") or 0
    else:
        comp = getattr(result, "component_scores", {}) or {}
        min_entry = getattr(result, "minimum_entry_score", 0) or 0

    academic_fit = float(comp.get("academic_fit", 0.0))
    subject_alignment = float(comp.get("subject_alignment", 0.0))
    language_fit = float(comp.get("language_fit", 0.0))
    interest_alignment = float(comp.get("interest_alignment", 0.0))

    # Subject grade profile data
    grades = student.get("subject_grades") or []
    subjects_labels = []
    subjects_values = []
    for g in grades:
        name = g.get("subject_name") or g.get("subject_code") or "Subject"
        raw = g.get("raw_grade") or g.get("predicted_grade") or "U"
        numeric = grade_to_int(raw)
        subjects_labels.append(name)
        subjects_values.append(numeric)

    num_subjects = max(len(subjects_labels), 5)
    per_subject_min = round(min_entry / num_subjects, 2) if min_entry else 0

    grade_chart_id = f"chart-grade-{school_index}"
    radar_chart_id = f"chart-radar-{school_index}"

    grade_data = {
        "labels": subjects_labels,
        "datasets": [
            {
                "label": "Your Grade",
                "data": subjects_values,
                "backgroundColor": "rgba(59,130,246,0.5)",
                "borderColor": "rgba(59,130,246,0.9)",
                "borderWidth": 1,
            }
        ],
    }

    radar_data = {
        "labels": ["Academic Fit", "Subject Alignment", "Language Fit", "Program Alignment"],
        "datasets": [
            {
                "label": "School Fit",
                "data": [
                    round(academic_fit, 3),
                    round(subject_alignment, 3),
                    round(language_fit, 3),
                    round(interest_alignment, 3),
                ],
                "backgroundColor": "rgba(99,102,241,0.2)",
                "borderColor": "rgba(99,102,241,0.9)",
                "pointBackgroundColor": "rgba(99,102,241,0.9)",
                "borderWidth": 2,
            }
        ],
    }

    grade_data_json = json.dumps(grade_data)
    radar_data_json = json.dumps(radar_data)
    per_subject_min_js = json.dumps(per_subject_min)

    html_parts = []

    if subjects_labels:
        html_parts.append(f"""
            <h4>Subject Grade Profile</h4>
            <div style="max-width:500px;margin:16px 0;">
              <canvas id="{grade_chart_id}"></canvas>
            </div>
            <script id="data-{grade_chart_id}" type="application/json">{grade_data_json}</script>
            <script id="min-{grade_chart_id}" type="application/json">{per_subject_min_js}</script>""")

    html_parts.append(f"""
            <h4>School Fit Radar</h4>
            <div style="max-width:500px;margin:16px 0;">
              <canvas id="{radar_chart_id}"></canvas>
            </div>
            <script id="data-{radar_chart_id}" type="application/json">{radar_data_json}</script>""")

    return "".join(html_parts)


def _all_charts_init_script(top_schools: list, student: dict) -> str:
    """
    Build the Chart.js initialisation <script> block for all school charts.
    Each new Chart(...) is guarded by if (document.getElementById('...')) check.
    """
    from app.services.hkdse_service import grade_to_int

    scripts = []
    for idx, result in enumerate(top_schools, 1):
        grade_chart_id = f"chart-grade-{idx}"
        radar_chart_id = f"chart-radar-{idx}"

        grades = student.get("subject_grades") or []
        if grades:
            scripts.append(f"""
  if (document.getElementById('{grade_chart_id}')) {{
    var gradeData{idx} = JSON.parse(document.getElementById('data-{grade_chart_id}').textContent);
    var perSubjectMin{idx} = JSON.parse(document.getElementById('min-{grade_chart_id}').textContent);
    new Chart(document.getElementById('{grade_chart_id}'), {{
      type: 'bar',
      data: gradeData{idx},
      options: {{
        indexAxis: 'y',
        responsive: true,
        scales: {{
          x: {{
            min: 0,
            max: 7,
            title: {{ display: true, text: 'Grade (0-7)' }},
          }},
          y: {{ ticks: {{ font: {{ size: 11 }} }} }},
        }},
        plugins: {{
          annotation: void 0,
          tooltip: {{ enabled: true }},
          legend: {{ display: false }},
          title: {{ display: false }},
        }},
      }},
      plugins: [{{
        id: 'refLine{idx}',
        afterDraw(chart) {{
          const xScale = chart.scales.x;
          const yScale = chart.scales.y;
          const ctx = chart.ctx;
          const x = xScale.getPixelForValue(perSubjectMin{idx});
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(x, yScale.top);
          ctx.lineTo(x, yScale.bottom);
          ctx.strokeStyle = '#dc2626';
          ctx.lineWidth = 2;
          ctx.setLineDash([4, 3]);
          ctx.stroke();
          ctx.restore();
        }}
      }}],
    }});
  }}""")

        scripts.append(f"""
  if (document.getElementById('{radar_chart_id}')) {{
    var radarData{idx} = JSON.parse(document.getElementById('data-{radar_chart_id}').textContent);
    new Chart(document.getElementById('{radar_chart_id}'), {{
      type: 'radar',
      data: radarData{idx},
      options: {{
        responsive: true,
        scales: {{
          r: {{
            min: 0,
            max: 1,
            ticks: {{ stepSize: 0.25, font: {{ size: 10 }} }},
          }},
        }},
        plugins: {{
          legend: {{ display: false }},
        }},
      }},
    }});
  }}""")

    if not scripts:
        return ""
    return "<script>\n" + "\n".join(scripts) + "\n</script>"


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


def _shap_section_html(result) -> str:
    """
    Build the 'What drives this score' SHAP breakdown HTML for a single school result.
    Returns empty string if shap_explanation is None or has no features.
    """
    if isinstance(result, dict):
        shap_explanation = result.get("shap_explanation")
    else:
        shap_explanation = getattr(result, "shap_explanation", None)

    if not shap_explanation:
        return ""

    features = shap_explanation.get("features") if isinstance(shap_explanation, dict) else None
    if not features:
        return ""

    # Sort by magnitude descending, take top 4
    sorted_features = sorted(features, key=lambda f: f.get("magnitude", 0.0), reverse=True)[:4]

    rows = ""
    for feat in sorted_features:
        feature_name = _esc(feat.get("feature", ""))
        direction = feat.get("direction", "")
        magnitude = feat.get("magnitude", 0.0)
        explanation = _esc(feat.get("explanation", ""))
        pct_str = f"{magnitude * 100:.1f}%"
        if direction == "positive":
            arrow = "&#8593;"  # ↑
            dir_label = "boosts score"
            dir_color = "#155724"
            sign = "+"
        else:
            arrow = "&#8595;"  # ↓
            dir_label = "reduces score"
            dir_color = "#721c24"
            sign = ""
        rows += (
            f'<li style="margin:6px 0; font-size:14px;">'
            f'<span style="color:{dir_color}; font-weight:bold;">{arrow} {feature_name} ({sign}{pct_str})</span>'
            f' &mdash; {explanation}'
            f'</li>'
        )

    return f"""
            <h4>What drives this score</h4>
            <ul style="padding-left:20px;">{rows}</ul>"""


def _section_recommended_schools(match_results: list, student: dict, overrides: dict | None = None) -> str:
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

        # Check for rationale override (escape user-provided override text)
        rationale_override_key = f"school_{idx - 1}_rationale"
        if overrides and overrides.get(rationale_override_key):
            rationale = _esc(overrides[rationale_override_key])

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

        shap_html = _shap_section_html(result)

        # Charts (embedded canvas + data scripts; init script collected in generate_html_plan)
        charts_html = _charts_html_for_school(result, idx, student)

        content += f"""
        <div class="school-card">
          <h3>{idx}. {school_name} {elig_badge}</h3>
          <p><strong>Fit Score:</strong> {_pct(fit_score)}</p>
          {majors_html}
          <p><strong>Why this school fits:</strong> {rationale}</p>
          {shap_html}
          {charts_html}
          {gap_table}
          <h4>Recommended Actions</h4>
          <ul>{actions}</ul>
        </div>"""

    if not top_schools:
        content += "<p>No eligible school matches found. Consider broadening criteria.</p>"

    content += "</section>"
    return content, top_schools


# ---------------------------------------------------------------------------
# HIGH_SCHOOL plan sections
# ---------------------------------------------------------------------------

def _section_hs_subject_analysis(student: dict) -> str:
    """Section 3 for HIGH_SCHOOL plan: subject-by-subject strength/weakness analysis."""
    from app.services.hkdse_service import grade_to_int

    grades = student.get("subject_grades") or []
    if not grades:
        return '<section class="section"><h2>3. Subject Strength &amp; Weakness Analysis</h2><p>No grade records on file.</p></section>'

    rows = ""
    for g in grades:
        subj = _esc(g.get("subject_name") or g.get("subject_code") or "")
        raw = g.get("raw_grade") or g.get("predicted_grade") or "U"
        numeric = grade_to_int(raw)
        raw_esc = _esc(raw)

        if numeric >= 5:
            status = "Strength"
            status_style = "color:#155724; font-weight:bold;"
            action = "Maintain performance; consider advanced extension work."
        elif numeric < 4:
            status = "Needs Improvement"
            status_style = "color:#721c24; font-weight:bold;"
            action = f"Focus on Grade 4+ target; seek teacher support and additional practice."
        else:
            status = "On Track"
            status_style = "color:#856404; font-weight:bold;"
            action = "Consolidate understanding; aim for Grade 5 in next sitting."

        rows += (
            f"<tr>"
            f"<td>{subj}</td>"
            f"<td>{raw_esc}</td>"
            f"<td>{numeric}</td>"
            f'<td><span style="{status_style}">{status}</span></td>'
            f"<td>{action}</td>"
            f"</tr>"
        )

    return f"""
    <section class="section">
      <h2>3. Subject Strength &amp; Weakness Analysis</h2>
      <table class="data-table">
        <thead>
          <tr>
            <th>Subject</th><th>Grade</th><th>Numeric</th>
            <th>Assessment</th><th>Recommended Action</th>
          </tr>
        </thead>
        <tbody>{rows}</tbody>
      </table>
    </section>"""


def _section_hs_action_plan(student: dict) -> str:
    """Section 4 for HIGH_SCHOOL plan: grade improvement action items."""
    from app.services.hkdse_service import grade_to_int

    current_year = datetime.now(timezone.utc).year
    grades = student.get("subject_grades") or []
    items = []

    for g in grades:
        subj = _esc(g.get("subject_name") or g.get("subject_code") or "Subject")
        raw = g.get("raw_grade") or g.get("predicted_grade") or "U"
        numeric = grade_to_int(raw)
        if numeric < 4:
            items.append({
                "task": f"Improve {subj} to Grade 4 or above",
                "deadline": f"Next Mock Exam ({current_year})",
                "priority": "High",
            })
        elif numeric < 5:
            items.append({
                "task": f"Aim for Grade 5 in {subj}",
                "deadline": f"End of Term ({current_year})",
                "priority": "Medium",
            })

    items.append({
        "task": "Meet regularly with form teacher to review academic progress",
        "deadline": f"Monthly ({current_year})",
        "priority": "High",
    })
    items.append({
        "task": "Identify and join relevant extra-curricular activities",
        "deadline": f"Q3 {current_year}",
        "priority": "Medium",
    })

    if not items:
        return '<section class="section"><h2>4. Grade Improvement Action Plan</h2><p>No specific improvement actions needed. Keep up the excellent work!</p></section>'

    rows = ""
    for item in items:
        task = _esc(item.get("task") or "")
        deadline = _esc(item.get("deadline") or "")
        priority = _esc(item.get("priority") or "Medium")
        priority_class = f"priority-{priority.lower()}"
        rows += (
            f"<tr>"
            f"<td>{deadline}</td>"
            f"<td>{task}</td>"
            f'<td><span class="{priority_class}">{priority}</span></td>'
            f"</tr>"
        )

    return f"""
    <section class="section">
      <h2>4. Grade Improvement Action Plan</h2>
      <table class="data-table">
        <thead>
          <tr><th>Deadline</th><th>Task</th><th>Priority</th></tr>
        </thead>
        <tbody>{rows}</tbody>
      </table>
    </section>"""


def _generate_high_school_plan(student: dict, match_results: list, template_id: str = "professional", overrides: dict | None = None) -> str:
    """
    Generate a HIGH_SCHOOL academic plan HTML document.
    Filters match results to HIGH_SCHOOL type schools only.
    Shows subject strength/weakness analysis instead of university fit scores.
    No IELTS section. No Chart.js charts.
    """
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

    # Filter match_results to high schools only
    hs_results = []
    for r in match_results:
        school_type = getattr(r, "school_type", None) if not isinstance(r, dict) else r.get("school_type")
        if school_type == "HIGH_SCHOOL":
            hs_results.append(r)

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
      background: linear-gradient(135deg, #145a32, #1e8449);
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
      color: #145a32;
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
      background: #145a32;
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
      .header { background: #145a32 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .section { box-shadow: none; border: 1px solid #ccc; page-break-inside: avoid; }
      .school-card { page-break-inside: avoid; }
      .badge { border: 1px solid currentColor; }
    }
    """

    # Apply overrides to sections
    summary_html = overrides.get("student_summary") if overrides else None
    if not summary_html:
        summary_html = _section_student_summary(student, best5)

    action_notes_html = overrides.get("action_plan_notes") if overrides else None

    sections_list = [
        summary_html,
        _section_academic_profile(student),
        _section_hs_subject_analysis(student),
        _section_hs_action_plan(student),
        _section_appendix(student),
    ]
    if action_notes_html:
        sections_list.append(f'<section class="section">{action_notes_html}</section>')

    sections = "".join(sections_list)

    template_css = _get_template_css(template_id)

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>High School Academic Plan — {_esc(student_name)}</title>
  {template_css}
  <style>{css}</style>
</head>
<body>
  <div class="header">
    <h1>High School Academic Plan</h1>
    <div class="subtitle">{_esc(student_name)} &mdash; Generated {_esc(generated_at)}</div>
  </div>
  {sections}
  <div class="footer">
    Generated by Intelligent Academic Advisor &bull; {_esc(generated_at)}
  </div>
</body>
</html>"""


def _section_action_plan(action_items: list, current_year: int | None = None, overrides: dict | None = None) -> str:
    if overrides and overrides.get("action_plan_notes"):
        return f'<section class="section"><h2>4. Action Plan Timeline</h2>{overrides["action_plan_notes"]}</section>'

    if not action_items:
        return '<section class="section"><h2>4. Action Plan Timeline</h2><p>No action items generated.</p></section>'

    if current_year is None:
        current_year = datetime.now(timezone.utc).year

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

    # SVG Gantt
    gantt = _gantt_svg(action_items, current_year)

    return f"""
    <section class="section">
      <h2>4. Action Plan Timeline</h2>
      <table class="data-table">
        <thead>
          <tr><th>Deadline</th><th>Task</th><th>Priority</th><th>Related School</th></tr>
        </thead>
        <tbody>{rows}</tbody>
      </table>
      <h4 style="margin-top:20px;">Timeline Overview</h4>
      <div style="overflow-x:auto;margin-top:8px;">{gantt}</div>
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

def generate_html_plan(
    student: dict,
    match_results: list,
    action_items: list,
    plan_type: str = "UNIVERSITY",
    template_id: str = "professional",
    overrides: dict | None = None,
) -> str:
    """
    Returns complete HTML string with inline CSS and @media print.
    plan_type: "UNIVERSITY" (default) or "HIGH_SCHOOL".
    template_id: "professional" (default), "modern", or "minimal".
    overrides: dict of section_key -> html_content to override auto-generated sections.
    REQ-077
    """
    if overrides is None:
        overrides = {}

    if plan_type == "HIGH_SCHOOL":
        return _generate_high_school_plan(student, match_results, template_id=template_id, overrides=overrides)

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
    current_year = datetime.now(timezone.utc).year

    css = """
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: var(--plan-font-body, 'Segoe UI', Arial, sans-serif);
      color: #1a1a2e;
      background: #f8f9fa;
      line-height: 1.6;
      padding: 24px;
    }
    h1, h2, h3, h4, h5, h6 {
      font-family: var(--plan-font-heading, 'Segoe UI', Arial, sans-serif);
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
      canvas { max-width: 100% !important; }
    }
    """

    # Build the recommended schools section (returns HTML + top_schools list)
    recommended_section_html, top_schools = _section_recommended_schools(match_results, student, overrides=overrides)

    # Build student summary (support override)
    summary_html = overrides.get("student_summary") or _section_student_summary(student, best5)

    # Build action plan section (support override)
    action_plan_html = _section_action_plan(action_items, current_year=current_year, overrides=overrides)

    sections = "".join([
        summary_html,
        _section_academic_profile(student),
        recommended_section_html,
        action_plan_html,
        _section_skill_gaps(student, match_results),
        _section_language_readiness(student, match_results),
        _section_appendix(student),
    ])

    # Build Chart.js init script for all university school charts
    charts_init_script = _all_charts_init_script(top_schools, student)

    template_css = _get_template_css(template_id)

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>University Academic Plan — {_esc(student_name)}</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
  {template_css}
  <style>{css}</style>
</head>
<body>
  <div class="header">
    <h1>University Academic Plan</h1>
    <div class="subtitle">{_esc(student_name)} &mdash; Generated {_esc(generated_at)}</div>
  </div>
  {sections}
  <div class="footer">
    Generated by Intelligent Academic Advisor &bull; {_esc(generated_at)}
  </div>
  {charts_init_script}
</body>
</html>"""
