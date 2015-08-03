/**
 * mobileapp provides facades for Mobile Apps (Android, iOS)
 * Initially, this focuses on page (view) content.
 * The goal is to avoid having to use a web view and style the content natively inside the app
 * using plain TextViews.
 * The payload should not have any extra data, and should be easily consumed by the apps.
 *
 * Status: Prototype -- not ready for production
 * Currently using the mobileview action MW API, and removing some data we don't display.
 * The output is in HTML, with two script blocks embedded for the JSON metadata:
 * one at the beginning for things the app needs for initial display and another
 * one at the end for things that could be used later (gallery).
 * TODO: add some transformations that currently are being done by the apps and remove some more unneeded data
 */

'use strict';

var BBPromise = require('bluebird');
var preq = require('preq');
var domino = require('domino');
var sUtil = require('../lib/util');
var util = require('util');

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

var DEBUG = true;

// gallery constants:
var MAX_ITEM_COUNT = 256;
var MIN_IMAGE_SIZE = 64;
var MAX_IMAGE_WIDTH = 1280;


function dbg(name, obj) {
    if (DEBUG) {
        console.log("DEBUG: " + name + ": " + util.inspect(obj));
        //console.log("DEBUG: " + name + ": " + JSON.stringify(obj, null, 2));
        //app.logger.log('debug', name + ": " + JSON.stringify(obj));
    }
}

/**
 * A helper function that obtains the HTML from the MW API and
 * loads it into a domino DOM document instance.
 *
 * @param {String} domain the domain to contact
 * @param {Object} params an Object with all the query parameters for the MW API
 * @return {Promise} a promise resolving as the HTML element object
 */
function apiGet(domain, params) {
    // get the page from the MW API
    return preq.get({
        uri: 'http://' + domain + '/w/api.php',
        query: params
    });
}

function rmSelectorAll(doc, selector) {
    var ps = doc.querySelectorAll(selector) || [];
    for (var idx = 0; idx < ps.length; idx++) {
        var node = ps[idx];
        node.parentNode.removeChild(node);
    }
}

function rmBracketSpans(doc) {
    var ps = doc.querySelectorAll('span:not([class],[style],[id])') || [];
    for (var idx = 0; idx < ps.length; idx++) {
        var node = ps[idx];
        if (node.innerHTML === '[') {
            var leftBracket = doc.createTextNode('[');
            node.parentNode.replaceChild(leftBracket, node);
        } else if (node.innerHTML === ']') {
            var rightBracket = doc.createTextNode(']');
            node.parentNode.replaceChild(rightBracket, node);
        }
    }
}

function rmAttributeAll(doc, selector, attribute) {
    var ps = doc.querySelectorAll(selector) || [];
    for (var idx = 0; idx < ps.length; idx++) {
        var node = ps[idx];
        node.removeAttribute(attribute);
    }
}

function moveFirstParagraphUpInLeadSection(text) {
    var doc = domino.createDocument(text);
    // TODO: mhurd: feel free to add your lead section magic here
    return doc.body.innerHTML;
}

/**
 * Create HTML for the section heading and edit button.
 * @param section JSON of section
 * @returns {string} HTML doc fragment
 * @see app code sections.js
 */
function buildSectionHeading(section) {
    var document = domino.createDocument();
    var tocLevel = section.toclevel || 0;
    var heading = document.createElement("h" + ( tocLevel + 1 ));
    // TODO: RTL support
    //heading.setAttribute( "dir", window.directionality );
    heading.innerHTML = typeof section.line !== "undefined" ? section.line : "";
    if (section.anchor) {
        heading.id = section.anchor;
    }
    heading.className = "section_heading";
    heading.setAttribute("data-id", section.id);

    var editButton = document.createElement("a");
    editButton.setAttribute("data-id", section.id);
    editButton.setAttribute("data-action", "edit_section");
    editButton.className = "edit_section_button";
    heading.appendChild(editButton);

    return heading.outerHTML;
}

function rmTemplates(doc, names) {
    var nodes = doc.querySelectorAll('[typeof~=mw:Transclusion]');
    var dataMW;
    for (var i = 0; i < nodes.length; i++) {
        var node = nodes[i];
        dataMW = node.getAttribute('data-mw');
        if (dataMW) {
            var name;
            try {
                name = JSON.parse(dataMW).parts[0].template.target.wt.trim().toLowerCase();
            } catch (e) {}
            if (name && names[name]) {
                // remove siblings if the about matches
                var about = node.getAttribute('about');
                var next = node.nextSibling;
                while (next
                        && ( // Skip over inter-element whitespace
                            next.nodeType === 3 && /^\w+$/.test(next.nodeValue))
                        // same about
                        || next.getAttribute && next.getAttribute('about') === about) {
                    if (next.nodeType !== 3) {
                        node.parentNode.removeChild(next);
                    }
                    next = node.nextSibling;
                }
                // finally, remove the transclusion node itself
                node.parentNode.removeChild(node);
            }
        }
    }
}


/**
 * Nukes stuff from the DOM we don't want.
 */
function runDomTransforms(doc) {

    // Demo: remove content produced by specific templates
    //rmTemplates(doc, {
    //    reflist: true
    //});

    var rmSelectors = [
        'div.noprint',
        'div.infobox', // ??
        'div.metadata',
        'table.navbox', // template
        'div.magnify',
        'span[style*="display:none"]',             // Remove <span style=\"display:none;\">&nbsp;</span>
        'span.Z3988',                              // Remove <span class=\"Z3988\"></span>
        'div.hatnote',

        // Demo: remove specific extensions, in this case citations
        //'[typeof~=mw:Extension/ref]'
    ];

    rmSelectorAll(doc, rmSelectors.join(', '));    // Do single call to rmSelectorAll.

    rmAttributeAll(doc, 'html', 'prefix');
    rmAttributeAll(doc, 'a', 'rel');
    rmAttributeAll(doc, 'a,span', 'title');
    rmAttributeAll(doc, 'img', 'alt');
    rmAttributeAll(doc, '*', 'data-mw'); // Remove template parameters etc
    rmAttributeAll(doc, '*[id^=mw]', 'id'); // Remove Parsoid-assigned IDs
    rmAttributeAll(doc, '*', 'about'); // RDFa about

    rmBracketSpans(doc);


    // TODO: mhurd: add more references to functions where you do more transforms here
    //content = transformer.transform("section", content);
    //content = transformer.transform("hideTables", content);
    //content = transformer.transform("hideIPA", content);
    //content = transformer.transform("hideRefs", content );
}

function checkApiResponse(response) {
    // check if the query failed
    if (response.status > 299) {
        // there was an error in the MW API, propagate that
        throw new HTTPError({
            status: response.status,
            type: 'api_error',
            title: 'MW API error',
            detail: response.body
        });
    }
}

function checkForQueryPagesInResponse(logger, response) {
    if (!response.body.query || !response.body.query.pages) {
        // we did not get our expected query.pages from the MW API, propagate that
        logger.log('error', 'no query.pages in response: ' + JSON.stringify(response, null, 2));
        throw new HTTPError({
            status: response.status,
            type: 'api_error',
            title: 'no query.pages in response',
            detail: response.body
        });
    }
}

/**
 * Embeds a JSON object inside HTML
 * by creating an application/json script tag inside an HTML document.
 * http://stackoverflow.com/questions/7581133/how-can-i-read-a-json-in-the-script-tag-from-javascript
 */
function embedJsScriptInHtml(doc, name, jsonObj) {
    var script = doc.createElement("script");
    script.setAttribute("type", "application/json");
    script.setAttribute("id", name);
    script.innerHTML = JSON.stringify(jsonObj);
    return script;
}

// from Android code: www/js/loader.js
function addStyleLink(doc, head, href) {
    var link = doc.createElement("link");
    link.setAttribute("rel", "stylesheet");
    link.setAttribute("type", "text/css");
    link.setAttribute("charset", "UTF-8");
    link.setAttribute("href", href);
    head.appendChild(link);
}

function addToHtmlHead(doc) {
    var head = doc.querySelector("head");

    var script = doc.createElement("script");
    script.setAttribute("src", "/static/bundle.js");
    head.appendChild(script);

    // <meta name="viewport" content="width=device-width, user-scalable=no" />
    var meta = doc.createElement("meta");
    meta.setAttribute("name", "viewport");
    meta.setAttribute("content", "width=device-width, user-scalable=no");
    head.appendChild(meta);

    addStyleLink(doc, head, "/static/styles.css"); // Light mode hard-coded for now
}

/**
 * Compiles the final HTML string output.
 * All sections are combined, plus two JavaScript blocks for the metadata.
 * One at the beginning, and another one at the end of the HTML body.
 * The idea of the two script blocks is to have one at the beginning, which should include
 * whatever is needed to display what's above the fold and some minor, basic metadata.
 * The rest should go to the second block.
 * Right now the two script blocks are split up in a fairly straightforward way
 * to ease coding of this service. Further optimizations are conceivable.
 * The big item is the ToC, which could go to the end as well.
 *
 * @param sections JSON: sections[]
 * @param meta1 JSON: metadata needed first
 * @param meta2 metadata needed later
 * @returns {Document.outerHTML|*|Element.outerHTML|string|exports.outerHTML|outerHTML}
 */
function compileHtml(html, meta1, meta2) {

    var doc = domino.createDocument(html);

    doc.head.innerHTML = '';

    // Strip some content
    runDomTransforms(doc);

    addToHtmlHead(doc);
    var body = doc.body;


    body.setAttribute("class", "stable");

    doc.head.appendChild(embedJsScriptInHtml(doc, "mw-app-meta1", meta1));

    var contentWrapperDiv = doc.createElement("div");
    contentWrapperDiv.setAttribute("id", "content");
    contentWrapperDiv.setAttribute("class", "content");
    var contentDiv = doc.createElement("div");
    contentDiv.setAttribute("id", "content_block_0");
    contentWrapperDiv.appendChild(contentDiv);

    body.appendChild(contentWrapperDiv);

    while (body.children.length > 1) {
        contentDiv.appendChild(body.children[0]);
    }


    // TODO: probably not needed anymore
    var loadingSectionsDiv = doc.createElement("div");
    loadingSectionsDiv.setAttribute("id", "loading_sections");
    body.appendChild(loadingSectionsDiv);

    body.appendChild(embedJsScriptInHtml(doc, "mw-app-meta2", meta2));

    return doc.outerHTML;
}

function buildToCJSON(sections) {
    var toc = [];
    for (var idx = 0; idx < sections.length; idx++) {
        var section = sections[idx];
        toc.push({
            id: section.id,
            toclevel: section.toclevel,
            line: section.line,
            anchor: section.anchor
        });
    }
    return toc;
}

function buildPageContentJSON(orig) {
    return {
        lastmodified: orig.lastmodified,
        id: orig.id,
        revision: orig.revision,
        displaytitle: orig.displaytitle,
        description: orig.description,
        image: orig.image,
        thumb: orig.thumb,
        protection: orig.protection,
        editable: orig.editable,
        toc: buildToCJSON(orig.sections)
    };
}

/** Returns a promise to retrieve the page content from MW API mobileview */
function pageContentPromise(domain, title) {
    return apiGet(domain, {
        "action": "mobileview",
        "format": "json",
        "page": title,
        "prop": "text|sections|thumb|image|id|revision|description|lastmodified|normalizedtitle|displaytitle|protection|editable",
        "sections": "all",
        "sectionprop": "toclevel|line|anchor",
        "noheadings": true
    }).then(function (response) {
        checkApiResponse(response);

        //// transform all sections
        //var sections = response.body.mobileview.sections;
        //for (var idx = 0; idx < sections.length; idx++) {
        //    var section = sections[idx];
        //    var html = buildSectionHeading(section) + buildContentDiv(section.text, idx);
        //    section.text = html;
        //}

        //if (!response.body.mobileview.mainpage) {
        //    // don't do anything if this is the main page, since many wikis
        //    // arrange the main page in a series of tables.
        //    // TODO: should we also exclude file and other special pages?
        //    sections[0].text = moveFirstParagraphUpInLeadSection(sections[0].text);
        //}

        return {
            json: buildPageContentJSON(response.body.mobileview)
        };
    });
}

// in the case of video, look for a list of transcodings, so that we might
// find a WebM version, which is playable in Android.
function getTranscodedVideoUrl(objinfo) {
    var derivativesArr, derivative, url, key;
    if (objinfo.derivatives) {
        derivativesArr = objinfo.derivatives;
        for (key in derivativesArr) {
            if (derivativesArr.hasOwnProperty(key)) {
                derivative = derivativesArr[key];
                if (derivative.type && derivative.type.indexOf("webm") > -1) {
                    // that's the one!
                    url = derivative.src;
                    // Note: currently picks the last one
                    // TODO: in the future we could have an extra URL that provides a size parameter for images and videos
                }
            }
        }
    }
    return url;
}

function getExtMetadata(extmetadata) {
    var ext = {};
    for (var key in extmetadata) {
        if (extmetadata.hasOwnProperty(key)) {
            var value = extmetadata[key].value;
            if (typeof value === "string") {
                ext[key] = value.trim();
            }
        }
    }
    return ext;
}

function handleGalleryItems(item) {
    var obj, url;

    if (item.imageinfo) {
        obj = item.imageinfo[0];
    } else if (item.videoinfo) {
        obj = item.videoinfo[0];
        url = getTranscodedVideoUrl(obj);
    }
    if (!url) {
        url = obj.url;
    }
    return {
        title: item.title,
        url: url,
        thumbUrl: obj.thumbUrl,
        mimeType: obj.mimeType,
        width: obj.width,
        height: obj.height,
        ext: getExtMetadata(obj.extmetadata)
    };
}

function onGalleryItemsResponse(logger, response) {
    var items, key;
    var output = [];

    checkApiResponse(response);
    checkForQueryPagesInResponse(logger, response);

    items = response.body.query.pages;
    for (key in items) {
        if (items.hasOwnProperty(key)) {
            output.push(handleGalleryItems(items[key]));
        }
    }

    return output;
}

/** Returns a promise to retrieve one or more gallery items. */
function galleryItemsPromise(logger, domain, titles, params) {
    Object.assign(params, {
        "action": "query",
        "format": "json",
        "titles": titles,
        "continue": ""
    });

    return apiGet(domain, params)
        .then(function (response) {
            return onGalleryItemsResponse(logger, response);
        });
}

function onGalleryCollectionsResponse(logger, response, domain) {
    var detailsPromises = [], videos = [], images = [];
    var isVideo;

    checkApiResponse(response);
    if (!response.body.query || !response.body.query.pages) {
        return [];
    }

    // iterate over all items
    var items = response.body.query.pages;
    for (var key in items) {
        if (items.hasOwnProperty(key)) {
            var item = items[key];

            if (!item.imageinfo || !(item.imageinfo instanceof Array)) {
                continue;
            }

            // remove the ones that are too small or are of the wrong type
            var imageinfo = item.imageinfo[0];  // TODO: why this is an array?

            // Reject gallery items if they're too small.
            // Also reject SVG and PNG items by default, because they're likely to be
            // logos and/or presentational images.
            if (imageinfo.width < MIN_IMAGE_SIZE
                || imageinfo.height < MIN_IMAGE_SIZE
                || imageinfo.mime.indexOf("svg") > -1
                || imageinfo.mime.indexOf("png") > -1
            ) {
                delete items[key];
            } else {
                delete item.ns;
                delete item.imagerepository; // we probably don't care where the repo is
                delete imageinfo.size;
                // TODO instead of deleting properties we probably want to just add well-known properties

                isVideo = imageinfo.mime.indexOf("ogg") > -1 || imageinfo.mime.indexOf("video") > -1;

                // request details individually, to keep the order
                //detailsPromises.push(galleryItemsPromise(domain, item.title, isVideo));

                if (isVideo) {
                    videos.push(item.title);
                } else {
                    images.push(item.title);
                }
            }
        }
    }

    // one more request for all videos
    if (videos.length > 0) {
        detailsPromises.videos = galleryItemsPromise(logger, domain, videos.join('|'), {
            "prop": "videoinfo",
            "viprop": "url|dimensions|mime|extmetadata|derivatives",
            "viurlwidth": MAX_IMAGE_WIDTH
        });
    }

    // another request for all images
    if (images.length > 0) {
        detailsPromises.images = galleryItemsPromise(logger, domain, images.join('|'), {
            "prop": "imageinfo",
            "iiprop": "url|dimensions|mime|extmetadata",
            "iiurlwidth": MAX_IMAGE_WIDTH
        });
    }

    return detailsPromises;
}

/** Gets the gallery content from MW API */
function galleryCollectionPromise(logger, domain, title) {
    return apiGet(domain, {
        "action": "query",
        "format": "json",
        "titles": title,
        "continue": "",
        "prop": "imageinfo",
        "iiprop": "dimensions|mime",
        "generator": "images",
        "gimlimit": MAX_ITEM_COUNT
    }).then(function (response) {
        var detailsPromises = onGalleryCollectionsResponse(logger, response, domain);
        return BBPromise.props({
            videos: detailsPromises.videos,
            images: detailsPromises.images
        });
    });
}

/**
 * GET {domain}/v1/page/mobile-html/{title}
 * Gets the mobile app version of a given wiki page.
 */
router.get('/mobile-html/:title', function (req, res) {
    //dbg("req.params", req.params);
    BBPromise.props({
        html: preq.get({
            uri: app.conf.restbase_uri + '/' + req.params.domain.replace(/^(\w+\.)m\./, '$1')
            + '/v1/page/html/' + encodeURIComponent(req.params.title),
        }),
        page: pageContentPromise(req.params.domain, req.params.title),
        media: galleryCollectionPromise(req.logger, req.params.domain, req.params.title)
    }).then(function (response) {
        var html = compileHtml(response.html.body, response.page.json, response.media);
        res.status(200).type('html').end(html);
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
