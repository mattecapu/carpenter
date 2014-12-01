/*!
	POST requests handler
*/

var typs = require('typs');
var squel = require('squel');
var Promise = require('bluebird');

var jsonError = require('./jsonError.js');
var assertResourceExists = require('./assertResourceExists.js');


var handlePost = function (request, body, context) {
	squel.useFlavour('mysql');

	var objects = body[request.primary.resource];
	objects = typs(objects).array().check()	? objects : [objects];

	var query = squel.insert().into(context.resources[request.primary.resource].sql_table);

	// validate the resource objects
	objects.forEach((data) => {
		// typecheck all the fields
		Object.keys(context.resources[request.primary.resource].structure).forEach((field) => {
			if (field === context.resources[request.primary.resource].keys.primary) return;
			if (typs(data[field]).isnt(context.resources[request.primary.resource].structure[field].type)) {
				throw new jsonError({
					title: 'Bad request',
					detail: 'The value specified for the field \'' + field + '\' doesn\'t typecheck',
					status: 400
				});
			}
		});
	})

	var rows = objects.map((data) => {
		// build the row object
		var row = {};
		Object.keys(data).forEach((field) => {
			row[context.resources[request.primary.resource].structure[field].sql_column] = data[field];
		});
		return row;
	});

	query = query.setFieldsRows(rows);

	return context.callQuery(query).spread((stats) => {
		var handleGet = require('./handleGet.js');
		var parseUrl = require('./parseUrl.js');
		return handleGet(parseUrl('/' + request.primary.resource + '/' + [stats.insertId].join(','), context), null, context);
	}).then((response) => {
		response.status = 201;
		return response;
	});
};

module.exports = handlePost;
