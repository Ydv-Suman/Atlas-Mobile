import React, { useState } from 'react';
import { View, TextInput, Text, StyleSheet, TextInputProps, TouchableOpacity } from 'react-native';
import { colors, borderRadius, fontSize, spacing } from '../../core/theme/appTheme';

interface Props extends TextInputProps {
  label: string;
  error?: string;
}

export default function AtlasTextInput({ label, error, style, secureTextEntry, ...rest }: Props) {
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(true);
  const isPassword = secureTextEntry !== undefined;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={[
        styles.inputWrapper,
        focused && styles.inputFocused,
        error && styles.inputError,
      ]}>
        <TextInput
          style={[styles.input, style]}
          placeholderTextColor={colors.textMuted}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          secureTextEntry={isPassword ? hidden : false}
          {...rest}
        />
        {isPassword && (
          <TouchableOpacity onPress={() => setHidden(!hidden)} hitSlop={8} style={styles.toggle}>
            <Text style={styles.toggleText}>{hidden ? 'Show' : 'Hide'}</Text>
          </TouchableOpacity>
        )}
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  label: {
    color: colors.text,
    fontSize: fontSize.md,
    marginBottom: spacing.xs,
    fontWeight: '500',
  },
  inputWrapper: {
    backgroundColor: colors.inputBackground,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: borderRadius.sm,
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    color: colors.inputText,
    fontSize: fontSize.md,
  },
  inputFocused: {
    borderColor: colors.inputBorderFocus,
  },
  inputError: {
    borderColor: colors.error,
  },
  toggle: {
    paddingHorizontal: spacing.md,
  },
  toggleText: {
    color: colors.primary,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  error: {
    color: colors.error,
    fontSize: fontSize.xs,
    marginTop: spacing.xs,
  },
});
