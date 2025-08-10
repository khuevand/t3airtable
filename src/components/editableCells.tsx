import { useState, useRef, useCallback, useMemo } from "react";
import { api } from "~/utils/api";
import { highlightSearchTerm } from "~/components/highlightSearchTerm";

interface EditableCellProps {
  initialValue: string;
  tableId: string;
  rowId: string;
  columnId: string;
  searchTerm?: string;
}

const EditableCell: React.FC<EditableCellProps> = ({
  initialValue,
  rowId,
  columnId,
  searchTerm = '',
}) => {
  // State
  const [value, setValue] = useState(initialValue ?? '');
  const [isEditing, setIsEditing] = useState(false);
  
  // Refs
  const inputRef = useRef<HTMLInputElement>(null);
  
  // API
  const updateCell = api.cell.updateCell.useMutation();

  const handleBlur = useCallback(() => {
    setIsEditing(false);
    if (value !== initialValue) {
      updateCell.mutate({ rowId, columnId, value: value || null });
    }
  }, [value, initialValue, updateCell, rowId, columnId]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value);
  }, []);

  const handleFocus = useCallback(() => {
    setIsEditing(true);
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      inputRef.current?.blur();
    }
    if (e.key === 'Escape') {
      setValue(initialValue || '');
      inputRef.current?.blur();
    }
  }, [initialValue]);

  const highlightedText = useMemo(() => 
    highlightSearchTerm(String(value || ''), searchTerm), 
    [value, searchTerm]
  );

  return (
    <div className="relative w-full min-h-[32px] flex items-center">
      {isEditing ? (
        // Show input when editing
        <input
          ref={inputRef}
          className="w-full h-full border-none bg-transparent text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500 px-1"
          value={value}
          onChange={handleChange}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          autoFocus
        />
      ) : (
        // Show display version when not editing
        <div 
          className="w-full h-full px-1 py-1 cursor-text flex items-center min-h-[32px]"
          onClick={handleFocus}
          onDoubleClick={handleFocus}
        >
          {value ? (
            <div dangerouslySetInnerHTML={{ __html: highlightedText }} />
          ) : null}
        </div>
      )}
    </div>
  );
};

export default EditableCell;