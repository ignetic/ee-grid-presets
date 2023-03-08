$(document).ready(function(){

	// Saved Presets
	var presets = {};
	
	// grid fields in EE2 and EE3 as well as EE2 Henshu support
	// Henshu: '.pageContents.group form.henshu .henshu_encapsulate:has("table.grid_field")'
	// EE2 '#publishForm .publish_field.publish_grid'
	// EE3 '.publish form .grid-publish .setting-field table.grid-input-form[id]'
	// EE4 '.form-standard form .fieldset-faux>.field-control table.grid-input-form[id]'
	// EE5 '.form-standard form .fieldset-faux>.field-control table.grid-input-form[id]'
	// EE6 '.form-standard form .fieldset-faux>.field-control .grid-field[id] table.grid-field__table'
	var gridTables = $('.publish .grid-publish table.grid-input-form, .form-standard .fieldset-faux>.field-control table.grid-input-form, .form-standard .fieldset-faux>.field-control .grid-field');
	if (gridTables.length == 0) {
		gridTables = $('#publishForm .publish_field.publish_grid, .pageContents.group form.henshu .henshu_encapsulate:has("table.grid_field")');
	}

	var gridFields = gridTables.closest('.setting-field, .field-control');

	var gridRowsField = 'tbody tr:not(.grid-blank-row, .no-results):visible';

	
	// !! For some reason this is loaded before EE variable is ready and then again later when it is
	if (typeof EE !== 'undefined') {
		
		var AJAX_BASE = '<?php echo $base; ?>';
		var ASSETS_ACT_ID = <?php echo ($assets_act_id ? $assets_act_id : 'false'); ?>;

		EE.SESSION = EE.SESSION || 'S=0';

		if (AJAX_BASE == '') {
			AJAX_BASE = EE.BASE + "&C=addons_modules&M=show_module_cp&module=grid_presets&method=";
		} else {
			EE.SESSION = EE.BASE.match(/(S=[\w\d]+)/)[0];
		}

		// Pre EE 2.8 support
		var CSRF_TOKEN_NAME = 'CSRF_TOKEN';
		
		if (!EE.CSRF_TOKEN) {
			EE.CSRF_TOKEN = EE.XID;
			CSRF_TOKEN_NAME = 'XID';
		}
		
		// Get grid field ids
		var fieldIds = new Array();

		gridFields.find(gridTables).each(function() {
			var fieldId = getFieldId($(this));
			fieldIds.push(parseInt(fieldId));
		});
				
		// Need to wait after `document.ready` has finished executing!
		setTimeout(function() {
			
				// Make sure that this is the publish form
				if (!EE.publish)
					return;

				var postData = {'field_ids': fieldIds};
				postData[CSRF_TOKEN_NAME] = EE.CSRF_TOKEN;
				
				$.ajax({
					url: AJAX_BASE + "get_presets&" + EE.SESSION,
					type: 'POST',
					data: postData,
					dataType: 'json',
					success:function(data) {
						if (data.presets) {
							presets = data.presets;
						}
						initPresets(presets);
						EE.CSRF_TOKEN = data.CSRF_TOKEN;
						$('input[name='+CSRF_TOKEN_NAME+']').val(data.CSRF_TOKEN);
					},
					error:function(jqXHR, textStatus, errorMessage) {
						console.log('Grid Presets - '+textStatus+': '+errorMessage);
					} 
				});
				
		}, 0);
	
	}
	
	// start the process
	function initPresets(presets) {

		// grid fields as well as Henshu support
		gridFields.each(function() {

			//var fieldId = $(this).attr('id').replace('hold_field_','');
			var fieldId = getFieldId($(this).find(gridTables));

			if ( ! fieldId)
				return true;

			var presetButtons, buttonsHTML = '<div style="text-align:right; display:flex; align-items:flex-end; justify-content:flex-end; gap:5px; margin-bottom:-5px;" class="grid-presets" data-field-id="' + fieldId + '"><select class="grid-preset-select button--small" style="border-color:#cbcbda; text-align:left; padding-right:30px !important;"><option value="">- Select A Preset -</option></select> <input type="button" name="grid-preset-load" class="grid-preset-load btn button--small" value="Load"> <input type="button" name="grid-preset-delete" class="grid-preset-delete btn button--small remove" value="Delete"> <input type="button" name="grid-preset-save" class="grid-preset-save btn button--small action" value="Save"></div>';

            if ($(this).find('.grid-field__footer').length > 0)	{
                // EE6
                presetButtons = $(buttonsHTML).insertBefore($(this).find('.grid-field__footer'));
			} else if ($(this).closest('.field-control').length > 0)	{
				// EE5
				presetButtons = $(buttonsHTML).insertBefore($(this).closest('.field-control').find('.toolbar:last'));
			} else if ($(this).find('.holder').length > 0)	{
				// < EE3
				presetButtons = $(buttonsHTML).appendTo($(this).find('.holder'));
				presetButtons.css('margin-top', '-28px');
			} else {
				presetButtons = $(buttonsHTML).insertBefore($(this).find('.toolbar:last'));
			}

			updateSelects(presets, fieldId);
			
		});
		
		
		// Load preset button
		gridFields.find('.grid-presets .grid-preset-load').on('click', function() {

			var fieldId = $(this).closest('.grid-presets').data('field-id');
			var presetId = $(this).parent().find('.grid-preset-select').val();

			if (fieldId && presetId != "") {

				var field = gridFields.has('#field_id_'+fieldId);
				
				if (typeof presets[fieldId] == 'undefined') {
					alert('Preset not found');
					return false;
				}

				var values = presets[fieldId][presetId].values;

				// Only grid visible fields
				var gridRows = field.find(gridRowsField);
				
				var numRows = gridRows.length;

				var addEntryButton = field.find('td a.grid_button_add, ul.toolbar .add a, .grid-field__footer .js-grid-add-row');

				// Create one row for each value
				for (var i in values) {
					addEntryButton.click();
				}


				// Wait for field to finish initializing...
				setTimeout(function() {
				
					// Skip the placeholder row for "No rows have been added yet..."
					field.find(gridRowsField).filter(':eq('+ numRows + '), :gt(' + numRows + ')').each(function(irow) {
					
						var value = values[irow];
			
						$(this).find('> td[data-fieldtype]').each(function(icol) {
						
							var $cell = $(this);
							var fieldtype = $cell.data('fieldtype');
						
							icol = $cell.data('column-id') || icol;

							if (fieldtype == 'relationship') {

								var $relContainer = $cell.find('.fields-relate');
								var isMultiRelate = $relContainer.is('.fields-relate-multi');
								
								var inputNameString = $cell.find('input.input-name').attr('name') || $cell.find('div[data-input-value]').data('input-value');
								// make sure this is an array
								var inputName = inputNameString.replace(/\[\]+$/,'')+'[]';

								if (typeof inputName !== "undefined" && typeof value[icol] !== "undefined") {

									$.each(value[icol], function(index, fieldValue) {
										
										// this could be done via react
										
										var $fieldSelect = $cell.find(".fields-relate .fields-select:first .field-inputs, .scroll-wrap:first");
										var $fieldValues = $cell.find(".fields-relate .fields-select:last .field-inputs, .scroll-wrap:last");

										if (isMultiRelate) {
											
											var $relSelected = $('<label data-id="'+fieldValue+'">Added Entry '+fieldValue+'</label>');
											$relSelected.appendTo($fieldValues);
											
										} else {

											$fieldSelect.after('<div class="field-input-selected"><label><span class="icon--success"></span> Added Entry '+fieldValue+'<ul class="toolbar"><li class="remove"><a href=""></a></li></ul></label></div>');
											
										}

										var $inputSelect = $('<input type="hidden" name="'+inputName+'" value="'+fieldValue+'">');

										$inputSelect.appendTo($fieldSelect.parent());

									});

									$cell.find('.field-empty, .no-results').hide();
									
									// disable editing as direct DOM won't work with react
									$cell.css('position', 'relative').append('<div style="display:block;position:absolute;top:0;left:0;right:0;bottom:0;background:rgba(255,255,255,0.75);"><span style="position:absolute;top:45%;left:50%;transform:translateX(-50%);font-size:20px;background:#fff;padding:4px;">Loaded: save to update</span></div>');

								}

							} else if (fieldtype == 'toggle') {
								
								if (typeof value[icol][0] !== "undefined") {
									var fieldValue = value[icol][0];
									if (fieldValue == '1') {
										$cell.find('input').val(fieldValue);
										$cell.find('.toggle-btn').click();
									}
								}

							} else {
							
								$cell.find('input, textarea, select').each(function(ifield) {
									
									var $field = $(this);

									if (typeof value[icol] !== "undefined" && typeof value[icol][ifield] !== "undefined") {
										
										var fieldValue = value[icol][ifield];

										// find multiselect value (there is a hidden field within this too)
										if ($field.is('select[multiple]')) {
											$field.val(fieldValue);
											
										// select option or populate if value not found
										} else if ($field.is('select')) {
											if ($field.find("option[value='"+fieldValue+"']").length > 0) {
												$field.val(fieldValue);
											} else {
												$field.prepend('<option value="'+value[icol]+'">'+value[icol]+'</option>').val(fieldValue);
											}
										
										// checkboxes and radios
										} else if ($field.is('input:checkbox') || $field.is('input:radio')) {
											if (fieldValue) {
												$field.closest('label').click();
											}
												
										// basics
										} else {
											$field.val(fieldValue);
										}

										// react dropdown
										$field.closest('.select__button-label').find('i').text(fieldValue);
								
									}

								});
								
							}
							
							
							/* Fieldtype cleanup and show selected */
							
							// File - Just display holding images
							if (fieldtype == 'file') {
								if ($cell.find('[data-file-field-react]').length > 0) {
									var fieldValue = $(this).find('input:first').val();
									if (fieldValue) {
										var filename = fieldValue.replace(/^{.*}\s*/g, '');
										$cell.find('.fields-upload-chosen').removeClass('hidden').find('.fields-upload-chosen-name > div').attr('title', filename).text(filename);
										$cell.find('.file-field, .file-field__buttons').hide();
									}
								} else if ($cell.find('.file_set p input:first').length > 0) {
									// < EE 3
									var filename = $cell.find('.file_set p input:first').val();
									if (filename) {
										$cell.find('.file_set').removeClass('js_hide');
										$cell.find('.sub_filename .choose_file').addClass('js_hide');
										$cell.find('.file_set .filename img').attr('alt', filename).after('<br>'+filename);
									}
								} else {
									// EE 3
									var filename = $cell.find('> input:first').val();
									if (filename) {
										$cell.find('.solo-btn').addClass('hidden');
										$cell.find('.file-chosen').removeClass('hidden');
									}
								}
							}
							
							// Assets - Load via ACT
							if (fieldtype == 'assets' && ASSETS_ACT_ID) {

								var fieldValue = value[icol];

								if (fieldValue)	{
									
									var postData = {
										'ACT': ASSETS_ACT_ID,
										'requestId': 1,
										'view': 'thumbs',
										'thumb_size': 'small',
										'show_filenames': 'n',
										'file_id': fieldValue
									};

									$.ajax({
										url: '/',
										type: 'post',
										data: postData,
										dataType: 'json',
										success: function(response) {
										   $cell.find('.assets-thumbview > ul').html(response.html);
										   $cell.find('.assets-buttons .assets-btn').off('click').addClass('assets-disabled');
										   $cell.find('.assets-tv-file').css('width', 'auto');
										   $cell.append('<style>'+response.css+'</style>');
										},
										error: function(jqXHR, textStatus, errorThrown) {
										   console.log(textStatus, errorThrown);
										}
									});
								}

							}
								
							if (fieldtype == 'rte') {
								var fieldValue = $cell.find('textarea').val();
								if ($cell.find('.ck-editor__editable').length) {
									var editorInstance = $cell.find('.ck-editor__editable').get(0).ckeditorInstance;
									if (typeof editorInstance !== 'undefined') {
										editorInstance.setData( fieldValue );
									}
								}
								if ($cell.find('.redactor-box').length && typeof $R !== 'undefined') {
									var editor = $cell.find('textarea');
									var id = $cell.find('textarea').attr('id');
									$R('#'+id, 'source.setCode', fieldValue);
								}
							}
							
							if (fieldtype == 'colorpicker') {
								var fieldValue = value[icol][0];
								if (fieldValue) {
									$cell.find('.colorpicker__input-color span').css('background', fieldValue);
								}
							}
							
						});
					});
				}, 0);

			}
			
		});
		
		
		// Save preset button
		gridFields.find('.grid-presets .grid-preset-save').on('click', function() {

			var fieldId = $(this).closest('.grid-presets').data('field-id');

			if (!fieldId)
				return false;
			
			// if no rows exist, do nothing
			
			var field = gridFields.has('#field_id_'+fieldId);
			
			var gridRows = field.find(gridRowsField); //field.find('tbody tr.grid_row:not(.blank_row):visible');

			// Get the row data and save
			var numRows = gridRows.length;
		
			if (!numRows)
				return false;
			
			var presetId = $(this).parent().find('.grid-preset-select').val();
			var presetName = $(this).parent().find('.grid-preset-select option:selected').text();
			
			// Is this a new preset?
			var newPreset = false;
			if (!presetId) {
				newPreset = true;
				presetId = 0;
				
				presetName = prompt("Please name your preset");
				
				if (!presetName)
					return false;
			} else {
			
				var answer = confirm("Overwrite this preset?\n'"+presetName+"'");
				
				if (!answer)
					return false;
			}

			// simpler to use objects when sending to PHP
			var presetValues = {}
			presetValues[fieldId] = {}
			presetValues[fieldId][presetId] = {'name':presetName};
			
			var fieldRow = {};
			
			// search all field types (more to add)
			gridRows.each(function(irow) {

				fieldRow[irow] = {};
				$(this).find('> td[data-fieldtype]').each(function(icol) {
					
					icol = $(this).data('column-id') || icol;
					
					fieldRow[irow][icol] = {};
					var fieldtype = $(this).data('fieldtype');

					if (fieldtype == 'relationship') {
						// EE3
						$(this).find('.relate-wrap:last .scroll-wrap .chosen input').each(function(ifield) {
							fieldRow[irow][icol][ifield] = $(this).val();
						});
						// EE4+
						$(this).find('.fields-relate .fields-select input[type=hidden]').each(function(ifield) {
							fieldRow[irow][icol][ifield] = $(this).val();
						});

					} else if (fieldtype == 'checkboxes' || fieldtype == 'radio') {
						$(this).find('input:checkbox, input:radio').each(function(ifield) {
							fieldRow[irow][icol][ifield] = $(this).filter(':checked').val() || null;
						});
					} else {
						$(this).find('input, textarea, select').each(function(ifield) {

							fieldRow[irow][icol][ifield] = $(this).val();

						});
					}
				});
				presetValues[fieldId][presetId].values = fieldRow;
			});

			var postData = {'field_ids': fieldIds, 'preset': presetValues, 'newpreset': newPreset};
			postData[CSRF_TOKEN_NAME] = EE.CSRF_TOKEN;
			
			$.ajax({
				url: AJAX_BASE + "save_preset&" + EE.SESSION,
				type: 'POST',
				data: postData,
				dataType: 'json',
				success:function(data) {
					presets = data.presets;
					updateSelects(presets, fieldId);
					EE.CSRF_TOKEN = data.CSRF_TOKEN;
				},
				error:function(jqXHR, textStatus, errorMessage) {
					alert(textStatus+': '+errorMessage);
				} 
			});

		});

		// Delete preset button
		gridFields.find('.grid-presets .grid-preset-delete').on('click', function() {

			var fieldId = $(this).closest('.grid-presets').data('field-id');
			//var groupId = EE.publish.field_group;

			var presetId = $(this).parent().find('.grid-preset-select').val();
			var presetName = $(this).parent().find('.grid-preset-select option:selected').text();
			
			if (!fieldId || !presetId)
				return false;
				
			var answer = confirm("Are you sure you want to delete this preset? \n'"+presetName+"'");
			
			if (!answer)
				return false;

			var postData = {'field_ids': fieldIds, 'field_id': fieldId, 'preset_id': presetId};
			postData[CSRF_TOKEN_NAME] = EE.CSRF_TOKEN;
			
			$.ajax({
				url: AJAX_BASE + "delete_preset&" + EE.SESSION,
				type: "POST",
				data: postData,
				dataType: 'json',
				success:function(data) {
					presets = data.presets;
					updateSelects(presets, fieldId);
					EE.CSRF_TOKEN = data.CSRF_TOKEN;
				},
				error:function(jqXHR, textStatus, errorMessage) {
					alert(textStatus+': '+errorMessage);
				} 
			});
		
		});
		
	}

	
	// Update preset select menu for this field
	function updateSelects(presets, fieldId) {

		var presetSelect = gridFields.has('#field_id_'+fieldId).find('.grid-presets select.grid-preset-select');

		presetSelect.find('option:not(:first)').remove();
		
		// search presets array to add to the individual select menus
		if (typeof presets[fieldId] != 'undefined') {
			// add options to selects
			for (var i in presets[fieldId]) {
				if (typeof presets[fieldId][i] != 'undefined') {
					presetSelect.append('<option value="'+ i +'">'+ presets[fieldId][i].name +'</option>');
				}
			}
		
		}
	}
	
	function getFieldId($field) {
		var fieldName = false;
		var fieldId = false;
		
		fieldName = $field.attr('id');
		
		// try other EE versions
		if (!fieldName) {
			if ($field.find('.grid-input-form').length > 0) {
				// EE3
				var fieldId = $field.find('.grid-input-form').attr('id');
			} else {
				// < EE3
				var fieldId = $field.find('.grid_field_container:first').attr('id');
			}
		}
		
		if (fieldName) {
			fieldId = fieldName.replace('field_id_','');
		}

		return fieldId;
	}

});
