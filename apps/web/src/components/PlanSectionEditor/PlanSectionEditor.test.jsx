import { render } from '@testing-library/react';
import { describe, test, expect, vi } from 'vitest';
import PlanSectionEditor from './PlanSectionEditor';

describe('PlanSectionEditor', () => {
  test('renders TipTap editor element', () => {
    render(
      <PlanSectionEditor
        sectionKey="test_section"
        initialHtml="<p>Test content</p>"
        onSave={vi.fn()}
        onReset={vi.fn()}
        onCancel={vi.fn()}
        saving={false}
      />
    );
    // TipTap renders a .ProseMirror div with contenteditable
    const editor = document.querySelector('.ProseMirror');
    expect(editor).toBeInTheDocument();
  });

  test('renders with contenteditable attribute', () => {
    render(
      <PlanSectionEditor
        sectionKey="test_section"
        initialHtml="<p>Hello</p>"
        onSave={vi.fn()}
        onReset={vi.fn()}
        onCancel={vi.fn()}
        saving={false}
      />
    );
    const editable = document.querySelector('[contenteditable="true"]');
    expect(editable).toBeInTheDocument();
  });

  test('renders toolbar buttons for bold, italic, and list', () => {
    render(
      <PlanSectionEditor
        sectionKey="student_summary"
        initialHtml=""
        onSave={vi.fn()}
        onReset={vi.fn()}
        onCancel={vi.fn()}
        saving={false}
      />
    );
    const boldBtn = document.querySelector('button[title="Bold"]');
    const italicBtn = document.querySelector('button[title="Italic"]');
    const listBtn = document.querySelector('button[title="Bullet List"]');
    expect(boldBtn).toBeInTheDocument();
    expect(italicBtn).toBeInTheDocument();
    expect(listBtn).toBeInTheDocument();
  });
});
