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
- **Copy** – copies the Grid's rows (with a headings row), to paste into a spreadsheet or into the same Grid on another entry
- **Paste** – pastes rows copied from a web page table, Excel, Google Sheets, or tab/space separated text

Presets belong to a field, so they can be loaded into the same field on any entry.


Pasting rows
------------

Click **Paste**, then paste (Ctrl+V / Cmd+V) into the box. A preview shows how the rows will fill the Grid:

- Columns are filled by position, or by name when the first row matches the Grid's column labels. Choose a different source for any column from its dropdown.
- **Swap rows and columns** turns a spec sheet (names down the first column, one product per column) into rows.
- Values are matched to options (selects, dropdowns, MX Select Plus, checkboxes, radios, toggles, relationships by entry title). Values with no match are highlighted and left empty.
- Choose **Add after existing rows** or **Replace existing rows**. Pasting stops at the Grid's maximum rows.

Tab separated text is split on tabs; otherwise columns need at least two spaces between them, so values like "Antique Brass" stay together. File, Assets and Channel Images columns aren't filled by pasting.


Supported column types
----------------------

- Text, Textarea, Rich Text (CKEditor/Redactor), Number, URL, Email and other text inputs
- Select, Multi Select, Checkboxes, Radio Buttons, Selectable Buttons, Toggle, Color Picker
- File, Assets
- Relationships (loaded entries show their titles and stay editable)
- MX Select Plus
- Channel Images Select (thumbnails for loaded images need [1.4.2+](https://github.com/ignetic/ee-channel-images-select/releases/tag/v1.4.2))

Other third-party column types are saved and loaded as plain form values where possible.
