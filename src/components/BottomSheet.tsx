import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { X } from 'lucide-react';

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  snapPoints?: number[]; // Heights in vh units
  defaultSnapPoint?: number; // Index of default snap point
}

export const BottomSheet: React.FC<BottomSheetProps> = ({
  isOpen,
  onClose,
  children,
  title,
  snapPoints = [90, 50], // Default snap points at 90vh and 50vh
  defaultSnapPoint = 1, // Default to middle snap point
}) => {
  const [currentSnapIndex, setCurrentSnapIndex] = useState(defaultSnapPoint);
  const [isDragging, setIsDragging] = useState(false);
  const [startY, setStartY] = useState(0);
  const [currentY, setCurrentY] = useState(0);
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      // Prevent body scroll when bottom sheet is open
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleTouchStart = (e: React.TouchEvent) => {
    setIsDragging(true);
    setStartY(e.touches[0].clientY);
    setCurrentY(e.touches[0].clientY);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    setCurrentY(e.touches[0].clientY);
  };

  const handleTouchEnd = () => {
    if (!isDragging) return;

    const deltaY = currentY - startY;
    const threshold = 50; // Minimum drag distance to trigger snap

    if (deltaY > threshold) {
      // Dragging down - snap to lower snap point or close
      if (currentSnapIndex < snapPoints.length - 1) {
        setCurrentSnapIndex(currentSnapIndex + 1);
      } else {
        onClose();
      }
    } else if (deltaY < -threshold) {
      // Dragging up - snap to higher snap point
      if (currentSnapIndex > 0) {
        setCurrentSnapIndex(currentSnapIndex - 1);
      }
    }

    setIsDragging(false);
    setStartY(0);
    setCurrentY(0);
  };

  if (!isOpen) return null;

  const currentHeight = snapPoints[currentSnapIndex];
  const dragOffset = isDragging ? Math.max(0, currentY - startY) : 0;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      {/* Bottom Sheet */}
      <div
        ref={sheetRef}
        className="relative w-full bg-white dark:bg-zinc-900 rounded-t-3xl shadow-2xl animate-slide-up"
        style={{
          height: `${currentHeight}vh`,
          transform: `translateY(${dragOffset}px)`,
          transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-12 h-1.5 bg-zinc-300 dark:bg-zinc-700 rounded-full" />
        </div>

        {/* Header */}
        {title && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800">
            <h2 className="text-xl font-bold text-zinc-900 dark:text-white">
              {title}
            </h2>
            <button
              onClick={onClose}
              className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition"
            >
              <X className="text-xl" />
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 mobile-scroll">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default BottomSheet;
