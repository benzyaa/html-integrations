import Util from './util.js';
import StringManager from './stringmanager.js';
import ContentManager from './contentmanager.js';
import ModalDialog from './modal.js';
import ServiceProvider from './serviceprovider.js';
import Parser from './parser.js';
import Latex from './latex.js';
import MathML from './mathml.js';
import CustomEditors from './customeditors.js';
import Configuration from './configuration.js';
import jsProperties from './jsvariables.js';
import Event from './event.js';
import Listeners from './listeners.js';
import IntegrationModel from './integrationmodel.js';
import Image from './image.js';

/**
 * This class represents MathType integration Core, managing the following:
 * - Integration initialization.
 * - Event managing.
 * - Insertion of formulas into the edit area.
 * ```js
 *       let core = new Core();
 *       core.addListener(listener);
 *       core.language = 'en';
 *
 *       // Initializing Core class.
 *       core.init(configurationService);
 * ```
 */
export default class Core {

    /**
     * Class constructor.
     */
    constructor() {
        /**
         * Language. Needed for accessibility and locales. 'en' by default.
         * @type {String}
         */
        this.language = 'en';

        /**
         * Edit mode, 'images' by default. Admits the following values:
         * - images
         * - latex
         * @type {String}
         */
        this.editMode = 'images';

        /**
         * Modal dialog instance.
         * @type {ModalDialog}
         */
        this.modalDialog = null;

        /**
         * The instance of {@link CustomEditors}. By default
         * the only custom editor is the Chemistry editor.
         * @type {CustomEditors}
         */
        this.customEditors = new CustomEditors();

        /**
         * Chemistry editor.
         * @type {CustomEditor}
         */
        const chemEditorParams = {
            name: 'Chemistry',
            toolbar: 'chemistry',
            icon: 'chem.png',
            confVariable: 'chemEnabled',
            title: 'ChemType',
            tooltip: 'Insert a chemistry formula - ChemType' // TODO: Localize tooltip.
        }

        this.customEditors.addEditor('chemistry', chemEditorParams);

        /**
         * Environment properties. This object contains data about the integration platform.
         * @typedef IntegrationEnvironment
         * @property {String} IntegrationEnvironment.editor - Editor name. For example the HTML editor.
         * @property {String} IntegrationEnvironment.mode - Integration save mode.
         * @property {String} IntegrationEnvironment.version - Integration version.
         *
         */

        /**
         * The environment properties object.
         * @type {IntegrationEnvironment}
         */
        this.environment = {};

        /**
         * @typedef EditionProperties
         * @property {Boolean} editionProperties.isNewElement - True if the formula is a new one. False otherwise.
         * @property {HTMLImageElement} editionProperties.temporalImage- The image element. Null if the formula is new.
         * @property {Range} editionProperties.latexRange - Tha range that contains the LaTeX formula.
         * @property {Range} editionProperties.range - The range that contains the image element.
         * @property {String} editionProperties.editMode - The edition mode. 'images' by default.
         */

        /**
         * The properties of the current edition process.
         * @type {EditionProperties}
         */
        this.editionProperties = {}

        this.editionProperties.isNewElement = true;
        this.editionProperties.temporalImage = null;
        this.editionProperties.latexRange = null;
        this.editionProperties.range = null;

        /**
         * The {@link IntegrationModel} instance.
         * @type {IntegrationModel}
         */
        this.integrationModel = null;

        /**
         * The {@link ContentManager} instance.
         * @type {ContentManager}
         */
        this.contentManager = null;

        /**
         * The current browser.
         * @type {String}
         */
        this.browser = (
            function get_browser() {
                let ua = navigator.userAgent;
                if (ua.search("Edge/") >= 0) {
                    return "EDGE";
                } else if (ua.search("Chrome/") >= 0) {
                    return "CHROME";
                } else if (ua.search("Trident/") >= 0) {
                    return "IE";
                } else if (ua.search("Firefox/") >= 0) {
                    return "FIREFOX";
                } else if (ua.search("Safari/") >= 0) {
                    return "SAFARI";
                }
            }
        )();

        /**
         * Plugin listeners.
         * @type {Array.<Object>}
         */
        this.listeners = new Listeners();
    }

    /**
     * Static property.
     * Core listeners.
     * @private
     * @type {Listeners}
     */
    static get globalListeners() {
        return Core._globalListeners;
    }

    /**
     * Static property setter.
     * Set core listeners.
     * @param {Listeners} value - The property value.
     * @ignore
     */
    static set globalListeners(value) {
        Core._globalListeners = value;
    }

    /**
    * Static property.
    * Core string manager.
    * @private
    * @type {StringManager}
    */
    static get stringManager() {
        return Core._stringManager;
    }

    /**
     * Static property setter.
     * Set core string manager.
     * @param {StringManager} value - The property value.
     * @ignore
     */
    static set stringManager(value) {
        Core._stringManager = value;
    }

    /**
     * Initializes the {@link Core} class.
     * @param {String} configurationPath - The integration configuration service path.
     */
    init(configurationPath) {
        this.load(configurationPath);
    }

    /**
     * Sets the {@link Core.integrationModel} property.
     * @param {IntegrationModel} integrationModel - The {@link IntegrationModel} property.
     */
    setIntegrationModel(integrationModel) {
        this.integrationModel = integrationModel;
    }

    /**
     * Sets the {@link Core.environment} property.
     * @param {IntegrationEnvironment} integrationEnvironment - The {@link IntegrationEnvironment} object.
     */
    setEnvironment(integrationEnvironment) {
        if ('editor' in integrationEnvironment) {
            this.environment.editor = integrationEnvironment.editor;
        }
        if ('mode' in integrationEnvironment) {
            this.environment.mode = integrationEnvironment.mode;
        }
        if ('version' in integrationEnvironment) {
            this.environment.version = integrationEnvironment.version;
        }
    }

    /**
     * Returns the current {@link ModalDialog} instance.
     * @returns {ModalDialog} The current {@link ModalDialog} instance.
     */
    getModalDialog() {
        return this.modalDialog;
    }

    /**
     * Inits the {@link Core} class, doing the following:
     * - Calls asynchronously configuration service, retrieving the backend configuration in a JSON.
     * - Updates {@link Configuration} class with the previous configuration properties.
     * - Updates the {@link ServiceProvider} class using the configuration service path as reference.
     * - Loads language strings.
     * - Loads stylesheets.
     * - Fires onLoad event.
     * @param {String} configurationService - The integration configuration service path.
     */
    init(configurationService) {
        let httpRequest = typeof XMLHttpRequest != 'undefined' ? new XMLHttpRequest() : new ActiveXObject('Microsoft.XMLHTTP');
        ServiceProvider.integrationPath = configurationService.indexOf("/") == 0 || configurationService.indexOf("http") == 0 ? configurationService : Util.concatenateUrl(this.integrationModel.getPath(), configurationService);
        httpRequest.open('GET', ServiceProvider.integrationPath, false);
        // Async request.
        httpRequest.onload = function (e) {
            if (httpRequest.readyState === 4) {
                // Loading configuration variables.
                const jsonConfiguration = JSON.parse(httpRequest.responseText);
                Configuration.addConfiguration(jsonConfiguration);
                // Adding JavaScript (not backend) configuration variables.
                Configuration.addConfiguration(jsProperties);
                // Load service paths.
                ServiceProvider.init();
                // Load lang file.
                this.loadLanguage(this.language);
                this.loadCSS();
                // Fire 'onLoad' event. All integration must listen this event in order to know if the plugin has been properly loaded.
                // We need to wait until stringManager has been loaded.
                if (Core.stringManager === null) {
                    const stringManagerListener = Listeners.newListener('onLoad', () => {
                        this.listeners.fire('onLoad', {});
                    })
                    Core.stringManager.addListener(stringManagerListener);
                }
                else {
                    this.listeners.fire('onLoad', {});
                }

            }
        }.bind(this);
        httpRequest.send(null);
    }

    /**
     * Sets the {@link Core.integrationModel} property.
     * @param {IntegrationModel} integrationModel - The {@link IntegrationModel} property.
     */
    setIntegrationModel(integrationModel) {
        this.integrationModel = integrationModel;
    }

    /**
     * Sets the {@link Core.environment} property.
     * @param {IntegrationEnvironment} integrationEnvironment - The {@link IntegrationEnvironment} object.
     */
    setEnvironment(integrationEnvironment) {
        if ('editor' in integrationEnvironment) {
            this.environment.editor = integrationEnvironment.editor;
        }
        if ('mode' in integrationEnvironment) {
            this.environment.mode = integrationEnvironment.mode;
        }
        if ('version' in integrationEnvironment) {
            this.environment.version = integrationEnvironment.version;
        }
    }

    /**
     * Returns the current {@link ModalDialog} instance.
     * @returns {ModalDialog} The current {@link ModalDialog} instance.
     */
    getModalDialog() {
        return this.modalDialog;
    }

    /**
     * Loads the JavaScript language file and initializes {@link StringManager} class.
     * Uses the integration script path as base path to find strings.js file.
     * @param {String} language - The language identifier.
     */
    loadLanguage(language) {
        // Translated languages.
        const languages = 'ar,ca,cs,da,de,en,es,et,eu,fi,fr,gl,he,hr,hu,it,ja,ko,nl,no,pl,pt,pt_br,ru,sv,tr,zh,el';

        const langArray = languages.split(',');

        if (langArray.indexOf(language) == -1) {
            language = language.substr(0, 2);
        }

        if (langArray.indexOf(language) == -1) {
            language = 'en';
        }

        const script = document.createElement('script');
        script.type = 'text/javascript';
        script.src = this.integrationModel.getPath() + '/' + this.integrationModel.langFolderName + '/' + language + '/strings.js';
        // When strings are loaded, it loads into stringManager
        script.onload = function () {
            Core.getStringManager().loadStrings(wrs_strings);
        };
        document.getElementsByTagName('head')[0].appendChild(script);
    }

    /**
     * Appends the stylesheets to the head element.
     */
    loadCSS() {
        let fileRef = document.createElement("link");
        fileRef.setAttribute("rel", "stylesheet");
        fileRef.setAttribute("type", "text/css");
        fileRef.setAttribute("href", Util.concatenateUrl(this.integrationModel.getPath(), '/core/styles.css'));
        document.getElementsByTagName("head")[0].appendChild(fileRef);
    }

    /**
     * Adds a {@link Listener} to the current instance of the {@link Core} class.
     * @param {Listener} listener - The listener object.
     */
    addListener(listener) {
        this.listeners.add(listener);
    }

    /**
     * Adds the global {@link Listener} instance to {@link Core} class.
     * @param {Listener} listener - The event listener to be added.
     * @static
     */
    static addGlobalListener(listener) {
        Core.globalListeners.add(listener);
    }

    /**
     * Converts a MathML into it's correspondent image and inserts the image is inserted in a HTMLElement target by creating
     * a new image or updating an existing one.
     * @param {HTMLElement} focusElement - The HTMLElement to be focused after the insertion.
     * @param {Window} windowTarget - The window element where the editable content is.
     * @param {String} mathml - The MathML.
     * @param {Array.<Object>} wirisProperties - The extra attributes for the formula.
     */
    updateFormula(focusElement, windowTarget, mathml, wirisProperties) {
        /**
         * This event is fired after update the formula.
         * @type {Object}
         * @property {String} mathml - MathML to be transformed.
         * @property {String} editMode - Edit mode.
         * @property {Object} wirisProperties - Extra attributes for the formula.
         * @property {String} language - Formula language.
         */
        let beforeUpdateEvent = new Event();

        beforeUpdateEvent.mathml = mathml;

        // Cloning wirisProperties object
        // We don't want wirisProperties object modified.
        beforeUpdateEvent.wirisProperties = {};

        for (let attr in wirisProperties) {
            beforeUpdateEvent.wirisProperties[attr] = wirisProperties[attr];
        }

        // Read only.
        beforeUpdateEvent.language = this.language;
        beforeUpdateEvent.editMode = this.editMode;

        if (this.listeners.fire('onBeforeFormulaInsertion', beforeUpdateEvent)) {
            return;
        }

        if (Core.globalListeners.fire('onBeforeFormulaInsertion', beforeUpdateEvent)) {
            return;
        }

        mathml = beforeUpdateEvent.mathml;
        wirisProperties = beforeUpdateEvent.wirisProperties;

        /**
         * This event is fired after update the formula.
         * @type {Event}
         * @param {String} editMode - Edit mode.
         * @param {Object} windowTarget - Target window.
         * @param {Object} focusElement - Target element to be focused after update.
         * @param {String} latex - LaTeX generated by the formula (editMode=latex).
         * @param {Object} node - Node generated after update the formula (text if LaTeX img otherwise).
         */
        let afterUpdateEvent = new Event();
        afterUpdateEvent.editMode = this.editMode;
        afterUpdateEvent.windowTarget = windowTarget;
        afterUpdateEvent.focusElement = focusElement;

        if (!mathml) {
            this.insertElementOnSelection(null, focusElement, windowTarget);
        }
        else if (this.editMode == 'latex') {
            afterUpdateEvent.latex = Latex.getLatexFromMathML(mathml);
            // this.integrationModel.getNonLatexNode is an integration wrapper to have special behaviours for nonLatex.
            // Not all the integrations have special behaviours for nonLatex.
            if (!!this.integrationModel.fillNonLatexNode && !afterUpdateEvent.latex) {
                this.integrationModel.fillNonLatexNode(afterUpdateEvent, windowTarget, mathml);
            }
            else {
                afterUpdateEvent.node = windowTarget.document.createTextNode('$$' + afterUpdateEvent.latex + '$$');
            }
            this.insertElementOnSelection(afterUpdateEvent.node, focusElement, windowTarget);
        }
        else if (this.editMode == 'iframes') {
            const iframe = wrs_mathmlToIframeObject(windowTarget, mathml);
            this.insertElementOnSelection(iframe, focusElement, windowTarget);
        }
        else {
            afterUpdateEvent.node = Parser.mathmlToImgObject(windowTarget.document, mathml, wirisProperties, this.language);
            this.insertElementOnSelection(afterUpdateEvent.node, focusElement, windowTarget);
        }

        if (this.listeners.fire('onAfterFormulaInsertion', afterUpdateEvent)) {
            return;
        }

        if (Core.globalListeners.fire('onAfterFormulaInsertion', afterUpdateEvent)) {
            return;
        }
    }

    /**
     * Sets the caret after a given Node and set the focus to the owner document.
     * @param {Node} node - The Node element.
     */
    placeCaretAfterNode(node) {
        this.integrationModel.getSelection();
        const nodeDocument = node.ownerDocument;
        if (typeof nodeDocument.getSelection !== 'undefined' && !!node.parentElement) {
            const range = nodeDocument.createRange();
            range.setStartAfter(node);
            range.collapse(true);
            let selection = nodeDocument.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);
            nodeDocument.body.focus();
        }
    }

    /**
     * Replaces a Selection object with an HTMLElement.
     * @param {HTMLElement} element - The HTMLElement to replace the selection.
     * @param {HTMLElement} focusElement - The HTMLElement to be focused after the replace.
     * @param {Window} windowTarget - The window target.
     */
    insertElementOnSelection(element, focusElement, windowTarget) {
        if (this.editionProperties.isNewElement) {
            if (element) {
                if (focusElement.type == 'textarea') {
                    Util.updateTextArea(focusElement, element.textContent);
                }
                else if (document.selection && document.getSelection == 0) {
                    let range = windowTarget.document.selection.createRange();
                    windowTarget.document.execCommand('InsertImage', false, element.src);

                    if (!('parentElement' in range)) {
                        windowTarget.document.execCommand('delete', false);
                        range = windowTarget.document.selection.createRange();
                        windowTarget.document.execCommand('InsertImage', false, element.src);
                    }

                    if ('parentElement' in range) {
                        let temporalObject = range.parentElement();

                        if (temporalObject.nodeName.toUpperCase() == 'IMG') {
                            temporalObject.parentNode.replaceChild(element, temporalObject);
                        }
                        else {
                            // IE9 fix: parentNode() does not return the IMG node, returns the parent DIV node. In IE < 9, pasteHTML does not work well.
                            range.pasteHTML(Util.createObjectCode(element));
                        }
                    }
                }
                else {
                    const editorSelection = this.integrationModel.getSelection();
                    let range;
                    // In IE is needed keep the range due to after focus the modal window it can't be retrieved the last selection.
                    if (this.editionProperties.range) {
                        range = this.editionProperties.range;
                        this.editionProperties.range = null;
                    }
                    else {
                        range = editorSelection.getRangeAt(0);
                    }

                    // Delete if something was surrounded.
                    range.deleteContents();

                    let node = range.startContainer;
                    const position = range.startOffset;

                    if (node.nodeType == 3) { // TEXT_NODE.
                        node = node.splitText(position);
                        node.parentNode.insertBefore(element, node);
                    }
                    else if (node.nodeType == 1) { // ELEMENT_NODE.
                        node.insertBefore(element, node.childNodes[position]);
                    }

                    this.placeCaretAfterNode(element);
                }
            }
            else if (focusElement.type == 'textarea') {
                focusElement.focus();
            }
            else {
                const editorSelection = this.integrationModel.getSelection();
                editorSelection.removeAllRanges();

                if (this.editionProperties.range) {
                    const range = this.editionProperties.range;
                    this.editionProperties.range = null;
                    editorSelection.addRange(range);
                }
            }
        }
        else if (this.editionProperties.latexRange) {
            if (document.selection && document.getSelection == 0) {
                this.editionProperties.isNewElement = true;
                this.editionProperties.latexRange.select();
                this.insertElementOnSelection(element, focusElement, windowTarget);
            }
            else {
                this.editionProperties.latexRange.deleteContents();
                this.editionProperties.latexRange.insertNode(element);
                this.placeCaretAfterNode(element);
            }
        }
        else if (focusElement.type == "textarea") {
            let item;
            // Wrapper for some integrations that can have special behaviours to show latex.
            if (typeof this.integrationModel.getSelectedItem !== 'undefined') {
                item = this.integrationModel.getSelectedItem(focusElement, false);
            }
            else {
                item = Util.getSelectedItemOnTextarea(focusElement);
            }
            Util.updateExistingTextOnTextarea(focusElement, element.textContent, item.startPosition, item.endPosition);
        }
        else {
            if (element && element.nodeName.toLowerCase() === 'img') { // Editor empty, formula has been erased on edit.
                // Clone is needed to maintain event references to temporalImage.
                Image.clone(element, this.editionProperties.temporalImage);
            }
            else {
                this.editionProperties.temporalImage.remove();
            }

            this.placeCaretAfterNode(this.editionProperties.temporalImage);
        }
    }


    /**
     * Opens a modal dialog containing MathType editor..
     * @param {HTMLElement} target - The target HTMLElement where formulas should be inserted.
     * @param {Boolean} isIframe - True if the target HTMLElement is an iframe. False otherwise.
     */
    openModalDialog(target, isIframe) {
        // Textarea elements don't have normal document ranges. It only accepts latex edit.
        this.editMode = 'images';

        // In IE is needed keep the range due to after focus the modal window it can't be retrieved the last selection.
        try {
            if (isIframe) {
                // Is needed focus the target first.
                target.contentWindow.focus()
                const selection = target.contentWindow.getSelection();
                this.editionProperties.range = selection.getRangeAt(0);
            }
            else {
                // Is needed focus the target first.
                target.focus()
                const selection = getSelection();
                this.editionProperties.range = selection.getRangeAt(0);
            }
        }
        catch (e) {
            this.editionProperties.range = null;
        }

        if (isIframe === undefined) {
            isIframe = true;
        }

        this.editionProperties.latexRange = null;

        if (target) {
            let selectedItem;
            if (typeof this.integrationModel.getSelectedItem !== 'undefined') {
                selectedItem = this.integrationModel.getSelectedItem(target, isIframe);
            }
            else {
                selectedItem = Util.getSelectedItem(target, isIframe);
            }

            // Check LaTeX if and only if the node is a text node (nodeType==3).
            if (selectedItem) {
                // Case when image was selected and button pressed.
                if (!selectedItem.caretPosition && Util.containsClass(selectedItem.node,  Configuration.get('imageClassName'))) {
                    this.editionProperties.temporalImage = selectedItem.node;
                    this.editionProperties.isNewElement = false;
                }
                else if (selectedItem.node.nodeType === 3) {
                    // If it's a text node means that editor is working with LaTeX.
                    if (!!this.integrationModel.getMathmlFromTextNode) {
                        // If integration has this function it isn't set range due to we don't
                        // know if it will be put into a textarea as a text or image.
                        const mathml = this.integrationModel.getMathmlFromTextNode(
                            selectedItem.node,
                            selectedItem.caretPosition
                        );
                        if (mathml) {
                            this.editMode = 'latex';
                            this.editionProperties.isNewElement = false;
                            this.editionProperties.temporalImage = document.createElement('img');
                            this.editionProperties.temporalImage.setAttribute(
                                Configuration.get('imageMathmlAttribute'),
                                MathML.safeXmlEncode(mathml)
                            );
                        }
                    }
                    else {
                        const latexResult = Latex.getLatexFromTextNode(
                            selectedItem.node,
                            selectedItem.caretPosition
                        );
                        if (latexResult) {
                            const mathml = Latex.getMathMLFromLatex(latexResult.latex);
                            this.editMode = 'latex';
                            this.editionProperties.isNewElement = false;
                            this.editionProperties.temporalImage = document.createElement('img');
                            this.editionProperties.temporalImage.setAttribute(
                                Configuration.get('imageMathmlAttribute'),
                                MathML.safeXmlEncode(mathml)
                            );
                            const windowTarget = isIframe ? target.contentWindow : window;

                            if (target.tagName.toLowerCase() !== 'textarea') {
                                if (document.selection) {
                                    let leftOffset = 0;
                                    let previousNode = latexResult.startNode.previousSibling;

                                    while (previousNode) {
                                        leftOffset += Util.getNodeLength(previousNode);
                                        previousNode = previousNode.previousSibling;
                                    }

                                    this.editionProperties.latexRange = windowTarget.document.selection.createRange();
                                    this.editionProperties.latexRange.moveToElementText(
                                        latexResult.startNode.parentNode
                                    );
                                    this.editionProperties.latexRange.move(
                                        'character',
                                        leftOffset + latexResult.startPosition
                                    );
                                    this.editionProperties.latexRange.moveEnd(
                                        'character',
                                        latexResult.latex.length + 4
                                    ); // Plus 4 for the '$$' characters.
                                }
                                else {
                                    this.editionProperties.latexRange = windowTarget.document.createRange();
                                    this.editionProperties.latexRange.setStart(
                                        latexResult.startNode,
                                        latexResult.startPosition
                                    );
                                    this.editionProperties.latexRange.setEnd(
                                        latexResult.endNode,
                                        latexResult.endPosition
                                    );
                                }
                            }
                        }
                    }
                }

            }
            else if (target.tagName.toLowerCase() === 'textarea') {
                // By default editMode is 'images', but when target is a textarea it needs to be 'latex'.
                this.editMode = 'latex';
            }

        }

        // Setting an object with the editor parameters.
        // Editor parameters can be customized in several ways:
        // 1 - editorAttributes: Contains the default editor attributes, usually the metrics in a comma separated string. Always exists.
        // 2 - editorParameters: Object containing custom editor parameters. These parameters are defined in the backend. So they affects
        //     all integration instances.

        // The backend send the default editor attributes in a coma separated with the following structure:
        // key1=value1,key2=value2...
        const defaultEditorAttributesArray = Configuration.get('editorAttributes').split(", ");
        let defaultEditorAttributes = {};
        for (let i = 0, len = defaultEditorAttributesArray.length; i < len; i++) {
            const tempAttribute = defaultEditorAttributesArray[i].split('=');
            const key = tempAttribute[0];
            const value = tempAttribute[1];
            defaultEditorAttributes[key] = value;
        }
        // Custom editor parameters.
        let editorAttributes = {};
        Object.assign(editorAttributes, defaultEditorAttributes, Configuration.get('editorParameters'));
        editorAttributes.language = this.language;
        editorAttributes.rtl = this.integrationModel.rtl;

        let contentManagerAttributes = {}
        contentManagerAttributes.editorAttributes = editorAttributes;
        contentManagerAttributes.language = this.language;
        contentManagerAttributes.customEditors = this.customEditors;
        contentManagerAttributes.environment = this.environment;

        if (this.modalDialog == null) {
            this.modalDialog = new ModalDialog(editorAttributes);
            this.contentManager = new ContentManager(contentManagerAttributes);
            // When an instance of ContentManager is created we need to wait until the ContentManager is ready
            // by listening 'onLoad' event.
            const listener = Listeners.newListener(
                'onLoad',
                function() {
                    this.contentManager.isNewElement = this.editionProperties.isNewElement;
                    if (this.editionProperties.temporalImage != null) {
                        const mathML = MathML.safeXmlDecode(this.editionProperties.temporalImage.getAttribute(Configuration.get('imageMathmlAttribute')));
                        this.contentManager.mathML = mathML;
                    }
                }.bind(this)
            );
            this.contentManager.addListener(listener);
            this.contentManager.init();
            this.modalDialog.setContentManager(this.contentManager);
            this.contentManager.setModalDialogInstance(this.modalDialog);
        } else {
            this.contentManager.isNewElement = this.editionProperties.isNewElement;
            if (this.editionProperties.temporalImage != null) {
                const mathML = MathML.safeXmlDecode(this.editionProperties.temporalImage.getAttribute(Configuration.get('imageMathmlAttribute')));
                this.contentManager.mathML = mathML;
            }
        }
        this.contentManager.setIntegrationModel(this.integrationModel);
        this.modalDialog.open();
    }

    /**
     * Returns the current instance of the {@link ServiceProvider} class.
     * @returns {ServiceProvider} The {@link ServiceProvider} instance.
     */
    static getServiceProvider() {
        return Core.serviceProvider;
    }

    /**
     * Returns the current instance of the {@link StringManager} class.
     * @returns {StringManager} The {@link StringManager} instance
     */
    static getStringManager() {
        return Core.stringManager;
    }

    /**
     * Returns the {@link CustomEditors} instance.
     * @return {CustomEditors} The current {@link CustomEditors} instance.
     */
    getCustomEditors() {
        return this.customEditors;
    }

    /**
     * The global {@link Listeners} instance. {@link Core} class uses it to fire global events.
     * @type {Listeners}
     */
    static get globalListeners() {
        return Core._globalListeners;
    }

    /**
     * Sets the {@link Core.globalListeners} property.
     * @param {Listener} - A {@link Listener} instance.
     * @ignore
     */
    static set globalListeners(listener) {
        Core._globalListeners = listener;
    }

    /**
     * The {@link StringManager} instance. {@link Core} class uses it to load the locale strings.
     * @type {StringManager}
     */
    static get stringManager() {
        return Core._stringManager;
    }

    /**
     * Sets the {@link Core.stringManager} property.
     * @param {StringManager} - A {@link StringManager} instance.
     * @ignore
     */
    static set stringManager(stringManager) {
        Core._stringManager = stringManager;
    }
}

/**
 * Core static listeners.
 * @type {Listeners}
 * @private
 */
Core._globalListeners = new Listeners();

/**
 * Core string manager.
 * @type {StringManager}
 * @private
 */
Core._stringManager = new StringManager();