import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { interestCategories, getAllOptions } from '../lib/staticTags';

const GroupSearch = () => {
  const navigate = useNavigate();
  const [searchTags, setSearchTags] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeCategory, setActiveCategory] = useState(interestCategories[0]?.id || '');
  const allOptions = getAllOptions();

  const handleTagToggle = (tagId) => {
    setSearchTags(prev => {
      if (prev.includes(tagId)) {
        return prev.filter(id => id !== tagId);
      } else {
        return [...prev, tagId];
      }
    });
  };

  const searchGroups = async () => {
    if (searchTags.length === 0) {
      setError('Please select at least one tag to search');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: searchError } = await supabase
        .rpc('search_groups_by_tags', {
          search_tags: searchTags
        });

      if (searchError) {
        throw searchError;
      }

      setSearchResults(data || []);
    } catch (err) {
      console.error('Error searching groups:', err);
      setError('Error searching for groups. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinGroup = (groupId) => {
    navigate(`/join-group/${groupId}`);
  };

  // Find current category
  const currentCategory = interestCategories.find(c => c.id === activeCategory) || interestCategories[0];

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="p-4 border-b">
        <h2 className="text-xl font-bold">Find Groups by Interest</h2>
        <p className="text-gray-600 text-sm mt-1">
          Select interests to find groups that match your preferences
        </p>
      </div>

      <div className="p-4">
        <div className="flex space-x-1 overflow-x-auto pb-2 mb-4">
          {interestCategories.map(category => (
            <button
              key={category.id}
              className={`px-3 py-2 rounded-t-lg text-sm font-medium whitespace-nowrap ${
                activeCategory === category.id 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-gray-100 hover:bg-gray-200'
              }`}
              onClick={() => setActiveCategory(category.id)}
            >
              {category.name}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-6">
          {currentCategory?.options.map(option => (
            <div
              key={option.id}
              onClick={() => handleTagToggle(option.id)}
              className={`
                border rounded-lg p-2 cursor-pointer transition-colors text-sm
                ${searchTags.includes(option.id) 
                  ? 'border-blue-500 bg-blue-50 text-blue-700' 
                  : 'border-gray-200 hover:border-gray-300'
                }
              `}
            >
              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={searchTags.includes(option.id)}
                  onChange={() => {}}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="ml-2">{option.name}</span>
              </div>
            </div>
          ))}
        </div>

        {searchTags.length > 0 && (
          <div className="mb-4">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Selected Tags:</h3>
            <div className="flex flex-wrap gap-2">
              {searchTags.map(tagId => {
                const option = allOptions.find(opt => opt.id === tagId);
                return (
                  <span 
                    key={tagId}
                    className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs flex items-center"
                  >
                    {option?.name}
                    <button 
                      onClick={() => handleTagToggle(tagId)}
                      className="ml-1 text-blue-600 hover:text-blue-800"
                    >
                      ×
                    </button>
                  </span>
                );
              })}
            </div>
          </div>
        )}

        <button
          onClick={searchGroups}
          disabled={loading || searchTags.length === 0}
          className="w-full py-2 px-4 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 mb-4"
        >
          {loading ? 'Searching...' : 'Search Groups'}
        </button>

        {error && (
          <div className="bg-red-50 text-red-700 p-3 rounded-md mb-4">
            {error}
          </div>
        )}

        {searchResults.length > 0 ? (
          <div>
            <h3 className="font-medium mb-2">Search Results</h3>
            <div className="space-y-3">
              {searchResults.map(group => (
                <div key={group.group_id} className="border rounded-lg p-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-medium">{group.group_name}</h4>
                      <p className="text-sm text-gray-600 line-clamp-2">{group.group_description || 'No description'}</p>
                    </div>
                    <div className="bg-green-100 text-green-800 text-xs font-medium px-2 py-1 rounded-full">
                      {Math.round(group.match_percentage)}% match
                    </div>
                  </div>
                  <div className="mt-3 text-right">
                    <button
                      onClick={() => handleJoinGroup(group.group_id)}
                      className="text-sm bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded"
                    >
                      Join Group
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : searchResults.length === 0 && !loading && !error && searchTags.length > 0 ? (
          <div className="text-center py-6">
            <p className="text-gray-500">No matching groups found</p>
            <p className="text-sm text-gray-400 mt-1">Try different tags or create your own group</p>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default GroupSearch; 