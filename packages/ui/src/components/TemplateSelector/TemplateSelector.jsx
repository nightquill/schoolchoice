import { Button } from '../../primitives/button';

const DEFAULT_TEMPLATES = [
  { id: 'professional', label: 'Professional' },
  { id: 'modern', label: 'Modern' },
  { id: 'minimal', label: 'Minimal' },
];

export default function TemplateSelector({
  templateId,
  onTemplateChange,
  templates = DEFAULT_TEMPLATES,
  isPending = false,
}) {
  return (
    <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', flexWrap: 'wrap' }}>
      <span style={{
        fontSize: 'var(--font-size-sm)',
        fontWeight: 'var(--font-weight-medium)',
        color: 'var(--color-text-secondary)',
      }}>
        Template:
      </span>
      {templates.map((t) => (
        <Button
          key={t.id}
          variant={templateId === t.id ? 'default' : 'secondary'}
          size="sm"
          onClick={() => onTemplateChange(t.id)}
          disabled={isPending}
        >
          {t.label}
        </Button>
      ))}
    </div>
  );
}
