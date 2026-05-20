import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Flag } from 'lucide-react';
import NavBarV2 from '../../components/NavBarV2/NavBarV2';
import { LoadingSpinner } from '@schoolchoice/ui';
import { ErrorMessage } from '@schoolchoice/ui';
import { Modal } from '@schoolchoice/ui';
import { Button } from '@schoolchoice/ui/primitives/button';
import { getAccount } from '@schoolchoice/ui/api/account';
import { useTranslation } from '@schoolchoice/ui/i18n';
import { useFeatureAccess } from '../../hooks/usePermission';
import { getSubmission, approveSubmission, reviseSubmission, rejectSubmission } from '../../api/submissions';

function useBands() {
  const { t } = useTranslation();
  return [
    { id: 'A', slots: [1, 2, 3], bg: '#fff1f2', border: '#fecdd3', fg: '#be123c', tip: t('submissions.topPicks') },
    { id: 'B', slots: [4, 5, 6], bg: '#fef9c3', border: '#fde68a', fg: '#a16207', tip: t('submissions.strongInterest') },
    { id: 'C', slots: [7, 8, 9, 10], bg: '#d1fae5', border: '#a7f3d0', fg: '#047857', tip: t('submissions.interestedReasonable') },
    { id: 'D', slots: [11, 12, 13, 14], bg: '#dbeafe', border: '#bfdbfe', fg: '#1d4ed8', tip: t('submissions.backupChoices') },
    { id: 'E', slots: [15, 16, 17, 18, 19, 20], bg: '#f1f5f9', border: '#e2e8f0', fg: '#475569', tip: t('submissions.safetyNet') },
  ];
}

function SubmissionDetail() {
  const { t } = useTranslation();
  const { canEdit: canEditSubmissions } = useFeatureAccess('submissions');
  const BANDS = useBands();
  const { id } = useParams();
  const navigate = useNavigate();
  const [reviseOpen, setReviseOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [notes, setNotes] = useState('');
  const [reason, setReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  // Per-item flags: { [rank]: string (note) }
  const [flags, setFlags] = useState({});

  const accountQuery = useQuery({ queryKey: ['account'], queryFn: getAccount });
  const submissionQuery = useQuery({
    queryKey: ['submission', id],
    queryFn: () => getSubmission(id),
  });

  const account = accountQuery.data ?? null;
  const submission = submissionQuery.data ?? null;
  const loading = submissionQuery.isLoading;
  const error = submissionQuery.error;
  const isPending = submission?.status === 'pending';

  const toggleFlag = (rank) => {
    setFlags((prev) => {
      const next = { ...prev };
      if (rank in next) {
        delete next[rank];
      } else {
        next[rank] = '';
      }
      return next;
    });
  };

  const setFlagNote = (rank, note) => {
    setFlags((prev) => ({ ...prev, [rank]: note }));
  };

  const flaggedCount = Object.keys(flags).length;

  const handleApprove = async () => {
    setActionLoading(true);
    try {
      await approveSubmission(id);
      toast.success(t('submissions.approveSuccess'));
      navigate('/submissions');
    } catch {
      toast.error(t('submissions.approveFailed'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleRevise = async () => {
    if (!notes.trim() && flaggedCount === 0) return;
    setActionLoading(true);
    try {
      const flaggedChoices = Object.entries(flags).map(([rank, note]) => ({
        rank: parseInt(rank, 10),
        note: note || '',
      }));
      await reviseSubmission(id, notes.trim() || `${flaggedCount} choice(s) flagged for review.`, flaggedChoices);
      toast.success(t('submissions.revisionSuccess'));
      setReviseOpen(false);
      navigate('/submissions');
    } catch {
      toast.error(t('submissions.revisionFailed'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!reason.trim()) return;
    setActionLoading(true);
    try {
      await rejectSubmission(id, reason.trim());
      toast.success(t('submissions.rejectSuccess'));
      setRejectOpen(false);
      navigate('/submissions');
    } catch {
      toast.error(t('submissions.rejectFailed'));
    } finally {
      setActionLoading(false);
    }
  };

  // Map choices to slots by rank
  const choices = submission?.choices ?? [];
  const slotMap = {};
  choices.forEach((c) => { if (c.rank) slotMap[c.rank] = c; });

  // Map previous flags (if revision_requested, show saved flags)
  const savedFlags = submission?.flagged_choices ?? [];
  const savedFlagMap = {};
  savedFlags.forEach((f) => { savedFlagMap[f.rank] = f.note; });

  const statusBadge = (status) => {
    const colors = {
      pending: { bg: '#fef3c7', color: '#92400e', label: t('submissions.pending') },
      approved: { bg: '#d1fae5', color: '#065f46', label: t('submissions.approved') },
      revision_requested: { bg: '#fee2e2', color: '#991b1b', label: t('submissions.revisionRequested') },
      rejected: { bg: '#fee2e2', color: '#991b1b', label: t('submissions.rejected') },
    };
    const c = colors[status] || colors.pending;
    return (
      <span style={{
        display: 'inline-block', padding: '2px 10px', borderRadius: 'var(--border-radius-sm)',
        fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-medium)',
        background: c.bg, color: c.color, textTransform: 'capitalize',
      }}>{c.label}</span>
    );
  };

  const thStyle = {
    padding: 'var(--space-2) var(--space-3)', textAlign: 'left',
    fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-medium)',
    color: 'var(--color-text-secondary)', borderBottom: '2px solid var(--color-border)', whiteSpace: 'nowrap',
  };
  const tdBase = {
    padding: 'var(--space-2) var(--space-3)', fontSize: 'var(--font-size-sm)',
    borderBottom: 'var(--border-width) solid var(--color-border)', verticalAlign: 'middle',
  };

  return (
    <div style={{ background: 'var(--color-background)', minHeight: '100dvh', fontFamily: 'var(--font-family-base)' }}>
      <NavBarV2 account={account} />
      <main className="px-4 md:px-8" style={{ paddingTop: 'var(--space-6)', paddingBottom: 'var(--space-6)', maxWidth: '100%', margin: '0 auto' }}>
        <Link
          to="/submissions"
          style={{ color: 'var(--color-primary)', textDecoration: 'none', fontSize: 'var(--font-size-sm)', display: 'inline-block', marginBottom: 'var(--space-4)' }}
        >
          {t('submissions.backToSubmissions')}
        </Link>

        {loading && <LoadingSpinner label={t('submissions.loadingSubmission')} />}
        {error && <ErrorMessage message={error} />}

        {!loading && !error && submission && (
          <>
            {/* Header */}
            <div style={{ marginBottom: 'var(--space-4)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                <h1 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text-primary)', margin: 0, textWrap: 'balance' }}>
                  {submission.student_name || t('submissions.unknownStudent')}
                </h1>
                {statusBadge(submission.status)}
                {isPending && flaggedCount > 0 && (
                  <span style={{ fontSize: 'var(--font-size-xs)', padding: '2px 8px', borderRadius: '10px', fontWeight: 600, background: '#fef3c7', color: '#92400e' }}>
                    {t('submissions.flagged', { count: flaggedCount })}
                  </span>
                )}
              </div>
              <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', margin: 'var(--space-1) 0 0' }}>
                {submission.class_name && `${t('submissions.classLabel')} ${submission.class_name}`}
                {submission.class_name && submission.submitted_at && ' · '}
                {submission.submitted_at && `${t('submissions.submitted')} ${new Date(submission.submitted_at).toLocaleDateString()}`}
                {' · '}{t('submissions.choices', { count: choices.length })}
              </p>
            </div>

            {/* Counsellor notes (shown for revision_requested/rejected) */}
            {submission.counsellor_notes && submission.status !== 'pending' && (
              <div style={{
                padding: 'var(--space-3) var(--space-4)', marginBottom: 'var(--space-4)',
                background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 'var(--border-radius-md)',
                fontSize: 'var(--font-size-sm)', color: '#92400e',
              }}>
                <strong>{t('submissions.counsellorNotes')}</strong> {submission.counsellor_notes}
              </div>
            )}

            {/* 20-slot banded JUPAS table */}
            <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--border-radius-md)', border: 'var(--border-width) solid var(--color-border)', overflow: 'hidden', marginBottom: 'var(--space-6)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ ...thStyle, width: '50px' }}>{t('submissions.rank')}</th>
                    <th style={{ ...thStyle, width: '40px' }}>{t('submissions.band')}</th>
                    <th style={{ ...thStyle, width: '80px' }}>{t('submissions.jupasCode')}</th>
                    <th style={thStyle}>{t('submissions.programmeName')}</th>
                    <th style={{ ...thStyle, width: '80px' }}>{t('submissions.matchPct')}</th>
                    <th style={{ ...thStyle, width: '70px' }}>{t('submissions.risk')}</th>
                    {isPending && <th style={{ ...thStyle, width: '50px', textAlign: 'center' }}>{t('submissions.flag')}</th>}
                  </tr>
                </thead>
                <tbody>
                  {BANDS.map((band) =>
                    band.slots.map((slot, si) => {
                      const choice = slotMap[slot];
                      const isFirst = si === 0;
                      const matchScore = choice?.match_score != null ? Math.round(choice.match_score * 100) : null;
                      const isAtRisk = choice?.risk_level === 'at_risk';
                      const isFlagged = slot in flags;
                      const wasFlagged = slot in savedFlagMap;

                      return (
                        <tr key={slot} style={{ background: isFlagged ? '#fef3c7' : wasFlagged ? '#fff7ed' : choice ? 'var(--color-surface)' : band.bg + '40' }}>
                          {/* Slot number */}
                          <td style={{ ...tdBase, textAlign: 'center', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text-primary)' }}>{slot}</td>
                          {/* Band label — only on first row of each band */}
                          {isFirst ? (
                            <td rowSpan={band.slots.length} style={{
                              ...tdBase, textAlign: 'center', fontWeight: 'var(--font-weight-bold)',
                              fontSize: 'var(--font-size-lg)', color: band.fg, background: band.bg,
                              borderRight: `3px solid ${band.border}`, verticalAlign: 'middle', lineHeight: 1,
                            }}>
                              {band.id}
                            </td>
                          ) : null}
                          {/* JUPAS code */}
                          <td style={tdBase}>
                            {choice?.jupas_code && (
                              <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontWeight: 'var(--font-weight-bold)', fontSize: 'var(--font-size-xs)', background: '#f1f5f9', padding: '1px 6px', borderRadius: '4px' }}>
                                {choice.jupas_code}
                              </span>
                            )}
                          </td>
                          {/* Programme name */}
                          <td style={tdBase}>
                            {choice ? (
                              <div>
                                <div style={{ fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-primary)' }}>
                                  {choice.programme_name || '—'}
                                </div>
                                {isAtRisk && (
                                  <span style={{ fontSize: '10px', fontWeight: 700, color: '#fff', background: '#dc2626', padding: '1px 5px', borderRadius: '6px', marginTop: '2px', display: 'inline-block' }}>
                                    {t('submissions.atRisk')}
                                  </span>
                                )}
                                {choice.notes && (
                                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                                    {choice.notes}
                                  </div>
                                )}
                                {/* Show saved flag note */}
                                {wasFlagged && savedFlagMap[slot] && (
                                  <div style={{ fontSize: 'var(--font-size-xs)', color: '#dc2626', marginTop: '2px', fontStyle: 'italic' }}>
                                    ⚑ {savedFlagMap[slot]}
                                  </div>
                                )}
                                {/* Inline flag note input */}
                                {isFlagged && (
                                  <input
                                    id={`flag-note-${slot}`}
                                    name={`flag-note-${slot}`}
                                    aria-label={`Flag note for choice ${slot}`}
                                    value={flags[slot]}
                                    onChange={(e) => setFlagNote(slot, e.target.value)}
                                    placeholder={t('submissions.flagPlaceholder')}
                                    style={{
                                      marginTop: '4px', width: '100%', boxSizing: 'border-box',
                                      padding: '3px 6px', fontSize: 'var(--font-size-xs)',
                                      border: '1px solid #fde68a', borderRadius: '4px',
                                      background: '#fffbeb', fontFamily: 'var(--font-family-base)',
                                    }}
                                  />
                                )}
                              </div>
                            ) : (
                              <span style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-xs)', fontStyle: 'italic' }}>—</span>
                            )}
                          </td>
                          {/* Match score */}
                          <td style={{ ...tdBase, textAlign: 'center' }}>
                            {matchScore != null && (
                              <span style={{
                                fontWeight: 'var(--font-weight-bold)',
                                fontVariantNumeric: 'tabular-nums',
                                color: matchScore >= 70 ? '#059669' : matchScore >= 40 ? '#d97706' : '#dc2626',
                              }}>
                                {matchScore}%
                              </span>
                            )}
                          </td>
                          {/* Risk */}
                          <td style={{ ...tdBase, textAlign: 'center' }}>
                            {isAtRisk && (
                              <span style={{
                                display: 'inline-block', padding: '1px 6px', borderRadius: 'var(--border-radius-sm)',
                                fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-medium)',
                                background: '#fee2e2', color: '#991b1b',
                              }}>
                                {t('submissions.atRisk')}
                              </span>
                            )}
                          </td>
                          {/* Flag toggle */}
                          {isPending && (
                            <td style={{ ...tdBase, textAlign: 'center' }}>
                              {choice && (
                                <button
                                  onClick={() => toggleFlag(slot)}
                                  style={{
                                    background: isFlagged ? '#f59e0b' : 'none',
                                    border: isFlagged ? '1px solid #d97706' : '1px solid var(--color-border)',
                                    borderRadius: '4px', cursor: 'pointer', padding: '3px 5px',
                                    color: isFlagged ? '#fff' : 'var(--color-text-secondary)',
                                    display: 'inline-flex', alignItems: 'center',
                                  }}
                                  aria-label={isFlagged ? t('submissions.removeFlag') : t('submissions.flagAsQuestionable')}
                                >
                                  <Flag size={12} aria-hidden="true" />
                                </button>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Action buttons */}
            {isPending && canEditSubmissions && (
              <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', alignItems: 'center' }}>
                <Button
                  onClick={handleApprove}
                  disabled={actionLoading || flaggedCount > 0}
                  style={{ background: flaggedCount > 0 ? '#9ca3af' : '#16a34a', color: '#fff', border: 'none' }}
                >
                  {actionLoading ? t('submissions.processing') : t('submissions.approve')}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setReviseOpen(true)}
                  disabled={actionLoading}
                >
                  {flaggedCount > 0
                    ? t('submissions.sendBackFlagged', { count: flaggedCount })
                    : t('submissions.sendBackRevision')}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setRejectOpen(true)}
                  disabled={actionLoading}
                  style={{ color: '#dc2626', borderColor: '#dc2626' }}
                >
                  {t('submissions.reject')}
                </Button>
                {flaggedCount > 0 && (
                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                    {t('submissions.clearFlagsToApprove')}
                  </span>
                )}
              </div>
            )}
          </>
        )}

        {/* Revise modal */}
        <Modal
          isOpen={reviseOpen}
          title={t('submissions.sendBackTitle')}
          onClose={() => { setReviseOpen(false); setNotes(''); }}
          onConfirm={handleRevise}
          confirmLabel={t('submissions.sendRevision')}
        >
          {flaggedCount > 0 && (
            <div style={{
              padding: 'var(--space-2) var(--space-3)', marginBottom: 'var(--space-3)',
              background: '#fef3c7', borderRadius: 'var(--border-radius-sm)',
              fontSize: 'var(--font-size-xs)', color: '#92400e',
            }}>
              <strong>{t('submissions.choicesFlagged', { count: flaggedCount })}</strong>
              <ul style={{ margin: 'var(--space-1) 0 0', paddingLeft: 'var(--space-4)' }}>
                {Object.entries(flags).map(([rank, note]) => {
                  const choice = slotMap[parseInt(rank, 10)];
                  return (
                    <li key={rank}>
                      {t('submissions.rank')} {rank}: {choice?.programme_name || choice?.jupas_code || t('submissions.unknownStudent')}
                      {note && ` — ${note}`}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          <label htmlFor="revise-notes" style={{ display: 'block', marginBottom: 'var(--space-2)', fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)' }}>
            {flaggedCount > 0 ? t('submissions.additionalNotes') : t('submissions.notesRequired')}
          </label>
          <textarea
            id="revise-notes"
            name="revise-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t('submissions.notesPlaceholder')}
            rows={4}
            style={{
              width: '100%', boxSizing: 'border-box', padding: 'var(--space-2)',
              border: 'var(--border-width) solid var(--color-border)',
              borderRadius: 'var(--border-radius-sm)', fontSize: 'var(--font-size-sm)',
              fontFamily: 'var(--font-family-base)', resize: 'vertical',
            }}
          />
        </Modal>

        {/* Reject modal */}
        <Modal
          isOpen={rejectOpen}
          title={t('submissions.rejectTitle')}
          onClose={() => { setRejectOpen(false); setReason(''); }}
          onConfirm={handleReject}
          confirmLabel={t('submissions.reject')}
          confirmVariant="danger"
        >
          <label htmlFor="reject-reason" style={{ display: 'block', marginBottom: 'var(--space-2)', fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)' }}>
            {t('submissions.reasonRequired')}
          </label>
          <textarea
            id="reject-reason"
            name="reject-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t('submissions.reasonPlaceholder')}
            rows={4}
            style={{
              width: '100%', boxSizing: 'border-box', padding: 'var(--space-2)',
              border: 'var(--border-width) solid var(--color-border)',
              borderRadius: 'var(--border-radius-sm)', fontSize: 'var(--font-size-sm)',
              fontFamily: 'var(--font-family-base)', resize: 'vertical',
            }}
          />
        </Modal>
      </main>
    </div>
  );
}

export default SubmissionDetail;
