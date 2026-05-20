// Methodology Report — consultant-readable scoring methodology documentation
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import NavBarV2 from '../../components/NavBarV2/NavBarV2';
import { LoadingSpinner } from '@schoolchoice/ui';
import { ErrorMessage } from '@schoolchoice/ui';
import { useTranslation } from '@schoolchoice/ui/i18n';
import { getMethodology } from '../../api/methodology';
import { getAccount } from '@schoolchoice/ui/api/account';

function MethodologyReport() {
  const [report, setReport] = useState(null);
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { t } = useTranslation();

  useEffect(() => {
    Promise.all([getMethodology(), getAccount()])
      .then(([reportData, accountData]) => {
        setReport(reportData);
        setAccount(accountData);
      })
      .catch((err) => {
        setError(err?.response?.data?.detail || t('methodology.loadFailed'));
      })
      .finally(() => setLoading(false));
  }, []);

  const pageStyle = {
    background: 'var(--color-background)',
    minHeight: '100vh',
    fontFamily: 'var(--font-family-base)',
  };

  const backLinkStyle = {
    fontSize: 'var(--font-size-sm)',
    color: 'var(--color-primary)',
    textDecoration: 'none',
    display: 'inline-block',
    padding: 'var(--space-3) var(--space-8)',
  };

  const heroStyle = {
    background: 'var(--color-surface)',
    borderBottom: 'var(--border-width) solid var(--color-border)',
    padding: 'var(--space-6) var(--space-8)',
  };

  const titleStyle = {
    fontSize: 'var(--font-size-2xl)',
    fontWeight: 'var(--font-weight-bold)',
    color: 'var(--color-text-primary)',
    margin: '0 0 var(--space-2) 0',
  };

  const versionStyle = {
    fontSize: 'var(--font-size-sm)',
    color: 'var(--color-text-secondary)',
    margin: '0 0 var(--space-4) 0',
  };

  const summaryStyle = {
    fontSize: 'var(--font-size-md)',
    color: 'var(--color-text-secondary)',
    maxWidth: '800px',
    lineHeight: 'var(--line-height-normal)',
    margin: 0,
  };

  const contentStyle = {
    padding: 'var(--space-6) var(--space-8)',
    maxWidth: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-8)',
  };

  const sectionHeadingStyle = {
    fontSize: 'var(--font-size-lg)',
    fontWeight: 'var(--font-weight-medium)',
    color: 'var(--color-text-primary)',
    marginTop: 0,
    marginBottom: 'var(--space-4)',
    paddingBottom: 'var(--space-2)',
    borderBottom: 'var(--border-width) solid var(--color-border)',
  };

  const statsRowStyle = {
    display: 'flex',
    gap: 'var(--space-6)',
    flexWrap: 'wrap',
    marginBottom: 'var(--space-2)',
  };

  const statCardStyle = {
    background: 'var(--color-surface)',
    border: 'var(--border-width) solid var(--color-border)',
    borderRadius: 'var(--border-radius-sm)',
    padding: 'var(--space-4) var(--space-6)',
    minWidth: '140px',
  };

  const statValueStyle = {
    fontSize: 'var(--font-size-2xl)',
    fontWeight: 'var(--font-weight-bold)',
    color: 'var(--color-primary)',
    display: 'block',
  };

  const statLabelStyle = {
    fontSize: 'var(--font-size-xs)',
    color: 'var(--color-text-secondary)',
    marginTop: '2px',
  };

  const stepCardStyle = {
    display: 'flex',
    gap: 'var(--space-4)',
    alignItems: 'flex-start',
  };

  const stepNumberStyle = {
    background: 'var(--color-primary)',
    color: '#fff',
    borderRadius: '50%',
    width: '28px',
    height: '28px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 'var(--font-size-sm)',
    fontWeight: 'var(--font-weight-bold)',
    flexShrink: 0,
  };

  const stepBodyStyle = {
    flex: 1,
  };

  const stepTitleStyle = {
    fontSize: 'var(--font-size-md)',
    fontWeight: 'var(--font-weight-medium)',
    color: 'var(--color-text-primary)',
    margin: '0 0 var(--space-1) 0',
  };

  const stepDescStyle = {
    fontSize: 'var(--font-size-sm)',
    color: 'var(--color-text-secondary)',
    lineHeight: 'var(--line-height-normal)',
    margin: 0,
  };

  const sourceRowStyle = {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-1)',
    padding: 'var(--space-3) 0',
    borderBottom: 'var(--border-width) solid var(--color-border)',
  };

  const sourceTitleStyle = {
    fontSize: 'var(--font-size-sm)',
    fontWeight: 'var(--font-weight-medium)',
    color: 'var(--color-text-primary)',
  };

  const sourceDescStyle = {
    fontSize: 'var(--font-size-sm)',
    color: 'var(--color-text-secondary)',
  };

  const limitationItemStyle = {
    fontSize: 'var(--font-size-sm)',
    color: 'var(--color-text-secondary)',
    lineHeight: 'var(--line-height-normal)',
    padding: 'var(--space-2) 0',
    borderBottom: 'var(--border-width) solid var(--color-border)',
    display: 'flex',
    gap: 'var(--space-2)',
    alignItems: 'flex-start',
  };

  const confidenceRowStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 'var(--space-4)',
    padding: 'var(--space-3) 0',
    borderBottom: 'var(--border-width) solid var(--color-border)',
    fontSize: 'var(--font-size-sm)',
  };

  const confidenceBadgeStyle = {
    background: 'var(--color-background)',
    border: 'var(--border-width) solid var(--color-border)',
    borderRadius: 'var(--border-radius-sm)',
    padding: '2px var(--space-2)',
    fontFamily: 'monospace',
    fontSize: 'var(--font-size-xs)',
    color: 'var(--color-text-secondary)',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  };

  return (
    <div style={pageStyle}>
      <NavBarV2 account={account} />
      <Link to="/dashboard" style={backLinkStyle}>{t('methodology.backToDashboard')}</Link>

      {loading && <LoadingSpinner label={t('methodology.loading')} />}
      {error && (
        <div style={{ padding: 'var(--space-6) var(--space-8)' }}>
          <ErrorMessage message={error} />
          <Link to="/dashboard" style={{ color: 'var(--color-primary)', fontSize: 'var(--font-size-sm)' }}>{t('methodology.backToDashboard')}</Link>
        </div>
      )}

      {!loading && !error && report && (
        <>
          <div style={heroStyle}>
            <h1 style={titleStyle}>{report.title}</h1>
            <p style={versionStyle}>{report.version}</p>
            <p style={summaryStyle}>{report.summary}</p>
          </div>

          <div style={contentStyle}>
            {/* Data Coverage */}
            <section aria-label="Data Coverage">
              <h2 style={sectionHeadingStyle}>{t('methodology.dataCoverage')}</h2>
              <div style={statsRowStyle}>
                <div style={statCardStyle}>
                  <span style={statValueStyle}>{report.data_coverage.total_programmes.toLocaleString()}</span>
                  <div style={statLabelStyle}>{t('methodology.jupasCount')}</div>
                </div>
                <div style={statCardStyle}>
                  <span style={statValueStyle}>{report.data_coverage.total_institutions}</span>
                  <div style={statLabelStyle}>{t('methodology.institutionCount')}</div>
                </div>
              </div>
              <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', margin: 0 }}>
                {report.data_coverage.data_source}
              </p>
            </section>

            {/* Methodology Steps */}
            <section aria-label="Methodology Steps">
              <h2 style={sectionHeadingStyle}>{t('methodology.howItWorks')}</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
                {report.methodology_steps.map((step) => (
                  <div key={step.step} style={stepCardStyle}>
                    <div style={stepNumberStyle} aria-hidden="true">{step.step}</div>
                    <div style={stepBodyStyle}>
                      <h3 style={stepTitleStyle}>{step.title}</h3>
                      <p style={stepDescStyle}>{step.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Data Sources */}
            <section aria-label="Data Sources">
              <h2 style={sectionHeadingStyle}>{t('methodology.dataSources')}</h2>
              <div>
                {report.data_sources.map((src, i) => (
                  <div key={i} style={{ ...sourceRowStyle, ...(i === report.data_sources.length - 1 ? { borderBottom: 'none' } : {}) }}>
                    <div style={sourceTitleStyle}>
                      <a
                        href={src.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: 'var(--color-primary)', textDecoration: 'none' }}
                      >
                        {src.source} ↗
                      </a>
                    </div>
                    <div style={sourceDescStyle}>{src.description}</div>
                  </div>
                ))}
              </div>
            </section>

            {/* Confidence Levels */}
            <section aria-label="Confidence Levels">
              <h2 style={sectionHeadingStyle}>{t('methodology.confidenceLevels')}</h2>
              <div>
                {Object.entries(report.confidence_levels).map(([key, description], i, arr) => (
                  <div key={key} style={{ ...confidenceRowStyle, ...(i === arr.length - 1 ? { borderBottom: 'none' } : {}) }}>
                    <span style={confidenceBadgeStyle}>{key}</span>
                    <span style={{ color: 'var(--color-text-secondary)' }}>{description}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* Limitations */}
            <section aria-label="Limitations">
              <h2 style={sectionHeadingStyle}>{t('methodology.limitations')}</h2>
              <div>
                {report.limitations.map((limitation, i) => (
                  <div key={i} style={{ ...limitationItemStyle, ...(i === report.limitations.length - 1 ? { borderBottom: 'none' } : {}) }}>
                    <span style={{ color: 'var(--color-warning)', flexShrink: 0 }} aria-hidden="true">&#9888;</span>
                    <span>{limitation}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
}

export default MethodologyReport;
