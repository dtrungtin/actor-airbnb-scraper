const moment = require('moment');
const { DEFAULT_MIN_PRICE, DEFAULT_MAX_PRICE, SHA_256_HASH } = require('./constants');

/**
 * @param {{
 *   checkIn: string,
 *   checkOut: string,
 *   currency: string,
 * }} params
 */
const getBuildListingUrlFnc = ({
    checkIn,
    checkOut,
    currency = 'USD',
}) => {
    /**
     * @param {{
     * location: (number[] | string),
     * minPrice: number,
     * maxPrice: number,
     * limit: number,
     * offset: number,
     * }} params
     */
    const fn = ({
        location,
        minPrice = DEFAULT_MIN_PRICE,
        maxPrice = DEFAULT_MAX_PRICE,
        limit = 20,
        offset = 0,
    }) => {
        const url = new URL('https://api.airbnb.com/v2/explore_tabs');

        if (Array.isArray(location)) {
            /* eslint-disable camelcase */
            const sw_lat = location[0];
            const sw_lng = location[2];
            const ne_lat = location[1];
            const ne_lng = location[3];

            url.searchParams.set('search_by_map', 'true');
            url.searchParams.set('ne_lat', `${ne_lat}`);
            url.searchParams.set('ne_lng', `${ne_lng}`);
            url.searchParams.set('sw_lat', `${sw_lat}`);
            url.searchParams.set('sw_lng', `${sw_lng}`);
        } else {
            url.searchParams.set('query', location);
        }

        if (typeof minPrice === 'number' && minPrice <= maxPrice) {
            url.searchParams.set('price_min', `${minPrice}`);
        }

        if (typeof maxPrice === 'number' && maxPrice >= minPrice) {
            url.searchParams.set('price_max', `${maxPrice}`);
        }

        url.searchParams.set('items_per_grid', `${limit}`);
        url.searchParams.set('items_offset', `${offset}`);
        url.searchParams.set('refinement_paths[]', '/homes');
        url.searchParams.set('key', process.env.API_KEY);
        url.searchParams.set('currency', currency);

        if (checkIn) {
            url.searchParams.set('checkin', checkIn);
        }

        if (checkOut) {
            url.searchParams.set('checkout', checkOut);
        }

        return url.toString();
    };

    return fn;
};

function callForReviews(listingId, limit = 50, offset = 0) {
    const reviewsUrlParams = new URLSearchParams({
        operationName: 'PdpReviews',
        variables: JSON.stringify({
            request: { fieldSelector: 'for_p3_translation_only', limit, offset, listingId },
        }),
        extensions: JSON.stringify({
            persistedQuery: { version: 1, sha256Hash: SHA_256_HASH },
        }),
    });
    return `https://www.airbnb.com/api/v3/PdpReviews?${reviewsUrlParams.toString()}`;
}

/**
 * @param {string} listingId
 * @param {string} checkIn
 */
function getCalendarMonths(listingId, checkIn, months) {
    const date = moment(checkIn);

    const calendarUrlParams = new URLSearchParams({
        listing_id: listingId,
        month: date.get('month') + 1,
        year: date.get('year'),
        count: months,
    });
    return `https://api.airbnb.com/v2/calendar_months?${calendarUrlParams.toString()}`;
}

/**
 * @param {string} listingId
 * @param {string} checkIn
 * @param {string} checkOut
 */
function bookingDetailsUrl(listingId, checkIn, checkOut, currency) {
    const bookingDetailsUrlParams = new URLSearchParams({
        check_in: checkIn,
        check_out: checkOut,
        _format: 'for_web_with_date',
        listing_id: listingId,
        currency,
    });

    return `https://api.airbnb.com/v2/pdp_listing_booking_details?${bookingDetailsUrlParams.toString()}`;
}

/**
 * @param {string} hostId
 */
function callForHostInfo(hostId) {
    return `https://api.airbnb.com/v2/users/${hostId}`;
}

module.exports = {
    callForReviews,
    getBuildListingUrlFnc,
    getCalendarMonths,
    bookingDetailsUrl,
    callForHostInfo,
};
