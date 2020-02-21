const Apify = require('apify');
const camelcaseKeysRecursive = require('camelcase-keys-recursive');

const { utils: { log, requestAsBrowser, sleep } } = Apify;
const { addListings, pivot, getReviews, validateInput, enqueueDetailLink, getSearchLocation } = require('./tools');
const { cityToAreas } = require('./mapApi');

Apify.main(async () => {
    const input = await Apify.getInput();

    validateInput(input);

    const {
        currency,
        locationQuery,
        minPrice,
        maxPrice,
        checkIn,
        checkOut,
        startUrls,
        proxyConfiguration,
        includeReviews,
    } = input;

    const getRequest = async (url) => {
        const getProxyUrl = () => {
            return Apify.getApifyProxyUrl({
                groups: proxyConfiguration.apifyProxyGroups,
                session: `airbnb_${Math.floor(Math.random() * 100000000)}`,
            });
        };
        const getData = async (attempt = 0) => {
            let response;

            const options = {
                url,
                headers: {
                    'x-airbnb-currency': currency,
                    'x-airbnb-api-key': process.env.API_KEY,
                },
                proxyUrl: getProxyUrl(),
                abortFunction: (res) => {
                    const { statusCode } = res;
                    return statusCode !== 200;
                },
                timeoutSecs: 300,
            };

            try {
                response = await requestAsBrowser(options);
            } catch (e) {
                // log.exception(e.message, 'GetData error');
            }

            const valid = !!response && !!response.body;
            if (valid === false) {
                if (attempt >= 10) {
                    throw new Error(`Could not get data for: ${options.url}`);
                }

                await sleep(5000);
                const data = await getData(attempt + 1);
                return data;
            }

            return JSON.parse(response.body);
        };

        return getData();
    };

    const requestQueue = await Apify.openRequestQueue();
    if (startUrls && startUrls.length > 0) {
        for (const { url } of startUrls) {
            const id = url.slice(url.lastIndexOf('/') + 1, url.indexOf('?'));
            await enqueueDetailLink(id, requestQueue);
        }
    } else {
        await addListings(locationQuery, requestQueue, minPrice, maxPrice, checkIn, checkOut);

        const cityQuery = await getSearchLocation(locationQuery, minPrice, maxPrice, checkIn, checkOut, getRequest);
        log.info(`Location query: ${cityQuery}`);
        const areaList = await cityToAreas(cityQuery, getRequest);
        if (areaList.length === 0) {
            log.info('Cannot divide location query into smaller areas!');
        } else {
            for (const area of areaList) {
                await addListings(area, requestQueue, minPrice, maxPrice, checkIn, checkOut);
            }
        }
    }

    const crawler = new Apify.BasicCrawler({
        requestQueue,
        maxConcurrency: input.maxConcurrency,
        handleRequestTimeoutSecs: 1200,
        handleRequestFunction: async ({ request }) => {
            const { isHomeDetail, isPivoting } = request.userData;

            if (isPivoting) {
                await pivot(request, requestQueue, getRequest);
            } else if (isHomeDetail) {
                try {
                    const { pdp_listing_detail: detail } = await getRequest(request.url);
                    log.info(`Saving home detail - ${detail.id}`);

                    detail.reviews = [];

                    if (includeReviews) {
                        try {
                            detail.reviews = await getReviews(request.userData.id, getRequest);
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
                        result.locationTitle = undefined;
                        result.starRating = undefined;
                        result.guestLabel = undefined;
                        result.p3SummaryTitle = undefined;
                        result.lat = undefined;
                        result.lng = undefined;
                        result.roomAndPropertyType = undefined;

                        const newResult = {
                            ...simpleResult,
                            ...result,
                        };
                        await Apify.pushData(newResult);
                    }
                } catch (e) {
                    log.error('Could not get detail for home', e.message);
                }
            }

            await sleep(5000);
        },

        handleFailedRequestFunction: async ({ request }) => {
            log.warning(`Request ${request.url} failed too many times`);
            await Apify.pushData({
                '#debug': Apify.utils.createRequestDebugInfo(request),
            });
        },
    });

    await crawler.run();
    log.info('Crawler finished.');
});
