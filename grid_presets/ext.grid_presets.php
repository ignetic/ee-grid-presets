<?php if (! defined('APP_VER')) exit('No direct script access allowed');

/**
 * ExpressionEngine Grid Presets Module Control Panel File
 *
 * @package		Grid Presets
 * @subpackage	Addons
 * @category	Module
 * @author		Simon Andersohn
 * @link		
 */
 
require_once PATH_THIRD.'grid_presets/config.php';

class Grid_presets_ext {

	public $name           = GRID_PRESETS_NAME;
	public $version        = GRID_PRESETS_VERSION; 
	public $description    = GRID_PRESETS_DESCRIPTION;
	public $docs_url       = GRID_PRESETS_DOCS_URL;
	
	public $settings_exist = 'n';


	/**
	 * Class Constructor
	 */
	public function __construct($settings = array())
	{
		
		// --------------------------------------------
		//  Settings!
		// --------------------------------------------
	
		$this->settings = $settings;

	}

	// --------------------------------------------------------------------

	
	/**
	 * Activate Extension
	 */
	public function activate_extension()
	{
		// Setup custom settings in this array.
		$this->settings = array();
	
		// -------------------------------------------
		//  Add the extension hooks
		// -------------------------------------------

		$hooks = array(
			'cp_js_end',
		);

		foreach($hooks as $hook)
		{
			ee()->db->insert('extensions', array(
				'class'    => get_class($this),
				'method'   => $hook,
				'hook'     => $hook,
				'settings' => serialize($this->settings),
				'priority' => 110,
				'version'  => $this->version,
				'enabled'  => 'y'
			));
		}
	}
	
    public function settings()
    {
        return array();
    }

	/**
	 * Update Extension
	 */
	public function update_extension($current = '')
	{
		// Nothing to change...
		return FALSE;
	}

	/**
	 * Disable Extension
	 */
	public function disable_extension()
	{
		// -------------------------------------------
		//  Delete the extension hooks
		// -------------------------------------------

		ee()->db->where('class', get_class($this))
		             ->delete('exp_extensions');
	}

	// --------------------------------------------------------------------


	/**
	 * cp_js_end ext hook
	 */
	function cp_js_end()
	{
	
		$output = '';
	
		if (ee()->extensions->last_call !== FALSE)
		{
			$output = ee()->extensions->last_call;
		}

		$vars['base'] = '';
		$vars['assets_act_id'] = false;
		
		if (ee()->addons_model->module_installed('assets')) {
			$vars['assets_act_id'] = $this->fetch_action_id( 'Assets_mcp', 'get_selected_files' );
		}
		
		if ( version_compare( APP_VER, '3', '>=' ) )
		{
			$vars['base'] = ee('CP/URL')->make('cp/addons/settings/grid_presets', array(), '', '') . '/'; 
		}
		
		if ( version_compare( APP_VER, '4', '>=' ) )
		{
			$output .= ee()->load->view('grid_presets.js', $vars, TRUE);
		}
		else 
		{
			$output .= ee()->load->view('grid_presets_ee3.js', $vars, TRUE);
		}
	
		return $output;

	}

	
	
	/**
	 * Fetch Action ID
	 *
	 * @param $class
	 * @param $method
	 * @return bool
	 */
	private function fetch_action_id($class, $method)
	{
		ee()->db->select('action_id');
		ee()->db->where('class', $class);
		ee()->db->where('method', $method);
		$query = ee()->db->get('actions');

		if ($query->num_rows() == 0)
		{
			return false;
		}

		return $query->row('action_id');
	}

}
/* End of file ext.grid_presets.php */
/* Location: /system/expressionengine/third_party/grid_presets/ext.grid_presets.php */