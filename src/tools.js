const Apify = require('apify');
const camelcaseKeysRecursive = require('camelcase-keys-recursive');
const moment = require('moment');
const get = require('lodash.get');
const currencies = require('./currencyCodes.json');

const { utils: { log } } = Apify;
// log.setLevel(log.LEVELS.DEBUG);
const { callForReviews } = require('./api');
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
 * @param {number} adults
 * @param {number} children
 * @param {number} infants
 * @param {number} pets
 * @param {string} originalUrl
 */
async function enqueueListingsFromSection(results, requestQueue, minPrice, maxPrice, adults, children, infants, pets, originalUrl) {
    log.info(`Listings section size: ${results.length}`);
    log.info(JSON.stringify(results[0]));
    for (const l of results) {
        const { rate, rate_type, rate_with_service_fee, total_price } = get(l, ['pricing_quote'], {});
        await enqueueDetailLink(l.listing.id, requestQueue, minPrice, maxPrice, adults, children, infants, pets, originalUrl, { rate, rate_type, rate_with_service_fee, total_price });
    }
}

/**
 * @param {string} id
 * @param {Apify.RequestQueue} requestQueue
 * @param {number} minPrice
 * @param {number} maxPrice
 * @param {number} adults
 * @param {number} children
 * @param {number} infants
 * @param {number} pets
 * @param {string} originalUrl
 * @param {any} pricing
 */
function enqueueDetailLink(id, requestQueue, minPrice, maxPrice, adults, children, infants, pets, originalUrl, pricing) {
    log.debug(`Enquing home with id: ${id}`);

    return requestQueue.addRequest({
        url: `https://api.airbnb.com/v2/pdp_listing_details/${id}?_format=for_native`,
        userData: {
            isHomeDetail: true,
            minPrice,
            maxPrice,
            adults,
            children,
            infants,
            pets,
            pricing,
            id,
            originalUrl,
        },
    });
}

function randomDelay(minimum = 100, maximum = 200) {
    const min = Math.ceil(minimum);
    const max = Math.floor(maximum);
    return Apify.utils.sleep(Math.floor(Math.random() * (max - min + 1)) + min);
}

/**
 * @param {{ minPrice: number, maxPrice: number }} input
 * @param {number[] | string} location
 * @param {(...args: any) => Promise<any>} getRequest
 * @param {(...args: any) => string} buildListingUrl
 */
async function getSearchLocation({ minPrice, maxPrice }, adults, children, infants, pets, location, getRequest, buildListingUrl) {
    const limit = MAX_LIMIT;
    const offset = 0;
    const data = await getRequest(
        buildListingUrl({
            location,
            minPrice,
            maxPrice,
            adults,
            children,
            infants,
            pets,
            limit,
            offset,
        }),
    );
    const { query } = data.metadata;
    const { home_tab_metadata: { search } } = data.explore_tabs[0];
    log.info(`Currency query: ${search.native_currency}`);

    return query;
}

/**
 * @param {Array<{ result_type: string, listings: any[] }>} sections
 */
function findListings(sections) {
    for (let index = 0; index < sections.length; index++) {
        const section = sections[index];

        if (section.result_type === 'listings' && section.listings && section.listings.length > 0) {
            // eslint-disable-next-line prefer-destructuring
            return section.listings;
        }
    }

    return [];
}

/**
 * @param {{ minPrice: number, maxPrice: number }} input
 * @param {number[] | string} location
 * @param {Apify.RequestQueue} requestQueue
 * @param {(...args: any) => Promise<any>} getRequest
 * @param {(...args: any) => string} buildListingUrl
 */
async function getListingsSection({ minPrice, maxPrice }, adults, children, infants, pets, location, requestQueue, getRequest, buildListingUrl) {
    const limit = MAX_LIMIT;
    let offset = 0;
    const request = async () => {
        const url = buildListingUrl({ location, minPrice, maxPrice, adults, children, infants, pets, limit, offset });
        return { data: await getRequest(url), url };
    };
    const { data, url: firstUrl } = await request();
    // eslint-disable-next-line camelcase
    const { pagination_metadata, sections } = data.explore_tabs[0];
    let listings = findListings(sections);

    if (listings.length) {
        await enqueueListingsFromSection(listings, requestQueue, minPrice, maxPrice, adults, children, infants, pets, firstUrl);
    }

    let hasNextPage = pagination_metadata.has_next_page;
    log.debug(`Listings metadata: listings: ${listings.length}, hasNextPage: ${hasNextPage}`);

    while (hasNextPage) {
        offset += limit;
        await randomDelay();
        const { data: nextData, url: nextUrl } = await request();
        // eslint-disable-next-line camelcase
        const { pagination_metadata, sections } = nextData.explore_tabs[0];
        listings = findListings(sections);

        if (listings.length) {
            await enqueueListingsFromSection(listings, requestQueue, minPrice, maxPrice, adults, children, infants, pets, nextUrl);
        }

        hasNextPage = pagination_metadata.has_next_page;
    }
}

/**
 * @param {{ minPrice: number, maxPrice: number }} input
 * @param {number} adults
 * @param {number} children
 * @param {number} infants
 * @param {number} pets
 * @param {number[] | string} query
 * @param {Apify.RequestQueue} requestQueue
 * @param {(...args: any) => string} buildListingUrl
 */
async function addListings({ minPrice, maxPrice }, adults, children, infants, pets, query, requestQueue, buildListingUrl) {
    const intervalSize = maxPrice / HISTOGRAM_ITEMS_COUNT;
    let pivotStart = minPrice;
    let pivotEnd = intervalSize + minPrice;

    for (let i = 0; i < HISTOGRAM_ITEMS_COUNT; i++) {
        const url = buildListingUrl({
            location: query,
            minPrice: pivotStart,
            maxPrice: pivotEnd,
            adults,
            children,
            infants,
            pets,
            limit: MIN_LIMIT,
            offset: 0,
        });

        log.debug(`Adding initial pivoting url: ${url}`);

        await requestQueue.addRequest({
            url,
            userData: {
                isPivoting: true,
                pivotStart,
                pivotEnd,
                adults,
                children,
                infants,
                pets,
                query,
            },
        });

        pivotStart += intervalSize;
        pivotEnd += intervalSize;

        if (pivotEnd > maxPrice) {
            // stop early
            break;
        }
    }
}

/**
 * @param {Apify.Request} request
 * @param {Apify.RequestQueue} requestQueue
 * @param {(...args: any) => Promise<any>} getRequest
 * @param {(...args: any) => string} buildListingUrl
 */
async function pivot(request, requestQueue, getRequest, buildListingUrl) {
    const { pivotStart, pivotEnd, adults, children, infants, pets, query } = request.userData;
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

    if (!listingCount || listingCount === 0) {
        return;
    }

    if (listingCount > 1000 && (pivotEnd - pivotStart > 1)) {
        const intervalMiddle = Math.ceil((pivotEnd + pivotStart) / 2);

        const firstHalfUrl = buildListingUrl({
            location: query,
            minPrice: pivotStart,
            maxPrice: intervalMiddle,
            adults,
            children,
            infants,
            pets,
            limit: MIN_LIMIT,
            offset: 0,
        });
        log.debug(`First half url: ${firstHalfUrl}`);

        await requestQueue.addRequest({
            url: firstHalfUrl,
            userData: {
                pivotStart,
                pivotEnd: intervalMiddle,
                adults,
                children,
                infants,
                pets,
                isPivoting: true,
                query,
            },
        });

        const secondHalfUrl = buildListingUrl({
            location: query,
            minPrice: intervalMiddle,
            maxPrice: pivotEnd,
            adults,
            children,
            infants,
            pets,
            limit: MIN_LIMIT,
            offset: 0,
        });
        log.debug(`Second half url: ${secondHalfUrl}`);

        await requestQueue.addRequest({
            url: secondHalfUrl,
            userData: {
                pivotStart: intervalMiddle,
                pivotEnd,
                adults,
                children,
                infants,
                pets,
                isPivoting: true,
                query,
            } });
    } else {
        log.info(`Getting listings for start: ${pivotStart} end: ${pivotEnd}`);
        await getListingsSection({ minPrice: pivotStart, maxPrice: pivotEnd }, adults, children, infants, pets, query, requestQueue, getRequest, buildListingUrl);
    }
}

/**
 * @param {string} listingId
 * @param {(...args: any) => Promise<any>} getRequest
 * @param {string} maxReviews
 */
async function getReviews(listingId, getRequest, maxReviews) {
    const results = [];
    const pageSize = MAX_LIMIT;
    let offset = 0;
    const req = () => getRequest(callForReviews(listingId, pageSize, offset));
    const data = await req();
    data.reviews.forEach(rev => results.push(camelcaseKeysRecursive(rev)));

    const numberOfHomes = data.metadata.reviews_count;
    const numberOfFetches = numberOfHomes / pageSize;

    if ('number' !== typeof maxReviews) {
        maxReviews = numberOfHomes;
    }

    if (results.length >= maxReviews) {
        return results.slice(0, maxReviews);
    }

    for (let i = 0; i < numberOfFetches; i++) {
        offset += pageSize;
        await randomDelay();
        (await req()).reviews.forEach(rev => results.push(camelcaseKeysRecursive(rev)));

        if (results.length >= maxReviews) {
            return results.slice(0, maxReviews);
        }
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
    validate(input.minPrice, 'number');
    validate(input.maxPrice, 'number');
    validate(input.adults, 'number');
    validate(input.children, 'number');
    validate(input.infants, 'number');
    validate(input.pets, 'number');
    validate(input.maxReviews, 'number');
    validate(input.includeReviews, 'boolean');
    validate(input.includeCalendar, 'boolean');
    validate(input.debugLog, 'boolean');

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
            if (request.url && !request.url.includes('airbnb') && !request.url.includes('abnb.me')) {
                throw new Error('Start url should be an airbnb');
            }
        });
    }
}

/**
 * Keeps count state in the KV
 *
 * @param {number} maxListings
 */
async function isMaxListing(maxListings) {
    const state = (await Apify.getValue('STATE')) || { count: 0 };

    return {
        async persistState() {
            await Apify.setValue('STATE', state);
        },
        abortOnMaxItems() {
            if (!maxListings) return false;

            state.count++;

            if (maxListings && state.count > maxListings) {
                log.info(`Got ${maxListings} items, terminating crawl`);
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
