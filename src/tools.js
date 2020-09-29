const Apify = require('apify');
const camelcaseKeysRecursive = require('camelcase-keys-recursive');
const moment = require('moment');
const currencies = require('./currencyCodes.json');

const { utils: { log } } = Apify;
// log.setLevel(log.LEVELS.DEBUG);
const { buildListingUrl, callForReviews } = require('./api');
const {
    HISTOGRAM_ITEMS_COUNT,
    MIN_LIMIT,
    MAX_LIMIT,
    DATE_FORMAT,
} = require('./constants');

/**
 * @param {Array<{ listing: { id: string } }>} results
 * @param {Apify.RequestQueue} requestQueue
 * @param {number} minPrice
 * @param {number} maxPrice
 */
async function enqueueListingsFromSection(results, requestQueue, minPrice, maxPrice) {
    log.info(`Listings section size: ${results.length}`);
    for (const { listing } of results) {
        await enqueueDetailLink(listing.id, requestQueue, minPrice, maxPrice);
    }
}

/**
 * @param {string} id
 * @param {Apify.RequestQueue} requestQueue
 * @param {number} minPrice
 * @param {number} maxPrice
 */
function enqueueDetailLink(id, requestQueue, minPrice, maxPrice) {
    log.debug(`Enquing home with id: ${id}`);
    return requestQueue.addRequest({
        url: `https://api.airbnb.com/v2/pdp_listing_details/${id}?_format=for_native`,
        userData: {
            isHomeDetail: true,
            minPrice,
            maxPrice,
            id,
        },
    });
}

function randomDelay(minimum = 100, maximum = 200) {
    const min = Math.ceil(minimum);
    const max = Math.floor(maximum);
    return Apify.utils.sleep(Math.floor(Math.random() * (max - min + 1)) + min);
}

/**
 * @param {any} input
 * @param {number[] | string} location
 * @param {(...args: any) => Promise<any>} getRequest
 */
async function getSearchLocation({ minPrice, maxPrice, checkIn, checkOut, currency }, location, getRequest) {
    const limit = MAX_LIMIT;
    const offset = 0;
    const data = await getRequest(
        buildListingUrl({
            location,
            minPrice,
            maxPrice,
            limit,
            offset,
            checkIn,
            currency,
            checkOut,
        }),
    );
    const { query } = data.metadata;
    const { home_tab_metadata: { search } } = data.explore_tabs[0];
    log.info(`Currency query: ${search.native_currency}`);

    return query;
}

function findListings(sections) {
    let listings;

    for (let index = 0; index < sections.length; index++) {
        const section = sections[index];

        if (section.result_type === 'listings' && section.listings && section.listings.length > 0) {
            // eslint-disable-next-line prefer-destructuring
            listings = section.listings;
            break;
        }
    }

    return listings;
}

/**
 * @param {any} input
 * @param {number[] | string} location
 * @param {Apify.RequestQueue} requestQueue
 * @param {(...args: any) => Promise<any>} getRequest
 */
async function getListingsSection({ minPrice, maxPrice, checkIn, checkOut, currency }, location, requestQueue, getRequest) {
    const limit = MAX_LIMIT;
    let offset = 0;
    const request = () => getRequest(buildListingUrl({ location, minPrice, maxPrice, limit, offset, checkIn, checkOut, currency }));
    let data = await request();
    // eslint-disable-next-line camelcase
    const { pagination_metadata, sections } = data.explore_tabs[0];
    let listings = findListings(sections);
    if (listings) {
        await enqueueListingsFromSection(listings, requestQueue, minPrice, maxPrice);
    }

    let hasNextPage = pagination_metadata.has_next_page;
    // log.info(`Listings metadata: listings: ${listings.length}, hasNextPage: ${hasNextPage}, localized_listing_count: ${localized_listing_count}`);

    while (hasNextPage) {
        offset += limit;
        await randomDelay();
        data = await request();
        // eslint-disable-next-line camelcase
        const { pagination_metadata, sections } = data.explore_tabs[0];
        listings = findListings(sections);
        if (listings) {
            await enqueueListingsFromSection(listings, requestQueue, minPrice, maxPrice);
        }

        hasNextPage = pagination_metadata.has_next_page;
    }
}

/**
 * @param {any} input
 * @param {number[] | string} query
 * @param {Apify.RequestQueue} requestQueue
 */
async function addListings({ minPrice, maxPrice, checkIn, checkOut, currency }, query, requestQueue) {
    const intervalSize = maxPrice / HISTOGRAM_ITEMS_COUNT;
    let pivotStart = minPrice;
    let pivotEnd = intervalSize;

    for (let i = 0; i < HISTOGRAM_ITEMS_COUNT; i++) {
        const url = buildListingUrl({
            location: query,
            minPrice: pivotStart,
            maxPrice: pivotEnd,
            limit: MIN_LIMIT,
            offset: 0,
            checkIn,
            checkOut,
            currency,
        });

        log.debug(`Adding initial pivoting url: ${url}`);

        await requestQueue.addRequest({
            url,
            userData: {
                isPivoting: true,
                pivotStart,
                pivotEnd,
                query,
            },
        });

        pivotStart += intervalSize;
        pivotEnd += intervalSize;
    }
}

/**
 * @param {any} input
 * @param {Apify.Request} request
 * @param {Apify.RequestQueue} requestQueue
 * @param {(...args: any) => Promise<any>} getRequest
 */
async function pivot(input, request, requestQueue, getRequest) {
    const { checkIn, checkOut, currency } = input;
    const { pivotStart, pivotEnd, query } = request.userData;
    const data = await getRequest(request.url);
    let listingCount = data.explore_tabs[0].home_tab_metadata.listings_count;
    if (listingCount === 0) {
        // eslint-disable-next-line camelcase
        const { sections } = data.explore_tabs[0];
        for (const section of sections) {
            // eslint-disable-next-line prefer-destructuring
            const listings = section.listings;
            listingCount = section.localized_listing_count;

            if (listings) {
                if (listingCount === 0) {
                    listingCount = listings.length;
                }
                break;
            }
        }
    }

    log.debug(`Listings found: ${listingCount}`);

    if (listingCount === 0) {
        return;
    }

    if (listingCount > 1000 && (pivotEnd - pivotStart > 1)) {
        const intervalMiddle = Math.ceil((pivotEnd + pivotStart) / 2);

        const firstHalfUrl = buildListingUrl({
            location: query,
            minPrice: pivotStart,
            maxPrice: intervalMiddle,
            limit: MIN_LIMIT,
            offset: 0,
            checkIn,
            checkOut,
            currency,
        });
        log.debug(`First half url: ${firstHalfUrl}`);

        await requestQueue.addRequest({
            url: firstHalfUrl,
            userData: {
                pivotStart,
                pivotEnd: intervalMiddle,
                isPivoting: true,
                query,
            },
        });

        const secondHalfUrl = buildListingUrl({
            location: query,
            minPrice: intervalMiddle,
            maxPrice: pivotEnd,
            limit: MIN_LIMIT,
            offset: 0,
            checkIn,
            checkOut,
            currency,
        });
        log.debug(`Second half url: ${secondHalfUrl}`);

        await requestQueue.addRequest({
            url: secondHalfUrl,
            userData: {
                pivotStart: intervalMiddle,
                pivotEnd,
                isPivoting: true,
                query,
            } });
    } else {
        log.info(`Getting listings for start: ${pivotStart} end: ${pivotEnd}`);
        await getListingsSection({ minPrice: pivotStart, maxPrice: pivotEnd, checkIn, checkOut, currency }, query, requestQueue, getRequest);
    }
}

async function getReviews(listingId, getRequest) {
    const results = [];
    const pageSize = MAX_LIMIT;
    let offset = 0;
    const req = () => getRequest(callForReviews(listingId, pageSize, offset));
    const data = await req();
    data.reviews.forEach((rev) => results.push(camelcaseKeysRecursive(rev)));
    const numberOfHomes = data.metadata.reviews_count;
    const numberOfFetches = numberOfHomes / pageSize;

    for (let i = 0; i < numberOfFetches; i++) {
        offset += pageSize;
        await randomDelay();
        (await req()).reviews.forEach((rev) => results.push(camelcaseKeysRecursive(rev)));
    }
    return results;
}

/**
 * Converts floating geopoint to ~113m precision (3 decimals)
 */
function meterPrecision(value) {
    return +(+`${value}`).toFixed(3);
}

function validateInput(input) {
    const validate = (inputKey, type = 'string') => {
        const value = input[inputKey];
        if (value) {
            if (typeof value !== type) { //eslint-disable-line
                throw new Error(`Value of ${inputKey} should be ${type}`);
            }
        }
    };
    const checkDate = (date) => {
        if (date) {
            const match = moment(date, DATE_FORMAT).format(DATE_FORMAT) === date;
            if (!match) {
                throw new Error(`Date should be in format ${DATE_FORMAT}`);
            }
        }
    };
    // check required field
    if (!input.locationQuery && input.startUrls.length <= 0) {
        throw new Error("At least one of the 'locationQuery' or 'startUrls' should be present.");
    }

    // check correct types
    validate(input.locationQuery, 'string');
    validate(input.minPrice, 'number');
    validate(input.maxPrice, 'number');
    validate(input.maxReviews, 'number');
    validate(input.includeReviews, 'boolean');

    // check date
    checkDate(input.checkIn);
    checkDate(input.checkOut);

    if (input.currency) {
        if (!currencies.find((curr) => curr === input.currency)) {
            throw new Error('Currency should be in ISO format');
        }
    }

    if (input.startUrls) {
        if (!Array.isArray(input.startUrls)) {
            throw new Error('startUrls should be an array');
        }
        input.startUrls.forEach((request) => {
            if (request.url && !request.url.includes('airbnb')) {
                throw new Error('Start url should be an airbnb');
            }
        });
    }
}

async function isMaxListing(maxListings) {
    const state = (await Apify.getValue('STATE')) || { count: 0 };

    return {
        async persistState() {
            await Apify.setValue('STATE', state);
        },
        abortOnMaxItems() {
            if (!maxListings) return false;

            state.count++;

            if (maxListings && state.count >= maxListings) {
                log.info(`Got ${state.count} items, terminating crawl`);
                return true;
            }

            return false;
        },
    };
}

module.exports = {
    addListings,
    pivot,
    getReviews,
    validateInput,
    enqueueDetailLink,
    getSearchLocation,
    isMaxListing,
    meterPrecision,
};
