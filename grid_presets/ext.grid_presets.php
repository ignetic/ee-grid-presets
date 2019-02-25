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
	
		$this->EE = get_instance();
		
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
			$this->EE->db->insert('extensions', array(
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

		$this->EE->db->where('class', get_class($this))
		             ->delete('exp_extensions');
	}

	// --------------------------------------------------------------------


	/**
	 * cp_js_end ext hook
	 */
	function cp_js_end()
	{
	
		$output = '';
	
		if ($this->EE->extensions->last_call !== FALSE)
		{
			$output = $this->EE->extensions->last_call;
		}

		$vars['base'] = '';
		
		if ( version_compare( APP_VER, '3', '>=' ) )
		{
			$vars['base'] = ee('CP/URL')->make('cp/addons/settings/grid_presets', array(), '', '') . '/'; 
		}
		
		$output .= $this->EE->load->view('grid_presets.js', $vars, TRUE);
	
		return $output;

	}

}
/* End of file ext.grid_presets.php */
/* Location: /system/expressionengine/third_party/grid_presets/ext.grid_presets.php */