/* eslint-disable camelcase */
const Apify = require('apify');
const camelcaseKeysRecursive = require('camelcase-keys-recursive');

const { utils: { log } } = Apify;
const {
    pivot,
    getReviews,
    validateInput,
    isMaxListing,
    makeInputBackwardsCompatible,
    getRequestFnc,
    enqueueDetailRequests,
    enqueueLocationQueryRequests,
} = require('./tools');
const { getBuildListingUrlFnc, getCalendarMonths, bookingDetailsUrl, callForHostInfo } = require('./api');
const {
    DEFAULT_MAX_PRICE,
    DEFAULT_MIN_PRICE,
    DEFAULT_MAX_REVIEWS,
    DEFAULT_CALENDAR_MONTHS,
    MAX_CONCURRENCY,
    HANDLE_REQUEST_TIMEOUT_SECS,
    MAX_KEY_LENGTH,
    DEFAULT_LOCALE,
} = require('./constants');

Apify.main(async () => {
    const input = await Apify.getInput();

    makeInputBackwardsCompatible(input);
    validateInput(input);

    const {
        simple = true,
        currency,
        locationQuery,
        minPrice = DEFAULT_MIN_PRICE,
        maxPrice = DEFAULT_MAX_PRICE,
        maxConcurrency = MAX_CONCURRENCY,
        checkIn,
        checkOut,
        startUrls = [],
        proxyConfiguration,
        includeReviews = true,
        maxReviews = DEFAULT_MAX_REVIEWS,
        maxListings,
        calendarMonths = DEFAULT_CALENDAR_MONTHS,
        addMoreHostInfo = false,
        debugLog = false,
        valuePairs,
    } = input;

    if (debugLog) {
        log.setLevel(log.LEVELS.DEBUG);
    }

    const proxy = await Apify.createProxyConfiguration(proxyConfiguration);
    if (Apify.isAtHome() && !proxy) {
        throw new Error('WRONG INPUT: This actor must use Apify proxy or custom proxies when running on Apify platform!');
    }

    const { abortOnMaxItems, persistState } = await isMaxListing(maxListings);
    Apify.events.on('persistState', persistState);

    const requestQueue = await Apify.openRequestQueue();
    const buildListingUrlFnc = getBuildListingUrlFnc({ checkIn, checkOut, currency });

    if (startUrls.length > 0) {
        log.info('"startUrls" is being used, the search will be ignored');
        await enqueueDetailRequests(requestQueue, startUrls, { minPrice, maxPrice });
    } else {
        log.info(`"startUrls" isn't being used, will search now for "${locationQuery}"...`);
        await enqueueLocationQueryRequests(requestQueue, input, proxy, buildListingUrlFnc);
    }

    const crawler = new Apify.BasicCrawler({
        requestQueue,
        maxConcurrency,
        handleRequestTimeoutSecs: HANDLE_REQUEST_TIMEOUT_SECS,
        useSessionPool: true,
        handleRequestFunction: async ({ request, session }) => {
            const { isHomeDetail, isPivoting, locale = DEFAULT_LOCALE } = request.userData;

            const doReq = getRequestFnc(session, proxy, locale);

            if (isPivoting) {
                await pivot(request, requestQueue, doReq, buildListingUrlFnc);
            } else if (isHomeDetail) {
                const json = await doReq(request.url);
                const { pdp_listing_detail: detail } = json;

                // checking for no longer available details
                if (!detail && json.error_message === 'Unfortunately, this is no longer available.') {
                    return log.warning('Home detail is no longer available.', { url: request.url });
                }

                if (!detail) {
                    const requestUrl = new URL(request.url);
                    const requestKey = `${requestUrl.host}${requestUrl.pathname}`
                        .substring(0, MAX_KEY_LENGTH)
                        .replaceAll('/', '-'); // '/' is not allowed in key name
                    await Apify.setValue(`failed_${requestKey}`, json);
                    throw new Error(`Unable to get details. Please, check key-value store to see the response. ${request.url}`);
                }

                log.info(`Saving home detail - ${detail.id}`);

                detail.reviews = includeReviews ? await getReviews(request.userData.id, doReq, maxReviews) : [];

                const result = camelcaseKeysRecursive(detail);
                const { locationTitle, starRating, guestLabel, p3SummaryTitle, lat, lng, roomAndPropertyType, reviews } = result;
                const { originalUrl } = request.userData;
                const simpleResult = {
                    url: originalUrl || `https://www.airbnb.com/rooms/${detail.id}`, // prefers localized original url if provided
                    name: p3SummaryTitle,
                    stars: starRating,
                    numberOfGuests: parseInt(guestLabel.match(/\d+/)[0], 10),
                    address: locationTitle,
                    roomType: roomAndPropertyType,
                    location: {
                        lat,
                        lng,
                    },
                    reviews,
                    pricing: {},
                    valuePairs,
                };

                if (request.userData.pricing && request.userData.pricing.rate) {
                    simpleResult.pricing = request.userData.pricing;
                } else {
                    let pricingDetailsUrl = null;
                    try {
                        const checkInDate = (originalUrl ? new URL(originalUrl, 'https://www.airbnb.com').searchParams.get('check_in') : false)
                                || checkIn || null;
                        const checkOutDate = (originalUrl ? new URL(originalUrl, 'https://www.airbnb.com').searchParams.get('check_out') : false)
                                || checkOut || null;

                        if (checkInDate && checkOutDate) {
                            pricingDetailsUrl = bookingDetailsUrl(detail.id, checkInDate, checkOutDate);
                            log.info(`Requesting pricing details from ${checkInDate} to ${checkOutDate}`,
                                { url: pricingDetailsUrl, id: detail.id });
                            const pricingResult = await doReq(pricingDetailsUrl);
                            const { pdp_listing_booking_details } = pricingResult;
                            const { available, rate_type: rateType, base_price_breakdown } = pdp_listing_booking_details[0];
                            const { amount, amount_formatted: amountFormatted, is_micros_accuracy: isMicrosAccuracy } = base_price_breakdown[0];

                            if (available) {
                                simpleResult.pricing = {
                                    rate: {
                                        amount,
                                        amountFormatted,
                                        currency: base_price_breakdown[0].currency,
                                        isMicrosAccuracy,
                                    },
                                    rateType,
                                    rateWithServiceFee: {
                                        amount,
                                        amountFormatted,
                                        currency: base_price_breakdown[0].currency,
                                        isMicrosAccuracy,
                                    },
                                };
                            }
                        }
                    } catch (e) {
                        log.exception(e, 'Error while retrieving pricing details', { url: pricingDetailsUrl, id: detail.id });
                    }
                }

                if (calendarMonths > 0) {
                    try {
                        const checkInDate = (originalUrl ? new URL(originalUrl, 'https://www.airbnb.com').searchParams.get('check_in') : false)
                                || checkIn
                                || new Date().toISOString().substring(0, 10);
                        log.info(`Requesting calendar for ${checkInDate}`, { url: request.url, id: detail.id });
                        const { calendar_months } = await doReq(getCalendarMonths(detail.id, checkInDate, calendarMonths));
                        const calendarDays = [];
                        for (const month of calendar_months) {
                            for (const day of month.days) {
                                calendarDays.push(day);
                            }
                        }
                        simpleResult.calendar = calendarDays;
                    } catch (e) {
                        log.exception(e, 'Error while retrieving calendar', { url: request.url, id: detail.id });
                    }
                }

                if (addMoreHostInfo && result.primaryHost) {
                    try {
                        const { user: { listings_count, total_listings_count } } = await doReq(callForHostInfo(result.primaryHost.id));
                        result.primaryHost.hostUrl = `https://www.airbnb.com.vn/users/show/${result.primaryHost.id}`;
                        result.primaryHost.listingsCount = listings_count;
                        result.primaryHost.totalListingsCount = total_listings_count;
                    } catch (e) {
                        log.exception(e, 'Error while retrieving host info', { url: request.url, id: result.primaryHost.id });
                    }
                }

                const isAbort = abortOnMaxItems();

                if (!isAbort) {
                    if (simple) {
                        await Apify.pushData(simpleResult);
                    } else {
                        const newResult = {
                            ...simpleResult,
                            ...result,
                            locationTitle: undefined,
                            starRating: undefined,
                            guestLabel: undefined,
                            p3SummaryTitle: undefined,
                            lat: undefined,
                            lng: undefined,
                            roomAndPropertyType: undefined,
                        };

                        await Apify.pushData(newResult);
                    }
                } else {
                    await crawler.autoscaledPool.abort();
                }
            }
        },

        handleFailedRequestFunction: async ({ request }) => {
            log.warning(`Request ${request.url} failed too many times`);
            await Apify.pushData({
                '#debug': Apify.utils.createRequestDebugInfo(request),
            });
        },
    });

    await crawler.run();
    await persistState();

    log.info('Crawler finished.');
});
