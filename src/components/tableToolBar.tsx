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

interface Props {
  onSearchChange?: (value: string) => void;
  searchResult?: { totalMatches: number };
  onToggleColumnVisibility: (columnId: string) => void;
  columns: { id: string; name: string }[];
  data: any[];
  onFilteredDataChange?: (filteredData: any[] | null) => void;
  tableId: string;
}

export default function TableToolbar({
  onSearchChange,
  searchResult,
  onToggleColumnVisibility,
  columns,
  data,
  onFilteredDataChange,
  tableId,
}: Props) {
  const [inputValue, setInputValue] = useState("");
  const [debounced] = useDebounce(inputValue, 300);
  const [showSearchBox, setShowSearchBox] = useState(false);
  const [showHideFields, setShowHideFields] = useState(false);
  const [selectedColumns, setSelectedColumns] = useState<Record<string, boolean>>({});
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [filters, setFilters] = useState<any[]>([]);
  const [selectedColumn, setSelectedColumn] = useState<string>("");
  const [selectedOperator, setSelectedOperator] = useState<string>("contains");
  const [filterValue, setFilterValue] = useState<string>("");
  
  const inputRef = useRef<HTMLInputElement>(null);
  const hideFieldsRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  const filterRecordsMutation = api.filter.getFilteredRecords.useMutation();

  useEffect(() => {
    if (onSearchChange) onSearchChange(debounced);
  }, [debounced, onSearchChange]);

  const handleFilterButtonClick = () => {
    setShowFilterDropdown(!showFilterDropdown);
    setShowHideFields(false);
    setShowSearchBox(false);
  };

  const handleToggleColumn = (columnId: string) => {
    setSelectedColumns((prev) => {
      const newSelectedColumns = { ...prev };
      newSelectedColumns[columnId] = !newSelectedColumns[columnId];
      onToggleColumnVisibility(columnId);
      return newSelectedColumns;
    });
  };

  // Check if the selected operator requires a value
  const operatorRequiresValue = (operator: string) => {
    return !["is empty", "is not empty"].includes(operator);
  };

  const addFilter = () => {
    const requiresValue = operatorRequiresValue(selectedOperator);
    
    if (selectedColumn && (filterValue || !requiresValue)) {
      const selectedColumnData = columns.find((col) => col.id === selectedColumn);
      if (selectedColumnData) {
        setFilters((prevFilters) => [
          ...prevFilters,
          {
            columnId: selectedColumn,
            columnName: selectedColumnData.name,
            operator: selectedOperator,
            value: requiresValue ? filterValue : "", // Empty string for empty/not empty operators
          },
        ]);
        setFilterValue("");
        setSelectedColumn("");
        setSelectedOperator("contains");
      }
    }
  };

  const applyFilters = async () => {
    try {
      console.log("Applying filters:", filters);
      
      const filtersForApi = filters.map(({ columnId, operator, value }) => ({
        columnId,
        operator,
        value,
      }));

      console.log("Filters for API:", filtersForApi);
      
      const result = await filterRecordsMutation.mutateAsync({
        tableId: tableId, 
        filters: filtersForApi 
      });
      
      console.log("Filter result:", result);
      
      if (onFilteredDataChange) {
        onFilteredDataChange(result);
      }
      
    } catch (error) {
      console.error("Error applying filters:", error);
    }
  };

  const clearAllFilters = async () => {
    setFilters([]);
    setSelectedColumn("");
    setSelectedOperator("contains");
    setFilterValue("");
    
    if (onFilteredDataChange) {
      onFilteredDataChange(null);
    }
  };

  const removeFilter = (index: number) => {
    const newFilters = filters.filter((_, i) => i !== index);
    setFilters(newFilters);
    
    if (newFilters.length === 0) {
      if (onFilteredDataChange) {
        onFilteredDataChange(null);
      }
    }
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
          </div>

          {/* Filter Button */}
          <button
            onClick={handleFilterButtonClick}
            className={`flex items-center gap-1 hover:underline ${showFilterDropdown ? 'text-blue-600' : ''}`}
          >
            <ListFilter className="w-4 h-4" />
            Filter
          </button>

          <button className="flex items-center gap-1 hover:underline">
            <ArrowUpDown className="w-4 h-4" />
            Sort
          </button>

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

            {/* Show applied filters */}
            {filters.length > 0 && (
              <div className="mb-3">
                <div className="text-xs text-gray-600 mb-2">Applied Filters:</div>
                {filters.map((filter, index) => (
                  <div key={index} className="flex items-center justify-between bg-gray-50 px-2 py-1 rounded text-xs mb-1">
                    <span>
                      {filter.columnName} {filter.operator} 
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

              {/* Operator Dropdown - Now includes empty/not empty */}
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
                disabled={!selectedColumn || (operatorRequiresValue(selectedOperator) && !filterValue)}
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