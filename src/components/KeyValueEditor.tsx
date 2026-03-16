import React from 'react';
import { Trash2 } from 'lucide-react';
import { KV } from '../types';

export default function KeyValueEditor({ items, onChange, placeholderKey = 'Key', isFormData = false }: { items: KV[], onChange: (items: KV[]) => void, placeholderKey?: string, isFormData?: boolean }) {
  
  const handleChange = (id: string, field: keyof KV, value: any) => {
    const newItems = items.map(item => item.id === id ? { ...item, [field]: value } : item);
    
    // Add empty row if last row is filled
    const lastItem = newItems[newItems.length - 1];
    if (lastItem.key || lastItem.value || lastItem.file) {
      newItems.push({ id: Math.random().toString(36).substring(7), key: '', value: '', enabled: true, type: isFormData ? 'text' : undefined });
    }
    
    onChange(newItems);
  };

  const handleFileChange = (id: string, file: File | null) => {
    if (!file) {
      handleChange(id, 'file', undefined);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      handleChange(id, 'file', {
        name: file.name,
        type: file.type || 'application/octet-stream',
        base64
      });
    };
    reader.readAsDataURL(file);
  };

  const handleDelete = (id: string) => {
    if (items.length === 1) {
      onChange([{ id: Math.random().toString(36).substring(7), key: '', value: '', enabled: true, type: isFormData ? 'text' : undefined }]);
    } else {
      onChange(items.filter(item => item.id !== id));
    }
  };

  return (
    <div className="flex flex-col border border-border-primary rounded overflow-hidden">
      <div className="flex items-center bg-bg-tertiary border-b border-border-primary text-xs font-semibold text-text-secondary">
        <div className="w-10 flex justify-center py-2 border-r border-border-primary"></div>
        <div className="flex-1 px-3 py-2 border-r border-border-primary">{placeholderKey}</div>
        <div className="flex-1 px-3 py-2 border-r border-border-primary">Value</div>
        <div className="w-10 flex justify-center py-2"></div>
      </div>
      {items.map((item) => (
        <div key={item.id} className="flex items-center border-b border-border-primary last:border-b-0 bg-bg-primary hover:bg-bg-secondary transition-colors group">
          <div className="w-10 flex justify-center py-1 border-r border-border-primary">
            <input 
              type="checkbox" 
              checked={item.enabled} 
              onChange={(e) => handleChange(item.id, 'enabled', e.target.checked)}
              className="rounded bg-bg-tertiary border-border-primary text-accent-primary focus:ring-accent-primary"
            />
          </div>
          <div className="flex-1 border-r border-border-primary">
            <input 
              type="text" 
              value={item.key}
              onChange={(e) => handleChange(item.id, 'key', e.target.value)}
              placeholder={placeholderKey}
              className="w-full bg-transparent px-3 py-1.5 text-text-primary outline-none font-mono"
              style={{ fontSize: 'var(--editor-font-size)' }}
            />
          </div>
          <div className="flex-1 border-r border-border-primary flex items-center">
            {isFormData && (
              <select
                value={item.type || 'text'}
                onChange={(e) => handleChange(item.id, 'type', e.target.value)}
                className="bg-transparent text-xs text-text-secondary border-r border-border-primary px-2 py-1.5 outline-none hover:text-text-primary"
              >
                <option value="text">Text</option>
                <option value="file">File</option>
              </select>
            )}
            {(!isFormData || item.type === 'text') ? (
              <input 
                type="text" 
                value={item.value}
                onChange={(e) => handleChange(item.id, 'value', e.target.value)}
                placeholder="Value"
                className="w-full bg-transparent px-3 py-1.5 text-text-primary outline-none font-mono"
                style={{ fontSize: 'var(--editor-font-size)' }}
              />
            ) : (
              <div className="flex-1 px-3 py-1.5 flex items-center">
                <input 
                  type="file" 
                  onChange={(e) => handleFileChange(item.id, e.target.files?.[0] || null)}
                  className="w-full text-xs text-text-secondary file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:bg-bg-tertiary file:text-text-primary hover:file:bg-bg-secondary cursor-pointer"
                />
              </div>
            )}
          </div>
          <div className="w-10 flex justify-center py-1">
            <button 
              onClick={() => handleDelete(item.id)}
              className="text-text-secondary hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
