# i18n Completeness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire all 17 files with hardcoded strings to `useTranslation()`, add ~80 i18n keys to both `en.json` and `zh-HK.json`, install ESLint enforcement to prevent regression.

**Architecture:** Add translation keys to existing single-file i18n system. Each component imports `useTranslation` from `@schoolchoice/ui/i18n` and calls `t('key')`. UI primitives (Button, Modal, FileUpload) accept translated strings via props instead. ESLint plugin `i18next/no-literal-string` blocks future hardcoded strings at lint time.

**Tech Stack:** React, custom I18nProvider (`packages/ui/src/i18n`), `eslint-plugin-i18next`

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `packages/ui/src/i18n/en.json` | Modify | Add ~80 new English translation keys |
| `packages/ui/src/i18n/zh-HK.json` | Modify | Add ~80 matching Chinese translation keys |
| `apps/web/src/pages/SubjectDetail/SubjectDetail.jsx` | Modify | Wire `useTranslation`, replace ~20 strings |
| `apps/web/src/pages/MethodologyReport/MethodologyReport.jsx` | Modify | Wire `useTranslation`, replace ~10 strings |
| `apps/web/src/pages/StudentDetailPage/StudentDetailPage.jsx` | Modify | Wire `useTranslation`, replace ~15 strings |
| `apps/web/src/pages/Submissions/StudentSubmissions.jsx` | Modify | Wire `useTranslation`, replace 3 strings |
| `apps/web/src/pages/StudentProfile/PlansTab.jsx` | Modify | Replace 2 hardcoded strings with `t()` calls |
| `apps/web/src/components/SubmissionHistory/SubmissionHistory.jsx` | Modify | Wire `useTranslation`, replace ~10 strings including hardcoded Chinese |
| `apps/web/src/components/ValidationSummary/ValidationSummary.jsx` | Modify | Wire `useTranslation`, replace ~10 strings |
| `apps/web/src/components/ActionPlanDisplay/ActionPlanDisplay.jsx` | Modify | Wire `useTranslation`, replace 3 strings |
| `apps/web/src/components/RecommendationCard/RecommendationCard.jsx` | Modify | Wire `useTranslation`, replace 3 strings |
| `apps/web/src/components/EntityListView/EntityListView.jsx` | Modify | Wire `useTranslation`, replace 1 string |
| `apps/web/src/components/EntityForm/EntityForm.jsx` | Modify | Wire `useTranslation`, replace 3 strings |
| `apps/web/src/components/EntityForm/fieldComponents.jsx` | Modify | Wire `useTranslation`, replace 1 string |
| `apps/web/src/components/ShapSummary/ShapSummary.jsx` | Modify | Wire `useTranslation`, replace 3 strings |
| `packages/ui/src/components/FileUpload/FileUpload.jsx` | Modify | Accept `labels` prop for visible text |
| `packages/ui/src/components/Modal/Modal.jsx` | Modify | Accept `cancelLabel` prop |
| `packages/ui/src/components/Button/Button.jsx` | Modify | Accept `loadingLabel` prop |
| `apps/web/eslint.config.js` | Modify | Add `eslint-plugin-i18next` with `no-literal-string` rule |

---

### Task 1: Add all i18n keys to translation files

**Files:**
- Modify: `packages/ui/src/i18n/en.json`
- Modify: `packages/ui/src/i18n/zh-HK.json`

- [ ] **Step 1: Add new keys to `en.json`**

Add these key blocks at the end of `en.json` (before the closing `}`). Insert after the `"invite"` block:

```json
  "subjectDetail": {
    "backToAnalysis": "\u2190 Back to Data Analysis",
    "cohortFilter": "Cohort:",
    "allStudents": "All Students",
    "sittingFilter": "Sitting:",
    "all": "All",
    "sittingCount": "{count} sitting(s)",
    "noData": "No data available for this subject with the selected filters.",
    "sittingLabel": "{sitting} Sitting",
    "studentCount": "{count} student(s)",
    "mean": "Mean",
    "variance": "Variance",
    "gradeDistribution": "Grade Distribution",
    "gradeDistributionPct": "Grade Distribution (%)",
    "gradeRates": "Grade Rates (% achieving grade or above)",
    "populationData": "HK Population Data (HKDSE)",
    "candidates": "{count} candidates",
    "gradeFivePlus": "Grade 5+",
    "categoryCore": "Core",
    "categoryElective": "Elective",
    "categoryOtherLanguage": "Other Language",
    "categoryAppliedLearning": "Applied Learning",
    "meanModeN": "Mean: {mean} ({meanNum}) | Mode: {mode} | n={totalN}"
  },
  "methodology": {
    "title": "Methodology",
    "backToDashboard": "\u2190 Back to Dashboard",
    "loading": "Loading methodology report...",
    "dataCoverage": "Data Coverage",
    "jupasCount": "JUPAS Programmes",
    "institutionCount": "Institutions",
    "howItWorks": "How It Works",
    "dataSources": "Data Sources",
    "confidenceLevels": "Data Confidence Levels",
    "limitations": "Limitations",
    "loadFailed": "Failed to load methodology report."
  },
  "studentDetail": {
    "loading": "Loading\u2026",
    "notFound": "Student not found.",
    "noAccess": "You do not have access to this student record.",
    "loadFailed": "Could not load student data. Please try again.",
    "changesSaved": "Changes saved.",
    "profileIncompleteRecs": "The student profile is incomplete. Please ensure all required fields are filled in before generating recommendations.",
    "recsNotFound": "Student not found.",
    "recsFailed": "Could not generate recommendations. Please try again.",
    "actionPlanGenerated": "Action plan generated.",
    "profileIncompleteAction": "The student profile is incomplete. Please ensure all fields are filled in before generating an action plan.",
    "actionFailed": "Could not generate action plan. Please try again.",
    "backToStudents": "Back to Students",
    "name": "Name",
    "targetRegion": "Target Region",
    "local": "Local",
    "international": "International",
    "grades": "Grades",
    "noGrades": "No grades recorded",
    "interests": "Interests",
    "noInterests": "No interests recorded",
    "strengthsWeaknesses": "Strengths and Weaknesses",
    "notRecorded": "Not recorded",
    "editStudent": "Edit Student",
    "generating": "Generating...",
    "generateRecommendations": "Generate Recommendations",
    "generateActionPlan": "Generate Action Plan",
    "actionPlanTitle": "Action Plan",
    "saveChanges": "Save Changes"
  },
  "submissionHistory": {
    "title": "Submission History",
    "loading": "Loading history\u2026",
    "noSubmissions": "No submissions yet.",
    "submitted": "Submitted",
    "status": "Status",
    "choices": "Choices",
    "reviewed": "Reviewed",
    "notes": "Notes",
    "programmeCount": "{count} programme(s)",
    "choiceRank": "Choice {rank}",
    "andMore": "\u2026and {count} more",
    "choicesFlagged": "{count} choice(s) flagged",
    "draft": "Draft",
    "pendingReview": "Pending Review",
    "approved": "Approved",
    "revisionRequested": "Revision Requested",
    "rejected": "Rejected"
  },
  "validation": {
    "validCount": "{count} valid",
    "errorCount": "{count} error(s)",
    "warningCount": "{count} warning(s)",
    "rowsWithErrors": "Rows with errors",
    "rowNumber": "Row #",
    "field": "Field",
    "value": "Value",
    "reason": "Reason",
    "downloadErrors": "Download error rows as CSV",
    "downloading": "Downloading\u2026",
    "duplicateRows": "Duplicate rows ({count})",
    "applyToAll": "Apply this choice to all duplicates:",
    "skip": "Skip",
    "overwrite": "Overwrite existing",
    "importAsNew": "Import as new",
    "back": "Back",
    "importValid": "Import {count} Valid Row(s)",
    "importing": "Importing\u2026"
  },
  "actionPlan": {
    "title": "Action Plan",
    "academicTargets": "Academic Targets",
    "extracurricularDirection": "Extracurricular Direction",
    "preparationSteps": "Preparation Steps"
  },
  "recommendation": {
    "score": "Score: {score}",
    "whyMatches": "Why it matches",
    "gaps": "Gaps"
  },
  "entityForm": {
    "fieldRequired": "{field} is required.",
    "save": "Save",
    "saving": "Saving...",
    "cancel": "Cancel",
    "selectPlaceholder": "\u2014 Select \u2014"
  },
  "shap": {
    "admissionProbability": "Admission probability: {pct}",
    "pts": "pts",
    "meanModeN": "Mean: {mean}{meanNum} | Mode: {mode} | n={totalN}"
  },
  "fileUpload": {
    "uploading": "Uploading\u2026",
    "dragHere": "Drag file here or",
    "browse": "Browse"
  },
  "planEditor": {
    "editing": "Editing: {section}",
    "bold": "Bold",
    "italic": "Italic",
    "bulletList": "Bullet List",
    "list": "List",
    "cancel": "Cancel",
    "resetToDefault": "Reset to Default",
    "saving": "Saving\u2026",
    "save": "Save"
  }
```

- [ ] **Step 2: Add matching keys to `zh-HK.json`**

Add the same key blocks to `zh-HK.json` with Chinese translations:

```json
  "subjectDetail": {
    "backToAnalysis": "\u2190 返回數據分析",
    "cohortFilter": "群組：",
    "allStudents": "所有學生",
    "sittingFilter": "考試類別：",
    "all": "全部",
    "sittingCount": "{count} 個考試",
    "noData": "所選篩選條件下此科目沒有可用數據。",
    "sittingLabel": "{sitting} 考試",
    "studentCount": "{count} 位學生",
    "mean": "平均",
    "variance": "變異數",
    "gradeDistribution": "成績分佈",
    "gradeDistributionPct": "成績分佈（%）",
    "gradeRates": "等級比率（達到或以上）",
    "populationData": "全港 DSE 數據",
    "candidates": "{count} 位考生",
    "gradeFivePlus": "5 級或以上",
    "categoryCore": "核心科目",
    "categoryElective": "選修科目",
    "categoryOtherLanguage": "其他語言",
    "categoryAppliedLearning": "應用學習",
    "meanModeN": "平均：{mean}（{meanNum}）| 眾數：{mode} | n={totalN}"
  },
  "methodology": {
    "title": "方法",
    "backToDashboard": "\u2190 返回主頁",
    "loading": "載入方法報告中...",
    "dataCoverage": "數據覆蓋範圍",
    "jupasCount": "JUPAS 課程",
    "institutionCount": "院校數量",
    "howItWorks": "運作方式",
    "dataSources": "數據來源",
    "confidenceLevels": "數據信心等級",
    "limitations": "限制",
    "loadFailed": "載入方法報告失敗。"
  },
  "studentDetail": {
    "loading": "載入中\u2026",
    "notFound": "找不到學生。",
    "noAccess": "您沒有權限查看此學生記錄。",
    "loadFailed": "無法載入學生資料，請重試。",
    "changesSaved": "更改已儲存。",
    "profileIncompleteRecs": "學生檔案不完整。請確保所有必填欄位已填寫後再生成推薦。",
    "recsNotFound": "找不到學生。",
    "recsFailed": "無法生成推薦，請重試。",
    "actionPlanGenerated": "行動計劃已生成。",
    "profileIncompleteAction": "學生檔案不完整。請確保所有欄位已填寫後再生成行動計劃。",
    "actionFailed": "無法生成行動計劃，請重試。",
    "backToStudents": "返回學生列表",
    "name": "姓名",
    "targetRegion": "目標地區",
    "local": "本地",
    "international": "海外",
    "grades": "成績",
    "noGrades": "尚無成績記錄",
    "interests": "興趣",
    "noInterests": "尚無興趣記錄",
    "strengthsWeaknesses": "優勢與弱點",
    "notRecorded": "未記錄",
    "editStudent": "編輯學生",
    "generating": "生成中...",
    "generateRecommendations": "生成推薦",
    "generateActionPlan": "生成行動計劃",
    "actionPlanTitle": "行動計劃",
    "saveChanges": "儲存更改"
  },
  "submissionHistory": {
    "title": "提交歷史",
    "loading": "載入歷史中\u2026",
    "noSubmissions": "尚無提交記錄。",
    "submitted": "提交時間",
    "status": "狀態",
    "choices": "志願",
    "reviewed": "審核時間",
    "notes": "備註",
    "programmeCount": "{count} 個課程",
    "choiceRank": "志願 {rank}",
    "andMore": "\u2026及 {count} 個更多",
    "choicesFlagged": "{count} 個志願已標記",
    "draft": "草稿",
    "pendingReview": "待審核",
    "approved": "已批准",
    "revisionRequested": "已退回修改",
    "rejected": "已拒絕"
  },
  "validation": {
    "validCount": "{count} 個有效",
    "errorCount": "{count} 個錯誤",
    "warningCount": "{count} 個警告",
    "rowsWithErrors": "含錯誤的列",
    "rowNumber": "列 #",
    "field": "欄位",
    "value": "值",
    "reason": "原因",
    "downloadErrors": "下載錯誤列 CSV",
    "downloading": "下載中\u2026",
    "duplicateRows": "重複列（{count}）",
    "applyToAll": "將此選擇套用至所有重複項：",
    "skip": "略過",
    "overwrite": "覆蓋現有",
    "importAsNew": "作為新項匯入",
    "back": "返回",
    "importValid": "匯入 {count} 個有效列",
    "importing": "匯入中\u2026"
  },
  "actionPlan": {
    "title": "行動計劃",
    "academicTargets": "學業目標",
    "extracurricularDirection": "課外活動方向",
    "preparationSteps": "準備步驟"
  },
  "recommendation": {
    "score": "分數：{score}",
    "whyMatches": "匹配原因",
    "gaps": "差距"
  },
  "entityForm": {
    "fieldRequired": "{field} 為必填欄位。",
    "save": "儲存",
    "saving": "儲存中...",
    "cancel": "取消",
    "selectPlaceholder": "\u2014 請選擇 \u2014"
  },
  "shap": {
    "admissionProbability": "取錄機率：{pct}",
    "pts": "分",
    "meanModeN": "平均：{mean}{meanNum} | 眾數：{mode} | n={totalN}"
  },
  "fileUpload": {
    "uploading": "上載中\u2026",
    "dragHere": "拖曳檔案至此或",
    "browse": "瀏覽"
  },
  "planEditor": {
    "editing": "編輯：{section}",
    "bold": "粗體",
    "italic": "斜體",
    "bulletList": "項目列表",
    "list": "列表",
    "cancel": "取消",
    "resetToDefault": "重設為預設",
    "saving": "儲存中\u2026",
    "save": "儲存"
  }
```

- [ ] **Step 3: Verify key parity**

Run:
```bash
node -e "
const en = require('./packages/ui/src/i18n/en.json');
const zh = require('./packages/ui/src/i18n/zh-HK.json');
function flatKeys(obj, prefix='') {
  return Object.entries(obj).flatMap(([k,v]) => typeof v === 'object' ? flatKeys(v, prefix+k+'.') : [prefix+k]);
}
const enKeys = flatKeys(en).sort();
const zhKeys = flatKeys(zh).sort();
const missingInZh = enKeys.filter(k => !zhKeys.includes(k));
const missingInEn = zhKeys.filter(k => !enKeys.includes(k));
if (missingInZh.length) console.log('Missing in zh-HK:', missingInZh);
if (missingInEn.length) console.log('Missing in en:', missingInEn);
if (!missingInZh.length && !missingInEn.length) console.log('PASS: All', enKeys.length, 'keys match');
"
```
Expected: `PASS: All XXXX keys match`

- [ ] **Step 4: Commit**

```bash
git add packages/ui/src/i18n/en.json packages/ui/src/i18n/zh-HK.json
git commit -m "i18n: add ~80 translation keys for unlocalized components"
```

---

### Task 2: Wire SubmissionHistory (critical — hardcoded Chinese)

**Files:**
- Modify: `apps/web/src/components/SubmissionHistory/SubmissionHistory.jsx`

- [ ] **Step 1: Add useTranslation import and replace all hardcoded strings**

Replace the full file content. Key changes:
1. Import `useTranslation`
2. Replace `STATUS_STYLES` labels with `t()` calls
3. Replace table headers with `t()` calls
4. Replace hardcoded `志願` on line 78 with `t('submissionHistory.choiceRank', { rank: f.rank })`
5. Replace `formatDate` locale with locale-aware date formatting
6. Add empty state when `submissions.length === 0` instead of returning `null`

```jsx
// Submission history — shows all submissions for a student
// Used by both StudentDashboard (student view) and ProgrammeChoicesTab (teacher view)
import { useQuery } from '@tanstack/react-query';
import client from '@schoolchoice/ui/api/client';
import { useTranslation } from '@schoolchoice/ui/i18n';

function formatDate(iso, locale) {
  if (!iso) return '—';
  const d = new Date(iso);
  const dateLocale = locale === 'zh-HK' ? 'zh-HK' : 'en-GB';
  return d.toLocaleDateString(dateLocale, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function SubmissionHistory({ studentId, isStudent = false }) {
  const { t, locale } = useTranslation();

  const STATUS_KEYS = {
    draft: 'submissionHistory.draft',
    pending: 'submissionHistory.pendingReview',
    approved: 'submissionHistory.approved',
    revision_requested: 'submissionHistory.revisionRequested',
    rejected: 'submissionHistory.rejected',
  };

  const STATUS_COLORS = {
    draft: { bg: '#f1f5f9', color: '#475569' },
    pending: { bg: '#fef3c7', color: '#92400e' },
    approved: { bg: '#dcfce7', color: '#166534' },
    revision_requested: { bg: '#fee2e2', color: '#991b1b' },
    rejected: { bg: '#fee2e2', color: '#991b1b' },
  };

  const historyQuery = useQuery({
    queryKey: ['submission-history', studentId, isStudent],
    queryFn: async () => {
      if (isStudent) {
        const r = await client.get('/api/v1/student/choices/history');
        return r.data.submissions ?? [];
      } else {
        const r = await client.get(`/api/v1/submissions/student/${studentId}`);
        return r.data.submissions ?? [];
      }
    },
  });

  const submissions = historyQuery.data ?? [];

  if (historyQuery.isLoading) return <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', padding: 'var(--space-3)' }}>{t('submissionHistory.loading')}</div>;
  if (submissions.length === 0) return <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', padding: 'var(--space-4)', textAlign: 'center' }}>{t('submissionHistory.noSubmissions')}</div>;

  return (
    <div style={{ marginTop: 'var(--space-6)', background: 'var(--color-surface)', border: 'var(--border-width) solid var(--color-border)', borderRadius: 'var(--border-radius-md)', overflow: 'hidden' }}>
      <div style={{ padding: 'var(--space-3) var(--space-4)', borderBottom: 'var(--border-width) solid var(--color-border)', fontSize: 'var(--font-size-md)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-primary)' }}>
        {t('submissionHistory.title')}
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={thStyle}>{t('submissionHistory.submitted')}</th>
              <th style={thStyle}>{t('submissionHistory.status')}</th>
              <th style={thStyle}>{t('submissionHistory.choices')}</th>
              <th style={thStyle}>{t('submissionHistory.reviewed')}</th>
              <th style={thStyle}>{t('submissionHistory.notes')}</th>
            </tr>
          </thead>
          <tbody>
            {submissions.map((s) => {
              const statusKey = STATUS_KEYS[s.status] || STATUS_KEYS.draft;
              const colors = STATUS_COLORS[s.status] || STATUS_COLORS.draft;
              const choiceCount = Array.isArray(s.choices) ? s.choices.length : 0;
              return (
                <tr key={s.id}>
                  <td style={tdStyle}>{formatDate(s.submitted_at || s.created_at, locale)}</td>
                  <td style={tdStyle}>
                    <span style={{ fontSize: 'var(--font-size-xs)', padding: '2px 8px', borderRadius: '10px', fontWeight: 600, background: colors.bg, color: colors.color }}>
                      {t(statusKey)}
                    </span>
                  </td>
                  <td style={tdStyle}>{t('submissionHistory.programmeCount', { count: choiceCount })}</td>
                  <td style={tdStyle}>{formatDate(s.reviewed_at, locale)}</td>
                  <td style={{ ...tdStyle, maxWidth: '260px', fontSize: 'var(--font-size-xs)', color: s.counsellor_notes ? 'var(--color-text-primary)' : 'var(--color-text-secondary)' }}>
                    {s.counsellor_notes || '—'}
                    {s.flagged_choices && s.flagged_choices.length > 0 && (
                      <div style={{ marginTop: '4px', color: '#dc2626', fontSize: 'var(--font-size-xs)' }}>
                        {'\u2691'} {t('submissionHistory.choicesFlagged', { count: s.flagged_choices.length })}
                        {s.flagged_choices.slice(0, 3).map((f) => (
                          <div key={f.rank} style={{ marginLeft: '8px', fontStyle: 'italic' }}>
                            {t('submissionHistory.choiceRank', { rank: f.rank })}{f.note ? `: ${f.note}` : ''}
                          </div>
                        ))}
                        {s.flagged_choices.length > 3 && (
                          <div style={{ marginLeft: '8px', fontStyle: 'italic' }}>{t('submissionHistory.andMore', { count: s.flagged_choices.length - 3 })}</div>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const thStyle = {
  padding: 'var(--space-2) var(--space-3)', textAlign: 'left',
  fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-medium)',
  color: 'var(--color-text-secondary)', borderBottom: '2px solid var(--color-border)',
  whiteSpace: 'nowrap',
};
const tdStyle = {
  padding: 'var(--space-2) var(--space-3)', fontSize: 'var(--font-size-sm)',
  color: 'var(--color-text-primary)', borderBottom: 'var(--border-width) solid var(--color-border)',
  verticalAlign: 'middle',
};
```

- [ ] **Step 2: Verify no hardcoded Chinese remains**

Run:
```bash
grep -n '志願' apps/web/src/components/SubmissionHistory/SubmissionHistory.jsx
```
Expected: no output

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/SubmissionHistory/SubmissionHistory.jsx
git commit -m "i18n: wire SubmissionHistory — remove hardcoded Chinese, add empty state"
```

---

### Task 3: Wire StudentSubmissions page

**Files:**
- Modify: `apps/web/src/pages/Submissions/StudentSubmissions.jsx`

- [ ] **Step 1: Replace full file with i18n-wired version**

```jsx
// Student's own submission history page
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import NavBarV2 from '../../components/NavBarV2/NavBarV2';
import { LoadingSpinner } from '@schoolchoice/ui';
import { getAccount } from '@schoolchoice/ui/api/account';
import { useTranslation } from '@schoolchoice/ui/i18n';
import SubmissionHistory from '../../components/SubmissionHistory/SubmissionHistory';

export default function StudentSubmissions() {
  const { t } = useTranslation();
  const accountQuery = useQuery({ queryKey: ['account'], queryFn: getAccount });
  const account = accountQuery.data;

  if (accountQuery.isLoading) {
    return <div style={{ background: 'var(--color-background)', minHeight: '100vh' }}><LoadingSpinner label={t('common.loading')} /></div>;
  }

  return (
    <div style={{ background: 'var(--color-background)', minHeight: '100vh', fontFamily: 'var(--font-family-base)' }}>
      <NavBarV2 account={account} />
      <div style={{ maxWidth: '100%', margin: '0 auto', padding: 'var(--space-6) var(--space-8)' }}>
        <Link to="/dashboard" style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-primary)', textDecoration: 'none', display: 'inline-block', marginBottom: 'var(--space-4)' }}>
          {t('methodology.backToDashboard')}
        </Link>
        <h1 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text-primary)', margin: '0 0 var(--space-4) 0' }}>
          {t('nav.mySubmissions')}
        </h1>
        <SubmissionHistory studentId={account?.student_id} isStudent={true} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/pages/Submissions/StudentSubmissions.jsx
git commit -m "i18n: wire StudentSubmissions page"
```

---

### Task 4: Wire PlansTab (2 remaining hardcoded strings)

**Files:**
- Modify: `apps/web/src/pages/StudentProfile/PlansTab.jsx`

- [ ] **Step 1: Replace the 2 hardcoded strings**

Line 53 — replace `"Loading plan history…"` with `t('plans.loadingHistory')`:
```jsx
  if (loading) return <LoadingSpinner label={t('plans.loadingHistory')} />;
```

Line 109 — replace `"Plan content was not stored for this entry."` with `t('plans.noContentStored')`:
```jsx
            <EmptyState message={t('plans.noContentStored')} />
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/pages/StudentProfile/PlansTab.jsx
git commit -m "i18n: replace 2 hardcoded strings in PlansTab"
```

---

### Task 5: Wire ActionPlanDisplay

**Files:**
- Modify: `apps/web/src/components/ActionPlanDisplay/ActionPlanDisplay.jsx`

- [ ] **Step 1: Add useTranslation and replace 3 section labels**

```jsx
import { useTranslation } from '@schoolchoice/ui/i18n';

function ActionPlanDisplay({ actionPlan }) {
  const { academic_targets, extracurricular_direction, preparation_steps } = actionPlan;
  const { t } = useTranslation();

  const containerStyle = {
    background: 'var(--color-surface)',
    border: 'var(--border-width) solid var(--color-border)',
    borderRadius: 'var(--border-radius-md)',
    padding: 'var(--space-6)',
  };

  const sectionStyle = {
    marginBottom: 'var(--space-6)',
  };

  const labelStyle = {
    display: 'block',
    fontSize: 'var(--font-size-sm)',
    fontWeight: 'var(--font-weight-medium)',
    color: 'var(--color-text-secondary)',
    textTransform: 'uppercase',
    marginBottom: 'var(--space-2)',
  };

  const contentStyle = {
    fontSize: 'var(--font-size-md)',
    color: 'var(--color-text-primary)',
    lineHeight: 'var(--line-height-normal)',
    margin: 0,
  };

  return (
    <div style={containerStyle} role="region" aria-label={t('actionPlan.title')}>
      <div style={sectionStyle}>
        <span style={labelStyle}>{t('actionPlan.academicTargets')}</span>
        <p style={contentStyle}>{academic_targets}</p>
      </div>
      <div style={sectionStyle}>
        <span style={labelStyle}>{t('actionPlan.extracurricularDirection')}</span>
        <p style={contentStyle}>{extracurricular_direction}</p>
      </div>
      <div style={{ ...sectionStyle, marginBottom: 0 }}>
        <span style={labelStyle}>{t('actionPlan.preparationSteps')}</span>
        <p style={contentStyle}>{preparation_steps}</p>
      </div>
    </div>
  );
}

export default ActionPlanDisplay;
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/ActionPlanDisplay/ActionPlanDisplay.jsx
git commit -m "i18n: wire ActionPlanDisplay — 3 section labels"
```

---

### Task 6: Wire RecommendationCard

**Files:**
- Modify: `apps/web/src/components/RecommendationCard/RecommendationCard.jsx`

- [ ] **Step 1: Add useTranslation and replace 3 labels**

Replace line 1 onwards:

```jsx
import { useTranslation } from '@schoolchoice/ui/i18n';

function RecommendationCard({ recommendation }) {
  const { rank, school_name, score, explanation, gaps } = recommendation;
  const { t } = useTranslation();
```

Replace line 77:
```jsx
        <span style={scoreStyle}>{t('recommendation.score', { score: scorePercent })}</span>
```

Replace line 81:
```jsx
        <span style={sectionLabelStyle}>{t('recommendation.whyMatches')}</span>
```

Replace line 85:
```jsx
        <span style={sectionLabelStyle}>{t('recommendation.gaps')}</span>
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/RecommendationCard/RecommendationCard.jsx
git commit -m "i18n: wire RecommendationCard — 3 labels"
```

---

### Task 7: Wire EntityForm, EntityListView, fieldComponents

**Files:**
- Modify: `apps/web/src/components/EntityForm/EntityForm.jsx`
- Modify: `apps/web/src/components/EntityListView/EntityListView.jsx`
- Modify: `apps/web/src/components/EntityForm/fieldComponents.jsx`

- [ ] **Step 1: Wire EntityForm**

Add import and replace hardcoded strings:

```jsx
import { useState } from 'react';
import { FIELD_COMPONENT_MAP } from './fieldComponents.jsx';
import { Button } from '@schoolchoice/ui';
import { useTranslation } from '@schoolchoice/ui/i18n';
```

In the component body, add `const { t } = useTranslation();`

Replace line 24 validation message:
```jsx
        newErrors[field.name] = t('entityForm.fieldRequired', { field: field.name });
```

Replace line 71 button labels:
```jsx
        <Button label={saving ? t('entityForm.saving') : t('entityForm.save')} variant="primary" type="submit" disabled={saving} />
        {onCancel && <Button label={t('entityForm.cancel')} variant="secondary" onClick={onCancel} disabled={saving} />}
```

- [ ] **Step 2: Wire EntityListView**

Add import:
```jsx
import { EmptyState } from '@schoolchoice/ui';
import { useTranslation } from '@schoolchoice/ui/i18n';
```

In component body add `const { t } = useTranslation();`

Replace line 37:
```jsx
    return <EmptyState message={t('entityList.noResults')} />;
```

- [ ] **Step 3: Wire fieldComponents**

Add import at top:
```jsx
import { useTranslation } from '@schoolchoice/ui/i18n';
```

The `enum` component needs `useTranslation` but it's a plain function, not a React component with hooks. Wrap it:

Replace the enum entry (lines 65-77):
```jsx
  enum: function EnumField({ field, value, onChange, inputStyle }) {
    const { t } = useTranslation();
    return (
      <select
        id={field.name}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        style={inputStyle}
      >
        <option value="">{t('entityForm.selectPlaceholder')}</option>
        {field.choices?.map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>
    );
  },
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/EntityForm/EntityForm.jsx apps/web/src/components/EntityListView/EntityListView.jsx apps/web/src/components/EntityForm/fieldComponents.jsx
git commit -m "i18n: wire EntityForm, EntityListView, fieldComponents"
```

---

### Task 8: Wire UI primitives (Button, Modal, FileUpload)

**Files:**
- Modify: `packages/ui/src/components/Button/Button.jsx`
- Modify: `packages/ui/src/components/Modal/Modal.jsx`
- Modify: `packages/ui/src/components/FileUpload/FileUpload.jsx`

- [ ] **Step 1: Button — accept `loadingLabel` prop**

Replace line 1:
```jsx
function Button({ label, onClick, variant = 'primary', disabled = false, loading = false, type = 'button', loadingLabel = 'Loading\u2026' }) {
```

Replace line 46:
```jsx
      {loading ? loadingLabel : label}
```

- [ ] **Step 2: Modal — accept `cancelLabel` prop**

Replace line 7:
```jsx
function Modal({
  isOpen,
  title,
  children,
  onClose,
  onConfirm,
  confirmLabel = 'Confirm',
  confirmVariant = 'primary',
  cancelLabel = 'Cancel',
}) {
```

Replace line 153:
```jsx
          <Button label={cancelLabel} onClick={onClose} variant="secondary" />
```

- [ ] **Step 3: FileUpload — accept `labels` prop**

Replace line 4:
```jsx
function FileUpload({ onFile, accept = '*', loading = false, progress = null, labels = {} }) {
  const uploadingText = labels.uploading || 'Uploading\u2026';
  const dragText = labels.dragHere || 'Drag file here or';
  const browseText = labels.browse || 'Browse';
```

Replace lines 89-93:
```jsx
          {loading
            ? uploadingText
            : selectedFile
            ? selectedFile.name
            : dragText}
```

Replace line 113:
```jsx
            {browseText}
```

- [ ] **Step 4: Commit**

```bash
git add packages/ui/src/components/Button/Button.jsx packages/ui/src/components/Modal/Modal.jsx packages/ui/src/components/FileUpload/FileUpload.jsx
git commit -m "i18n: add translated label props to Button, Modal, FileUpload"
```

---

### Task 8.5: Wire PlanSectionEditor

**Files:**
- Modify: `apps/web/src/components/PlanSectionEditor/PlanSectionEditor.jsx`

- [ ] **Step 1: Add useTranslation and replace all hardcoded strings**

Add import after line 4:
```jsx
import { useTranslation } from '@schoolchoice/ui/i18n';
```

In component body (after `const editor = useEditor(...)`), add:
```jsx
  const { t } = useTranslation();
```

Replace line 59:
```jsx
        {t('planEditor.editing', { section: sectionKey })}
```
(Remove the `<strong>` tag — just use plain text with the section key.)

Replace line 68 title:
```jsx
          title={t('planEditor.bold')}
```

Replace line 76 title:
```jsx
          title={t('planEditor.italic')}
```

Replace line 84 title:
```jsx
          title={t('planEditor.bulletList')}
```

Replace line 86 button text:
```jsx
          &#8226; {t('planEditor.list')}
```

Replace line 112:
```jsx
          {t('planEditor.cancel')}
```

Replace line 129:
```jsx
          {t('planEditor.resetToDefault')}
```

Replace line 147:
```jsx
          {saving ? t('planEditor.saving') : t('planEditor.save')}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/PlanSectionEditor/PlanSectionEditor.jsx
git commit -m "i18n: wire PlanSectionEditor — toolbar and action button labels"
```

---

### Task 9: Wire SubjectDetail page

**Files:**
- Modify: `apps/web/src/pages/SubjectDetail/SubjectDetail.jsx`

- [ ] **Step 1: Add useTranslation import**

After line 3, add:
```jsx
import { useTranslation } from '@schoolchoice/ui/i18n';
```

- [ ] **Step 2: Replace CATEGORY_LABELS constant with t() calls**

Remove line 12 (`const CATEGORY_LABELS = ...`).

In the component body (after `const [populationData, setPopulationData] = useState(null);`), add:
```jsx
  const { t } = useTranslation();
  const CATEGORY_LABELS = {
    CORE: t('subjectDetail.categoryCore'),
    ELECTIVE: t('subjectDetail.categoryElective'),
    OTHER_LANGUAGE: t('subjectDetail.categoryOtherLanguage'),
    APPLIED_LEARNING: t('subjectDetail.categoryAppliedLearning'),
  };
```

- [ ] **Step 3: Replace all hardcoded strings in JSX**

Line 155 (stats summary in VerticalBarChart) — replace with:
```jsx
          {t('subjectDetail.meanModeN', { mean: stats.mean, meanNum: stats.meanNum || '', mode: stats.mode, totalN: stats.totalN })}
```

Line 257 (back button):
```jsx
          {t('subjectDetail.backToAnalysis')}
```

Line 280 (cohort label):
```jsx
            <label style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>{t('subjectDetail.cohortFilter')}</label>
```

Line 282 (all students option):
```jsx
              <option value="">{t('subjectDetail.allStudents')}</option>
```

Line 287 (sitting label):
```jsx
            <label style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>{t('subjectDetail.sittingFilter')}</label>
```

Lines 289-292 (sitting options):
```jsx
              <option value="">{t('subjectDetail.all')}</option>
              <option value="MOCK">{t('common.mock')}</option>
              <option value="TRIAL">{t('common.trial')}</option>
              <option value="OFFICIAL">{t('common.official')}</option>
```

Line 296 (sitting count):
```jsx
            {t('subjectDetail.sittingCount', { count: filteredSittings.length })}
```

Line 300 (loading):
```jsx
        {loading && <LoadingSpinner label={t('common.loading')} />}
```

Line 305 (empty state):
```jsx
            {t('subjectDetail.noData')}
```

Line 315 (sitting heading):
```jsx
                  {t('subjectDetail.sittingLabel', { sitting: row.sitting })}
```

Line 318 (student count):
```jsx
                  {t('subjectDetail.studentCount', { count: row.count })}
```

Lines 325-328 (stats pills) — replace the array with:
```jsx
                  { label: t('subjectDetail.mean'), value: `${numericToGrade(row.mean)} (${row.mean.toFixed(2)})` },
                  { label: t('subjectDetail.variance'), value: row.variance.toFixed(2) },
                  { label: 'n=', value: String(row.count) },
                  ...(row.grade_rates?.['5'] != null ? [{ label: t('subjectDetail.gradeFivePlus'), value: `${row.grade_rates['5']}%` }] : []),
```

Line 341 (chart title):
```jsx
                  title={t('subjectDetail.gradeDistribution')}
```

Line 349 (grade rates heading):
```jsx
                {t('subjectDetail.gradeRates')}
```

Line 359 (population heading):
```jsx
              {t('subjectDetail.populationData')}
```

Line 370 (candidates count):
```jsx
                      {sitting.total_candidates != null ? t('subjectDetail.candidates', { count: sitting.total_candidates.toLocaleString() }) : ''}
```

Line 391 (chart title):
```jsx
                      title={t('subjectDetail.gradeDistributionPct')}
```

Note: The `VerticalBarChart` component is defined inside the same file. The stats summary line at 155 uses module-scope — since `t` is only available inside `SubjectDetail`, pass `t` as a prop to `VerticalBarChart` or move the stats text rendering to a callback.

Simplest fix: pass `statsLabel` as a prop:

In `VerticalBarChart`, change the stats line to accept a `statsLabel` prop:
```jsx
function VerticalBarChart({ distribution, title, mean, mode, totalN, statsLabel }) {
```

Replace line 155:
```jsx
        <div style={{ marginTop: '12px', fontSize: '12px', color: '#9ca3af' }}>
          {statsLabel}
        </div>
```

In `SubjectDetail` where `VerticalBarChart` is called (lines 339-345 and 389-395), add the `statsLabel` prop:
```jsx
                <VerticalBarChart
                  distribution={row.grade_distribution}
                  title={t('subjectDetail.gradeDistribution')}
                  mean={chartStats?.mean}
                  mode={chartStats?.mode}
                  totalN={chartStats?.totalN}
                  statsLabel={chartStats?.totalN > 0 ? t('subjectDetail.meanModeN', { mean: chartStats.mean, meanNum: chartStats.meanNum ? ` (${chartStats.meanNum})` : '', mode: chartStats.mode, totalN: chartStats.totalN }) : null}
                />
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/pages/SubjectDetail/SubjectDetail.jsx
git commit -m "i18n: wire SubjectDetail — ~20 strings including category labels and stats"
```

---

### Task 10: Wire MethodologyReport page

**Files:**
- Modify: `apps/web/src/pages/MethodologyReport/MethodologyReport.jsx`

- [ ] **Step 1: Add useTranslation and replace hardcoded strings**

Add import after line 3:
```jsx
import { useTranslation } from '@schoolchoice/ui/i18n';
```

In component body (after state declarations), add:
```jsx
  const { t } = useTranslation();
```

Replace line 23 error fallback:
```jsx
        setError(err?.response?.data?.detail || t('methodology.loadFailed'));
```

Replace line 208:
```jsx
      <Link to="/dashboard" style={backLinkStyle}>{t('methodology.backToDashboard')}</Link>
```

Replace line 210:
```jsx
      {loading && <LoadingSpinner label={t('methodology.loading')} />}
```

Replace line 214:
```jsx
          <Link to="/dashboard" style={{ color: 'var(--color-primary)', fontSize: 'var(--font-size-sm)' }}>{t('methodology.backToDashboard')}</Link>
```

Replace line 229:
```jsx
              <h2 style={sectionHeadingStyle}>{t('methodology.dataCoverage')}</h2>
```

Replace line 233:
```jsx
                  <div style={statLabelStyle}>{t('methodology.jupasCount')}</div>
```

Replace line 237:
```jsx
                  <div style={statLabelStyle}>{t('methodology.institutionCount')}</div>
```

Replace line 247:
```jsx
              <h2 style={sectionHeadingStyle}>{t('methodology.howItWorks')}</h2>
```

Replace line 263:
```jsx
              <h2 style={sectionHeadingStyle}>{t('methodology.dataSources')}</h2>
```

Replace line 285:
```jsx
              <h2 style={sectionHeadingStyle}>{t('methodology.confidenceLevels')}</h2>
```

Replace line 298:
```jsx
              <h2 style={sectionHeadingStyle}>{t('methodology.limitations')}</h2>
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/pages/MethodologyReport/MethodologyReport.jsx
git commit -m "i18n: wire MethodologyReport — section headings and labels"
```

---

### Task 11: Wire StudentDetailPage

**Files:**
- Modify: `apps/web/src/pages/StudentDetailPage/StudentDetailPage.jsx`

- [ ] **Step 1: Add useTranslation import**

Replace line 4 (add after existing imports):
```jsx
import { useTranslation } from '@schoolchoice/ui/i18n';
```

- [ ] **Step 2: Add t() in component body and replace all hardcoded strings**

After `const anyLoading = ...` line, add:
```jsx
  const { t } = useTranslation();
```

Replace all hardcoded strings:

Line 45: `setStudentError(t('studentDetail.notFound'));`
Line 46: `setStudentError(t('studentDetail.noAccess'));`
Line 47: `setStudentError(t('studentDetail.loadFailed'));`
Line 72: `setSuccessMessage(t('studentDetail.changesSaved'));`
Line 91: `setActionError(t('studentDetail.profileIncompleteRecs'));`
Line 93: `setActionError(t('studentDetail.recsNotFound'));`
Line 95: `setActionError(t('studentDetail.recsFailed'));`
Line 108: `setActionPlanSuccess(t('studentDetail.actionPlanGenerated'));`
Line 113: `setActionError(t('studentDetail.profileIncompleteAction'));`
Line 115: `setActionError(t('studentDetail.actionFailed'));`
Line 213: `<LoadingSpinner label={t('studentDetail.loading')} />`
Line 225: `<Link to="/students" style={backLinkStyle}>{t('studentDetail.backToStudents')}</Link>`
Line 235: `<Link to="/students" style={backLinkStyle}>{t('studentDetail.backToStudents')}</Link>`
Line 247: `submitLabel={t('studentDetail.saveChanges')}`
Line 254: `<span style={labelStyle}>{t('studentDetail.name')}</span>`
Line 258: `<span style={labelStyle}>{t('studentDetail.targetRegion')}</span>`
Line 260: `{student.target_region === 'local' ? t('studentDetail.local') : t('studentDetail.international')}`
Line 264: `<span style={labelStyle}>{t('studentDetail.grades')}</span>`
Line 270: `<span style={{ color: 'var(--color-text-secondary)' }}>{t('studentDetail.noGrades')}</span>`
Line 275: `<span style={labelStyle}>{t('studentDetail.interests')}</span>`
Line 281: `<span style={{ color: 'var(--color-text-secondary)' }}>{t('studentDetail.noInterests')}</span>`
Line 286: `<span style={labelStyle}>{t('studentDetail.strengthsWeaknesses')}</span>`
Line 288: `<span style={{ color: 'var(--color-text-secondary)' }}>{t('studentDetail.notRecorded')}</span>`
Line 297: `{t('studentDetail.editStudent')}`
Line 300: `{genLoading ? t('studentDetail.generating') : t('studentDetail.generateRecommendations')}`
Line 303: `{actionPlanLoading ? t('studentDetail.generating') : t('studentDetail.generateActionPlan')}`
Line 310: `<h2 style={sectionHeadingStyle}>{t('studentDetail.actionPlanTitle')}</h2>`

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/pages/StudentDetailPage/StudentDetailPage.jsx
git commit -m "i18n: wire StudentDetailPage — ~15 strings"
```

---

### Task 12: Wire ValidationSummary and ShapSummary

**Files:**
- Modify: `apps/web/src/components/ValidationSummary/ValidationSummary.jsx`
- Modify: `apps/web/src/components/ShapSummary/ShapSummary.jsx`

- [ ] **Step 1: Wire ValidationSummary**

Add import:
```jsx
import { useTranslation } from '@schoolchoice/ui/i18n';
```

In component body add `const { t } = useTranslation();`

Replace hardcoded strings:

Line 116: `{t('validation.validCount', { count: validCount })}`
Line 120: `{t('validation.errorCount', { count: errorCount })}`
Line 125: `{t('validation.warningCount', { count: warningCount })}`
Line 133: replace `"Rows with errors"` with `{t('validation.rowsWithErrors')}`
Line 138: replace `"Row #"` with `{t('validation.rowNumber')}`
Line 139: replace `"Field"` with `{t('validation.field')}`
Line 140: replace `"Value"` with `{t('validation.value')}`
Line 141: replace `"Reason"` with `{t('validation.reason')}`
Line 171: replace `{isDownloading ? 'Downloading…' : 'Download error rows as CSV'}` with `{isDownloading ? t('validation.downloading') : t('validation.downloadErrors')}`
Line 179: replace `"Duplicate rows ({duplicateRows.length})"` with `{t('validation.duplicateRows', { count: duplicateRows.length })}`
Line 187: replace `"Apply this choice to all duplicates:"` with `{t('validation.applyToAll')}`
Lines 72-75 (DUPLICATE_OPTIONS): replace labels with `t()` — but these are outside the component. Move inside or create a function:

Replace lines 71-75 with: remove `DUPLICATE_OPTIONS` constant. Inside the component body, define:
```jsx
  const DUPLICATE_OPTIONS = [
    { value: 'skip', label: t('validation.skip') },
    { value: 'overwrite', label: t('validation.overwrite') },
    { value: 'new', label: t('validation.importAsNew') },
  ];
```

Line 244: replace `"Back"` with `{t('validation.back')}`
Line 251: replace the template string with `{isCommitting ? t('validation.importing') : t('validation.importValid', { count: validCount })}`

- [ ] **Step 2: Wire ShapSummary**

Add import after line 1:
```jsx
import { useTranslation } from '@schoolchoice/ui/i18n';
```

In component body add `const { t } = useTranslation();`

Line 66 — replace admission probability label:
```jsx
      return { isProbability: true, label: t('shap.admissionProbability', { pct }) };
```

Line 75 — replace `pts`:
```jsx
        ? ` = ${feature.weighted_pts.toFixed(2)}${t('shap.pts')}`
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/ValidationSummary/ValidationSummary.jsx apps/web/src/components/ShapSummary/ShapSummary.jsx
git commit -m "i18n: wire ValidationSummary and ShapSummary"
```

---

### Task 13: Install ESLint enforcement

**Files:**
- Modify: `apps/web/eslint.config.js`

- [ ] **Step 1: Install the plugin**

```bash
cd /Users/bsg/Downloads/schoolchoice && pnpm add -D eslint-plugin-i18next --filter apps/web
```

- [ ] **Step 2: Update ESLint config**

Replace `apps/web/eslint.config.js`:

```js
import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import i18next from 'eslint-plugin-i18next'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    plugins: {
      i18next,
    },
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
      'i18next/no-literal-string': ['error', {
        mode: 'jsx-text-only',
        'should-validate-template': true,
        ignoreCallee: ['console.*', 'Error'],
        ignoreAttribute: [
          'aria-label', 'aria-labelledby', 'aria-describedby',
          'data-*', 'className', 'style', 'key', 'role', 'type',
          'name', 'htmlFor', 'id', 'src', 'href', 'alt', 'title',
          'tabIndex', 'placeholder', 'accept', 'sandbox',
        ],
      }],
    },
  },
  {
    files: ['**/*.test.*', '**/*.config.*', 'vite.config.*'],
    rules: {
      'i18next/no-literal-string': 'off',
    },
  },
])
```

- [ ] **Step 3: Run lint to verify no violations**

```bash
cd /Users/bsg/Downloads/schoolchoice && pnpm --filter apps/web lint 2>&1 | head -50
```

Expected: no `i18next/no-literal-string` errors (all hardcoded strings should be fixed by prior tasks). If violations remain, fix them before proceeding.

- [ ] **Step 4: Commit**

```bash
git add apps/web/eslint.config.js apps/web/package.json pnpm-lock.yaml
git commit -m "i18n: add eslint-plugin-i18next with no-literal-string enforcement"
```

---

### Task 14: Verify i18n — locale switch test

- [ ] **Step 1: Start the dev server**

```bash
cd /Users/bsg/Downloads/schoolchoice && pnpm --filter apps/web dev &
```

Wait for "ready" message.

- [ ] **Step 2: Run key parity check**

```bash
node -e "
const en = require('./packages/ui/src/i18n/en.json');
const zh = require('./packages/ui/src/i18n/zh-HK.json');
function flatKeys(obj, prefix='') {
  return Object.entries(obj).flatMap(([k,v]) => typeof v === 'object' ? flatKeys(v, prefix+k+'.') : [prefix+k]);
}
const enKeys = flatKeys(en).sort();
const zhKeys = flatKeys(zh).sort();
const missingInZh = enKeys.filter(k => !zhKeys.includes(k));
const missingInEn = zhKeys.filter(k => !enKeys.includes(k));
if (missingInZh.length) console.log('Missing in zh-HK:', missingInZh);
if (missingInEn.length) console.log('Missing in en:', missingInEn);
if (!missingInZh.length && !missingInEn.length) console.log('PASS: All', enKeys.length, 'keys match');
"
```

Expected: PASS

- [ ] **Step 3: Verify no hardcoded English or Chinese in source**

```bash
grep -rn '志願' apps/web/src/ --include='*.jsx' | grep -v node_modules
```
Expected: no output

```bash
grep -rn ">'[A-Z][a-z]" apps/web/src/pages/SubjectDetail/ apps/web/src/pages/MethodologyReport/ apps/web/src/pages/StudentDetailPage/ apps/web/src/pages/Submissions/StudentSubmissions.jsx apps/web/src/components/SubmissionHistory/ apps/web/src/components/ActionPlanDisplay/ apps/web/src/components/RecommendationCard/ apps/web/src/components/ValidationSummary/ apps/web/src/components/EntityForm/ apps/web/src/components/EntityListView/ --include='*.jsx' | grep -v "aria-" | grep -v "console" | grep -v "//"
```
Expected: no output (or only technical strings like grade labels)

- [ ] **Step 4: Write headed Playwright test for locale switch**

Create `apps/web/e2e/verify-i18n.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';

test('locale switch shows Chinese on all previously-hardcoded pages', async ({ page }) => {
  // Login as admin
  await page.goto('http://localhost:5173/login');
  await page.fill('input[type="email"]', 'verify@test.com');
  await page.fill('input[type="password"]', 'verify123');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard');

  // Switch to Chinese via account settings
  await page.goto('http://localhost:5173/account');
  await page.waitForLoadState('networkidle');
  const langSelect = page.locator('select').filter({ hasText: /English|中文/ });
  await langSelect.selectOption('zh-HK');
  await page.click('button:has-text("Save"), button:has-text("儲存")');
  await page.waitForTimeout(500);

  // Check SubjectDetail — navigate to data analysis first
  await page.goto('http://localhost:5173/data-analysis');
  await page.waitForLoadState('networkidle');
  // Verify Chinese heading visible
  const dataTitle = await page.textContent('h1');
  expect(dataTitle).toContain('數據分析');

  // Check Dashboard
  await page.goto('http://localhost:5173/dashboard');
  await page.waitForLoadState('networkidle');
  const dashTitle = await page.locator('text=學生總數').first();
  await expect(dashTitle).toBeVisible();

  // Verify no English leaks on dashboard (except proper nouns)
  const bodyText = await page.textContent('body');
  expect(bodyText).not.toContain('Total Students');
  expect(bodyText).not.toContain('Plans Generated');

  // Reset to English
  await page.goto('http://localhost:5173/account');
  await page.waitForLoadState('networkidle');
  const langSelect2 = page.locator('select').filter({ hasText: /English|中文/ });
  await langSelect2.selectOption('en');
  await page.click('button:has-text("Save"), button:has-text("儲存")');
});
```

Run:
```bash
npx playwright test apps/web/e2e/verify-i18n.spec.ts --headed
```

Expected: PASS
