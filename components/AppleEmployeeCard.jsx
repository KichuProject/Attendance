import React, { useState, useMemo, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Animated,
  Platform,
  Easing,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { THEME } from '../constants/theme';

/**
 * AppleEmployeeCard
 * Premium Apple Titanium White 3D Interactive Digital Workforce Pass
 *
 * Features:
 * - Pearl-white multi-stop LinearGradient metallic finish with subtle specular sheen
 * - Top signature status accent ribbon (Flame Orange / Active Emerald)
 * - Brushed-gold metallic EMV smart chip + contactless NFC badge
 * - Live pulsing duty badge, assigned project pill & GPS locality
 * - Frosted metric dock with tabular numerals & gradient 8H shift progress bar
 * - Smooth 3D Y-axis flip to Verified Office Access QR & Barcode Pass
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
  const [sheenAnim] = useState(() => new Animated.Value(0));
  const [pulseAnim] = useState(() => new Animated.Value(0.4));

  let rawName = user?.name || user?.username || 'Employee';
  const displayName = rawName.charAt(0).toUpperCase() + rawName.slice(1);

  const empId = user?.empId || 'EMP-1002';
  const isHR =
    user?.role === 'hr' ||
    user?.role === 'manager' ||
    user?.username?.toLowerCase() === 'hr';
  const roleTitle = isHR ? 'HR' : 'Employee';
  const isOnDuty = todayStatus === 'IN';
  const isOffDuty = todayStatus === 'OUT';

  const currentProject = isHR
    ? null
    : project ||
      user?.project ||
      (user?.projectName
        ? {
            name: user.projectName,
            code: user.projectCode,
            client: user.projectClient,
            color: user.projectColor,
            roleInProject: user.roleInProject || 'Member',
          }
        : user?.name === 'Kishore' || user?.username === 'kishore'
          ? {
              id: 1,
              name: 'AI Attendance Suite',
              code: 'PRJ-ATTEND',
              client: 'Tech Sigaram Internal',
              color: '#EA580C',
              roleInProject: 'Lead Developer',
            }
          : null);

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

  // Subtle periodic metallic pearl sheen sweep across the card
  useEffect(() => {
    const sheenLoop = Animated.loop(
      Animated.sequence([
        Animated.delay(3200),
        Animated.timing(sheenAnim, {
          toValue: 1,
          duration: 1300,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(sheenAnim, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    );
    sheenLoop.start();
    return () => sheenLoop.stop();
  }, [sheenAnim]);

  // Gentle live-status halo pulse when ON DUTY
  useEffect(() => {
    if (!isOnDuty) return;
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1100,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.35,
          duration: 1100,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    pulseLoop.start();
    return () => pulseLoop.stop();
  }, [isOnDuty, pulseAnim]);

  const handleFlip = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (_e) {
      // ignore
    }

    const nextState = !isFlipped;
    setIsFlipped(nextState);

    flipAnim.stopAnimation();
    Animated.spring(flipAnim, {
      toValue: nextState ? 1 : 0,
      stiffness: 180,
      damping: 20,
      mass: 0.9,
      useNativeDriver: true,
    }).start();
  };

  const frontInterpolate = flipAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  const backInterpolate = flipAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['180deg', '360deg'],
  });

  // Crisp 90-degree midpoint opacity swap prevents Android backfaceVisibility glitch & overdraw
  const frontOpacity = flipAnim.interpolate({
    inputRange: [0, 0.499, 0.5, 1],
    outputRange: [1, 1, 0, 0],
  });

  const backOpacity = flipAnim.interpolate({
    inputRange: [0, 0.499, 0.5, 1],
    outputRange: [0, 0, 1, 1],
  });

  const sheenTranslateX = sheenAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-220, 440],
  });

  const shiftPercent = useMemo(() => {
    if (!isOnDuty || !shiftStats?.totalMinutes) return isOffDuty ? 100 : 0;
    return Math.min(100, Math.round((shiftStats.totalMinutes / 480) * 100));
  }, [isOnDuty, isOffDuty, shiftStats]);

  const topAccentColors = isOnDuty
    ? isLateIn
      ? ['#D97706', '#F59E0B', '#FCD34D']
      : ['#059669', '#10B981', '#6EE7B7']
    : ['#EA580C', '#F97316', '#FDBA74'];

  const progressGradientColors = isLateIn
    ? ['#D97706', '#F59E0B']
    : isOnDuty || isOffDuty
      ? ['#059669', '#10B981']
      : ['#EA580C', '#FB923C'];

  const projectAccent = currentProject?.color || '#EA580C';

  return (
    <View style={styles.cardWrapper}>
      <TouchableOpacity
        activeOpacity={0.97}
        onPress={handleFlip}
        style={styles.touchableContainer}
      >
        {/* ── CARD FRONT: Pearl Titanium White Digital Pass ── */}
        <Animated.View
          renderToHardwareTextureAndroid={true}
          shouldRasterizeIOS={true}
          pointerEvents={isFlipped ? 'none' : 'auto'}
          style={[
            styles.cardOuter,
            styles.cardFront,
            isOnDuty && styles.cardActiveShadow,
            {
              opacity: frontOpacity,
              transform: [{ perspective: 1200 }, { rotateY: frontInterpolate }],
            },
          ]}
        >
          <LinearGradient
            colors={['#FFFFFF', '#FAFBFC', '#FFF9F5']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.cardInnerGradient}
          >
            {/* Signature Top Accent Ribbon */}
            <LinearGradient
              colors={topAccentColors}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.topAccentRibbon}
            />

            {/* Subtle Diagonal Metallic Sheen */}
            <Animated.View
              pointerEvents="none"
              style={[
                styles.sheenStrip,
                {
                  transform: [
                    { translateX: sheenTranslateX },
                    { rotate: '22deg' },
                  ],
                },
              ]}
            />

            <View style={styles.cardBody}>
              {/* Top Brand Header with Date & NFC */}
              <View style={styles.cardHeaderRow}>
                <View style={styles.cardBrandGroup}>
                  <LinearGradient
                    colors={['#EA580C', '#F97316']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.cardLogoBox}
                  >
                    <Ionicons name="triangle" size={11} color="#FFFFFF" />
                  </LinearGradient>
                  <View>
                    <Text style={styles.greetingMini}>Welcome back</Text>
                    <View style={styles.brandWordmarkRow}>
                      <Text style={styles.cardBrandTech}>TECH </Text>
                      <Text style={styles.cardBrandSigaram}>SIGARAM</Text>
                    </View>
                  </View>
                </View>

                <View style={styles.cardTopRight}>
                  <View style={styles.dateBadge}>
                    <Ionicons
                      name="calendar-outline"
                      size={11}
                      color="#EA580C"
                      style={{ marginRight: 4 }}
                    />
                    <Text style={styles.dateBadgeText}>{formattedDate}</Text>
                  </View>
                  <View style={styles.nfcBox}>
                    <Ionicons
                      name="wifi-outline"
                      size={14}
                      color="#64748B"
                      style={{ transform: [{ rotate: '90deg' }] }}
                    />
                  </View>
                </View>
              </View>

              {/* Brushed Gold EMV Chip + Live Duty Pill */}
              <View style={styles.chipRow}>
                <LinearGradient
                  colors={['#F5DF96', '#DFB647', '#C59627']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.smartChip}
                >
                  <View style={styles.chipLineH1} />
                  <View style={styles.chipLineH2} />
                  <View style={styles.chipLineV1} />
                  <View style={styles.chipLineV2} />
                  <View style={styles.chipInner} />
                </LinearGradient>

                <View
                  style={[
                    styles.liveStatusPill,
                    isOnDuty
                      ? isLateIn
                        ? styles.statusPillLate
                        : styles.statusPillActive
                      : isOffDuty
                        ? styles.statusPillOff
                        : styles.statusPillNeutral,
                  ]}
                >
                  <View style={styles.statusDotWrap}>
                    {isOnDuty && (
                      <Animated.View
                        style={[
                          styles.statusDotHalo,
                          {
                            opacity: pulseAnim,
                            backgroundColor: isLateIn ? '#F59E0B' : '#10B981',
                          },
                        ]}
                      />
                    )}
                    <View
                      style={[
                        styles.statusDot,
                        isOnDuty
                          ? isLateIn
                            ? styles.statusDotLate
                            : styles.statusDotActive
                          : isOffDuty
                            ? styles.statusDotOff
                            : styles.statusDotNeutral,
                      ]}
                    />
                  </View>
                  <Text
                    style={[
                      styles.statusText,
                      isOnDuty
                        ? isLateIn
                          ? styles.statusTextLate
                          : styles.statusTextActive
                        : isOffDuty
                          ? styles.statusTextOff
                          : styles.statusTextNeutral,
                    ]}
                  >
                    {isOnDuty
                      ? isLateIn
                        ? 'ON DUTY • LATE'
                        : 'ON DUTY • LIVE'
                      : isOffDuty
                        ? 'SHIFT COMPLETED'
                        : 'OFF DUTY'}
                  </Text>
                </View>
              </View>

              {/* Hero Employee Identity & Badges */}
              <View style={styles.identitySection}>
                <View style={styles.userNameRow}>
                  <Text style={styles.employeeName} numberOfLines={1}>
                    {displayName}
                  </Text>
                  <View style={styles.identityBadgesGroup}>
                    <View style={styles.empBadgePill}>
                      <Text style={styles.empBadgeText}>{empId}</Text>
                    </View>
                    <View style={[styles.roleBadgePill, isHR && styles.roleBadgeHR]}>
                      <Text style={[styles.roleBadgeText, isHR && styles.roleBadgeTextHR]}>
                        {roleTitle}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Assigned Project Pill (Employees) */}
                {!isHR && (
                  <View style={styles.cardProjectContainer}>
                    {currentProject ? (
                      <View
                        style={[
                          styles.cardProjectPill,
                          {
                            borderColor: projectAccent + '38',
                            backgroundColor: projectAccent + '0F',
                          },
                        ]}
                      >
                        <View style={styles.cardProjectLeft}>
                          <View
                            style={[
                              styles.cardProjectDot,
                              { backgroundColor: projectAccent },
                            ]}
                          />
                          <View style={styles.cardProjectCodeBadge}>
                            <Text
                              style={[
                                styles.cardProjectCodeText,
                                { color: projectAccent },
                              ]}
                            >
                              {currentProject.code || 'PROJECT'}
                            </Text>
                          </View>
                          <Text style={styles.cardProjectNameText} numberOfLines={1}>
                            {currentProject.name}
                          </Text>
                        </View>
                        {currentProject.roleInProject ? (
                          <View style={styles.cardProjectRoleBadge}>
                            <Text style={styles.cardProjectRoleText} numberOfLines={1}>
                              {currentProject.roleInProject}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    ) : (
                      <View style={styles.cardUnassignedPill}>
                        <Ionicons name="briefcase-outline" size={11} color="#D97706" />
                        <Text style={styles.cardUnassignedText}>
                          Bench • No Project Assigned
                        </Text>
                      </View>
                    )}
                  </View>
                )}

                {/* Live GPS Locality */}
                <View style={styles.cardLocationRow}>
                  <Ionicons name="location" size={12} color="#EA580C" />
                  <Text style={styles.cardLocationText} numberOfLines={1}>
                    {locationDisplay}
                  </Text>
                  {coords ? <View style={styles.cardLocationDot} /> : null}
                </View>
              </View>

              {/* Frosted Shift Metrics Dock */}
              <View style={styles.metricsDock}>
                <View style={styles.cardFooter}>
                  <View style={styles.metricItem}>
                    <Text style={styles.metricLabel}>CLOCK IN</Text>
                    <Text style={styles.metricValue}>{inTime || '--:--'}</Text>
                  </View>

                  <View style={styles.metricDivider} />

                  <View style={styles.metricItem}>
                    <Text style={styles.metricLabel}>DURATION</Text>
                    <Text style={[styles.metricValue, isOnDuty && styles.metricValueActive]}>
                      {shiftStats?.formattedDuration || '0h 00m'}
                    </Text>
                  </View>

                  <View style={styles.metricDivider} />

                  <View style={styles.metricItem}>
                    <Text style={styles.metricLabel}>RECORDED</Text>
                    <Text style={styles.metricValue}>{totalDays} Days</Text>
                  </View>
                </View>

                {/* Sleek Gradient 8H Progress Bar */}
                <View style={styles.progressTrack}>
                  <LinearGradient
                    colors={progressGradientColors}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[
                      styles.progressFill,
                      { width: `${Math.max(4, shiftPercent)}%` },
                    ]}
                  />
                </View>
              </View>

              {/* Subtle Flip Cue */}
              <View style={styles.flipHintRow}>
                <Ionicons name="sync-outline" size={10} color="#94A3B8" />
                <Text style={styles.flipHintText}>Tap card to flip • Office Access Pass</Text>
              </View>
            </View>
          </LinearGradient>
        </Animated.View>

        {/* ── CARD BACK: Executive White Access Pass ── */}
        <Animated.View
          renderToHardwareTextureAndroid={true}
          shouldRasterizeIOS={true}
          pointerEvents={isFlipped ? 'auto' : 'none'}
          style={[
            styles.cardOuter,
            styles.cardBackOuter,
            {
              opacity: backOpacity,
              transform: [{ perspective: 1200 }, { rotateY: backInterpolate }],
            },
          ]}
        >
          <LinearGradient
            colors={['#FFFFFF', '#F8FAFC', '#F1F5F9']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.cardInnerGradient}
          >
            {/* Top Emerald Security Ribbon */}
            <LinearGradient
              colors={['#059669', '#10B981', '#34D399']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.topAccentRibbon}
            />

            <View style={styles.cardBody}>
              {/* Back Top Header */}
              <View style={styles.cardHeaderRow}>
                <View style={styles.cardBrandGroup}>
                  <View style={styles.verifiedShieldBox}>
                    <Ionicons name="shield-checkmark" size={14} color="#059669" />
                  </View>
                  <View>
                    <Text style={styles.backTitle}>VERIFIED EMPLOYEE PASS</Text>
                    <Text style={styles.backSubTitle}>{displayName} • {empId}</Text>
                  </View>
                </View>
                <View style={styles.flipPill}>
                  <Ionicons name="sync" size={11} color="#475569" />
                  <Text style={styles.flipPillText}>Front</Text>
                </View>
              </View>

              {/* Mid Section: Access QR & Credential Specs */}
              <View style={styles.qrSectionRow}>
                <View style={styles.qrContainer}>
                  <View style={styles.qrCornerTL} />
                  <View style={styles.qrCornerTR} />
                  <View style={styles.qrCornerBL} />
                  <View style={styles.qrCornerBR} />

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
                      <View style={styles.qrBlockAccent} />
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

                <View style={styles.specsColumn}>
                  <View style={styles.specRow}>
                    <Text style={styles.specLabel}>ROLE</Text>
                    <Text style={[styles.specValue, isHR && { color: '#2563EB' }]}>
                      {roleTitle}
                    </Text>
                  </View>
                  {isHR ? (
                    <>
                      <View style={styles.specRow}>
                        <Text style={styles.specLabel}>SCOPE</Text>
                        <Text style={[styles.specValue, { color: '#2563EB' }]}>
                          Workforce Admin
                        </Text>
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
                        <Text
                          style={[styles.specValue, { color: projectAccent }]}
                          numberOfLines={1}
                        >
                          {currentProject
                            ? `${currentProject.name}`
                            : 'Bench / Unassigned'}
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
                        <Text style={styles.specValue} numberOfLines={1}>
                          {currentProject?.roleInProject || 'Member'}
                        </Text>
                      </View>
                    </>
                  )}
                  <View style={[styles.specRow, styles.specRowLast]}>
                    <Text style={styles.specLabel}>ACCESS</Text>
                    <Text style={[styles.specValue, { color: '#059669' }]}>
                      Tier-1 Verified
                    </Text>
                  </View>
                </View>
              </View>

              {/* High-Contrast Barcode Strip */}
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

              {/* Security Footer */}
              <View style={styles.backFooterRow}>
                <Ionicons name="lock-closed" size={10} color="#94A3B8" />
                <Text style={styles.securityText}>
                  256-Bit Encrypted • Property of Tech Sigaram
                </Text>
              </View>
            </View>
          </LinearGradient>
        </Animated.View>
      </TouchableOpacity>
    </View>
  );
}

const CARD_HEIGHT = 286;

const styles = StyleSheet.create({
  cardWrapper: {
    marginBottom: 16,
    alignItems: 'center',
    width: '100%',
  },
  touchableContainer: {
    width: '100%',
    height: CARD_HEIGHT,
    position: 'relative',
  },
  cardOuter: {
    width: '100%',
    height: CARD_HEIGHT,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.08)',
    backfaceVisibility: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  cardActiveShadow: {
    borderColor: 'rgba(5, 150, 105, 0.28)',
    ...Platform.select({
      ios: {
        shadowColor: '#059669',
        shadowOpacity: 0.14,
      },
      android: {
        elevation: 7,
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
  cardBackOuter: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderColor: 'rgba(5, 150, 105, 0.22)',
  },
  cardInnerGradient: {
    flex: 1,
    borderRadius: 21,
    overflow: 'hidden',
    position: 'relative',
  },
  topAccentRibbon: {
    height: 3.5,
    width: '100%',
  },
  sheenStrip: {
    position: 'absolute',
    top: -60,
    bottom: -60,
    width: 58,
    backgroundColor: 'rgba(255, 255, 255, 0.55)',
  },
  cardBody: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 13,
    paddingBottom: 12,
    justifyContent: 'space-between',
  },

  // Header
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardBrandGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  cardLogoBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#EA580C',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.28,
        shadowRadius: 6,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  greetingMini: {
    fontSize: 9.5,
    fontWeight: '600',
    color: '#64748B',
    letterSpacing: 0.1,
  },
  brandWordmarkRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardBrandTech: {
    fontSize: 12,
    fontWeight: '900',
    color: '#EA580C',
    letterSpacing: 0.9,
  },
  cardBrandSigaram: {
    fontSize: 12,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: 0.9,
  },
  cardTopRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 28,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 9,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  dateBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#334155',
  },
  nfcBox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },

  // Chip & Status Row
  chipRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
  },
  smartChip: {
    width: 38,
    height: 27,
    borderRadius: 6.5,
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#C59A2C',
    justifyContent: 'center',
    alignItems: 'center',
  },
  chipLineH1: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 8.5,
    height: 0.9,
    backgroundColor: 'rgba(120, 86, 12, 0.45)',
  },
  chipLineH2: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 8.5,
    height: 0.9,
    backgroundColor: 'rgba(120, 86, 12, 0.45)',
  },
  chipLineV1: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 11.5,
    width: 0.9,
    backgroundColor: 'rgba(120, 86, 12, 0.45)',
  },
  chipLineV2: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 11.5,
    width: 0.9,
    backgroundColor: 'rgba(120, 86, 12, 0.45)',
  },
  chipInner: {
    width: 14,
    height: 10,
    borderRadius: 2.5,
    borderWidth: 0.9,
    borderColor: 'rgba(120, 86, 12, 0.55)',
    backgroundColor: '#F6E299',
  },
  liveStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4.5,
    borderRadius: THEME.radii.pill,
    borderWidth: 1,
  },
  statusPillActive: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  statusPillLate: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  statusPillOff: {
    backgroundColor: '#FFF7ED',
    borderColor: '#FED7AA',
  },
  statusPillNeutral: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
  },
  statusDotWrap: {
    width: 10,
    height: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusDotHalo: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusDotActive: {
    backgroundColor: '#059669',
  },
  statusDotLate: {
    backgroundColor: '#D97706',
  },
  statusDotOff: {
    backgroundColor: '#EA580C',
  },
  statusDotNeutral: {
    backgroundColor: '#94A3B8',
  },
  statusText: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  statusTextActive: {
    color: '#047857',
  },
  statusTextLate: {
    color: '#B45309',
  },
  statusTextOff: {
    color: '#C2410C',
  },
  statusTextNeutral: {
    color: '#64748B',
  },

  // Identity
  identitySection: {
    gap: 6,
  },
  userNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  identityBadgesGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  employeeName: {
    flex: 1,
    fontSize: 20,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  empBadgePill: {
    backgroundColor: '#FFF7ED',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  empBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#C2410C',
    letterSpacing: 0.3,
  },
  roleBadgePill: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  roleBadgeHR: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  roleBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },
  roleBadgeTextHR: {
    color: '#1D4ED8',
  },
  cardProjectContainer: {
    width: '100%',
  },
  cardProjectPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    width: '100%',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 9,
    borderWidth: 1,
  },
  cardProjectLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    minWidth: 0,
  },
  cardProjectDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    flexShrink: 0,
  },
  cardProjectCodeBadge: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 5.5,
    paddingVertical: 1.5,
    borderRadius: 5,
    borderWidth: 0.8,
    borderColor: 'rgba(15, 23, 42, 0.08)',
    flexShrink: 0,
  },
  cardProjectCodeText: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  cardProjectNameText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0F172A',
    flex: 1,
  },
  cardProjectRoleBadge: {
    backgroundColor: 'rgba(15, 23, 42, 0.06)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    flexShrink: 0,
  },
  cardProjectRoleText: {
    fontSize: 8.5,
    fontWeight: '800',
    color: '#475569',
    textTransform: 'uppercase',
  },
  cardUnassignedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    width: '100%',
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  cardUnassignedText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#B45309',
  },
  cardLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  cardLocationText: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '600',
    flexShrink: 1,
  },
  cardLocationDot: {
    width: 5.5,
    height: 5.5,
    borderRadius: 3,
    backgroundColor: '#059669',
  },

  // Frosted Recessed Metrics Dock
  metricsDock: {
    backgroundColor: 'rgba(248, 250, 252, 0.92)',
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 7,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 8,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.6,
  },
  metricValue: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 1.5,
    fontVariant: ['tabular-nums'],
  },
  metricValueActive: {
    color: '#059669',
  },
  metricDivider: {
    width: 1,
    height: 22,
    backgroundColor: '#E2E8F0',
    marginHorizontal: 8,
  },
  progressTrack: {
    height: 4,
    backgroundColor: '#E2E8F0',
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: 7,
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
    marginTop: 2,
  },
  flipHintText: {
    fontSize: 8.5,
    color: '#94A3B8',
    fontWeight: '600',
    letterSpacing: 0.2,
  },

  // Back Pass Styles
  verifiedShieldBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backTitle: {
    fontSize: 10.5,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: 0.7,
  },
  backSubTitle: {
    fontSize: 9.5,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 1,
  },
  flipPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  flipPillText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#475569',
  },
  qrSectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginVertical: 4,
  },
  qrContainer: {
    width: 86,
    height: 86,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    padding: 6,
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 6,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  qrCornerTL: {
    position: 'absolute',
    top: 6,
    left: 6,
    width: 15,
    height: 15,
    borderTopWidth: 2.5,
    borderLeftWidth: 2.5,
    borderColor: '#EA580C',
    borderTopLeftRadius: 3,
  },
  qrCornerTR: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 15,
    height: 15,
    borderTopWidth: 2.5,
    borderRightWidth: 2.5,
    borderColor: '#0F172A',
    borderTopRightRadius: 3,
  },
  qrCornerBL: {
    position: 'absolute',
    bottom: 18,
    left: 6,
    width: 15,
    height: 15,
    borderBottomWidth: 2.5,
    borderLeftWidth: 2.5,
    borderColor: '#0F172A',
    borderBottomLeftRadius: 3,
  },
  qrCornerBR: {
    position: 'absolute',
    bottom: 18,
    right: 6,
    width: 15,
    height: 15,
    borderBottomWidth: 2.5,
    borderRightWidth: 2.5,
    borderColor: '#059669',
    borderBottomRightRadius: 3,
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
    borderRadius: 1.5,
  },
  qrBlockAccent: {
    width: 7,
    height: 7,
    backgroundColor: '#EA580C',
    borderRadius: 1.5,
  },
  qrBlockLight: {
    width: 7,
    height: 7,
    backgroundColor: '#E2E8F0',
    borderRadius: 1.5,
  },
  qrScanLabel: {
    fontSize: 7.5,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: 0.9,
    marginTop: 3,
  },
  specsColumn: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  specRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 3,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    gap: 8,
  },
  specRowLast: {
    borderBottomWidth: 0,
  },
  specLabel: {
    fontSize: 8.5,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.5,
  },
  specValue: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0F172A',
    flexShrink: 1,
    textAlign: 'right',
  },
  barcodeSection: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
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
    backgroundColor: '#0F172A',
    borderRadius: 0.5,
  },
  barcodeText: {
    fontSize: 8.5,
    fontWeight: '800',
    color: '#475569',
    letterSpacing: 1.6,
    marginTop: 3.5,
  },
  backFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  securityText: {
    fontSize: 8.5,
    color: '#94A3B8',
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
