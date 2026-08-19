export type UserRole = 'admin' | 'staff' | 'customer';

export interface User {
  id: string;
  email: string;
  role: UserRole;
  status: 'active' | 'inactive';
  name?: string;
  phone?: string;
  staffNumber?: string;
  authUid?: string;
  authProvider?: string;
  createdAt?: any;
}

export interface SpecialSchedule {
  id: string;
  name: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  days: string[]; // e.g. ['Monday', 'Tuesday', ...] or ['monday', 'tuesday', ...]
  active?: boolean;
  closed?: boolean;
  lunch?: {
    open: string;
    close: string;
    active: boolean;
    fullHouse?: boolean;
  };
  dinner?: {
    open: string;
    close: string;
    active: boolean;
    fullHouse?: boolean;
  };
  open?: string;
  close?: string;
  reservationInterval?: number;
  note?: string;
}

export interface RestaurantSEO {
  // Basic SEO & OpenGraph Meta
  seoTitle?: string;
  seoTitleEn?: string;
  seoTitlePt?: string;
  metaDescription?: string;
  metaDescriptionEn?: string;
  metaDescriptionPt?: string;
  keywords?: string;
  keywordsPt?: string;
  siteName?: string; // og:site_name
  ogUrl?: string; // og:url

  // Local SEO & Rich Snippets
  cuisineType?: string;
  priceRange?: string; // '€' | '€€' | '€€€' | '€€€€' | '$' | '$$' | '$$$' | '$$$$'
  city?: string;
  stateCounty?: string;
  postalCode?: string;
  country?: string;
  streetAddress?: string;
  googleBusinessUrl?: string;
  googleMapsUrl?: string;
  latitude?: number | string;
  longitude?: number | string;

  // Social Sharing
  socialTitle?: string;
  socialTitlePt?: string;
  socialDescription?: string;
  socialDescriptionPt?: string;
  socialImageUrl?: string;
  cloudinarySocialImageUrl?: string;
  socialPreviewCardBg?: string; // Custom background color for admin social preview box

  // Indexing & Canonical Controls
  allowIndexing?: boolean; // default true
  canonicalUrl?: string;

  // Structured Data / Custom JSON-LD
  customJsonLd?: string;
}

export interface RestaurantSettings {


  id?: string;
  name: string;
  timezone?: string;
  autoSendManualReservationsEmails?: boolean;
  description?: string;
  descriptionEn?: string;
  address: string;
  email: string;
  phone: string;
  secondaryPhone?: string;
  websiteUrl?: string;
  socialLinks?: { platform: 'facebook' | 'instagram' | 'tiktok' | 'youtube' | 'tripadvisor', url: string }[];
  logoUrl?: string;
  logoSize?: number;
  showLogo?: boolean;
  showRestaurantName?: boolean;
  faviconUrl?: string;
  heroImageUrl?: string;
  footerImageUrl?: string;
  heroOverlay?: string;
  heroOverlayOpacity?: number;
  footerOverlay?: string;
  footerOverlayOpacity?: number;
  openingHours: Record<string, { 
    open: string; 
    close: string; 
    closed: boolean;
    lunch?: { open: string; close: string; active: boolean; fullHouse?: boolean };
    dinner?: { open: string; close: string; active: boolean; fullHouse?: boolean };
  }>;
  promotionPopups?: PromotionPopup[];
  closedDays: string[];
  closedPeriods?: { startDate: string; endDate: string; note?: string }[];
  recurringClosedDays?: string[]; // For MM-DD format
  reservationInterval?: number; // in minutes, e.g., 15, 30, 60
  minReservationGap?: number;
  compactAdminViews?: boolean;
  cronogramaTimeRange?: 'service' | '24h'; // in minutes, e.g., 135 (2h15m)
  cronogramaStartTime?: string; // e.g., '11:00'
  lastOnlineReservationMinutes?: number; // minutes before close for last online reservation
  allowOnlineReservations?: boolean;
  phoneVerificationEnabled?: boolean;
  defaultCountryCode?: string;
  maxOnlineGuests?: number;
  maxMonthsAhead?: number;
  fullHouseDates?: string[];
  fullHouseLunchDates?: string[];
  fullHouseDinnerDates?: string[];
  showCustomerInsights?: boolean;
  tripadvisorWidget?: string;
  showTripadvisorWidget?: boolean;
  googleMapsWidget?: string;
  showGoogleMapsWidget?: boolean;
  showLiveUpcomingBox?: boolean;
  showLanguageSwitch?: boolean;
  freezeEnabled?: boolean;
  freezePassword?: string;
  freezeTime?: number; // in minutes
  cloudinaryCloudName?: string;
  cloudinaryApiKey?: string;
  cloudinaryApiSecret?: string;
  cloudinaryUploadPreset?: string;
  cloudinaryLogoUrl?: string;
  cloudinaryFaviconUrl?: string;
  cloudinaryHeroImageUrl?: string;
  cloudinaryFooterImageUrl?: string;
  useCloudinary?: boolean;
  resendApiKey?: string;
  resendFromEmail?: string;
  firebaseApiKey?: string;
  firebaseAuthDomain?: string;
  firebaseProjectId?: string;
  firebaseStorageBucket?: string;
  firebaseMessagingSenderId?: string;
  firebaseAppId?: string;
  firebaseMeasurementId?: string;
  firebaseDatabaseId?: string;
  twilioAccountSid?: string;
  twilioAuthToken?: string;
  twilioPhoneNumber?: string;
  dataHistoryPassword?: string;
  appUnlockPin?: string;
  protectPdfWithPassword?: boolean;
  pdfPassword?: string;
  fontFamily?: 'Inter' | 'Playfair Display' | 'Montserrat' | 'Open Sans' | 'Poppins';
  theme?: 'light' | 'dark';
  enablePageTransitions?: boolean;
  preloaderBg?: 'white' | 'dark' | 'brand';
  timeFormat?: '12h' | '24h';
  heroHeight?: '50vh' | '60vh' | '75vh' | '100vh';
  containerWidth?: 'default' | '1480px';
  primaryColor?: string;
  buttonBorderRadius?: string;
  boxBorderRadius?: string;
  inputBorderRadius?: string;
  showFloorPlanBg?: boolean;
  floorPlanBgUrl?: string;
  useDefaultFloorPlanBg?: boolean;
  floorPlanOpacity?: number;
  silentBell?: boolean;
  specialDays?: Record<string, {
    open?: string;
    close?: string;
    closed?: boolean;
    reservationInterval?: number;
    active: boolean;
    lunch?: { open: string; close: string; active: boolean; fullHouse?: boolean };
    dinner?: { open: string; close: string; active: boolean; fullHouse?: boolean };
  }>;
  recurringSpecialDays?: Record<string, {
    open?: string;
    close?: string;
    closed?: boolean;
    reservationInterval?: number;
    active: boolean;
    lunch?: { open: string; close: string; active: boolean; fullHouse?: boolean };
    dinner?: { open: string; close: string; active: boolean; fullHouse?: boolean };
  }>;
  specialSchedulesActive?: boolean;
  specialSchedules?: SpecialSchedule[];
  maintenanceModeEnabled?: boolean;
  maintenanceMessage?: string;
  maintenanceMessageEn?: string;
  maintenanceShowHero?: boolean;
  maintenanceHeroImageUrl?: string;
  developingModeEnabled?: boolean;
  developingPassword?: string;
  gracePeriod?: number;
  enableBookingNumber?: boolean;
  bookingNumberPrefix?: string;
  bookingNumberResetDate?: string;
  region?: 'portugal' | 'ireland';
  seo?: RestaurantSEO;
}

export interface PromotionPopup {
  id: string;
  active: boolean;
  startDate: string;
  endDate: string;
  title: string;
  titlePt?: string;
  subtitle?: string;
  subtitlePt?: string;
  message: string;
  messagePt?: string;
  imageUrl?: string;
}

export interface Area {
  id: string;
  name: string;
  allowOnlineReservations?: boolean;
  bookingMode?: 'online' | 'manual' | 'closed' | 'special_event' | 'permanently_closed';
  closedStartDate?: string;
  closedEndDate?: string;
  closedSessions?: ('lunch' | 'dinner')[];
  sessionMode?: 'both' | 'lunch' | 'dinner';
  order?: number;
  specialEventName?: string;
  specialEventSessions?: ('lunch' | 'dinner')[];
  color?: string;
  dateOverrides?: Record<string, {
    bookingMode?: 'online' | 'manual' | 'closed' | 'special_event' | 'permanently_closed';
    allowOnlineReservations?: boolean;
    specialEventName?: string;
    specialEventSessions?: ('lunch' | 'dinner')[];
    sessionMode?: 'both' | 'lunch' | 'dinner';
    closedSessions?: ('lunch' | 'dinner')[];
    x?: number;
    y?: number;
  }>;
}

export type TableShape = 'round' | 'square' | 'rectangle';

export interface Table {
  id: string;
  name: string;
  seats: number;
  x: number;
  y: number;
  status: 'available' | 'reserved' | 'occupied';
  shape?: TableShape;
  rotation?: number;
  isBlocked?: boolean;
  areaId?: string; // Related area ID
  blockedDates?: Record<string, { lunch?: boolean; dinner?: boolean; default?: boolean }>;
  allowOnlineReservations?: boolean;
  onlineSessions?: {
    lunch: boolean;
    dinner: boolean;
  };
  isActive?: boolean;
  activeSessions?: {
    lunch: boolean;
    dinner: boolean;
  };
  availableDate?: string;
  availableDates?: string[];
  isExtra?: boolean;
  extraStartDate?: string;
  extraEndDate?: string;
  extraSessions?: {
    lunch: boolean;
    dinner: boolean;
  };
  extraAvailability?: Record<string, { lunch: boolean; dinner: boolean }>;
  positions?: {
    lunch?: { x: number; y: number };
    dinner?: { x: number; y: number };
  };
  dailyPositions?: Record<string, {
    lunch?: { x: number; y: number };
    dinner?: { x: number; y: number };
    default?: { x: number; y: number };
  }>;
  joinedTables?: string[]; // IDs of tables joined with this one
  joinedSeats?: number; // Total seats when joined
  dailyJoins?: Record<string, {
    lunch?: { joinedTables: string[]; joinedSeats: number };
    dinner?: { joinedTables: string[]; joinedSeats: number };
    default?: { joinedTables: string[]; joinedSeats: number };
  }>;
}

export interface Reservation {
  id: string;
  bookingNumber?: string;
  customerUid?: string;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  language?: 'pt' | 'en';
  date: string;
  time: string;
  guests: number;
  tableId?: string;
  tableName?: string;
  notes?: string;
  status: 'pending' | 'booked' | 'confirmed' | 'cancelled' | 'completed' | 'blocked' | 'arrived' | 'no-show' | 'waiting-list' | 'delayed' | 'history';
  isWaitlist?: boolean;
  isDeleted?: boolean;
  isHistory?: boolean;
  createdAt?: string;
  source?: 'public' | 'admin';
  bookedByStaffNumber?: string;
  showInUpcomingReports?: boolean;
  verifyTableNumber?: boolean;
  preferredTableUnavailable?: boolean;
  isRegularCustomer?: boolean;
  isDeletedByCustomer?: boolean;
  manualSession?: 'lunch' | 'dinner';
  session?: 'lunch' | 'dinner' | string;
  confirmationEmail?: {
    sent: boolean;
    sentAt?: string | null;
    messageId?: string;
    failed?: boolean;
    error?: string;
    lastAttemptAt?: string;
  };
  reminderEmail?: {
    scheduled: boolean;
    scheduledAt?: string | null;
    scheduledFor?: string | null;
    sent: boolean;
    sentAt?: string | null;
    messageId?: string | null;
  };
}

export interface Customer {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  language?: 'pt' | 'en';
  notes?: string;
  isRegular?: boolean;
  favoriteTables?: string[];
  isRegistered?: boolean;
  authUid?: string;
  status?: 'active' | 'inactive';
  isDeleted?: boolean;
  isHistory?: boolean;
  createdAt?: string;
}
