const DEFAULT_MAX_PRICE = 1000000;
const DEFAULT_MIN_PRICE = 0;
const DEFAULT_MAX_REVIEWS = 10;
const DEFAULT_CALENDAR_MONTHS = 0;
const DEFAULT_LIMIT_POINTS = 1000;
const DEFAULT_TIMEOUT_MILLISECONDS = 60000;
const DEFAULT_LOCALE = 'en';
const HISTOGRAM_ITEMS_COUNT = 10;
const MIN_LIMIT = 20;
const MAX_LIMIT = 50;
const MAX_CONCURRENCY = 50;
const HANDLE_REQUEST_TIMEOUT_SECS = 180;
const DATE_FORMAT = 'YYYY-MM-DD';
const DISTANCE_METERS = 1000;
const URL_WITH_ROOMS_REGEX = /airbnb\.(.)+\/rooms/gi;

/**
 * Matches end of the domain from url formats:
 * https://airbnb.cz/rooms/37288141 (domain = cz),
 * https://www.airbnb.co.id/rooms/37288141 (domain = id),
 * https://www.airbnb.com.ar/rooms/37288141 (domain = ar)
 */
const URL_DOMAIN_REGEX = /airbnb(?:\.[a-z]{2,3})?\.([a-z]{2})\//gi;

/**
 * Matches locale from url format: https://cs.airbnb.com/rooms/37288141 (locale = cs).
 * Ignores www.airbnb or api.airbnb (www nor api should be considered locale).
 */
const URL_LOCALE_PREFIX_REGEX = /\/\/(?:w{3})?(?:api)?([a-z]{2})\.airbnb/gi;

const MAX_KEY_LENGTH = 256;
const SHA_256_HASH = 'ecf7222b1ad7e13da1bf39cf3cf05daa6bbc88709f06ea9cf669deca7e2e2de2';

module.exports = {
    MAX_LIMIT,
    MAX_CONCURRENCY,
    DEFAULT_MAX_PRICE,
    DEFAULT_MIN_PRICE,
    DEFAULT_MAX_REVIEWS,
    DEFAULT_CALENDAR_MONTHS,
    DEFAULT_LIMIT_POINTS,
    DEFAULT_TIMEOUT_MILLISECONDS,
    DEFAULT_LOCALE,
    HANDLE_REQUEST_TIMEOUT_SECS,
    HISTOGRAM_ITEMS_COUNT,
    DATE_FORMAT,
    MIN_LIMIT,
    DISTANCE_METERS,
    URL_WITH_ROOMS_REGEX,
    URL_LOCALE_PREFIX_REGEX,
    URL_DOMAIN_REGEX,
    MAX_KEY_LENGTH,
    SHA_256_HASH,
};
