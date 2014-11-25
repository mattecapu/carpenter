/*!
	Main file!
*/

var typs = require('typs');

var resources = {};
var db_connection = null;

function Carpenter() {
	this.setConnection = function(connection) {
		if (!typs(connection).instanceOf(require('mysql/lib/Connection')).check()) {
			throw new Error('setConnection() expects a mysql Connection object as its first parameter');
		}
		db_connection = connection;
	};
	this.declareResource = function(resource) {
		resource.sql_table = resource.sql_table || resource.name;
		resource.methods = resource.methods.map((method) => method.toUpperCase());

		var inFieldsType = typs().string().notEmpty().satisfies((field) => {
			return -1 !== Object.keys(resource.structure).indexOf(field);
		});
		var inResourcesType = typs().string().notEmpty().satisfies((resource) => {
			return -1 !== Object.keys(resources).indexOf(resource);
		});
		
		var resourceType = {
			name: typs().string().notEmpty(),
			sql_table: typs().string().notEmpty(),
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
				primary: inFieldsType,
				foreign: typs().matchAny([
					typs().Null(),
					typs().array().notEmpty().satisfies((foreigns) => {
						var foreign_fields = foreigns.map((foreign) => foreign.field);
						return foreigns.every((foreign) => {
							return typs(foreign).is({
								// check if every foreign key refers to a different field
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

		if(!typs(resource).is(resourceType)) throw new Error('resource description is not valid');

		resources[resource.name] = resource;
		return this;
	};
	this.exposeAPI = function(stringify) {
		if (!typs(stringify).bool().check()) {
			throw new Error('exposeAPI() expects a boolean as its first argument');
		}
		if (!typs(db_connection).instanceOf(require('mysql/lib/Connection')).check()) {
			throw new Error('carpenter needs a database connection object to work. please provide one using setConnection()');
		}
		return require('./exposeAPI.js')(stringify, {resources, db_connection});
	};
};

module.exports.types = require('./types.js');
module.exports.jsonError = require('./jsonError.js');
module.exports.get = () => new Carpenter();
