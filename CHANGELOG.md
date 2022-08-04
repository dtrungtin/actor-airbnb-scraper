## 2022-07-28

- Fixed circular dependency error
- Fixed error with default min/max prices and empty pricing
- Prioritized home detail requests to retrieve the results sooner

## 2022-07-28

- Fixed pricing extraction
- Extended nightly price rate with total price info
- Propagated input currency to pricing API request
- Removed deprecated `got` request options (except for `abortFunction`)
- Fixed JSON files indentation

## 2022-04-25

- Added `calendarMonths` input option and deprecated `includeCalendar`. Now you can specify how many months into the future you want to scrape.

## 1.0.1

- Updated SDK version
- Refactored code
- Fix currency issues
- Added pricing to dataset
- Make pivoting a little more assertive
- Optimized geolocation code and decreased mm accuracy to meters
- Added the ability to include the calendar of available days
- Added more descriptive errors
- Added `debugLog`
- Added limits for search and splitting geolocation into smaller areas


## 2021-03-27
- Changed input schema to be more UX friendly (set `maxItems` and `maxReviews`, set default search term, switched off DEBUG log on default, used USD as default currency)

## 2021-06-01
- Fixed max item field to work properly
- Fixed external source of input (CSV, google sheets)

## 2021-08-24
- Added more information for the primary host such as host url and number of listings
