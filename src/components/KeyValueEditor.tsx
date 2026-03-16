import React from 'react';
import { Trash2 } from 'lucide-react';
import { KV } from '../types';

export default function KeyValueEditor({ items, onChange, placeholderKey = 'Key' }: { items: KV[], onChange: (items: KV[]) => void, placeholderKey?: string }) {
  
  const handleChange = (id: string, field: keyof KV, value: any) => {
    const newItems = items.map(item => item.id === id ? { ...item, [field]: value } : item);
    
    // Add empty row if last row is filled
    const lastItem = newItems[newItems.length - 1];
    if (lastItem.key || lastItem.value) {
      newItems.push({ id: Math.random().toString(36).substring(7), key: '', value: '', enabled: true });
    }
    
    onChange(newItems);
  };

  const handleDelete = (id: string) => {
    if (items.length === 1) {
      onChange([{ id: Math.random().toString(36).substring(7), key: '', value: '', enabled: true }]);
    } else {
      onChange(items.filter(item => item.id !== id));
    }
  };

  return (
    <div className="flex flex-col border border-gray-800 rounded overflow-hidden">
      <div className="flex items-center bg-[#1a1d27] border-b border-gray-800 text-xs font-semibold text-gray-400">
        <div className="w-10 flex justify-center py-2 border-r border-gray-800"></div>
        <div className="flex-1 px-3 py-2 border-r border-gray-800">{placeholderKey}</div>
        <div className="flex-1 px-3 py-2 border-r border-gray-800">Value</div>
        <div className="w-10 flex justify-center py-2"></div>
      </div>
      {items.map((item) => (
        <div key={item.id} className="flex items-center border-b border-gray-800 last:border-b-0 bg-[#0f111a] hover:bg-[#141620] transition-colors group">
          <div className="w-10 flex justify-center py-1 border-r border-gray-800">
            <input 
              type="checkbox" 
              checked={item.enabled} 
              onChange={(e) => handleChange(item.id, 'enabled', e.target.checked)}
              className="rounded bg-gray-800 border-gray-700 text-emerald-500 focus:ring-emerald-500"
            />
          </div>
          <div className="flex-1 border-r border-gray-800">
            <input 
              type="text" 
              value={item.key}
              onChange={(e) => handleChange(item.id, 'key', e.target.value)}
              placeholder={placeholderKey}
              className="w-full bg-transparent px-3 py-1.5 text-sm text-gray-300 outline-none font-mono"
            />
          </div>
          <div className="flex-1 border-r border-gray-800">
            <input 
              type="text" 
              value={item.value}
              onChange={(e) => handleChange(item.id, 'value', e.target.value)}
              placeholder="Value"
              className="w-full bg-transparent px-3 py-1.5 text-sm text-gray-300 outline-none font-mono"
            />
          </div>
          <div className="w-10 flex justify-center py-1">
            <button 
              onClick={() => handleDelete(item.id)}
              className="text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
