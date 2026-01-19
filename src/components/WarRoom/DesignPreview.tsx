import React, { useState } from 'react';

interface DesignPreviewProps {
  isOpen: boolean;
  onClose: () => void;
}

type DesignStyle = 'minimal' | 'glassmorphism' | 'neumorphism' | 'claymorphism' | 'brutalism' | 'flat';

export const DesignPreview: React.FC<DesignPreviewProps> = ({ isOpen, onClose }) => {
  const [activeStyle, setActiveStyle] = useState<DesignStyle>('neumorphism');
  const [toggleActive, setToggleActive] = useState(false);
  const [sliderValue, setSliderValue] = useState(50);

  if (!isOpen) return null;

  const styles: { id: DesignStyle; name: string; description: string }[] = [
    { id: 'minimal', name: 'Minimal', description: 'Clean, focused, and spacious. Perfect for SaaS and productivity tools.' },
    { id: 'glassmorphism', name: 'Glassmorphism', description: 'Frosted glass effect with blur. Modern, sleek, and layered visual depth.' },
    { id: 'neumorphism', name: 'Neumorphism', description: 'Soft, extruded 3D surfaces with inner and outer shadows. Subtle and sophisticated.' },
    { id: 'claymorphism', name: 'Claymorphism', description: 'Playful 3D clay-like objects with rounded corners and gradient colors.' },
    { id: 'brutalism', name: 'Neobrutalism', description: 'Bold, thick borders. High contrast colors. Raw and unpolished.' },
    { id: 'flat', name: 'Flat Design', description: 'No gradients or textures. Simple shapes and solid colors.' },
  ];

  // Style-specific classes
  const getCardClasses = (style: DesignStyle, isSelected: boolean) => {
    const base = 'p-6 rounded-2xl cursor-pointer transition-all duration-300';

    switch (style) {
      case 'minimal':
        return `${base} bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 ${isSelected ? 'shadow-lg transform -translate-y-1' : 'shadow-sm hover:shadow-md'}`;
      case 'glassmorphism':
        return `${base} bg-white/15 dark:bg-white/10 backdrop-blur-xl border border-white/25 ${isSelected ? 'bg-white/25 shadow-xl' : 'hover:bg-white/20'}`;
      case 'neumorphism':
        return `${base} bg-[#e0e0e0] dark:bg-[#2a2a3e] ${isSelected
          ? 'shadow-[6px_6px_12px_#b8b8b8,-6px_-6px_12px_#ffffff] dark:shadow-[6px_6px_12px_#1e1e2d,-6px_-6px_12px_#36364f] transform -translate-y-1'
          : 'shadow-[8px_8px_16px_#b8b8b8,-8px_-8px_16px_#ffffff] dark:shadow-[8px_8px_16px_#1e1e2d,-8px_-8px_16px_#36364f] hover:shadow-[6px_6px_12px_#b8b8b8,-6px_-6px_12px_#ffffff] dark:hover:shadow-[6px_6px_12px_#1e1e2d,-6px_-6px_12px_#36364f]'}`;
      case 'claymorphism':
        return `${base} bg-gradient-to-br from-rose-400 to-pink-500 text-white rounded-[40px] ${isSelected
          ? 'shadow-[0_30px_50px_rgba(245,87,108,0.5),inset_-3px_-3px_10px_rgba(255,255,255,0.3),inset_3px_3px_10px_rgba(0,0,0,0.1)] transform -translate-y-2 scale-[1.02]'
          : 'shadow-[0_20px_40px_rgba(245,87,108,0.4),inset_-3px_-3px_10px_rgba(255,255,255,0.3),inset_3px_3px_10px_rgba(0,0,0,0.1)] hover:transform hover:-translate-y-1'}`;
      case 'brutalism':
        return `${base} bg-gray-100 dark:bg-gray-200 text-black border-4 border-black ${isSelected
          ? 'shadow-[10px_10px_0px_#000] transform translate-x-[-2px] translate-y-[-2px]'
          : 'shadow-[8px_8px_0px_#000] hover:shadow-[10px_10px_0px_#000] hover:transform hover:translate-x-[-2px] hover:translate-y-[-2px]'}`;
      case 'flat':
        return `${base} bg-blue-500 text-white ${isSelected ? 'bg-blue-600 shadow-lg transform -translate-y-1' : 'hover:bg-blue-600'}`;
      default:
        return base;
    }
  };

  const getButtonClasses = (style: DesignStyle) => {
    const base = 'px-5 py-2.5 rounded-xl font-medium text-sm transition-all duration-200';

    switch (style) {
      case 'minimal':
        return `${base} bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-gray-700 dark:hover:bg-gray-100 active:scale-95`;
      case 'glassmorphism':
        return `${base} bg-white/20 text-white border border-white/30 backdrop-blur-md hover:bg-white/30`;
      case 'neumorphism':
        return `${base} bg-[#e0e0e0] dark:bg-[#2a2a3e] text-gray-700 dark:text-gray-200 shadow-[4px_4px_8px_#b8b8b8,-4px_-4px_8px_#ffffff] dark:shadow-[4px_4px_8px_#1e1e2d,-4px_-4px_8px_#36364f] hover:shadow-[6px_6px_10px_#b8b8b8,-6px_-6px_10px_#ffffff] dark:hover:shadow-[6px_6px_10px_#1e1e2d,-6px_-6px_10px_#36364f] active:shadow-[inset_4px_4px_8px_#b8b8b8,inset_-4px_-4px_8px_#ffffff] dark:active:shadow-[inset_4px_4px_8px_#1e1e2d,inset_-4px_-4px_8px_#36364f]`;
      case 'claymorphism':
        return `${base} bg-white/25 text-white rounded-[20px] shadow-[0_8px_16px_rgba(0,0,0,0.2),inset_-2px_-2px_5px_rgba(255,255,255,0.2),inset_2px_2px_5px_rgba(0,0,0,0.1)] hover:transform hover:-translate-y-0.5 hover:scale-105`;
      case 'brutalism':
        return `${base} bg-yellow-400 text-black border-3 border-black font-bold hover:bg-orange-500 hover:shadow-[2px_2px_0px_#000] active:shadow-none active:transform active:translate-x-[1px] active:translate-y-[1px]`;
      case 'flat':
        return `${base} bg-orange-500 text-white hover:bg-orange-600 hover:scale-105`;
      default:
        return base;
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-6xl max-h-[90vh] m-4 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-3xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-6 text-center text-white">
          <h1 className="text-3xl font-bold mb-2 drop-shadow-lg">UI Design Styles Showcase</h1>
          <p className="text-white/80">Interactive exploration of modern design styles - Hover over cards to see effects</p>
        </div>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/20 backdrop-blur-md text-white hover:bg-white/30 transition-colors flex items-center justify-center"
        >
          <i className="fa fa-times"></i>
        </button>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          {/* Style Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {styles.map((style) => (
              <div
                key={style.id}
                onClick={() => setActiveStyle(style.id)}
                className={getCardClasses(style.id, activeStyle === style.id)}
              >
                <h2 className={`text-xl font-bold mb-3 ${style.id === 'claymorphism' || style.id === 'flat' || style.id === 'glassmorphism' ? 'text-white' : style.id === 'brutalism' ? 'text-black' : 'text-gray-800 dark:text-gray-100'}`}>
                  {style.name}
                </h2>
                <p className={`text-sm mb-4 leading-relaxed ${style.id === 'claymorphism' || style.id === 'flat' || style.id === 'glassmorphism' ? 'text-white/90' : style.id === 'brutalism' ? 'text-black/80' : 'text-gray-600 dark:text-gray-300'}`}>
                  {style.description}
                </p>
                <button className={getButtonClasses(style.id)}>
                  {style.id === 'brutalism' ? 'Clash!' : style.id === 'claymorphism' ? 'Play' : style.id === 'glassmorphism' ? 'Hover Now' : 'Click Me'}
                </button>
              </div>
            ))}
          </div>

          {/* Interactive Elements Demo */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-8 shadow-xl">
            <h2 className="text-2xl font-bold text-center text-gray-800 dark:text-white mb-8">
              Interactive Elements
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {/* Neumorphic Toggle */}
              <div className="flex flex-col items-center gap-4">
                <label className="font-semibold text-gray-700 dark:text-gray-300">Neumorphic Toggle</label>
                <button
                  onClick={() => setToggleActive(!toggleActive)}
                  className={`relative w-16 h-9 rounded-full cursor-pointer transition-all duration-300 ${
                    toggleActive
                      ? 'bg-indigo-500 shadow-[inset_0_2px_4px_rgba(102,126,234,0.3)]'
                      : 'bg-[#e0e0e0] dark:bg-[#2a2a3e] shadow-[inset_0_2px_4px_rgba(0,0,0,0.2),inset_0_-2px_4px_rgba(255,255,255,0.8)] dark:shadow-[inset_0_2px_4px_rgba(0,0,0,0.3),inset_0_-2px_4px_rgba(255,255,255,0.1)]'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 w-8 h-8 rounded-full bg-white shadow-md transition-all duration-300 ${
                      toggleActive ? 'left-7 bg-indigo-500' : 'left-0.5'
                    }`}
                  />
                </button>
              </div>

              {/* Glassmorphic Checkbox */}
              <div className="flex flex-col items-center gap-4">
                <label className="font-semibold text-gray-700 dark:text-gray-300">Glassmorphic Checkbox</label>
                <input
                  type="checkbox"
                  className="w-6 h-6 appearance-none bg-white/15 border border-white/30 rounded-lg cursor-pointer backdrop-blur-md transition-all checked:bg-indigo-500/40 checked:border-indigo-500/80"
                />
              </div>

              {/* Brutalist Slider */}
              <div className="flex flex-col items-center gap-4">
                <label className="font-semibold text-gray-700 dark:text-gray-300">Brutalist Slider</label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={sliderValue}
                  onChange={(e) => setSliderValue(parseInt(e.target.value))}
                  className="w-48 h-1.5 bg-black border-2 border-black rounded-none appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:bg-yellow-400 [&::-webkit-slider-thumb]:border-3 [&::-webkit-slider-thumb]:border-black [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:hover:bg-orange-500"
                  style={{
                    background: `linear-gradient(to right, #facc15 0%, #facc15 ${sliderValue}%, #000 ${sliderValue}%, #000 100%)`
                  }}
                />
              </div>

              {/* Claymorphic Dropdown */}
              <div className="flex flex-col items-center gap-4">
                <label className="font-semibold text-gray-700 dark:text-gray-300">Claymorphic Dropdown</label>
                <select className="px-4 py-3 border-none rounded-[20px] bg-gradient-to-r from-rose-400 to-pink-500 text-white cursor-pointer text-sm shadow-[0_8px_16px_rgba(245,87,108,0.3)] hover:shadow-[0_12px_20px_rgba(245,87,108,0.4)] hover:-translate-y-0.5 transition-all">
                  <option>Select Style</option>
                  <option>Minimal</option>
                  <option>Glassmorphism</option>
                  <option>Neumorphism</option>
                  <option>Claymorphism</option>
                  <option>Brutalism</option>
                </select>
              </div>
            </div>

            {/* Pro Tip */}
            <div className="mt-8 p-4 bg-gray-100 dark:bg-gray-800 border-l-4 border-indigo-500 rounded-r-lg">
              <p className="text-sm text-gray-700 dark:text-gray-300">
                <strong>Pro Tip:</strong> Each style uses different CSS techniques.
                <code className="mx-1 px-1 bg-gray-200 dark:bg-gray-700 rounded">Glassmorphism</code> uses <code className="px-1 bg-gray-200 dark:bg-gray-700 rounded">backdrop-filter: blur()</code>,
                <code className="mx-1 px-1 bg-gray-200 dark:bg-gray-700 rounded">Neumorphism</code> uses layered <code className="px-1 bg-gray-200 dark:bg-gray-700 rounded">box-shadow</code>,
                <code className="mx-1 px-1 bg-gray-200 dark:bg-gray-700 rounded">Brutalism</code> uses thick <code className="px-1 bg-gray-200 dark:bg-gray-700 rounded">border</code> and shadow offsets.
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center text-white/80 mt-6 text-sm">
            <p>Explore, inspire, and create! These styles can be combined and customized for your unique dashboard.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DesignPreview;
