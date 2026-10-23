import DateTimePicker, {
  DateTimePickerEvent
} from '@react-native-community/datetimepicker';
import React, { useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  ViewStyle
} from 'react-native';
import { Colors, Radii, Spacing, Typography } from '../theme';

interface DatePickerInputProps {
  label: string;
  value: string; // YYYY-MM-DD
  onChange: (dateStr: string) => void;
  error?: string | null;
  style?: ViewStyle;
}

export function formatDateToCalendarString(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatDisplayDate(dateStr: string): string {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

export function DatePickerInput({
  label,
  value,
  onChange,
  error,
  style
}: DatePickerInputProps) {
  const [showPicker, setShowPicker] = useState<boolean>(false);

  const currentDateObj = (() => {
    if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [year, month, day] = value.split('-').map(Number);
      return new Date(year, month - 1, day);
    }
    return new Date();
  })();

  const handlePickerChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowPicker(false);
    }
    if (event.type === 'set' && selectedDate) {
      onChange(formatDateToCalendarString(selectedDate));
    }
    if (Platform.OS === 'ios') {
      if (selectedDate) {
        onChange(formatDateToCalendarString(selectedDate));
      }
    }
  };

  const applyOffsetDays = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    onChange(formatDateToCalendarString(d));
  };

  return (
    <View style={[styles.container, style]}>
      <Text style={styles.label}>{label}</Text>

      {Platform.OS === 'web' ? (
        // Web HTML5 date input
        <View style={[styles.inputWrapper, error && styles.inputWrapperError]}>
          <TextInput
            style={styles.textInput}
            value={value}
            onChangeText={(text) => {
              if (/^\d{0,4}(-\d{0,2})?(-\d{0,2})?$/.test(text)) {
                onChange(text);
              }
            }}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={Colors.textMuted}
          />
        </View>
      ) : (
        // Native interactive button opening picker
        <>
          <Pressable
            onPress={() => setShowPicker(true)}
            style={({ pressed }) => [
              styles.inputWrapper,
              pressed && styles.inputWrapperPressed,
              error && styles.inputWrapperError
            ]}
            accessibilityRole="button"
            accessibilityLabel={`Select due date, currently ${value}`}
          >
            <Text style={styles.calendarIcon}>📅</Text>
            <Text style={[styles.displayDateText, !value && styles.placeholderText]}>
              {value ? formatDisplayDate(value) : 'Select due date'}
            </Text>
            <Text style={styles.chevron}>▾</Text>
          </Pressable>

          {showPicker ? (
            <DateTimePicker
              value={currentDateObj}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={handlePickerChange}
            />
          ) : null}
        </>
      )}

      {/* Quick selection chips */}
      <View style={styles.quickChipsRow}>
        <Pressable
          onPress={() => applyOffsetDays(7)}
          style={styles.chip}
          hitSlop={4}
        >
          <Text style={styles.chipText}>+7 Days</Text>
        </Pressable>

        <Pressable
          onPress={() => applyOffsetDays(14)}
          style={styles.chip}
          hitSlop={4}
        >
          <Text style={styles.chipText}>+14 Days</Text>
        </Pressable>

        <Pressable
          onPress={() => applyOffsetDays(30)}
          style={styles.chip}
          hitSlop={4}
        >
          <Text style={styles.chipText}>+30 Days</Text>
        </Pressable>

        <Pressable
          onPress={() => applyOffsetDays(0)}
          style={styles.chip}
          hitSlop={4}
        >
          <Text style={styles.chipText}>Today</Text>
        </Pressable>

        <Pressable
          onPress={() => applyOffsetDays(-7)}
          style={[styles.chip, styles.chipPast]}
          hitSlop={4}
        >
          <Text style={[styles.chipText, styles.chipTextPast]}>Past Due (-7d)</Text>
        </Pressable>
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.xs
  },
  label: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    fontWeight: '600'
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radii.md,
    paddingHorizontal: Spacing.md,
    minHeight: 48,
    gap: Spacing.sm
  },
  inputWrapperPressed: {
    backgroundColor: Colors.surfaceSubtle
  },
  inputWrapperError: {
    borderColor: Colors.statusOverdue.text,
    backgroundColor: Colors.statusOverdue.background
  },
  calendarIcon: {
    fontSize: 18
  },
  displayDateText: {
    flex: 1,
    ...Typography.bodyLarge,
    color: Colors.textPrimary,
    fontWeight: '500'
  },
  placeholderText: {
    color: Colors.textMuted
  },
  chevron: {
    fontSize: 16,
    color: Colors.textSecondary
  },
  textInput: {
    flex: 1,
    ...Typography.bodyLarge,
    color: Colors.textPrimary
  },
  quickChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginTop: 2
  },
  chip: {
    backgroundColor: Colors.surfaceSubtle,
    borderRadius: Radii.full,
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: Spacing.xxs + 2,
    borderWidth: 1,
    borderColor: Colors.borderSubtle
  },
  chipPast: {
    backgroundColor: Colors.statusOverdue.background,
    borderColor: Colors.statusOverdue.border
  },
  chipText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textSecondary
  },
  chipTextPast: {
    color: Colors.statusOverdue.text
  },
  errorText: {
    ...Typography.caption,
    color: Colors.statusOverdue.text,
    fontWeight: '500'
  }
});
