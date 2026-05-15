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

function RecommendationPage() {
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
          setRecError('Could not load recommendations. You may not have access to this student.');
        } else {
          setRecError('Could not load recommendations. Please try again.');
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
          setPlanError('Could not load action plan. Please try again.');
        } else {
          setPlanError('Could not load action plan. Please try again.');
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

  const studentName = student ? student.name : 'Student';

  return (
    <div style={pageStyle}>
      <NavBar />
      <div style={contentStyle}>
        <Link to={`/students/${studentId}/profile`} style={backLinkStyle}>
          {`< Back to ${studentName}`}
        </Link>
        <h1 style={headingStyle}>Recommendations for {studentName}</h1>

        <section>
          <h2 style={sectionHeadingStyle}>School Recommendations</h2>
          {recLoading ? (
            <LoadingSpinner label="Loading recommendations…" />
          ) : recError ? (
            <ErrorMessage message={recError} />
          ) : recommendations.length === 0 ? (
            <EmptyState message="No recommendations have been generated yet. Return to the student profile and click Generate Recommendations." />
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
          <h2 style={sectionHeadingStyle}>Action Plan</h2>
          {planLoading ? (
            <LoadingSpinner label="Loading action plan…" />
          ) : planError ? (
            <ErrorMessage message={planError} />
          ) : planEmpty ? (
            <EmptyState message="No action plan available yet. Return to the student profile and click Generate Action Plan." />
          ) : actionPlan ? (
            <ActionPlanDisplay actionPlan={actionPlan} />
          ) : null}
        </section>
      </div>
    </div>
  );
}

export default RecommendationPage;
