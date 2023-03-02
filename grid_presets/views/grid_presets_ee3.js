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

	var gridRowsField = 'tbody tr:not(.grid-blank-row):visible';
	
	// !! For some reason this is loaded before EE variable is ready and then again later when it is
	if (typeof EE !== 'undefined') {
		
		var AJAX_BASE = '<?php echo $base; ?>';
		EE.SESSION = '';
		
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
					type: "POST",
					data: postData,
					dataType: 'json', //json
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

			var buttonsHTML = '<div style="float:right; margin-top:0;" class="grid-presets" data-field-id="' + fieldId + '"><select class="grid-preset-select"><option value="">- Select A Preset -</option></select> <input type="button" name="grid-preset-load" class="grid-preset-load btn" value="Load"> <input type="button" name="grid-preset-delete" class="grid-preset-delete btn remove" value="Delete"> <input type="button" name="grid-preset-save" class="grid-preset-save btn action" value="Save"></div>';
			
			if ($(this).closest('.field-control').length > 0)	{
				// EE5 - EE6
				var presetButtons = $(buttonsHTML).insertBefore($(this).closest('.field-control').find('.toolbar:last'));
			} else if ($(this).find('.holder').length > 0)	{
				// < EE3
				var presetButtons = $(buttonsHTML).appendTo($(this).find('.holder'));
				presetButtons.css('margin-top', '-28px');
			} else {
				var presetButtons = $(buttonsHTML).insertBefore($(this).find('.toolbar:last'));
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
				//var gridRows = field.find('tbody tr.grid_row:not(.blank_row):visible');
				var gridRows = field.find(gridRowsField);
				
				var numRows = gridRows.length;

				var addEntryButton = field.find('td a.grid_button_add, ul.toolbar .add a');

				// Create one row for each value
				for (var i in values)
					addEntryButton.click();
				

				// Wait for field to finish initializing...
				setTimeout(function() {
					
					// Skip the placeholder row for "No rows have been added yet..."
					field.find(gridRowsField).filter(':eq('+ numRows + '), :gt(' + numRows + ')').each(function(irow) {
					
						var value = values[irow];
						
						$(this).find('> td[data-fieldtype]').each(function(icol) {
						
							var $cell = $(this);
							var fieldtype = $(this).data('fieldtype');
							
					
							if (fieldtype == 'relationship') {
								
								var inputName = $(this).find('input.input-name').attr('name');
								var manualAdd = false;
								
								if (typeof inputName !== "undefined" && typeof value[icol] !== "undefined") {

									$.each(value[icol], function(index, fieldValue) {
										
										var relRow = '';
										var channelTitle = fieldValue;
										var entryTitle = 'Entry ';
										
										
										var $field = $cell.find('.relate-wrap:first input[value='+fieldValue+']');
										
										if ($field.length) {
											var $label = $field.closest('label');
											channelTitle = $label.data('channel-title');
											entryTitle = $label.data('entry-title');
											$label.closest('label').addClass('chosen');
											$field.prop('checked', true);
										} else {
											manualAdd = true;
										}
									
										if ($cell.hasClass('grid-multi-relate')) {
											
											relRow += '<label class="choice block chosen relate-manage" data-entry-id="'+fieldValue+'" data-search="{entry-title-lower}">';
											relRow += '  <span class="relate-reorder"></span>';
											relRow += '  <a href="" title="Remove Relationship" data-entry-id="'+fieldValue+'"></a> '+entryTitle+'<i>— '+channelTitle+'</i>';
											relRow += '  <input type="hidden" name="'+inputName+'" value="'+fieldValue+'">';
											relRow += '</label>';
											
											$cell.find('.relate-wrap:last .scroll-wrap').append(relRow);
											
										} else {
											
											relRow += '<label class="choice block chosen" data-entry-id="'+fieldValue+'" data-search="{entry-title-lower}">';
											relRow += '  <input type="radio" name="'+inputName+'" value="'+fieldValue+'" checked="checked">'+entryTitle+'<i>— '+channelTitle+'</i>';
											relRow += '</label>';
											
											$cell.find('.relate-wrap-chosen').append(relRow);
											
										}

										
									});

									if (manualAdd) {
										$cell.find('.no-results').html('<b>Titles</b> available after saving.');
									} else {
										$cell.find('.no-results').addClass('hidden');
									}
									
								
								}
								
							} else {
							
				
								$(this).find('input, textarea, select').each(function(ifield) {

									if (typeof value[icol] !== "undefined" && typeof value[icol][ifield] !== "undefined") {
										
										var fieldValue = value[icol][ifield];

										// find multiselect value (there is a hidden field within this too)
										if ($(this).is('select[multiple]')) {
											$(this).val(fieldValue);
											
										// select option or populate if value not found
										} else if ($(this).is('select')) {
											if ($(this).find("option[value='"+fieldValue+"']").length > 0) {
												$(this).val(fieldValue);
											} else {
												$(this).prepend('<option value="'+value[icol]+'">'+value[icol]+'</option>').val(fieldValue);
											}

										// basics
										} else {
											$(this).val(fieldValue);
										}
										
									}

								});
								
							}
							
							
							// Fieldtype cleanup and show selected
							
							// File - Just display holding images
							if (fieldtype == 'file') {
								if ($(this).find('.file_set p input:first').length > 0) {
									// < EE 3
									var filename = $(this).find('.file_set p input:first').val();
									if (filename) {
										$(this).find('.file_set').removeClass('js_hide');
										$(this).find('.sub_filename .choose_file').addClass('js_hide');
										$(this).find('.file_set .filename img').attr('alt', filename).after('<br>'+filename);
									}
								} else {
									// EE 3
									var filename = $(this).find('> input:first').val();
									if (filename) {
										$(this).find('.solo-btn').addClass('hidden');
										$(this).find('.file-chosen').removeClass('hidden');
									}
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
			//var groupId = EE.publish.field_group;

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
					fieldRow[irow][icol] = {};
					var fieldtype = $(this).data('fieldtype');

					if (fieldtype == 'relationship') {
						$(this).find('.relate-wrap:last .scroll-wrap .chosen input').each(function(ifield) {
							fieldRow[irow][icol][ifield] = $(this).val();
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
				type: "POST",
				data: postData,
				dataType: 'json', //json
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
