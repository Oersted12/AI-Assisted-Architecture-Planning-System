import type { ComponentProps, PropsWithChildren, ReactNode } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const colors = {
  navy: '#1A3C5E',
  blue: '#D6EAF8',
  light: '#F4F6F9',
  gold: '#F0A500',
  green: '#1E8449',
  red: '#C0392B',
  muted: '#667085',
  text: '#1C2833',
  white: '#FFFFFF',
};

export function PlannerPage({ children }: PropsWithChildren) {
  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function Card({ children }: PropsWithChildren) {
  return <View style={styles.card}>{children}</View>;
}

export function ScreenTitle({
  title,
  step,
  onBack,
}: {
  title: string;
  step?: string;
  onBack?: () => void;
}) {
  return (
    <View style={styles.titleContainer}>
      {onBack ? (
        <Pressable onPress={onBack} style={styles.backButton} accessibilityRole="button">
          <Text style={styles.backButtonText}>Back</Text>
        </Pressable>
      ) : null}
      <View style={styles.flex}>
        {step ? <Text style={styles.stepLabel}>{step}</Text> : null}
        <Text style={styles.title}>{title}</Text>
      </View>
    </View>
  );
}

export function SectionTitle({ children }: PropsWithChildren) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

export function PlannerInput(props: ComponentProps<typeof TextInput>) {
  return (
    <TextInput
      placeholderTextColor="#8A94A3"
      style={[styles.input, props.multiline ? styles.multiline : null, props.style]}
      {...props}
    />
  );
}

export function ChoiceRow<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly { label: string; value: T }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.choiceRow}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            style={[styles.choice, selected ? styles.choiceSelected : null]}
          >
            <Text style={[styles.choiceText, selected ? styles.choiceTextSelected : null]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function ActionButton({
  title,
  onPress,
  disabled,
  loading,
  secondary,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  secondary?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled || loading) }}
      disabled={disabled || loading}
      onPress={onPress}
      style={[
        styles.actionButton,
        secondary ? styles.actionSecondary : null,
        disabled || loading ? styles.actionDisabled : null,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={secondary ? colors.navy : colors.white} />
      ) : (
        <Text style={[styles.actionText, secondary ? styles.actionTextSecondary : null]}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}

export function InlineMessage({
  children,
  kind = 'error',
}: PropsWithChildren<{ kind?: 'error' | 'info' | 'success' }>) {
  const messageColor =
    kind === 'success' ? colors.green : kind === 'info' ? colors.navy : colors.red;
  return (
    <View style={[styles.message, { borderLeftColor: messageColor }]}>
      <Text style={[styles.messageText, { color: messageColor }]}>{children}</Text>
    </View>
  );
}

export function Counter({
  value,
  onChange,
  minimum = 0,
  maximum = 20,
}: {
  value: number;
  onChange: (value: number) => void;
  minimum?: number;
  maximum?: number;
}) {
  return (
    <View style={styles.counter}>
      <Pressable
        accessibilityLabel="Decrease"
        accessibilityRole="button"
        disabled={value <= minimum}
        onPress={() => onChange(Math.max(minimum, value - 1))}
        style={[styles.counterButton, value <= minimum ? styles.counterDisabled : null]}
      >
        <Text style={styles.counterButtonText}>-</Text>
      </Pressable>
      <Text style={styles.counterValue}>{value}</Text>
      <Pressable
        accessibilityLabel="Increase"
        accessibilityRole="button"
        disabled={value >= maximum}
        onPress={() => onChange(Math.min(maximum, value + 1))}
        style={[styles.counterButton, styles.counterButtonPrimary, value >= maximum ? styles.counterDisabled : null]}
      >
        <Text style={[styles.counterButtonText, styles.counterButtonPrimaryText]}>+</Text>
      </Pressable>
    </View>
  );
}

export function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.dataRow}>
      <Text style={styles.dataLabel}>{label}</Text>
      <Text style={styles.dataValue}>{value}</Text>
    </View>
  );
}

export const plannerColors = colors;

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.light },
  flex: { flex: 1 },
  content: { padding: 18, gap: 14, paddingBottom: 36 },
  titleContainer: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 2 },
  backButton: {
    minWidth: 64,
    minHeight: 44,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.blue,
  },
  backButtonText: { color: colors.navy, fontWeight: '700' },
  stepLabel: { color: colors.gold, fontWeight: '700', fontSize: 12, marginBottom: 4 },
  title: { color: colors.navy, fontSize: 23, fontWeight: '800' },
  card: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 18,
    gap: 12,
    borderWidth: 1,
    borderColor: '#E8EDF3',
  },
  sectionTitle: {
    color: colors.navy,
    fontSize: 16,
    fontWeight: '800',
    marginTop: 4,
  },
  field: { gap: 7 },
  fieldLabel: { color: colors.navy, fontSize: 14, fontWeight: '700' },
  hint: { color: colors.muted, fontSize: 12, lineHeight: 17 },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.blue,
    borderRadius: 10,
    paddingHorizontal: 13,
    color: colors.text,
    backgroundColor: colors.white,
    fontSize: 15,
  },
  multiline: { minHeight: 96, paddingTop: 12, textAlignVertical: 'top' },
  choiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: {
    minHeight: 42,
    paddingHorizontal: 13,
    justifyContent: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.blue,
    backgroundColor: colors.white,
  },
  choiceSelected: { backgroundColor: colors.navy, borderColor: colors.navy },
  choiceText: { color: colors.navy, fontSize: 13, fontWeight: '600' },
  choiceTextSelected: { color: colors.white },
  actionButton: {
    minHeight: 50,
    borderRadius: 12,
    backgroundColor: colors.navy,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  actionSecondary: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.navy },
  actionDisabled: { opacity: 0.55 },
  actionText: { color: colors.white, fontSize: 15, fontWeight: '800' },
  actionTextSecondary: { color: colors.navy },
  message: {
    borderLeftWidth: 4,
    backgroundColor: '#FFF8E8',
    borderRadius: 9,
    padding: 12,
  },
  messageText: { fontSize: 13, lineHeight: 19, fontWeight: '500' },
  counter: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  counterButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.blue,
    backgroundColor: colors.white,
  },
  counterButtonPrimary: { backgroundColor: colors.navy, borderColor: colors.navy },
  counterButtonText: { color: colors.navy, fontSize: 23, fontWeight: '700', lineHeight: 27 },
  counterButtonPrimaryText: { color: colors.white },
  counterDisabled: { opacity: 0.4 },
  counterValue: { minWidth: 28, textAlign: 'center', fontSize: 18, fontWeight: '800', color: colors.navy },
  dataRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, paddingVertical: 5 },
  dataLabel: { color: colors.muted, fontSize: 13, flex: 1 },
  dataValue: { color: colors.navy, fontSize: 13, fontWeight: '700', textAlign: 'right', flex: 1 },
});
