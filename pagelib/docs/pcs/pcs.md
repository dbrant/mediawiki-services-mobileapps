# PCS

The wikimedia-page-library-pcs output is an abstraction layer of the page library transforms. It includes the transforms implementation JS and CSS. It's meant to be used together with the HTML from [Page Content Service] mobile-html responses.

### What wikimedia-page-library-pcs is for

- to be hosted server-side for clients of PCS mobile-html
- to be run on a client inside a WebView or web browser
- a high level abstraction layer of wikimedia-page-library
- is an adapter of client side to server side mobile-html functionality
- providing an interface for manipulating the presentation of page content (theme, dim images, margins, ...)
- providing an interface for setting up expected event handling on the client side to complement server side DOM transformations (lazy loading, table collapsing, ...)
- providing an interface for retrieving metadata directly from the PCS page (lead image URL, page revision, description, ...)
- A specific major version knows which DOM transformations have been applied server side on a given page (by including the version in the URL for this adapter) and executes the corresponding client side functionality if and when needed (registering events).
  Examples:
  - Lazy Loading: server side we replace `<img>` tags with `<span>` placeholder elements. Then on the client side (here) we need to replace the placeholders back to the original `<img>` tags when appropriate.
  - Collapse / expand tables
  - Collapse / expand reference list sections

### What wikimedia-page-library-pcs is not for

- not to be bundled with native app versions

### Versions

There are two kinds of versions we are concerned about, client side and server side. Either side could be released and updated at different times than the other.

- Client PCS version: version coupled to clients. Some clients, like native app versions that cannot be or simply have not been updated. It's important to not break older or future clients of this library. These will be prefixed with a `c`, e.g. `c1`. The client-side version will be reflected in the folder/package structure of the exported JS modules.
- Server PCS version: version coupled to server-side mobile-html output. We may have different DOM transformations or different metadata encoded inside HTML in the future. These will be prefixed with a `s`, e.g. `s1`. The server-side version will be reflected in the URL to it when this library is referenced by mobile-html.

### Guidelines

- We plan to host multiple major versions server-side.
- Be liberal with what your API accepts!
  - Consider adding object parameters to functions and set sensible defaults to allow for future arguments to be passed without breaking older clients.
  - Apply some defaults where it’s reasonable to do so. Be prepared for nulls, undefined, or empty string values. Don’t bail when the backend returns additional unexpected properties - just ignore it. Enums: expect unexpected and ignore it.
  - Do not return primitive values. Return JS objects with only one field instead. If you want to return something in addition to the primitive value you won’t need a new API version.
- Identify platform using the `platform` parameter. This will enable platform-specific CSS.
- Identify the version of the PCS JS that the client supports with the `version` parameter. See the versions section below for more information
- Only create a new API version when you really have to. You can add new stuff to the current version if it doesn’t affect existing clients.
- Prepare for phasing out an API version. Some old versions you can’t afford to maintain. So define a process for informing clients that you may later not support their version.

## Test mode
You can specify the following query parameters for testing:
- `footer=true`: automatically adds the footer
- `theme={theme}`: set the theme to one of `sepia`, `dark`, `black`

## Versions

### 1

Initial version

### 2 (in development)

Adds support for Page Issues. Clients will need to support the `page_issues` interaction event

## Interface

Clients can set `document.pcsSetupSettings` to an object with the parameters for `pcs.c1.Page.setup()`. The page will apply theme and margin changes from this settings object in `onBodyStart()` before first paint and the rest of the settings after the page fully loads in `onBodyEnd()`. By applying theme and margin changes immediately, the page will no longer need to be hidden during loading by the clients.

Clients can also set `document.pcsActionHandler` to a function that takes a single parameter - an action object. The page call this function with `{action: 'setup'}` after initial setup completes and `{action: 'load_complete'}` when final setup is complete after all content has loaded. It will also make it the interaction handler for the page.

Alternatively, clients can set a `pcsClient` variable that will populate the aforementioned document properties by reading a JSON string from `pcsClient.getSetupSettings()` and passing a JSON string to `pcsClient.onReceiveMessage()`. This is for compatibility with `@JavascriptInterface` on Android.

### Page

#### onBodyStart() and onBodyEnd()

These should not be called directly by the clients. They will be invoked automatically at the start and end of the `body` tag.

#### setup()

Combination of the following calls, changing multiple settings in one single call. The settings are kept in an object. Calling this directly is not required if you set `document.pcsSetupSettings` or a `pcsClient` as defined above.

Setting parameter object fields:

- platform: possible values are 'ios' and 'android'
- version: integer pcs version
- loadImages: will images be loaded (defaults to true if omitted)
- theme: possible values are 'default', 'sepia', 'dark', and 'black'
- bodyFont: font family applied to the document body object, e.g. 'serif', 'sans-serif', etc.
- dimImages: boolean
- margins: object with { top, right, bottom, left }
- maxWidth: string to set for the max-width of the content. Use 'auto' for left and right margins to center the content when setting a max width
- leadImageHeight: string that is conditionally added to margins.top if there's a lead image on the page. Units should match margins.top if provided
- areTablesInitiallyExpanded: boolean (Default: tables are collapsed)
- scrollTop: number of pixel for highest position to scroll to. Use this to adjust for any decor overlaying the viewport.
  (The first four fields don't have any equivalent separate call since those don't make sense to change after the fact.)
- userGroups: list of strings of user roles to determine which edit pencils to show example: ['autoconfirmed']

Example:

```javascript
pcs.c1.Page.setup({
  platform: 'ios',
  version: 2,
  theme: 'sepia',
  bodyFont: 'sans-serif',
  dimImages: true,
  maxWidth: '100ex',
  margins: { top: '2em', right: 'auto', bottom: '0', left: 'auto' },
  leadImageHeight: '100px',
  areTablesInitiallyExpanded: true,
  talkPageButton: false,
  textSizeAdjustmentPercentage: '100%',
  scrollTop: 64,
  loadImages: true,
  userGroups: ['autoconfirmed']
})
```

#### setTheme()

Sets the theme. See possible values listed in `setup()`.

Example:

```javascript
pcs.c1.Page.setTheme(pcs.c1.Themes.SEPIA)
```

#### setDimImages()

Turns on or off dimming of images.

Example:

```javascript
pcs.c1.Page.setDimImages(true)
```

#### setMargins()

Sets the margins on the `<body>` tag.

Example:

```javascript
pcs.c1.Page.setMargins({ top: '128px', right: '32px', bottom: '16px', left: '32px' })
```

#### setMaxWidth()

Sets the max-width on the `<body>` tag.

Example:

```javascript
pcs.c1.Page.setMaxWidth('100ex')
```

#### setScrollTop()

Sets the top-most vertical position to scroll to in pixel. Use this to adjust for any decor overlaying the top of the viewport. Default: 0

Example:

```javascript
pcs.c1.Page.setScrollTop(64)
```

#### getProtection()

Gets the edit protections of the current page.

Example:

```javascript
pcs.c1.Page.getProtection()
```

Returns a map with protection status:

```json
{edit: "autoconfirmed", move: "sysop"}
```

#### getRevision()

Gets the revision of the current page as a string.

Example:

```javascript
pcs.c1.Page.getRevision()
```

returns `'907165344'`

#### getLeadImage()

Gets information about the lead image (aka PageImage) for this page.

Example:

```javascript
pcs.c1.Page.getLeadImage()
```

returns 

```json
{
  source: "https://upload.wikimedia.org/wikipedia/commons/0/0b/Cat_poster_1.jpg",
  width: 5935,
  height: 3898
}
```

#### getTableOfContents()

Gets the table of contents of the current page.

Example:

```javascript
pcs.c1.Page.getTableOfContents()
```

Returns an array of objects that correspond to sections in the article. An example JSON representation (with some sections removed for brevity) would be:

```json
[
  {
    "level": 1,
    "id": 1,
    "number": "1",
    "anchor": "Terminology",
    "title": "Terminology"
  },
  {
    "level": 1,
    "id": 2,
    "number": "2",
    "anchor": "Taxonomy",
    "title": "Taxonomy"
  },
  ...
  {
    "level": 2,
    "id": 5,
    "number": "4.1",
    "anchor": "Anatomy",
    "title": "Anatomy"
  },
  ...
  {
    "level": 1,
    "section": 45,
    "number": "14",
    "anchor": "External_links",
    "title": "External links"
  }
]
```

#### setTextSizeAdjustmentPercentage(percentageString)

Sets the text-adjust-size property percentage allowing native clients to adjust the font-size. This CSS property is not supported in all browsers, you can check which browsers support it in the following link, https://caniuse.com/#feat=text-size-adjust

The input needs to be a string like '10%'. Example:

```javascript
pcs.c1.Page.setTextSizeAdjustmentPercentage('10%')
```

#### setEditButtons(isEditable, isProtected)

Enables or disables the edit buttons on the page. The default is edit buttons are off but it's probably best to not assume that.
The second boolean is whether to show the protected edit pencils.

All parameters are optional. Default is false, false.

Example:

```javascript
pcs.c1.Page.setEditButtons(true, false)
```

#### setTalkPageButton(isVisible)

Enables or disables talk icon in the header

Example:

```javascript
pcs.c1.Page.setTalkPageButton(true)
```

#### prepareForScrollToAnchor(anchor, options)

Prepares the page to scroll to the given anchor by ensuring the content is completely loaded and the table or section that contains it isn't collapsed.

`anchor` is the element id of the element you want to scroll to
`options` an options object that currently only supports one parameter, a highlighted boolean that will highlight the element if true.

The page will indicate it's ready and return the [bounding client rect](https://developer.mozilla.org/en-US/docs/Web/API/Element/getBoundingClientRect) of the element through the `scroll_to_anchor` interaction event.

Example:

```javascript
pcs.c1.Page.prepareForScrollToAnchor('cite_ref-1', { highlight: true })
```

#### removeHighlightsFromHighlightedElements()

Removes highlights from any elements highlighted by `prepareForScrollToAnchor`

#### waitForNextPaint(callback)

Executes the function supplied as the parameter when the page has had time to update visually.

### Sections

A set of utilities to handle Sections properties.

#### getOffsets()

Gets Section Offsets object to handle quick scrolling in the table of contents.

Example:

```javascript
pcs.c1.Sections.getOffsets()
```

### Footer

#### add()

Adds a footer to the page showing metadata of the page, like how many other languages it's available in, when it was last edited, links to history, talk pages, read more, view in browser, license text, reference list.

Example:

```javascript
pcs.c1.Footer.add({
  platform: 'ios',
  version: '2',
  menu: {
    items: [pcs.c1.Footer.MenuItemType.lastEdited, pcs.c1.Footer.MenuItemType.pageIssues, pcs.c1.Footer.MenuItemType.disambiguation, pcs.c1.Footer.MenuItemType.talkPage],
    fragment: "pcs-menu",
    editedDaysAgo: 3
  },
  readMore: {
    itemCount: 3,
    baseURL: 'https://en.wikipedia.org/api/rest_v1',
    fragment: "pcs-read-more"
  }
})
```

* `readMore.baseURL`:
  * for production use something like `'https://en.wikipedia.org/api/rest_v1'`
  * for a local RESTBase instance use something like `'http://localhost:7231/en.wikipedia.org/v1'`

### InteractionHandling

Calling this directly is not required if you set `document.pcsActionHandler` or a `pcsClient` as defined above.

#### setInteractionHandler()

Sets up callbacks for select events originating from the WebView.

Example for testing:

```javascript
pcs.c1.InteractionHandling.setInteractionHandler((interaction) => { console.log(JSON.stringify(interaction)) })
```

iOS:

```javascript
pcs.c1.InteractionHandling.setInteractionHandler((interaction) => { window.webkit.messageHandlers.interaction.postMessage(interaction) })
```

Android:

```javascript
pcs.c1.InteractionHandling.setInteractionHandler((interaction) => { window.InteractionWebInterface.post(interaction) })
```

Currently the following actions can be emitted:

```javascript
const Actions = {
  InitialSetup: 'setup',
  FinalSetup: 'final_setup',
  LinkClicked: 'link',
  ImageClicked: 'image',
  ReferenceClicked: 'reference',
  BackLink: 'back_link',
  EditSection: 'edit_section',
  AddTitleDescription: 'add_title_description',
  PronunciationClicked: 'pronunciation',
  ScrollToAnchor: 'scroll_to_anchor',
  /* Footer related actions: */
  FooterItemSelected: 'footer_item',
  SaveOtherPage: 'save_other_page',
  ViewLicense: 'view_license',
  ViewInBrowser: 'view_in_browser',
}
```

**Future "proof"ing:** If clients don't recognize an event type, they should fallback on reading the 'href' and navigating to that link. This way, future events could be added without fully breaking compatibility with existing clients.

##### Events

###### back_link
Sent when a user taps a back link in a reference list. Provides a list of where that reference is used in the article. Example:
```json
{
  "action": "back_link",
  "data": {
    "referenceId": "cite_note-Thalmann2018-1",
    "backLinks": [
      {
        "id": "cite_ref-Thalmann2018_1-0"
      },
      {
        "id": "cite_ref-Thalmann2018_1-1"
      },
      {
        "id": "cite_ref-Thalmann2018_1-2"
      },
      {
        "id": "cite_ref-Thalmann2018_1-3"
      },
      {
        "id": "cite_ref-Thalmann2018_1-4"
      }
    ],
    "href": "./Dog#cite_ref-Thalmann2018_1-0"
  }
}
```

###### scroll_to_anchor
Sent when an anchor is ready to be scrolled to after the client calls `pcs.c1.Page.prepareForScrollToAnchor()`. Example:
```javascript
{
  "action": "scroll_to_anchor",
  "data": {
    "anchor": "elementid",
    "rect": {
      "x": 10,
      "y": 10,
      "width": 100,
      "height": 100
    },
    "href": "#elementid" // href is here for backwards compatibility / simplified client compatibility
  }
}
```

#### getSelectionInfo()

Gets information about the currently selected text.

Example for testing:

```javascript
pcs.c1.InteractionHandling.getSelectionInfo()
```

Should return something along the lines of:

```javascript
{
  text: "selected text here",
  section: "1", // section id or null if outside of a section
  isTitleDescription: false // true if the selection starts in the title description
}
```

[Page Content Service]: https://www.mediawiki.org/wiki/Page_Content_Service

## Expected behaviors

### Themes

Content can be excluded from theming if editors add the "notheme" class to the elements that have an explicit background color or should otherwise be excluded from themeing. More information about this can be found here: https://phabricator.wikimedia.org/T236137.

The overall problem is to allow editors and certain articles to bypass the styles of the themes for particular elements. There are now multiple layers of implementation for the solution to this challenge. They include:

**1. Restoration of the Default Theme and "No Theme" Portals**

Most of our theming is now implemented using CSS variables, whose values shift depending on the currently-applied theme. By adding the "notheme" class to any element, it now reapplies the default theme to that element (and to all child elements). The fact that this applies to not only the element containing the "notheme" class but also applies to all child elements is an important change from the previous behavior. It used to be the case that "notheme" had to be applied to every single element in a tree that needed custom styles. This led to some tricky code in the server transforms as well as some more cumbersome HTML.

**2. Overridable vs "Universal" Theme Overrides**

There were several places in the old styles that had formulations like "th:not(.notheme)" indicating that the style should only be applied in the absence of a "notheme" class applied to that element. The styles without this ":not(.notheme)" selector are considered "universal" as they are applied regardless of whether the user has applied the "notheme" class to an element. To achieve this same effect, we've added two new utilities "nonDefaultThemesUniversal" and "darkThemesOnlyUniversal" to pair with the existing "nonDefaultThemes" and "darkThemesOnly".

"nonDefaultThemes" and "darkThemesOnly" behave like styles did when appended with ":not(.notheme)". Such styles are only applied in the absence of the "notheme" class and when an element is not a child of an element with the "notheme" class. "nonDefaultThemesUniversal" and "darkThemesOnlyUniversal" are applied regardless of whether the element contains the "notheme" class or whether its parent contains the "notheme" class.

These utilities are used most extensively in the "ThemesTransform" file and should be avoided whenever possible. It's best to use CSS variables for theming as much as possible to avoid issues with CSS specificity.

#### Suggestions for CSS changes going forward

1. Eliminate the use of !important with respect to any style which an author might reasonably want to override. Many uses of !important in the existing stylesheets are in reference to position, margins, or sizes. These are more-or-less fine (although it's always better for you to not need any !important). But in any cases where !important is used because some other CSS rule in the base stylesheet or elsewhere is overwriting the mobileapps stylesheets, it's worth taking the time to refactor that rule and remove the !important.
2. Apply styles to IDs, tags, or classes separately. Avoid creating styles that target a mix of those selectors. For example, the rule "#mainpage a.pcs-edit-section-link" hits all three types of selectors, which can make it difficult to overwrite and maintain. Instead, consider whether it's possible to use fewer selectors to achieve the same result or whether the styles can be layered with selectors that target each type separately.
3. Try to keep specificity of selectors as low as possible (ideally 0,1,0). Consider adopting approaches such as BEM (http://getbem.com/introduction/) to reduce the specificity of CSS selectors. Where there are complex rules now (such as #pcs .dablink), consider a server-side transform that identifies these cases and adds a new class to the affected elements that can be targeted at lower specificity.
4. Minimize the use of the overridable "nonDefaultThemes" and "darkThemesOnly" utilities. Each of these utilities takes a rule (such as .mwe-math-fallback-image-inline) and converts it into something longer (.pcs-theme-dark :not(.notheme) .mwe-math-fallback-image-inline:not(.notheme)". That takes something with specificity (0,1,0) and turns it into something with specificity (0,4,0). This significantly higher specificity will make it harder to layer your CSS in ways you expect.
