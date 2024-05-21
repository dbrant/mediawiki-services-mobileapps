import assert from 'assert';
import domino from 'domino';
import pagelib from '../../build/wikimedia-page-library-transform.js';

describe( 'PlatformTransform', () => {
	describe( '.setPlatform()', () => {
		it( 'android', () => {
			const document = domino.createDocument( '' );
			pagelib.PlatformTransform.setPlatform( document, pagelib.PlatformTransform.CLASS.ANDROID );
			const classes = document.documentElement.classList;
			assert.ok( classes.contains( pagelib.PlatformTransform.CLASS.ANDROID ) );
			assert.strictEqual( classes.length, 1 );
		} );
	} );

	describe( '.setVersion()', () => {
		it( 'v2', () => {
			const document = domino.createDocument( '' );
			pagelib.PlatformTransform.setVersion( document, 1 );
			const classes = document.documentElement.classList;
			assert.ok( classes.contains( 'pcs-v1' ) );
			assert.ok( !classes.contains( 'pcs-v2' ) );
			pagelib.PlatformTransform.setVersion( document, 2 );
			assert.ok( classes.contains( 'pcs-v1' ) );
			assert.ok( classes.contains( 'pcs-v2' ) );
		} );
	} );

	describe( '.classify()', () => {
		const testUserAgent = ( userAgent ) => {
			const window = domino.createWindow();
			Object.defineProperty( window, 'navigator', { value: { userAgent } } );

			pagelib.PlatformTransform.classify( window );

			return window.document.documentElement.classList;
		};

		it( 'unknown', () => {

			const classes = testUserAgent( 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Ubuntu Chromium/59.0.3071.109 Chrome/59.0.3071.109 Safari/537.36' );
			assert.strictEqual( classes.length, 0 );
		} );

		it( 'android', () => {

			const classes = testUserAgent( 'Mozilla/5.0 (Linux; Android 7.1.2; Pixel XL Build/NKG47L; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/59.0.3071.125 Mobile Safari/537.36' );
			assert.ok( classes.contains( pagelib.PlatformTransform.CLASS.ANDROID ) );
			assert.strictEqual( classes.length, 1 );
		} );

		it( 'ios', () => {

			const classes = testUserAgent( 'Mozilla/5.0 (iPhone; CPU iPhone OS 10_2_1 like Mac OS X) AppleWebKit/602.4.6 (KHTML, like Gecko) Version/10.0 Mobile/14D27 Safari/602.1' );
			assert.ok( classes.contains( pagelib.PlatformTransform.CLASS.IOS ) );
			assert.strictEqual( classes.length, 1 );
		} );
	} );
} );
