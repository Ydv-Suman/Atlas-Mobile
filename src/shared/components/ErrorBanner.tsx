import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, borderRadius, fontSize, spacing } from '../../core/theme/appTheme';

interface Props {
  message: string;
  onDismiss?: () => void;
}

export default function ErrorBanner({ message, onDismiss }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>{message}</Text>
      {onDismiss && (
        <TouchableOpacity onPress={onDismiss} hitSlop={8}>
          <Text style={styles.dismiss}>✕</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.error + '1A',
    borderWidth: 1,
    borderColor: colors.error + '40',
    borderRadius: borderRadius.sm,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  text: {
    color: colors.errorLight,
    fontSize: fontSize.sm,
    flex: 1,
  },
  dismiss: {
    color: colors.errorLight,
    fontSize: fontSize.md,
    marginLeft: spacing.sm,
  },
});
