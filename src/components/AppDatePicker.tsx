import React from 'react';
import { DatePicker } from '@mui/x-date-pickers';
import dayjs from 'dayjs';

interface AppDatePickerProps {
  value: string;
  onChange: (val: string) => void;
  minDate?: string;
  className?: string;
  id?: string;
  placeholder?: string;
  format?: string;
}

export function AppDatePicker({ value, onChange, minDate, className, id, placeholder, format = "DD/MM/YYYY" }: AppDatePickerProps) {
  return (
    <DatePicker
      value={value && dayjs(value).isValid() ? dayjs(value) : null}
      onChange={(newVal) => onChange(newVal && newVal.isValid() ? newVal.format('YYYY-MM-DD') : '')}
      format={format}
      minDate={minDate && dayjs(minDate).isValid() ? dayjs(minDate) : undefined}
      slotProps={{
        textField: {
          id,
          error: false,
          size: 'small',
          // @ts-ignore
          placeholder: placeholder || 'DD/MM/YYYY',
          className,
          sx: {
            width: '100%',
            '& .MuiInputBase-root': {
              backgroundColor: 'inherit',
              color: 'inherit',
              borderRadius: '0.5rem',
              height: '100%',
            },
            '& .MuiOutlinedInput-notchedOutline': {
              border: 'none',
            },
          }
        }
      }}
    />
  );
}
