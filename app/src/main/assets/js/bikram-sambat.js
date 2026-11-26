var BS_MONTH_NAMES = ['बैशाख', 'जेठ', 'असार', 'साउन', 'भदौ', 'असोज', 'कार्तिक', 'मंसिर', 'पौष', 'माघ', 'फाल्गुन', 'चैत'];
var BS_MONTH_NAMES_EN = ['Baishakh', 'Jestha', 'Ashadh', 'Shrawan', 'Bhadra', 'Ashwin', 'Kartik', 'Mangsir', 'Poush', 'Magh', 'Falgun', 'Chaitra'];
var BS_EPOCH_TS = -1789990200000;
var BS_YEAR_ZERO = 1970;
var BS_MS_PER_DAY = 86400000;
var BS_ENCODED_MONTH_LENGTHS = [
  5315258,5314490,9459438,8673005,5315258,5315066,9459438,8673005,5315258,5314298,9459438,5327594,5315258,5314298,9459438,5327594,5315258,5314286,9459438,5315306,5315258,5314286,8673006,5315306,5315258,5265134,8673006,5315258,5315258,9459438,8673005,5315258,5314298,9459438,8673005,5315258,5314298,9459438,8473322,5315258,5314298,9459438,5327594,5315258,5314298,9459438,5327594,5315258,5314286,8673006,5315306,5315258,5265134,8673006,5315306,5315258,9459438,8673005,5315258,5314490,9459438,8673005,5315258,5314298,9459438,8473325,5315258,5314298,9459438,5327594,5315258,5314298,9459438,5327594,5315258,5314286,9459438,5315306,5315258,5265134,8673006,5315306,5315258,5265134,8673006,5315258,5314490,9459438,8673005,5315258,5314298,9459438,8669933,5315258,5314298,9459438,8473322,5315258,5314298,9459438,5327594,5315258,5314286,9459438,5315306,5315258,5265134,8673006,5315306,5315258,5265134,8673006,5315258,5315258,5527226,5528046,5527277,5528250,5528057,5527277,5527277
];

function bsPad(value) {
  return String(value).padStart(2, '0');
}

function bsDaysInMonth(year, month) {
  if (month < 1 || month > 12) throw new Error('Invalid BS month: ' + month);
  var delta = BS_ENCODED_MONTH_LENGTHS[year - BS_YEAR_ZERO];
  if (typeof delta === 'undefined') throw new Error('Unsupported BS year: ' + year);
  return 29 + ((delta >>> (((month - 1) << 1))) & 3);
}

function isValidBsDate(year, month, day) {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false;
  if (year < BS_YEAR_ZERO || year > BS_YEAR_ZERO + BS_ENCODED_MONTH_LENGTHS.length - 1) return false;
  if (month < 1 || month > 12) return false;
  return day >= 1 && day <= bsDaysInMonth(year, month);
}

function gregorianToBs(greg) {
  var parts = String(greg || '').split('-').map(Number);
  if (parts.length !== 3 || parts.some(part => !Number.isInteger(part))) throw new Error('Invalid Gregorian date: ' + greg);
  var days = Math.floor((Date.UTC(parts[0], parts[1] - 1, parts[2]) - BS_EPOCH_TS) / BS_MS_PER_DAY) + 1;
  var year = BS_YEAR_ZERO;
  var month;
  var monthDays;
  while (days > 0) {
    for (month = 1; month <= 12; month++) {
      monthDays = bsDaysInMonth(year, month);
      if (days <= monthDays) return { year: year, month: month, day: days };
      days -= monthDays;
    }
    year++;
  }
  throw new Error('Date outside supported BS range: ' + greg);
}

function bsToGregorianParts(year, month, day) {
  if (!isValidBsDate(year, month, day)) throw new Error('Invalid BS date: ' + year + '-' + month + '-' + day);
  var timestamp = BS_EPOCH_TS + (BS_MS_PER_DAY * day);
  var currentMonth = month - 1;
  var currentYear = year;
  while (currentYear >= BS_YEAR_ZERO) {
    while (currentMonth > 0) {
      timestamp += BS_MS_PER_DAY * bsDaysInMonth(currentYear, currentMonth);
      currentMonth--;
    }
    currentMonth = 12;
    currentYear--;
  }
  var date = new Date(timestamp);
  return { year: date.getUTCFullYear(), month: 1 + date.getUTCMonth(), day: date.getUTCDate() };
}

function bsToGregorian(year, month, day) {
  var parts = bsToGregorianParts(year, month, day);
  return parts.year + '-' + bsPad(parts.month) + '-' + bsPad(parts.day);
}

function bsToGregorianString(bsDate) {
  var parts = String(bsDate || '').split('-').map(Number);
  if (parts.length !== 3) return '';
  return bsToGregorian(parts[0], parts[1], parts[2]);
}

function gregorianToBsString(greg) {
  var parts = gregorianToBs(greg);
  return parts.year + '-' + bsPad(parts.month) + '-' + bsPad(parts.day);
}

function bsDateLabel(year, month, day, longForm, includeYear) {
  if (!isValidBsDate(year, month, day)) return '';
  var names = longForm ? BS_MONTH_NAMES : BS_MONTH_NAMES_EN;
  var label = day + ' ' + names[month - 1];
  return includeYear === false ? label : label + ' ' + year;
}

function todayBsString(now = new Date()) {
  var greg = now.getFullYear() + '-' + bsPad(now.getMonth() + 1) + '-' + bsPad(now.getDate());
  return gregorianToBsString(greg);
}
