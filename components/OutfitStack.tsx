/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React from 'react';
import { OutfitLayer, WardrobeItem } from '../types';
import { Trash2Icon, SaveIcon, GrabberIcon, SparklesIcon, XIcon, LightbulbIcon } from './icons';
import { Reorder, AnimatePresence, motion } from 'framer-motion';

interface OutfitStackProps {
  garmentHistory: OutfitLayer[];
  activeAccessories: WardrobeItem[];
  onRemoveLastGarment: () => void;
  onRemoveAccessory: (accessoryId: string) => void;
  onSaveOutfit: () => void;
  canSave: boolean;
  onReorderGarments: (reorderedItems: OutfitLayer[]) => void;
  onReorderAccessories: (reorderedItems: WardrobeItem[]) => void;
  isLoading: boolean;
  onGetStyleScore: () => void;
  onClearStyleScore: () => void;
  styleScore: { score: number; critique: string } | null;
  isScoringStyle: boolean;
  onGetStyleSuggestions: () => void;
  isSuggesting: boolean;
}

const OutfitStack: React.FC<OutfitStackProps> = ({ 
  garmentHistory, 
  activeAccessories,
  onRemoveLastGarment, 
  onRemoveAccessory,
  onSaveOutfit, 
  canSave, 
  onReorderGarments, 
  onReorderAccessories,
  isLoading,
  onGetStyleScore,
  onClearStyleScore,
  styleScore,
  isScoringStyle,
  onGetStyleSuggestions,
  isSuggesting,
}) => {
  const reorderableGarments = garmentHistory.slice(1);

  const getScoreColor = (score: number) => {
    if (score >= 8) return 'bg-green-500 text-white';
    if (score >= 5) return 'bg-yellow-500 text-white';
    return 'bg-red-500 text-white';
  };

  const renderItem = (item: WardrobeItem, index: number, isAccessory: boolean) => (
    <div className="flex items-center justify-between p-2">
      <div className="flex items-center overflow-hidden">
          <button disabled={isLoading} className="cursor-grab disabled:cursor-not-allowed touch-none">
            <GrabberIcon className="w-5 h-5 text-gray-400 mr-2"/>
          </button>
          <span className="flex-shrink-0 flex items-center justify-center w-6 h-6 mr-3 text-xs font-bold text-gray-600 bg-gray-200 rounded-full">
            {index + (isAccessory ? 1 : 2)}
          </span>
          <img src={item.url} alt={item.name} className="flex-shrink-0 w-12 h-12 object-cover rounded-md mr-3" />
          <span className="font-semibold text-gray-800 truncate" title={item.name}>
            {item.name}
          </span>
      </div>
        {isAccessory ? (
             <button
                onClick={() => onRemoveAccessory(item.id)}
                disabled={isLoading}
                className="flex-shrink-0 text-gray-500 hover:text-red-600 transition-colors p-2 rounded-md hover:bg-red-50 disabled:opacity-50"
                aria-label={`Remove ${item.name}`}
            >
                <Trash2Icon className="w-5 h-5" />
            </button>
        ) : (index === reorderableGarments.length - 1 &&
            <button
                onClick={onRemoveLastGarment}
                disabled={isLoading}
                className="flex-shrink-0 text-gray-500 hover:text-red-600 transition-colors p-2 rounded-md hover:bg-red-50 disabled:opacity-50"
                aria-label={`Remove ${item.name}`}
            >
                <Trash2Icon className="w-5 h-5" />
            </button>
        )}
    </div>
  );

  return (
    <div className="flex flex-col">
      <div className="flex items-start justify-between border-b border-gray-400/50 pb-2 mb-3">
        <h2 className="text-xl font-serif tracking-wider text-gray-800">Outfit Stack</h2>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={onGetStyleSuggestions}
            disabled={isLoading || isSuggesting || (garmentHistory.length <= 1 && activeAccessories.length === 0)}
            className="flex items-center gap-2 text-sm font-semibold text-gray-700 bg-gray-200/60 px-3 py-1.5 rounded-md hover:bg-gray-300/80 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Get style suggestions"
          >
            {isSuggesting ? (
                <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
            ) : (
                <LightbulbIcon className="w-4 h-4" />
            )}
            Suggest
          </button>
          <button
            onClick={onGetStyleScore}
            disabled={isLoading || isScoringStyle || (garmentHistory.length <= 1 && activeAccessories.length === 0)}
            className="flex items-center gap-2 text-sm font-semibold text-gray-700 bg-gray-200/60 px-3 py-1.5 rounded-md hover:bg-gray-300/80 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Get style score"
          >
            {isScoringStyle ? (
                <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
            ) : (
                <SparklesIcon className="w-4 h-4" />
            )}
            Score
          </button>
          <button
            onClick={onSaveOutfit}
            disabled={!canSave}
            className="flex items-center gap-2 text-sm font-semibold text-gray-700 bg-gray-200/60 px-3 py-1.5 rounded-md hover:bg-gray-300/80 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Save current outfit"
          >
            <SaveIcon className="w-4 h-4" />
            Save
          </button>
        </div>
      </div>

      <AnimatePresence>
        {styleScore && (
            <motion.div
                layout
                initial={{ opacity: 0, y: -10, height: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto' }}
                exit={{ opacity: 0, y: -10, height: 0 }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
                className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 overflow-hidden"
            >
                <div className="flex items-start gap-3">
                    <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg ${getScoreColor(styleScore.score)}`}>
                        {styleScore.score}
                    </div>
                    <p className="flex-grow text-sm text-blue-800 pt-1">{styleScore.critique}</p>
                    <button onClick={onClearStyleScore} className="p-1 text-blue-500 hover:text-blue-800">
                        <XIcon className="w-4 h-4" />
                    </button>
                </div>
            </motion.div>
        )}
      </AnimatePresence>

      <h3 className="text-sm font-semibold text-gray-500 mt-2 mb-2 uppercase tracking-wider">Garments</h3>
      <div className="space-y-2">
        <div className="flex items-center justify-between bg-white/50 p-2 rounded-lg border border-gray-200/80">
          <div className="flex items-center overflow-hidden">
            <span className="w-5 h-5 mr-2" />
            <span className="flex-shrink-0 flex items-center justify-center w-6 h-6 mr-3 text-xs font-bold text-gray-600 bg-gray-200 rounded-full">1</span>
            <span className="font-semibold text-gray-800 truncate">Base Model</span>
          </div>
        </div>
        <Reorder.Group axis="y" values={reorderableGarments} onReorder={onReorderGarments} className="space-y-2">
          {reorderableGarments.map((layer, index) => (
            <Reorder.Item key={layer.item!.id} value={layer} className="bg-white/50 rounded-lg border border-gray-200/80 shadow-sm">
              {renderItem(layer.item!, index, false)}
            </Reorder.Item>
          ))}
        </Reorder.Group>
      </div>
      
      {activeAccessories.length > 0 && (
        <>
            <h3 className="text-sm font-semibold text-gray-500 mt-6 mb-2 uppercase tracking-wider">Accessories</h3>
            <Reorder.Group axis="y" values={activeAccessories} onReorder={onReorderAccessories} className="space-y-2">
            {activeAccessories.map((item, index) => (
                <Reorder.Item key={item.id} value={item} className="bg-white/50 rounded-lg border border-gray-200/80 shadow-sm">
                 {renderItem(item, index, true)}
                </Reorder.Item>
            ))}
            </Reorder.Group>
        </>
      )}

      {garmentHistory.length === 1 && activeAccessories.length === 0 && (
          <p className="text-center text-sm text-gray-500 pt-4">Your stacked items will appear here. Select an item from the wardrobe below.</p>
      )}
    </div>
  );
};

export default OutfitStack;