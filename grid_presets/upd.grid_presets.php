<?php  if ( ! defined('BASEPATH')) exit('No direct script access allowed');

/**
 * ExpressionEngine Grid Presets Module Install/Update File
 *
 * @package		Grid Presets
 * @subpackage	Addons
 * @category	Module
 * @author		Simon Andersohn
 * @link		
 */
 
require_once PATH_THIRD.'grid_presets/config.php';
 
class Grid_presets_upd {
	
	public $name = GRID_PRESETS_NAME;
	public $version = GRID_PRESETS_VERSION; 
	
	private $class = 'Grid_presets';
	private $settings_table = 'grid_presets_settings';
	private $site_id = 1;
	
	/**
	 * Constructor
	 */
	public function __construct()
	{

		$this->site_id = ee()->config->item('site_id');
		
	}
	
	// ----------------------------------------------------------------
	
	/**
	 * Installation Method
	 *
	 * @return 	boolean 	TRUE
	 */
	public function install()
	{
		$mod_data = array(
			'module_name'			=> 'Grid_presets',
			'module_version'		=> $this->version,
			'has_cp_backend'		=> "y",
			'has_publish_fields'	=> 'n'
		);
		
		ee()->db->insert('modules', $mod_data);
		
		
		// Create settings table
		$this->add_settings_table();
		
		return TRUE;
	}

	// ----------------------------------------------------------------
	
	/**
	 * Uninstall
	 *
	 * @return 	boolean 	TRUE
	 */	
	public function uninstall()
	{
		$mod_id = ee()->db->select('module_id')
								->get_where('modules', array(
									'module_name'	=> $this->class
								))->row('module_id');
		
		if (ee()->db->table_exists('module_member_groups'))
		{
			ee()->db->where('module_id', $mod_id)->delete('module_member_groups');
		}	
		if (ee()->db->table_exists('module_member_roles')) 
		{
			ee()->db->where('module_id', $mod_id)->delete('module_member_roles');
		}
		
		ee()->db->where('module_name', $this->class)
					->delete('modules');
					 
		ee()->db->where('class', $this->class)
					->delete('actions');
		
		ee()->load->dbforge();
		ee()->dbforge->drop_table($this->settings_table);
		
		return TRUE;
	}
	
	// ----------------------------------------------------------------
	
	/**
	 * Module Updater
	 *
	 * @return 	boolean 	TRUE
	 */	
	public function update($current = '')
	{
		if ($current == $this->version)
		{
			return FALSE;
		}	

		if (version_compare($current, '1.2', '<'))
		{
			// Create new table
			$this->add_settings_table();

			// Move old settings to new table
			$presets = array();
			
			if (ee()->db->field_exists('settings', 'modules'))
			{
			
				// Get settings from old table
				$query = ee()->db->select('settings')->where('module_name', $this->class)->get('modules');
				foreach ($query->result_array() as $row)
				{
					$presets = unserialize($row['settings']);
				}
				
				if (!empty($presets))
				{
					// add to new table
					foreach($presets as $field_id => $val)
					{
						$fields = array();
						$fields['site_id'] = $this->site_id;
						$fields['field_id'] = $field_id;
						$fields['serialized'] = 1;
						
						foreach($val as $preset_id => $preset_values)
						{
							// Let's start the preset ids from 1
							$fields['preset_id'] = $preset_id+1;
						
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
				
					// Remove settings from old table
					ee()->db->update('modules', array('settings' => NULL), array('module_name' => $this->class));
					
				}
			
			}
			
			
		}

		return TRUE;
	}
	
	
	private function add_settings_table()
	{
		ee()->load->dbforge();

		$fields = array(
			'id'	=> array(
				'type' => 'int',
				'constraint' => 10,
				'unsigned' => TRUE,
				'auto_increment' => TRUE
			),
			'site_id' => array(
				'type' => 'int',
				'constraint' => 4,
				'default' => 1,
			),
			'field_id' => array(
				'type' => 'int',
				'constraint' => 4,
				'default' => 1,
			),
			'preset_id' => array(
				'type' => 'varchar',
				'constraint' => 255,
			),
			'preset_values' => array(
				'type' => 'text'
			),
			'serialized' => array(
				'type' => 'int',
				'constraint' => 1,
				'null' => TRUE,
			),
		);
		

		ee()->dbforge->add_field($fields);
		ee()->dbforge->add_key('id', TRUE);
		ee()->dbforge->create_table($this->settings_table, TRUE);		
	}
	
}
/* End of file upd.grid_presets.php */
/* Location: /system/expressionengine/third_party/grid_presets/upd.grid_presets.php */
