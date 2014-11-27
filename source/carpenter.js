/*!
	Main file!
*/

var typs = require('typs');

var getResourceDescriptionType = require('./getResourceDescriptionType.js');
var exposeAPI = require('./exposeAPI.js');

function Carpenter() {
	// query function
	var query_fn = null;

	this.setQuery = function(fn) {
		if (typs(fn).func().doesntCheck()) {
			throw new Error('setQuery() expects a mysql Connection object as its first parameter');
		}

		query_fn = fn;

		return this;
	};
	this.callQuery = function(sql) {
		var bit_casting = function (field, next) {
			// handle only BIT(1)
			if (field.type === 'BIT' && field.length === 1) {
				var bit = field.string();
				return (null === bit) ? null : (1 === bit.charCodeAt(0) ? true : false);
			}
			// handle everything else as default
			return next();
		};
		console.log(sql.toString());
		var {text, values} = sql.toParam();
		return query_fn({sql: text, typeCast: bit_casting}, values);
	};

	// resources descriptions
	this.resources = {};
	// validates and then adds a new resource to the API
	this.declareResource = function(description) {
		description.sql_table = description.sql_table || description.name;
		description.methods = description.methods.map((method) => method.toUpperCase());

		if(typs(description).isnt(getResourceDescriptionType(description, this))) {
			throw new Error('resource description is not valid');
		}

		this.resources[description.name] = description;
		return this;
	};
	this.exposeAPI = function(stringify) {
		if (typs(stringify).bool().doesntCheck()) {
			throw new Error('exposeAPI() expects a boolean as its first argument');
		}
		if (typs(query_fn).func().doesntCheck()) {
			throw new Error('carpenter needs a mysql query function to work, please provide one with setQuery()');
		}
		return exposeAPI(stringify, this);
	};
};

module.exports.types = require('./types.js');
module.exports.jsonError = require('./jsonError.js');
module.exports.get = () => new Carpenter();
