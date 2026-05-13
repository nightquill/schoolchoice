import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@schoolchoice/ui/hooks/useAuth';
import { Button } from '@schoolchoice/ui/primitives/button';
import { Input } from '@schoolchoice/ui/primitives/input';
import { toast } from 'sonner';
import { ChevronUp, ChevronDown, X, Search, BookOpen, Send, Save } from 'lucide-react';
import {
  getMyChoices,
  saveMyChoices,
  submitChoices,
  getMatchScores,
  searchProgrammes,
} from '../api/student';

const BANDS = [
  { label: 'Band A', range: [1, 3], bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700' },
  { label: 'Band B', range: [4, 6], bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700' },
  { label: 'Band C', range: [7, 10], bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700' },
  { label: 'Band D', range: [11, 14], bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700' },
  { label: 'Band E', range: [15, 25], bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-600' },
];

function getBand(rank) {
  return BANDS.find((b) => rank >= b.range[0] && rank <= b.range[1]);
}

function matchColor(pct) {
  if (pct == null) return 'text-muted-foreground';
  if (pct >= 70) return 'text-green-600';
  if (pct >= 40) return 'text-amber-600';
  return 'text-red-600';
}

function StatusBanner({ status, notes }) {
  const config = {
    draft: { bg: 'bg-muted', text: 'text-muted-foreground', label: 'Draft' },
    pending: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'Submitted — awaiting counsellor review' },
    approved: { bg: 'bg-green-50', text: 'text-green-700', label: 'Approved' },
    revision_requested: { bg: 'bg-red-50', text: 'text-red-700', label: 'Revision Requested' },
  };
  const c = config[status] || config.draft;

  return (
    <div className="space-y-2">
      <div className={`rounded-md px-4 py-2 text-sm font-medium ${c.bg} ${c.text}`}>
        Status: {c.label}
      </div>
      {status === 'revision_requested' && notes && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <strong>Counsellor notes:</strong> {notes}
        </div>
      )}
    </div>
  );
}

export default function MyChoices() {
  const { user, logout } = useAuth();
  const [choices, setChoices] = useState([]);
  const [status, setStatus] = useState('draft');
  const [counsellorNotes, setCounsellorNotes] = useState('');
  const [matchScores, setMatchScores] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);

  // Search state
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const debounceRef = useRef(null);
  const dropdownRef = useRef(null);

  const readOnly = status === 'pending';

  // Load choices on mount
  useEffect(() => {
    getMyChoices()
      .then((data) => {
        setChoices(data.choices || []);
        setStatus(data.status || 'draft');
        setCounsellorNotes(data.counsellor_notes || '');
      })
      .catch((err) => {
        if (err.response?.status !== 404) {
          toast.error(err.response?.data?.detail || 'Failed to load choices.');
        }
      })
      .finally(() => setLoading(false));
  }, []);

  // Load match scores when choices change
  const loadMatchScores = useCallback(() => {
    if (choices.length === 0) return;
    getMatchScores()
      .then((data) => {
        const map = {};
        if (Array.isArray(data)) {
          data.forEach((s) => { map[s.programme_code] = s.match_pct; });
        } else if (data.scores) {
          Object.entries(data.scores).forEach(([k, v]) => { map[k] = v; });
        }
        setMatchScores(map);
      })
      .catch(() => { /* match scores are optional */ });
  }, [choices.length]);

  useEffect(() => {
    loadMatchScores();
  }, [loadMatchScores]);

  // Search programmes
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setShowDropdown(false);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearchLoading(true);
      searchProgrammes(query)
        .then((data) => {
          setResults(Array.isArray(data) ? data : data.programmes || []);
          setShowDropdown(true);
        })
        .catch(() => setResults([]))
        .finally(() => setSearchLoading(false));
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const addChoice = (programme) => {
    if (choices.find((c) => c.programme_code === programme.programme_code)) {
      toast.info('Programme already in your list.');
      return;
    }
    if (choices.length >= 25) {
      toast.error('Maximum 25 choices allowed.');
      return;
    }
    setChoices((prev) => [
      ...prev,
      {
        rank: prev.length + 1,
        programme_code: programme.programme_code,
        programme_name: programme.programme_name || programme.name,
        school_name: programme.school_name || programme.school,
      },
    ]);
    setQuery('');
    setShowDropdown(false);
  };

  const removeChoice = (idx) => {
    setChoices((prev) =>
      prev.filter((_, i) => i !== idx).map((c, i) => ({ ...c, rank: i + 1 }))
    );
  };

  const moveChoice = (idx, dir) => {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= choices.length) return;
    const updated = [...choices];
    [updated[idx], updated[newIdx]] = [updated[newIdx], updated[idx]];
    setChoices(updated.map((c, i) => ({ ...c, rank: i + 1 })));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveMyChoices(choices);
      toast.success('Choices saved.');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    if (!confirmSubmit) {
      setConfirmSubmit(true);
      return;
    }
    setSubmitting(true);
    try {
      // Save first, then submit
      await saveMyChoices(choices);
      await submitChoices();
      setStatus('pending');
      toast.success('Choices submitted for counsellor review.');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to submit.');
    } finally {
      setSubmitting(false);
      setConfirmSubmit(false);
    }
  };

  // Group choices into bands for display
  const renderBands = () => {
    if (choices.length === 0) {
      return (
        <div className="rounded-md border border-border bg-card p-6 text-center">
          <p className="text-muted-foreground">No programme choices yet.</p>
          {!readOnly && (
            <p className="text-sm text-muted-foreground mt-1">Use the search above to add programmes.</p>
          )}
        </div>
      );
    }

    return BANDS.map((band) => {
      const bandChoices = choices.filter(
        (c) => c.rank >= band.range[0] && c.rank <= band.range[1]
      );
      if (bandChoices.length === 0 && choices.length < band.range[0]) return null;
      if (bandChoices.length === 0) return null;

      return (
        <div key={band.label} className="mb-3">
          <div className={`text-xs font-semibold px-3 py-1 rounded-t-md ${band.bg} ${band.text} ${band.border} border`}>
            {band.label} (Rank {band.range[0]}-{band.range[1]})
          </div>
          <div className={`border border-t-0 ${band.border} rounded-b-md divide-y divide-border`}>
            {bandChoices.map((choice, _i) => {
              const idx = choices.findIndex((c) => c.rank === choice.rank);
              const pct = matchScores[choice.programme_code];
              return (
                <div
                  key={choice.programme_code}
                  className={`flex items-center gap-2 px-3 py-2 ${band.bg}`}
                >
                  <span className="w-7 text-center text-sm font-semibold text-foreground">
                    {choice.rank}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground truncate">
                      {choice.programme_name}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {choice.programme_code} &middot; {choice.school_name}
                    </div>
                  </div>
                  {pct != null && (
                    <span className={`text-xs font-medium ${matchColor(pct)}`}>
                      {pct}%
                    </span>
                  )}
                  {!readOnly && (
                    <div className="flex items-center gap-0.5">
                      <button
                        onClick={() => moveChoice(idx, -1)}
                        disabled={idx === 0}
                        className="p-0.5 rounded hover:bg-black/5 disabled:opacity-30"
                        title="Move up"
                      >
                        <ChevronUp className="size-4" />
                      </button>
                      <button
                        onClick={() => moveChoice(idx, 1)}
                        disabled={idx === choices.length - 1}
                        className="p-0.5 rounded hover:bg-black/5 disabled:opacity-30"
                        title="Move down"
                      >
                        <ChevronDown className="size-4" />
                      </button>
                      <button
                        onClick={() => removeChoice(idx)}
                        className="p-0.5 rounded hover:bg-red-100 text-red-500"
                        title="Remove"
                      >
                        <X className="size-4" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      );
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-foreground">My Programme Choices</h1>
            {user?.name && (
              <p className="text-sm text-muted-foreground">{user.name}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Link to="/grades">
              <Button variant="ghost" size="sm">
                <BookOpen className="size-3.5 mr-1" />
                My Grades
              </Button>
            </Link>
            <Button variant="ghost" size="sm" onClick={logout}>
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-4 space-y-4">
        <StatusBanner status={status} notes={counsellorNotes} />

        {/* Programme Search */}
        {!readOnly && (
          <div className="relative" ref={dropdownRef}>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search programmes by name or JUPAS code..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-8"
              />
            </div>
            {showDropdown && results.length > 0 && (
              <div className="absolute z-10 mt-1 w-full rounded-md border border-border bg-card shadow-lg max-h-64 overflow-y-auto">
                {results.map((p) => (
                  <button
                    key={p.programme_code}
                    onClick={() => addChoice(p)}
                    className="w-full text-left px-3 py-2 hover:bg-muted/50 border-b border-border last:border-0"
                  >
                    <div className="text-sm font-medium text-foreground">
                      {p.programme_name || p.name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {p.programme_code} &middot; {p.school_name || p.school}
                    </div>
                  </button>
                ))}
              </div>
            )}
            {showDropdown && query.trim() && results.length === 0 && !searchLoading && (
              <div className="absolute z-10 mt-1 w-full rounded-md border border-border bg-card shadow-lg p-3">
                <p className="text-sm text-muted-foreground text-center">No programmes found.</p>
              </div>
            )}
          </div>
        )}

        {/* Ranked Choice List */}
        <div>{renderBands()}</div>

        {/* Action Buttons */}
        {!readOnly && choices.length > 0 && (
          <div className="flex items-center gap-2 pt-2">
            <Button onClick={handleSave} disabled={saving} variant="outline">
              <Save className="size-3.5 mr-1" />
              {saving ? 'Saving...' : 'Save Draft'}
            </Button>
            {confirmSubmit ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Are you sure?</span>
                <Button onClick={handleSubmit} disabled={submitting}>
                  <Send className="size-3.5 mr-1" />
                  {submitting ? 'Submitting...' : 'Yes, Submit'}
                </Button>
                <Button variant="ghost" onClick={() => setConfirmSubmit(false)}>
                  Cancel
                </Button>
              </div>
            ) : (
              <Button onClick={handleSubmit}>
                <Send className="size-3.5 mr-1" />
                Submit for Approval
              </Button>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
