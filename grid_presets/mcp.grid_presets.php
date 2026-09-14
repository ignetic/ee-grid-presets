<?php  if ( ! defined('BASEPATH')) exit('No direct script access allowed');

/**
 * ExpressionEngine Grid Presets Control Panel File
 *
 * @package		Grid Presets
 * @subpackage	Addons
 * @category	Module
 * @author		Simon Andersohn
 * @link		https://github.com/ignetic/ee-grid-presets
 */

require_once PATH_THIRD.'grid_presets/config.php';

class Grid_presets_mcp {

	public $name = GRID_PRESETS_NAME;
	public $version = GRID_PRESETS_VERSION;

	private $settings_table = 'grid_presets_settings';
	private $site_id = 1;

	// Field types that presets can be saved for
	private $grid_fieldtypes = array('grid', 'file_grid');


	/**
	 * Constructor
	 */
	public function __construct()
	{
		$this->site_id = (int) ee()->config->item('site_id');
	}

	// ----------------------------------------------------------------

	/**
	 * Index Function
	 *
	 * @return 	string
	 */
	public function index()
	{
		ee()->view->cp_page_title = lang('grid_presets_module_name');

		return lang('grid_presets_index_note');
	}


	/**
	 * Get presets for the posted field IDs (AJAX)
	 */
	public function get_presets()
	{
		ee()->output->send_ajax_response(array(
			'presets'       => $this->fetch_presets($this->posted_field_ids()),
			'assets_act_id' => $this->get_assets_act_id(),
		));
	}


	/**
	 * Save a new preset, or overwrite an existing one (AJAX)
	 *
	 * POST: field_id, preset_id (empty/0 for new), name, values (JSON), field_ids
	 */
	public function save_preset()
	{
		$field_id  = (int) ee()->input->post('field_id');
		$preset_id = (int) ee()->input->post('preset_id');
		$name      = trim((string) ee()->input->post('name'));
		$values    = json_decode((string) ee()->input->post('values'), TRUE);

		if ( ! $this->is_grid_field($field_id) || $name === '' || ! is_array($values))
		{
			ee()->output->send_ajax_response(array('error' => 'Invalid preset.'), TRUE);
		}

		$preset = array(
			'name'   => mb_substr($name, 0, 255),
			'values' => $values,
		);

		// Relationship entry titles, for showing loaded entries: {entry_id: title}
		$labels = json_decode((string) ee()->input->post('labels'), TRUE);

		if (is_array($labels) && ! empty($labels))
		{
			$preset['labels'] = array_map('strval', array_filter($labels, 'is_scalar'));
		}

		$preset_values = json_encode($preset, JSON_INVALID_UTF8_SUBSTITUTE);

		if ($preset_values === FALSE)
		{
			ee()->output->send_ajax_response(array('error' => 'The preset could not be encoded.'), TRUE);
		}

		$where = array(
			'site_id'  => $this->site_id,
			'field_id' => $field_id,
		);

		// New preset: next ID (preset_id is a varchar, so cast for a numeric max; as text, '9' sorts after '10')
		if ( ! $preset_id)
		{
			$row = ee()->db->select('MAX(CAST(preset_id AS UNSIGNED)) AS max_id', FALSE)
				->where($where)
				->get($this->settings_table)
				->row_array();

			$preset_id = (int) ($row['max_id'] ?? 0) + 1;
		}

		$where['preset_id'] = $preset_id;

		// serialized: 1 = PHP serialized (pre 2.0), 0 = JSON
		$data = array(
			'preset_values' => $preset_values,
			'serialized'    => 0,
		);

		if (ee()->db->where($where)->count_all_results($this->settings_table) > 0)
		{
			ee()->db->update($this->settings_table, $data, $where);
		}
		else
		{
			ee()->db->insert($this->settings_table, array_merge($where, $data));
		}

		ee()->output->send_ajax_response(array(
			'presets'   => $this->fetch_presets($this->posted_field_ids()),
			'preset_id' => $preset_id,
		));
	}


	/**
	 * Delete a preset (AJAX)
	 *
	 * POST: field_id, preset_id, field_ids
	 */
	public function delete_preset()
	{
		$field_id  = (int) ee()->input->post('field_id');
		$preset_id = (int) ee()->input->post('preset_id');

		if ($field_id && $preset_id)
		{
			ee()->db->delete($this->settings_table, array(
				'site_id'   => $this->site_id,
				'field_id'  => $field_id,
				'preset_id' => $preset_id,
			));
		}

		ee()->output->send_ajax_response(array(
			'presets' => $this->fetch_presets($this->posted_field_ids()),
		));
	}


	/**
	 * Presets for these fields, as [field_id][preset_id] => array('name' => ..., 'values' => ...)
	 *
	 * @return array
	 */
	private function fetch_presets($field_ids)
	{
		$presets = array();

		// Never return every preset on the site
		if (empty($field_ids))
		{
			return $presets;
		}

		$query = ee()->db->where('site_id', $this->site_id)
			->where_in('field_id', $field_ids)
			->get($this->settings_table);

		foreach ($query->result_array() as $row)
		{
			$preset = $row['serialized']
				? $this->unserialize_values($row['preset_values'])
				: json_decode((string) $row['preset_values'], TRUE);

			// Skip corrupt/truncated presets
			if (is_array($preset) && isset($preset['values']))
			{
				$presets[$row['field_id']][$row['preset_id']] = $preset;
			}
		}

		foreach ($presets as &$field_presets)
		{
			ksort($field_presets, SORT_NUMERIC);
		}

		return $presets;
	}


	/**
	 * Posted field IDs (integers only)
	 *
	 * @return array
	 */
	private function posted_field_ids()
	{
		$field_ids = ee()->input->post('field_ids');

		if ( ! is_array($field_ids))
		{
			return array();
		}

		return array_values(array_unique(array_filter(array_map('intval', $field_ids))));
	}


	/**
	 * Is this a Grid or File Grid field?
	 *
	 * @return bool
	 */
	private function is_grid_field($field_id)
	{
		if ($field_id < 1)
		{
			return FALSE;
		}

		return ee()->db->where('field_id', $field_id)
			->where_in('field_type', $this->grid_fieldtypes)
			->count_all_results('channel_fields') > 0;
	}


	/**
	 * Unserialize pre-2.0 preset data (arrays only, never objects)
	 *
	 * @return array|bool FALSE if empty or invalid
	 */
	private function unserialize_values($data)
	{
		if ( ! $data)
		{
			return FALSE;
		}

		$values = @unserialize($data, array('allowed_classes' => false));

		return is_array($values) ? $values : FALSE;
	}


	/**
	 * Assets action ID (for loading Assets thumbnails), if Assets is installed
	 *
	 * @return int|bool
	 */
	private function get_assets_act_id()
	{
		if ( ! ee()->addons_model->module_installed('assets'))
		{
			return FALSE;
		}

		$query = ee()->db->select('action_id')
			->where('class', 'Assets_mcp')
			->where('method', 'get_selected_files')
			->get('actions');

		return $query->num_rows() ? (int) $query->row('action_id') : FALSE;
	}

}
/* End of file mcp.grid_presets.php */
