/**
 * mobileapp provides page content for the Mobile Apps.
 * The goal is to avoid having to use a web view and style the content natively inside the app
 * using plain TextViews.
 * The payload should not have any extra data, and should be easy to consume by the apps.
 *
 * Status: Prototype -- not ready for production
 * Currently using the mobileview action MW API, and removing some data we don't display.
 * TODO: add some transformations that currently are being done by the apps and remove some more unneeded data
 */

'use strict';

var BBPromise = require('bluebird');
var preq = require('preq');
var sUtil = require('../lib/util');
var mUtil = require('../lib/mobile-util');
var parse = require('../lib/parseProperty');
var transforms = require('../lib/transforms');
var mwapi = require('../lib/mwapi');
var parsoid = require('../lib/parsoid-access');
var gallery = require('../lib/gallery');
var domino = require('domino');
var extract = require('../lib/extract');

// shortcut
var HTTPError = sUtil.HTTPError;


/**
 * The main router object
 */
var router = sUtil.router();

/**
 * The main application object reported when this module is require()d
 */
var app;

/** Returns a promise to retrieve the page content from Parsoid */
function pageContentPromise(logger, domain, title, revision) {
    return parsoid.getContent(logger, app.conf.restbase_uri, domain, title, revision)
    .then(function (response) {
        var page = { revision: parsoid.getRevisionFromEtag(response.headers) };
        var doc = domino.createDocument(response.body);
        page.lastmodified = parsoid.getModified(doc);
        parse.parseGeo(doc, page);
        parse.parseSpokenWikipedia(doc, page);
        transforms.runParsoidDomTransforms(doc);

        page.sections = parsoid.getSectionsText(doc);
        return page;
    });
}

/** Returns a promise to retrieve the page content from MW API mobileview */
function pageContentForMainPagePromise(logger, domain, title) {
    return mwapi.getAllSections(logger, domain, title)
    .then(function (response) {
        var page = response.body.mobileview;
        var sections = page.sections;
        var section;

        // transform all sections
        for (var idx = 0; idx < sections.length; idx++) {
            section = sections[idx];
            section.text = transforms.runMainPageDomTransforms(section.text);
        }

        page.sections = sections;
        return page;
    });
}

/** Returns a promise to retrieve the page content from MW API mobileview */
function pageMetadataPromise(logger, domain, title) {
    return mwapi.getMetadata(logger, domain, title)
    .then(function (response) {
        return response.body.mobileview;
    });
}

function buildLeadSections(sections) {
    var out = [],
        section,
        len = sections.length;

    out.push(transforms.runSectionTransforms(sections[0]));
    for (var i = 1; i < len; i++) {
        section = sections[i];
        var item = {
            id: section.id,
            toclevel: section.toclevel,
            anchor: section.anchor,
            line: section.line
        };
        out.push(item);
    }
    return out;
}

function buildRemainingSections(sections) {
    for (var i = 0; i < sections.length; i++) {
        sections[i] = transforms.runSectionTransforms(sections[i]);
    }
    return sections;
}

function sanitizeEmptyProtection(protection) {
    if (Array.isArray(protection)) {
        return undefined; // MediaWiki API returns an empty array instead of an empty object, ouch!
    }
    return protection;
}

function parseExtract(body) {
    var id = Object.keys(body.query.pages)[0];
    var page = body.query.pages[id];
    return page && extract.format(page.extract);
}

function buildLead(input, domain) {
    var lead = domino.createDocument(input.page.sections[0].text);
    return {
        id: input.meta.id,
        revision: input.page.revision,
        lastmodified: input.page.lastmodified,
        displaytitle: input.meta.displaytitle,
        normalizedtitle: input.meta.normalizedtitle,
        redirected: input.meta.redirected,
        description: input.meta.description,
        protection: sanitizeEmptyProtection(input.meta.protection),
        editable: input.meta.editable,
        mainpage: input.meta.mainpage,
        languagecount: input.meta.languagecount,
        image: mUtil.defaultVal(mUtil.filterEmpty({
            file: input.meta.image && input.meta.image.file,
            urls: input.meta.thumb && mwapi.buildLeadImageUrls(input.meta.thumb.url)
        })),
        extract: input.extract && parseExtract(input.extract.body),
        infobox: parse.parseInfobox(lead),
        pronunciation: parse.parsePronunciation(lead, input.meta.displaytitle),
        spoken: input.page.spoken,
        geo: input.page.geo,
        sections: buildLeadSections(input.page.sections),
        media: input.media
    };
}

function buildRemaining(input) {
    return {
        sections: buildRemainingSections(input.page.sections.slice(1)) // don't repeat the first section
    };
}

function buildAll(input, domain) {
    return {
        lead: buildLead(input, domain),
        remaining: buildRemaining(input)
    };
}

/**
 * For main page only, switch to mobileview content because Parsoid doesn't
 * provide a good mobile presentation of main pages.
 */
function mainPageFixPromise(req, response) {
    return pageContentForMainPagePromise(req.logger, req.params.domain, req.params.title)
    .then(function (mainPageContent) {
        return {
            page: mainPageContent,
            meta: response.meta,
            media: response.media,
            extract: response.extract
        };
    });
}

/**
 * GET {domain}/v1/page/mobile-html-sections/{title}
 * Gets the mobile app version of a given wiki page.
 */
router.get('/mobile-html-sections-lite/:title/:revision?', function (req, res) {
    return BBPromise.props({
        page: pageContentPromise(req.logger, req.params.domain, req.params.title, req.params.revision),
        meta: pageMetadataPromise(req.logger, req.params.domain, req.params.title),
        media: gallery.collectionPromise(req.logger, req.params.domain, req.params.title)
    }).then(function (response) {
        if (response.meta.mainpage) {
            return mainPageFixPromise(req, response);
        }
        return response;
    }).then(function (response) {
        response = buildAll(response, req.params.domain);
        res.status(200);
        mUtil.setETag(req, res, response.lead.revision);
        res.json(response).end();
    });
});

/**
 * GET {domain}/v1/page/mobile-html-sections-lead/{title}
 * Gets the lead section for the mobile app version of a given wiki page.
 */
router.get('/mobile-html-sections-lite-lead/:title/:revision?', function (req, res) {
    return BBPromise.props({
        page: pageContentPromise(req.logger, req.params.domain, req.params.title, req.params.revision),
        meta: pageMetadataPromise(req.logger, req.params.domain, req.params.title),
        media: gallery.collectionPromise(req.logger, req.params.domain, req.params.title),
        extract: mwapi.requestExtract(req.params.domain, req.params.title)
    }).then(function (response) {
        if (response.meta.mainpage) {
            return mainPageFixPromise(req, response);
        }
        return response;
    }).then(function (response) {
        response = buildLead(response, req.params.domain);
        res.status(200);
        mUtil.setETag(req, res, response.revision);
        res.json(response).end();
    });
});

/**
 * GET {domain}/v1/page/mobile-html-sections-remaining/{title}
 * Gets the remaining sections for the mobile app version of a given wiki page.
 */
router.get('/mobile-html-sections-lite-remaining/:title/:revision?', function (req, res) {
    return BBPromise.props({
        page: pageContentPromise(req.logger, req.params.domain, req.params.title, req.params.revision)
    }).then(function (response) {
        res.status(200);
        mUtil.setETag(req, res, response.page.revision);
        res.json(buildRemaining(response)).end();
    });
});

module.exports = function (appObj) {
    app = appObj;
    return {
        path: '/page',
        api_version: 1,
        router: router
    };
};
