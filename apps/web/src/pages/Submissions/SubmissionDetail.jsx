import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import NavBarV2 from '../../components/NavBarV2/NavBarV2';
import { LoadingSpinner } from '@schoolchoice/ui';
import { ErrorMessage } from '@schoolchoice/ui';
import { Modal } from '@schoolchoice/ui';
import { Button } from '@schoolchoice/ui/primitives/button';
import { getAccount } from '@schoolchoice/ui/api/account';
import { getSubmission, approveSubmission, reviseSubmission, rejectSubmission } from '../../api/submissions';

const BAND_CONFIG = [
  { label: 'Band A', range: [1, 3], bg: '#fef2f2' },
  { label: 'Band B', range: [4, 6], bg: '#fffbeb' },
  { label: 'Band C', range: [7, 10], bg: '#ecfdf5' },
  { label: 'Band D', range: [11, 14], bg: '#eff6ff' },
  { label: 'Band E', range: [15, 25], bg: '#f3f4f6' },
];

function getBand(rank) {
  for (const band of BAND_CONFIG) {
    if (rank >= band.range[0] && rank <= band.range[1]) return band;
  }
  return BAND_CONFIG[BAND_CONFIG.length - 1];
}

function matchColor(pct) {
  if (pct >= 70) return '#16a34a';
  if (pct >= 40) return '#ca8a04';
  return '#dc2626';
}

function SubmissionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [reviseOpen, setReviseOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [notes, setNotes] = useState('');
  const [reason, setReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

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

  const handleApprove = async () => {
    setActionLoading(true);
    try {
      await approveSubmission(id);
      toast.success('Submission approved');
      navigate('/submissions');
    } catch {
      toast.error('Failed to approve submission');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRevise = async () => {
    if (!notes.trim()) return;
    setActionLoading(true);
    try {
      await reviseSubmission(id, notes.trim());
      toast.success('Sent back for revision');
      setReviseOpen(false);
      navigate('/submissions');
    } catch {
      toast.error('Failed to send revision request');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!reason.trim()) return;
    setActionLoading(true);
    try {
      await rejectSubmission(id, reason.trim());
      toast.success('Submission rejected');
      setRejectOpen(false);
      navigate('/submissions');
    } catch {
      toast.error('Failed to reject submission');
    } finally {
      setActionLoading(false);
    }
  };

  const pageStyle = {
    background: 'var(--color-background)',
    minHeight: '100vh',
    fontFamily: 'var(--font-family-base)',
  };

  const statusBadge = (status) => {
    const colors = {
      pending: { bg: '#fef3c7', color: '#92400e' },
      approved: { bg: '#d1fae5', color: '#065f46' },
      revision: { bg: '#dbeafe', color: '#1e40af' },
      rejected: { bg: '#fee2e2', color: '#991b1b' },
    };
    const c = colors[status] || colors.pending;
    return {
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: 'var(--border-radius-sm)',
      fontSize: 'var(--font-size-xs)',
      fontWeight: 'var(--font-weight-medium)',
      background: c.bg,
      color: c.color,
      textTransform: 'capitalize',
    };
  };

  const tableStyle = {
    width: '100%',
    borderCollapse: 'collapse',
    border: 'var(--border-width) solid var(--color-border)',
    borderRadius: 'var(--border-radius-md)',
    overflow: 'hidden',
  };

  const thStyle = {
    textAlign: 'left',
    padding: 'var(--space-2) var(--space-3)',
    fontSize: 'var(--font-size-sm)',
    fontWeight: 'var(--font-weight-medium)',
    color: 'var(--color-text-secondary)',
    borderBottom: 'var(--border-width) solid var(--color-border)',
    background: 'var(--color-background)',
  };

  const choices = submission?.choices ?? [];

  // Group choices by band
  const groupedChoices = BAND_CONFIG.map((band) => ({
    ...band,
    choices: choices.filter((c) => {
      const rank = c.rank ?? c.priority;
      return rank >= band.range[0] && rank <= band.range[1];
    }),
  })).filter((g) => g.choices.length > 0);

  return (
    <div style={pageStyle}>
      <NavBarV2 account={account} />
      <main className="px-4 md:px-8" style={{ paddingTop: 'var(--space-6)', paddingBottom: 'var(--space-6)' }}>
        <Link
          to="/submissions"
          style={{
            color: 'var(--color-primary)',
            textDecoration: 'none',
            fontSize: 'var(--font-size-sm)',
            display: 'inline-block',
            marginBottom: 'var(--space-4)',
          }}
        >
          &larr; Back to Submissions
        </Link>

        {loading && <LoadingSpinner label="Loading submission..." />}
        {error && <ErrorMessage message={error} />}

        {!loading && !error && submission && (
          <>
            {/* Header */}
            <div style={{ marginBottom: 'var(--space-6)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                <h1 style={{
                  fontSize: 'var(--font-size-xl)',
                  fontWeight: 'var(--font-weight-bold)',
                  color: 'var(--color-text-primary)',
                  margin: 0,
                }}>
                  {submission.student_name || 'Unknown Student'}
                </h1>
                <span style={statusBadge(submission.status)}>{submission.status}</span>
              </div>
              <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', margin: 'var(--space-1) 0 0' }}>
                {submission.class_name && `Class ${submission.class_name}`}
                {submission.class_name && submission.submitted_at && ' · '}
                {submission.submitted_at && `Submitted ${new Date(submission.submitted_at).toLocaleDateString()}`}
              </p>
            </div>

            {/* Choice table grouped by band */}
            <div style={{ overflowX: 'auto', marginBottom: 'var(--space-6)' }}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>Rank</th>
                    <th style={thStyle}>Band</th>
                    <th style={thStyle}>Programme Name</th>
                    <th style={thStyle}>JUPAS Code</th>
                    <th style={thStyle}>Match %</th>
                    <th style={thStyle}>Risk</th>
                    <th style={thStyle}>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {groupedChoices.map((group) => (
                    group.choices.map((choice, idx) => {
                      const rank = choice.rank ?? choice.priority;
                      const band = getBand(rank);
                      const matchPct = choice.match_pct ?? choice.match_percentage;
                      return (
                        <tr key={choice.id || `${group.label}-${idx}`} style={{ background: band.bg }}>
                          <td style={{ padding: 'var(--space-2) var(--space-3)', fontSize: 'var(--font-size-sm)', borderBottom: 'var(--border-width) solid var(--color-border)' }}>
                            {rank}
                          </td>
                          <td style={{ padding: 'var(--space-2) var(--space-3)', fontSize: 'var(--font-size-sm)', borderBottom: 'var(--border-width) solid var(--color-border)' }}>
                            {band.label}
                          </td>
                          <td style={{ padding: 'var(--space-2) var(--space-3)', fontSize: 'var(--font-size-sm)', borderBottom: 'var(--border-width) solid var(--color-border)', fontWeight: 'var(--font-weight-medium)' }}>
                            {choice.programme_name || choice.name || '-'}
                          </td>
                          <td style={{ padding: 'var(--space-2) var(--space-3)', fontSize: 'var(--font-size-sm)', borderBottom: 'var(--border-width) solid var(--color-border)', fontFamily: 'monospace' }}>
                            {choice.jupas_code || '-'}
                          </td>
                          <td style={{ padding: 'var(--space-2) var(--space-3)', fontSize: 'var(--font-size-sm)', borderBottom: 'var(--border-width) solid var(--color-border)' }}>
                            {matchPct != null ? (
                              <span style={{ fontWeight: 'var(--font-weight-medium)', color: matchColor(matchPct) }}>
                                {matchPct}%
                              </span>
                            ) : '-'}
                          </td>
                          <td style={{ padding: 'var(--space-2) var(--space-3)', fontSize: 'var(--font-size-sm)', borderBottom: 'var(--border-width) solid var(--color-border)' }}>
                            {choice.at_risk ? (
                              <span style={{
                                display: 'inline-block',
                                padding: '1px 6px',
                                borderRadius: 'var(--border-radius-sm)',
                                fontSize: 'var(--font-size-xs)',
                                fontWeight: 'var(--font-weight-medium)',
                                background: '#fee2e2',
                                color: '#991b1b',
                              }}>
                                At Risk
                              </span>
                            ) : null}
                          </td>
                          <td style={{ padding: 'var(--space-2) var(--space-3)', fontSize: 'var(--font-size-sm)', borderBottom: 'var(--border-width) solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
                            {choice.notes || ''}
                          </td>
                        </tr>
                      );
                    })
                  ))}
                  {choices.length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                        No choices submitted.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Action buttons */}
            {isPending && (
              <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                <Button
                  onClick={handleApprove}
                  disabled={actionLoading}
                  style={{ background: '#16a34a', color: '#fff', border: 'none' }}
                >
                  {actionLoading ? 'Processing...' : 'Approve'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setReviseOpen(true)}
                  disabled={actionLoading}
                >
                  Send Back for Revision
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setRejectOpen(true)}
                  disabled={actionLoading}
                  style={{ color: '#dc2626', borderColor: '#dc2626' }}
                >
                  Reject
                </Button>
              </div>
            )}
          </>
        )}

        {/* Revise modal */}
        <Modal
          isOpen={reviseOpen}
          title="Send Back for Revision"
          onClose={() => { setReviseOpen(false); setNotes(''); }}
          onConfirm={handleRevise}
          confirmLabel="Send Revision"
        >
          <label style={{ display: 'block', marginBottom: 'var(--space-2)', fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)' }}>
            Notes for the student (required)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Explain what needs to change..."
            rows={4}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: 'var(--space-2)',
              border: 'var(--border-width) solid var(--color-border)',
              borderRadius: 'var(--border-radius-sm)',
              fontSize: 'var(--font-size-sm)',
              fontFamily: 'var(--font-family-base)',
              resize: 'vertical',
            }}
          />
        </Modal>

        {/* Reject modal */}
        <Modal
          isOpen={rejectOpen}
          title="Reject Submission"
          onClose={() => { setRejectOpen(false); setReason(''); }}
          onConfirm={handleReject}
          confirmLabel="Reject"
          confirmVariant="danger"
        >
          <label style={{ display: 'block', marginBottom: 'var(--space-2)', fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)' }}>
            Reason for rejection (required)
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Explain why this submission is being rejected..."
            rows={4}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: 'var(--space-2)',
              border: 'var(--border-width) solid var(--color-border)',
              borderRadius: 'var(--border-radius-sm)',
              fontSize: 'var(--font-size-sm)',
              fontFamily: 'var(--font-family-base)',
              resize: 'vertical',
            }}
          />
        </Modal>
      </main>
    </div>
  );
}

export default SubmissionDetail;
