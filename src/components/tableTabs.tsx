import { ChevronDown } from "lucide-react";
import { toast } from "react-toastify";

interface Table {
  id: string;
  name: string;
}

interface TableTabsProps {
  tables: Table[];
  activeTableId: string | null;
  lighterColor: string;
  openDropdownId: string | null;
  removeTableIsPending: boolean;
  addTableIsPending: boolean;
  onSetActiveTable: (tableId: string) => void;
  onToggleDropdown: (tableId: string) => void;
  onDeleteTable: (tableId: string) => void;
  onAddTable: () => void;
}

const TableTabs: React.FC<TableTabsProps> = ({
  tables,
  activeTableId,
  lighterColor,
  openDropdownId,
  removeTableIsPending,
  addTableIsPending,
  onSetActiveTable,
  onToggleDropdown,
  onDeleteTable,
  onAddTable,
}) => {
  const handleDeleteTable = (tableId: string) => {
    if (removeTableIsPending) {
      toast.warn("Table deletion already in progress");
      return;
    }
    onDeleteTable(tableId);
  };

  return (
    <div
      className="flex items-center border-gray-200 text-sm relative"
      style={{ backgroundColor: lighterColor }}
    >
      {tables.map((table) => (
        <div key={table.id} className="relative border-r border-gray-200">
          <div
            className={`flex items-center px-4 py-1 rounded-t-md border border-gray-200 cursor-pointer ${
              table.id === activeTableId
                ? "bg-white text-black border-b-white font-semibold"
                : "text-gray-500 hover:text-black border-transparent"
            }`}
          >
            <button onClick={() => onSetActiveTable(table.id)} className="mr-1">
              {table.name}
            </button>
            <ChevronDown
              size={16}
              className="text-gray-500 hover:text-gray-700"
              onClick={(e) => {
                e.stopPropagation();
                onToggleDropdown(table.id);
              }}
            />
          </div>

          {/* Table choice dropdown menu */}
          {openDropdownId === table.id && (
            <div
              className="absolute z-50 top-full mt-1 left-0 w-56 bg-white border border-gray-200 shadow-lg rounded-md p-1"
            >
              <ul className="text-sm text-gray-700">
                <li className="px-3 py-2 hover:bg-gray-50 cursor-pointer">Import data</li>
                <li className="px-3 py-2 hover:bg-gray-50 cursor-pointer">Rename table</li>
                <li className="px-3 py-2 hover:bg-gray-50 cursor-pointer">Hide table</li>
                <li className="px-3 py-2 hover:bg-gray-50 cursor-pointer">Manage fields</li>
                <li className="px-3 py-2 hover:bg-gray-50 cursor-pointer">Duplicate table</li>
                <li className="px-3 py-2 hover:bg-gray-50 cursor-pointer">Configure date dependencies</li>
                <li className="px-3 py-2 hover:bg-gray-50 cursor-pointer">Edit table description</li>
                <li className="px-3 py-2 hover:bg-gray-50 cursor-pointer">Edit table permissions</li>
                <li
                  className="px-3 py-2 text-red-600 hover:bg-red-50 cursor-pointer"
                  onClick={() => handleDeleteTable(table.id)}
                >
                  Delete table
                </li>
              </ul>
            </div>
          )}
        </div>
      ))}

      <button
        onClick={onAddTable}
        disabled={addTableIsPending}
        className={`flex items-center ml-2 px-2 py-1 text-[14px] cursor-pointer transition-colors ${
          addTableIsPending 
            ? "text-gray-400 cursor-not-allowed" 
            : "text-gray-600 hover:text-gray-700"
        }`}
      >
        {addTableIsPending ? (
          <>
            <div className="w-3 h-3 border border-gray-400 border-t-transparent rounded-full animate-spin mr-1" />
            Creating...
          </>
        ) : (
          "+ Add or Import"
        )}
      </button>
    </div>
  );
};

export default TableTabs;