const Apify = require('apify');
const camelcaseKeysRecursive = require('camelcase-keys-recursive');

const { utils: { log, requestAsBrowser, sleep, downloadListOfUrls } } = Apify;
const { addListings, pivot, getReviews, validateInput, enqueueDetailLink, getSearchLocation, isMaxListing } = require('./tools');
const { cityToAreas } = require('./mapApi');

Apify.main(async () => {
    const input = await Apify.getInput();

    validateInput(input);

    const {
        locationQuery,
        minPrice,
        maxPrice,
        checkIn,
        checkOut,
        startUrls,
        proxyConfiguration,
        includeReviews,
        maxListings,
        limitPoints = 1000,
        timeoutMs = 60000,
    } = input;

    const proxy = await Apify.createProxyConfiguration({
        ...proxyConfiguration,
    });

    const { abortOnMaxItems, persistState } = await isMaxListing(maxListings);
    Apify.events.on('persistState', persistState);

    /**
     * @param {Apify.Session | null} session
     */
    const getRequest = (session) => async (url) => {
        const getData = async (attempt = 0) => {
            let response;

            const options = {
                url,
                headers: {
                    'X-Airbnb-API-Key': process.env.API_KEY,
                },
                proxyUrl: proxy.newUrl(session ? session.id : `airbnb_${Math.floor(Math.random() * 100000000)}`),
                abortFunction: (res) => {
                    const { statusCode } = res;
                    return statusCode !== 200;
                },
                timeoutSecs: 600,
            };

            try {
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
        const requestList = await Apify.openRequestList('STARTURLS', startUrls);
        let request;

        while (request = await requestList.fetchNextRequest()) {
            if (!request.url.includes('airbnb.com')) {
                throw new Error(`Provided urls must be AirBnB urls, got ${request.url}`);
            }

            const url = new URL(request.url);
            const id = url.pathname.split('/').pop();

            await enqueueDetailLink(id, requestQueue, minPrice, maxPrice);
        }
    } else {
        await addListings({ minPrice, maxPrice, checkIn, checkOut }, locationQuery, requestQueue);

        const doReq = getRequest(null);
        const cityQuery = await getSearchLocation(input, locationQuery, doReq);
        log.info(`Location query: ${cityQuery}`);
        const areaList = await cityToAreas(cityQuery, doReq, limitPoints, timeoutMs);
        if (areaList.length === 0) {
            log.info('Cannot divide location query into smaller areas!');
        } else {
            for (const area of areaList) {
                await addListings({ minPrice, maxPrice, checkIn, checkOut }, area, requestQueue);
            }
        }
    }

    const crawler = new Apify.BasicCrawler({
        requestQueue,
        maxConcurrency: input.maxConcurrency,
        handleRequestTimeoutSecs: 1200,
        useSessionPool: true,
        handleRequestFunction: async ({ request, autoscaledPool, session }) => {
            const { isHomeDetail, isPivoting } = request.userData;
            const doReq = getRequest(session);

            if (isPivoting) {
                await pivot(input, request, requestQueue, doReq);
            } else if (isHomeDetail) {
                try {
                    const { pdp_listing_detail: detail } = await doReq(request.url);
                    log.info(`Saving home detail - ${detail.id}`);

                    detail.reviews = [];

                    if (includeReviews) {
                        try {
                            detail.reviews = await getReviews(request.userData.id, doReq);
                        } catch (e) {
                            log.exception(e, 'Could not get reviews');
                        }
                    }

                    const result = camelcaseKeysRecursive(detail);
                    const { locationTitle, starRating, guestLabel, p3SummaryTitle, lat, lng, roomAndPropertyType, reviews } = result;
                    const simpleResult = {
                        url: request.url,
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
                    };

                    if (input.simple) {
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
