import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Modal,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { WebView } from 'react-native-webview';
import { api } from '../services/api';

export default function Report({ user, records, onBack }) {
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);

  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const [calendarVisible, setCalendarVisible] = useState(false);
  const [calendarTarget, setCalendarTarget] = useState('from');
  const [viewDate, setViewDate] = useState(new Date());

  const [dbRecords, setDbRecords] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const [areaName, setAreaName] = useState(null);
  const [areaLoading, setAreaLoading] = useState(false);
  const [modalScrollEnabled, setModalScrollEnabled] = useState(true);

  useEffect(() => {
    async function fetchHistory() {
      if (!user?.id) return;
      setIsLoading(true);
      try {
        const res = await api.getHistory(user.id, fromDate, toDate);
        if (res.success && Array.isArray(res.records)) {
          setDbRecords(res.records);
        }
      } catch (err) {
        console.error('Fetch history error:', err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchHistory();
  }, [user?.id, fromDate, toDate]);

  const attendanceRecords = dbRecords !== null ? dbRecords : (records || []);

  const parseDate = (dStr) => {
    if (!dStr) return null;
    const trimmed = dStr.trim();

    if (/^\d{2}[-/]\d{2}[-/]\d{4}$/.test(trimmed)) {
      const parts = trimmed.split(/[-/]/);
      return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
    }

    if (/^\d{4}[-/]\d{2}[-/]\d{2}$/.test(trimmed)) {
      const parts = trimmed.split(/[-/]/);
      return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    }

    const timestamp = Date.parse(trimmed);
    return isNaN(timestamp) ? null : new Date(timestamp);
  };

  const filteredRecords = attendanceRecords.filter((item) => {
    if (!fromDate && !toDate) return true;

    const recordDate = parseDate(item.date);
    if (!recordDate) return true;

    if (fromDate) {
      const start = parseDate(fromDate);
      if (start) {
        start.setHours(0, 0, 0, 0);
        if (recordDate < start) return false;
      }
    }

    if (toDate) {
      const end = parseDate(toDate);
      if (end) {
        end.setHours(23, 59, 59, 999);
        if (recordDate > end) return false;
      }
    }

    return true;
  });

  const handleReset = () => {
    setFromDate('');
    setToDate('');
  };

  const parseCoord = (str) => {
    if (!str || str === '--') return null;
    const match = str.match(/([\d.]+)°\s*([NSEW])/);
    if (!match) return null;
    const val = parseFloat(match[1]);
    return match[2] === 'S' || match[2] === 'W' ? -val : val;
  };

  const isLateTime = (time) => {
    if (!time || time === '--' || time === '--:--') return false;
    const match = String(time).trim().match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i);
    if (!match) return false;
    let hour = Number(match[1]);
    const period = match[3]?.toUpperCase();
    if (period === 'AM' && hour === 12) hour = 0;
    if (period === 'PM' && hour !== 12) hour += 12;
    return hour > 10 || (hour === 10 && Number(match[2]) > 0);
  };

  const handleViewPress = async (record) => {
    setSelectedRecord(record);
    setAreaName(null);
    setModalVisible(true);

    const lat = parseCoord(record.latitude);
    const lon = parseCoord(record.longitude);

    if (lat !== null && lon !== null) {
      setAreaLoading(true);
      try {
        const [addr] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lon });
        const place = [addr.district || addr.subregion, addr.city].filter(Boolean).join(', ');
        setAreaName(place || addr.name || null);
      } catch (e) {
        setAreaName(null);
      } finally {
        setAreaLoading(false);
      }
    }
  };

  const openCalendar = (target) => {
    setCalendarTarget(target);
    const val = target === 'from' ? fromDate : toDate;
    const parsed = parseDate(val);
    setViewDate(parsed || new Date());
    setCalendarVisible(true);
  };

  const nextMonth = () => {
    setViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const prevMonth = () => {
    setViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const onSelectDate = (dayNumber) => {
    const y = viewDate.getFullYear();
    const m = String(viewDate.getMonth() + 1).padStart(2, '0');
    const d = String(dayNumber).padStart(2, '0');
    const formatted = `${y}-${m}-${d}`;

    if (calendarTarget === 'from') {
      setFromDate(formatted);
    } else {
      setToDate(formatted);
    }
    setCalendarVisible(false);
  };

  const selectToday = () => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    const formatted = `${y}-${m}-${d}`;

    if (calendarTarget === 'from') {
      setFromDate(formatted);
    } else {
      setToDate(formatted);
    }
    setCalendarVisible(false);
  };

  // Calendar Grid Calculations
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  const weekDays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  const cYear = viewDate.getFullYear();
  const cMonth = viewDate.getMonth();
  const firstDayIndex = new Date(cYear, cMonth, 1).getDay();
  const totalDaysInMonth = new Date(cYear, cMonth + 1, 0).getDate();

  const blanks = Array.from({ length: firstDayIndex }, (_, i) => i);
  const monthDays = Array.from({ length: totalDaysInMonth }, (_, i) => i + 1);

  const activeVal = calendarTarget === 'from' ? fromDate : toDate;
  const isDaySelected = (dayNum) => {
    if (!activeVal) return false;
    const p = parseDate(activeVal);
    if (!p) return false;
    return p.getFullYear() === cYear && p.getMonth() === cMonth && p.getDate() === dayNum;
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={onBack}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={20} color="#0F172A" />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Attendance Report</Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Date Filter Card (Above Table) */}
        <View style={styles.filterCard}>
          <View style={styles.filterHeader}>
            <View style={styles.filterTitleRow}>
              <Ionicons name="calendar" size={17} color="#0284C7" />
              <Text style={styles.filterTitle}>Filter by Date Range</Text>
            </View>
            {fromDate || toDate ? (
              <TouchableOpacity onPress={handleReset} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={styles.resetText}>Reset</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Inputs Row: From Date and To Date with Calendar Tap */}
          <View style={styles.dateInputsRow}>
            {/* From Date Box */}
            <View style={styles.dateInputWrapper}>
              <Text style={styles.dateInputLabel}>From Date</Text>
              <TouchableOpacity
                style={[
                  styles.dateInputBox,
                  fromDate && styles.dateInputBoxFilled,
                ]}
                onPress={() => openCalendar('from')}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="calendar-outline"
                  size={16}
                  color={fromDate ? '#0284C7' : '#64748B'}
                  style={styles.inputIcon}
                />
                <Text
                  style={[
                    styles.dateDisplayValue,
                    !fromDate && styles.dateDisplayPlaceholder,
                  ]}
                  numberOfLines={1}
                >
                  {fromDate || 'Select Date'}
                </Text>
                {fromDate ? (
                  <TouchableOpacity
                    onPress={() => setFromDate('')}
                    style={styles.clearIcon}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="close-circle" size={16} color="#94A3B8" />
                  </TouchableOpacity>
                ) : null}
              </TouchableOpacity>
            </View>

            {/* To Date Box */}
            <View style={styles.dateInputWrapper}>
              <Text style={styles.dateInputLabel}>To Date</Text>
              <TouchableOpacity
                style={[
                  styles.dateInputBox,
                  toDate && styles.dateInputBoxFilled,
                ]}
                onPress={() => openCalendar('to')}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="calendar-outline"
                  size={16}
                  color={toDate ? '#0284C7' : '#64748B'}
                  style={styles.inputIcon}
                />
                <Text
                  style={[
                    styles.dateDisplayValue,
                    !toDate && styles.dateDisplayPlaceholder,
                  ]}
                  numberOfLines={1}
                >
                  {toDate || 'Select Date'}
                </Text>
                {toDate ? (
                  <TouchableOpacity
                    onPress={() => setToDate('')}
                    style={styles.clearIcon}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="close-circle" size={16} color="#94A3B8" />
                  </TouchableOpacity>
                ) : null}
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Table Section */}
        <View style={styles.tableSection}>
          <View style={styles.tableHeaderInfo}>
            <Text style={styles.recordsCountText}>
              Showing {filteredRecords.length} of {attendanceRecords.length} records
            </Text>
          </View>

          {isLoading ? (
            <View style={{ paddingVertical: 40, alignItems: 'center' }}>
              <ActivityIndicator size="large" color="#0284C7" />
              <Text style={{ marginTop: 12, color: '#64748B', fontSize: 13, fontWeight: '500' }}>
                Loading attendance records...
              </Text>
            </View>
          ) : filteredRecords.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="calendar-outline" size={38} color="#94A3B8" />
              <Text style={styles.emptyTitle}>No Records Found</Text>
              <Text style={styles.emptySubtitle}>
                No attendance found between {fromDate} and {toDate}
              </Text>
              <TouchableOpacity style={styles.clearFilterBtn} onPress={handleReset}>
                <Text style={styles.clearFilterBtnText}>Clear Filter</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.tableContainer}>
              {/* Table Header */}
              <View style={styles.tableHeaderRow}>
                <Text style={[styles.columnHeader, styles.colSno]}>S.No</Text>
                <Text style={[styles.columnHeader, styles.colDate]}>Date</Text>
                <Text style={[styles.columnHeader, styles.colIn]}>IN</Text>
                <Text style={[styles.columnHeader, styles.colOut]}>OUT</Text>
                <Text style={[styles.columnHeader, styles.colAction]}>Action</Text>
              </View>

              {/* Table Rows */}
              {filteredRecords.map((item, index) => {
                const isLast = index === filteredRecords.length - 1;
                return (
                  <View
                    key={item.id || index}
                    style={[styles.tableRow, isLast && styles.tableRowLast]}
                  >
                    <Text style={[styles.cellText, styles.colSno]}>{item.sno}</Text>
                    <Text style={[styles.cellDateText, styles.colDate]}>{item.date}</Text>

                    {/* IN Time */}
                    <Text style={[
                      styles.cellTimeIn,
                      styles.colIn,
                      isLateTime(item.inTime) && styles.cellTimeInLate,
                    ]}>
                      {item.inTime && item.inTime !== '--:--' ? item.inTime : '--'}
                    </Text>

                    {/* OUT Time */}
                    <Text style={[
                      styles.cellTimeOut,
                      styles.colOut,
                      item.outTime && item.outTime !== '--:--' && styles.cellTimeOutActive,
                    ]}>
                      {item.outTime && item.outTime !== '--:--' ? item.outTime : '--'}
                    </Text>

                    {/* View Action Button */}
                    <View style={styles.colAction}>
                      <TouchableOpacity
                        style={styles.viewButton}
                        onPress={() => handleViewPress(item)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.viewButtonText}>View</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Calendar Picker Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={calendarVisible}
        onRequestClose={() => setCalendarVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setCalendarVisible(false)}
        >
          <Pressable
            style={styles.calendarCard}
            onPress={(e) => e.stopPropagation()}
          >
            {/* Header: Month and Navigation */}
            <View style={styles.calendarHeader}>
              <TouchableOpacity
                onPress={prevMonth}
                style={styles.monthNavButton}
                activeOpacity={0.7}
              >
                <Ionicons name="chevron-back" size={20} color="#0F172A" />
              </TouchableOpacity>
              <View style={styles.calendarTitleContainer}>
                <Text style={styles.calendarTargetLabel}>
                  {calendarTarget === 'from' ? 'Select From Date' : 'Select To Date'}
                </Text>
                <Text style={styles.calendarMonthText}>
                  {monthNames[cMonth]} {cYear}
                </Text>
              </View>
              <TouchableOpacity
                onPress={nextMonth}
                style={styles.monthNavButton}
                activeOpacity={0.7}
              >
                <Ionicons name="chevron-forward" size={20} color="#0F172A" />
              </TouchableOpacity>
            </View>

            {/* Weekday Names Row */}
            <View style={styles.weekDaysRow}>
              {weekDays.map((wd) => (
                <Text key={wd} style={styles.weekDayText}>
                  {wd}
                </Text>
              ))}
            </View>

            {/* Calendar Days Grid */}
            <View style={styles.daysGrid}>
              {blanks.map((b) => (
                <View key={`b-${b}`} style={styles.dayCell} />
              ))}
              {monthDays.map((d) => {
                const selected = isDaySelected(d);
                return (
                  <TouchableOpacity
                    key={`d-${d}`}
                    style={styles.dayCell}
                    onPress={() => onSelectDate(d)}
                    activeOpacity={0.6}
                  >
                    <View
                      style={[
                        styles.dayCellInner,
                        selected && styles.selectedDayCell,
                      ]}
                    >
                      <Text
                        style={[
                          styles.dayText,
                          selected && styles.selectedDayText,
                        ]}
                      >
                        {d}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Calendar Footer Buttons */}
            <View style={styles.calendarFooter}>
              <TouchableOpacity
                style={styles.calendarTodayBtn}
                onPress={selectToday}
                activeOpacity={0.7}
              >
                <Text style={styles.calendarTodayText}>Today</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.calendarCancelBtn}
                onPress={() => setCalendarVisible(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.calendarCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Attendance Detail Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          {/* Backdrop tap to close */}
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setModalVisible(false)}
          />

          <View style={styles.modalContent}>
            {/* Modal Header (Fixed at top) */}
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Attendance Details</Text>
                <Text style={styles.modalSubtitle}>{selectedRecord?.date}</Text>
              </View>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Scrollable details */}
            <ScrollView
              style={styles.modalScrollView}
              contentContainerStyle={styles.modalScrollContent}
              showsVerticalScrollIndicator={true}
              bounces={true}
              keyboardShouldPersistTaps="handled"
            >

              {/* Modal Body: Fields */}
              <View style={styles.modalBody}>
                {/* 1. Emp ID */}
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Emp ID</Text>
                  <Text style={styles.detailValue}>
                    {selectedRecord?.empId || '--'}
                  </Text>
                </View>

                {/* 2. Employee Name */}
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Name</Text>
                  <Text style={styles.detailValue}>
                    {selectedRecord?.name || user?.name || user?.username || '--'}
                  </Text>
                </View>

                {/* 3. Date */}
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Date</Text>
                  <Text style={styles.detailValue}>{selectedRecord?.date || '--'}</Text>
                </View>

                {/* 4. IN / OUT Time (side by side) */}
                <View style={styles.detailRow}>
                  <View style={styles.timeInOutBox}>
                    <Ionicons
                      name="enter-outline"
                      size={13}
                      color={isLateTime(selectedRecord?.inTime) ? '#DC2626' : '#16A34A'}
                    />
                    <Text style={styles.timeInOutLabel}>IN</Text>
                    <Text style={[
                      styles.timeInOutValue,
                      isLateTime(selectedRecord?.inTime) && { color: '#DC2626' },
                    ]}>
                      {selectedRecord?.inTime || '--:--'}
                    </Text>
                  </View>
                  <View style={styles.timeInOutDivider} />
                  <View style={[styles.timeInOutBox, { alignItems: 'flex-end' }]}>
                    <Ionicons
                      name="exit-outline"
                      size={13}
                      color={selectedRecord?.outTime && selectedRecord.outTime !== '--:--' ? '#16A34A' : '#EA580C'}
                    />
                    <Text style={styles.timeInOutLabel}>OUT</Text>
                    <Text style={[
                      styles.timeInOutValue,
                      selectedRecord?.outTime && selectedRecord.outTime !== '--:--' && { color: '#16A34A' },
                    ]}>
                      {selectedRecord?.outTime || '--:--'}
                    </Text>
                  </View>
                </View>

                {/* 5. IN Location */}
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>IN Lat</Text>
                  <Text style={styles.detailValue}>{selectedRecord?.latitude || '--'}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>IN Lon</Text>
                  <Text style={styles.detailValue}>{selectedRecord?.longitude || '--'}</Text>
                </View>

                {/* 6. OUT Location */}
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>OUT Lat</Text>
                  <Text style={styles.detailValue}>{selectedRecord?.outLatitude && selectedRecord.outLatitude !== '--' ? selectedRecord.outLatitude : '--'}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>OUT Lon</Text>
                  <Text style={styles.detailValue}>{selectedRecord?.outLongitude && selectedRecord.outLongitude !== '--' ? selectedRecord.outLongitude : '--'}</Text>
                </View>

                {/* 7. Area Name */}
                <View style={[styles.detailRow, styles.detailRowLast]}>
                  <Text style={styles.detailLabel}>Area</Text>
                  {areaLoading ? (
                    <ActivityIndicator size="small" color="#0284C7" />
                  ) : (
                    <Text style={[styles.detailValue, { flex: 1, textAlign: 'right' }]} numberOfLines={2}>
                      {areaName || '--'}
                    </Text>
                  )}
                </View>
              </View>

              {/* Map Section — dual pins for IN and OUT */}
              {(() => {
                const inLat = parseCoord(selectedRecord?.latitude);
                const inLon = parseCoord(selectedRecord?.longitude);
                const outLat = parseCoord(selectedRecord?.outLatitude);
                const outLon = parseCoord(selectedRecord?.outLongitude);
                const hasIn = inLat !== null && inLon !== null;
                const hasOut = outLat !== null && outLon !== null;

                if (!hasIn && !hasOut) return (
                  <View style={styles.mapPlaceholder}>
                    <Ionicons name="map-outline" size={28} color="#94A3B8" />
                    <Text style={styles.mapPlaceholderText}>No location data</Text>
                  </View>
                );

                // Check if IN and OUT are at identical/overlapping location (< 25 meters)
                const isOverlapping = hasIn && hasOut && Math.abs(inLat - outLat) < 0.00025 && Math.abs(inLon - outLon) < 0.00025;

                // If overlapping, slightly offset coordinates so both pins are clearly visible side-by-side
                const plotInLat = inLat;
                const plotInLon = isOverlapping ? inLon - 0.00010 : inLon;
                const plotOutLat = outLat;
                const plotOutLon = isOverlapping ? outLon + 0.00010 : outLon;

                const centerLat = hasIn && hasOut ? (inLat + outLat) / 2 : (hasIn ? inLat : outLat);
                const centerLon = hasIn && hasOut ? (inLon + outLon) / 2 : (hasIn ? inLon : outLon);

                const inTime  = selectedRecord?.inTime  || '';
                const outTime = selectedRecord?.outTime || '';

                const leafletHtml = `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
  html,body,#map{height:100%;margin:0;padding:0;}
  .leaflet-popup-content-wrapper{border-radius:12px;box-shadow:0 4px 12px rgba(0,0,0,0.15);}
  .leaflet-popup-content{margin:8px 12px;line-height:1.4;}
</style>
</head><body>
<div id="map"></div>
<script>
var map = L.map('map', {zoomControl: true}).setView([${centerLat},${centerLon}], 16);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19}).addTo(map);

${hasIn ? `var inIcon = L.divIcon({
  html:'<div style="background:#16A34A;color:#fff;border-radius:50% 50% 50% 0;width:32px;height:32px;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:bold;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.35);transform:rotate(-45deg)"><span style="transform:rotate(45deg)">IN</span></div>',
  iconSize:[32,32],
  iconAnchor:[16,32],
  className:''
});
var inMarker = L.marker([${plotInLat},${plotInLon}],{icon:inIcon, zIndexOffset: 100}).addTo(map);
inMarker.bindPopup('<div style="text-align:center"><b style="color:#16A34A;font-size:13px">CHECK IN</b><div style="font-size:12px;color:#334155;margin-top:2px">${inTime || "--:--"}</div></div>');
` : ''}

${hasOut ? `var outIcon = L.divIcon({
  html:'<div style="background:#EA580C;color:#fff;border-radius:50% 50% 50% 0;width:32px;height:32px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:bold;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.35);transform:rotate(-45deg)"><span style="transform:rotate(45deg)">OUT</span></div>',
  iconSize:[32,32],
  iconAnchor:[16,32],
  className:''
});
var outMarker = L.marker([${plotOutLat},${plotOutLon}],{icon:outIcon, zIndexOffset: 200}).addTo(map);
outMarker.bindPopup('<div style="text-align:center"><b style="color:#EA580C;font-size:13px">CHECK OUT</b><div style="font-size:12px;color:#334155;margin-top:2px">${outTime || "--:--"}</div></div>');
` : ''}

${isOverlapping ? `
// Connecting dashed indicator line between both pins showing they share the spot
L.polyline([[${plotInLat},${plotInLon}],[${plotOutLat},${plotOutLon}]],{color:'#64748B',weight:2,dashArray:'3,4',opacity:0.7}).addTo(map);
if (typeof inMarker !== 'undefined') inMarker.openPopup();
` : ''}

${hasIn && hasOut && !isOverlapping ? `map.fitBounds([[${plotInLat},${plotInLon}],[${plotOutLat},${plotOutLon}]],{padding:[35,35]});` : `map.setView([${centerLat},${centerLon}], 16);`}
</script></body></html>`;

                return (
                  <View style={styles.mapContainer}>
                    <View style={styles.mapLabelRow}>
                      <Ionicons name="location" size={14} color="#4F46E5" />
                      <Text style={styles.mapLabel}>Location Map</Text>
                      {hasIn && <View style={styles.mapLegendIn}><Text style={styles.mapLegendText}>● IN</Text></View>}
                      {hasOut && <View style={styles.mapLegendOut}><Text style={styles.mapLegendTextOut}>● OUT</Text></View>}
                    </View>
                    <View style={styles.mapWebviewWrapper}>
                      <WebView
                        style={styles.map}
                        source={{ html: leafletHtml }}
                        javaScriptEnabled={true}
                        nestedScrollEnabled={true}
                        originWhitelist={['*']}
                      />
                    </View>
                  </View>
                );
              })()}

              {/* Close Button */}
              <TouchableOpacity
                style={styles.modalDoneButton}
                onPress={() => setModalVisible(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.modalDoneButtonText}>Close</Text>
              </TouchableOpacity>

            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  container: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 36,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
    gap: 6,
  },
  backText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  headerTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  headerSpacer: {
    width: 68,
  },

  /* Filter Card Styles */
  filterCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 18,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
  },
  filterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  filterTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filterTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  resetText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#0284C7',
  },
  dateInputsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  dateInputWrapper: {
    flex: 1,
  },
  dateInputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 6,
    letterSpacing: 0.2,
  },
  dateInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    height: 46,
  },
  dateInputBoxFilled: {
    borderColor: '#0284C7',
    backgroundColor: '#FFFFFF',
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  inputIcon: {
    marginRight: 6,
  },
  dateDisplayValue: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '700',
  },
  dateDisplayPlaceholder: {
    color: '#94A3B8',
    fontWeight: '500',
  },
  clearIcon: {
    padding: 3,
  },

  /* Calendar Modal Styles */
  calendarCard: {
    width: '100%',
    maxWidth: 350,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  calendarTitleContainer: {
    alignItems: 'center',
  },
  calendarTargetLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0284C7',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  calendarMonthText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  monthNavButton: {
    padding: 8,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  weekDaysRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 8,
  },
  weekDayText: {
    width: 38,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.28%',
    height: 38,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 2,
  },
  dayCellInner: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedDayCell: {
    backgroundColor: '#0284C7',
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  dayText: {
    fontSize: 13,
    color: '#1E293B',
    fontWeight: '600',
  },
  selectedDayText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  calendarFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  calendarTodayBtn: {
    backgroundColor: '#F0F9FF',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  calendarTodayText: {
    color: '#0284C7',
    fontWeight: '800',
    fontSize: 12.5,
  },
  calendarCancelBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  calendarCancelText: {
    color: '#64748B',
    fontWeight: '600',
    fontSize: 12.5,
  },

  /* Table Section Styles */
  tableSection: {
    marginTop: 6,
  },
  tableHeaderInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  recordsCountText: {
    fontSize: 12.5,
    color: '#64748B',
    fontWeight: '600',
  },
  tableContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  columnHeader: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  tableRowLast: {
    borderBottomWidth: 0,
  },
  colSno: {
    width: 36,
  },
  colDate: {
    flex: 1,
  },
  colIn: {
    width: 68,
    alignItems: 'center',
  },
  colOut: {
    width: 68,
    alignItems: 'center',
  },
  cellTimeIn: {
    fontSize: 11,
    fontWeight: '700',
    color: '#16A34A',
    textAlign: 'center',
  },
  cellTimeInLate: {
    color: '#DC2626',
  },
  cellTimeOut: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
    textAlign: 'center',
  },
  cellTimeOutActive: {
    color: '#16A34A',
  },
  colAction: {
    width: 60,
    alignItems: 'flex-end',
  },
  cellText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
  },
  cellDateText: {
    fontSize: 13.5,
    color: '#0F172A',
    fontWeight: '600',
  },
  rowStatusBadge: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusBadgeNotIn: {
    backgroundColor: '#FEF2F2',
  },
  statusBadgeIn: {
    backgroundColor: '#ECFDF5',
  },
  statusBadgeOut: {
    backgroundColor: '#FFFBEB',
  },
  rowStatusText: {
    fontSize: 10.5,
    fontWeight: '800',
  },
  statusTextNotIn: {
    color: '#DC2626',
  },
  statusTextIn: {
    color: '#15803D',
  },
  statusTextOut: {
    color: '#B45309',
  },
  viewButton: {
    backgroundColor: '#F0F9FF',
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  viewButtonText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#0284C7',
  },

  /* Empty State */
  emptyContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 36,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 1,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 14,
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 18,
    lineHeight: 18,
  },
  clearFilterBtn: {
    backgroundColor: '#F0F9FF',
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  clearFilterBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0284C7',
  },

  /* Modal Styles */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 390,
    maxHeight: '88%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 16,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 22,
    elevation: 12,
  },
  modalScrollView: {
    width: '100%',
  },
  modalScrollContent: {
    paddingBottom: 12,
  },
  mapWebviewWrapper: {
    height: 200,
    width: '100%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalSubtitle: {
    fontSize: 12.5,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '500',
  },
  modalCloseButton: {
    padding: 6,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
  },
  modalBody: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 18,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  detailRowLast: {
    borderBottomWidth: 0,
  },
  detailLabel: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
  },
  detailValue: {
    fontSize: 13.5,
    color: '#0F172A',
    fontWeight: '700',
  },
  timeInOutBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  timeInOutLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  timeInOutValue: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  timeInOutDivider: {
    width: 1,
    height: 22,
    backgroundColor: '#E2E8F0',
    marginHorizontal: 10,
  },
  modalDoneButton: {
    backgroundColor: '#0284C7',
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 4,
  },
  modalDoneButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  /* Map styles */
  mapContainer: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  mapLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  mapLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4F46E5',
    letterSpacing: 0.2,
    flex: 1,
  },
  mapLegendIn: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 4,
  },
  mapLegendText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#16A34A',
  },
  mapLegendOut: {
    backgroundColor: '#FFF7ED',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 4,
  },
  mapLegendTextOut: {
    fontSize: 11,
    fontWeight: '800',
    color: '#EA580C',
  },
  map: {
    width: '100%',
    height: 200,
  },
  mapPlaceholder: {
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
    gap: 8,
  },
  mapPlaceholderText: {
    fontSize: 13,
    color: '#94A3B8',
    fontWeight: '600',
  },
});
