<?php  if ( ! defined('BASEPATH')) exit('No direct script access allowed');

/**
 * ExpressionEngine Grid Presets Control Panel File
 *
 * @package		Grid Presets
 * @subpackage	Addons
 * @category	Module
 * @author		Simon Andersohn
 * @link		
 */
 
require_once PATH_THIRD.'grid_presets/config.php';

class Grid_presets_mcp {
	
	public $name = GRID_PRESETS_NAME;
	public $version = GRID_PRESETS_VERSION; 
	
	public $return_data;

	private $class = 'Grid_presets';
	private $settings_table = 'grid_presets_settings';
	private $site_id = 1;
	private $csrf_token;
	

	/**
	 * Constructor
	 */
	public function __construct()
	{
		$this->site_id = ee()->config->item('site_id');
		
		if(defined('CSRF_TOKEN'))
		{
			$this->csrf_token = CSRF_TOKEN;
		}
		else
		{
			$this->csrf_token = ee()->security->restore_xid();
		} 
		
	}
	
	// ----------------------------------------------------------------

	/**
	 * Index Function
	 *
	 * @return 	void
	 */
	public function index()
	{
		// If this isn't an AJAX request, just display the "base" settings form.
		if ( ! ee()->input->is_ajax_request())
		{
			if ( version_compare( APP_VER, '2.6.0', '<' ) )
			{
				ee()->cp->set_variable( 'cp_page_title', lang('grid_presets_module_name') );
			}
			else
			{
				ee()->view->cp_page_title = lang('grid_presets_module_name');
			}
			
			return "Nothing to see here...";
		}

	}

	
	/**
	 * Get presets
	 */
	 
	public function get_presets($field_ids=array(), $ajax=TRUE)
	{
		
		$presets = array();

		if (ee()->input->post('field_ids') !== FALSE)
		{
			$field_ids = ee()->input->post('field_ids');
			
		}
		if (is_array($field_ids) && !empty($field_ids))
		{
			ee()->db->where_in('field_id', $field_ids);
		}

		$query = ee()->db->where('site_id', $this->site_id)->get($this->settings_table);
		
		if ($query->num_rows() > 0)
		{
			foreach ($query->result_array() as $row)
			{
				$presets[$row['field_id']][$row['preset_id']] = unserialize($row['preset_values']);
			}
		}
		elseif (ee()->db->field_exists('settings', 'modules'))
		{
				// Try old settings
				$query = ee()->db->select('settings')->where('module_name', $this->class)->get('modules');
				foreach ($query->result_array() as $row)
				{
					$presets = unserialize($row['settings']);
				}
		}
		
		if ($ajax === TRUE)
		{
			ee()->output->send_ajax_response(array('presets' => $presets, 'CSRF_TOKEN' => $this->csrf_token));
		}
		else
		{
			return $presets;
		}
	}	

	
	/**
	 * Save presets
	 */
	
	public function save_preset()
	{
	
		$field_ids = array();
		
		if (ee()->input->post('field_ids') !== FALSE)
		{
			$field_ids = ee()->input->post('field_ids');
		}
		
		if(ee()->input->post('preset')) 
		{
			$preset = ee()->input->post('preset');
			$newpreset = ee()->input->post('newpreset');
			
			foreach($preset as $field_id => $val)
			{
				$fields = array();
				$fields['site_id'] = $this->site_id;
				$fields['field_id'] = $field_id;
				$fields['serialized'] = 1;
				
				foreach($val as $preset_id => $preset_values)
				{
	
					// is this a new preset?... get highest key
					if ($newpreset == 'true' && $preset_id == 0){
						$query = ee()->db->select_max('preset_id')->from($this->settings_table)->where($fields)->get();
						if ($query->num_rows() > 0)
						{
							foreach ($query->result_array() as $row)
							{
								$preset_id = (int) $row['preset_id'];
							}
						}
						$preset_id++;
					}

					$fields['preset_id'] = $preset_id;
				
					ee()->db->from($this->settings_table);
					ee()->db->where($fields);
					if (ee()->db->count_all_results() == 0) 
					{
						
						$fields['preset_values'] = serialize($preset_values);
						$query = ee()->db->insert($this->settings_table, $fields);
					
					}
					else
					{
						$query = ee()->db->update($this->settings_table, array('preset_values' => serialize($preset_values)), $fields);
					}
					
				}
			}
			
		}
		
		ee()->output->send_ajax_response(array('presets' => $this->get_presets($field_ids, TRUE), 'CSRF_TOKEN' => $this->csrf_token));
		
	}
	
	
	/**
	 * Delete presets
	 */
	
	public function delete_preset()
	{
		// Get existing presets
		$field_ids = array();
		
		if (ee()->input->post('field_ids') !== FALSE)
		{
			$field_ids = ee()->input->post('field_ids');
		}		
		
		// Delete
		$presets = array();
		$field_id = ee()->input->post('field_id');
		$preset_id = ee()->input->post('preset_id');
		
		if ($field_id && $preset_id)
		{
			ee()->db->delete($this->settings_table, array('site_id' => $this->site_id, 'field_id' => $field_id, 'preset_id' => $preset_id)); 
			
		}
		
		ee()->output->send_ajax_response(array('presets' => $this->get_presets($field_ids, TRUE), 'CSRF_TOKEN' => $this->csrf_token));
	}

	
}
/* End of file mcp.grid_presets.php */

