import * as React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp, X } from 'lucide-react';

interface DataGridFindBarProps {
  query: string;
  matchCount: number;
  activeMatchIndex: number; // 0-based; meaningless when matchCount is 0
  onQueryChange: (query: string) => void;
  onNext: () => void;
  onPrevious: () => void;
  onClose: () => void;
}

export function DataGridFindBar({
  query,
  matchCount,
  activeMatchIndex,
  onQueryChange,
  onNext,
  onPrevious,
  onClose,
}: DataGridFindBarProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) onPrevious(); else onNext();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onClose();
    }
  };

  return (
    <div className="flex items-center gap-2 border-b bg-muted/30 px-4 py-2">
      <Input
        ref={inputRef}
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Find in grid..."
        className="h-8 max-w-xs"
        aria-label="Find in grid"
      />
      <span className="text-xs text-muted-foreground whitespace-nowrap" aria-live="polite">
        {query.trim() === '' ? '' : matchCount === 0 ? 'No matches' : `${activeMatchIndex + 1} of ${matchCount}`}
      </span>
      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={onPrevious} disabled={matchCount === 0} aria-label="Previous match">
        <ChevronUp className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={onNext} disabled={matchCount === 0} aria-label="Next match">
        <ChevronDown className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={onClose} aria-label="Close find bar">
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
