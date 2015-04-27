/*!
	Parse a request details: filters, fields selection, sorting
*/

import keypath from './keypath.js';

export default function (resource_obj, query, context) {
	// resource identifier in the query params
	const res_key = resource_obj.relationship ? keypath(resource_obj) : resource_obj.type;
	// query param to consider time to time
	let key = '';

	// is the client asking for a particular subset of fields?
	resource_obj.fields = resource_obj.fields || [];
	key = 'fields[' + res_key + ']';
	if (query[key] !== undefined) {
		resource_obj.fields = query[key].split(',');
	} else if (0 === resource_obj.fields.length) {
		// if not, add all fields
		resource_obj.fields = Object.keys(context.resources[resource_obj.type].attributes);
	}

	// is the client asking for a particular sorting?
	resource_obj.sorters = resource_obj.sorters || [];
	key = 'sort[' + res_key + ']';
	if (query[key] !== undefined) {
		resource_obj.sorters = query[key].split(',').map((field) => {
			return {
				field: field.slice(1),
				// fields are prefixed with + for ascending order and - for descending
				asc: field[0] === '+'
			};
		});
	}

	// is the client asking for a filtered response?
	resource_obj.filters = resource_obj.filters || [];
	Object.keys(context.resources[resource_obj.type].attributes).forEach((field) => {
		key = res_key + '[' + field + ']';
		if (query[key] !== undefined) {
			resource_obj.filters.push({field, values: query[key].split(',')});
		}
	});

	return resource_obj;
}
