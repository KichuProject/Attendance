import React, { useState, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  Modal,
  FlatList,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

export default function SearchableDropdownModal({
  visible,
  onClose,
  title = 'Select Option',
  items = [],
  selectedItem = '',
  onSelect,
  placeholder = 'Type to search...',
  allowCustom = false,
  customLabel = 'Use custom value',
}) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items;
    const q = searchQuery.toLowerCase().trim();
    return items.filter((item) => item.toLowerCase().includes(q));
  }, [items, searchQuery]);

  const hasExactMatch = useMemo(() => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return items.some((item) => item.toLowerCase().trim() === q);
  }, [items, searchQuery]);

  const handleSelectItem = (item) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (_h) {}
    if (typeof onSelect === 'function') {
      onSelect(item);
    }
    setSearchQuery('');
    onClose();
  };

  const handleSelectCustom = () => {
    if (!searchQuery.trim()) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (_h) {}
    if (typeof onSelect === 'function') {
      onSelect(searchQuery.trim());
    }
    setSearchQuery('');
    onClose();
  };

  const handleModalClose = () => {
    setSearchQuery('');
    onClose();
  };

  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={visible}
      onRequestClose={handleModalClose}
    >
      <Pressable style={styles.modalOverlay} onPress={handleModalClose}>
        <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
          {/* Modal Header */}
          <View style={styles.modalHeader}>
            <View style={styles.headerTitleWrap}>
              <Text style={styles.modalTitle}>{title}</Text>
              <Text style={styles.modalSubtitle}>
                {filteredItems.length} {filteredItems.length === 1 ? 'option' : 'options'} available
              </Text>
            </View>
            <TouchableOpacity
              onPress={handleModalClose}
              style={styles.closeBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={20} color="#64748B" />
            </TouchableOpacity>
          </View>

          {/* Search Box */}
          <View style={styles.searchBox}>
            <Ionicons name="search" size={17} color="#94A3B8" style={{ marginRight: 8 }} />
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={placeholder}
              placeholderTextColor="#94A3B8"
              autoCorrect={false}
              clearButtonMode="while-editing"
            />
            {Boolean(searchQuery) && (
              <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                <Ionicons name="close-circle" size={16} color="#94A3B8" />
              </TouchableOpacity>
            )}
          </View>

          {/* Custom Entry Prompt when no exact match */}
          {allowCustom && searchQuery.trim().length > 0 && !hasExactMatch && (
            <TouchableOpacity
              style={styles.customOptionBtn}
              onPress={handleSelectCustom}
              activeOpacity={0.8}
            >
              <Ionicons name="add-circle" size={18} color="#EA580C" style={{ marginRight: 8 }} />
              <Text style={styles.customOptionText}>
                {customLabel}: <Text style={{ fontWeight: '800' }}>&ldquo;{searchQuery.trim()}&rdquo;</Text>
              </Text>
            </TouchableOpacity>
          )}

          {/* List of items */}
          <FlatList
            data={filteredItems}
            keyExtractor={(item, index) => `${item}-${index}`}
            keyboardShouldPersistTaps="handled"
            style={styles.list}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => {
              const isSelected = item.toLowerCase() === (selectedItem || '').toLowerCase();
              return (
                <TouchableOpacity
                  style={[styles.itemRow, isSelected && styles.itemRowSelected]}
                  onPress={() => handleSelectItem(item)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.itemText, isSelected && styles.itemTextSelected]}>
                    {item}
                  </Text>
                  {isSelected && (
                    <Ionicons name="checkmark-circle" size={18} color="#EA580C" />
                  )}
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={
              !allowCustom ? (
                <View style={styles.emptyBox}>
                  <Ionicons name="search-outline" size={32} color="#CBD5E1" />
                  <Text style={styles.emptyText}>No matching options found</Text>
                </View>
              ) : null
            }
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '80%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingTop: 16,
    paddingBottom: 8,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerTitleWrap: {
    flex: 1,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  modalSubtitle: {
    fontSize: 11,
    fontWeight: '500',
    color: '#64748B',
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '600',
    padding: 0,
  },
  customOptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    borderRadius: 10,
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  customOptionText: {
    fontSize: 12.5,
    color: '#EA580C',
    fontWeight: '600',
    flex: 1,
  },
  list: {
    flexGrow: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  itemRowSelected: {
    backgroundColor: '#FFF7ED',
  },
  itemText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  itemTextSelected: {
    color: '#EA580C',
    fontWeight: '800',
  },
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    gap: 8,
  },
  emptyText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
  },
});
