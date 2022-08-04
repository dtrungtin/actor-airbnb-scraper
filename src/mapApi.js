const Apify = require('apify');
const turf = require('@turf/turf');

const { DISTANCE_METERS } = require('./constants');

const { log, sleep } = Apify.utils;

function objectToQuery(object) {
    const keys = Object.keys(object);

    const params = [];
    keys.forEach((key) => {
        const value = object[key];
        if (!value) return;
        params.push(`${key}=${encodeURIComponent(value)}`);
    });

    return params.join('&');
}

async function findPolygons({ query, street, city, country, county, state, postalcode }, getRequest) {
    const additionalQuery = { polygon_geojson: 1, format: 'json' };
    const urlQuery = objectToQuery({ ...additionalQuery, q: query, street, city, country, county, state, postalcode });

    const url = `https://nominatim.openstreetmap.org/search?${urlQuery}`;

    return getRequest(url);
}

async function reverse({ lat, lon }, getRequest) {
    const urlQuery = objectToQuery({ lat, lon, format: 'json' });
    const url = `https://nominatim.openstreetmap.org/reverse?${urlQuery}`;

    return getRequest(url);
}

const MAX_REVERSE_API_CONCURRENCY = 10;
const TURF_UNIT = 'kilometers';
const MIN_IMPORTANCE = 0.5;

const GEO_TYPES = {
    MULTI_POLYGON: 'MultiPolygon',
    POLYGON: 'Polygon',
    POINT: 'Point',
    LINE_STRING: 'LineString',
};

const LOCATION_TYPES = {
    RESIDENTIAL: 'residential',
    CITY: 'city',
    ADMINISTRATIVE: 'administrative',
    STATION: 'station',
    TOWN: 'town',
};

const LOCATION_CLASSES = {
    PLACE: 'place',
    RAILWAY: 'railway', // For railway stations
    HIGHWAY: 'highway',
    LANDUSE: 'landuse',
    BOUNDARY: 'boundary',
};

function getPolygons(geoJson, distanceKilometers) {
    const { coordinates, type } = geoJson;
    if (type === GEO_TYPES.POLYGON) {
        return [turf.polygon(coordinates)];
    }
    if (type === GEO_TYPES.POINT) {
        const options = { units: TURF_UNIT };
        return [turf.circle(coordinates, distanceKilometers, options)];
    }

    if (type === GEO_TYPES.LINE_STRING) {
        const options = { units: TURF_UNIT };

        const firstPoint = turf.point(coordinates[0]);
        const lastPoint = turf.point(coordinates[coordinates.length - 1]);
        const midPoint = turf.midpoint(firstPoint, lastPoint);

        const line = turf.lineString(coordinates);
        const length = turf.length(line, options);

        return [turf.circle(midPoint, length, options)];
    }

    return coordinates.map((coords) => turf.polygon(coords));
}

function findPointsInPolygon(location, distanceKilometers, limitPoints) {
    const { geojson } = location;
    const { coordinates } = geojson;
    if (!coordinates) return [];

    const points = [];
    if (geojson.type === GEO_TYPES.POINT) {
        const [lon, lat] = coordinates;
        points.push({ lon, lat });
        limitPoints--;
    }
    if (geojson.type === GEO_TYPES.LINE_STRING) {
        const linePoints = [coordinates[0], coordinates[coordinates.length - 1]];
        for (const point of linePoints) {
            if (limitPoints-- <= 0) {
                break;
            }
            const [lon, lat] = point;
            points.push({ lon, lat });
        }
    }
    try {
        const polygons = getPolygons(geojson, distanceKilometers);
        for (const polygon of polygons) {
            const bbox = turf.bbox(polygon);
            const options = {
                units: 'kilometers',
                mask: polygon,
            };

            const distance = geojson.type === GEO_TYPES.POINT ? distanceKilometers / 2 : distanceKilometers;
            const pointGrid = turf.pointGrid(bbox, distance, options);
            // http://geojson.io is nice tool to check found points on map
            for (const feature of pointGrid.features) {
                if (limitPoints-- <= 0) {
                    break;
                }

                const [lon, lat] = feature.geometry.coordinates;
                points.push({ lon, lat });
            }
        }
    } catch (e) {
        log.exception(e, 'Failed to create point grid');
    }

    return points;
}

/**
 * Converts floating geopoint to ~113m precision (3 decimals)
 */
function meterPrecision(value) {
    return +(+`${value}`).toFixed(3);
}

async function cityToAreas(cityQuery, getRequest, limitPoints, timeoutMs = 300000) {
    const distanceMeters = DISTANCE_METERS;
    const params = { query: cityQuery };
    const polygons = await findPolygons(params, getRequest);
    log.info(`Found ${polygons.length} polygons`);

    const allowedTypes = Object.values(LOCATION_TYPES);
    const allowedGeoTypes = Object.values(GEO_TYPES);
    const allowedClasses = Object.values(LOCATION_CLASSES);
    const filteredPolygons = polygons.filter((polygon) => {
        if (!polygon.type) return false;
        if (polygon.importance && polygon.importance <= MIN_IMPORTANCE) return false;
        if (!allowedClasses.includes(polygon.class)) return false;
        if (!allowedTypes.includes(polygon.type)) return false;
        if (!polygon.geojson) return false;
        return allowedGeoTypes.includes(polygon.geojson.type);
    });

    log.info(`Got ${filteredPolygons.length} filtered polygons`);
    const distanceKilometers = distanceMeters / 1000;

    const pointMap = new Map(await Apify.getValue('POINTS'));

    if (!pointMap.size) {
        for (const polygon of filteredPolygons) {
            log.info('Finding points in polygon, (might take a while)', { place_id: polygon.place_id });
            const pips = findPointsInPolygon(polygon, distanceKilometers, limitPoints);
            log.info(`${pips.length} points in polygon`);

            for (const pip of pips) {
                const lon = meterPrecision(pip.lon);
                const lat = meterPrecision(pip.lat);
                // deduplicate really near points
                pointMap.set(`${lon},${lat}`, { lon, lat });
            }
        }

        await Apify.setValue('POINTS', [...pointMap.entries()]);
    }

    const points = [...pointMap.values()];

    // Debug
    const geoPoints = points.map(({ lon, lat }) => turf.point([lon, lat]));
    const collection = turf.featureCollection(geoPoints);
    await Apify.setValue('COORDS', collection);

    const dataset = [];
    const reversePoint = async (point) => {
        const pointInfo = await reverse(point, getRequest);
        // eslint-disable-next-line camelcase
        const { display_name } = pointInfo;
        log.debug(display_name, pointInfo);

        dataset.push(pointInfo.boundingbox);
        await sleep(200);
    };

    const promises = [];
    log.debug(`Points found ${points.length}`);

    for (const point of points) {
        promises.push(Promise.race([
            sleep(timeoutMs),
            reversePoint(point),
        ]));

        if (promises.length >= MAX_REVERSE_API_CONCURRENCY) {
            log.debug('Over reverse api concurrency, waiting');
            await Promise.all(promises);
            log.debug('Continuing');
            promises.length = 0;
        }
    }

    if (promises.length) {
        log.info('Waiting for geopoints to finish');
        await Promise.all(promises);
        log.info('Done waiting, continuing scrape');
    }

    return dataset;
}

module.exports = {
    cityToAreas,
};
