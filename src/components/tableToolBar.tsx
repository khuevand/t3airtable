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
  ToggleRight,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useDebounce } from "use-debounce";
import { api } from "~/utils/api";

// set sorting rules for ascending/ descending
type SortRule = {
  columnId: string;
  direction: "asc" | "desc";
};

interface Props {
  onSearchChange?: (value: string) => void;
  searchResult?: { totalMatches: number };
  onToggleColumnVisibility: (columnId: string) => void;
  columns: { id: string; name: string; visible: boolean }[]; // Add visible property
  columnVisibility: Record<string, boolean>; // Add this prop
  data: any[] | null;
  onFilteredDataChange: (filteredData: any[] | null) => void;
  sortRules: SortRule[];
  setSortRules: React.Dispatch<React.SetStateAction<SortRule[]>>;
  onApplySort: (rules: SortRule[]) => void;
  tableId: string;
}

// FIXED: Define proper filter interface
interface FilterCondition {
  columnId: string;
  operator: string;
  value: string;
}

export default function TableToolbar({
  onSearchChange,
  searchResult,
  onToggleColumnVisibility,
  columns,
  columnVisibility,
  data,
  onFilteredDataChange,
  onApplySort,
  tableId,
}: Props) {
  const [inputValue, setInputValue] = useState("");
  const [debounced] = useDebounce(inputValue, 300);
  const [showSearchBox, setShowSearchBox] = useState(false);
  const [showHideFields, setShowHideFields] = useState(false);
  const [selectedColumns, setSelectedColumns] = useState<Record<string, boolean>>({});
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  
  const [filters, setFilters] = useState<FilterCondition[]>([]);
  const [logicalOperator, setLogicalOperator] = useState<'AND' | 'OR'>('AND');
  const [selectedColumn, setSelectedColumn] = useState<string>("");
  const [selectedOperator, setSelectedOperator] = useState<string>("contains");
  const [filterValue, setFilterValue] = useState<string>("");
  
  // FIXED: Use the enhanced filter mutation with logicalOperator support
  const filterRecordsMutation = api.filter.getFilteredRecords.useMutation({
    onSuccess: (data) => {
      onFilteredDataChange(data);
    },
    onError: (error) => {
      console.error('Filter error:', error);
      onFilteredDataChange(null); // Reset on error
    }
  });

  const [sortRules, setSortRules] = useState<SortRule[]>([
    { columnId: "", direction: "asc" },
  ]);
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const hideFieldsRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);


  useEffect(() => {
    // Reset everything when table changes
    setSelectedColumn("");
    setSelectedOperator("contains");
    setFilterValue("");
  }, [tableId]);


  useEffect(() => {
    if (onSearchChange) onSearchChange(debounced);
  }, [debounced, onSearchChange]);

  const handleFilterButtonClick = () => {
    setShowFilterDropdown(!showFilterDropdown);
    setShowHideFields(false);
    setShowSearchBox(false);
  };

  const handleToggleColumn = (columnId: string) => {
    onToggleColumnVisibility(columnId);
  };

  // Check if the selected operator requires a value
  const operatorRequiresValue = (operator: string) => {
    return !["is empty", "is not empty"].includes(operator);
  };

  // FIXED: Add filter function with proper validation
  const addFilter = () => {
    if (!selectedColumn) return;
    if (operatorRequiresValue(selectedOperator) && !filterValue.trim()) return;

    const newFilter: FilterCondition = {
      columnId: selectedColumn,
      operator: selectedOperator,
      value: operatorRequiresValue(selectedOperator) ? filterValue : '',
    };

    setFilters(prevFilters => [...prevFilters, newFilter]);
    
    // Reset form
    setSelectedColumn("");
    setSelectedOperator("contains");
    setFilterValue("");
  };

  // FIXED: Apply filters with logicalOperator support
  const applyFilters = async () => {
    if (filters.length === 0) {
      // No filters - reset to show all data
      onFilteredDataChange(null);
      return;
    }

    try {
      console.log("Applying filters:", filters);
      console.log("Logical operator:", logicalOperator);
      
      const result = await filterRecordsMutation.mutateAsync({
        tableId: tableId,
        filters: filters,
        logicalOperator: logicalOperator,
      });
      
      console.log("Filter result:", result);
    } catch (error) {
      console.error("Error applying filters:", error);
    }
  };

  const removeFilter = (index: number) => {
    setFilters(prevFilters => {
      const newFilters = prevFilters.filter((_, i) => i !== index);
      
      // FIXED: If no filters left, immediately reset the table data
      if (newFilters.length === 0) {
        onFilteredDataChange(null);
      }
      
      return newFilters;
    });
  };

  // FIXED: Clear all filters function
  const clearAllFilters = () => {
    setFilters([]);
    setSelectedColumn("");
    setSelectedOperator("contains");
    setFilterValue("");
    setLogicalOperator('AND');
    // FIXED: Immediately reset filtered data to show all table data
    onFilteredDataChange(null);
  };

  // FIXED: Get column name for display
  const getColumnName = (columnId: string) => {
    return columns.find(col => col.id === columnId)?.name || columnId;
  };

  const sortRecordsMutation = api.sort.getSortedRecords.useMutation({
    onSuccess: (data) => {
      onFilteredDataChange(data); // render sorted table
    },
  });

  const applySort = () => {
    const validSorts = sortRules.filter(rule => rule.columnId !== "");
    onApplySort(validSorts);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (hideFieldsRef.current && !hideFieldsRef.current.contains(event.target as Node)) {
        setShowHideFields(false);
      }
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSearchBox(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div className="relative">
      {/* Main Toolbar */}
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
          {/* Hide Fields */}
          <div className="relative" ref={hideFieldsRef}>
            <button
              onClick={() => {
                setShowHideFields(!showHideFields);
                setShowSearchBox(false);
              }}
              className="flex items-center gap-1 hover:underline"
            >
              <EyeOff className="w-4 h-4" />
              Hide fields
            </button>
            {showHideFields && (
              <div className="absolute right-0 top-full mt-1 z-50 w-64 bg-white border rounded shadow-md px-3 py-2 text-sm">
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-medium text-gray-700">Select Columns to Hide</span>
                  <button
                    onClick={() => setShowHideFields(false)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                  <div className="flex flex-col gap-2">
                    {columns.map((column) => (
                      <div key={column.id} className="flex items-center justify-between">
                        <span>{column.name}</span>
                        <button
                          onClick={() => handleToggleColumn(column.id)}
                          className={`p-2 rounded-full ${
                            !columnVisibility[column.id] ? 'bg-gray-300' : 'bg-green-400'
                          }`}
                        >
                          {!columnVisibility[column.id] ? (
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
          </div>

          {/* Filter Button - FIXED: Show filter count */}
          <button
            onClick={handleFilterButtonClick}
            className={`flex items-center gap-1 hover:underline ${showFilterDropdown ? 'text-blue-600' : ''}`}
          >
            <ListFilter className="w-4 h-4" />
            Filter {filters.length > 0 && `(${filters.length})`}
          </button>

          {/* Sort */}
          <button
            onClick={() => {
              setShowFilterDropdown(false);
              setShowHideFields(false);
              setShowSearchBox(false);
              setShowSortDropdown(prev => !prev);
            }}
            className={`flex items-center gap-1 hover:underline ${showSortDropdown ? 'text-blue-600' : ''}`}
          >
            <ArrowUpDown className="w-4 h-4" />
            Sort {sortRules.length > 0 && `(${sortRules.length})`}
          </button>

          {/* Sort Dropdown Panel */}
          {showSortDropdown && (
            <div className="absolute right-0 top-full mt-1 z-50 w-80 bg-white border rounded shadow-md px-3 py-3 text-sm">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-gray-700">Sort Rows</span>
                <button
                  onClick={() => setShowSortDropdown(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Sort Rule List */}
              {sortRules.map((rule, index) => (
                <div key={index} className="flex gap-2 mb-2">
                  {/* Column Selector */}
                  <select
                    value={rule.columnId}
                    onChange={(e) => {
                      const updated = [...sortRules];
                      if (!updated[index]) return;
                      updated[index].columnId = e.target.value;
                      setSortRules(updated);
                    }}
                    className="flex-1 border px-2 py-1 rounded text-xs"
                  >
                    <option value="">Select column</option>
                    {columns.map((col) => (
                      <option key={col.id} value={col.id}>{col.name}</option>
                    ))}
                  </select>

                  {/* Direction Selector */}
                  <select
                    value={rule.direction}
                    onChange={(e) => {
                      const updated = [...sortRules];
                      if (!updated[index]) return;
                      updated[index].direction = e.target.value as "asc" | "desc";
                      setSortRules(updated);
                    }}
                    className="w-24 border px-2 py-1 rounded text-xs"
                  >
                    <option value="asc">A → Z / 1 → 9</option>
                    <option value="desc">Z → A / 9 → 1</option>
                  </select>

                  {/* Remove sort rule */}
                  {index > 0 && (
                    <button
                      onClick={() =>
                        setSortRules(prev => prev.filter((_, i) => i !== index))
                      }
                      className="text-xs text-red-500"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}

              {/* Add another sort */}
              <button
                onClick={() =>
                  setSortRules(prev => [...prev, { columnId: "", direction: "asc" }])
                }
                className="text-blue-600 text-xs mt-1"
              >
                + Add another sort
              </button>

              {/* Apply Sort */}
              <button
                onClick={applySort}
                className="mt-3 bg-blue-600 text-white text-xs px-3 py-1 rounded w-full"
                disabled={sortRules.length === 0 || sortRules.some(rule => !rule.columnId)}
              >
                Apply Sort
              </button>

              {sortRules.length > 0 && (
                <button
                  onClick={() => {
                    setSortRules([]);
                    onApplySort([]);
                  }}
                  className="text-red-600 text-xs mt-2"
                >
                  Clear All Sorts
                </button>
              )}
            </div>
          )}

          {/* Search */}
          <div className="relative" ref={searchRef}>
            <button
              onClick={() => {
                setShowSearchBox(!showSearchBox);
                setShowHideFields(false);
              }}
              className="p-1 hover:bg-gray-100 rounded"
            >
              <Search className="w-4 h-4 text-gray-600" />
            </button>
            {showSearchBox && (
              <div className="absolute right-0 top-full mt-1 z-50 w-64 bg-white border rounded shadow-md px-3 py-2 text-sm">
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

      {/* Filter Component */}
      {showFilterDropdown && (
        <div className="absolute right-4 top-full bg-white border border-gray-200 shadow-lg z-40 mt-1 rounded-md w-80">
          <div className="px-3 py-3">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-700">Filter Records</span>
              <button
                onClick={() => setShowFilterDropdown(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* FIXED: Logical Operator Selection - Only show if multiple filters */}
            {filters.length > 1 && (
              <div className="mb-4 p-3 bg-gray-50 rounded border">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Show rows that match:
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="logicalOperator"
                      value="AND"
                      checked={logicalOperator === 'AND'}
                      onChange={(e) => setLogicalOperator(e.target.value as 'AND' | 'OR')}
                      className="mr-2"
                    />
                    <span className="text-sm">All conditions (AND)</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="logicalOperator"
                      value="OR"
                      checked={logicalOperator === 'OR'}
                      onChange={(e) => setLogicalOperator(e.target.value as 'AND' | 'OR')}
                      className="mr-2"
                    />
                    <span className="text-sm">Any condition (OR)</span>
                  </label>
                </div>
              </div>
            )}

            {/* Show applied filters */}
            {filters.length > 0 && (
              <div className="mb-3">
                <div className="text-xs text-gray-600 mb-2">Applied Filters:</div>
                {filters.map((filter, index) => (
                  <div key={index} className="flex items-center justify-between bg-gray-50 px-2 py-1 rounded text-xs mb-1">
                    {/* Show AND/OR indicator between filters */}
                    <span>
                      {index > 0 && (
                        <span className="text-gray-500 mr-1">{logicalOperator}</span>
                      )}
                      {getColumnName(filter.columnId)} {filter.operator} 
                      {operatorRequiresValue(filter.operator) ? ` "${filter.value}"` : ''}
                    </span>
                    <button
                      onClick={() => removeFilter(index)}
                      className="text-red-500 hover:text-red-700 ml-2"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-2">
              {/* Select Column Dropdown */}
              <select
                value={selectedColumn}
                onChange={(e) => setSelectedColumn(e.target.value)}
                className="px-2 py-1.5 border border-gray-300 rounded text-xs w-full"
              >
                <option value="">Select Column</option>
                {columns.map((column) => (
                  <option key={column.id} value={column.id}>
                    {column.name}
                  </option>
                ))}
              </select>

              {/* Operator Dropdown */}
              <select
                value={selectedOperator}
                onChange={(e) => setSelectedOperator(e.target.value)}
                className="px-2 py-1.5 border border-gray-300 rounded text-xs w-full"
              >
                <option value="contains">contains</option>
                <option value="does not contain">does not contain</option>
                <option value="is">is</option>
                <option value="is not">is not</option>
                <option value="is empty">is empty</option>
                <option value="is not empty">is not empty</option>
              </select>

              {/* Filter Value Input - Only show if operator requires a value */}
              {operatorRequiresValue(selectedOperator) && (
                <input
                  type="text"
                  value={filterValue}
                  onChange={(e) => setFilterValue(e.target.value)}
                  className="px-2 py-1.5 border border-gray-300 rounded text-xs w-full"
                  placeholder="Enter value"
                />
              )}
            </div>

            <div className="flex gap-2 mt-3">
              <button
                onClick={addFilter}
                disabled={!selectedColumn || (operatorRequiresValue(selectedOperator) && !filterValue.trim())}
                className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs flex-1 disabled:bg-gray-300"
              >
                Add Filter
              </button>
              
              {filters.length > 0 && (
                <>
                  <button
                    onClick={applyFilters}
                    disabled={filterRecordsMutation.status === "pending"}
                    className="px-3 py-1.5 bg-green-600 text-white rounded text-xs flex-1 disabled:bg-gray-400"
                  >
                    {filterRecordsMutation.status === "pending" ? "Applying..." : "Apply"}
                  </button>
                  <button
                    onClick={clearAllFilters}
                    className="px-3 py-1.5 bg-red-600 text-white rounded text-xs flex-1"
                  >
                    Clear All
                  </button>
                </>
              )}
            </div>

            {/* Show error if any */}
            {filterRecordsMutation.error && (
              <div className="mt-2 text-xs text-red-600">
                Error: {filterRecordsMutation.error.message}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}