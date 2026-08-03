/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("animal_movements");

  collection.fields.add(new Field({
    "autogeneratePattern": "",
    "hidden": false,
    "id": "text456942138",
    "max": 0,
    "min": 0,
    "name": "transporter_vehicle_reg",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }));

  collection.fields.add(new Field({
    "autogeneratePattern": "",
    "hidden": false,
    "id": "text543455428",
    "max": 0,
    "min": 0,
    "name": "transporter_permit_number",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }));

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("animal_movements");

  collection.fields.removeByName("transporter_vehicle_reg");
  collection.fields.removeByName("transporter_permit_number");

  return app.save(collection);
})
