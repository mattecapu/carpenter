/*!
	Normalize a resource description
	Expand shortcuts to have a more comfortable structure to deal with in the code
*/

var typs = require('typs');

var domains = require('./domains.js');

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

	description.primary_key = description.primary_key || 'id';
	description.sql_table = description.sql_table || description.type;
	description.methods = description.methods.map((method) => method.toUpperCase());

	description.attributes = normalize_attributes(description.attributes || {});
	description.attributes.id = {domain: domains.id, sql_column: 'id'};

	// all the columns of the MySQL table
	description.columns = {};
	Object.keys(description.attributes).forEach((attribute) => {
		description.columns[attribute] = description.attributes[attribute].sql_column;
	});

	// relationships objects
	description.relationships = description.relationships || {};
	Object.keys(description.relationships).forEach((name) => {
		let relationship = description.relationships[name];

		// store the name in the object itself for simpler retrieving
		relationship.name = name;
		// additional attributes of the relationship
		relationship.attributes = normalize_attributes(relationship.attributes || {});

		// one to one relationships
		if (relationship.to === 'one') {
			// probably hosted in the same table of the resource
			relationship.sql_table = relationship.sql_table || description.sql_table;
			// normalization of the keys to handle one-to-one relationships as one-to-many with cardinality 1:
			// so from_key is the primary key itself: is the key to the resource
			// to which relationship is declared
			relationship.from_key = relationship.from_key || description.primary_key;
			// and to_key is the key to the other table where relationship is stored:
			// could be the same table, could be another, but this key refers to
			//the key to the related resource table
			relationship.to_key = relationship.to_key || name + '_id';

			// if the relationship is on the same table, let's add it to the columns vector
			if (relationship.sql_table === description.sql_table) {
				description.columns[name] = relationship.from_key;
				Object.keys(relationship.attributes).forEach((attribute) => {
					description.columns[attribute] = relationship.attributes[attribute].sql_column;
				});
			}
		// one to many relationships
		} else if (relationship.to === 'many') {
			// probable name of the table where the relationship is stored
			relationship.sql_table = relationship.sql_table || description.type.slice(0, -1) + '_' + name;
			// with a foreign key to this resource
			relationship.from_key = relationship.from_key || description.type.slice(0, -1) + '_id';
			// and a foreign key to the other (relationship.type resource)
			relationship.to_key = relationship.to_key || name.slice(0, -1) + '_id';
		}
	});
	// convert the map to an array for easier iteration
	description.relationships = Object.keys(description.relationships).map((x) => description.relationships[x]);

	return description;
}

module.exports = normalizeResourceDescription;
