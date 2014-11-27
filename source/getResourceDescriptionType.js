/*!
	Resource type validation
*/

var typs = require('typs');


 var getResourceDescriptionType = function (resource, context) {
	var inFieldsType = typs().string().notEmpty().satisfies((field) => {
		return -1 !== Object.keys(resource.structure).indexOf(field);
	});
	var inResourcesType = typs().string().notEmpty().satisfies((resource) => {
		return -1 !== Object.keys(context.resources).indexOf(resource);
	});

	var resourceDescriptionType = {
		// resource name and its database table alias
		name: typs().string().notEmpty(),
		sql_table: typs().string().notEmpty(),

		// resource attributes descriptor
		structure: typs().object().satisfies((structure) => {
				// converts the shortcut {'field': 'type'} to the extended description
				Object.keys(structure).forEach((key) => {
					if (typs(structure[key]).type().check()) {
						structure[key] = {type: structure[key], sql_column: key};
					}
				});

				// checks if all the fields are now in the form {type: 'type', sql_column: 'field'}
				var type_valid = Object.keys(structure).every((key) => {
					return typs(structure[key]).is({
						type: typs().type(),
						sql_column: typs().string().notEmpty()
					});
				});
				if (!type_valid) return false;

				// checks if there are conflicts among 'sql_column's
				return Object.keys(structure)
						.map((key) => structure[key].sql_column)
						.every((column, i, array) => array.indexOf(column) === array.lastIndexOf(column));
		}),

		keys: typs().object().match({
			// check if it's actually a resource's field
			primary: inFieldsType,
			foreign: typs().matchAny([
				typs().Null(),
				// check if every foreign key refers to a different field
				typs().array().notEmpty().satisfies((foreigns) => {
					var foreign_fields = foreigns.map((foreign) => foreign.field);
					return foreigns.every((foreign) => {
						return typs(foreign).is({
							field: inFieldsType.satisfies((field) => {
								foreign_fields.indexOf(field) === foreign_fields.lastIndexOf(field)
							}),
							resource: inResourcesType
						});
					});
				})
			])
		}),

		methods: typs().array().notEmpty().satisfies((methods) => methods.every((method) => -1 !== ['GET', 'PUT', 'POST', 'DELETE'].indexOf(method)))
	};

	return resourceDescriptionType;
};

module.exports = getResourceDescriptionType;
