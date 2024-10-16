#!/usr/bin/env node

'use strict';

const fs = require('fs');
const path = require('path');
const util = require('util');
const writeFile = util.promisify(fs.writeFile);

const url = 'https://en.m.wikipedia.org/w/load.php?lang=en&modules=ext.cite.styles|ext.wikimediamessages.styles|ext.math.styles|ext.timeline.styles|mediawiki.hlist|mobile.init.styles|skins.minerva.base.styles&only=styles&skin=minerva';

fetch(url)
	.then(res => res.text())
	.then(body => {
		const css = body;
		return writeFile(path.join(__dirname, 'private/base.css'), css);
	});
