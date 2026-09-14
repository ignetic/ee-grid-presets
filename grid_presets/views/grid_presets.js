$(function() {

	// Publish form only (this file is loaded on every CP page)
	if (typeof EE === 'undefined' || ! EE.publish || window.GridPresets) {
		return;
	}

	// Shared with other features
	window.GridPresets = {
		loadRows: loadRows
	};

	var URLS = <?php echo json_encode($urls); ?>;

	// Field types where presets store the checked state of each checkbox/radio input
	var CHECKABLE_FIELDTYPES = ['checkboxes', 'radio', 'selectable_buttons'];

	// Field types that pasting doesn't fill
	var UNPASTEABLE_FIELDTYPES = ['file', 'assets', 'channel_images_select'];

	// Rows shown in the paste preview
	var PREVIEW_ROWS = 8;

	var CONTROLS_HTML = '<div class="grid-presets" style="display:flex; align-items:flex-end; justify-content:flex-end; gap:5px; margin-bottom:-5px;">'
		+ '<input type="button" class="grid-preset-copy btn button--small button--secondary-alt" value="Copy" title="Copy the rows, to paste into a spreadsheet or another Grid">'
		+ '<input type="button" class="grid-preset-paste btn button--small button--secondary-alt" value="Paste" title="Paste rows from a copied table, spreadsheet or text" style="margin-right:auto;">'
		+ '<select class="grid-preset-select button--small" style="border-color:#cbcbda; text-align:left; padding-right:30px !important;"><option value="">- Select A Preset -</option></select> '
		+ '<input type="button" class="grid-preset-load btn button--small button--secondary-alt" value="Load"> '
		+ '<input type="button" class="grid-preset-delete btn button--small button--secondary-alt remove" value="Delete"> '
		+ '<input type="button" class="grid-preset-save btn button--small button--secondary-alt action" value="Save">'
		+ '</div>';

	var PASTE_PANEL_HTML = '<div class="grid-presets-paste">'
		+ '<textarea class="grid-presets-paste__input" rows="3" placeholder="Click here and paste (Ctrl+V): a copied table, spreadsheet cells, or tab/space separated text"></textarea>'
		+ '<div class="grid-presets-paste__preview"></div>'
		+ '</div>';

	var PASTE_STYLES = '<style>'
		+ '.grid-presets-paste{margin:12px 0 0;padding:12px;border:1px solid #cbcbda;border-radius:5px}'
		+ '.grid-presets-paste__input{width:100%;min-height:60px;font-family:monospace;font-size:12px}'
		+ '.grid-presets-paste__options{display:flex;flex-wrap:wrap;gap:20px;margin:10px 0}'
		+ '.grid-presets-paste__options label{display:flex;gap:6px;align-items:center;cursor:pointer;font-weight:normal}'
		+ '.grid-presets-paste__table-wrap{overflow-x:auto}'
		+ '.grid-presets-paste__table{border-collapse:collapse;width:100%;font-size:12px}'
		+ '.grid-presets-paste__table th,.grid-presets-paste__table td{border:1px solid #dfe0ef;padding:4px 6px;text-align:left;vertical-align:top;white-space:pre-line}'
		+ '.grid-presets-paste__table select{width:100%;min-width:120px;font-size:12px}'
		+ '.grid-presets-paste__unmatched{background:#fde8e8;color:#b3261e}'
		+ '.grid-presets-paste__summary{margin:10px 0}'
		+ '.grid-presets-paste__buttons{display:flex;flex-wrap:wrap;gap:6px}'
		+ '</style>';

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

	$('head').append(PASTE_STYLES);

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

	function getTable($grid) {
		return $grid.find('.grid-field__table').first();
	}

	// Content rows (not the blank template row or the "no rows" message)
	function getRows($grid) {
		return getTable($grid)
			.children('tbody').children('tr')
			.not('.grid-blank-row, .no-results');
	}

	// The Grid's maximum rows (0 = no limit)
	function maxRows($grid) {
		var instance = $grid.data('GridInstance');
		var settings = (instance && instance.settings) || getTable($grid).data('grid-settings') || {};
		var max = parseInt(settings.grid_max_rows, 10);

		return max > 0 ? max : 0;
	}

	// Add up to `count` rows, stopping at the Grid's maximum. Returns the number added.
	function addRows($grid, count) {
		var instance = $grid.data('GridInstance');
		var $addButton = $grid.find('.grid-field__footer .js-grid-add-row').first();
		var max = maxRows($grid);
		var added = 0;

		while (added < count && ( ! max || getRows($grid).length < max)) {
			if (instance && typeof instance._addRow === 'function') {
				instance._addRow();
			} else if ($addButton.length) {
				$addButton.trigger('click');
			} else {
				break;
			}

			added++;
		}

		return added;
	}

	// Remove all rows, the same way as each row's remove button
	function removeRows($grid) {
		getRows($grid).each(function() {
			var $remove = $(this).find('[rel=remove_row]').first();

			if ($remove.length) {
				$remove.trigger('click');
			} else {
				$(this).remove();
			}
		});
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
	// values: [ {columnId: [input values]} ] (older presets are keyed by column position),
	// or with options.pasted, [ {columnId: 'pasted text'} ].
	// options.replace removes the existing rows first. Stops at the Grid's maximum rows.
	function loadRows($grid, values, labels, options) {
		var rowKeys = Object.keys(values || {});

		options = options || {};
		labels = labels || {};

		if ( ! rowKeys.length) {
			return;
		}

		pauseValidation();

		if (options.replace) {
			removeRows($grid);
		}

		var existingRows = getRows($grid).length;
		var added = addRows($grid, rowKeys.length);

		// Wait for the new rows' fieldtypes to initialise
		setTimeout(function() {
			try {
				getRows($grid).slice(existingRows, existingRows + added).each(function(irow) {
					fillRow($(this), values[rowKeys[irow]], labels, options.pasted);
				});
			} finally {
				resumeValidation();
			}
		}, 0);
	}

	function fillRow($row, value, labels, pasted) {
		if (typeof value !== 'object' || value === null) {
			return;
		}

		// Older presets are keyed by column position (so include 0), newer ones by column ID (never 0)
		var keyedByPosition = ('0' in value);

		$row.children('td[data-fieldtype]').each(function(icol) {
			var $cell = $(this);
			var fieldtype = $cell.data('fieldtype');
			var cellValue = value[keyedByPosition ? icol : $cell.data('column-id')];

			// Column isn't in this preset (e.g. added after the preset was saved)
			if (typeof cellValue === 'undefined' || cellValue === null) {
				return;
			}

			// Pasted text: match it to this cell's options and inputs
			if (pasted) {
				cellValue = resolvePasted($cell, fieldtype, cellValue, labels).value;

				if (typeof cellValue === 'undefined') {
					return;
				}
			}

			fillCell($cell, fieldtype, cellValue, labels);
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

			if ( ! findItem(props.items, value)) {
				return;
			}

			$(this).data('initialValue', value);
			ReactDOM.unmountComponentAtNode(this);
			Dropdown.renderFields($(this).parent());
		});
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
		var items = listItems(props.items);
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


	// ------------------------------------------------------------------
	// Copy rows

	// Copy the Grid's rows (with a headings row) as an HTML table and tab separated text,
	// so they paste into spreadsheets, or back into a Grid (matched by column name)
	$(document).on('click', '.grid-presets .grid-preset-copy', function() {
		var $button = $(this);
		var copied = copyRows($button.closest('.grid-presets').data('grid'));

		if ( ! copied.count) {
			alert('There are no rows to copy.');
			return false;
		}

		writeClipboard(copied.html, copied.text).then(function() {
			flashButton($button, 'Copied ' + copied.count + (copied.count == 1 ? ' row' : ' rows'));
		}, function() {
			alert('The rows could not be copied to the clipboard.');
		});
	});

	function copyRows($grid) {
		var columns = getColumns($grid);
		var headings = columns.map(function(column) {
			return column.label;
		});
		var rows = [];

		getRows($grid).each(function() {
			var $cells = $(this).children('td[data-fieldtype]');

			rows.push(columns.map(function(column, i) {
				var $cell = $cells.eq(i);

				return $cell.length ? copyText($cell, column.fieldtype) : '';
			}));
		});

		var text = [headings].concat(rows).map(function(row) {
			return row.map(tabbedCell).join('\t');
		}).join('\n');

		// Excel keeps <br> in the same cell only with this style
		var html = '<table><thead><tr>'
			+ headings.map(function(heading) {
				return '<th>' + escapeHtml(heading) + '</th>';
			}).join('')
			+ '</tr></thead><tbody>'
			+ rows.map(function(row) {
				return '<tr>' + row.map(function(value) {
					return '<td>' + escapeHtml(value).replace(/\n/g, '<br style="mso-data-placement:same-cell;">') + '</td>';
				}).join('') + '</tr>';
			}).join('')
			+ '</tbody></table>';

		return {text: text, html: html, count: rows.length};
	}

	// A cell's value as readable text (the reverse of pasting): option labels rather than values
	function copyText($cell, fieldtype) {
		if (fieldtype == 'relationship') {
			var $field = $cell.find('div[data-relationship-react]').first();
			var titles = [];

			// One title per line (titles can contain commas)
			$field.find('li.list-item .list-item__title').each(function() {
				titles.push(String($(this).contents().first().text()).trim());
			});

			if ( ! titles.length) {
				$field.find('input[type=hidden]').each(function() {
					if (this.value !== '') {
						titles.push(this.value);
					}
				});
			}

			return titles.join('\n');
		}

		if (fieldtype == 'toggle') {
			var $toggle = $cell.find('.toggle-btn');

			return $toggle.length ? ($toggle.hasClass('on') ? 'Yes' : 'No') : '';
		}

		if (CHECKABLE_FIELDTYPES.indexOf(fieldtype) !== -1) {
			var checked = [];

			$cell.find('input[type=checkbox], input[type=radio]').each(function() {
				if (this.checked) {
					checked.push(optionLabel(this) || this.value);
				}
			});

			return checked.join(', ');
		}

		// EE's React dropdown: the selected item's label
		var $dropdown = $cell.find('div[data-dropdown-react]').first();

		if ($dropdown.length) {
			var value = $dropdown.find('input[type=hidden]').first().val() || '';
			var item = value !== '' ? findItem(reactProps($dropdown, 'dropdownReact').items, value) : null;

			return item ? String(item.label) : value;
		}

		var $select = $cell.find('select').first();

		if ($select.length) {
			return $select.find('option').filter(function() {
				return this.selected && this.value !== '';
			}).map(function() {
				return $(this).text().replace(/\s+/g, ' ').trim();
			}).get().join(', ');
		}

		var $textarea = $cell.find('textarea').first();

		if ($textarea.length) {
			return fieldtype == 'rte' ? htmlToText($textarea.val()) : String($textarea.val());
		}

		// Text inputs, otherwise a stored value (e.g. a file)
		var $input = $cell.find('input:not([type]), input[type=text], input[type=number], input[type=url], input[type=email], input[type=tel], input[type=search]').first();

		if ( ! $input.length) {
			$input = $cell.find('input[type=hidden]').filter(function() {
				return this.value !== '';
			}).first();
		}

		return $input.length ? String($input.val()) : '';
	}

	function optionLabel(input) {
		return $(input).closest('label').text().replace(/\s+/g, ' ').trim();
	}

	// Rich text as plain text with line breaks (parsed without running anything in it)
	function htmlToText(html) {
		if ( ! html || typeof DOMParser === 'undefined') {
			return String(html || '');
		}

		return cellText(new DOMParser().parseFromString(html, 'text/html').body);
	}

	// Spreadsheet quoting for cells containing tabs, line breaks or quotes
	function tabbedCell(value) {
		value = String(value);

		return /[\t\n"]/.test(value) ? '"' + value.replace(/"/g, '""') + '"' : value;
	}

	// Both formats via the copy event (within the click); the Clipboard API as a fallback
	function writeClipboard(html, text) {
		var copied = false;
		var onCopy = function(e) {
			e.clipboardData.setData('text/html', html);
			e.clipboardData.setData('text/plain', text);
			e.preventDefault();
			copied = true;
		};

		document.addEventListener('copy', onCopy);

		try {
			document.execCommand('copy');
		} catch (e) {
			copied = false;
		}

		document.removeEventListener('copy', onCopy);

		if (copied) {
			return Promise.resolve();
		}

		if (navigator.clipboard && window.ClipboardItem) {
			return navigator.clipboard.write([new ClipboardItem({
				'text/html': new Blob([html], {type: 'text/html'}),
				'text/plain': new Blob([text], {type: 'text/plain'})
			})]);
		}

		if (navigator.clipboard && navigator.clipboard.writeText) {
			return navigator.clipboard.writeText(text);
		}

		return Promise.reject();
	}

	function flashButton($button, text) {
		var label = $button.data('label') || $button.val();

		$button.data('label', label).val(text);
		clearTimeout($button.data('flashTimer'));
		$button.data('flashTimer', setTimeout(function() {
			$button.val(label);
		}, 2000));
	}


	// ------------------------------------------------------------------
	// Paste rows

	// Open/close the paste panel
	$(document).on('click', '.grid-presets .grid-preset-paste', function() {
		var $controls = $(this).closest('.grid-presets');

		if ($controls.data('pastePanel')) {
			closePastePanel($controls);
			return;
		}

		var $panel = $(PASTE_PANEL_HTML).insertAfter($controls).data('controls', $controls);

		$controls.data('pastePanel', $panel);
		$panel.find('.grid-presets-paste__input').trigger('focus');
	});

	function closePastePanel($controls) {
		var $panel = $controls.data('pastePanel');

		if ($panel) {
			$panel.remove();
		}

		$controls.removeData('pastePanel');
	}

	// Pasted content: prefer a copied table (HTML), otherwise the plain text
	$(document).on('paste', '.grid-presets-paste__input', function(e) {
		var clipboard = e.originalEvent && e.originalEvent.clipboardData;

		if ( ! clipboard) {
			return;
		}

		e.preventDefault();

		var text = clipboard.getData('text/plain') || '';
		var rows = parseHtmlTable(clipboard.getData('text/html'));
		var textRows = parseText(text);

		// Use tab separated text if the HTML gave fewer rows (e.g. a partly copied table)
		if ( ! rows || (text.indexOf('\t') !== -1 && tidyRows(textRows).length > tidyRows(rows).length)) {
			rows = textRows;
		}

		$(this).val(text);
		startPaste($(this).closest('.grid-presets-paste'), rows);
	});

	// Typed or edited text
	$(document).on('input', '.grid-presets-paste__input', function() {
		startPaste($(this).closest('.grid-presets-paste'), parseText(this.value));
	});

	// Options: headings / swap rows and columns
	$(document).on('change', '.grid-presets-paste__options input', function() {
		var $panel = $(this).closest('.grid-presets-paste');
		var state = $panel.data('state');
		var option = $(this).data('option');

		state[option] = this.checked;

		// After swapping, check again whether the (new) first row is headings
		autoMap(state, option === 'swapped');
		renderPaste($panel);
	});

	// Column mapping
	$(document).on('change', '.grid-presets-paste__map', function() {
		var $panel = $(this).closest('.grid-presets-paste');

		$panel.data('state').mapping[$(this).data('column')] = parseInt($(this).val(), 10);
		renderPaste($panel);
	});

	// Add / replace / cancel
	$(document).on('click', '.grid-presets-paste__buttons [data-action]', function() {
		var $panel = $(this).closest('.grid-presets-paste');
		var $controls = $panel.data('controls');
		var action = $(this).data('action');

		if (action === 'cancel') {
			closePastePanel($controls);
			return;
		}

		var state = $panel.data('state');
		var values = [];

		$.each(pasteBody(state), function(r, row) {
			var rowValues = {};
			var hasValue = false;

			$.each(state.columns, function(i, column) {
				var source = state.mapping[i];

				if (source >= 0 && isPasteable(column) && row[source] !== undefined && row[source] !== '') {
					rowValues[column.id] = row[source];
					hasValue = true;
				}
			});

			if (hasValue) {
				values.push(rowValues);
			}
		});

		loadRows($controls.data('grid'), values, {}, {pasted: true, replace: action === 'replace'});
		closePastePanel($controls);
	});

	function startPaste($panel, rows) {
		var $grid = $panel.data('controls').data('grid');
		var state = {
			rows: tidyRows(rows),
			columns: getColumns($grid),
			headings: false,
			swapped: false,
			mapping: []
		};

		// Spec-sheet layout (the Grid's column names down the first column): swap rows and columns
		var firstColumn = state.rows.map(function(row) {
			return row[0];
		});

		if (countLabelMatches(firstColumn, state.columns) > Math.max(0, countLabelMatches(state.rows[0] || [], state.columns))) {
			state.swapped = true;
		}

		autoMap(state, true);

		$panel.data('state', state);
		renderPaste($panel);
	}

	// Default mapping: by heading when the first row names the Grid's columns,
	// otherwise by position (as many columns as were pasted)
	function autoMap(state, detectHeadings) {
		var data = pasteData(state);
		var first = data[0] || [];

		var namedHeadings = countLabelMatches(first, state.columns) > 0;

		if (detectHeadings) {
			state.headings = namedHeadings;
		}

		// Headings that don't name any of the Grid's columns just mean "skip the first row"
		var byHeading = state.headings && namedHeadings;

		state.mapping = state.columns.map(function(column, i) {
			if ( ! isPasteable(column)) {
				return -1;
			}

			if (byHeading) {
				return indexOfText(first, column.label);
			}

			return i < first.length ? i : -1;
		});
	}

	// Rows after swapping (if chosen)
	function pasteData(state) {
		return state.swapped ? transpose(state.rows) : state.rows;
	}

	// Rows to paste (without the headings row)
	function pasteBody(state) {
		var data = pasteData(state);

		return state.headings ? data.slice(1) : data;
	}

	function renderPaste($panel) {
		var state = $panel.data('state');
		var $grid = $panel.data('controls').data('grid');
		var $preview = $panel.find('.grid-presets-paste__preview').empty();
		var data = pasteData(state);
		var body = pasteBody(state);
		var width = data.length ? data[0].length : 0;

		if ( ! body.length) {
			$preview.append($('<p class="grid-presets-paste__summary">').text('Nothing to paste yet: no rows found.'));
			return;
		}

		// Options
		$preview.append(
			$('<div class="grid-presets-paste__options">')
				.append(pasteOption('headings', 'First row is headings', state.headings))
				.append(pasteOption('swapped', 'Swap rows and columns', state.swapped))
		);

		// Grid columns, with the pasted column that fills each
		var $table = $('<table class="grid-presets-paste__table">');
		var $labels = $('<tr>');
		var $mapping = $('<tr>');

		$.each(state.columns, function(i, column) {
			var $cell = $('<td>');

			$labels.append($('<th>').text(column.label));

			if ( ! isPasteable(column)) {
				$cell.append($('<em>').text('Not supported'));
			} else {
				var $select = $('<select class="grid-presets-paste__map">').attr('data-column', i);

				$select.append($('<option>').val(-1).text('- Skip -'));

				for (var s = 0; s < width; s++) {
					var sample = state.headings ? data[0][s] : body[0][s];
					$select.append($('<option>').val(s).text('Column ' + (s + 1) + (sample ? ': ' + truncate(sample, 24) : '')));
				}

				$select.val(String(state.mapping[i]));
				$cell.append($select);
			}

			$mapping.append($cell);
		});

		$table.append($('<thead>').append($labels).append($mapping));

		// Preview rows (every row is checked for matches)
		var $tbody = $('<tbody>');
		var unmatched = 0;

		$.each(body, function(r, row) {
			var $tr = $('<tr>');

			$.each(state.columns, function(i, column) {
				var source = state.mapping[i];
				var text = source >= 0 ? (row[source] || '') : '';
				var $td = $('<td>');

				if (text !== '') {
					var result = resolvePasted(column.$template, column.fieldtype, text, {});

					$td.text(text);

					if ( ! result.matched) {
						unmatched++;
						$td.addClass('grid-presets-paste__unmatched').attr('title', 'No matching option: this will be left empty');
					}
				}

				$tr.append($td);
			});

			if (r < PREVIEW_ROWS) {
				$tbody.append($tr);
			}
		});

		$table.append($tbody);
		$preview.append($('<div class="grid-presets-paste__table-wrap">').append($table));

		// Summary
		var notes = [body.length + (body.length == 1 ? ' row' : ' rows') + ' to paste.'];
		var max = maxRows($grid);
		var existing = getRows($grid).length;

		if (body.length > PREVIEW_ROWS) {
			notes.push('The first ' + PREVIEW_ROWS + ' are shown.');
		}

		if (unmatched) {
			notes.push(unmatched + (unmatched == 1 ? ' value has' : ' values have') + ' no matching option (highlighted) and will be left empty.');
		}

		if (max && existing + body.length > max) {
			notes.push('This Grid allows ' + max + ' rows, so adding after the existing rows pastes ' + Math.max(0, max - existing) + '.');
		}

		if (max && body.length > max) {
			notes.push('Replacing pastes the first ' + max + '.');
		}

		$preview.append($('<p class="grid-presets-paste__summary">').text(notes.join(' ')));

		$preview.append(
			$('<div class="grid-presets-paste__buttons">')
				.append(pasteButton('add', 'Add after existing rows', 'button--primary'))
				.append(pasteButton('replace', 'Replace existing rows', 'button--default'))
				.append(pasteButton('cancel', 'Cancel', 'button--default'))
		);
	}

	// No name attributes: these sit inside the publish form and mustn't be submitted
	function pasteOption(option, text, checked) {
		return $('<label>')
			.append($('<input type="checkbox">').attr('data-option', option).prop('checked', checked))
			.append(document.createTextNode(text));
	}

	function pasteButton(action, text, style) {
		return $('<button type="button" class="button button--small">').addClass(style).attr('data-action', action).text(text);
	}

	// The Grid's columns: ID, fieldtype, label, and the blank template cell (for matching options)
	function getColumns($grid) {
		var $table = getTable($grid);
		var $cells = $table.children('tbody').children('tr.grid-blank-row').first().children('td[data-fieldtype]');
		var $headings = $table.children('thead').find('th').not('.row-counter-column, .hidden, .check-ctrl, .grid-field__column-remove');

		return $cells.map(function(i) {
			var label = ($headings.length === $cells.length) ? headingText($headings.eq(i)) : '';

			return {
				id: $(this).data('column-id') || i,
				fieldtype: $(this).data('fieldtype'),
				label: label || ('Column ' + (i + 1)),
				$template: $(this)
			};
		}).get();
	}

	// A column heading's label, without its instructions or name badge
	function headingText($heading) {
		var $clone = $heading.clone();

		$clone.find('.grid-instruct').remove();
		$clone.children().not('.required, a').remove();

		return $clone.text().replace(/\s+/g, ' ').trim();
	}

	function isPasteable(column) {
		return UNPASTEABLE_FIELDTYPES.indexOf(column.fieldtype) === -1;
	}

	function countLabelMatches(cells, columns) {
		var count = 0;

		$.each(columns, function(i, column) {
			if (isPasteable(column) && indexOfText(cells, column.label) !== -1) {
				count++;
			}
		});

		return count;
	}

	// Match pasted text to a cell: options for selects, dropdowns, checkboxes, radios, toggles
	// and relationships (by value or label); text for the rest.
	// Returns {value, matched}: value is in the preset shape for fillCell (undefined to skip).
	function resolvePasted($cell, fieldtype, text, labels) {
		text = String(text).trim();

		if (fieldtype == 'relationship') {
			return resolveRelationship($cell, text, labels);
		}

		if (fieldtype == 'toggle') {
			var on = /^(1|y|yes|on|true)$/i.test(text);
			var off = /^(0|n|no|off|false)$/i.test(text);

			return {value: (on || off) ? [on ? '1' : '0'] : undefined, matched: on || off};
		}

		if (CHECKABLE_FIELDTYPES.indexOf(fieldtype) !== -1) {
			var tokens = splitList(text);
			var found = [];
			var values = [];

			$cell.find('input[type=checkbox], input[type=radio]').each(function() {
				var token = findToken(tokens, [this.value, optionLabel(this)]);

				// A radio takes one option
				if (token !== null && (this.type === 'checkbox' || ! found.length)) {
					values.push(this.value);
					found.push(token);
				} else {
					values.push(null);
				}
			});

			return {value: found.length ? values : undefined, matched: found.length > 0 && found.length === tokens.length};
		}

		// Other fields: fill the main input
		var $inputs = $cell.find('input, textarea, select');
		var $dropdown = $cell.find('div[data-dropdown-react]').first();
		var $main;
		var mainValue;
		var matched = true;

		if ($dropdown.length) {
			// EE's React dropdown: match its items (its hidden input only exists once rendered)
			var item = findItem(reactProps($dropdown, 'dropdownReact').items, text);

			$main = $dropdown.find('input[type=hidden]').first();
			mainValue = item ? item.value : undefined;
			matched = !! item;

		} else {
			$main = $inputs.filter('select, textarea, input:not([type]), input[type=text], input[type=number], input[type=url], input[type=email], input[type=tel], input[type=search]').first();

			if ( ! $main.length) {
				return {value: undefined, matched: false};
			}

			if ($main.is('select')) {
				var multiple = $main.prop('multiple');
				var options = $main.find('option').map(function() {
					return {value: this.value, label: $(this).text()};
				}).get();
				var chosen = [];

				$.each(multiple ? splitList(text) : [text], function(i, pick) {
					var option = findItem(options, pick);

					if (option) {
						chosen.push(option.value);
					} else if (allowsNewOptions($main, fieldtype)) {
						chosen.push(pick);
					} else {
						matched = false;
					}
				});

				mainValue = chosen.length ? (multiple ? chosen : chosen[0]) : undefined;

			} else if ($main.is('input[type=number]')) {
				matched = text !== '' && ! isNaN(Number(text));
				mainValue = matched ? text : undefined;

			} else if (fieldtype == 'rte') {
				mainValue = textToHtml(text);

			} else if ($main.is('textarea')) {
				mainValue = text;

			} else {
				mainValue = text.replace(/\s*\n\s*/g, ' ');
			}
		}

		var index = $inputs.index($main);

		if (typeof mainValue === 'undefined') {
			return {value: undefined, matched: false};
		}

		if (index < 0) {
			return {value: undefined, matched: matched};
		}

		var value = [];
		value[index] = mainValue;

		return {value: value, matched: matched};
	}

	// Relationship entries by title (or entry ID), from the field's own entry list
	function resolveRelationship($cell, text, labels) {
		var $field = $cell.find('div[data-relationship-react]').first();
		var props = $field.length ? reactProps($field, 'relationshipReact') : {};
		var items = listItems(props.items);

		// One title per line (titles can contain commas); a line that isn't a title may be a list
		var tokens = [];

		$.each(String(text).split(/\s*\n\s*/), function(i, line) {
			if (line === '') {
				return;
			}

			tokens = findItem(items, line) ? tokens.concat([line]) : tokens.concat(splitList(line));
		});

		var entryIds = [];
		var matched = true;

		$.each(tokens, function(i, token) {
			var item = findItem(items, token);

			if (item) {
				entryIds.push(item.value);
				labels[item.value] = item.label;
			} else if (/^\d+$/.test(token)) {
				entryIds.push(token);
			} else {
				matched = false;
			}
		});

		if ( ! props.multi) {
			entryIds = entryIds.slice(0, 1);
		}

		return {value: entryIds.length ? entryIds : undefined, matched: matched && entryIds.length > 0};
	}

	// MX Select Plus can add new options (when the field allows it)
	function allowsNewOptions($select, fieldtype) {
		var flag = String($select.data('no'));

		return fieldtype == 'mx_select_plus' && ['1', 'y', 'yes', 'true'].indexOf(flag.toLowerCase()) !== -1;
	}

	// Decoded props of an EE React field (cached on the element)
	function reactProps($field, key) {
		var props = $field.data('gridPresetsProps');

		if ( ! props) {
			try {
				props = JSON.parse(window.atob($field.data(key)));
			} catch (e) {
				props = {};
			}

			$field.data('gridPresetsProps', props);
		}

		return props;
	}

	function listItems(items) {
		return Array.isArray(items) ? items : $.map(items || {}, function(item) {
			return item;
		});
	}

	// Find an item ({value, label}, with optional children) by value or label
	function findItem(items, text) {
		var found = null;

		$.each(items || [], function(i, item) {
			if ( ! item) {
				return;
			}

			if (sameText(item.value, text) || sameText(item.label, text)) {
				found = item;
				return false;
			}

			found = findItem(item.children, text);

			if (found) {
				return false;
			}
		});

		return found;
	}

	// The first token that matches any of the candidates
	function findToken(tokens, candidates) {
		for (var t = 0; t < tokens.length; t++) {
			for (var c = 0; c < candidates.length; c++) {
				if (sameText(tokens[t], candidates[c])) {
					return tokens[t];
				}
			}
		}

		return null;
	}

	function indexOfText(cells, text) {
		for (var i = 0; i < cells.length; i++) {
			if (cells[i] !== '' && sameText(cells[i], text)) {
				return i;
			}
		}

		return -1;
	}

	function sameText(a, b) {
		return normaliseText(a) === normaliseText(b);
	}

	function normaliseText(text) {
		return String(text === null || typeof text === 'undefined' ? '' : text).replace(/\s+/g, ' ').trim().toLowerCase();
	}

	// "a, b; c" or one per line
	function splitList(text) {
		return String(text).split(/\s*[\n,;|]\s*/).filter(function(part) {
			return part !== '';
		});
	}

	function truncate(text, length) {
		text = String(text).replace(/\s+/g, ' ');

		return text.length > length ? text.substr(0, length - 1) + '…' : text;
	}

	function textToHtml(text) {
		return '<p>' + escapeHtml(text).replace(/\n/g, '<br>') + '</p>';
	}

	function escapeHtml(value) {
		return String(value === null || typeof value === 'undefined' ? '' : value).replace(/[&<>"']/g, function(chr) {
			return {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[chr];
		});
	}


	// ------------------------------------------------------------------
	// Parsing

	// The tables in copied HTML, as rows of cell text (merged cells are repeated).
	// Browsers can put each copied row in its own table, so all top-level tables are joined in order.
	function parseHtmlTable(html) {
		if ( ! html || html.indexOf('<t') === -1 || typeof DOMParser === 'undefined') {
			return null;
		}

		var tables = new DOMParser().parseFromString(html, 'text/html').querySelectorAll('table');
		var rows = [];

		Array.prototype.forEach.call(tables, function(table) {
			// Nested tables are part of a cell
			if (table.parentElement && table.parentElement.closest('table')) {
				return;
			}

			rows = rows.concat(tableRows(table));
		});

		return rows.length ? rows : null;
	}

	// One table's rows
	function tableRows(table) {
		var rows = [];

		Array.prototype.forEach.call(table.rows, function(tr, r) {
			var c = 0;

			rows[r] = rows[r] || [];

			Array.prototype.forEach.call(tr.cells, function(td) {
				var text = cellText(td);
				var colspan = Math.max(1, parseInt(td.getAttribute('colspan'), 10) || 1);
				var rowspan = Math.max(1, parseInt(td.getAttribute('rowspan'), 10) || 1);

				// Skip places already filled by a cell spanning rows above
				while (rows[r][c] !== undefined) {
					c++;
				}

				for (var dr = 0; dr < rowspan; dr++) {
					rows[r + dr] = rows[r + dr] || [];

					for (var dc = 0; dc < colspan; dc++) {
						rows[r + dr][c + dc] = text;
					}
				}

				c += colspan;
			});
		});

		return rows;
	}

	// A cell's text, keeping line breaks (<br>, paragraphs) and dropping formatting
	function cellText(td) {
		var clone = td.cloneNode(true);

		Array.prototype.forEach.call(clone.querySelectorAll('br'), function(br) {
			br.parentNode.replaceChild(document.createTextNode('\n'), br);
		});

		Array.prototype.forEach.call(clone.querySelectorAll('p, div, li, tr'), function(block) {
			block.appendChild(document.createTextNode('\n'));
		});

		// Cells of a nested table
		Array.prototype.forEach.call(clone.querySelectorAll('td, th'), function(cell) {
			cell.appendChild(document.createTextNode(' '));
		});

		return String(clone.textContent).split('\n').map(function(line) {
			return line.replace(/[\s ]+/g, ' ').trim();
		}).filter(function(line) {
			return line !== '';
		}).join('\n');
	}

	// Tab separated text (spreadsheets), or columns separated by 2+ spaces
	function parseText(text) {
		text = String(text || '').replace(/\r\n?/g, '\n');

		if (text.indexOf('\t') !== -1) {
			return parseTabbed(text);
		}

		// Single spaces are part of values ("Antique Brass")
		return text.split('\n').map(function(line) {
			return line.trim().split(/(?: | ){2,}/);
		});
	}

	// Tab separated, where spreadsheets quote cells containing tabs, line breaks or quotes
	function parseTabbed(text) {
		var rows = [];
		var row = [];
		var cell = '';
		var quoted = false;

		for (var i = 0; i < text.length; i++) {
			var chr = text.charAt(i);

			if (quoted) {
				if (chr === '"' && text.charAt(i + 1) === '"') {
					cell += '"';
					i++;
				} else if (chr === '"') {
					quoted = false;
				} else {
					cell += chr;
				}
			} else if (chr === '"' && cell === '') {
				quoted = true;
			} else if (chr === '\t') {
				row.push(cell);
				cell = '';
			} else if (chr === '\n') {
				row.push(cell);
				rows.push(row);
				row = [];
				cell = '';
			} else {
				cell += chr;
			}
		}

		row.push(cell);
		rows.push(row);

		return rows;
	}

	// Trim cells, drop empty rows and trailing empty columns, and make rows the same width
	function tidyRows(rows) {
		var width = 0;

		rows = (rows || []).map(function(row) {
			return (row || []).map(function(cell) {
				return String(cell === null || typeof cell === 'undefined' ? '' : cell).trim();
			});
		}).filter(function(row) {
			return row.some(function(cell) {
				return cell !== '';
			});
		});

		rows.forEach(function(row) {
			var used = row.length;

			while (used > 0 && row[used - 1] === '') {
				used--;
			}

			width = Math.max(width, used);
		});

		return rows.map(function(row) {
			row = row.slice(0, width);

			while (row.length < width) {
				row.push('');
			}

			return row;
		});
	}

	function transpose(rows) {
		var width = rows.length ? rows[0].length : 0;
		var result = [];

		for (var c = 0; c < width; c++) {
			result.push(rows.map(function(row) {
				return row[c];
			}));
		}

		return result;
	}

});
