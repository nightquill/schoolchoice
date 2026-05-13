import { useNavigate } from 'react-router-dom';
import { Upload, Download, Loader2 } from 'lucide-react';
import { Button } from '../../primitives/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../primitives/dropdown-menu';

const barStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  background: '#FFFFFF',
  padding: 'var(--space-2) var(--space-4)',
  borderBottom: '1px solid var(--color-border)',
  marginBottom: 'var(--space-4)',
};

/**
 * Action bar rendered above the entity list.
 *
 * Props:
 *   entityName       — entity name used for navigation and export labels
 *   onExportFiltered — callback() for "Export filtered results"
 *   onExportAll      — callback() for "Export all"
 *   isExporting      — bool: show spinner on export button when true
 */
export default function ActionBar({ entityName, onExportFiltered, onExportAll, isExporting, hideImport }) {
  const navigate = useNavigate();

  return (
    <div style={barStyle}>
      {/* Left: Import button (hidden for some entities like school) */}
      {!hideImport && (
        <Button
          variant="default"
          onClick={() => navigate(`/entities/${entityName}/import`)}
          aria-label={`Import ${entityName} data`}
        >
          <Upload size={16} />
          <span className="hidden sm:inline">Import Data</span>
        </Button>
      )}
      {hideImport && <div />}

      {/* Right: Export dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger
          disabled={isExporting}
          aria-label="Export data"
          className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md border border-input bg-background px-4 py-2 text-sm font-medium shadow-xs transition-[color,box-shadow] outline-none hover:bg-accent hover:text-accent-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50"
        >
          {isExporting ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Download size={16} />
          )}
          <span className="hidden sm:inline">Export</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onExportFiltered}>
            Export filtered results
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onExportAll}>
            Export all {entityName}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
