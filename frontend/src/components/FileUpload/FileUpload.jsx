import { useRef, useState } from 'react';

// FileUpload — drag-and-drop file upload with browse button and progress
function FileUpload({ onFile, accept = '*', loading = false, progress = null }) {
  const inputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);

  const handleFile = (file) => {
    if (!file) return;
    setSelectedFile(file);
    onFile(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    handleFile(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      inputRef.current?.click();
    }
  };

  const handleChange = (e) => {
    handleFile(e.target.files[0]);
  };

  const zoneStyle = {
    border: `2px dashed ${isDragging ? 'var(--color-primary)' : 'var(--color-border)'}`,
    borderRadius: 'var(--border-radius-md)',
    padding: 'var(--space-6)',
    textAlign: 'center',
    background: isDragging ? 'rgba(37,99,235,0.04)' : 'var(--color-background)',
    cursor: loading ? 'wait' : 'pointer',
    outline: 'none',
    transition: 'none',
  };

  const labelStyle = {
    fontSize: 'var(--font-size-sm)',
    color: 'var(--color-text-secondary)',
    marginBottom: 'var(--space-2)',
    display: 'block',
  };

  const progressBarContainerStyle = {
    height: '6px',
    background: 'var(--color-border)',
    borderRadius: 'var(--border-radius-sm)',
    overflow: 'hidden',
    marginTop: 'var(--space-2)',
  };

  const progressBarStyle = {
    height: '100%',
    width: `${progress ?? 0}%`,
    background: 'var(--color-primary)',
    borderRadius: 'var(--border-radius-sm)',
    transition: 'width 0.2s',
  };

  return (
    <div>
      <div
        role="button"
        tabIndex={loading ? -1 : 0}
        aria-label="Upload transcript. Drag file here or press Enter to browse."
        aria-busy={loading}
        style={zoneStyle}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onKeyDown={handleKeyDown}
        onClick={() => !loading && inputRef.current?.click()}
      >
        <span style={labelStyle}>
          {loading
            ? 'Uploading…'
            : selectedFile
            ? selectedFile.name
            : 'Drag file here or'}
        </span>
        {!loading && (
          <button
            type="button"
            style={{
              color: 'var(--color-primary)',
              background: 'none',
              border: 'var(--border-width) solid var(--color-primary)',
              borderRadius: 'var(--border-radius-sm)',
              padding: 'var(--space-2) var(--space-4)',
              cursor: 'pointer',
              fontSize: 'var(--font-size-sm)',
              fontFamily: 'var(--font-family-base)',
            }}
            onClick={(e) => {
              e.stopPropagation();
              inputRef.current?.click();
            }}
          >
            Browse
          </button>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          style={{ display: 'none' }}
          onChange={handleChange}
        />
      </div>
      {progress !== null && (
        <div
          style={progressBarContainerStyle}
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Upload progress"
        >
          <div style={progressBarStyle} />
        </div>
      )}
    </div>
  );
}

export default FileUpload;
