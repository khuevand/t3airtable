export const highlightSearchTerm = (text: string, searchTerm: string): string => {
  if (!searchTerm.trim()) return text;
  
  const parts = text.split(new RegExp(`(${searchTerm})`, 'gi'));
  return parts.map((part, index) => 
    part.toLowerCase() === searchTerm.toLowerCase() ? 
      `<mark style="background-color: #fbeabe;">${part}</mark>` : 
      part
  ).join('');
};

export const countSearchMatches = (text: string, searchTerm: string): number => {
  if (!searchTerm.trim()) return 0;
  
  const matches = text.toLowerCase().match(new RegExp(searchTerm.toLowerCase(), 'g'));
  return matches ? matches.length : 0;
};

// Helper function to check if a column header matches the search term
export const columnHeaderMatches = (headerName: string, searchTerm: string): boolean => {
  if (!searchTerm.trim()) return false;
  return headerName.toLowerCase().includes(searchTerm.toLowerCase());
};