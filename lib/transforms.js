/**
 * Common DOM transformations for mobile apps.
 * We rearrange some content and remove content that is not shown/needed.
 */

'use strict';

var domino = require('domino');
var util = require('util');
var relocateFirstParagraph = require('./transformations/relocateFirstParagraph');
var anchorPopUpMediaTransforms = require('./transformations/anchorPopUpMediaTransforms');
var hideRedLinks = require('./transformations/hideRedLinks');
var setMathFormulaImageMaxWidth = require('./transformations/setMathFormulaImageMaxWidth');

var NodeType =
{
    ELEMENT                :  1,
    //ATTRIBUTE              :  2,
    TEXT                   :  3,
    //,
    //CDATA_SECTION          :  4,
    //ENTITY_REFERENCE       :  5,
    //ENTITY                 :  6,
    //PROCESSING_INSTRUCTION :  7,
    COMMENT                :  8,
    //DOCUMENT               :  9,
    //DOCUMENT_TYPE          : 10,
    //DOCUMENT_FRAGMENT      : 11,
    //NOTATION               : 12
};

function rmComments(node) {
    for (var n = 0; n < node.childNodes.length; n++) {
        var child = node.childNodes[n];
        if (child.nodeType === NodeType.COMMENT) {
            node.removeChild(child);
            n--;
        } else if (child.nodeType === NodeType.ELEMENT) {
            rmComments(child);
        }
    }
}

function rmElementsWithSelector(doc, selector) {
    var removals = 0,
        ps = doc.querySelectorAll(selector) || [];
    for (var idx = 0; idx < ps.length; idx++) {
        var node = ps[idx];
        node.parentNode.removeChild(node);
        removals++;
    }
}

function rmElementsWithSelectors(doc, selectors) {
    rmElementsWithSelector(doc, selectors.join(', '));
}

/**
 * Replaces something like "<span>[</span>1<span>]</span>" with "[1]".
 * This is one way to reduce the payload sent to the client.
 *
 * @param doc the DOM document to be transformed
 */
function rmBracketSpans(doc) {
    var ps = doc.querySelectorAll('span:not([class],[style],[id])') || [];
    for (var idx = 0; idx < ps.length; idx++) {
        var node = ps[idx];
        if (/^\[|]$/.test(node.innerHTML)) {
            var bracket = doc.createTextNode(node.innerHTML);
            node.parentNode.replaceChild(bracket, node);
        }
    }
}

function rmAttributes(doc, selector, attributeArray) {
    var ps = doc.querySelectorAll(selector) || [];
    for (var idx = 0; idx < ps.length; idx++) {
        var node = ps[idx];
        for (var aa = 0; aa < attributeArray.length; aa++) {
            node.removeAttribute(attributeArray[aa]);
        }
    }
}

//** Remove transclusion data-mw provided by Parsoid. */
/*
function rmTransclusions(doc, names) {
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
                next.nodeType === NodeType.TEXT && /^\w+$/.test(next.nodeValue))
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
*/

function rewriteUrlAttribute(doc, selector, attribute) {
    var ps = doc.querySelectorAll(selector) || [],
        value;
    for (var idx = 0; idx < ps.length; idx++) {
        var node = ps[idx];
        value = node.getAttribute(attribute);
        value = value.replace(/^\.\//, '/wiki/');
        node.setAttribute(attribute, value);
    }
}

function addClassTo(doc, selector, className) {
    var ps = doc.querySelectorAll(selector) || [];
    for (var idx = 0; idx < ps.length; idx++) {
        var node = ps[idx];
        node.classList.add(className);
    }
}

/**
 * Removes reference link backs.
 * Example: <a href=\"#cite_ref-1\"><span class=\"mw-linkback-text\">↑ </span></a>
 */
function removeRefLinkbacks(doc, selector, className) {
    var ps = doc.querySelectorAll('span.mw-linkback-text') || [];
    for (var idx = 0; idx < ps.length; idx++) {
        var node = ps[idx];
        var parent = node.parentNode;
        if (parent.tagName === 'A') {
            parent.parentNode.removeChild(parent);
        }
    }
}

function removeUnwantedElements(doc, selectors) {
    rmElementsWithSelectors(doc, selectors);
    rmBracketSpans(doc);
    rmComments(doc);
}

function applyParsoidSpecificTransformations(doc) {
    rewriteUrlAttribute(doc, 'a', 'href');

    // Set <a class=\'external\"
    // on all <a rel=\"mw:ExtLink\"
    // so we get the 'external link' indicators in the UI.
    addClassTo(doc, 'a[rel~=mw:ExtLink]', 'external');

    // Set class="image"
    // on all anchors around images
    // so the app knows to view these images in the gallery.
    // See also https://www.mediawiki.org/wiki/Parsoid/MediaWiki_DOM_spec#Images
    addClassTo(doc, 'figure a, span[typeof^=mw:Image] a', 'image');

    // Remove reference link backs since we don't want them to appear in the reference dialog; they are not needed.
    removeRefLinkbacks(doc);
}

function applyOptionalParsoidSpecificTransformations(doc) {
    // TODO: remove content produced by specific templates. Still needs work since it removes too much.
    //rmTransclusions(doc, {
    //    reflist: true
    //});

    rmAttributes(doc, 'a:not([rel=nofollow])', ['rel']); // only leave rel attributes with value nofollow
    rmAttributes(doc, 'a', ['about', 'data-mw', 'id', 'typeof', 'title']);
    rmAttributes(doc, 'div,ol,p,ul,table', ['about', 'data-mw', 'id', 'typeof']);
    rmAttributes(doc, 'blockquote,cite', ['about', 'data-mw', 'id', 'typeof']);
    rmAttributes(doc, 'abbr', ['title']);
    rmAttributes(doc, 'figure', ['id', 'typeof']);
    rmAttributes(doc, 'b,q,td,figcaption', ['id']);
    rmAttributes(doc, 'i', ['about', 'id']);
    rmAttributes(doc, 'li', ['about']);
    rmAttributes(doc, 'img', ['alt', 'data-file-height', 'data-file-type', 'data-file-width', 'id', 'resource']);
    rmAttributes(doc, 'span', ['about', 'data-file-type', 'data-mw', 'id', 'itemscope', 'itemtype', 'rel',
        'title', 'typeof']);
}

/**
 * Nukes stuff from the DOM we don't want.
 */
function runAllSectionsTransforms(doc) {
    var rmSelectors = [
        'span.Z3988',                               // Remove <span class=\"Z3988\"></span>
        'span:empty',                               // Remove empty <span></span>
        'link',
        'sup.noprint',
        'div.noprint',
        'table.navbox',
        '.geo-nondefault',
        '.geo-multi-punct',
        '.hide-when-compact',
        'div.infobox',
        'div.magnify',
        'span#coordinates'

        // Would also like to use this but does not have any effect; https://github.com/fgnass/domino/issues/59

        //'span[style~="display:none"]',             // Remove <span style=\"display:none;\">&nbsp;</span>
    ];

    removeUnwantedElements(doc, rmSelectors);

    anchorPopUpMediaTransforms.fixVideoAnchor(doc);
    hideRedLinks.hideRedLinks(doc);
    setMathFormulaImageMaxWidth.setMathFormulaImageMaxWidth(doc);
}


///**
// * Nukes stuff from the lead section we don't want.
// */
//function runLeadSectionTransforms(doc) {
//    // TODO: once Parsoid produces <section> tags this should be easier.
//
//    //var rmElementsWithSelectors = [
//    //    'div.hatnote'
//    //];
//    //removeUnwantedElements(doc, rmElementsWithSelectors);
//}

/**
 * Nukes stuff from the DOM we don't want for pages from Parsoid.
 */
function runParsoidDomTransforms(doc) {
    runAllSectionsTransforms(doc);
    //runLeadSectionTransforms(doc);
    applyParsoidSpecificTransformations(doc);
    applyOptionalParsoidSpecificTransformations(doc);

    // any page except main pages. It's ok to do unconditionally since we throw away
    // the page content if this turns out to be a main page.
    // TODO: should we also exclude file and other special pages?
    relocateFirstParagraph.moveFirstGoodParagraphUp(doc);
}

/**
 * Nukes stuff from the DOM we don't want for the main page, which comes from mobileview.
 */
function runMainPageDomTransforms(text) {
    var doc = domino.createDocument(text);

    runAllSectionsTransforms(doc);
    //runLeadSectionTransforms(doc);

    return doc.body.innerHTML;
}

function structureThumbnail(thumbDiv) {
    var thumb = {};
    var thumbimg = thumbDiv.querySelector("img");
    if (thumbimg) {
        thumb.src = thumbimg.getAttribute("src");
        if (thumbimg.width < 64) {
            delete thumb.src;
        }
    }
    var videoDiv = thumbDiv.querySelector("div.PopUpMediaTransform");
    if (videoDiv && thumbimg) {
        thumb.type = "video";
        thumb.name = thumbimg.alt;
    } else {
        thumb.type = "image";
        var alink = thumbDiv.querySelector("a");
        if (alink) {
            thumb.name = alink.href;
        }
    }
    var caption = thumbDiv.querySelector("div.thumbcaption");
    if (caption) {
        thumb.caption = caption.innerHTML;
    }
    return thumb;
}

function structureFigure(figure) {
    var thumb = {};
    var thumbimg = figure.querySelector("img");
    if (thumbimg) {
        thumb.src = thumbimg.getAttribute("src");
        if (thumbimg.width < 64) {
            delete thumb.src;
        }
    }
    var videoDiv = figure.querySelector("div.PopUpMediaTransform");
    if (videoDiv && thumbimg) {
        thumb.type = "video";
        thumb.name = thumbimg.alt;
    } else {
        thumb.type = "image";
        var alink = figure.querySelector("a");
        if (alink) {
            thumb.name = alink.href;
        }
    }
    var caption = figure.querySelector("figcaption");
    if (caption) {
        thumb.caption = caption.innerHTML;
    }
    return thumb;
}

function runSectionTransforms(section) {
    var doc = domino.createDocument(section.text);
    delete section.text;

    // and break it down into items...
    section.items = [];
    var itemIndex = 0;
    var thumbnails, tid, thumb;
    var imageItem;

    var hatnotes = doc.querySelectorAll("div.hatnote") || [];
    for (var hid = 0; hid < hatnotes.length; hid++) {
        section.items[itemIndex] = {};
        section.items[itemIndex].type = "hatnote";
        section.items[itemIndex].text = hatnotes[hid].innerHTML;
        itemIndex++;
    }
    rmElementsWithSelector(doc, 'div.hatnote');

    // remove reference spans (we'll deal with them later)
    rmElementsWithSelector(doc, 'span.mw-ref');

    var ps = doc.querySelectorAll("p") || [];
    for (var pid = 0; pid < ps.length; pid++) {
        var p = ps[pid];

        if (p.innerHTML.length < 4) {
            continue;
        }

        if (p.textContent !== undefined && p.textContent.trim().length > 0) {
            section.items[itemIndex] = {};
            section.items[itemIndex].type = "p";
            section.items[itemIndex].text = p.innerHTML;
            itemIndex++;
        }

        // find all images in this paragraph, and append them as section items
        thumbnails = p.querySelectorAll("div.thumb") || [];
        for (tid = 0; tid < thumbnails.length; tid++) {
            thumb = thumbnails[tid];
            imageItem = structureThumbnail(thumb);
            if (imageItem.src) {
                section.items[itemIndex] = imageItem;
                itemIndex++;
            }
        }

        rmElementsWithSelector(p, 'div.thumb');
        // remove other inline images from this paragraph
        rmElementsWithSelector(p, 'img');
        // and remove this paragraph from the DOM
        p.parentNode.removeChild(p);
    }

    // find all images in this section (outside of paragraphs), and append them as section items
    thumbnails = doc.querySelectorAll("div.thumb") || [];
    for (tid = 0; tid < thumbnails.length; tid++) {
        thumb = thumbnails[tid];
        imageItem = structureThumbnail(thumb);
        if (imageItem.src) {
            section.items[itemIndex] = imageItem;
            itemIndex++;
        }
    }
    thumbnails = doc.querySelectorAll("figure") || [];
    for (tid = 0; tid < thumbnails.length; tid++) {
        thumb = thumbnails[tid];
        imageItem = structureThumbnail(thumb);
        if (imageItem.src) {
            section.items[itemIndex] = structureFigure(thumb);
            itemIndex++;
        }
    }

    return section;
}

module.exports = {
    NodeType: NodeType,
    runParsoidDomTransforms: runParsoidDomTransforms,
    runMainPageDomTransforms: runMainPageDomTransforms,
    runSectionTransforms: runSectionTransforms,

    // visible for testing only:
    _rmBracketSpans: rmBracketSpans,
    _rmElementsWithSelectors: rmElementsWithSelectors
};
