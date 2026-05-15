"""
app/services/plan_generator.py

HTML academic plan generation — Modern Consultant style.
REQ-077

Philosophy: The plan is an ACTION document, not an algorithmic recommendation.
It tells the student "what you need to do to get where you want to go."

- Student view (default): encouraging, action-oriented, no match percentages
- Counselor view (toggle): match scores, competitive positioning, risk flags
- Counselor-only elements use class="counselor-only" (hidden by default)
"""

from __future__ import annotations

import html
from datetime import datetime, timezone

__all__ = [
    "TEMPLATES",
    "generate_html_plan",
    "_build_action_items",
    "_esc",
]


# ---------------------------------------------------------------------------
# Template color schemes
# ---------------------------------------------------------------------------

TEMPLATES: dict[str, dict[str, str]] = {
    "professional": {
        "primary": "#2563eb",
        "primary-light": "#eff6ff",
        "bg": "#ffffff",
        "surface": "#f8fafc",
        "text": "#111827",
        "text-secondary": "#6b7280",
        "border": "#e5e7eb",
        "green": "#16a34a",
        "green-light": "#f0fdf4",
        "amber": "#d97706",
        "amber-light": "#fef3c7",
        "red": "#dc2626",
        "red-light": "#fef2f2",
    },
    "modern": {
        "primary": "#0d9488",
        "primary-light": "#f0fdfa",
        "bg": "#f5f5f5",
        "surface": "#ffffff",
        "text": "#111827",
        "text-secondary": "#6b7280",
        "border": "#e5e7eb",
        "green": "#16a34a",
        "green-light": "#f0fdf4",
        "amber": "#d97706",
        "amber-light": "#fef3c7",
        "red": "#dc2626",
        "red-light": "#fef2f2",
    },
    "minimal": {
        "primary": "#111827",
        "primary-light": "#f3f4f6",
        "bg": "#ffffff",
        "surface": "#f9fafb",
        "text": "#111827",
        "text-secondary": "#6b7280",
        "border": "#d1d5db",
        "green": "#16a34a",
        "green-light": "#f0fdf4",
        "amber": "#d97706",
        "amber-light": "#fef3c7",
        "red": "#dc2626",
        "red-light": "#fef2f2",
    },
}


def _esc(value: object) -> str:
    """HTML-escape any value for safe embedding."""
    return html.escape(str(value) if value is not None else "")


def _grade_color(grade_str: str, colors: dict) -> str:
    """Return background color for a grade cell."""
    from app.modules.school_choice.services.hkdse_service import grade_to_int
    num = grade_to_int(grade_str)
    if num >= 5:
        return colors["green-light"]
    elif num == 4:
        return colors["amber-light"]
    elif num > 0:
        return colors["red-light"]
    return "transparent"


# ---------------------------------------------------------------------------
# CSS
# ---------------------------------------------------------------------------

def _build_css(colors: dict, template_id: str) -> str:
    p = colors["primary"]
    pl = colors["primary-light"]
    bg = colors["bg"]
    sf = colors["surface"]
    tx = colors["text"]
    ts = colors["text-secondary"]
    bd = colors["border"]
    shadow = "0 1px 3px rgba(0,0,0,0.1)" if template_id != "minimal" else "none"
    border_style = f"1px solid {bd}"

    return f"""
    * {{ box-sizing: border-box; margin: 0; padding: 0; }}
    body {{
      font-family: Inter, system-ui, -apple-system, sans-serif;
      color: {tx};
      background: {sf};
      line-height: 1.6;
      padding: 24px;
      font-size: 14px;
    }}
    .header {{
      background: {bg};
      padding: 24px 32px;
      border-bottom: 3px solid {p};
      margin-bottom: 24px;
    }}
    .header-label {{
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 1px;
      text-transform: uppercase;
      color: {p};
      margin-bottom: 4px;
    }}
    .header h1 {{
      font-size: 22px;
      font-weight: 700;
      color: {tx};
      margin-bottom: 2px;
    }}
    .header .subtitle {{
      font-size: 12px;
      color: {ts};
    }}
    .metrics-row {{
      display: flex;
      gap: 12px;
      margin-bottom: 24px;
      flex-wrap: wrap;
    }}
    .metric-card {{
      flex: 1 1 120px;
      border-radius: 8px;
      padding: 14px 16px;
      text-align: center;
      min-width: 100px;
    }}
    .metric-value {{
      font-size: 24px;
      font-weight: 700;
      line-height: 1.2;
    }}
    .metric-label {{
      font-size: 10px;
      color: {ts};
      margin-top: 2px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }}
    .section {{
      background: {bg};
      border-radius: 8px;
      padding: 20px 24px;
      margin-bottom: 20px;
      box-shadow: {shadow};
      border: {border_style};
    }}
    .section h2 {{
      font-size: 16px;
      font-weight: 600;
      color: {tx};
      margin-bottom: 14px;
      padding-bottom: 8px;
      border-bottom: 2px solid {bd};
    }}
    .assessment {{
      border-left: 4px solid {p};
      background: {pl};
      padding: 16px 20px;
      border-radius: 0 8px 8px 0;
      margin-bottom: 24px;
      font-size: 14px;
      line-height: 1.7;
      color: {tx};
    }}
    .school-card {{
      border: {border_style};
      border-radius: 8px;
      padding: 16px 20px;
      margin-bottom: 12px;
      background: {bg};
    }}
    .school-header {{
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 8px;
    }}
    .school-name {{
      font-size: 14px;
      font-weight: 600;
      color: {tx};
    }}
    .school-meta {{
      font-size: 11px;
      color: {ts};
      margin-top: 2px;
    }}
    .school-rationale {{
      font-size: 13px;
      color: #444;
      line-height: 1.5;
      margin: 8px 0;
    }}
    .school-actions {{
      margin-top: 8px;
      padding-left: 18px;
    }}
    .school-actions li {{
      font-size: 12px;
      color: {tx};
      margin: 3px 0;
      line-height: 1.4;
    }}
    .badge {{
      display: inline-block;
      padding: 3px 12px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      white-space: nowrap;
    }}
    .badge-blue {{ background: {p}; color: white; }}
    .badge-green {{ background: {colors["green"]}; color: white; }}
    .badge-amber {{ background: {colors["amber"]}; color: white; }}
    .data-table {{
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }}
    .data-table th {{
      background: {sf};
      color: {tx};
      font-weight: 600;
      padding: 8px 12px;
      text-align: left;
      border-bottom: 2px solid {bd};
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }}
    .data-table td {{
      padding: 8px 12px;
      border-bottom: 1px solid {bd};
    }}
    .data-table tr:last-child td {{
      border-bottom: none;
    }}
    .pill {{
      display: inline-block;
      padding: 2px 8px;
      border-radius: 10px;
      font-size: 10px;
      font-weight: 600;
    }}
    .pill-high {{ background: {colors["red-light"]}; color: {colors["red"]}; }}
    .pill-medium {{ background: {colors["amber-light"]}; color: {colors["amber"]}; }}
    .pill-low {{ background: {colors["green-light"]}; color: {colors["green"]}; }}
    .gap-pill {{
      display: inline-block;
      padding: 4px 12px;
      border-radius: 16px;
      font-size: 12px;
      margin: 3px 4px 3px 0;
      background: {colors["amber-light"]};
      color: #92400e;
    }}
    .counselor-only {{ display: none; }}
    .show-counselor .counselor-only {{ display: block; }}
    .show-counselor .counselor-only-inline {{ display: inline; }}
    .footer {{
      text-align: center;
      font-size: 11px;
      color: {ts};
      margin-top: 24px;
      padding: 16px;
    }}
    @media print {{
      body {{ margin: 0; padding: 0; font-size: 11pt; color: #000; background: white; }}
      .no-print, nav, .chat-panel, button {{ display: none !important; }}
      .section {{ box-shadow: none; page-break-inside: avoid; }}
      table {{ page-break-inside: avoid; border-collapse: collapse; }}
      table td, table th {{ border: 1px solid #ccc; padding: 4px 8px; }}
      h2, h3 {{ page-break-after: avoid; }}
      .school-card, .section-card {{ page-break-inside: avoid; }}
      .counselor-only {{ display: none !important; }}
      @page {{ margin: 1.5cm; size: A4; }}
      a {{ text-decoration: none; color: inherit; }}
      .score-badge {{ border: 1px solid #333; }}
      * {{ -webkit-print-color-adjust: exact; print-color-adjust: exact; }}
    }}
    """


# ---------------------------------------------------------------------------
# Section builders
# ---------------------------------------------------------------------------

def _section_header(student: dict, generated_at: str, best5: int) -> str:
    name = _esc(student.get("name") or "Student")
    year = student.get("year_of_study")
    year_str = f" · Year {year}" if year else ""

    # Next JUPAS milestone
    deadline_badge = ""
    try:
        from app.modules.school_choice.data.jupas_calendar import get_next_milestone
        from datetime import date
        milestone = get_next_milestone(date.today().isoformat())
        if milestone:
            from datetime import datetime as _dt
            days = (_dt.strptime(milestone["date"], "%Y-%m-%d").date() - date.today()).days
            color = "#dc2626" if days <= 30 else "#d97706"
            bg = "#fef2f2" if days <= 30 else "#fffbeb"
            deadline_badge = f'<div style="margin-top:8px;"><span style="background:{bg};color:{color};padding:3px 12px;border-radius:6px;font-size:12px;font-weight:600;border:1px solid {color}22;">{_esc(milestone["label"])}: {milestone["date"]} — {days} days</span></div>'
    except Exception:
        pass

    return f"""
  <div class="header">
    <div class="header-label">University Application Strategy</div>
    <h1>{name}</h1>
    <div class="subtitle">Prepared {_esc(generated_at)}{year_str}</div>
    {deadline_badge}
    <div class="counselor-only" style="margin-top:8px;font-size:12px;color:#6b7280;">Best-5 Aggregate: {best5}</div>
  </div>"""


def _section_metrics(student: dict, best5: int, num_schools: int, colors: dict) -> str:
    grades = student.get("subject_grades") or []
    top_grade = "N/A"
    if grades:
        from app.modules.school_choice.services.hkdse_service import grade_to_int
        best = max(grades, key=lambda g: grade_to_int(g.get("raw_grade") or "U"))
        top_grade = _esc(best.get("raw_grade") or "N/A")

    return f"""
  <div class="metrics-row">
    <div class="metric-card counselor-only" style="background:{colors['primary-light']};">
      <div class="metric-value" style="color:{colors['primary']};">{best5}</div>
      <div class="metric-label">Best-5 Score</div>
    </div>
    <div class="metric-card" style="background:{colors['green-light']};">
      <div class="metric-value" style="color:{colors['green']};">{top_grade}</div>
      <div class="metric-label">Top Grade</div>
    </div>
    <div class="metric-card" style="background:{colors['amber-light']};">
      <div class="metric-value" style="color:{colors['amber']};">{num_schools}</div>
      <div class="metric-label">Target Schools</div>
    </div>
    <div class="metric-card" style="background:{colors['primary-light']};">
      <div class="metric-value" style="color:{colors['primary']};">{len(grades)}</div>
      <div class="metric-label">Subjects</div>
    </div>
  </div>"""


def _section_assessment(ai_assessment: str | None) -> str:
    if not ai_assessment:
        return ""
    return f"""
  <div class="assessment">
    {_esc(ai_assessment)}
  </div>"""


def _section_academic_profile(student: dict, colors: dict, benchmark_median: float | None = None, benchmark_label: str = "Band A Benchmark") -> str:
    """Render academic strengths as an SVG radar chart comparing student grades vs benchmark."""
    import math

    GRADE_MAP = {"5**": 7, "5*": 6, "5": 5, "4": 4, "3": 3, "2": 2, "1": 1, "U": 0, "A": 6, "B": 4, "C": 3}
    grades = student.get("subject_grades") or []
    if not grades:
        return '<div class="section"><h2>Your Academic Strengths</h2><p>No grade records on file yet.</p></div>'

    # Build subject data (best grade per subject)
    subject_data = {}
    for g in grades:
        code = g.get("subject_code") or g.get("subject_name") or ""
        name = g.get("subject_name") or code
        raw = g.get("raw_grade") or ""
        val = GRADE_MAP.get(raw, 0)
        if code not in subject_data or val > subject_data[code]["val"]:
            subject_data[code] = {"name": name, "val": val}

    subjects = list(subject_data.values())
    if len(subjects) < 3:
        return '<div class="section"><h2>Your Academic Strengths</h2><p>Need at least 3 subjects for chart.</p></div>'

    n = len(subjects)
    cx, cy, r = 200, 200, 150
    max_val = 7

    # Per-subject benchmark (uniform distribution of median across subjects)
    # Benchmark median is a best-5 total — divide by 5 (not n) to get per-subject level
    bench_per = (benchmark_median / 5) if benchmark_median else None

    def polar(i, val):
        angle = (2 * math.pi * i / n) - math.pi / 2
        x = cx + r * (val / max_val) * math.cos(angle)
        y = cy + r * (val / max_val) * math.sin(angle)
        return x, y

    # Grid circles
    grid_lines = ""
    for level in range(1, 8):
        pts = " ".join(f"{polar(i, level)[0]:.1f},{polar(i, level)[1]:.1f}" for i in range(n))
        grid_lines += f'<polygon points="{pts}" fill="none" stroke="#e5e7eb" stroke-width="0.5"/>'

    # Axis lines
    for i in range(n):
        x, y = polar(i, max_val)
        grid_lines += f'<line x1="{cx}" y1="{cy}" x2="{x:.1f}" y2="{y:.1f}" stroke="#e5e7eb" stroke-width="0.5"/>'

    # Student polygon
    student_pts = " ".join(f"{polar(i, s['val'])[0]:.1f},{polar(i, s['val'])[1]:.1f}" for i, s in enumerate(subjects))

    # Benchmark polygon
    bench_svg = ""
    if bench_per and bench_per > 0:
        bench_pts = " ".join(f"{polar(i, min(bench_per, max_val))[0]:.1f},{polar(i, min(bench_per, max_val))[1]:.1f}" for i in range(n))
        bench_svg = f'<polygon points="{bench_pts}" fill="none" stroke="#dc2626" stroke-width="2" stroke-dasharray="5,5"/>'

    # Labels
    labels = ""
    for i, s in enumerate(subjects):
        x, y = polar(i, max_val + 1)
        anchor = "middle"
        if x < cx - 10:
            anchor = "end"
        elif x > cx + 10:
            anchor = "start"
        labels += f'<text x="{x:.1f}" y="{y:.1f}" text-anchor="{anchor}" font-size="11" fill="{colors["text-secondary"]}">{_esc(s["name"])}</text>'

    # Legend
    legend = f"""
    <g transform="translate({cx - 120}, {cy + r + 25})">
      <rect x="0" y="0" width="12" height="12" fill="{colors['primary']}" opacity="0.3" stroke="{colors['primary']}" stroke-width="2"/>
      <text x="18" y="10" font-size="11" fill="{colors['text']}">Your Grades</text>
      <rect x="120" y="0" width="12" height="12" fill="none" stroke="#dc2626" stroke-width="2" stroke-dasharray="3,3"/>
      <text x="138" y="10" font-size="11" fill="{colors['text']}">{_esc(benchmark_label)}</text>
    </g>"""

    svg = f"""
    <svg viewBox="0 0 400 {cy + r + 55}" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:500px;margin:0 auto;display:block;">
      {grid_lines}
      <polygon points="{student_pts}" fill="{colors['primary']}" fill-opacity="0.25" stroke="{colors['primary']}" stroke-width="2"/>
      {bench_svg}
      {labels}
      {legend}
    </svg>"""

    return f'<div class="section"><h2>Your Academic Strengths</h2>{svg}</div>'


def _section_target_programmes(match_results: list, colors: dict, overrides: dict | None = None) -> str:
    """Build target programmes section."""
    content = '<div class="section"><h2>Your Target Programmes</h2>'

    top_schools = [r for r in match_results if (
        r.get("eligibility_pass", True) if isinstance(r, dict) else getattr(r, "eligibility_pass", True)
    )][:8]

    if not top_schools:
        content += "<p>No target schools set yet. Ask your counselor to add schools to your list.</p>"
        content += "</div>"
        return content

    for idx, result in enumerate(top_schools):
        if isinstance(result, dict):
            school_name = _esc(result.get("school_name", ""))
            rationale = _esc(result.get("rationale", ""))
            jupas = result.get("major_jupas_code") or result.get("jupas_code")
            major = result.get("major_name")
            fit_score = result.get("fit_score", 0)
            action_items = result.get("action_items") or []
        else:
            school_name = _esc(getattr(result, "school_name", ""))
            rationale = _esc(getattr(result, "rationale", ""))
            jupas = getattr(result, "major_jupas_code", None)
            major = getattr(result, "major_name", None)
            fit_score = getattr(result, "fit_score", 0)
            action_items = []

        # Override rationale if provided
        override_key = f"school_{idx}_rationale"
        if overrides and overrides.get(override_key):
            rationale = _esc(overrides[override_key])

        # Build display name: "Major (School)" when major exists, programme-first
        if major:
            display_name = f"{_esc(major)}<span style='font-weight:400;font-size:0.85em;color:{colors['text-secondary']};'> — {school_name}</span>"
        else:
            display_name = school_name

        meta_parts = []
        if jupas:
            meta_parts.append(f"JUPAS: {_esc(jupas)}")
        meta_str = " · ".join(meta_parts) if meta_parts else ""

        # Counselor-only match badge
        pct = round(fit_score * 100) if fit_score else 0
        if pct >= 80:
            badge_class = "badge-blue"
        elif pct >= 60:
            badge_class = "badge-green"
        else:
            badge_class = "badge-amber"

        actions_html = ""
        if action_items:
            items = "".join(f"<li>{_esc(a)}</li>" for a in action_items)
            actions_html = f"""
        <div style="margin-top:8px;">
          <div style="font-size:11px;font-weight:600;color:{colors['text-secondary']};text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">What to focus on</div>
          <ul class="school-actions">{items}</ul>
        </div>"""

        # Programme-specific deadline tags
        deadline_tags = ""
        if jupas:
            try:
                from app.modules.school_choice.models.models import JupasProgramme as _JP
                from app.db.session import SessionLocal
                _db = SessionLocal()
                _prog = _db.query(_JP).filter(_JP.jupas_code == jupas).first()
                if _prog:
                    ngr = _prog.non_grade_requirements or {}
                    dl = _prog.deadlines or {}
                    tags = []
                    if ngr.get("interview"):
                        d = dl.get("interview", "")
                        tags.append(f'<span style="background:#FEF3C7;color:#92400E;padding:1px 6px;border-radius:4px;font-size:10px;font-weight:600;">Interview{": " + d if d else ""}</span>')
                    if ngr.get("portfolio"):
                        d = dl.get("portfolio", "")
                        tags.append(f'<span style="background:#F5F3FF;color:#7C3AED;padding:1px 6px;border-radius:4px;font-size:10px;font-weight:600;">Portfolio{": " + d if d else ""}</span>')
                    if ngr.get("audition"):
                        d = dl.get("audition", "")
                        tags.append(f'<span style="background:#FEF2F2;color:#991B1B;padding:1px 6px;border-radius:4px;font-size:10px;font-weight:600;">Audition{": " + d if d else ""}</span>')
                    if tags:
                        deadline_tags = '<div style="display:flex;gap:4px;margin-top:4px;">' + "".join(tags) + '</div>'
                _db.close()
            except Exception:
                pass

        content += f"""
    <div class="school-card">
      <div class="school-header">
        <div>
          <div class="school-name">{display_name}</div>
          <div class="school-meta">{meta_str}</div>
          {deadline_tags}
        </div>
        <span class="badge {badge_class} counselor-only-inline" style="display:none;">{pct}%</span>
      </div>
      <div style="font-size:11px;font-weight:600;color:{colors['text-secondary']};text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Why this works for you</div>
      <div class="school-rationale">{rationale}</div>
      {actions_html}
    </div>"""

    content += "</div>"
    return content


def _section_roadmap(action_items: list, colors: dict) -> str:
    """Application Roadmap — month-by-month action table. This is the core of the plan."""
    if not action_items:
        return '<div class="section"><h2>Application Roadmap</h2><p>No action items generated yet.</p></div>'

    rows = ""
    for item in action_items:
        task = _esc(item.get("task") or "")
        deadline = _esc(item.get("deadline") or "General")
        priority = item.get("priority") or "Medium"
        school = _esc(item.get("related_school") or "")
        pill_class = f"pill-{priority.lower()}"
        rows += f"""<tr>
      <td style="white-space:nowrap;font-weight:500;">{deadline}</td>
      <td>{task}</td>
      <td><span class="pill {pill_class}">{_esc(priority)}</span></td>
      <td style="font-size:12px;color:{colors['text-secondary']};">{school}</td>
    </tr>"""

    return f"""
  <div class="section">
    <h2>Application Roadmap</h2>
    <p style="font-size:13px;color:{colors['text-secondary']};margin-bottom:14px;">Your month-by-month action plan to maximise your application strength.</p>
    <table class="data-table">
      <thead><tr><th>When</th><th>What To Do</th><th>Priority</th><th>School</th></tr></thead>
      <tbody>{rows}</tbody>
    </table>
  </div>"""


def _section_growth_areas(student: dict, skill_gaps: list | None, colors: dict) -> str:
    """Areas to strengthen — framed as growth opportunities."""
    extra = student.get("extra_curricular") or []
    awards = student.get("awards") or []

    items = []
    if skill_gaps:
        for gap in skill_gaps:
            items.append(_esc(gap) if isinstance(gap, str) else _esc(str(gap)))

    if not extra and not awards and not items:
        items.append("Build your extracurricular profile — join clubs, volunteer, or start a project related to your interests")

    if not items:
        items.append("Continue building on your current strengths and activities")

    pills = "".join(f'<span class="gap-pill">{item}</span>' for item in items)

    return f"""
  <div class="section">
    <h2>Areas to Strengthen</h2>
    <p style="font-size:13px;color:{colors['text-secondary']};margin-bottom:12px;">Focus areas that will strengthen your applications across all target schools.</p>
    <div>{pills}</div>
  </div>"""


def _section_language(student: dict, colors: dict) -> str:
    ielts_raw = student.get("ielts_score")
    ielts_overall = None
    if isinstance(ielts_raw, dict):
        ielts_overall = ielts_raw.get("overall")
    elif ielts_raw is not None:
        try:
            ielts_overall = float(ielts_raw)
        except (TypeError, ValueError):
            pass

    if ielts_overall:
        status = f"Your IELTS overall band is <strong>{ielts_overall}</strong>."
    else:
        status = "IELTS score not yet on file. Check if your target schools require IELTS and plan accordingly."

    return f"""
  <div class="section">
    <h2>Language Readiness</h2>
    <p style="font-size:13px;">{status}</p>
  </div>"""


def _section_appendix(student: dict, best5: int, match_results: list, colors: dict) -> str:
    # Raw grade table
    grades = student.get("subject_grades") or []
    grade_rows = ""
    for g in grades:
        subj = _esc(g.get("subject_name") or g.get("subject_code") or "")
        raw = _esc(g.get("raw_grade") or "")
        sitting = _esc(g.get("sitting") or "")
        year = _esc(g.get("year_of_exam") or "")
        grade_rows += f"<tr><td>{subj}</td><td>{sitting}</td><td>{raw}</td><td>{year}</td></tr>"
    if not grade_rows:
        grade_rows = '<tr><td colspan="4">No grade records.</td></tr>'

    # Counselor-only: match scores per school
    counselor_rows = ""
    for r in match_results[:10]:
        if isinstance(r, dict):
            name = _esc(r.get("school_name", ""))
            score = round((r.get("fit_score") or 0) * 100)
            eligible = r.get("eligibility_pass", True)
        else:
            name = _esc(getattr(r, "school_name", ""))
            score = round((getattr(r, "fit_score", 0) or 0) * 100)
            eligible = getattr(r, "eligibility_pass", True)
        elig_str = "Yes" if eligible else "No"
        counselor_rows += f"<tr><td>{name}</td><td>{score}%</td><td>{elig_str}</td></tr>"

    generated = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    return f"""
  <div class="section">
    <h2>Appendix</h2>
    <h3 style="font-size:13px;margin-bottom:8px;">Grade Records</h3>
    <table class="data-table">
      <thead><tr><th>Subject</th><th>Sitting</th><th>Grade</th><th>Year</th></tr></thead>
      <tbody>{grade_rows}</tbody>
    </table>
    <div class="counselor-only" style="margin-top:20px;">
      <h3 style="font-size:13px;margin-bottom:8px;">Counselor Data — Match Scores</h3>
      <p style="font-size:12px;color:{colors['text-secondary']};margin-bottom:8px;">Best-5 Aggregate: {best5}</p>
      <table class="data-table">
        <thead><tr><th>School</th><th>Match</th><th>Eligible</th></tr></thead>
        <tbody>{counselor_rows}</tbody>
      </table>
    </div>
    <p style="font-size:11px;color:{colors['text-secondary']};margin-top:16px;">Data sourced from HKEAA, JUPAS, and university admissions pages. Last updated: {_esc(generated)}.</p>
  </div>"""


# ---------------------------------------------------------------------------
# Action item builder (deterministic fallback)
# ---------------------------------------------------------------------------

def _build_action_items(student: dict, match_results: list) -> list[dict]:
    """Generate action items when AI doesn't provide them."""
    items: list[dict] = []
    current_year = datetime.now(timezone.utc).year

    grades = student.get("subject_grades") or []
    from app.modules.school_choice.services.hkdse_service import grade_to_int
    for grade in grades:
        raw = grade.get("raw_grade") or grade.get("predicted_grade") or ""
        subject_name = grade.get("subject_name") or grade.get("subject_code") or "Subject"
        if raw and grade_to_int(raw) < 4:
            items.append({
                "task": f"Improve {subject_name} to Grade 4 or above",
                "deadline": f"March {current_year + 1}",
                "related_school": "",
                "priority": "High",
            })

    items.append({"task": "Finalise JUPAS programme preference list", "deadline": f"December {current_year}", "related_school": "", "priority": "High"})
    items.append({"task": "Complete personal statement first draft", "deadline": f"November {current_year}", "related_school": "", "priority": "High"})
    items.append({"task": "Request reference letters from teachers", "deadline": f"October {current_year}", "related_school": "", "priority": "Medium"})
    items.append({"task": "Research application requirements for each target school", "deadline": f"September {current_year}", "related_school": "", "priority": "Medium"})

    return items


# ---------------------------------------------------------------------------
# High school plan (kept simple)
# ---------------------------------------------------------------------------

def _generate_high_school_plan(student: dict, match_results: list, template_id: str = "professional", overrides: dict | None = None) -> str:
    colors = TEMPLATES.get(template_id) or TEMPLATES["professional"]
    from app.modules.school_choice.services.hkdse_service import compute_best5_aggregate, grade_to_int

    grades = student.get("subject_grades") or []
    grade_dicts = [{
        "subject_code": g.get("subject_code") or "",
        "numeric_value": grade_to_int(g.get("raw_grade") or "U"),
        "is_compulsory": g.get("is_compulsory") or False,
        "category": g.get("category") or "ELECTIVE",
    } for g in grades]
    best5 = compute_best5_aggregate(grade_dicts)
    name = _esc(student.get("name") or "Student")
    generated_at = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

    css = _build_css(colors, template_id)

    # Simple subject analysis
    rows = ""
    for g in grades:
        subj = _esc(g.get("subject_name") or "")
        raw = g.get("raw_grade") or "U"
        num = grade_to_int(raw)
        bg = _grade_color(raw, colors)
        if num >= 5:
            action = "Maintain — excellent performance"
        elif num == 4:
            action = "Aim for Grade 5 in next sitting"
        else:
            action = "Focus area — seek additional support"
        rows += f'<tr><td>{subj}</td><td style="background:{bg};font-weight:600;">{_esc(raw)}</td><td>{action}</td></tr>'

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Academic Progress Report — {name}</title>
  <style>{css}</style>
</head>
<body>
  <div class="header">
    <div class="header-label">Academic Progress Report</div>
    <h1>{name}</h1>
    <div class="subtitle">Prepared {_esc(generated_at)}</div>
  </div>
  <div class="section">
    <h2>Subject Analysis</h2>
    <table class="data-table">
      <thead><tr><th>Subject</th><th>Grade</th><th>Action</th></tr></thead>
      <tbody>{rows}</tbody>
    </table>
  </div>
  <div class="footer">Generated by Intelligent Academic Advisor</div>
</body>
</html>"""


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
    ai_assessment: str | None = None,
    skill_gaps: list | None = None,
    counselor_notes: dict | None = None,
) -> str:
    """
    Generate a complete HTML plan document.

    The plan uses a dual-layer approach:
    - Student view (default): encouraging, action-oriented, no match percentages
    - Counselor view (toggle): adds match scores, Best-5, competitive positioning
    Counselor-only elements use class="counselor-only" and are hidden by default.
    The parent page toggles them via postMessage.
    """
    if overrides is None:
        overrides = {}

    if plan_type == "HIGH_SCHOOL":
        return _generate_high_school_plan(student, match_results, template_id=template_id, overrides=overrides)

    if not action_items:
        action_items = _build_action_items(student, match_results)

    colors = TEMPLATES.get(template_id) or TEMPLATES["professional"]

    from app.modules.school_choice.services.hkdse_service import compute_best5_aggregate, grade_to_int
    grades = student.get("subject_grades") or []
    grade_dicts = [{
        "subject_code": g.get("subject_code") or "",
        "numeric_value": grade_to_int(g.get("raw_grade") or "U"),
        "is_compulsory": g.get("is_compulsory") or False,
        "category": g.get("category") or "ELECTIVE",
    } for g in grades]
    best5 = compute_best5_aggregate(grade_dicts)

    name = _esc(student.get("name") or "Student")
    generated_at = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    num_schools = len([r for r in match_results if (
        r.get("eligibility_pass", True) if isinstance(r, dict) else getattr(r, "eligibility_pass", True)
    )])

    css = _build_css(colors, template_id)

    # Get rank 1 programme benchmark for radar chart
    rank1_median = None
    rank1_label = "Band A Target"
    try:
        from app.modules.school_choice.models.models import JupasProgramme as _JP
        from app.db.session import SessionLocal
        import json as _jj
        _bench_db = SessionLocal()
        # Find rank 1 from match results by checking student's targets
        for r in match_results:
            jupas = r.get("major_jupas_code") or r.get("jupas_code") if isinstance(r, dict) else getattr(r, "major_jupas_code", None)
            if jupas:
                prog = _bench_db.query(_JP).filter(_JP.jupas_code == jupas).first()
                if prog and prog.admission_stats:
                    stats = _jj.loads(prog.admission_stats) if isinstance(prog.admission_stats, str) else prog.admission_stats
                    if stats:
                        latest = stats.get(max(stats.keys()), {})
                        if "median" in latest:
                            rank1_median = float(latest["median"])
                            rank1_label = f"{jupas} — {prog.name}"
                            break
        _bench_db.close()
    except Exception:
        pass

    sections = "".join([
        _section_header(student, generated_at, best5),
        _section_metrics(student, best5, min(num_schools, 8), colors),
        _section_assessment(ai_assessment),
        _section_academic_profile(student, colors, benchmark_median=rank1_median, benchmark_label=rank1_label),
        _section_target_programmes(match_results, colors, overrides=overrides),
        _section_roadmap(action_items, colors),
        _section_growth_areas(student, skill_gaps, colors),
        _section_language(student, colors),
        _section_appendix(student, best5, match_results, colors),
    ])

    # PostMessage listener for counselor metrics toggle
    toggle_script = """
<script>
window.addEventListener('message', function(e) {
  if (e.data === 'toggle-counselor') {
    document.body.classList.toggle('show-counselor');
  } else if (e.data === 'show-counselor') {
    document.body.classList.add('show-counselor');
  } else if (e.data === 'hide-counselor') {
    document.body.classList.remove('show-counselor');
  }
});
</script>"""

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Application Strategy — {name}</title>
  <style>{css}</style>
</head>
<body>
  {sections}
  <div class="footer">
    Generated by Intelligent Academic Advisor &bull; {_esc(generated_at)}
  </div>
  {toggle_script}
</body>
</html>"""
