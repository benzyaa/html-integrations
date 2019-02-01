import Plugin from '@ckeditor/ckeditor5-core/src/plugin';
import ButtonView from '@ckeditor/ckeditor5-ui/src/button/buttonview';
import ClickObserver from '@ckeditor/ckeditor5-engine/src/view/observer/clickobserver';
import { keyCodes } from '@ckeditor/ckeditor5-utils/src/keyboard';

import { integrationModelProperties } from '../core/src/integrationmodel';

import MathML from './mathml';

import { downcast } from './conversion/downcast';
import { postFixer } from './conversion/post-fixer';
import MathTypeEditor from './commands/mathtypeeditor';
import ChemTypeEditor from './commands/chemtypeeditor';
import CKEditor5Integration from './integration';

import mathIcon from '../theme/icons/formula.svg';
import chemIcon from '../theme/icons/chem.svg';

export default class MathType extends Plugin {

    static get requires() {
        return [ MathML ];
    }

    static get pluginName() {
        return 'MathType';
    }

    init() {
        
        const editor = this.editor;
        
        // Downcaster that converts MathML to Wirisformula <img>
        editor.conversion.for( 'editingDowncast' ).add( downcast( editor ) );

        // Post-fix to remove the contents of <img> element
        // (which after downcast should be equal to the tree under <math>)
        editor.editing.view.document.registerPostFixer( postFixer( editor ) );

        // Add integration properties
        /**
         * Integration model constructor attributes.
         * @type {integrationModelProperties}
         */
        const integrationProperties = {};
        integrationProperties.environment = {};
        integrationProperties.environment.editor = 'CKEditor5';
        integrationProperties.editorObject = editor;
        integrationProperties.configurationService = '@param.js.configuration.path@';
        integrationProperties.target = editor.sourceElement;
        integrationProperties.scriptName = 'bundle.js';
        integrationProperties.managesLanguage = true;
        // etc

        // There are platforms like Drupal that initialize CKEditor but they hide or remove the container element.
        // To avoid a wrong behaviour, this integration only starts if the workspace container exists.
        let integration;
        if ( integrationProperties.target ) {
            // Instance of the integration associated to this editor instance
            integration = new CKEditor5Integration( integrationProperties );
            integration.init();
            integration.listeners.fire( 'onTargetReady', {} );

            integration.checkElement();

            this.listenTo( editor.editing.view.document, 'click', ( evt, data ) => {
                // Is double click
                if ( data.domEvent.detail == 2 ) {
                    integration.doubleClickHandler( data.domTarget, data.domEvent );
                    evt.stop();
                }
            }, { priority: 'highest' } );

        }

        // Add command to open the formula editor
        editor.commands.add( 'MathTypeEditor', new MathTypeEditor( editor ) );

        // Add command to open the chemistry formula editor
        editor.commands.add( 'ChemTypeEditor', new ChemTypeEditor( editor ) );

        // Add button for the formula editor
        editor.ui.componentFactory.add( 'MathTypeEditor', locale => {
            const view = new ButtonView( locale );

            view.set( {
                label: 'Insert a math equation - MathType',
                icon: mathIcon, // TODO CKEditor5 requires SVG icons
                tooltip: true
            } );

            // Callback executed once the image is clicked.
            view.on( 'execute', () => {
                editor.execute( 'MathTypeEditor', {
                    'integration': integration, // Pass integration as parameter
                } );
            } );

            return view;
        } );

        // Add button for the chemistry formula editor
        editor.ui.componentFactory.add( 'ChemTypeEditor', locale => {
            const view = new ButtonView( locale );

            view.set( {
                label: 'Insert a chemistry formula - ChemType',
                icon: chemIcon, // TODO CKEditor5 requires SVG icons
                tooltip: true
            } );

            // Callback executed once the image is clicked.
            view.on( 'execute', () => {
                editor.execute( 'ChemTypeEditor', {
                    'integration': integration, // Pass integration as parameter
                } );
            } );

            return view;
        } );

        editor.editing.view.addObserver( ClickObserver );

        editor.editing.view.document.on( 'keydown', jumpOverMath );
        
        // Move cursor from the end of the inline filler to the beginning of it when, so the filler does not break navigation.
        function jumpOverMath( evt, data ) {
            if ( data.keyCode == keyCodes.arrowleft ) {
                const domSelection = data.domTarget.ownerDocument.defaultView.getSelection();

                if ( domSelection.rangeCount == 1 && domSelection.getRangeAt( 0 ).collapsed ) {
                    const domParent = domSelection.getRangeAt( 0 ).startContainer;

                    if ( domParent.nodeName == 'img' && domParent.classList.contains( 'Wirisformula' ) ) {
                        domSelection.collapse( domParent.parentNode, Array.from( domParent.parentNode.children ).indexOf( domParent ) );
                    }

                }

            } else if ( data.keyCode == keyCodes.arrowright ) {
                const domSelection = data.domTarget.ownerDocument.defaultView.getSelection();

                if ( domSelection.rangeCount == 1 && domSelection.getRangeAt( 0 ).collapsed ) {
                    const domParent = domSelection.getRangeAt( 0 ).startContainer;

                    if ( domParent.nodeName == 'img' && domParent.classList.contains( 'Wirisformula' ) ) {
                        domSelection.collapse( domParent.parentNode, Array.from( domParent.parentNode.children ).indexOf( domParent ) + 1 );
                    }

                }

            }
        }

    }

}