// REQ-17: Per-section rich text editor (TipTap)
// Props: sectionKey, initialHtml, onSave, onReset, onCancel, saving
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';

function PlanSectionEditor({ sectionKey, initialHtml, onSave, onReset, onCancel, saving }) {
  const editor = useEditor({
    extensions: [StarterKit],
    content: initialHtml || '',
  });

  const handleSave = () => {
    if (!editor) return;
    onSave(editor.getHTML());
  };

  const toolbarBtnBase = {
    padding: '3px 8px',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--border-radius-sm)',
    background: 'var(--color-surface)',
    color: 'var(--color-text-primary)',
    cursor: 'pointer',
    fontSize: 'var(--font-size-sm)',
    fontFamily: 'var(--font-family-base)',
    lineHeight: '1.4',
  };

  const toolbarBtnActive = {
    ...toolbarBtnBase,
    background: 'var(--color-primary)',
    color: '#fff',
    borderColor: 'var(--color-primary)',
  };

  const editorWrapStyle = {
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--border-radius-sm)',
    minHeight: '400px',
    padding: 'var(--space-3)',
    background: '#fff',
    overflowY: 'auto',
    fontSize: 'var(--font-size-sm)',
    fontFamily: 'var(--font-family-base)',
    color: 'var(--color-text-primary)',
    lineHeight: '1.6',
    cursor: 'text',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      {/* Section label */}
      <p style={{
        margin: 0,
        fontSize: 'var(--font-size-xs)',
        color: 'var(--color-text-secondary)',
        fontFamily: 'var(--font-family-base)',
      }}>
        Editing: <strong>{sectionKey}</strong>
      </p>

      {/* Mini toolbar */}
      <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => editor && editor.chain().focus().toggleBold().run()}
          style={editor && editor.isActive('bold') ? toolbarBtnActive : toolbarBtnBase}
          title="Bold"
        >
          <strong>B</strong>
        </button>
        <button
          type="button"
          onClick={() => editor && editor.chain().focus().toggleItalic().run()}
          style={editor && editor.isActive('italic') ? toolbarBtnActive : toolbarBtnBase}
          title="Italic"
        >
          <em>I</em>
        </button>
        <button
          type="button"
          onClick={() => editor && editor.chain().focus().toggleBulletList().run()}
          style={editor && editor.isActive('bulletList') ? toolbarBtnActive : toolbarBtnBase}
          title="Bullet List"
        >
          &#8226; List
        </button>
      </div>

      {/* Editor content area */}
      <div style={editorWrapStyle} onClick={() => editor && editor.commands.focus()}>
        <EditorContent editor={editor} />
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          style={{
            padding: 'var(--space-2) var(--space-4)',
            background: 'none',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--border-radius-sm)',
            cursor: saving ? 'not-allowed' : 'pointer',
            fontSize: 'var(--font-size-sm)',
            fontFamily: 'var(--font-family-base)',
            color: 'var(--color-text-secondary)',
          }}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onReset}
          disabled={saving}
          style={{
            padding: 'var(--space-2) var(--space-4)',
            background: 'none',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--border-radius-sm)',
            cursor: saving ? 'not-allowed' : 'pointer',
            fontSize: 'var(--font-size-sm)',
            fontFamily: 'var(--font-family-base)',
            color: 'var(--color-text-secondary)',
          }}
        >
          Reset to Default
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !editor}
          style={{
            padding: 'var(--space-2) var(--space-4)',
            background: saving || !editor ? 'var(--color-border)' : 'var(--color-primary)',
            color: saving || !editor ? 'var(--color-text-secondary)' : '#fff',
            border: 'none',
            borderRadius: 'var(--border-radius-sm)',
            cursor: saving || !editor ? 'not-allowed' : 'pointer',
            fontSize: 'var(--font-size-sm)',
            fontFamily: 'var(--font-family-base)',
            fontWeight: 'var(--font-weight-medium)',
          }}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  );
}

export default PlanSectionEditor;
