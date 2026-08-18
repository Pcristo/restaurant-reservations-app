import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '../lib/utils';

export interface DropdownOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
  description?: string;
  badge?: React.ReactNode;
  colorDot?: string;
  hexColor?: string;
  disabled?: boolean;
}

export interface CustomDropdownProps {
  id?: string;
  label?: string;
  labelClassName?: string;
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  isDark?: boolean;
  disabled?: boolean;
  minWidth?: string;
  className?: string;
  buttonClassName?: string;
  menuClassName?: string;
  menuZIndex?: string;
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  maxMenuHeight?: string;
}

export const CustomDropdown: React.FC<CustomDropdownProps> = ({
  id,
  label,
  labelClassName,
  value,
  options,
  onChange,
  placeholder = 'Select an option',
  isDark = false,
  disabled = false,
  minWidth,
  className,
  buttonClassName,
  menuClassName,
  menuZIndex = 'z-50',
  size = 'md',
  fullWidth = true,
  maxMenuHeight = 'max-h-60'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const selectedOption = options.find((opt) => opt.value === value);

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-xs rounded-lg',
    md: 'px-3.5 py-2.5 text-xs sm:text-sm rounded-xl',
    lg: 'px-4 py-3 text-sm rounded-xl'
  };

  return (
    <div
      id={id}
      ref={dropdownRef}
      className={cn('flex flex-col gap-1.5 relative', fullWidth ? 'w-full' : '', className)}
    >
      {label && (
        <label
          className={cn(
            'text-[11px] font-bold uppercase tracking-wider select-none',
            isDark ? 'text-gray-400' : 'text-gray-500',
            labelClassName
          )}
        >
          {label}
        </label>
      )}

      <div className="relative w-full">
        <button
          type="button"
          disabled={disabled}
          onClick={() => !disabled && setIsOpen((prev) => !prev)}
          className={cn(
            'flex items-center justify-between gap-2.5 font-semibold border shadow-xs transition-all cursor-pointer select-none w-full text-left',
            sizeClasses[size],
            minWidth,
            disabled && 'opacity-50 cursor-not-allowed bg-gray-100 dark:bg-gray-800',
            isOpen
              ? 'ring-2 ring-amber-500/30 border-amber-500'
              : isDark
              ? 'bg-gray-900 border-gray-800 text-white hover:bg-gray-800/80 hover:border-gray-700'
              : 'bg-white border-gray-200 text-gray-900 hover:bg-gray-50/90 hover:border-gray-300',
            buttonClassName
          )}
        >
          <div className="flex items-center gap-2.5 truncate flex-1 min-w-0">
            {(selectedOption?.hexColor || selectedOption?.colorDot) && (
              <span
                style={
                  selectedOption.hexColor || selectedOption.colorDot?.startsWith('#')
                    ? { backgroundColor: selectedOption.hexColor || selectedOption.colorDot }
                    : undefined
                }
                className={cn(
                  'w-3.5 h-3.5 rounded-full shrink-0 border border-black/15 shadow-xs flex-none',
                  !selectedOption.hexColor && !selectedOption.colorDot?.startsWith('#') && selectedOption.colorDot
                )}
              />
            )}
            {selectedOption?.icon && (
              <span className="shrink-0 text-amber-600">{selectedOption.icon}</span>
            )}
            <span className="truncate">
              {selectedOption ? selectedOption.label : placeholder}
            </span>
            {selectedOption?.badge && (
              <span className="shrink-0">{selectedOption.badge}</span>
            )}
          </div>

          <ChevronDown
            size={16}
            className={cn(
              'shrink-0 transition-transform duration-200',
              isOpen
                ? 'rotate-180 text-amber-600'
                : isDark
                ? 'text-gray-400'
                : 'text-gray-400'
            )}
          />
        </button>

        {isOpen && (
          <div
            className={cn(
              'absolute left-0 top-[calc(100%+6px)] w-full min-w-[180px] shadow-xl rounded-2xl overflow-hidden py-1.5 animate-in fade-in slide-in-from-top-2 duration-150 overflow-y-auto border',
              menuZIndex,
              maxMenuHeight,
              isDark
                ? 'bg-gray-900 border-gray-800 text-white shadow-black/50'
                : 'bg-white border-gray-100 text-gray-900 shadow-gray-200/70',
              menuClassName
            )}
          >
            {options.map((opt) => {
              const isSelected = opt.value === value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  disabled={opt.disabled}
                  onClick={() => {
                    if (!opt.disabled) {
                      onChange(opt.value);
                      setIsOpen(false);
                    }
                  }}
                  className={cn(
                    'w-full text-left px-3.5 py-2.5 transition-colors flex items-center justify-between gap-2.5 cursor-pointer text-xs sm:text-sm',
                    opt.disabled && 'opacity-40 cursor-not-allowed',
                    isSelected
                      ? isDark
                        ? 'bg-amber-500/20 text-amber-300 font-bold'
                        : 'bg-amber-50 text-amber-950 font-bold'
                      : isDark
                      ? 'text-gray-300 hover:bg-gray-800 hover:text-white font-medium'
                      : 'text-gray-700 hover:bg-amber-50/60 hover:text-amber-900 font-medium'
                  )}
                >
                  <div className="flex items-center gap-2.5 truncate flex-1 min-w-0">
                    {(opt.hexColor || opt.colorDot) && (
                      <span
                        style={
                          opt.hexColor || opt.colorDot?.startsWith('#')
                            ? { backgroundColor: opt.hexColor || opt.colorDot }
                            : undefined
                        }
                        className={cn(
                          'w-3.5 h-3.5 rounded-full shrink-0 border border-black/15 shadow-xs flex-none',
                          !opt.hexColor && !opt.colorDot?.startsWith('#') && opt.colorDot
                        )}
                      />
                    )}
                    {opt.icon && (
                      <span className="shrink-0 text-amber-600">{opt.icon}</span>
                    )}
                    <div className="flex flex-col truncate">
                      <span className="truncate">{opt.label}</span>
                      {opt.description && (
                        <span className="text-[11px] font-normal text-gray-400 truncate">
                          {opt.description}
                        </span>
                      )}
                    </div>
                    {opt.badge && (
                      <span className="shrink-0">{opt.badge}</span>
                    )}
                  </div>

                  {isSelected && (
                    <Check
                      size={15}
                      className={cn(
                        'shrink-0',
                        isDark ? 'text-amber-400' : 'text-amber-600'
                      )}
                    />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomDropdown;
