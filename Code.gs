/**
 * Event Calendar – Google Apps Script web app
 * Reads the "EventTracker" and "Properties" tabs and serves an embeddable HTML calendar.
 *
 * If the spreadsheet or either tab does not exist, they are created automatically
 * (run setup() once from the editor to do this up front and see the sheet URL in the log).
 */

// Leave '' to auto-create a new spreadsheet (or to use the sheet this script is attached to).
const SHEET_ID = '1AmUnNdA68XZFQi0q6eYEIZCu06huys4IKsiPLg3ordY';
const SPREADSHEET_NAME = 'Event Calendar Data';
const EVENT_TAB = 'EventTracker';
const PROPERTY_TAB = 'Properties';
const CACHE_SECONDS = 300; // sheet edits show up on the site within ~5 minutes

const EVENT_HEADERS = ['Event Name', 'Category', 'Closest Property', 'Date & Time', 'Venue Link',
  'Ticket Link', 'Image Link', 'Cost', 'End Date', 'Bookings During Event'];
const PROPERTY_HEADERS = ['Short Name', 'Property Locations', 'Booking Link'];

/** Run once from the Apps Script editor: creates/checks the sheet and logs its URL. */
function setup() {
  const ss = getSpreadsheet_();
  ensureTabs_(ss);
  Logger.log('Calendar data sheet: ' + ss.getUrl());
}

function doGet() {
  try {
    const t = HtmlService.createTemplateFromFile('Index');
    // Escape "<" so the JSON can never close the <script> tag it is embedded in.
    t.dataJson = JSON.stringify(getCalendarData_()).replace(/</g, '\\u003c');
    return t.evaluate()
      .setTitle('Event Calendar')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL); // lets it be iframed
  } catch (err) {
    return HtmlService.createHtmlOutput(
      '<p style="font-family:sans-serif">The calendar could not load: ' +
      String(err.message).replace(/</g, '&lt;') + '</p>')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
}

// ---------- Spreadsheet + tab creation ----------

/** Finds the spreadsheet: SHEET_ID, then the saved ID, then the attached sheet, else creates one. */
function getSpreadsheet_() {
  const props = PropertiesService.getScriptProperties();
  let ss = null;

  if (SHEET_ID) {
    try { ss = SpreadsheetApp.openById(SHEET_ID); }
    catch (e) { console.warn('SHEET_ID could not be opened: ' + e.message); }
  }
  if (!ss && props.getProperty('SHEET_ID')) {
    try { ss = SpreadsheetApp.openById(props.getProperty('SHEET_ID')); }
    catch (e) { console.warn('Saved sheet could not be opened: ' + e.message); }
  }
  if (!ss) {
    try { ss = SpreadsheetApp.getActiveSpreadsheet(); } catch (e) { ss = null; } // script attached to a sheet
  }
  if (!ss) ss = SpreadsheetApp.create(SPREADSHEET_NAME);

  if (props.getProperty('SHEET_ID') !== ss.getId()) props.setProperty('SHEET_ID', ss.getId());
  return ss;
}

/** Creates the EventTracker and Properties tabs (with headers) if they are missing or empty. */
function ensureTabs_(ss) {
  const madeEvents = ensureTab_(ss, EVENT_TAB, EVENT_HEADERS);
  const madeProps = ensureTab_(ss, PROPERTY_TAB, PROPERTY_HEADERS);

  if (madeProps) {
    ss.getSheetByName(PROPERTY_TAB).getRange(2, 1, 1, 3)
      .setValues([['Sample Property', '123 Example St, Atlanta GA 30301', 'https://example.com/book']]);
  }
  if (madeEvents) {
    const sheet = ss.getSheetByName(EVENT_TAB);
    const when = new Date(Date.now() + 7 * 86400000);
    when.setHours(19, 0, 0, 0);
    sheet.getRange(2, 1, 1, 8).setValues([['Sample Concert', 'Music', 'Sample Property', when,
      'https://example.com/venue', 'https://example.com/tickets', '', '$25']]);
    sheet.getRange(2, 4, 999, 1).setNumberFormat('m/d/yyyy h:mm am/pm');
    sheet.getRange(2, 9, 999, 1).setNumberFormat('m/d/yyyy h:mm am/pm');
  }

  // Remove the blank default tab on a brand-new spreadsheet.
  const blank = ss.getSheetByName('Sheet1');
  if (blank && ss.getSheets().length > 1 && blank.getLastRow() === 0) ss.deleteSheet(blank);
}

/** Returns true if the tab had to be created (or was empty) and was initialised. */
function ensureTab_(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (sheet && sheet.getLastRow() > 0) return false;
  if (!sheet) sheet = ss.insertSheet(name);
  sheet.getRange(1, 1, 1, headers.length).setValues([headers])
    .setFontWeight('bold').setBackground('#e8eaf0');
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, headers.length);
  return true;
}

// ---------- Data ----------

function getCalendarData_() {
  const cache = CacheService.getScriptCache();
  const hit = cache.get('calendar_data');
  if (hit) return JSON.parse(hit);

  const ss = getSpreadsheet_();
  ensureTabs_(ss);
  const tz = ss.getSpreadsheetTimeZone();

  // Properties: Short Name -> {name, location, link}
  const properties = {};
  readTable_(ss.getSheetByName(PROPERTY_TAB)).forEach(function (r) {
    const name = txt_(r.d['short name']);
    if (!name) return;
    properties[name.toLowerCase()] = {
      name: name,
      location: txt_(r.d['property locations'] || r.d['property location']),
      link: txt_(r.d['booking link'])
    };
  });

  // Events
  const events = [];
  readTable_(ss.getSheetByName(EVENT_TAB)).forEach(function (r) {
    const name = txt_(r.d['event name']);
    const start = parseDate_(r.v['date & time'], tz);
    if (!name || !start) return; // skip blank / unparseable rows
    const end = parseDate_(r.v['end date'], tz);
    events.push({
      name: name,
      category: txt_(r.d['category']) || 'Other',
      property: txt_(r.d['closest property']),
      start: start.date,
      startTime: start.time,
      end: end ? end.date : '',
      endTime: end ? end.time : '',
      venueLink: txt_(r.d['venue link']),
      ticketLink: txt_(r.d['ticket link']),
      image: txt_(r.d['image link']),
      cost: txt_(r.d['cost'])
    });
  });

  const out = { events: events, properties: properties };
  try { cache.put('calendar_data', JSON.stringify(out), CACHE_SECONDS); } catch (e) { /* >100KB: skip cache */ }
  return out;
}

/** Reads a tab into rows keyed by lower-cased header. v = raw values, d = displayed text. */
function readTable_(sheet) {
  const range = sheet.getDataRange();
  const vals = range.getValues();
  const disp = range.getDisplayValues();
  if (vals.length < 2) return [];
  const headers = vals[0].map(function (h) { return String(h).trim().toLowerCase(); });
  const rows = [];
  for (let i = 1; i < vals.length; i++) {
    if (vals[i].join('') === '') continue;
    const v = {}, d = {};
    headers.forEach(function (h, c) { if (h) { v[h] = vals[i][c]; d[h] = disp[i][c]; } });
    rows.push({ v: v, d: d });
  }
  return rows;
}

function parseDate_(value, tz) {
  if (value === '' || value == null) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return null;
  const time = Utilities.formatDate(d, tz, 'HH:mm');
  return {
    date: Utilities.formatDate(d, tz, 'yyyy-MM-dd'),
    time: time === '00:00' ? '' : time // midnight = "no time given"
  };
}

function txt_(v) { return v == null ? '' : String(v).trim(); }
