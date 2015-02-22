/*!
	Normalize a resource description
	Expand shortcuts to have a more comfortable structure to deal with in the code
*/

var typs = require('typs');

var normalizeResourceDescription = function (description) {

	let normalize_attributes = (attributes) => {
		// converts the shortcut {'field': 'type'} to the extended description
		Object.keys(attributes).forEach((key) => {
			if (typs(attributes[key]).type().check()) {
				attributes[key] = {domain: attributes[key], sql_column: key};
			}
		});
		return attributes;
	}

	description.sql_table = description.sql_table || description.type;
	description.relationships = description.relationships || {};
	description.methods = description.methods.map((method) => method.toUpperCase());

	description.attributes = normalize_attributes(description.attributes || {});

	Object.keys(description.relationships).forEach((name) => {
		let relationship = description.relationships[name];
		// one to one relationships
		if (relationship.to === 'one') {
			// probably hosted in the same table of the resource
			relationship.sql_table = relationship.sql_table || description.sql_table;
			// with a foreign key
			relationship.sql_column = relationship.sql_column || name + '_id';
		// one to many relationships
		} else if (relationship.to === 'many') {
			// probable name of the table where the relationship is stored
			relationship.sql_table = relationship.sql_table || description.type.slice(0, -1) + '_' + name;
			// with a foreign key to that
			relationship.sql_column = relationship.sql_column || description.type.slice(0, -1) + '_id';
		}
		// additional attributes of the relationship
		relationship.attributes = normalize_attributes(relationship.attributes || {});
	});

	return description;
}

module.exports = normalizeResourceDescription;
