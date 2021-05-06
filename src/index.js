const Apify = require('apify');
const camelcaseKeysRecursive = require('camelcase-keys-recursive');
const csvToJson = require('csvtojson');

const { utils: { log, requestAsBrowser, sleep } } = Apify;
const { addListings, pivot, getReviews, validateInput, enqueueDetailLink, getSearchLocation, isMaxListing } = require('./tools');
const { getBuildListingUrl, calendarMonths } = require('./api');
const { cityToAreas } = require('./mapApi');
const { DEFAULT_MAX_PRICE, DEFAULT_MIN_PRICE } = require('./constants');

Apify.main(async () => {
    const input = await Apify.getInput();

    validateInput(input);

    const {
        simple = true,
        currency,
        locationQuery,
        minPrice = DEFAULT_MIN_PRICE,
        maxPrice = DEFAULT_MAX_PRICE,
        maxConcurrency = 50,
        checkIn,
        checkOut,
        startUrls,
        proxyConfiguration,
        includeReviews = true,
        maxReviews = 10,
        maxListings,
        includeCalendar = false,
        debugLog = false,
        limitPoints = 1000,
        timeoutMs = 60000,
    } = input;

    if (debugLog) {
        log.setLevel(log.LEVELS.DEBUG);
    }

    const proxy = await Apify.createProxyConfiguration({
        ...proxyConfiguration,
    });

    const { abortOnMaxItems, persistState } = await isMaxListing(maxListings);
    Apify.events.on('persistState', persistState);

    const buildListingUrl = getBuildListingUrl({ checkIn, checkOut, currency });

    /**
     * @param {Apify.Session | null} session
     */
    const getRequest = session => async (url, opts = {}) => {
        const getData = async (attempt = 0) => {
            let response;

            const options = {
                url,
                json: false,
                headers: {
                    'X-Airbnb-API-Key': process.env.API_KEY,
                },
                proxyUrl: proxy.newUrl(session ? session.id : `airbnb_${Math.floor(Math.random() * 100000000)}`),
                abortFunction: (res) => {
                    const { statusCode } = res;
                    return statusCode !== 200;
                },
                timeoutSecs: 600,
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

            return JSON.parse(response.body);
        };

        return getData();
    };

    const requestQueue = await Apify.openRequestQueue();

    if (startUrls && startUrls.length > 0) {
        log.info('"startUrls" is being used, the search will be ignored');

        const startUrlList = [];
        for (let index = 0; index < startUrls.length; index++) {
            const item = startUrls[index];
            if (item.requestsFromUrl) {
                let sourceUrl = item.requestsFromUrl;
                if (item.requestsFromUrl.includes('/spreadsheets/d/') && !item.requestsFromUrl.includes('/gviz/tq?tqx=out:csv')) {
                    const [googlesheetLink] = item.requestsFromUrl.match(/.*\/spreadsheets\/d\/.*\//);
                    sourceUrl = `${googlesheetLink}gviz/tq?tqx=out:csv`;
                }
                const response = await requestAsBrowser({ url: sourceUrl, encoding: 'utf8' });
                const rows = await csvToJson({ noheader: true }).fromString(response.body);

                for (const row of rows) {
                    startUrlList.push({ url: row.field1 });
                }
            } else {
                startUrlList.push(item);
            }
        }

        const requestList = await Apify.openRequestList('STARTURLS', startUrlList);
        let count = 0;

        let request = await requestList.fetchNextRequest();

        while (request) {
            if (!request.url.includes('airbnb.com/rooms')) {
                throw new Error(`Provided urls must be AirBnB room urls, got ${request.url}`);
            }

            const url = new URL(request.url);
            const id = url.pathname.split('/').pop();

            const rq = await enqueueDetailLink(id, requestQueue, minPrice, maxPrice, request.url, {});

            if (!rq.wasAlreadyPresent) {
                count++;
            }

            request = await requestList.fetchNextRequest();
        }

        log.info(`Starting with ${count} urls`);
    } else {
        log.info(`"startUrls" isn't being used, will search now for "${locationQuery}"...`);

        await addListings({ minPrice, maxPrice }, locationQuery, requestQueue, buildListingUrl);

        const doReq = getRequest(null);
        const cityQuery = await getSearchLocation({ maxPrice, minPrice }, locationQuery, doReq, buildListingUrl);
        log.info(`Location query: ${cityQuery}`);
        const areaList = await cityToAreas(cityQuery, doReq, limitPoints, timeoutMs);

        if (areaList.length === 0) {
            log.info('Cannot divide location query into smaller areas!');
        } else {
            for (const area of areaList) {
                await addListings({ minPrice, maxPrice }, area, requestQueue, buildListingUrl);
            }
        }
    }

    const crawler = new Apify.BasicCrawler({
        requestQueue,
        maxConcurrency,
        handleRequestTimeoutSecs: 1200,
        useSessionPool: true,
        handleRequestFunction: async ({ request, autoscaledPool, session }) => {
            const { isHomeDetail, isPivoting } = request.userData;
            const doReq = getRequest(session);

            if (isPivoting) {
                await pivot(request, requestQueue, doReq, buildListingUrl);
            } else if (isHomeDetail) {
                try {
                    const { pdp_listing_detail: detail } = await doReq(request.url);
                    log.info(`Saving home detail - ${detail.id}`);

                    detail.reviews = [];

                    if (includeReviews) {
                        try {
                            detail.reviews = await getReviews(request.userData.id, doReq, maxReviews);
                        } catch (e) {
                            log.exception(e, 'Could not get reviews');
                        }
                    }

                    const result = camelcaseKeysRecursive(detail);
                    const { locationTitle, starRating, guestLabel, p3SummaryTitle, lat, lng, roomAndPropertyType, reviews } = result;
                    const simpleResult = {
                        url: `https://www.airbnb.com/rooms/${detail.id}`,
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
                    };

                    if (request.userData.pricing && request.userData.pricing.rate) {
                        simpleResult.pricing = request.userData.pricing;
                    }

                    if (includeCalendar) {
                        try {
                            const { originalUrl } = request.userData;
                            const checkInDate = (originalUrl ? new URL(originalUrl, 'https://www.airbnb.com').searchParams.get('check_in') : false)
                                || checkIn
                                || new Date().toISOString();
                            log.info(`Requesting calendar for ${checkInDate}`, { url: request.url, id: detail.id });
                            const { calendar_months } = await doReq(calendarMonths(detail.id, checkInDate));
                            simpleResult.calendar = calendar_months[0].days;
                        } catch (e) {
                            log.exception(e, 'Error while retrieving calendar', { url: request.url, id: detail.id });
                        }
                    }

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

                    if (abortOnMaxItems()) {
                        await autoscaledPool.abort();
                    }
                } catch (e) {
                    log.exception(e, 'Could not get detail for home', { url: request.url });
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
