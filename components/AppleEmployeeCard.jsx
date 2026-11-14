import React, { useState, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Animated,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { THEME } from '../constants/theme';

/**
 * AppleEmployeeCard
 * Apple Card-inspired 3D Interactive Digital Workforce Badge
 *
 * Features:
 * - Welcome greeting & Employee identity with Role & EMP ID badges
 * - Real-time Location display with GPS status dot
 * - Titanium / Slate metallic finish with laser-engraved typography
 * - Physical 3D Y-axis flip between Front (Shift Pass) and Back (Office Access QR)
 * - Tactile haptics on turn
 * - Real-time shift status & standard 8H progress bar
 */
export default function AppleEmployeeCard({
  user,
  todayStatus = 'NOT IN',
  inTime = null,
  shiftStats = null,
  areaName = null,
  coords = null,
  isResolvingArea = false,
  isLateIn = false,
  totalDays = 0,
  project = null,
}) {
  const [isFlipped, setIsFlipped] = useState(false);
  const [flipAnim] = useState(() => new Animated.Value(0));

  let rawName = user?.name || user?.username || 'Employee';
  const displayName = rawName.charAt(0).toUpperCase() + rawName.slice(1);

  const empId = user?.empId || 'EMP-1002';
  const isHR = user?.role === 'hr' || user?.role === 'manager' || user?.username?.toLowerCase() === 'hr';
  const roleTitle = isHR ? 'HR' : 'Employee';
  const isOnDuty = todayStatus === 'IN';
  const isOffDuty = todayStatus === 'OUT';

  const currentProject = isHR ? null : (project || user?.project || (user?.projectName ? {
    name: user.projectName,
    code: user.projectCode,
    client: user.projectClient,
    color: user.projectColor,
    roleInProject: user.roleInProject || 'Member',
  } : (user?.name === 'Kishore' || user?.username === 'kishore' ? {
    id: 1,
    name: 'AI Attendance Suite',
    code: 'PRJ-ATTEND',
    client: 'Tech Sigaram Internal',
    color: '#EA580C',
    roleInProject: 'Lead Developer',
  } : null)));

  const formattedDate = useMemo(() => {
    return new Date().toLocaleDateString('en-GB', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
    });
  }, []);

  const locationDisplay = useMemo(() => {
    if (areaName) return areaName;
    if (coords) {
      if (typeof coords === 'string') return coords;
      if (coords.latitude && coords.longitude) {
        return `${coords.latitude}, ${coords.longitude}`;
      }
      if (coords.lat && coords.lon) {
        return `${coords.lat}, ${coords.lon}`;
      }
    }
    if (isResolvingArea) return 'Locating office & area...';
    return 'Acquiring GPS location...';
  }, [areaName, coords, isResolvingArea]);

  const handleFlip = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (_e) {
      // ignore
    }

    const nextState = !isFlipped;
    setIsFlipped(nextState);

    Animated.spring(flipAnim, {
      toValue: nextState ? 1 : 0,
      friction: 8,
      tension: 12,
      useNativeDriver: false,
    }).start();
  };

  // Interpolations for 3D flip
  const frontInterpolate = flipAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  const backInterpolate = flipAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['180deg', '360deg'],
  });

  // Shift progress calculation (0 - 100%)
  const shiftPercent = useMemo(() => {
    if (!isOnDuty || !shiftStats?.totalMinutes) return isOffDuty ? 100 : 0;
    return Math.min(100, Math.round((shiftStats.totalMinutes / 480) * 100));
  }, [isOnDuty, isOffDuty, shiftStats]);

  return (
    <View style={styles.cardWrapper}>
      <TouchableOpacity
        activeOpacity={0.96}
        onPress={handleFlip}
        style={styles.touchableContainer}
      >
        {/* ── CARD FRONT: Titanium Digital Shift Pass ── */}
        <Animated.View
          style={[
            styles.card,
            styles.cardFront,
            isOnDuty && styles.cardActiveGlow,
            {
              transform: [
                { perspective: 1200 },
                { rotateY: frontInterpolate },
              ],
            },
          ]}
        >
          {/* Top Brand Header with Date & NFC */}
          <View style={styles.cardHeaderRow}>
            <View style={styles.cardBrandGroup}>
              <View style={styles.cardLogoBox}>
                <Ionicons name="triangle" size={13} color="#EA580C" />
              </View>
              <View>
                <Text style={styles.greetingMini}>Welcome back,</Text>
                <Text style={styles.cardBrandName}>TECH SIGARAM</Text>
              </View>
            </View>

            <View style={styles.cardTopRight}>
              <View style={styles.dateBadge}>
                <Ionicons name="calendar-outline" size={11} color="#EA580C" style={{ marginRight: 4 }} />
                <Text style={styles.dateBadgeText}>{formattedDate}</Text>
              </View>
              <View style={styles.nfcBox}>
                <Ionicons
                  name="wifi-outline"
                  size={15}
                  color="rgba(255, 255, 255, 0.7)"
                  style={{ transform: [{ rotate: '90deg' }] }}
                />
              </View>
            </View>
          </View>

          {/* Smart Chip & Status Pill (Above Name) */}
          <View style={styles.chipRow}>
            {/* Metallic Smart Chip */}
            <View style={styles.smartChip}>
              <View style={styles.chipLineH} />
              <View style={styles.chipLineV} />
              <View style={styles.chipInner} />
            </View>

            {/* Live Status Pill */}
            <View
              style={[
                styles.liveStatusPill,
                isOnDuty
                  ? (isLateIn ? styles.statusPillLate : styles.statusPillActive)
                  : isOffDuty
                    ? styles.statusPillOff
                    : styles.statusPillNeutral,
              ]}
            >
              <View
                style={[
                  styles.statusDot,
                  isOnDuty
                    ? (isLateIn ? styles.statusDotLate : styles.statusDotActive)
                    : isOffDuty
                      ? styles.statusDotOff
                      : styles.statusDotNeutral,
                ]}
              />
              <Text
                style={[
                  styles.statusText,
                  isOnDuty
                    ? (isLateIn ? styles.statusTextLate : styles.statusTextActive)
                    : isOffDuty
                      ? styles.statusTextOff
                      : styles.statusTextNeutral,
                ]}
              >
                {isOnDuty
                  ? (isLateIn ? 'ON DUTY • LATE' : 'ON DUTY • ON-TIME')
                  : isOffDuty
                    ? 'SHIFT COMPLETED'
                    : 'OFF DUTY'}
              </Text>
            </View>
          </View>

          {/* Employee Identity & Badges */}
          <View style={styles.identitySection}>
            <View style={styles.userNameRow}>
              <Text style={styles.employeeName} numberOfLines={1}>
                {displayName}
              </Text>
              <View style={styles.empBadgePill}>
                <Text style={styles.empBadgeText}>{empId}</Text>
              </View>
              <View style={[styles.roleBadgePill, isHR && styles.roleBadgeHR]}>
                <Text style={[styles.roleBadgeText, isHR && styles.roleBadgeTextHR]}>
                  {roleTitle}
                </Text>
              </View>
            </View>

            {/* Current Project Assigned (Employees Only - HR oversees all projects) */}
            {!isHR && (
              <View style={styles.cardProjectContainer}>
                {currentProject ? (
                  <View
                    style={[
                      styles.cardProjectPill,
                      {
                        borderColor: (currentProject.color || '#38BDF8') + '55',
                        backgroundColor: (currentProject.color || '#38BDF8') + '18',
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.cardProjectDot,
                        { backgroundColor: currentProject.color || '#38BDF8' },
                      ]}
                    />
                    <View style={styles.cardProjectCodeBadge}>
                      <Text
                        style={[
                          styles.cardProjectCodeText,
                          { color: currentProject.color || '#38BDF8' },
                        ]}
                      >
                        {currentProject.code || 'PROJECT'}
                      </Text>
                    </View>
                    <Text style={styles.cardProjectNameText} numberOfLines={1}>
                      {currentProject.name}
                    </Text>
                    {currentProject.roleInProject ? (
                      <View style={styles.cardProjectRoleBadge}>
                        <Text style={styles.cardProjectRoleText}>
                          {currentProject.roleInProject}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                ) : (
                  <View style={styles.cardUnassignedPill}>
                    <Ionicons name="briefcase-outline" size={11} color="#F59E0B" />
                    <Text style={styles.cardUnassignedText}>
                      Bench • No Project Assigned
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* Live GPS Location inside Card */}
            <View style={styles.cardLocationRow}>
              <Ionicons name="location" size={12} color="#EA580C" />
              <Text style={styles.cardLocationText} numberOfLines={1}>
                {locationDisplay}
              </Text>
              {coords ? <View style={styles.cardLocationDot} /> : null}
            </View>
          </View>

          {/* Bottom Shift Metrics */}
          <View style={styles.cardFooter}>
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>CLOCK IN</Text>
              <Text style={styles.metricValue}>{inTime || '--:--'}</Text>
            </View>

            <View style={styles.metricDivider} />

            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>DURATION</Text>
              <Text style={styles.metricValue}>
                {shiftStats?.formattedDuration || '0h 00m'}
              </Text>
            </View>

            <View style={styles.metricDivider} />

            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>RECORDED</Text>
              <Text style={styles.metricValue}>{totalDays} Days</Text>
            </View>
          </View>

          {/* 8H Shift Progress Bar */}
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${Math.max(4, shiftPercent)}%`,
                  backgroundColor: isLateIn ? '#F59E0B' : '#10B981',
                },
              ]}
            />
          </View>

          {/* Flip Hint */}
          <View style={styles.flipHintRow}>
            <Ionicons name="refresh-outline" size={10} color="rgba(255, 255, 255, 0.45)" />
            <Text style={styles.flipHintText}>Tap card to flip • Office Access Pass</Text>
          </View>
        </Animated.View>

        {/* ── CARD BACK: Office Access QR & Credentials ── */}
        <Animated.View
          style={[
            styles.card,
            styles.cardBack,
            {
              transform: [
                { perspective: 1200 },
                { rotateY: backInterpolate },
              ],
            },
          ]}
        >
          {/* Back Top Header */}
          <View style={styles.cardHeaderRow}>
            <View style={styles.cardBrandGroup}>
              <Ionicons name="shield-checkmark" size={16} color="#10B981" />
              <Text style={styles.backTitle}>VERIFIED EMPLOYEE BADGE</Text>
            </View>
            <View style={styles.flipPill}>
              <Ionicons name="sync" size={11} color="#FFFFFF" />
              <Text style={styles.flipPillText}>Flip</Text>
            </View>
          </View>

          {/* Mid Section: Simulated QR Code & Office Info */}
          <View style={styles.qrSectionRow}>
            {/* Visual Access QR Box */}
            <View style={styles.qrContainer}>
              <View style={styles.qrCornerTL} />
              <View style={styles.qrCornerTR} />
              <View style={styles.qrCornerBL} />
              <View style={styles.qrCornerBR} />

              {/* Procedural QR Pattern */}
              <View style={styles.qrGrid}>
                <View style={styles.qrRow}>
                  <View style={styles.qrBlockDark} />
                  <View style={styles.qrBlockDark} />
                  <View style={styles.qrBlockLight} />
                  <View style={styles.qrBlockDark} />
                  <View style={styles.qrBlockDark} />
                </View>
                <View style={styles.qrRow}>
                  <View style={styles.qrBlockDark} />
                  <View style={styles.qrBlockLight} />
                  <View style={styles.qrBlockDark} />
                  <View style={styles.qrBlockLight} />
                  <View style={styles.qrBlockDark} />
                </View>
                <View style={styles.qrRow}>
                  <View style={styles.qrBlockLight} />
                  <View style={styles.qrBlockDark} />
                  <View style={styles.qrBlockDark} />
                  <View style={styles.qrBlockDark} />
                  <View style={styles.qrBlockLight} />
                </View>
                <View style={styles.qrRow}>
                  <View style={styles.qrBlockDark} />
                  <View style={styles.qrBlockDark} />
                  <View style={styles.qrBlockLight} />
                  <View style={styles.qrBlockDark} />
                  <View style={styles.qrBlockDark} />
                </View>
              </View>
              <Text style={styles.qrScanLabel}>SCAN PASS</Text>
            </View>

            {/* Employment Credential Specs */}
            <View style={styles.specsColumn}>
              <View style={styles.specRow}>
                <Text style={styles.specLabel}>ROLE</Text>
                <Text style={[styles.specValue, isHR && { color: '#60A5FA' }]}>{roleTitle}</Text>
              </View>
              {isHR ? (
                <>
                  <View style={styles.specRow}>
                    <Text style={styles.specLabel}>SCOPE</Text>
                    <Text style={[styles.specValue, { color: '#60A5FA' }]}>Workforce Admin</Text>
                  </View>
                  <View style={styles.specRow}>
                    <Text style={styles.specLabel}>LEVEL</Text>
                    <Text style={styles.specValue}>Executive</Text>
                  </View>
                </>
              ) : (
                <>
                  <View style={styles.specRow}>
                    <Text style={styles.specLabel}>PROJECT</Text>
                    <Text style={[styles.specValue, { color: currentProject?.color || '#38BDF8' }]} numberOfLines={1}>
                      {currentProject ? `${currentProject.name} (${currentProject.code || 'PRJ'})` : 'Bench / Unassigned'}
                    </Text>
                  </View>
                  <View style={styles.specRow}>
                    <Text style={styles.specLabel}>CLIENT</Text>
                    <Text style={styles.specValue} numberOfLines={1}>
                      {currentProject?.client || 'Tech Sigaram'}
                    </Text>
                  </View>
                  <View style={styles.specRow}>
                    <Text style={styles.specLabel}>PRJ ROLE</Text>
                    <Text style={[styles.specValue, { color: '#F8FAFC', fontWeight: '700' }]} numberOfLines={1}>
                      {currentProject?.roleInProject || 'Member'}
                    </Text>
                  </View>
                </>
              )}
              <View style={styles.specRow}>
                <Text style={styles.specLabel}>ACCESS</Text>
                <Text style={[styles.specValue, { color: '#10B981' }]}>Tier-1 Verified</Text>
              </View>
            </View>
          </View>

          {/* Barcode Strip */}
          <View style={styles.barcodeSection}>
            <View style={styles.barcodeLines}>
              <View style={[styles.bLine, { width: 3 }]} />
              <View style={[styles.bLine, { width: 1 }]} />
              <View style={[styles.bLine, { width: 4 }]} />
              <View style={[styles.bLine, { width: 2 }]} />
              <View style={[styles.bLine, { width: 1 }]} />
              <View style={[styles.bLine, { width: 5 }]} />
              <View style={[styles.bLine, { width: 2 }]} />
              <View style={[styles.bLine, { width: 1 }]} />
              <View style={[styles.bLine, { width: 3 }]} />
              <View style={[styles.bLine, { width: 4 }]} />
              <View style={[styles.bLine, { width: 1 }]} />
              <View style={[styles.bLine, { width: 2 }]} />
              <View style={[styles.bLine, { width: 5 }]} />
              <View style={[styles.bLine, { width: 2 }]} />
              <View style={[styles.bLine, { width: 1 }]} />
              <View style={[styles.bLine, { width: 4 }]} />
              <View style={[styles.bLine, { width: 2 }]} />
              <View style={[styles.bLine, { width: 3 }]} />
            </View>
            <Text style={styles.barcodeText}>
              TS-PASS-{empId.replace('-', '')}-SECURE
            </Text>
          </View>

          {/* Security Disclaimer */}
          <View style={styles.backFooterRow}>
            <Ionicons name="lock-closed" size={10} color="rgba(255, 255, 255, 0.4)" />
            <Text style={styles.securityText}>
              256-Bit Encrypted • Property of Tech Sigaram
            </Text>
          </View>
        </Animated.View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  cardWrapper: {
    marginBottom: 16,
    alignItems: 'center',
    width: '100%',
  },
  touchableContainer: {
    width: '100%',
    height: 254,
    position: 'relative',
  },
  card: {
    width: '100%',
    height: 254,
    borderRadius: 20,
    padding: 14,
    justifyContent: 'space-between',
    backgroundColor: '#0F172A', // Slate 900 Titanium Core
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    backfaceVisibility: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.35,
        shadowRadius: 14,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  cardFront: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  cardBack: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#0B1120',
    borderColor: 'rgba(234, 88, 12, 0.25)',
  },
  cardActiveGlow: {
    borderColor: 'rgba(16, 185, 129, 0.45)',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardBrandGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardLogoBox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: 'rgba(234, 88, 12, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(234, 88, 12, 0.4)',
  },
  greetingMini: {
    fontSize: 9,
    fontWeight: '600',
    color: '#94A3B8',
  },
  cardBrandName: {
    fontSize: 12,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  cardTopRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  dateBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  nfcBox: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  identitySection: {
    marginTop: 0,
    gap: 3,
  },
  userNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  employeeName: {
    fontSize: 18,
    fontWeight: '900',
    color: '#F8FAFC',
    letterSpacing: 0.3,
  },
  empBadgePill: {
    backgroundColor: 'rgba(234, 88, 12, 0.18)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(234, 88, 12, 0.45)',
  },
  empBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#FB923C',
  },
  roleBadgePill: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  roleBadgeHR: {
    backgroundColor: 'rgba(59, 130, 246, 0.18)',
    borderColor: 'rgba(59, 130, 246, 0.45)',
  },
  roleBadgeText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#CBD5E1',
  },
  roleBadgeTextHR: {
    color: '#60A5FA',
  },
  cardProjectContainer: {
    marginTop: 4,
    marginBottom: 2,
    alignSelf: 'flex-start',
    maxWidth: '100%',
  },
  cardProjectPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 8,
    borderWidth: 1,
    maxWidth: '100%',
    flexShrink: 1,
  },
  cardProjectDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  cardProjectCodeBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  cardProjectCodeText: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  cardProjectNameText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#F8FAFC',
    flexShrink: 1,
  },
  cardProjectRoleBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    marginLeft: 2,
  },
  cardProjectRoleText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#CBD5E1',
    textTransform: 'uppercase',
  },
  cardUnassignedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  cardUnassignedText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#FBBF24',
  },
  cardLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 1,
  },
  cardLocationText: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
    maxWidth: '85%',
  },
  cardLocationDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#10B981',
    marginLeft: 3,
  },
  chipRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 4,
  },
  smartChip: {
    width: 36,
    height: 26,
    borderRadius: 6,
    backgroundColor: '#D4AF37', // Gold metallic circuit chip
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#B89726',
    justifyContent: 'center',
    alignItems: 'center',
  },
  chipLineH: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: '#997B1A',
  },
  chipLineV: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: '#997B1A',
  },
  chipInner: {
    width: 14,
    height: 10,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: '#8A6E16',
    backgroundColor: '#DFBE4E',
  },
  liveStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 9,
    paddingVertical: 3.5,
    borderRadius: THEME.radii.full,
    borderWidth: 1,
  },
  statusPillActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  statusPillLate: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderColor: 'rgba(245, 158, 11, 0.4)',
  },
  statusPillOff: {
    backgroundColor: 'rgba(148, 163, 184, 0.12)',
    borderColor: 'rgba(148, 163, 184, 0.3)',
  },
  statusPillNeutral: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusDotActive: {
    backgroundColor: '#10B981',
  },
  statusDotLate: {
    backgroundColor: '#F59E0B',
  },
  statusDotOff: {
    backgroundColor: '#94A3B8',
  },
  statusDotNeutral: {
    backgroundColor: '#64748B',
  },
  statusText: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  statusTextActive: {
    color: '#34D399',
  },
  statusTextLate: {
    color: '#FBBF24',
  },
  statusTextOff: {
    color: '#CBD5E1',
  },
  statusTextNeutral: {
    color: '#94A3B8',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  metricItem: {
    flex: 1,
  },
  metricLabel: {
    fontSize: 8,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.45)',
    letterSpacing: 0.5,
  },
  metricValue: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 1,
  },
  metricDivider: {
    width: 1,
    height: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginHorizontal: 6,
  },
  progressTrack: {
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: 5,
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  flipHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 3,
  },
  flipHintText: {
    fontSize: 8.5,
    color: 'rgba(255, 255, 255, 0.45)',
    fontWeight: '600',
  },

  // Back Styles
  backTitle: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#F8FAFC',
    letterSpacing: 0.8,
  },
  flipPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  flipPillText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  qrSectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginVertical: 4,
  },
  qrContainer: {
    width: 82,
    height: 82,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    padding: 6,
  },
  qrCornerTL: {
    position: 'absolute',
    top: 6,
    left: 6,
    width: 16,
    height: 16,
    borderWidth: 3,
    borderColor: '#0F172A',
  },
  qrCornerTR: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 16,
    height: 16,
    borderWidth: 3,
    borderColor: '#0F172A',
  },
  qrCornerBL: {
    position: 'absolute',
    bottom: 18,
    left: 6,
    width: 16,
    height: 16,
    borderWidth: 3,
    borderColor: '#0F172A',
  },
  qrCornerBR: {
    position: 'absolute',
    bottom: 18,
    right: 6,
    width: 16,
    height: 16,
    borderWidth: 3,
    borderColor: '#0F172A',
  },
  qrGrid: {
    width: 44,
    height: 44,
    justifyContent: 'space-between',
  },
  qrRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  qrBlockDark: {
    width: 7,
    height: 7,
    backgroundColor: '#0F172A',
    borderRadius: 1,
  },
  qrBlockLight: {
    width: 7,
    height: 7,
    backgroundColor: '#E2E8F0',
    borderRadius: 1,
  },
  qrScanLabel: {
    fontSize: 7.5,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: 0.8,
    marginTop: 2,
  },
  specsColumn: {
    flex: 1,
    gap: 4,
  },
  specRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  specLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.45)',
    letterSpacing: 0.5,
  },
  specValue: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  barcodeSection: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  barcodeLines: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    height: 22,
  },
  bLine: {
    height: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderRadius: 0.5,
  },
  barcodeText: {
    fontSize: 8.5,
    fontWeight: '800',
    color: 'rgba(255, 255, 255, 0.6)',
    letterSpacing: 1.5,
    marginTop: 3,
  },
  backFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  securityText: {
    fontSize: 8.5,
    color: 'rgba(255, 255, 255, 0.4)',
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
