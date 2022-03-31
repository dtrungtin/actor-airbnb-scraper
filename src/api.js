const querystring = require('querystring');
const moment = require('moment');
const { DEFAULT_MIN_PRICE, DEFAULT_MAX_PRICE } = require('./constants');
const { parseLocationInput } = require('./tools');

/**
 * @param {{
 *   checkIn: string,
 *   checkOut: string,
 *   currency: string,
 * }} params
 */
const getBuildListingUrl = ({
    checkIn,
    checkOut,
    currency = 'USD',
}) => {
    /**
     * @param {{
     * location: (number[] | string),
     * minPrice: number,
     * maxPrice: number,
     * adults: number,
     * children: number,
     * children: number,
     * infants: number,
     * limit: number,
     * offset: number,
     * }} params
     */
    const fn = ({
        location,
        minPrice = DEFAULT_MIN_PRICE,
        maxPrice = DEFAULT_MAX_PRICE,
        adults = 0,
        children = 0,
        infants = 0,
        pets = 0,
        limit = 20,
        offset = 0,
    }) => {
        const url = new URL('https://api.airbnb.com/v2/explore_tabs');

        location = parseLocationInput(location);
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

        if (typeof minPrice === 'number' && minPrice < maxPrice) {
            url.searchParams.set('price_min', `${minPrice}`);
        }

        if (typeof maxPrice === 'number' && maxPrice > minPrice) {
            url.searchParams.set('price_max', `${maxPrice}`);
        }

        if (typeof adults === 'number' && adults > 0) {
            url.searchParams.set('adults', `${adults}`);
        }

        if (typeof children === 'number' && children > 0) {
            url.searchParams.set('children', `${children}`);
        }

        if (typeof infants === 'number' && infants > 0) {
            url.searchParams.set('infants', `${infants}`);
        }

        if (typeof pets === 'number' && pets > 0) {
            url.searchParams.set('pets', `${pets}`);
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
    const queryString = {
        _order: 'language_country',
        _limit: limit,
        _offset: offset,
        _format: 'for_mobile_client',
        role: 'all',
        listing_id: listingId,
    };
    return `https://api.airbnb.com/v2/reviews?${querystring.stringify(queryString)}`;
}

/**
 * @param {string} listingId
 * @param {string} checkIn
 */
function calendarMonths(listingId, checkIn) {
    const date = moment(checkIn);

    return `https://www.airbnb.cz/api/v3/PdpAvailabilityCalendar?${querystring.stringify({
        operationName: 'PdpAvailabilityCalendar',
        variables: JSON.stringify({
            request: {
                count: 12,
                listingId,
                month: date.get('month') + 1,
                year: date.get('year'),
            },
        }),
        extensions: JSON.stringify({
            persistedQuery: {
                version: 1,
                sha256Hash: '8f08e03c7bd16fcad3c92a3592c19a8b559a0d0855a84028d1163d4733ed9ade',
            },
        }),
    })}`;
}

/**
 * @param {string} listingId
 * @param {string} checkIn
 * @param {string} checkOut
 */
function bookingDetailsUrl(listingId, checkIn, checkOut) {
    const queryString = {
        check_in: checkIn,
        check_out: checkOut,
        _format: 'for_web_with_date',
        listing_id: listingId,
    };

    return `https://api.airbnb.com/v2/pdp_listing_booking_details?${querystring.stringify(queryString)}`;
}

/**
 * @param {string} hostId
 */
function callForHostInfo(hostId) {
    return `https://api.airbnb.com/v2/users/${hostId}`;
}

module.exports = {
    callForReviews,
    getBuildListingUrl,
    calendarMonths,
    bookingDetailsUrl,
    callForHostInfo,
};
