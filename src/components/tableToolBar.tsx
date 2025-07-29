import {
  EyeOff,
  ListFilter,
  ArrowUpDown,
  X,
  Search,
  Menu,
  Grid3X3,
  ChevronDown,
  ToggleLeft,
  ToggleRight
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useDebounce } from "use-debounce";

interface Props {
  onSearchChange?: (value: string) => void;
  searchResult?: { totalMatches: number };
  onToggleColumnVisibility: (columnId: string) => void; // Pass column visibility toggle function
  columns: { id: string; name: string }[]; // Pass the columns data to render hide/show options
}

export default function TableToolbar({ onSearchChange, searchResult, onToggleColumnVisibility, columns }: Props) {
  const [inputValue, setInputValue] = useState("");
  const [debounced] = useDebounce(inputValue, 300);
  const [showSearchBox, setShowSearchBox] = useState(false);
  const [showHideFields, setShowHideFields] = useState(false);
  const [selectedColumns, setSelectedColumns] = useState<Record<string, boolean>>({});
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (onSearchChange) onSearchChange(debounced);
  }, [debounced, onSearchChange]);

  useEffect(() => {
    if (showSearchBox) {
      setTimeout(() => inputRef.current?.focus(), 50); // focus after render
    } else {
      setInputValue("");
      onSearchChange?.("");
    }
  }, [showSearchBox]);

  const handleToggleColumn = (columnId: string) => {
    setSelectedColumns((prev) => {
      const newSelectedColumns = { ...prev };
      newSelectedColumns[columnId] = !newSelectedColumns[columnId]; // Toggle the visibility
      onToggleColumnVisibility(columnId); // Update column visibility
      return newSelectedColumns;
    });
  };

  return (
    <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 text-sm text-gray-700 bg-white">
      {/* Left side - Menu and Grid view */}
      <div className="flex items-center gap-3">
        <button className="p-1 hover:bg-gray-100 rounded">
          <Menu className="w-4 h-4 text-gray-600" />
        </button>
        
        <button className="flex items-center gap-2 px-2 py-1 hover:bg-gray-100 rounded">
          <Grid3X3 className="w-4 h-4 text-blue-600" />
          <span>Grid view</span>
          <ChevronDown className="w-3 h-3 text-gray-500" />
        </button>
      </div>

      {/* Right side - Hide fields, Filter, Sort, and Search */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setShowHideFields(!showHideFields)}
          className="flex items-center gap-1 hover:underline"
        >
          <EyeOff className="w-4 h-4" />
          Hide fields
        </button>

        {showHideFields && (
          <div className="absolute right-0 top-8 z-50 w-64 bg-white border rounded shadow px-3 py-2 text-sm">
            <div className="mb-2">
              <span className="font-medium text-gray-700">Select Columns to Hide</span>
              <button onClick={() => setShowHideFields(false)} className="absolute top-0 right-0 text-gray-500">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex flex-col gap-2">
              {columns.map((column) => (
                <div key={column.id} className="flex items-center justify-between">
                  <span>{column.name}</span>

                  <button
                    onClick={() => handleToggleColumn(column.id)}
                    className={`p-2 rounded-full ${selectedColumns[column.id] ? 'bg-gray-300' : 'bg-green-400'}`}
                  >
                    {selectedColumns[column.id] ? (
                      <ToggleLeft className="w-4 h-4 text-gray-700" />
                    ) : (
                      <ToggleRight className="w-4 h-4 text-gray-700" />
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <button className="flex items-center gap-1 hover:underline">
          <ListFilter className="w-4 h-4" />
          Filter
        </button>

        <button className="flex items-center gap-1 hover:underline">
          <ArrowUpDown className="w-4 h-4" />
          Sort
        </button>

        {/* Search Icon Toggle */}
        <div className="relative">
          <button
            onClick={() => setShowSearchBox((prev) => !prev)}
            className="p-1 hover:bg-gray-100 rounded"
          >
            <Search className="w-4 h-4 text-gray-600" />
          </button>

          {showSearchBox && (
            <div className="absolute right-0 top-8 z-50 w-64 bg-white border rounded shadow px-3 py-2 text-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-gray-700">Search</span>
                <button onClick={() => setShowSearchBox(false)}>
                  <X className="w-4 h-4 text-gray-500 hover:text-gray-700" />
                </button>
              </div>

              <input
                ref={inputRef}
                type="text"
                placeholder="Search..."
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                className="w-full border px-2 py-1 rounded text-sm outline-none mb-2"
              />

              <div className="text-xs text-gray-500">
                {searchResult?.totalMatches
                  ? `Found ${searchResult.totalMatches} match${
                      searchResult.totalMatches > 1 ? "es" : ""
                    }`
                  : "No matches"}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}