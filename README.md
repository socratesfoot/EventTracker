# Event Calendar (Google Sheets → embeddable HTML calendar)

A Google Apps Script web app that reads your event list from a Google Sheet and shows it as a
color-coded monthly calendar you can embed on any website with an iframe.

- Always opens on the current month (Prev / Next / Today buttons)
- Events are colored by category, with category chips and a search box
- Each event tile shows the title above a square image from the **Image Link** column
- Clicking an event opens a detail card: name, category, date/time, cost, venue website,
  ticket link, and the **hospitality rental nearest the venue** with its booking link
- The sheet stays private; the script reads it as you and serves only the calendar

## Files

| File | What it is |
|---|---|
| `Code.gs` | Server code. Reads the sheet and **creates the spreadsheet and both tabs if they don't exist**. |
| `Index.html` | The calendar page (all HTML/CSS/JS in one file). |
| `appsscript.json` | Project manifest. Sets the web app to run as you and be open to **Anyone**, which is what allows iframe embedding. |

## Setup checklist

1. Go to <https://script.google.com> and choose **New project**
   (or open your sheet and choose **Extensions → Apps Script** to attach it to that sheet).
2. Paste `Code.gs` over the default `Code.gs`.
3. Add an HTML file: **+ → HTML**, name it exactly `Index`, and paste in `Index.html`.
4. Apply the manifest: **Project Settings (gear icon) → check "Show appsscript.json manifest file in editor"**,
   go back to the editor, open `appsscript.json`, and replace its contents with the provided file.
5. Choose the sheet in `Code.gs`:
   - Already have a sheet? Put its ID in `SHEET_ID` (the long string in the sheet URL between `/d/` and `/edit`).
   - Want a new one? Set `SHEET_ID = ''`. The script uses the sheet it's attached to, or creates a new
     spreadsheet named "Event Calendar Data".
6. Select the `setup` function in the toolbar and click **Run**. Approve the permissions prompt
   (it needs access to Google Sheets). Open **Execution log** to see the sheet URL. Setup creates the
   `EventTracker` and `Properties` tabs with headers and one sample row each if they are missing.
7. Deploy: **Deploy → New deployment → ⚙ Select type → Web app**
   - **Execute as:** Me
   - **Who has access:** Anyone
   - Click **Deploy** and copy the **Web app URL** (ends in `/exec`).
8. Open the URL in a private/incognito window to confirm the calendar loads without signing in.
9. Fill in your events (see below), then embed the calendar (see *Embedding*).

> After you edit any code later, use **Deploy → Manage deployments → ✏ Edit → Version: New version → Deploy**.
> The URL stays the same. Sheet data changes need no redeploy and appear within about 5 minutes.

## The sheet

### `EventTracker` tab (row 1 = headers, exactly these names)

| Column | Notes |
|---|---|
| Event Name | Shown on the tile and in big bold type on the detail card. |
| Category | Drives the color and the filter chips. Spell it consistently ("Music", not "music"/"Musics"). |
| Closest Property | Must match a **Short Name** on the `Properties` tab (capitalization ignored). |
| Date & Time | A real date/time, e.g. `10/18/2026 7:00 PM`. A date with no time (or midnight) shows the date only. |
| Venue Link | Full venue website URL. |
| Ticket Link | Full URL where tickets are sold. |
| Image Link | Direct image URL (ends in .jpg/.png/.webp) or a Google Drive share link. Falls back to a colored letter if missing or broken. |
| Cost | Free text, e.g. `Free`, `$25`, `$40–$120`. |
| End Date | Optional. For multi-day events; the event appears on every day through this date. |
| Bookings During Event | Not displayed yet. Reserved for later use. |

### `Properties` tab

| Column | Notes |
|---|---|
| Short Name | The name used in the `Closest Property` column, e.g. `Ben Hill`. |
| Property Locations | Address shown on the detail card, e.g. `2817 Ben Hill Rd, East Point GA 30344`. |
| Booking Link | The booking URL for that property. |

## Embedding

Paste this into an HTML / "Custom HTML" / "Embed code" block on your site, replacing the URL:

```html
<style>
  .event-cal { width:100%; height:1150px; border:0; }
  @media (max-width:700px) { .event-cal { height:620px; } }
</style>
<iframe class="event-cal" title="Event Calendar" loading="lazy"
  src="YOUR_WEB_APP_URL"></iframe>
```

Where it goes:

- **WordPress:** add a *Custom HTML* block.
- **Wix:** *Add → Embed Code → Embed HTML*, then choose *Code* and paste.
- **Squarespace:** add a *Code* block and turn off *Display Source*.
- **Weebly / GoDaddy:** use the *Embed Code* element.

Height tip: the day tiles are square, so the calendar's height follows its width. About 1150px suits a
full-width desktop layout with a six-week month. Phones need about 600px. Adjust the two numbers to fit your page.

If the iframe is blank or shows a Google sign-in page, the deployment isn't set to **Anyone**.
Re-check step 7 and test in a private window.

## The easiest way to keep it filled: a schedulable AI assistant

Typing events in by hand works, but the easiest way to keep the calendar current is to let a
**schedulable AI assistant** do it. Give an assistant that supports scheduled tasks (for example Claude)
access to your Google Sheet and let it read the event pages you care about, such as venue calendars, ticketing
pages, or city event listings. It can pull events straight from those HTML pages and add them as new rows on the
`EventTracker` tab on a daily or weekly schedule.

Suggested setup:

1. Connect the assistant to your Google Drive / Sheets and give it edit access to this sheet only.
2. Give it a list of the web pages to check.
3. Schedule a recurring task with instructions like:

   > Every Monday, visit these event pages: [list]. Find events in the next 90 days within 15 miles of our
   > properties. Add each new event as a row on the `EventTracker` tab of the "Event Calendar Data" sheet using
   > these columns: Event Name, Category, Closest Property, Date & Time, Venue Link, Ticket Link, Image Link, Cost,
   > End Date. Set Closest Property to the matching Short Name from the `Properties` tab. Use a real date/time in
   > the Date & Time column. Skip events already in the sheet (same name and date). Never edit or delete existing rows.

Tips: tell it which categories to use so colors stay consistent, have it append only (no overwrites), and
skim new rows now and then, since scraped data such as ticket links and prices can occasionally be wrong.

## Troubleshooting

| Problem | Fix |
|---|---|
| "The calendar could not load" | Run `setup` once from the editor and approve permissions. Check that tab names and headers match. |
| Blank iframe / sign-in page | Redeploy with **Execute as: Me** and **Who has access: Anyone**. |
| Event missing | The Date & Time cell must be a valid date. Text like "TBD" is skipped. |
| No rental box on an event | `Closest Property` doesn't match a Short Name on `Properties`, or that row has no Booking Link. |
| Image not showing | Use a direct image URL or a Google Drive link shared as "Anyone with the link". |
| Edits not showing | Wait up to 5 minutes (cache), then refresh. |
