/**
 * Seeder Helper Utilities
 * 
 * Provides functions for generating realistic fake data for database seeding.
 * All external integration fields use fake data (no real API calls).
 */

/**
 * Generate a fake Paystack customer code
 * Format: CUS_ + 15 alphanumeric characters
 */
function generatePaystackCustomerCode() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let code = 'CUS_';
  for (let i = 0; i < 15; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Generate a fake Paystack recipient code
 * Format: RCP_ + 15 alphanumeric characters
 */
function generatePaystackRecipientCode() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let code = 'RCP_';
  for (let i = 0; i < 15; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Generate a fake transfer reference
 * Format: TRF_ + timestamp + _ + 4 digit random
 */
function generateTransferReference() {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `TRF_${timestamp}_${random}`;
}

/**
 * Generate a fake disbursement reference
 * Format: DISB_ + timestamp + _ + 4 digit random
 */
function generateDisbursementReference() {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `DISB_${timestamp}_${random}`;
}

/**
 * Generate a fake NUBAN account number (10 digits)
 */
function generateNuban() {
  return Math.floor(1000000000 + Math.random() * 9000000000).toString();
}

/**
 * Generate a unique account number with prefix
 * @param {string} prefix - Account type prefix (SAV, SHR, TRG)
 */
function generateAccountNumber(prefix) {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `${prefix}${timestamp}${random}`;
}

/**
 * Generate a transaction reference
 * @param {string} type - Transaction type code (DEP, WDR, LND, etc.)
 */
function generateTransactionReference(type) {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `${type}_${timestamp}_${random}`;
}

/**
 * Get a random Nigerian bank name
 */
function getRandomBank() {
  const banks = [
    'Wema Bank',
    'Paystack-Titan',
    'Access Bank',
    'GTBank',
    'First Bank',
    'UBA',
    'Zenith Bank'
  ];
  return banks[Math.floor(Math.random() * banks.length)];
}

/**
 * Get a date offset from now
 * @param {number} days - Days offset (negative for past, positive for future)
 * @param {number} hours - Additional hours offset
 */
function getOffsetDate(days, hours = 0) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(date.getHours() + hours);
  return date;
}

/**
 * Get current month string in YYYY-MM format
 */
function getCurrentMonth() {
  return new Date().toISOString().slice(0, 7);
}

/**
 * Get previous month string in YYYY-MM format
 */
function getPreviousMonth() {
  const date = new Date();
  date.setMonth(date.getMonth() - 1);
  return date.toISOString().slice(0, 7);
}

/**
 * Pick a random item from an array
 */
function pickRandom(array) {
  return array[Math.floor(Math.random() * array.length)];
}

/**
 * Pick multiple random items from an array
 * @param {Array} array - Source array
 * @param {number} count - Number of items to pick
 */
function pickMultipleRandom(array, count) {
  const shuffled = [...array].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, Math.min(count, array.length));
}

/**
 * Generate a random amount between min and max
 */
function randomAmount(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Generate a random ID number for users
 * Format: TYPE + 7 digits
 * @param {string} type - ID type prefix (SA for super admin, AD for admin, ST for staff, MEM for member)
 */
function generateIdNumber(type) {
  const num = Math.floor(1000000 + Math.random() * 9000000);
  return `${type}${num}`;
}

/**
 * Nigerian phone number prefixes
 */
const phonePrefixes = ['0803', '0805', '0806', '0810', '0813', '0814', '0816', '0903', '0905', '0913'];

/**
 * Generate a random Nigerian phone number
 */
function generatePhoneNumber() {
  const prefix = phonePrefixes[Math.floor(Math.random() * phonePrefixes.length)];
  const suffix = Math.floor(1000000 + Math.random() * 9000000);
  return prefix + suffix;
}

/**
 * Sample Nigerian names for generating realistic user data
 */
const firstNames = [
  'Adebayo', 'Adeola', 'Adewale', 'Akinwale', 'Akinola', 'Ayodeji', 'Babatunde', 'Bamidele',
  'Chidinma', 'Chidi', 'Chinedu', 'Chioma', 'Emeka', 'Emmanuel', 'Folake', 'Funmilayo',
  'Gbenga', 'Grace', 'Ibrahim', 'Ifeanyi', 'James', 'John', 'Kemi', 'Kunle',
  'Michael', 'Musa', 'Ngozi', 'Nnamdi', 'Oluwaseun', 'Olumide', 'Peter', 'Precious',
  'Rashidat', 'Samuel', 'Seyi', 'Temitope', 'Uche', 'Umar', 'Yusuf', 'Zainab'
];

const lastNames = [
  'Adeyemi', 'Ajayi', 'Akande', 'Akintola', 'Balogun', 'Chukwu', 'Eze', 'Fashola',
  'Ibrahim', 'Ige', 'Johnson', 'Kalu', 'Lawal', 'Mohammed', 'Nwosu', 'Obi',
  'Ogunleye', 'Okafor', 'Okonkwo', 'Olatunji', 'Olusegun', 'Onwumere', 'Osinbajo',
  'Okeke', 'Salisu', 'Suleiman', 'Udo', 'Umaru', 'Yakubu'
];

/**
 * Generate a random full name
 */
function generateFullName() {
  const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
  const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
  return `${firstName} ${lastName}`;
}

module.exports = {
  generatePaystackCustomerCode,
  generatePaystackRecipientCode,
  generateTransferReference,
  generateDisbursementReference,
  generateNuban,
  generateAccountNumber,
  generateTransactionReference,
  getRandomBank,
  getOffsetDate,
  getCurrentMonth,
  getPreviousMonth,
  pickRandom,
  pickMultipleRandom,
  randomAmount,
  generateIdNumber,
  generatePhoneNumber,
  generateFullName,
  firstNames,
  lastNames,
  phonePrefixes
};
