export const formatWhatsAppNumber = (phone: string | undefined | null, region: string | undefined, defaultCountryCode: string | undefined): string | null => {
  if (!phone) return null;

  // Strip all non-digits except +
  let cleaned = phone.replace(/[^\d+]/g, '');
  
  if (!cleaned) return null;

  // Replace leading 00 with +
  if (cleaned.startsWith('00')) {
    cleaned = '+' + cleaned.substring(2);
  }

  // If already international, just remove the + and return
  if (cleaned.startsWith('+')) {
    return cleaned.substring(1);
  }

  // Determine prefix based on settings
  let prefix = '';
  if (defaultCountryCode) {
    prefix = defaultCountryCode.replace('+', '');
  } else if (region === 'portugal') {
    prefix = '351';
  } else {
    // Default to Ireland if not specified
    prefix = '353';
  }

  // Handle Irish numbers starting with 0 when converting to international
  if (prefix === '353' && cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1);
  }

  return prefix + cleaned;
};
