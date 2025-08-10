import { useTableOperations } from '~/hooks/tableToolBarOperation';
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
  PaintBucket,
  SquareArrowOutUpRight,
  Logs,
  Plus,
} from "lucide-react";
import { useState, useRef, useEffect, useCallback } from "react";
import { useDebounce } from "use-debounce";

interface Props {
  tableId: string;
  baseId: string;
  columns: Array<{ id: string; name: string; visible: boolean }>;
  onSearchChange?: (value: string) => void;
  searchResult?: { totalMatches: number };
  onToggleColumnVisibility: (columnId: string) => void;
  columnVisibility: Record<string, boolean>;
  onCreateManyRows?: (count: number) => void;
  isBulkCreating?: boolean;
  bulkCreationProgress?: {
    isCreating: boolean;
    created: number;
    batchNumber: number;
    totalBatches: number;
  };
}

export default function TableToolbar({
  tableId,
  baseId,
  onSearchChange,
  searchResult,
  onToggleColumnVisibility,
  columns,
  columnVisibility,
  onCreateManyRows,
  isBulkCreating = false,
  bulkCreationProgress,
}: Props) {
  
  // ============================================================================
  // CENTRALIZED OPERATIONS HOOK
  // ============================================================================
  
  const {
    operations,
    activeFiltersCount,
    activeSortsCount,
    // Filter  
    addFilter,
    removeFilter,
    applyFilters,
    clearAllFilters,
    setFilterLogicalOperator,
    
    // Sort
    addSortRule,
    updateSortRule,
    removeSortRule,
    applySorts,
    clearAllSorts,
    
    // Loading states
    isFilterLoading,
    isSortLoading,

  } = useTableOperations({ tableId, baseId, columns });

  // ============================================================================
  // LOCAL UI STATE (only for dropdowns)
  // ============================================================================
    // Hide
  const [showSearchBox, setShowSearchBox] = useState(false);
  const [showHideFields, setShowHideFields] = useState(false);
  const isAnyColumnHidden = Object.values(columnVisibility).some((visible) => !visible);

  // Search 
  const [inputValue, setInputValue] = useState("");
  const [debounced] = useDebounce(inputValue, 300);

  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [tempFilterForm, setTempFilterForm] = useState({
    columnId: '',
    operator: 'contains',
    value: ''
  });

  // Refs for click outside
  const toolbarRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const hideFieldsRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  // ============================================================================
  // EFFECTS
  // ============================================================================
  
  useEffect(() => {
      if (onSearchChange) onSearchChange(debounced);
    }, [debounced, onSearchChange]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (hideFieldsRef.current && !hideFieldsRef.current.contains(event.target as Node)) {
        setShowHideFields(false);
      }
      // Close the search dropdown if click is outside it
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        if (activeDropdown === 'search') setActiveDropdown(null);
      }
    };

  document.addEventListener('mousedown', handleClickOutside);
  return () => document.removeEventListener('mousedown', handleClickOutside);
}, [activeDropdown]);


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
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);


  // ============================================================================
  // HANDLERS
  // ============================================================================
  
  const handleDropdownToggle = (dropdownName: string) => {
    setActiveDropdown(prev => prev === dropdownName ? null : dropdownName);
  };

  const handleAddFilter = () => {
    if (!tempFilterForm.columnId) return;
    
    const requiresValue = !['is empty', 'is not empty'].includes(tempFilterForm.operator);
    if (requiresValue && !tempFilterForm.value.trim()) return;

    addFilter({
      columnId: tempFilterForm.columnId,
      operator: tempFilterForm.operator,
      value: requiresValue ? tempFilterForm.value : '',
    });

    setTempFilterForm({ columnId: '', operator: 'contains', value: '' });
  };

  const handleApplyFiltersWithClose = useCallback(async () => {
    try {
      await applyFilters();
      setActiveDropdown(null);
    } catch (error) {
      console.error('Failed to apply filters:', error);
    }
  }, [applyFilters]);

  const handleApplySortsWithClose = useCallback(async () => {
    try {
      await applySorts();
      setActiveDropdown(null);
    } catch (error) {
      console.error('Failed to apply sorts:', error);
    }
  }, [applySorts]);

  // ============================================================================
  // RENDER FUNCTIONS
  // ============================================================================
  
  const renderSearchDropdown = () => (
    <div ref={searchRef}
        className="absolute right-0 top-full mt-1 z-50 w-64 bg-white border rounded shadow-md px-3 py-2 text-sm">
      <div className="flex items-center justify-between mb-2">
        <span className="font-medium text-gray-700">Search</span>
        <button
          onClick={() => {
            setActiveDropdown(null);
            onSearchChange?.("");
            setInputValue("");
          }}
        >
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
  );

  const renderColumnVisibilityDropdown = () => (
    <div className="absolute right-0 top-full mt-1 z-50 w-64 bg-white border rounded shadow-md px-3 py-2 text-sm">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-medium text-gray-700">Column Visibility</span>
        <button onClick={() => setActiveDropdown(null)}>
          <X className="w-4 h-4 text-gray-500 hover:text-gray-700" />
        </button>
      </div>
      <div className="flex flex-col gap-2 max-h-60 overflow-y-auto">
        {columns.map((column) => (
          <div key={column.id} className="flex items-center justify-between">
            <span>{column.name}</span>
            <button
              onClick={() => onToggleColumnVisibility(column.id)}
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
  );

  const renderFilterDropdown = () => (
    <div className="absolute right-4 top-full bg-white border border-gray-200 shadow-lg z-40 mt-1 rounded-md w-80">
      <div className="px-3 py-3">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-gray-700">Filter Records</span>
          <button onClick={() => setActiveDropdown(null)}>
            <X className="w-4 h-4 text-gray-500 hover:text-gray-700" />
          </button>
        </div>

        {/* Logical Operator Selection */}
        {operations.filters.length > 1 && (
          <div className="mb-4 p-3 bg-gray-50 rounded border">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Show rows that match:
            </label>
            <div className="flex gap-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  value="AND"
                  checked={operations.filterLogicalOperator === 'AND'}
                  onChange={(e) => setFilterLogicalOperator(e.target.value as 'AND' | 'OR')}
                  className="mr-2"
                />
                <span className="text-sm">All conditions (AND)</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  value="OR"
                  checked={operations.filterLogicalOperator === 'OR'}
                  onChange={(e) => setFilterLogicalOperator(e.target.value as 'AND' | 'OR')}
                  className="mr-2"
                />
                <span className="text-sm">Any condition (OR)</span>
              </label>
            </div>
          </div>
        )}

        {/* Active Filters */}
        {operations.filters.length > 0 && (
          <div className="mb-3">
            <div className="text-xs text-gray-600 mb-2">Applied Filters:</div>
            {operations.filters.map((filter, index) => (
              <div key={index} className="flex items-center justify-between bg-gray-50 px-2 py-1 rounded text-xs mb-1">
                <span>
                  {index > 0 && (
                    <span className="text-gray-500 mr-1">{operations.filterLogicalOperator}</span>
                  )}
                  {columns.find(col => col.id === filter.columnId)?.name} {filter.operator} 
                  {filter.value ? ` "${filter.value}"` : ''}
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

        {/* Add Filter Form */}
        <div className="space-y-2">
          <select
            value={tempFilterForm.columnId}
            onChange={(e) => setTempFilterForm(prev => ({ ...prev, columnId: e.target.value }))}
            className="px-2 py-1.5 border border-gray-300 rounded text-xs w-full"
          >
            <option value="">Select Column</option>
            {columns.map((column) => (
              <option key={column.id} value={column.id}>{column.name}</option>
            ))}
          </select>

          <select
            value={tempFilterForm.operator}
            onChange={(e) => setTempFilterForm(prev => ({ ...prev, operator: e.target.value }))}
            className="px-2 py-1.5 border border-gray-300 rounded text-xs w-full"
          >
            <option value="contains">contains</option>
            <option value="does not contain">does not contain</option>
            <option value="is">is</option>
            <option value="is not">is not</option>
            <option value="is empty">is empty</option>
            <option value="is not empty">is not empty</option>
          </select>

          {!['is empty', 'is not empty'].includes(tempFilterForm.operator) && (
            <input
              type="text"
              value={tempFilterForm.value}
              onChange={(e) => setTempFilterForm(prev => ({ ...prev, value: e.target.value }))}
              className="px-2 py-1.5 border border-gray-300 rounded text-xs w-full"
              placeholder="Enter value"
            />
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 mt-3">
          <button
            onClick={handleAddFilter}
            disabled={!tempFilterForm.columnId || 
              (!['is empty', 'is not empty'].includes(tempFilterForm.operator) && !tempFilterForm.value.trim())}
            className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs flex-1 disabled:bg-gray-300"
          >
            Add Filter
          </button>
          
          {operations.filters.length > 0 && (
            <>
              <button
                onClick={handleApplyFiltersWithClose}
                disabled={isFilterLoading}
                className="px-3 py-1.5 bg-green-600 text-white rounded text-xs flex-1 disabled:bg-gray-400"
              >
                {isFilterLoading ? "Applying..." : "Apply"}
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
      </div>
    </div>
  );

  const renderSortDropdown = () => (
    <div className="absolute right-0 top-full mt-1 z-50 w-96 bg-white border rounded shadow-md px-3 py-3 text-sm">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-gray-700">Sort Rows</span>
        <button onClick={() => setActiveDropdown(null)}>
          <X className="w-4 h-4 text-gray-500 hover:text-gray-700" />
        </button>
      </div>

      {/* Sort Rules */}
      <div className="space-y-3">
        {operations.sortRules.map((rule, index) => (
          <div key={index} className="space-y-2">
            {index > 0 && (
              <div className="text-xs text-gray-500 font-medium">
                Then sort by:
              </div>
            )}
            
            <div className="flex gap-2 items-center">
              {index === 0 && (
                <span className="text-xs text-gray-500 font-medium min-w-fit">Sort by:</span>
              )}

              <select
                value={rule.columnId}
                onChange={(e) => updateSortRule(index, 'columnId', e.target.value)}
                className="flex-1 border px-2 py-1 rounded text-xs"
              >
                <option value="">Select column</option>
                {columns.map((col) => (
                  <option key={col.id} value={col.id}>{col.name}</option>
                ))}
              </select>

              <select
                value={rule.direction}
                onChange={(e) => updateSortRule(index, 'direction', e.target.value)}
                className="w-32 border px-2 py-1 rounded text-xs"
              >
                <option value="asc">A → Z / 1 → 9</option>
                <option value="desc">Z → A / 9 → 1</option>
              </select>

              <button
                onClick={() => removeSortRule(index)}
                className="text-red-500 hover:text-red-700 p-1"
                title="Remove this sort rule"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2 mt-4">
        <button
          onClick={addSortRule}
          className="text-blue-600 hover:text-blue-800 text-xs px-2 py-1 border border-blue-200 rounded hover:bg-blue-50"
        >
          <Plus className="w-3 h-3 inline mr-1" />
          Add sort
        </button>

        <button
          onClick={handleApplySortsWithClose}
          disabled={isSortLoading || operations.sortRules.every(rule => !rule.columnId)}
          className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-1 rounded flex-1 disabled:bg-gray-400"
        >
          {isSortLoading ? "Applying..." : "Apply Sort"}
        </button>

        {activeSortsCount > 0 && (
          <button
            onClick={clearAllSorts}
            className="text-red-600 hover:text-red-800 text-xs px-2 py-1 border border-red-200 rounded hover:bg-red-50"
          >
            Clear All
          </button>
        )}
      </div>
    </div>
  );

  // ============================================================================
  // MAIN RENDER
  // ============================================================================
  
  return (
    <div className="relative" ref={toolbarRef}>
      {/* Main Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 text-sm text-gray-700 bg-white">
        {/* Left side */}
        <div className="flex items-center gap-3">
          <button className="p-1 hover:bg-gray-100 rounded">
            <Menu className="w-4 h-4 text-gray-600" />
          </button>
          <button className="flex items-center gap-2 px-2 py-1 hover:bg-gray-100 rounded">
            <Grid3X3 className="w-4 h-4 text-[#1778f7]" />
            <span>Grid view</span>
            <ChevronDown className="w-3 h-3 text-gray-500" />
          </button>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-3">
          {/* Hide Fields */}
          <div className="relative">
            <button
              onClick={() => handleDropdownToggle('hide-fields')}
              className={`flex items-center gap-1 px-2 py-1 rounded-md transition-colors ${
                isAnyColumnHidden ? "bg-blue-100 text-blue-700" : "hover:bg-gray-100"
              }`}
            >
              <EyeOff className="w-4 h-4" />
              Hide fields
            </button>
            {activeDropdown === 'hide-fields' && renderColumnVisibilityDropdown()}
          </div>

          {/* Filter */}
          <div className="relative">
            <button
              onClick={() => handleDropdownToggle('filter')}
              className={`flex items-center gap-1 px-2 py-1 rounded-md transition-colors ${
                activeFiltersCount > 0
                  ? "bg-green-100 text-green-700"
                  : activeDropdown === 'filter'
                  ? "text-gray-600"
                  : "hover:bg-gray-100"
              }`}
            >
              <ListFilter className="w-4 h-4" />
              Filter {activeFiltersCount > 0 && `(${activeFiltersCount})`}
              {isFilterLoading && <div className="w-3 h-3 border border-gray-400 border-t-transparent rounded-full animate-spin ml-1" />}
            </button>
            {activeDropdown === 'filter' && renderFilterDropdown()}
          </div>

          {/* Group */}
          <button className="flex items-center gap-1 px-2 py-1 rounded-md hover:bg-gray-100">
            <Logs className="w-4 h-4" />
            Group
          </button>

          {/* Sort */}
          <div className="relative">
            <button
              onClick={() => handleDropdownToggle('sort')}
              className={`flex items-center gap-1 px-2 py-1 rounded-md transition-colors ${
                activeSortsCount > 0
                  ? "bg-[#ffe0cc] text-gray-700"
                  : activeDropdown === 'sort'
                  ? "text-gray-600"
                  : "hover:bg-gray-100"
              }`}
            >
              <ArrowUpDown className="w-4 h-4" />
              Sort {activeSortsCount > 0 && `(${activeSortsCount})`}
              {isSortLoading && <div className="w-3 h-3 border border-gray-400 border-t-transparent rounded-full animate-spin ml-1" />}
            </button>
            {activeDropdown === 'sort' && renderSortDropdown()}
          </div>

          {/* Color */}
          <button className="flex items-center gap-1 px-2 py-1 rounded-md hover:bg-gray-100">
            <PaintBucket className="w-4 h-4" />
            Color
          </button>

          {/* Bulk Create */}
          {onCreateManyRows && (
            <button
              onClick={() => onCreateManyRows(15000)}
              disabled={isBulkCreating}
              className={`flex items-center gap-1 text-xs px-3 py-1 rounded-xl transition-colors ${
                isBulkCreating
                  ? "bg-blue-100 text-blue-700 cursor-not-allowed"
                  : "bg-gray-600 hover:bg-gray-500 text-white"
              }`}
              title="Add 15,000 rows in optimized batches"
            >
              {isBulkCreating ? (
                <>
                  <div className="w-3 h-3 border border-blue-700 border-t-transparent rounded-full animate-spin" />
                  Batch {bulkCreationProgress?.batchNumber || 0}...
                </>
              ) : (
                "Add 15k Rows"
              )}
            </button>
          )}

          {/* Share and sync */}
          <button className="flex items-center gap-1 px-2 py-1 rounded-md hover:bg-gray-100">
            <SquareArrowOutUpRight className="w-4 h-4" />
            Share and sync
          </button>

          {/* Search */}
          <div className="relative">
            <button
              onClick={() => handleDropdownToggle('search')}
              className={`p-1 hover:bg-gray-100 rounded transition-colors ${
              inputValue.trim() ? "bg-blue-100 text-blue-700" : ""
              }`}
            >
              <Search className="w-4 h-4 text-gray-600" />
            </button>
            {activeDropdown === 'search' && renderSearchDropdown()}
          </div>
        </div>
      </div>

      {/* Bulk Creation Progress */}
      {isBulkCreating && bulkCreationProgress && (
        <div className="px-4 py-2 bg-blue-50 border-b border-blue-200">
          <div className="flex items-center justify-between text-sm text-blue-800 mb-1">
            <span>Creating 15,000 rows...</span>
            <span>{Math.round((bulkCreationProgress.created / 15000) * 100)}%</span>
          </div>
          <div className="w-full bg-blue-200 rounded-full h-1.5">
            <div 
              className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
              style={{ 
                width: `${(bulkCreationProgress.created / 15000) * 100}%` 
              }}
            />
          </div>
          <div className="text-xs text-blue-600 mt-1">
            {bulkCreationProgress.created.toLocaleString()} of 15,000 rows created
            {bulkCreationProgress.batchNumber > 0 && 
              ` • Batch ${bulkCreationProgress.batchNumber}/${bulkCreationProgress.totalBatches}`}
          </div>
        </div>
      )}

      {/* Operation Status Indicators
      {(isFilterLoading || isSortLoading || operations.searchTerm) && (
        <div className="px-4 py-1 bg-gray-50 border-b border-gray-200 text-xs text-gray-600 flex items-center gap-4">
          {operations.searchTerm && (
            <div className="flex items-center gap-1">
              <Search className="w-3 h-3" />
              <span>Searching for: "{operations.searchTerm}"</span>
              <span className="text-gray-500">
                ({operations.searchResults.totalMatches} matches)
              </span>
            </div>
          )}
          
          {activeFiltersCount > 0 && (
            <div className="flex items-center gap-1">
              <ListFilter className="w-3 h-3 text-green-600" />
              <span>{activeFiltersCount} filter{activeFiltersCount > 1 ? 's' : ''} active</span>
              {isFilterLoading && <div className="w-3 h-3 border border-green-600 border-t-transparent rounded-full animate-spin" />}
            </div>
          )}
          
          {activeSortsCount > 0 && (
            <div className="flex items-center gap-1">
              <ArrowUpDown className="w-3 h-3 text-orange-600" />
              <span>{activeSortsCount} sort{activeSortsCount > 1 ? 's' : ''} active</span>
              {isSortLoading && <div className="w-3 h-3 border border-orange-600 border-t-transparent rounded-full animate-spin" />}
            </div>
          )}
          
          {isAnyColumnHidden && (
            <div className="flex items-center gap-1">
              <EyeOff className="w-3 h-3 text-blue-600" />
              <span>Some columns hidden</span>
            </div>
          )}
        </div>
      )} */}
    </div>
  );
}