/*!
	Parse a request details: filters, fields selection, sorting
*/

export default function (resource_obj, querystring, context) {
	// resource identifier in the querystring params
	const res_key = resource_obj.relationship ? resource_obj.relationship.name : resource_obj.type;
	// querystring param to consider time to time
	let key = '';

	// ids are needed
	resource_obj.ids = resource_obj.ids || [];

	// is the client asking for a particular subset of fields?
	resource_obj.fields = resource_obj.fields || [];
	key = 'fields[' + res_key + ']';
	if (querystring[key] !== undefined) {
		resource_obj.fields = querystring[key].split(',');
		delete querystring[key];
	} else if (0 === resource_obj.fields.length) {
		// if not, add all fields
		resource_obj.fields = Object.keys(context.resources[resource_obj.type].attributes);
	}

	// is the client asking for a particular sorting?
	resource_obj.sorters = resource_obj.sorters || [];
	key = 'sort[' + res_key + ']';
	if (querystring[key] !== undefined) {
		resource_obj.sorters = querystring[key].split(',').map((field) => {
			return {
				field: field.slice(1),
				// fields are prefixed with + for ascending order and - for descending
				asc: field[0] === '+'
			};
		});
		delete querystring[key];
	}

	// is the client asking for a filtered response?
	resource_obj.filters = resource_obj.filters || [];
	Object.keys(context.resources[resource_obj.type].attributes).forEach((field) => {
		key = res_key + '[' + field + ']';
		if (querystring[key] !== undefined) {
			resource_obj.filters.push({field, values: querystring[key].split(',')});
			delete querystring[key];
		}
	});

	return resource_obj;
}
