/**
 * Ensures correct format of location input
 */
function parseLocationInput(location) {
    if (typeof location === 'string' && location.trim().startsWith('[') && location.trim().endsWith(']')) {
        return JSON.parse(location);
    }
    return location;
}

module.exports = {
    parseLocationInput,
};
