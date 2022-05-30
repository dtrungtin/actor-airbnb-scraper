const { URL_DOMAIN_REGEX, DEFAULT_LOCALE, URL_LOCALE_PREFIX_REGEX } = require('./constants');

const URL_DOMAIN_TO_LOCALE_MAPPING = {
    cz: 'cs',
    sk: 'sk',
    us: 'zh-TW',
    gb: 'en-GB',
    au: 'en-AU',
    ch: 'it-CH',
    az: 'az',
    id: 'id',
    ba: 'bs',
    es: 'es',
    me: 'sr-ME',
    dk: 'da',
    de: 'de',
    at: 'de-AT',
    ee: 'et',
    ca: 'fr-CA',
    gy: 'en',
    in: 'hi',
    ie: 'ga',
    nz: 'en-NZ',
    sg: 'en-SG',
    ae: 'en',
    ar: 'es-AR',
    bz: 'es-XL',
    bo: 'es-XL',
    cl: 'es-XL',
    co: 'es-XL',
    cr: 'es-XL',
    ec: 'es-XL',
    sv: 'es-XL',
    gt: 'es-XL',
    hn: 'es-XL',
    mx: 'es-419',
    ni: 'es-XL',
    pa: 'es-XL',
    py: 'es-XL',
    pe: 'es-XL',
    ve: 'es-XL',
    be: 'nl-BE',
    fr: 'fr',
    za: 'zu',
    is: 'is',
    it: 'it',
    lv: 'lv',
    lt: 'lt',
    hu: 'hu',
    mt: 'mt',
    my: 'ms',
    nl: 'nl',
    no: 'no',
    pl: 'pl',
    br: 'pt',
    pt: 'pt-PT',
    ro: 'ro',
    al: 'sq',
    si: 'sl',
    rs: 'sr',
    fi: 'fi',
    se: 'sv',
    ph: 'tl',
    vn: 'vi',
    tr: 'tr',
    gr: 'el',
    bg: 'bg',
    mk: 'mk',
    ru: 'ru',
    ua: 'uk',
    ge: 'ka',
    am: 'hy',
    il: 'he',
    th: 'th',
    kr: 'ko',
    jp: 'ja',
    cn: 'zh',
    hk: 'zh-HK',
    tw: 'zh-TW',
};

function getLocale(url) {
    const urlDomainMatches = new RegExp(URL_DOMAIN_REGEX).exec(url) || [];
    const urlLocalePrefixMatches = new RegExp(URL_LOCALE_PREFIX_REGEX).exec(url) || [];

    const urlDomain = urlDomainMatches[1];
    const urlLocalePrefix = urlLocalePrefixMatches[1];

    let locale = DEFAULT_LOCALE;
    if (urlLocalePrefix) {
        locale = urlLocalePrefix;
    } else if (URL_DOMAIN_TO_LOCALE_MAPPING[urlDomain]) {
        locale = URL_DOMAIN_TO_LOCALE_MAPPING[urlDomain];
    }

    return locale;
}
module.exports = {
    getLocale,
};
