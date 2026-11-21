import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { api } from '../services/api';
import THEME from '../constants/theme';
import CalendarPickerModal from '../components/home/CalendarPickerModal';
import SearchableDropdownModal from '../components/SearchableDropdownModal';
import { ALL_INDIAN_STATES, getCitiesForState } from '../constants/indiaGeoData';

export default function CompleteProfile({ user, onComplete, onLogout }) {
  // DB-Fetched Employee ID (First Field, Strictly Read-Only)
  const [empId, setEmpId] = useState(user?.empId || '--');
  const [isFetchingEmpId, setIsFetchingEmpId] = useState(true);

  // Section 1: Personal & Identity
  const [firstName, setFirstName] = useState(() => {
    const raw = user?.name || user?.username || '';
    return raw.split(' ')[0] || '';
  });
  const [lastName, setLastName] = useState(() => {
    const raw = user?.name || '';
    const parts = raw.split(' ');
    return parts.length > 1 ? parts.slice(1).join(' ') : '';
  });
  const [gender, setGender] = useState('Male');
  const [dob, setDob] = useState('');
  const [aadhaarNo, setAadhaarNo] = useState('');
  const [fatherName, setFatherName] = useState('');

  // Section 2: Contact & Address
  const [mobile, setMobile] = useState('');
  const [officialEmail, setOfficialEmail] = useState(
    user?.email || (user?.username && user.username !== 'hr' ? `${user.username.toLowerCase()}@pskgroup.com` : '')
  );
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [homeState, setHomeState] = useState('Tamil Nadu');

  // Section 3: Medical & Emergency Contact
  const [bloodGroup, setBloodGroup] = useState('O+');
  const [emergencyPerson, setEmergencyPerson] = useState('');
  const [emergencyRelation, setEmergencyRelation] = useState('Father');
  const [emergencyNumber, setEmergencyNumber] = useState('');

  // Section 4: Work & Engineering Details
  const [department, setDepartment] = useState('Civil Engineering');
  const [designation, setDesignation] = useState('Site Engineer');

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Calendar Modal State for DOB
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [calMonth, setCalMonth] = useState(0);
  const [calYear, setCalYear] = useState(2000);

  // Dropdown Modals State
  const [stateModalVisible, setStateModalVisible] = useState(false);
  const [cityModalVisible, setCityModalVisible] = useState(false);
  const [departmentModalVisible, setDepartmentModalVisible] = useState(false);
  const [designationModalVisible, setDesignationModalVisible] = useState(false);

  const bloodGroupOptions = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];
  const genderOptions = ['Male', 'Female', 'Other'];
  const relationOptions = ['Father', 'Mother', 'Spouse', 'Sibling', 'Relative'];
  const departmentOptions = [
    'Civil Engineering',
    'Planning & Billing',
    'Design / BIM',
    'QA / QC',
    'Site Operations',
    'Mechanical & Electrical (MEP)',
    'Commercial & Accounts',
    'Procurement & Stores',
    'HR & Admin',
    'Safety & Environment (HSE)',
  ];
  const designationOptions = [
    'Site Engineer',
    'Senior Site Engineer',
    'Planning Engineer',
    'Project Manager',
    'Assistant Project Manager',
    'Quantity Surveyor',
    'Billing Engineer',
    'Structural Designer',
    'BIM Modeler / Engineer',
    'QA / QC Engineer',
    'Safety Officer',
    'Site Supervisor',
    'Surveyor',
    'Commercial Officer',
  ];

  // Fetch verified empId and any existing profile data from DB on mount
  useEffect(() => {
    let isMounted = true;
    if (user?.id) {
      api.getEmployeeProfile(user.id)
        .then((res) => {
          if (!isMounted) return;
          if (res && res.empId) {
            setEmpId(res.empId);
          }
          if (res && res.profile) {
            const p = res.profile;
            if (p.first_name) setFirstName(p.first_name);
            if (p.last_name) setLastName(p.last_name);
            if (p.gender) setGender(p.gender);
            if (p.dob) setDob(p.dob);
            if (p.aadhaar_no) setAadhaarNo(p.aadhaar_no);
            if (p.father_name) setFatherName(p.father_name);
            if (p.mobile) setMobile(p.mobile);
            if (p.official_email) setOfficialEmail(p.official_email);
            if (p.address) setAddress(p.address);
            if (p.city) setCity(p.city);
            if (p.home_state) setHomeState(p.home_state);
            if (p.blood_group) setBloodGroup(p.blood_group);
            if (p.emergency_contact_person) setEmergencyPerson(p.emergency_contact_person);
            if (p.emergency_contact_relation) setEmergencyRelation(p.emergency_contact_relation);
            if (p.emergency_contact_number) setEmergencyNumber(p.emergency_contact_number);
            if (p.department) setDepartment(p.department);
            if (p.designation) setDesignation(p.designation);
          }
        })
        .catch((err) => {
          console.warn('[CompleteProfile] Profile fetch error:', err);
        })
        .finally(() => {
          if (isMounted) setIsFetchingEmpId(false);
        });
    } else {
      setIsFetchingEmpId(false);
    }
    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  // Format Aadhaar with spaces: "5489 1234 5678"
  const handleAadhaarChange = (val) => {
    const raw = val.replace(/\D/g, '').slice(0, 12);
    const formatted = raw.match(/.{1,4}/g)?.join(' ') || raw;
    setAadhaarNo(formatted);
  };

  // Open calendar modal for DOB
  const openDobPicker = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (_h) { }
    const currentYear = new Date().getFullYear();
    const defaultAdultYear = currentYear - 22;
    if (dob) {
      const parts = dob.split('-').map(Number);
      if (parts.length === 3) {
        setCalYear(parts[0]);
        setCalMonth(parts[1] - 1);
      }
    } else {
      setCalYear(defaultAdultYear);
      setCalMonth(0);
    }
    setCalendarVisible(true);
  };

  const handleDobSelect = (year, month, day) => {
    const pad = (n) => String(n).padStart(2, '0');
    setDob(`${year}-${pad(month + 1)}-${pad(day)}`);
    setCalendarVisible(false);
  };

  const handleSubmit = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (_h) { }

    // Validation
    if (!firstName.trim()) {
      Alert.alert('Required Field', 'Please enter your First Name.');
      return;
    }
    if (!dob) {
      Alert.alert('Required Field', 'Please select your Date of Birth.');
      return;
    }
    // Strict 18+ Age Validation
    const dobParts = dob.split('-').map(Number);
    if (dobParts.length === 3) {
      const birthDate = new Date(dobParts[0], dobParts[1] - 1, dobParts[2]);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      if (age < 18) {
        Alert.alert('Age Requirement', 'Employees must be at least 18 years of age to register.');
        return;
      }
    }
    const cleanAadhaar = aadhaarNo.replace(/\s+/g, '');
    if (cleanAadhaar.length !== 12) {
      Alert.alert('Invalid Aadhaar', 'Please enter a valid 12-digit Aadhaar number.');
      return;
    }
    const cleanPhone = mobile.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      Alert.alert('Invalid Phone', 'Please enter a valid 10-digit mobile number.');
      return;
    }
    if (!address.trim()) {
      Alert.alert('Required Field', 'Please enter your Residential / Street Address.');
      return;
    }
    if (!city.trim()) {
      Alert.alert('Required Field', 'Please enter your Current City or Nativity.');
      return;
    }
    if (!emergencyPerson.trim()) {
      Alert.alert('Required Field', 'Please enter an Emergency Contact Person name.');
      return;
    }
    const cleanEmergPhone = emergencyNumber.replace(/\D/g, '');
    if (cleanEmergPhone.length < 10) {
      Alert.alert('Invalid Phone', 'Please enter a valid 10-digit Emergency Contact Phone number.');
      return;
    }
    if (!designation.trim()) {
      Alert.alert('Required Field', 'Please enter or select your Designation.');
      return;
    }

    setIsSubmitting(true);

    const payload = {
      userId: user?.id,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      gender,
      dob,
      aadhaarNo: cleanAadhaar,
      fatherName: fatherName.trim(),
      mobile: cleanPhone,
      officialEmail: officialEmail.trim(),
      address: address.trim(),
      city: city.trim(),
      homeState,
      bloodGroup,
      emergencyPerson: emergencyPerson.trim(),
      emergencyRelation,
      emergencyNumber: cleanEmergPhone,
      department,
      designation: designation.trim(),
    };

    console.log('[CompleteProfile] Submitting payload:', payload);

    try {
      const res = await api.saveEmployeeProfile(payload);
      console.log('[CompleteProfile] API Response:', res);

      if (res && res.success) {
        try {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (_h) { }

        Alert.alert(
          'Profile Submitted for HR Verification',
          'Your employee personal details have been submitted and forwarded to HR for verification & salary assignment. You can now access your dashboard.',
          [
            {
              text: 'Go to Dashboard',
              onPress: () => {
                if (typeof onComplete === 'function') {
                  onComplete(res.user);
                }
              },
            },
          ]
        );
      } else {
        Alert.alert(
          'Submission Failed',
          res?.error || 'Could not save employee profile. Please check your backend connection.'
        );
      }
    } catch (err) {
      console.error('[CompleteProfile] Submit Error:', err);
      Alert.alert('Network Error', err?.message || 'Failed to submit profile.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* ── Top Header ── */}
        <View style={styles.topHeaderRow}>
          <View style={styles.topHeaderLeft}>
            <View style={styles.shieldIconBox}>
              <Ionicons name="id-card-outline" size={20} color="#EA580C" />
            </View>
            <View>
              <Text style={styles.headerTitle}>Employee Profile Setup</Text>
              <Text style={styles.headerSubtitle}>Fill your employee details</Text>
            </View>
          </View>
          {onLogout && (
            <TouchableOpacity
              onPress={onLogout}
              style={styles.logoutBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              activeOpacity={0.7}
            >
              <Ionicons name="log-out-outline" size={16} color="#DC2626" />
              <Text style={styles.logoutText}>Logout</Text>
            </TouchableOpacity>
          )}
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Action Notice Card ── */}
          <View style={styles.noticeCard}>
            <View style={styles.noticeIconBox}>
              <Ionicons name="information-circle" size={20} color="#EA580C" />
            </View>
            <View style={styles.noticeContent}>
              <Text style={styles.noticeTitle}>Action Required</Text>
              <Text style={styles.noticeText}>
                Complete your employee details below to unlock your daily attendance dashboard.
              </Text>
            </View>
          </View>

          {/* ══════════════════════════════════════════════════════
              HEADER 1: PERSONAL & IDENTITY DETAILS
             ══════════════════════════════════════════════════════ */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeaderRow}>
              <View style={[styles.sectionPill, { backgroundColor: '#FFEDD5' }]}>
                <Ionicons name="person" size={13} color="#EA580C" />
              </View>
              <Text style={styles.sectionTitle}>1. Personal & Identity Details</Text>
            </View>

            {/* ── 1. EMPLOYEE ID (FIRST FIELD, STRICTLY GREYED OUT & DISABLED) ── */}
            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.inputLabel}>Employee ID </Text>
              </View>
              <View style={styles.disabledInputBox}>
                <Ionicons name="barcode-outline" size={18} color="#64748B" style={{ marginRight: 8 }} />
                {isFetchingEmpId ? (
                  <ActivityIndicator size="small" color="#EA580C" />
                ) : (
                  <TextInput
                    style={styles.disabledInputText}
                    value={empId}
                    editable={false}
                    selectTextOnFocus={false}
                  />
                )}
              </View>
              <Text style={styles.helperText}>
                Assigned permanently by the company. Cannot be modified.
              </Text>
            </View>

            {/* First Name & Last Name */}
            <View style={styles.rowTwoCols}>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.inputLabel}>First Name <Text style={styles.requiredStar}>*</Text></Text>
                <TextInput
                  style={styles.textInput}
                  value={firstName}
                  onChangeText={setFirstName}
                  placeholder="e.g. Kishore"
                  placeholderTextColor="#94A3B8"
                />
              </View>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.inputLabel}>Last Name</Text>
                <TextInput
                  style={styles.textInput}
                  value={lastName}
                  onChangeText={setLastName}
                  placeholder="e.g. Kumar"
                  placeholderTextColor="#94A3B8"
                />
              </View>
            </View>

            {/* Gender Segmented Control */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Gender <Text style={styles.requiredStar}>*</Text></Text>
              <View style={styles.segmentedRow}>
                {genderOptions.map((g) => (
                  <TouchableOpacity
                    key={g}
                    style={[
                      styles.segmentBtn,
                      gender === g && styles.segmentBtnActive,
                    ]}
                    onPress={() => {
                      try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (_h) { }
                      setGender(g);
                    }}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name={g === 'Male' ? 'male' : g === 'Female' ? 'female' : 'person'}
                      size={14}
                      color={gender === g ? '#FFFFFF' : '#64748B'}
                    />
                    <Text style={[styles.segmentBtnText, gender === g && styles.segmentBtnTextActive]}>
                      {g}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Date of Birth (Calendar Picker) */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Date of Birth <Text style={styles.requiredStar}>*</Text></Text>
              <TouchableOpacity
                style={styles.datePickerBtn}
                onPress={openDobPicker}
                activeOpacity={0.8}
              >
                <Ionicons name="calendar-outline" size={18} color="#EA580C" style={{ marginRight: 8 }} />
                <Text style={[styles.datePickerText, !dob && { color: '#94A3B8' }]}>
                  {dob || 'Select Date of Birth (YYYY-MM-DD)'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Aadhaar Number */}
            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.inputLabel}>Aadhaar Number <Text style={styles.requiredStar}>*</Text></Text>
                <Text style={styles.subLabel}>12 Digits</Text>
              </View>
              <View style={styles.iconInputBox}>
                <Ionicons name="id-card-outline" size={18} color="#64748B" style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.iconTextInput}
                  value={aadhaarNo}
                  onChangeText={handleAadhaarChange}
                  placeholder="5489 1234 5678"
                  placeholderTextColor="#94A3B8"
                  keyboardType="numeric"
                  maxLength={14} // 12 digits + 2 spaces
                />
              </View>
            </View>

            {/* Father's Name */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Father's / Guardian Name</Text>
              <TextInput
                style={styles.textInput}
                value={fatherName}
                onChangeText={setFatherName}
                placeholder="e.g. R. Periasamy"
                placeholderTextColor="#94A3B8"
              />
            </View>
          </View>

          {/* ══════════════════════════════════════════════════════
              HEADER 2: CONTACT & ADDRESS DETAILS
             ══════════════════════════════════════════════════════ */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeaderRow}>
              <View style={[styles.sectionPill, { backgroundColor: '#DBEAFE' }]}>
                <Ionicons name="call" size={13} color="#2563EB" />
              </View>
              <Text style={styles.sectionTitle}>2. Contact & Address Details</Text>
            </View>

            {/* Mobile Number */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Personal Mobile Number <Text style={styles.requiredStar}>*</Text></Text>
              <View style={styles.phoneInputRow}>
                <View style={styles.phonePrefixBox}>
                  <Text style={styles.phonePrefixText}>+91</Text>
                </View>
                <TextInput
                  style={styles.phoneTextInput}
                  value={mobile}
                  onChangeText={(val) => setMobile(val.replace(/\D/g, '').slice(0, 10))}
                  placeholder="98401 23456"
                  placeholderTextColor="#94A3B8"
                  keyboardType="phone-pad"
                  maxLength={10}
                />
              </View>
            </View>

            {/* Official / Work Email */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Official / Work Email</Text>
              <View style={styles.iconInputBox}>
                <Ionicons name="mail-outline" size={18} color="#64748B" style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.iconTextInput}
                  value={officialEmail}
                  onChangeText={setOfficialEmail}
                  placeholder="kishore@pskgroup.com"
                  placeholderTextColor="#94A3B8"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>
            </View>

            {/* Residential / Street Address (ABOVE STATE) */}
            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.inputLabel}>Residential / Street Address <Text style={styles.requiredStar}>*</Text></Text>
                <Text style={styles.subLabel}>Door No, Street, Area</Text>
              </View>
              <View style={styles.iconInputBox}>
                <Ionicons name="home-outline" size={18} color="#64748B" style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.iconTextInput}
                  value={address}
                  onChangeText={setAddress}
                  placeholder="e.g. 14/B, Gandhi Nagar, Mohanur Road"
                  placeholderTextColor="#94A3B8"
                />
              </View>
            </View>

            {/* Home State (FIRST DROPDOWN) */}
            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.inputLabel}>Home State <Text style={styles.requiredStar}>*</Text></Text>
                <Text style={styles.subLabel}>All Indian States & UTs</Text>
              </View>
              <TouchableOpacity
                style={styles.dropdownTrigger}
                onPress={() => {
                  try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (_h) { }
                  setStateModalVisible(true);
                }}
                activeOpacity={0.8}
              >
                <View style={styles.dropdownTriggerLeft}>
                  <Ionicons name="map-outline" size={18} color="#2563EB" style={{ marginRight: 10 }} />
                  <Text style={[styles.dropdownTriggerText, !homeState && styles.dropdownPlaceholderText]}>
                    {homeState || 'Select State'}
                  </Text>
                </View>
                <Ionicons name="chevron-down" size={18} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Current City / Nativity (BELOW STATE DROPDOWN) */}
            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.inputLabel}>Current City / Nativity Place <Text style={styles.requiredStar}>*</Text></Text>
                <Text style={styles.subLabel}>Based on {homeState || 'Selected State'}</Text>
              </View>
              <TouchableOpacity
                style={styles.dropdownTrigger}
                onPress={() => {
                  try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (_h) { }
                  setCityModalVisible(true);
                }}
                activeOpacity={0.8}
              >
                <View style={styles.dropdownTriggerLeft}>
                  <Ionicons name="location-outline" size={18} color="#EA580C" style={{ marginRight: 10 }} />
                  <Text style={[styles.dropdownTriggerText, !city && styles.dropdownPlaceholderText]}>
                    {city || `Select City in ${homeState || 'State'}`}
                  </Text>
                </View>
                <Ionicons name="chevron-down" size={18} color="#64748B" />
              </TouchableOpacity>
            </View>
          </View>

          {/* ══════════════════════════════════════════════════════
              HEADER 3: MEDICAL & EMERGENCY CONTACT
             ══════════════════════════════════════════════════════ */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeaderRow}>
              <View style={[styles.sectionPill, { backgroundColor: '#FEE2E2' }]}>
                <Ionicons name="heart" size={13} color="#DC2626" />
              </View>
              <Text style={styles.sectionTitle}>3. Medical & Emergency Contact</Text>
            </View>

            {/* Blood Group */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Blood Group <Text style={styles.requiredStar}>*</Text></Text>
              <View style={styles.bloodGrid}>
                {bloodGroupOptions.map((bg) => (
                  <TouchableOpacity
                    key={bg}
                    style={[styles.bloodBtn, bloodGroup === bg && styles.bloodBtnActive]}
                    onPress={() => {
                      try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (_h) { }
                      setBloodGroup(bg);
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.bloodBtnText, bloodGroup === bg && styles.bloodBtnTextActive]}>
                      {bg}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Emergency Contact Person */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Emergency Contact Person <Text style={styles.requiredStar}>*</Text></Text>
              <TextInput
                style={styles.textInput}
                value={emergencyPerson}
                onChangeText={setEmergencyPerson}
                placeholder="e.g. Ramesh Kumar"
                placeholderTextColor="#94A3B8"
              />
            </View>

            {/* Emergency Relation */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Relationship <Text style={styles.requiredStar}>*</Text></Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsScroll}>
                {relationOptions.map((rel) => (
                  <TouchableOpacity
                    key={rel}
                    style={[styles.chipBtn, emergencyRelation === rel && styles.chipBtnActive]}
                    onPress={() => {
                      try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (_h) { }
                      setEmergencyRelation(rel);
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.chipBtnText, emergencyRelation === rel && styles.chipBtnTextActive]}>
                      {rel}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Emergency Phone Number */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Emergency Contact Number <Text style={styles.requiredStar}>*</Text></Text>
              <View style={styles.phoneInputRow}>
                <View style={styles.phonePrefixBox}>
                  <Text style={styles.phonePrefixText}>+91</Text>
                </View>
                <TextInput
                  style={styles.phoneTextInput}
                  value={emergencyNumber}
                  onChangeText={(val) => setEmergencyNumber(val.replace(/\D/g, '').slice(0, 10))}
                  placeholder="98401 99999"
                  placeholderTextColor="#94A3B8"
                  keyboardType="phone-pad"
                  maxLength={10}
                />
              </View>
            </View>
          </View>

          {/* ══════════════════════════════════════════════════════
              HEADER 4: WORK & ENGINEERING DETAILS
             ══════════════════════════════════════════════════════ */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeaderRow}>
              <View style={[styles.sectionPill, { backgroundColor: '#E0E7FF' }]}>
                <Ionicons name="construct" size={13} color="#4338CA" />
              </View>
              <Text style={styles.sectionTitle}>4. Engineering Department & Role</Text>
            </View>

            {/* Department (DROPDOWN) */}
            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.inputLabel}>Department <Text style={styles.requiredStar}>*</Text></Text>
                <Text style={styles.subLabel}>Engineering & Operations</Text>
              </View>
              <TouchableOpacity
                style={styles.dropdownTrigger}
                onPress={() => {
                  try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (_h) { }
                  setDepartmentModalVisible(true);
                }}
                activeOpacity={0.8}
              >
                <View style={styles.dropdownTriggerLeft}>
                  <Ionicons name="business-outline" size={18} color="#4338CA" style={{ marginRight: 10 }} />
                  <Text style={[styles.dropdownTriggerText, !department && styles.dropdownPlaceholderText]}>
                    {department || 'Select Department'}
                  </Text>
                </View>
                <Ionicons name="chevron-down" size={18} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Designation / Role (DROPDOWN WITH SEARCH & CUSTOM) */}
            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.inputLabel}>Designation / Role <Text style={styles.requiredStar}>*</Text></Text>
                <Text style={styles.subLabel}>Technical Title</Text>
              </View>
              <TouchableOpacity
                style={styles.dropdownTrigger}
                onPress={() => {
                  try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (_h) { }
                  setDesignationModalVisible(true);
                }}
                activeOpacity={0.8}
              >
                <View style={styles.dropdownTriggerLeft}>
                  <Ionicons name="ribbon-outline" size={18} color="#059669" style={{ marginRight: 10 }} />
                  <Text style={[styles.dropdownTriggerText, !designation && styles.dropdownPlaceholderText]}>
                    {designation || 'Select or enter Designation'}
                  </Text>
                </View>
                <Ionicons name="chevron-down" size={18} color="#64748B" />
              </TouchableOpacity>
            </View>
          </View>

          {/* ── SUBMIT BUTTON ── */}
          <TouchableOpacity
            style={[styles.submitButton, isSubmitting && { opacity: 0.75 }]}
            onPress={handleSubmit}
            disabled={isSubmitting}
            activeOpacity={0.85}
          >
            {isSubmitting ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <ActivityIndicator color="#FFFFFF" size="small" />
                <Text style={styles.submitButtonText}>Saving Profile...</Text>
              </View>
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="checkmark-done-circle" size={20} color="#FFFFFF" />
                <Text style={styles.submitButtonText}>Save & Enter Dashboard</Text>
              </View>
            )}
          </TouchableOpacity>

          <Text style={styles.footerNotice}>
            By saving, you verify that the above information is accurate for PSK company employment records.
          </Text>
        </ScrollView>

        {/* Calendar Picker Modal for DOB with Year Picker & 18+ limit */}
        <CalendarPickerModal
          visible={calendarVisible}
          onClose={() => setCalendarVisible(false)}
          calendarTarget="dob"
          cMonth={calMonth}
          cYear={calYear}
          onSelectYear={(selectedYear) => setCalYear(selectedYear)}
          maxSelectableYear={new Date().getFullYear() - 18}
          minSelectableYear={1950}
          monthNames={[
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December',
          ]}
          weekDays={['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']}
          prevMonth={() => {
            if (calMonth === 0) {
              setCalMonth(11);
              setCalYear((y) => y - 1);
            } else {
              setCalMonth((m) => m - 1);
            }
          }}
          nextMonth={() => {
            const maxYear = new Date().getFullYear() - 18;
            if (calYear > maxYear || (calYear === maxYear && calMonth >= 11)) {
              return;
            }
            if (calMonth === 11) {
              setCalMonth(0);
              setCalYear((y) => y + 1);
            } else {
              setCalMonth((m) => m + 1);
            }
          }}
          isPrevMonthDisabled={calYear < 1950}
          isNextMonthDisabled={
            calYear > new Date().getFullYear() - 18 ||
            (calYear === new Date().getFullYear() - 18 && calMonth >= 11)
          }
          blanks={Array.from({ length: new Date(calYear, calMonth, 1).getDay() }, (_, i) => i)}
          monthDays={Array.from(
            { length: new Date(calYear, calMonth + 1, 0).getDate() },
            (_, i) => i + 1
          )}
          isDayDisabled={(day) => {
            const d = new Date(calYear, calMonth, day);
            const maxDate = new Date();
            maxDate.setFullYear(maxDate.getFullYear() - 18);
            return d > maxDate;
          }}
          isDaySelected={(day) => {
            if (!dob) return false;
            const parts = dob.split('-').map(Number);
            return parts[0] === calYear && parts[1] - 1 === calMonth && parts[2] === day;
          }}
          onSelectDate={(day) => handleDobSelect(calYear, calMonth, day)}
          selectToday={() => {
            const today = new Date();
            today.setFullYear(today.getFullYear() - 22);
            setCalYear(today.getFullYear());
            setCalMonth(today.getMonth());
            handleDobSelect(today.getFullYear(), today.getMonth(), today.getDate());
          }}
          isTodayDisabled={false}
        />

        {/* State Dropdown Modal */}
        <SearchableDropdownModal
          visible={stateModalVisible}
          onClose={() => setStateModalVisible(false)}
          title="Select Home State"
          items={ALL_INDIAN_STATES}
          selectedItem={homeState}
          onSelect={(st) => {
            setHomeState(st);
            setCity(''); // Reset city so user selects from the new state's cities
          }}
          placeholder="Search State or UT..."
        />

        {/* City Dropdown Modal (Filtered by State) */}
        <SearchableDropdownModal
          visible={cityModalVisible}
          onClose={() => setCityModalVisible(false)}
          title={`Select City (${homeState || 'State'})`}
          items={getCitiesForState(homeState)}
          selectedItem={city}
          onSelect={(ct) => setCity(ct)}
          placeholder={`Search city in ${homeState || 'State'}...`}
          allowCustom={true}
          customLabel="Use custom town / village"
        />

        {/* Department Dropdown Modal */}
        <SearchableDropdownModal
          visible={departmentModalVisible}
          onClose={() => setDepartmentModalVisible(false)}
          title="Select Department"
          items={departmentOptions}
          selectedItem={department}
          onSelect={(dep) => setDepartment(dep)}
          placeholder="Search department..."
        />

        {/* Designation Dropdown Modal */}
        <SearchableDropdownModal
          visible={designationModalVisible}
          onClose={() => setDesignationModalVisible(false)}
          title="Select Designation / Role"
          items={designationOptions}
          selectedItem={designation}
          onSelect={(des) => setDesignation(des)}
          placeholder="Search or enter role..."
          allowCustom={true}
          customLabel="Use custom designation"
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  topHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  topHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  shieldIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#FFEDD5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 11,
    fontWeight: '500',
    color: '#64748B',
    marginTop: 1,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  logoutText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#DC2626',
  },
  noticeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFF7ED',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FED7AA',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  noticeIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#FFEDD5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  noticeContent: {
    flex: 1,
    gap: 2,
  },
  noticeTitle: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#9A3412',
    letterSpacing: -0.2,
  },
  noticeText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#7C2D12',
    lineHeight: 15,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 14,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  sectionPill: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  inputGroup: {
    gap: 6,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  subLabel: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#64748B',
  },
  requiredStar: {
    color: '#EF4444',
  },
  helperText: {
    fontSize: 10.5,
    color: '#64748B',
    marginTop: 2,
  },
  rowTwoCols: {
    flexDirection: 'row',
    gap: 12,
  },
  textInput: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '600',
  },
  disabledInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E2E8F0', // Distinct greyed-out read-only look
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  disabledInputText: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: '800',
    color: '#1E293B',
    padding: 0,
    letterSpacing: 0.5,
  },
  lockedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  iconInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  iconTextInput: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '600',
    padding: 0,
  },
  phoneInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  phonePrefixBox: {
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  phonePrefixText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  phoneTextInput: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '600',
  },
  datePickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  datePickerText: {
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '600',
  },
  dropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  dropdownTriggerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  dropdownTriggerText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  dropdownPlaceholderText: {
    color: '#94A3B8',
    fontWeight: '500',
  },
  segmentedRow: {
    flexDirection: 'row',
    gap: 8,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  segmentBtnActive: {
    backgroundColor: '#EA580C',
    borderColor: '#EA580C',
  },
  segmentBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  segmentBtnTextActive: {
    color: '#FFFFFF',
  },
  chipsScroll: {
    gap: 8,
    paddingVertical: 2,
  },
  chipBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  chipBtnActive: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  chipBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#475569',
  },
  chipBtnTextActive: {
    color: '#FFFFFF',
  },
  bloodGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  bloodBtn: {
    width: '22%',
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bloodBtnActive: {
    backgroundColor: '#DC2626',
    borderColor: '#DC2626',
  },
  bloodBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#475569',
  },
  bloodBtnTextActive: {
    color: '#FFFFFF',
  },
  submitButton: {
    backgroundColor: '#EA580C',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#EA580C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 4,
    marginTop: 8,
  },
  submitButtonText: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  footerNotice: {
    fontSize: 11,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 16,
    paddingHorizontal: 20,
    marginTop: -4,
  },
});
