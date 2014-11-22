/*!
	exposeAPI()
	return a function that consumes an URL and a body and returns a response
*/

var typs = require('typs');

module.exports = function(stringify, resources, db_connection) {
	return function(url, method, body) {

		// split the path and trim empty parts
		var path = url.split('/');
		if (path[0] === '') path.shift();
		if (path[path.length - 1] === '') path.pop();

		// primary resource
		var primary = {};
		// linked resources
		var linked = [];

		// root resource (the first specified collection in the URL)
		var root = {
			resource: path[0],
			ids: (path.length > 1 ? path[1].split(',') : 'any');
		};

		// client is actually asking for a resource linked to the root resource?
		if(path[2] === 'links') {
			// if yes, it must specify what linked resource it wants
			if (path.length === 3) throw new Error('invalid URL');
			// that becomes the primary resource of the request
			primary = {
				resource: path[3],
				ids: (path.length > 4 ? path[4].split(',') : 'any')
			};
			// and the root resource is just an additional filter
			primary.filters[root.resource] = root.resource.ids;
		} else {
			// otherwise the root resource is also the primary resource
			primary = root;
		}

		// is the client asking for specific fields?
		if (typs(body.fields).notNull.check()) {
			primary.fields = body.fields.split(',');
			delete body.fields;
		} else {
			// if not, add all fields
			primary.fields = Object.keys(resources[primary.resource].type);
		}

		// is the client asking for a specific sorting?
		if (typs(body.sort).notNull().check()) {
			primary.sort = body.sort.split(',');
			delete body.sort;
		}

		// is the client asking for a filtered subset?
		primary.filters = primary.filters || {};
		Object.keys(resources[primary_resource].type).forEach((field) => {
			if (field === 'id') return;
			if (body[field] !== undefined) primary.filters[field] = body[field];
		});
		// anyway, we filter with the resource ID given (if given)
		if (primary.ids !== 'any') primary.filters.id = primary.ids;
		//delete primary.ids;

		// is the client asking also for linked resources?
		if (typs(body.include).notNull().check()) {
			// get all the resources and their constraints (see primary)
			linked = body.include.split(',').map((linked_resource) => {
				var linked = {resource: linked_resource};

				linked.fields = {};
				var key = 'fields[' + linked_resource + ']';
				if (typs(body[key]).notNull().check()) {
					linked.fields[linked_resource] = body[key].split(',');
					delete body[key];
				}
				if (!typs(linked.fields).notEmpty()) delete linked.fields;

				linked.sort = {};
				var key = 'sort[' + linked_resource + ']';
				if (typs(body[key]).notNull().check()) {
					linked.sort[linked_resource] = body[key].split(',');
					delete body[key];
				}
				if (!typs(linked.sort).notEmpty()) delete linked.sort;

				linked.filters = {};
				Object.keys(resources[linked_resource].type).forEach((field) => {
					if (field === 'id') return;
					if (body[field] !== undefined) linked.filters[field] = body[field];
				});

				return linked;
			});

			delete body.include;
		}

		[query, response] = ({'GET': handleGet, 'POST': handlePost, 'PUT': handlePut, 'DELETE':handleDelete})[method](path, body);
		if (stringify) response = JSON.stringify(response);
		return response;
	};
};

