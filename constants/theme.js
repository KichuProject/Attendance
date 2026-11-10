/**
 * Tech Sigaram Enterprise - Design System Tokens
 * Refined Executive Theme adhering to apple-design, interface-design, and frontend-design principles.
 */

export const THEME = {
  colors: {
    // Canvas & Surfaces
    background: '#F8FAFC',
    card: '#FFFFFF',
    surfaceSubtle: '#F1F5F9',
    surfaceMuted: '#E2E8F0',
    border: 'rgba(15, 23, 42, 0.08)',
    borderLight: 'rgba(15, 23, 42, 0.04)',
    borderFocus: '#EA580C',

    // Text Hierarchy
    textPrimary: '#0F172A',     // Slate 900
    textSecondary: '#475569',   // Slate 600
    textMuted: '#94A3B8',       // Slate 400
    textInverse: '#FFFFFF',

    // Brand Accents (Flame & Amber)
    primary: '#EA580C',        // Orange 600
    primaryDark: '#C2410C',    // Orange 700
    primaryLight: '#FB923C',   // Orange 400
    primarySurface: '#FFF7ED',  // Orange 50
    primaryBorder: '#FED7AA',   // Orange 200

    // Executive Slate Accent
    slateHero: '#0F172A',
    slateDark: '#1E293B',

    // Semantic Status Tokens
    success: '#059669',        // Emerald 600
    successSurface: '#ECFDF5',
    successBorder: '#A7F3D0',

    warning: '#D97706',        // Amber 600
    warningSurface: '#FFFBEB',
    warningBorder: '#FDE68A',

    danger: '#E11D48',         // Rose 600
    dangerSurface: '#FFF1F2',
    dangerBorder: '#FECDD3',

    info: '#0284C7',           // Sky 600
    infoSurface: '#F0F9FF',
    infoBorder: '#BAE6FD',
  },

  typography: {
    xs: 11,
    sm: 13,
    base: 15,
    md: 17,
    lg: 20,
    xl: 24,
    xxl: 28,
    display: 34,
  },

  radii: {
    xs: 6,
    sm: 10,
    md: 14,
    lg: 18,
    xl: 24,
    pill: 999,
  },

  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    xxxl: 32,
  },

  shadows: {
    card: {
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.04,
      shadowRadius: 12,
      elevation: 2,
    },
    hover: {
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.08,
      shadowRadius: 20,
      elevation: 4,
    },
    primaryGlow: {
      shadowColor: '#EA580C',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.25,
      shadowRadius: 14,
      elevation: 4,
    },
    modal: {
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 16 },
      shadowOpacity: 0.16,
      shadowRadius: 32,
      elevation: 12,
    },
  },
};

export default THEME;

