Grid Presets
=================

For ExpressionEngine 7

Adds the ability to save and load Grid field values. Useful for duplicating or pre-populating Grid content.

This enables you to save existing content within a Grid which can later be loaded into another of the same field.

Simply click the Save button and give it a name to create a new preset. 
You can also overwrite existing presets or delete them.

This can also be used to speed up content population for testing purposes while in development.


Requirements
------------

- ExpressionEngine 7
- For EE2-EE6, use [1.4.4](https://github.com/ignetic/ee-grid-presets/releases/tag/v1.4.4)


Installation
------------

1. Copy the `grid_presets` folder to `system/user/addons/`
2. Install Grid Presets in the CP under Add-ons
3. Give member roles access to the add-on (Members > Roles > CP Access > Add-ons) so they can use presets

Upgrading from 1.x: replace the folder, then run the update under Add-ons. This converts existing presets to the new format.
Presets from 1.1 or earlier need updating to 1.4.4 first.


Usage
-----

Preset buttons appear under each Grid and File Grid field on the entry publish form, including Grids inside Fluid fields.

- **Save** – with no preset selected, saves the Grid's rows as a new preset; with a preset selected, overwrites it
- **Load** – adds the preset's rows to the Grid
- **Delete** – deletes the selected preset

Presets belong to a field, so they can be loaded into the same field on any entry.


Supported column types
----------------------

- Text, Textarea, Rich Text (CKEditor/Redactor), Number, URL, Email and other text inputs
- Select, Multi Select, Checkboxes, Radio Buttons, Selectable Buttons, Toggle, Color Picker
- File, Assets
- Relationships (loaded entries show their titles and stay editable)
- MX Select Plus
- Channel Images Select (thumbnails for loaded images need [1.4.2+](https://github.com/ignetic/ee-channel-images-select/releases/tag/v1.4.2))

Other third-party column types are saved and loaded as plain form values where possible.
