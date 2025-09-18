/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React from 'react';
import { SavedOutfit } from '../types';
import { Trash2Icon } from './icons';

interface SavedOutfitsPanelProps {
  outfits: SavedOutfit[];
  onLoad: (id: string) => void;
  onDelete: (id: string) => void;
  isLoading: boolean;
}

const SavedOutfitsPanel: React.FC<SavedOutfitsPanelProps> = ({ outfits, onLoad, onDelete, isLoading }) => {
  if (outfits.length === 0) {
    return (
        <div className="pt-6 border-t border-gray-400/50 text-center">
            <p className="text-sm text-gray-500">You have no saved outfits.</p>
            <p className="text-xs text-gray-400 mt-1">Add items and click 'Save' to keep your favorite looks!</p>
        </div>
    );
  }

  return (
    <div className="pt-6 border-t border-gray-400/50">
      <h2 className="text-xl font-serif tracking-wider text-gray-800 mb-3">Saved Outfits</h2>
      <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
        {outfits.map((outfit) => (
          <div key={outfit.id} className="flex items-center gap-3 p-2 bg-white/50 rounded-lg border border-gray-200/80 animate-fade-in">
            <img src={outfit.thumbnailUrl} alt={outfit.name} className="w-16 h-16 object-cover rounded-md flex-shrink-0 bg-gray-100" />
            <div className="flex-grow overflow-hidden">
              <p className="font-semibold text-gray-800 truncate" title={outfit.name}>{outfit.name}</p>
              <button
                onClick={() => onLoad(outfit.id)}
                disabled={isLoading}
                className="mt-1 text-sm font-semibold text-gray-700 bg-gray-200/60 px-3 py-1 rounded-md hover:bg-gray-300/80 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Load Outfit
              </button>
            </div>
            <button
              onClick={() => onDelete(outfit.id)}
              disabled={isLoading}
              className="flex-shrink-0 text-gray-500 hover:text-red-600 transition-colors p-2 rounded-full hover:bg-red-50 disabled:opacity-50"
              aria-label={`Delete ${outfit.name}`}
            >
              <Trash2Icon className="w-5 h-5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SavedOutfitsPanel;