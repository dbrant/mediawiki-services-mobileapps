'use strict';

/**
 * @module routes/page/summary
 */

const lib = require('../../lib/summary');
const BBPromise = require('bluebird');
const mwapi = require('../../lib/mwapi');
const mwapiConstants = require('../../lib/mwapi-constants');
const mUtil = require('../../lib/mobile-util');
const parsoid = require('../../lib/parsoid-access');
const sUtil = require('../../lib/util');
const caching = require('../../lib/caching');

/**
 * The main router object
 */
const router = sUtil.router();

/**
 * The main application object reported when this module is require()d
 */
let app;

/**
 * GET {domain}/v1/page/summary/{title}{/revision?}{/tid?}
 * Title redirection status: redirects based on parsoid output
 * Extracts a summary of a given wiki page limited to one paragraph of text
 */
router.get('/summary/:title/:revision?/:tid?', caching.defaultCacheMiddleware, (req, res) => {
	req.getTitleRedirectLocation = (title) => title;
	const buildSummary = (title) => {
		req.params.title = title;
		// Check flagged revision for wikis that have enabled FlaggedRevs extension
		return BBPromise.resolve(mwapi.getFlaggedOrLatestRevision(req)).then(revision => {
			req.params.revision = revision;
			return BBPromise.join(
				parsoid.getParsoidHtml(req),
				mwapi.getMetadataForSummary(req, mwapiConstants.LEAD_IMAGE_S),
				mwapi.getSiteInfo(req),
				(html, meta, siteinfo) => {
					const revTid = parsoid.getRevAndTidFromEtag(html.headers);
					return lib.buildSummary(req.params.domain, req.params.title,
						html.body, revTid, meta, siteinfo, app.conf.processing_scripts.summary)
						.then((summary) => {
							res.status(summary.code);
							if (summary.code === 200) {
								delete summary.code;
								// Don't pass revTid.tid - this response depends on more than
								// parsoid output. For example, if a wikidata description is edited,
								// this response will be regenerated, which should trigger a change
								// in the ETag
								mUtil.setETag(res, revTid.revision);
								mUtil.setContentType(res, mUtil.CONTENT_TYPES.summary);
								mUtil.setLanguageHeaders(res, html.headers);
								res.json(summary);
							}
							res.end();
						});
				});
		});
	};
	if (app.conf.pcs_handles_redirects) {
		return buildSummary(req.params.title);
	}
	return BBPromise.resolve(mwapi.resolveTitleRedirect(req)).then(buildSummary);
});

module.exports = function(appObj) {
	app = appObj;
	return {
		path: '/page',
		api_version: 1,
		router
	};
};
