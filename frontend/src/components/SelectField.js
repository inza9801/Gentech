import styles from '../styles/SelectFieldStyles';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';

export function SelectField({ label, value, placeholder, options, onSelect, disabled }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <View style={styles.field}>
        <Text style={styles.label}>{label}</Text>
        <Pressable
          disabled={disabled}
          onPress={() => setOpen(true)}
          style={[styles.select, disabled && styles.disabled]}
        >
          <Text style={[styles.value, !value && styles.placeholder]}>
            {value || placeholder || `Select ${label.toLowerCase()}`}
          </Text>
          <Ionicons name="chevron-down" size={17} color={colors.muted} />
        </Pressable>
      </View>
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={styles.modalRoot}>
          <Pressable style={styles.scrim} onPress={() => setOpen(false)} />
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{label}</Text>
              <Pressable onPress={() => setOpen(false)} accessibilityLabel="Close options">
                <Ionicons name="close" size={22} color={colors.text} />
              </Pressable>
            </View>
            <ScrollView>
              {options.map((option) => (
                <Pressable
                  key={String(option)}
                  onPress={() => {
                    onSelect(option);
                    setOpen(false);
                  }}
                  style={styles.option}
                >
                  <Text style={styles.value}>{option}</Text>
                  {option === value ? <Ionicons name="checkmark" size={18} color={colors.blue} /> : null}
                </Pressable>
              ))}
              {!options.length ? <Text style={styles.empty}>No options available.</Text> : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}


