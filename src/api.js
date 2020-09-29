const querystring = require('querystring');
const { DEFAULT_MIN_PRICE, DEFAULT_MAX_PRICE } = require('./constants');

/**
 * @param {{
 * location: (number[] | string),
 * minPrice: number,
 * maxPrice: number,
 * limit: number,
 * offset: number,
 * checkIn: string,
 * checkOut: string,
 * currency: string,
 * }} params
 */
function buildListingUrl({
    location,
    minPrice = DEFAULT_MIN_PRICE,
    maxPrice = DEFAULT_MAX_PRICE,
    limit = 20,
    offset = 0,
    checkIn,
    checkOut,
    currency = 'USD',
}) {
    const url = new URL('https://api.airbnb.com/v2/explore_tabs');

    if (Array.isArray(location)) {
        // eslint-disable-next-line camelcase
        const sw_lat = location[0];
        // eslint-disable-next-line camelcase
        const sw_lng = location[2];
        // eslint-disable-next-line camelcase
        const ne_lat = location[1];
        // eslint-disable-next-line camelcase
        const ne_lng = location[3];

        url.searchParams.set('search_by_map', 'true');
        url.searchParams.set('ne_lat', `${ne_lat}`);
        url.searchParams.set('ne_lng', `${ne_lng}`);
        url.searchParams.set('sw_lat', `${sw_lat}`);
        url.searchParams.set('sw_lng', `${sw_lng}`);
    } else {
        url.searchParams.set('query', location);
    }

    url.searchParams.set('price_min', `${minPrice}`);
    url.searchParams.set('price_max', `${maxPrice}`);
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
}

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

module.exports = {
    callForReviews,
    buildListingUrl,
};
