$(function() {

	// Publish form only (this file is loaded on every CP page)
	if (typeof EE === 'undefined' || ! EE.publish || window.GridPresets) {
		return;
	}

	// Shared with other features (e.g. pasting rows)
	window.GridPresets = {
		loadRows: loadRows
	};

	var URLS = <?php echo json_encode($urls); ?>;

	// Field types where presets store the checked state of each checkbox/radio input
	var CHECKABLE_FIELDTYPES = ['checkboxes', 'radio', 'selectable_buttons'];

	var CONTROLS_HTML = '<div class="grid-presets" style="display:flex; align-items:flex-end; justify-content:flex-end; gap:5px; margin-bottom:-5px;">'
		+ '<select class="grid-preset-select button--small" style="border-color:#cbcbda; text-align:left; padding-right:30px !important;"><option value="">- Select A Preset -</option></select> '
		+ '<input type="button" class="grid-preset-load btn button--small button--secondary-alt" value="Load"> '
		+ '<input type="button" class="grid-preset-delete btn button--small button--secondary-alt remove" value="Delete"> '
		+ '<input type="button" class="grid-preset-save btn button--small button--secondary-alt action" value="Save">'
		+ '</div>';

	// [fieldId][presetId] => {name, values, labels}
	var presets = {};
	var assetsActId = false;
	var ready = false;

	// Every Grid's field ID, including those in Fluid field templates,
	// so presets are already loaded when a Grid is added to a Fluid field
	var fieldIds = [];

	findGrids($(document), true).each(function() {
		var fieldId = getFieldId($(this));

		if (fieldIds.indexOf(fieldId) === -1) {
			fieldIds.push(fieldId);
		}
	});

	if ( ! fieldIds.length) {
		return;
	}

	watchFluidFields();

	request('get_presets')
		.done(function(response) {
			assetsActId = response.assets_act_id || false;
			ready = true;
			initGrids(findGrids($(document)));
		})
		.fail(function(jqXHR) {
			// Without access to the add-on, just don't show the buttons
			if (jqXHR.status == 403) {
				console.info('Grid Presets: this member role does not have access to the add-on');
			} else {
				console.warn('Grid Presets: ' + errorMessage(jqXHR));
			}
		});


	// ------------------------------------------------------------------
	// Grids

	// Grid/File Grid field ID from the Grid's id:
	// "field_id_12", or "field_id_4[fields][field_7][field_id_12]" in a Fluid field
	function getFieldId($grid) {
		var match = String($grid.attr('id') || '').match(/field_id_(\d+)\]?$/);

		return match ? parseInt(match[1], 10) : false;
	}

	function findGrids($context, includeTemplates) {
		return $context.find('.grid-field').addBack('.grid-field').filter(function() {
			return getFieldId($(this)) !== false
				&& (includeTemplates || $(this).closest('.fluid-field-templates').length === 0);
		});
	}

	// Content rows (not the blank template row or the "no rows" message)
	function getRows($grid) {
		return $grid.find('.grid-field__table').first()
			.children('tbody').children('tr')
			.not('.grid-blank-row, .no-results');
	}

	// Add the preset controls to each Grid (once)
	function initGrids($grids) {
		$grids.each(function() {
			var $grid = $(this);

			if ($grid.data('gridPresets')) {
				return;
			}

			var $controls = $(CONTROLS_HTML).data('grid', $grid);
			var $footer = $grid.children('.grid-field__footer');

			if ($footer.length) {
				$controls.insertBefore($footer);
			} else {
				$controls.appendTo($grid);
			}

			$grid.data('gridPresets', $controls);
			updateSelect($controls);
		});
	}

	// Grids added to a Fluid field later. FluidField.on() only allows one handler per
	// fieldtype (which Grid already uses), so wrap fireEvent to run after EE's handlers.
	function watchFluidFields() {
		if ( ! window.FluidField || typeof FluidField.fireEvent !== 'function') {
			return;
		}

		var fireEvent = FluidField.fireEvent;

		FluidField.fireEvent = function(fieldtypeName, action, args) {
			var result = fireEvent.apply(this, arguments);

			if (ready && action === 'add' && (fieldtypeName === 'grid' || fieldtypeName === 'file_grid') && args && args[0]) {
				initGrids(findGrids($(args[0])));
			}

			return result;
		};
	}

	// All preset controls for a field (the same Grid can appear more than once in a Fluid field)
	function getControls(fieldId) {
		return $('.grid-presets').filter(function() {
			var $grid = $(this).data('grid');

			return $grid && getFieldId($grid) === fieldId;
		});
	}

	// Refresh the preset menu
	function updateSelect($controls) {
		var fieldId = getFieldId($controls.data('grid'));
		var $select = $controls.find('select.grid-preset-select');

		$select.find('option').slice(1).remove();

		$.each(presets[fieldId] || {}, function(presetId, preset) {
			if (preset) {
				// as text, so names can't inject HTML
				$select.append($('<option>').val(presetId).text(preset.name));
			}
		});
	}

	function selectedText($select) {
		return $select.find('option').eq($select.prop('selectedIndex')).text();
	}


	// ------------------------------------------------------------------
	// Buttons

	// Load preset
	$(document).on('click', '.grid-presets .grid-preset-load', function() {
		var $controls = $(this).closest('.grid-presets');
		var $grid = $controls.data('grid');
		var fieldId = getFieldId($grid);
		var presetId = $controls.find('.grid-preset-select').val();

		if ( ! presetId) {
			return false;
		}

		var preset = presets[fieldId] && presets[fieldId][presetId];

		if ( ! preset) {
			alert('Preset not found');
			return false;
		}

		loadRows($grid, preset.values || {}, preset.labels || {});
	});

	// Save preset (new, or overwrite the selected one)
	$(document).on('click', '.grid-presets .grid-preset-save', function() {
		var $controls = $(this).closest('.grid-presets');
		var $grid = $controls.data('grid');
		var fieldId = getFieldId($grid);
		var $select = $controls.find('.grid-preset-select');
		var $rows = getRows($grid);

		if ( ! $rows.length) {
			alert('Add some rows to save them as a preset.');
			return false;
		}

		var presetId = $select.val();
		var presetName;

		if ( ! presetId) {
			presetId = 0;
			presetName = prompt('Please name your preset');

			if ( ! presetName) {
				return false;
			}
		} else {
			presetName = selectedText($select);

			if ( ! confirm("Overwrite this preset?\n'" + presetName + "'")) {
				return false;
			}
		}

		var labels = {};
		var rows = collectRows($rows, labels);

		request('save_preset', {
			field_id: fieldId,
			preset_id: presetId,
			name: presetName,
			values: JSON.stringify(rows),
			labels: JSON.stringify(labels)
		})
			.done(function(response) {
				getControls(fieldId).each(function() {
					updateSelect($(this));
				});

				// Select the saved preset
				$select.val(String(response.preset_id));
			})
			.fail(function(jqXHR) {
				alert(errorMessage(jqXHR));
			});
	});

	// Delete preset
	$(document).on('click', '.grid-presets .grid-preset-delete', function() {
		var $controls = $(this).closest('.grid-presets');
		var fieldId = getFieldId($controls.data('grid'));
		var $select = $controls.find('.grid-preset-select');
		var presetId = $select.val();

		if ( ! presetId) {
			return false;
		}

		if ( ! confirm("Are you sure you want to delete this preset?\n'" + selectedText($select) + "'")) {
			return false;
		}

		request('delete_preset', {field_id: fieldId, preset_id: presetId})
			.done(function() {
				getControls(fieldId).each(function() {
					updateSelect($(this));
				});
			})
			.fail(function(jqXHR) {
				alert(errorMessage(jqXHR));
			});
	});


	// ------------------------------------------------------------------
	// Requests

	function request(method, data) {
		data = $.extend({field_ids: fieldIds, CSRF_TOKEN: EE.CSRF_TOKEN}, data || {});

		return $.ajax({
			url: URLS[method],
			type: 'POST',
			data: data,
			dataType: 'json'
		}).done(function(response) {
			if (response && response.presets) {
				presets = response.presets;
			}
		});
	}

	function errorMessage(jqXHR) {
		if (jqXHR.status == 403) {
			return "You don't have access to Grid Presets. An administrator can give your member role access to the add-on.";
		}

		if (jqXHR.responseJSON && jqXHR.responseJSON.error) {
			return jqXHR.responseJSON.error;
		}

		return 'Grid Presets request failed' + (jqXHR.statusText ? ': ' + jqXHR.statusText : '');
	}


	// ------------------------------------------------------------------
	// Save

	// Rows as [ {columnId: [input values]} ], noting relationship titles in labels as {entryId: title}
	function collectRows($rows, labels) {
		var rows = [];

		$rows.each(function() {
			var row = {};

			$(this).children('td[data-fieldtype]').each(function(icol) {
				var $cell = $(this);
				var fieldtype = $cell.data('fieldtype');
				var values = [];

				if (fieldtype == 'relationship') {
					values = collectRelationship($cell, labels);

				} else if (CHECKABLE_FIELDTYPES.indexOf(fieldtype) !== -1) {
					// The checked state of each option (not EE's hidden input)
					$cell.find('input[type=checkbox], input[type=radio]').each(function() {
						values.push(this.checked ? $(this).val() : null);
					});

				} else {
					$cell.find('input, textarea, select').each(function() {
						values.push(this.type === 'file' ? null : $(this).val());
					});
				}

				row[$cell.data('column-id') || icol] = values;
			});

			rows.push(row);
		});

		return rows;
	}

	// Selected entry IDs, in order
	function collectRelationship($cell, labels) {
		var $field = $cell.find('div[data-relationship-react]').first();
		var $titles = $field.find('li.list-item .list-item__title');
		var entryIds = [];

		$field.find('input[type=hidden]').each(function() {
			if (this.value === '') {
				return;
			}

			var title = String($titles.eq(entryIds.length).contents().first().text()).trim();

			if (title) {
				labels[this.value] = title;
			}

			entryIds.push(this.value);
		});

		return entryIds;
	}


	// ------------------------------------------------------------------
	// Load

	// EE validates each field over AJAX (posting the whole form) when it changes. Filling rows
	// changes many fields at once, so skip those requests while loading; saving still validates.
	var validationPauses = 0;

	function pauseValidation() {
		var validation = EE.cp && EE.cp.formValidation;

		if (validation && typeof validation.pause === 'function') {
			validationPauses++;
			validation.pause(true);
		}
	}

	function resumeValidation() {
		var validation = EE.cp && EE.cp.formValidation;

		if ( ! validation || typeof validation.resume !== 'function') {
			return;
		}

		// Let the fieldtypes' own delayed change handlers run first
		setTimeout(function() {
			validationPauses = Math.max(0, validationPauses - 1);

			if (validationPauses === 0) {
				validation.resume();
			}
		}, 1000);
	}

	// Add a row for each set of values, then fill them in.
	// values: [ {columnId: [input values]} ] (older presets are keyed by column position)
	function loadRows($grid, values, labels) {
		var rowKeys = Object.keys(values || {});
		var existingRows = getRows($grid).length;
		var $addButton = $grid.find('.grid-field__footer .js-grid-add-row').first();

		if ( ! rowKeys.length || ! $addButton.length) {
			return;
		}

		pauseValidation();

		$.each(rowKeys, function() {
			$addButton.trigger('click');
		});

		// Wait for the new rows' fieldtypes to initialise
		setTimeout(function() {
			try {
				getRows($grid).slice(existingRows).each(function(irow) {
					if (irow < rowKeys.length) {
						fillRow($(this), values[rowKeys[irow]], labels || {});
					}
				});
			} finally {
				resumeValidation();
			}
		}, 0);
	}

	function fillRow($row, value, labels) {
		if (typeof value !== 'object' || value === null) {
			return;
		}

		// Older presets are keyed by column position (so include 0), newer ones by column ID (never 0)
		var keyedByPosition = ('0' in value);

		$row.children('td[data-fieldtype]').each(function(icol) {
			var $cell = $(this);
			var cellValue = value[keyedByPosition ? icol : $cell.data('column-id')];

			// Column isn't in this preset (e.g. added after the preset was saved)
			if (typeof cellValue === 'undefined' || cellValue === null) {
				return;
			}

			fillCell($cell, $cell.data('fieldtype'), cellValue, labels);
		});
	}

	function fillCell($cell, fieldtype, cellValue, labels) {

		if (fieldtype == 'relationship') {
			fillRelationship($cell, cellValue, labels);

		} else if (fieldtype == 'toggle') {
			// EE's toggle click handler flips the on/off class and sets the hidden input,
			// so only click when the state needs to change
			var $toggle = $cell.find('.toggle-btn');
			var toggleOn = (cellValue[0] == '1' || cellValue[0] == 'y');

			if ($toggle.length && $toggle.hasClass('on') !== toggleOn) {
				$toggle.trigger('click');
			}

		} else if (CHECKABLE_FIELDTYPES.indexOf(fieldtype) !== -1) {
			// Same inputs as saved (skips EE's hidden input before the options)
			$cell.find('input[type=checkbox], input[type=radio]').each(function(ifield) {
				var checked = !! cellValue[ifield];

				// Only click when the state differs, so options checked by default aren't toggled off.
				// A checked radio can't be unchecked by clicking; checking another option does that.
				if (this.checked !== checked && (checked || this.type === 'checkbox')) {
					var $label = $(this).closest('label');
					($label.length ? $label : $(this)).trigger('click');
				}
			});

		} else {
			fillInputs($cell, cellValue);
		}

		// Fieldtypes that need their display updating

		if (fieldtype == 'file') {
			// Just show the chosen file name
			if ($cell.find('[data-file-field-react]').length) {
				var fileValue = $cell.find('input').first().val();

				if (fileValue) {
					var filename = fileValue.replace(/^{.*}\s*/g, '');
					$cell.find('.fields-upload-chosen').removeClass('hidden').find('.fields-upload-chosen-name > div').attr('title', filename).text(filename);
					$cell.find('.file-field, .file-field__buttons').hide();
				}
			}
		}

		// Assets - load thumbnails via ACT
		if (fieldtype == 'assets' && assetsActId && cellValue) {
			$.ajax({
				url: '/',
				type: 'post',
				data: {
					'ACT': assetsActId,
					'requestId': 1,
					'view': 'thumbs',
					'thumb_size': 'small',
					'show_filenames': 'n',
					'file_id': cellValue
				},
				dataType: 'json',
				success: function(response) {
					$cell.find('.assets-thumbview > ul').html(response.html);
					$cell.find('.assets-buttons .assets-btn').off('click').addClass('assets-disabled');
					$cell.find('.assets-tv-file').css('width', 'auto');
					$cell.append('<style>' + response.css + '</style>');
				},
				error: function(jqXHR, textStatus, errorThrown) {
					console.log(textStatus, errorThrown);
				}
			});
		}

		if (fieldtype == 'rte') {
			fillRte($cell, 0);
		}

		if (fieldtype == 'colorpicker' && cellValue[0]) {
			$cell.find('.colorpicker__input-color span').css('background', cellValue[0]);
		}

		// EE's React dropdowns (Select, single Channel Images Select, ...) keep their own state
		refreshDropdowns($cell);

		// Channel Images Select (multi): rebuild the widget from its hidden input
		if ($cell.find('.cis-multi').length && window.ChannelImagesSelectMulti) {
			ChannelImagesSelectMulti.init($cell[0], true);
		}
	}

	// Re-render EE's React dropdowns with the loaded value selected
	function refreshDropdowns($cell) {
		if (typeof Dropdown === 'undefined' || typeof ReactDOM === 'undefined') {
			return;
		}

		$cell.find('div[data-dropdown-react]').each(function() {
			var value = $(this).find('input[type=hidden]').first().val();

			if ( ! value) {
				return;
			}

			// A value missing from the options would render empty, so leave those as they are
			var props = JSON.parse(window.atob($(this).data('dropdownReact')));

			if ( ! hasDropdownItem(props.items, value)) {
				return;
			}

			$(this).data('initialValue', value);
			ReactDOM.unmountComponentAtNode(this);
			Dropdown.renderFields($(this).parent());
		});
	}

	function hasDropdownItem(items, value) {
		var found = false;

		$.each(items || [], function(i, item) {
			if (item && (item.value == value || hasDropdownItem(item.children, value))) {
				found = true;
				return false;
			}
		});

		return found;
	}

	// Inputs in the order they were saved
	function fillInputs($cell, cellValue) {
		$cell.find('input, textarea, select').each(function(ifield) {
			var $field = $(this);
			var fieldValue = cellValue[ifield];

			if (typeof fieldValue === 'undefined' || fieldValue === null || this.type === 'file') {
				return;
			}

			if ($field.is('select')) {
				var selectValues = Array.isArray(fieldValue) ? fieldValue : [fieldValue];

				// Add any options that aren't there (e.g. added through the field, or removed since)
				$.each(selectValues, function(i, optionValue) {
					var optionExists = $field.find('option').filter(function() {
						return this.value == optionValue;
					}).length > 0;

					if ( ! optionExists && optionValue !== '' && optionValue !== null) {
						$field.prepend($('<option>').val(optionValue).text(optionValue));
					}
				});

				$field.val(this.multiple ? selectValues : fieldValue);

				// Chosen (e.g. MX Select Plus) only redraws when told to
				$field.trigger('liszt:updated').trigger('chosen:updated');

			// other fieldtypes' checkboxes and radios
			} else if ($field.is('input[type=checkbox], input[type=radio]')) {
				if (fieldValue && ! this.checked) {
					$field.closest('label').trigger('click');
				}

			} else {
				$field.val(fieldValue);
			}

			// React dropdown
			$field.closest('.select__button-label').find('i').text(fieldValue);
		});
	}

	// Rich Text: the editor is created when the row is added (before the textarea is filled),
	// so pass the content to it once it exists
	function fillRte($cell, attempts) {
		var textarea = $cell.find('textarea').get(0);

		if ( ! textarea) {
			return;
		}

		var html = textarea.value;

		// RedactorX
		if (window.RedactorX && RedactorX.dom) {
			var redactorX = RedactorX.dom(textarea).dataget(RedactorX.namespace);

			if (redactorX && redactorX.editor) {
				redactorX.editor.setContent({html: html});
				return;
			}
		}

		// Redactor
		if ($cell.find('.redactor-box').length && typeof $R !== 'undefined') {
			$R('#' + textarea.id, 'source.setCode', html);
			return;
		}

		// CKEditor (created asynchronously)
		var $editable = $cell.find('.ck-editor__editable');

		if ($editable.length && $editable[0].ckeditorInstance) {
			$editable[0].ckeditorInstance.setData(html);
			return;
		}

		// Deferred editor: a preview until clicked (the editor is then created from the textarea)
		var $preview = $cell.find('iframe.rte');

		if ($preview.length) {
			$preview[0].contentWindow.document.body.innerHTML = html;
			return;
		}

		// Editor not ready yet
		if (attempts < 50) {
			setTimeout(function() {
				fillRte($cell, attempts + 1);
			}, 100);
		}
	}

	// Re-render EE's relationship field with the preset's entries selected
	function fillRelationship($cell, entryIds, labels) {
		var $field = $cell.find('div[data-relationship-react]').first();

		if ( ! $field.length || typeof Relationship === 'undefined' || typeof ReactDOM === 'undefined') {
			return;
		}

		var props = JSON.parse(window.atob($field.data('relationshipReact')));
		var items = Array.isArray(props.items) ? props.items : $.map(props.items || {}, function(item) {
			return item;
		});
		var selected = [];

		$.each(entryIds, function(i, entryId) {
			if (entryId === '' || entryId === null) {
				return;
			}

			// Use the field's own entry details if it has them
			var item = null;

			$.each(items, function(j, candidate) {
				if (candidate && candidate.value == entryId) {
					item = candidate;
					return false;
				}
			});

			selected.push(item || {
				value: entryId,
				label: labels[entryId] || ('Entry #' + entryId),
				instructions: '',
				status: ''
			});
		});

		if ( ! props.multi) {
			selected = selected.slice(0, 1);
		}

		props.name = $field.data('inputValue');
		props.selected = selected;

		ReactDOM.unmountComponentAtNode($field[0]);
		ReactDOM.render(React.createElement(Relationship, props, null), $field[0]);
	}

});
