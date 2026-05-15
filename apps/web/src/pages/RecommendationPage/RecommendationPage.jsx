// REQ-034: Recommendation output page
import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { NavBar } from '@schoolchoice/ui';
import RecommendationCard from '../../components/RecommendationCard/RecommendationCard';
import ActionPlanDisplay from '../../components/ActionPlanDisplay/ActionPlanDisplay';
import { LoadingSpinner } from '@schoolchoice/ui';
import { ErrorMessage } from '@schoolchoice/ui';
import { EmptyState } from '@schoolchoice/ui';
import { getRecommendations } from '../../api/recommendations';
import { getActionPlan } from '../../api/actionPlan';
import { getStudent } from '../../api/students';
import { useTranslation } from '@schoolchoice/ui/i18n';

function RecommendationPage() {
  const { t } = useTranslation();
  const { id: studentId } = useParams();

  const [student, setStudent] = useState(null);

  const [recommendations, setRecommendations] = useState([]);
  const [recLoading, setRecLoading] = useState(true);
  const [recError, setRecError] = useState('');

  const [actionPlan, setActionPlan] = useState(null);
  const [planLoading, setPlanLoading] = useState(true);
  const [planError, setPlanError] = useState('');
  const [planEmpty, setPlanEmpty] = useState(false);

  useEffect(() => {
    const fetchStudent = async () => {
      try {
        const data = await getStudent(studentId);
        setStudent(data);
      } catch {
        // Best-effort; heading will fall back gracefully
      }
    };

    const fetchRecommendations = async () => {
      setRecLoading(true);
      setRecError('');
      try {
        const data = await getRecommendations(studentId);
        setRecommendations(data);
      } catch (err) {
        const status = err.response?.status;
        if (status === 403 || status === 404) {
          setRecError(t('recommendations.noAccess'));
        } else {
          setRecError(t('recommendations.loadFailed'));
        }
      } finally {
        setRecLoading(false);
      }
    };

    const fetchActionPlan = async () => {
      setPlanLoading(true);
      setPlanError('');
      setPlanEmpty(false);
      try {
        const data = await getActionPlan(studentId);
        setActionPlan(data);
      } catch (err) {
        const status = err.response?.status;
        if (status === 404) {
          setPlanEmpty(true);
        } else if (status === 403) {
          setPlanError(t('recommendations.planLoadFailed'));
        } else {
          setPlanError(t('recommendations.planLoadFailed'));
        }
      } finally {
        setPlanLoading(false);
      }
    };

    fetchStudent();
    fetchRecommendations();
    fetchActionPlan();
  }, [studentId]);

  const pageStyle = {
    minHeight: '100vh',
    background: 'var(--color-background)',
    fontFamily: 'var(--font-family-base)',
  };

  const contentStyle = {
    maxWidth: '100%',
    margin: '0 auto',
    padding: 'var(--space-8) var(--space-6)',
  };

  const backLinkStyle = {
    color: 'var(--color-primary)',
    fontSize: 'var(--font-size-sm)',
    textDecoration: 'none',
    display: 'inline-block',
    marginBottom: 'var(--space-2)',
  };

  const headingStyle = {
    fontSize: 'var(--font-size-2xl)',
    fontWeight: 'var(--font-weight-bold)',
    color: 'var(--color-text-primary)',
    margin: 0,
    marginBottom: 'var(--space-8)',
  };

  const sectionHeadingStyle = {
    fontSize: 'var(--font-size-xl)',
    fontWeight: 'var(--font-weight-bold)',
    color: 'var(--color-text-primary)',
    marginBottom: 'var(--space-4)',
    marginTop: 0,
  };

  const studentName = student ? student.name : t('recommendations.student');

  return (
    <div style={pageStyle}>
      <NavBar />
      <div style={contentStyle}>
        <Link to={`/students/${studentId}/profile`} style={backLinkStyle}>
          {`< ${t('recommendations.backTo')} ${studentName}`}
        </Link>
        <h1 style={headingStyle}>{t('recommendations.title')} {studentName}</h1>

        <section>
          <h2 style={sectionHeadingStyle}>{t('recommendations.schoolRecommendations')}</h2>
          {recLoading ? (
            <LoadingSpinner label={t('recommendations.loading')} />
          ) : recError ? (
            <ErrorMessage message={recError} />
          ) : recommendations.length === 0 ? (
            <EmptyState message={t('recommendations.emptyState')} />
          ) : (
            recommendations.map((rec, index) => (
              <RecommendationCard
                key={rec.id}
                recommendation={{ ...rec, rank: index + 1 }}
              />
            ))
          )}
        </section>

        <section style={{ marginTop: 'var(--space-8)' }}>
          <h2 style={sectionHeadingStyle}>{t('recommendations.actionPlan')}</h2>
          {planLoading ? (
            <LoadingSpinner label={t('recommendations.loadingPlan')} />
          ) : planError ? (
            <ErrorMessage message={planError} />
          ) : planEmpty ? (
            <EmptyState message={t('recommendations.planEmptyState')} />
          ) : actionPlan ? (
            <ActionPlanDisplay actionPlan={actionPlan} />
          ) : null}
        </section>
      </div>
    </div>
  );
}

export default RecommendationPage;
