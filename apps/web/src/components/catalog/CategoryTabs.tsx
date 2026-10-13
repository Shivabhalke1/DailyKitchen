'use client';

import React from 'react';
import { CategoryRead } from '@/lib/api-client';

interface CategoryTabsProps {
  categories: CategoryRead[];
  selectedSlug: string | null;
  onSelectCategory: (slug: string | null) => void;
}

export function CategoryTabs({
  categories,
  selectedSlug,
  onSelectCategory,
}: CategoryTabsProps) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none" role="tablist">
      <button
        type="button"
        role="tab"
        aria-selected={selectedSlug === null}
        onClick={() => onSelectCategory(null)}
        className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all border ${
          selectedSlug === null
            ? 'bg-brand-700 text-white border-brand-700 shadow-sm shadow-brand-700/20'
            : 'bg-white text-textPrimary border-borderSubtle hover:border-slate-300 hover:bg-slate-50'
        }`}
      >
        All Produce
      </button>

      {categories.map((cat) => {
        const isSelected = selectedSlug === cat.slug;
        return (
          <button
            key={cat.id}
            type="button"
            role="tab"
            aria-selected={isSelected}
            onClick={() => onSelectCategory(cat.slug)}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all border ${
              isSelected
                ? 'bg-brand-700 text-white border-brand-700 shadow-sm shadow-brand-700/20'
                : 'bg-white text-textPrimary border-borderSubtle hover:border-slate-300 hover:bg-slate-50'
            }`}
          >
            {cat.name}
          </button>
        );
      })}
    </div>
  );
}
