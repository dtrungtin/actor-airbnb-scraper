const querystring = require('querystring');
const { DEFAULT_MIN_PRICE, DEFAULT_MAX_PRICE } = require('./constants');

function buildListingUrl(location, priceMin = DEFAULT_MIN_PRICE, priceMax = DEFAULT_MAX_PRICE, limit = 20, offset = 0, checkIn, checkOut) {
    let queryString = {};

    if (Array.isArray(location)) {
        // eslint-disable-next-line camelcase
        const sw_lat = location[0];
        // eslint-disable-next-line camelcase
        const sw_lng = location[2];
        // eslint-disable-next-line camelcase
        const ne_lat = location[1];
        // eslint-disable-next-line camelcase
        const ne_lng = location[3];

        queryString = {
            search_by_map: true,
            ne_lat,
            ne_lng,
            sw_lat,
            sw_lng,
            price_min: priceMin,
            price_max: priceMax,
            items_per_grid: limit,
            items_offset: offset,
            'refinement_paths[]': '/homes',
        };
    } else {
        queryString = {
            query: location,
            price_min: priceMin,
            price_max: priceMax,
            items_per_grid: limit,
            items_offset: offset,
            'refinement_paths[]': '/homes',
        };
    }

    queryString.key = 'd306zoyjsyarp7ifhu67rjxn52tv0t20';

    if (checkIn) {
        queryString.checkin = checkIn;
    }

    if (checkOut) {
        queryString.checkout = checkOut;
    }

    return `https://api.airbnb.com/v2/explore_tabs?${querystring.stringify(queryString)}`;
}

function getHomeListings(location, getRequest, priceMin = DEFAULT_MIN_PRICE, priceMax = DEFAULT_MAX_PRICE,
    limit = 20, offset = 0, checkIn, checkOut) {
    const url = buildListingUrl(location, priceMin, priceMax, limit, offset, checkIn, checkOut);
    return getRequest(url);
}

function callForReviews(listingId, getRequest, limit = 50, offset = 0) {
    const queryString = {
        _order: 'language_country',
        _limit: limit,
        _offset: offset,
        _format: 'for_mobile_client',
        role: 'all',
        listing_id: listingId,
    };
    return getRequest(
        `https://api.airbnb.com/v2/reviews?${querystring.stringify(queryString)}`,
    );
}

module.exports = {
    getHomeListings,
    callForReviews,
    buildListingUrl,
};
