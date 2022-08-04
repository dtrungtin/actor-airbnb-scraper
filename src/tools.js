const Apify = require('apify');
const moment = require('moment');
const get = require('lodash.get');
const csvToJson = require('csvtojson');
const currencies = require('./currencyCodes.json');

const { utils: { log, requestAsBrowser, sleep } } = Apify;
// log.setLevel(log.LEVELS.DEBUG);
const { callForReviews, getCalendarMonths } = require('./api');
const {
    HISTOGRAM_ITEMS_COUNT,
    MIN_LIMIT,
    MAX_LIMIT,
    DATE_FORMAT,
    URL_WITH_ROOMS_REGEX,
    DEFAULT_LIMIT_POINTS,
    DEFAULT_TIMEOUT_MILLISECONDS,
    DEFAULT_MIN_PRICE,
    DEFAULT_MAX_PRICE,
    DEFAULT_LOCALE,
} = require('./constants');
const { cityToAreas } = require('./mapApi');
const { getLocale } = require('./localization');

/**
 * @param {Apify.Session | null} session
 */
const getRequestFnc = (session, proxy, locale = DEFAULT_LOCALE) => async (url, opts = {}) => {
    const getData = async (attempt = 0) => {
        let response;
        const requestUrl = new URL(url);
        requestUrl.searchParams.set('locale', locale);

        const options = {
            url: requestUrl.toString(),
            headers: {
                'X-Airbnb-API-Key': process.env.API_KEY,
            },
            proxyUrl: proxy.newUrl(session ? session.id : `airbnb_${Math.floor(Math.random() * 100000000)}`),
            abortFunction: (res) => res.statusCode !== 200,
            timeout: {
                request: DEFAULT_TIMEOUT_MILLISECONDS * 10,
            },
            ...opts,
        };

        try {
            log.debug('Requesting', { url: options.url });
            response = await requestAsBrowser(options);
        } catch (e) {
            if (session) {
                session.markBad();
            }
            // log.exception(e.message, 'GetData error');
        }

        const valid = !!response && !!response.body;
        if (valid === false) {
            if (attempt >= 10) {
                if (session) {
                    session.markBad();
                }

                throw new Error(`Could not get data for: ${options.url}`);
            }

            await sleep(5000);

            return getData(attempt + 1);
        }

        try {
            return JSON.parse(response.body);
        } catch (e) {
            await sleep(5000);
            return getData(attempt + 1);
        }
    };

    return getData();
};

const getStartRequestsFromUrl = async (startUrl) => {
    const startRequests = [];

    let sourceUrl = startUrl.requestsFromUrl;
    if (startUrl.requestsFromUrl.includes('/spreadsheets/d/') && !startUrl.requestsFromUrl.includes('/gviz/tq?tqx=out:csv')) {
        const [googlesheetLink] = startUrl.requestsFromUrl.match(/.*\/spreadsheets\/d\/.*\//);
        sourceUrl = `${googlesheetLink}gviz/tq?tqx=out:csv`;
    }
    const response = await requestAsBrowser({ url: sourceUrl, encoding: 'utf8' });
    const rows = await csvToJson({ noheader: true }).fromString(response.body);

    for (const row of rows) {
        startRequests.push({ url: row.field1 });
    }

    return startRequests;
};

const buildStartRequests = async (startUrls) => {
    const startRequests = [];

    for (const startUrl of startUrls) {
        if (startUrl.requestsFromUrl) {
            const startRequestsFromUrl = await getStartRequestsFromUrl(startUrl);
            startRequests.push(...startRequestsFromUrl);
        } else {
            startRequests.push(startUrl);
        }
    }

    return startRequests;
};

const enqueueDetailRequests = async (requestQueue, startUrls, { minPrice, maxPrice }) => {
    const startRequests = await buildStartRequests(startUrls);
    log.info(`Starting with ${startRequests.length} request${startRequests.length !== 1 ? 's' : ''}`);

    const requestList = await Apify.openRequestList('STARTURLS', startRequests);

    let request = await requestList.fetchNextRequest();

    while (request) {
        if (!request.url.match(RegExp(URL_WITH_ROOMS_REGEX)) && !request.url.includes('abnb.me/')) {
            throw new Error(`Provided urls must be AirBnB room urls, got ${request.url}.
                Valid url example: https://www.airbnb.com/rooms/37288141`);
        }

        let url;
        if (request.url.includes('abnb.me')) {
            const response = await requestAsBrowser({ url: request.url, encoding: 'utf8' });
            url = response.request.options.url;
        } else {
            url = new URL(request.url);
        }

        const id = url.pathname.split('/').pop();

        const detailRequest = buildDetailRequest(id, minPrice, maxPrice, request.url, {});
        await requestQueue.addRequest(detailRequest, { forefront: true });

        request = await requestList.fetchNextRequest();
    }
};

const enqueueLocationQueryRequests = async (requestQueue, input, proxy, buildListingUrlFnc) => {
    const {
        locationQuery,
        maxListings,
        minPrice = DEFAULT_MIN_PRICE,
        maxPrice = DEFAULT_MAX_PRICE,
        limitPoints = DEFAULT_LIMIT_POINTS,
        timeoutMs = DEFAULT_TIMEOUT_MILLISECONDS,
    } = input;

    await addListings({ minPrice, maxPrice }, locationQuery, requestQueue, buildListingUrlFnc);

    // Divide location into smaller areas to search more results
    if (!maxListings || maxListings > 1000) {
        const doReq = getRequestFnc(null, proxy);
        const cityQuery = await getSearchLocation({ minPrice, maxPrice }, locationQuery, doReq, buildListingUrlFnc);
        log.info(`Location query: ${cityQuery}`);
        const areaList = await cityToAreas(cityQuery, doReq, limitPoints, timeoutMs);

        if (areaList.length === 0) {
            log.info('Cannot divide location query into smaller areas!');
        } else {
            for (const area of areaList) {
                await addListings({ minPrice, maxPrice }, area, requestQueue, buildListingUrlFnc);
            }
        }
    }
};

/**
 * @param {Array<{ listing: { id: string } }>} results
 * @param {Apify.RequestQueue} requestQueue
 * @param {number} minPrice
 * @param {number} maxPrice
 * @param {string} originalUrl
 */
async function enqueueListingsFromSection(results, requestQueue, minPrice, maxPrice, originalUrl) {
    log.info(`Listings section size: ${results.length}`);

    for (const result of results) {
        const { rate, rate_type: rateType, rate_with_service_fee: rateWithServiceFee } = get(result, ['pricing_quote'], {});

        const detailLink = buildDetailRequest(result.listing.id, minPrice, maxPrice, originalUrl, { rate, rateType, rateWithServiceFee });
        log.debug(`Enquing home with id: ${result.listing.id}`);
        await requestQueue.addRequest(detailLink, { forefront: true });
    }
}

/**
 * @param {string} id
 * @param {Apify.RequestQueue} requestQueue
 * @param {number} minPrice
 * @param {number} maxPrice
 * @param {string} originalUrl
 * @param {any} pricing
 */
function buildDetailRequest(id, minPrice, maxPrice, originalUrl, pricing) {
    const locale = getLocale(originalUrl);

    return {
        url: `https://api.airbnb.com/v2/pdp_listing_details/${id}?_format=for_native`,
        userData: {
            isHomeDetail: true,
            minPrice,
            maxPrice,
            pricing,
            id,
            originalUrl,
            locale,
        },
    };
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
async function getSearchLocation({ minPrice, maxPrice }, location, getRequest, buildListingUrl) {
    const limit = MAX_LIMIT;
    const offset = 0;
    const data = await getRequest(
        buildListingUrl({
            location,
            minPrice,
            maxPrice,
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
async function getListingsSection({ minPrice, maxPrice }, location, requestQueue, getRequest, buildListingUrl) {
    const limit = MAX_LIMIT;
    let offset = 0;
    const request = async () => {
        const url = buildListingUrl({ location, minPrice, maxPrice, limit, offset });
        return { data: await getRequest(url), url };
    };
    const { data, url: firstUrl } = await request();
    // eslint-disable-next-line camelcase
    const { pagination_metadata, sections } = data.explore_tabs[0];
    let listings = findListings(sections);

    if (listings.length) {
        await enqueueListingsFromSection(listings, requestQueue, minPrice, maxPrice, firstUrl);
    }

    let hasNextPage = pagination_metadata.has_next_page;
    log.debug(`Listings metadata: listings: ${listings.length}, hasNextPage: ${hasNextPage}`);

    while (hasNextPage) {
        offset += limit;
        await randomDelay();
        const { data: nextData, url: nextUrl } = await request();
        // eslint-disable-next-line camelcase
        const { pagination_metadata: nextPaginationMetadata, sections: nextSections } = nextData.explore_tabs[0];
        listings = findListings(nextSections);

        if (listings.length) {
            await enqueueListingsFromSection(listings, requestQueue, minPrice, maxPrice, nextUrl);
        }

        hasNextPage = nextPaginationMetadata.has_next_page;
    }
}

/**
 * @param {{ minPrice: number, maxPrice: number }} input
 * @param {number[] | string} query
 * @param {Apify.RequestQueue} requestQueue
 * @param {(...args: any) => string} buildListingUrl
 */
async function addListings({ minPrice, maxPrice }, query, requestQueue, buildListingUrl) {
    const intervalSize = maxPrice / HISTOGRAM_ITEMS_COUNT;
    let pivotStart = minPrice;
    let pivotEnd = intervalSize + minPrice;

    for (let i = 0; i < HISTOGRAM_ITEMS_COUNT; i++) {
        const url = buildListingUrl({
            location: query,
            minPrice: pivotStart,
            maxPrice: pivotEnd,
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

    if (!listingCount || listingCount === 0) {
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
        await getListingsSection({ minPrice: pivotStart, maxPrice: pivotEnd }, query, requestQueue, getRequest, buildListingUrl);
    }
}

const getFormattedUser = (apiUser) => {
    return {
        firstName: apiUser.firstName,
        hasProfilePic: apiUser.userProfilePicture !== {},
        id: apiUser.id,
        pictureUrl: apiUser.pictureUrl,
        smartName: apiUser.hostName,
        thumbnailUrl: apiUser.pictureUrl.replace('profile_x_medium', 'profile_small'),
    };
};

const getFormattedReview = (apiReview) => {
    const {
        reviewer,
        authorId,
        comments,
        createdAt,
        id,
        collectionTag,
        rating,
        reviewee,
        response,
        localizedDate,
    } = apiReview;

    const localizedReview = apiReview.localizedReview || {};
    const { comments: localizedComments, commentsLanguage: language, disclaimer, needsTranslation, response: localizedResponse } = localizedReview;

    return {
        author: getFormattedUser(reviewer),
        authorId,
        comments,
        createdAt,
        id,
        collectionTag,
        rating,
        recipient: getFormattedUser(reviewee),
        response,
        language,
        localizedDate,
        localizedReview: apiReview.localizedReview
            ? { comments: localizedComments, disclaimer, needsTranslation, response: localizedResponse }
            : null,
    };
};

/**
 * @param {string} listingId
 * @param {(...args: any) => Promise<any>} getRequest
 * @param {string} maxReviews
 */
async function getReviews(listingId, getRequest, maxReviews) {
    const results = [];

    try {
        const pageSize = MAX_LIMIT;
        let offset = 0;
        const req = () => getRequest(callForReviews(listingId, pageSize, offset));
        const response = await req();

        const { reviews, metadata } = response.data.merlin.pdpReviews;
        reviews.forEach((rev) => results.push(getFormattedReview(rev)));

        if (results.length >= maxReviews) {
            return results.slice(0, maxReviews);
        }

        const numberOfHomes = metadata.reviews_count;
        const numberOfFetches = numberOfHomes / pageSize;

        for (let i = 0; i < numberOfFetches; i++) {
            offset += pageSize;
            await randomDelay();
            (await req()).reviews.forEach((rev) => results.push(getFormattedReview(rev)));

            if (results.length >= maxReviews) {
                return results.slice(0, maxReviews);
            }
        }
    } catch (e) {
        log.exception(e, 'Could not get reviews');
    }

    return results;
}

async function getCalendar(request, detailId, checkIn, calendarMonths, doReq) {
    const { userData: { originalUrl } } = request;
    const calendarDays = [];

    try {
        const checkInDate = (originalUrl ? new URL(originalUrl, 'https://www.airbnb.com').searchParams.get('check_in') : false)
                || checkIn
                || new Date().toISOString().substring(0, 10);

        log.info(`Requesting calendar for ${checkInDate}`, { url: request.url, id: detailId });
        const { calendar_months: months } = await doReq(getCalendarMonths(detailId, checkInDate, calendarMonths));

        const now = moment(moment().toISOString().split('T')[0]); // today's date without explicit time
        const checkInMoment = moment(checkInDate);

        for (const month of months) {
            for (const day of month.days) {
                const date = moment(day.date);
                if (date.isSameOrAfter(checkInMoment) && date.isSameOrAfter(now)) {
                    // Airbnb stores `availability: false` for all days prior to the current date
                    calendarDays.push(day);
                }
            }
        }
    } catch (e) {
        log.exception(e, 'Error while retrieving calendar', { url: request.url, id: detailId });
    }

    return calendarDays;
}

function calculateOccupancyPercentage(calendarDays) {
    let unavailableDays = 0;

    calendarDays.forEach(({ available }) => {
        if (!available) {
            unavailableDays++;
        }
    });

    const FULLY_OCCUPIED_PERCENTAGE = 100;

    return calendarDays.length > 0
        ? parseFloat(((unavailableDays / calendarDays.length) * 100).toFixed(2))
        : FULLY_OCCUPIED_PERCENTAGE;
}

function makeInputBackwardsCompatible(input) {
    // Deprecated on 2022-4
    if (input.includeCalendar) {
        log.warning('The "includeCalendar" input parameter is deprecated and will be removed in the future. '
            + 'Please use "calendarMonths" in the "input" object instead.');
        input.calendarMonths = 1;
    }
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

function buildPricingParts(priceItems) {
    const pricingMap = {
        ACCOMMODATION: 'accommodation',
        DISCOUNT: 'discount',
        CLEANING_FEE: 'cleaningFee',
        AIRBNB_GUEST_FEE: 'guestFee',
        TAXES: 'taxes',
    };

    const pricingParts = {};

    priceItems.forEach((item) => {
        const pricingField = pricingMap[item.type];
        if (pricingField) {
            const { amount } = item.total;
            pricingParts[pricingField] = amount >= 0 ? amount : amount * -1;
        }
    });

    return pricingParts;
}

function buildPricing(listingBookingDetail) {
    const {
        rate_type: rateType,
        nights,
        price: {
            total: {
                amount: totalPrice,
                currency,
                amount_formatted: totalAmountFormatted,
                is_micros_accuracy: isMicrosAccuracy,
            },
            price_items: priceItems,
        },
    } = listingBookingDetail;

    const amount = Number((totalPrice / nights).toFixed(2));
    const totalPriceFormatted = totalAmountFormatted.replace(/\u00a0+/g, ' ');

    const pricing = {
        rate: {
            // both `amount` and `amountFormatted` values depend on the current proxy
            amount,
            amountFormatted: totalPriceFormatted.replace(/(\d+[ ,]+\d+)+/, amount),
            currency,
            isMicrosAccuracy,
        },
        rateType,
        nights,
        totalPrice: {
            amount: totalPrice,
            amountFormatted: totalPriceFormatted,
            ...buildPricingParts(priceItems),
            currency,
        },
    };

    return pricing;
}

module.exports = {
    getRequestFnc,
    enqueueDetailRequests,
    enqueueLocationQueryRequests,
    addListings,
    pivot,
    getReviews,
    getCalendar,
    calculateOccupancyPercentage,
    validateInput,
    buildDetailRequest,
    getSearchLocation,
    isMaxListing,
    makeInputBackwardsCompatible,
    buildPricing,
};
