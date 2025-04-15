import React, { useState, useEffect, useMemo } from 'react';
import { interestCategories } from '../lib/staticTags';

const InterestSelector = ({ onSave, initialInterests = [] }) => {
  const [selectedInterests, setSelectedInterests] = useState(
    new Set(initialInterests)
  );
  const [activeTab, setActiveTab] = useState(interestCategories[0]?.id || '');
  const [searchQuery, setSearchQuery] = useState('');
  const [animatingId, setAnimatingId] = useState(null);

  // Update selections when initialInterests prop changes
  useEffect(() => {
    setSelectedInterests(new Set(initialInterests));
  }, [initialInterests]);

  const handleToggleInterest = (interestId) => {
    setAnimatingId(interestId);
    setTimeout(() => setAnimatingId(null), 300);
    
    setSelectedInterests(prev => {
      const newSet = new Set(prev);
      if (newSet.has(interestId)) {
        newSet.delete(interestId);
      } else {
        newSet.add(interestId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    const currentCategory = interestCategories.find(c => c.id === activeTab) || interestCategories[0];
    const newSet = new Set(selectedInterests);
    
    currentCategory.options.forEach(option => {
      if (matchesSearch(option)) {
        newSet.add(option.id);
      }
    });
    
    setSelectedInterests(newSet);
  };

  const handleClearAll = () => {
    const currentCategory = interestCategories.find(c => c.id === activeTab) || interestCategories[0];
    const newSet = new Set(selectedInterests);
    
    currentCategory.options.forEach(option => {
      if (matchesSearch(option)) {
        newSet.delete(option.id);
      }
    });
    
    setSelectedInterests(newSet);
  };

  const handleClearAllInterests = () => {
    setSelectedInterests(new Set());
  };

  const handleSave = () => {
    if (onSave) {
      onSave(Array.from(selectedInterests));
    }
  };

  const matchesSearch = (option) => {
    if (!searchQuery.trim()) return true;
    return option.name.toLowerCase().includes(searchQuery.toLowerCase());
  };

  // Find current category
  const currentCategory = interestCategories.find(c => c.id === activeTab) || interestCategories[0];
  
  // Filter options based on search
  const filteredOptions = useMemo(() => {
    return currentCategory?.options.filter(matchesSearch) || [];
  }, [currentCategory, searchQuery]);
  
  // Count selected in current category
  const selectedInCurrentCategory = filteredOptions.filter(
    option => selectedInterests.has(option.id)
  ).length || 0;

  return (
    <div className="bg-white rounded-lg shadow-md p-4 md:p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-2">
        <h2 className="text-xl font-bold">Select Your Interests</h2>
        {selectedInterests.size > 0 && (
          <button 
            onClick={handleClearAllInterests}
            className="text-xs text-red-600 hover:text-red-800 border border-red-300 px-2 py-1 rounded transition-colors hover:bg-red-50"
            aria-label="Clear all interest selections"
          >
            Clear All Selections ({selectedInterests.size})
          </button>
        )}
      </div>
      
      <div className="flex overflow-x-auto scrollbar-hide pb-2 mb-4 gap-1">
        {interestCategories.map(category => (
          <button
            key={category.id}
            className={`px-3 py-2 rounded-t-lg text-sm font-medium whitespace-nowrap transition-all ${
              activeTab === category.id 
                ? 'bg-blue-500 text-white shadow-sm' 
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            }`}
            onClick={() => {
              setActiveTab(category.id);
              setSearchQuery('');
            }}
            aria-selected={activeTab === category.id}
          >
            {category.name}
            {activeTab !== category.id && selectedInterests.size > 0 && (
              <CategoryBadge 
                category={category} 
                selectedInterests={selectedInterests} 
              />
            )}
          </button>
        ))}
      </div>
      
      <div className="mb-4">
        <div className="relative">
          <input
            type="text"
            className="w-full px-4 py-2 pl-10 border rounded-lg focus:ring-2 focus:ring-blue-300 focus:border-blue-500 transition-all"
            placeholder={`Search in ${currentCategory?.name}...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          {searchQuery && (
            <button 
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>
      
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-md font-medium flex items-center">
          {currentCategory?.name}
          {filteredOptions.length !== currentCategory?.options.length && (
            <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
              {filteredOptions.length} of {currentCategory?.options.length}
            </span>
          )}
        </h3>
        <div className="flex space-x-3">
          <button 
            onClick={handleSelectAll}
            className="text-xs text-blue-600 hover:text-blue-800 transition-colors"
            disabled={filteredOptions.length === 0}
          >
            Select All
          </button>
          <button 
            onClick={handleClearAll}
            className="text-xs text-red-600 hover:text-red-800 transition-colors"
            disabled={selectedInCurrentCategory === 0}
          >
            Clear All
          </button>
        </div>
      </div>
      
      {filteredOptions.length === 0 ? (
        <div className="py-6 text-center text-gray-500">
          No interests found matching "{searchQuery}"
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mb-6">
          {filteredOptions.map(option => (
            <div
              key={option.id}
              className={`
                border rounded-lg p-3 cursor-pointer transition-all
                ${animatingId === option.id ? 'scale-105' : 'scale-100'}
                ${selectedInterests.has(option.id) 
                  ? 'border-blue-500 bg-blue-50 hover:bg-blue-100' 
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }
              `}
              onClick={() => handleToggleInterest(option.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className={`
                    w-5 h-5 flex items-center justify-center rounded 
                    transition-all duration-200
                    ${selectedInterests.has(option.id) 
                      ? 'bg-blue-500 text-white' 
                      : 'border border-gray-300'
                    }
                  `}>
                    {selectedInterests.has(option.id) && (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <label 
                    htmlFor={`interest-${option.id}`}
                    className="ml-2 block text-sm font-medium text-gray-700 cursor-pointer truncate"
                  >
                    {option.name}
                  </label>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="text-sm text-gray-500 text-center sm:text-left">
          {selectedInterests.size > 0 ? (
            <>Selected <span className="font-medium">{selectedInterests.size}</span> interests total 
              {selectedInCurrentCategory > 0 && (
                <span className="text-blue-600"> ({selectedInCurrentCategory} in {currentCategory?.name})</span>
              )}
            </>
          ) : (
            <span>No interests selected yet</span>
          )}
        </div>
        <button
          onClick={handleSave}
          disabled={selectedInterests.size === 0}
          className={`w-full sm:w-auto font-medium py-2 px-6 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition-all ${
            selectedInterests.size === 0 
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
              : 'bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white'
          }`}
        >
          Save Interests
        </button>
      </div>
    </div>
  );
};

// Helper component to show a badge with the count of selected interests per category
const CategoryBadge = ({ category, selectedInterests }) => {
  const count = category.options.filter(opt => selectedInterests.has(opt.id)).length;
  if (count === 0) return null;
  
  return (
    <span className="ml-1 inline-flex items-center justify-center w-4 h-4 text-xs bg-blue-600 text-white rounded-full">
      {count}
    </span>
  );
};

export default InterestSelector; 