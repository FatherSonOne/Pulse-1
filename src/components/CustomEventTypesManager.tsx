import React, { useState, useEffect } from 'react';
import {
  customEventTypesService,
  CustomEventType,
  AVAILABLE_ICONS,
  AVAILABLE_COLORS,
} from '../services/customEventTypesService';

interface CustomEventTypesManagerProps {
  onClose: () => void;
  onTypesChanged?: () => void;
}

const CustomEventTypesManager: React.FC<CustomEventTypesManagerProps> = ({
  onClose,
  onTypesChanged,
}) => {
  const [types, setTypes] = useState<CustomEventType[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formIcon, setFormIcon] = useState('fa-star');
  const [formColor, setFormColor] = useState('#6366f1');

  useEffect(() => {
    setTypes(customEventTypesService.getAll());
  }, []);

  const refresh = () => {
    setTypes(customEventTypesService.getAll());
    onTypesChanged?.();
  };

  const resetForm = () => {
    setFormName('');
    setFormIcon('fa-star');
    setFormColor('#6366f1');
    setIsCreating(false);
    setEditingId(null);
  };

  const handleCreate = () => {
    if (!formName.trim()) return;
    customEventTypesService.create(formName, formIcon, formColor);
    refresh();
    resetForm();
  };

  const handleUpdate = () => {
    if (!editingId || !formName.trim()) return;
    customEventTypesService.update(editingId, { name: formName, icon: formIcon, color: formColor });
    refresh();
    resetForm();
  };

  const startEdit = (type: CustomEventType) => {
    setEditingId(type.id);
    setFormName(type.name);
    setFormIcon(type.icon);
    setFormColor(type.color);
    setIsCreating(false);
  };

  const handleDelete = (id: string) => {
    customEventTypesService.delete(id);
    refresh();
  };

  const showForm = isCreating || editingId !== null;

  return (
    <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-lg shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-800">
          <div>
            <h2 className="text-base font-bold text-zinc-900 dark:text-white">Custom Event Types</h2>
            <p className="text-xs text-zinc-500 mt-0.5">Create and manage your own event categories</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
          {/* Existing custom types */}
          {types.length === 0 && !showForm && (
            <div className="text-center py-8">
              <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mx-auto mb-3">
                <i className="fa-solid fa-tag text-zinc-400 text-xl" />
              </div>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">No custom types yet</p>
              <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">Create your first custom event category</p>
            </div>
          )}

          {types.length > 0 && (
            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
                Your Types ({types.length})
              </label>
              <div className="space-y-1.5">
                {types.map(type => (
                  <div
                    key={type.id}
                    className="flex items-center gap-3 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800 group"
                  >
                    {/* Color swatch + icon */}
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: type.color + '20', border: `2px solid ${type.color}` }}
                    >
                      <i className={`fa-solid ${type.icon} text-sm`} style={{ color: type.color }} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-zinc-900 dark:text-white">{type.name}</div>
                      <div className="text-xs text-zinc-400">{type.icon.replace('fa-', '')}</div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                      <button
                        onClick={() => startEdit(type)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg text-zinc-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition"
                        title="Edit"
                      >
                        <i className="fa-solid fa-pen text-xs" />
                      </button>
                      <button
                        onClick={() => handleDelete(type.id)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition"
                        title="Delete"
                      >
                        <i className="fa-solid fa-trash text-xs" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Create / Edit Form */}
          {showForm && (
            <div className="border border-zinc-200 dark:border-zinc-700 rounded-xl p-4 space-y-4 bg-zinc-50 dark:bg-zinc-800/30">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">
                {editingId ? 'Edit Type' : 'New Event Type'}
              </h3>

              {/* Preview */}
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all"
                  style={{ backgroundColor: formColor + '25', border: `2px solid ${formColor}` }}
                >
                  <i className={`fa-solid ${formIcon} text-base`} style={{ color: formColor }} />
                </div>
                <div>
                  <div className="text-sm font-semibold text-zinc-900 dark:text-white">
                    {formName || <span className="text-zinc-400 italic">Type name preview</span>}
                  </div>
                  <div className="text-xs text-zinc-400">Custom type</div>
                </div>
              </div>

              {/* Name input */}
              <div>
                <label className="text-xs font-bold text-zinc-500 uppercase block mb-1">Name</label>
                <input
                  type="text"
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  placeholder="e.g., Workshop, Interview, Volunteer..."
                  className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:border-transparent transition"
                  style={{ '--tw-ring-color': formColor } as React.CSSProperties}
                  maxLength={30}
                  autoFocus
                />
              </div>

              {/* Icon picker */}
              <div>
                <label className="text-xs font-bold text-zinc-500 uppercase block mb-2">Icon</label>
                <div className="grid grid-cols-8 gap-1.5">
                  {AVAILABLE_ICONS.map(icon => (
                    <button
                      key={icon.id}
                      type="button"
                      title={icon.label}
                      onClick={() => setFormIcon(icon.id)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center transition text-sm"
                      style={formIcon === icon.id
                        ? { backgroundColor: formColor, color: '#fff' }
                        : { backgroundColor: 'transparent', color: '#6b7280' }}
                    >
                      <i className={`fa-solid ${icon.id}`} />
                    </button>
                  ))}
                </div>
              </div>

              {/* Color picker */}
              <div>
                <label className="text-xs font-bold text-zinc-500 uppercase block mb-2">Color</label>
                <div className="flex flex-wrap gap-2">
                  {AVAILABLE_COLORS.map(color => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setFormColor(color)}
                      className="w-7 h-7 rounded-full transition hover:scale-110 flex items-center justify-center"
                      style={{ backgroundColor: color }}
                      title={color}
                    >
                      {formColor === color && (
                        <i className="fa-solid fa-check text-white text-[10px]" />
                      )}
                    </button>
                  ))}
                  {/* Custom hex */}
                  <label className="w-7 h-7 rounded-full border-2 border-dashed border-zinc-300 dark:border-zinc-600 flex items-center justify-center cursor-pointer hover:border-zinc-400 transition" title="Custom color">
                    <i className="fa-solid fa-plus text-zinc-400 text-[10px]" />
                    <input
                      type="color"
                      value={formColor}
                      onChange={e => setFormColor(e.target.value)}
                      className="sr-only"
                    />
                  </label>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <button
                  onClick={editingId ? handleUpdate : handleCreate}
                  disabled={!formName.trim()}
                  className="flex-1 py-2 rounded-lg text-sm font-semibold text-white transition disabled:opacity-40"
                  style={{ backgroundColor: formColor }}
                >
                  {editingId ? 'Save Changes' : 'Create Type'}
                </button>
                <button
                  onClick={resetForm}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Add new button (when form hidden) */}
          {!showForm && (
            <button
              onClick={() => setIsCreating(true)}
              className="w-full py-2.5 rounded-xl border-2 border-dashed border-zinc-200 dark:border-zinc-700 text-sm text-zinc-500 dark:text-zinc-400 hover:border-zinc-400 dark:hover:border-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition flex items-center justify-center gap-2"
            >
              <i className="fa-solid fa-plus" />
              Add Custom Type
            </button>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-zinc-100 dark:border-zinc-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-lg text-sm font-semibold hover:opacity-90 transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default CustomEventTypesManager;
