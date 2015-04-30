/*!
	Main file!
*/

import typs from 'typs';
import Promise from 'bluebird';

import jsonError from './jsonError.js';
import validateSchema from './validateSchema.js';
import normalizeSchema from './normalizeSchema.js';
import exposeAPI from './exposeAPI.js';

// query function
let query_fn = null;

class Carpenter {
	constructor() {
		// resources descriptions
		this.resources = {};
	}
	setQuery(fn) {
		if (typs(fn).func().doesntCheck()) {
			throw new Error('setQuery() expects a mysql Connection object as its first parameter');
		}
		query_fn = fn;
		return this;
	}
	callQuery(sql) {
		// the empty query
		if (typs(sql).Null().check()) return Promise.resolve([{}, {}]);

		// non-squel query
		if (typs(sql).string().check()) {
			const dereferenced_sql = sql;
			sql = {
				toParam: () => {
					return {text: dereferenced_sql, values: []};
				}
			};
		}

		// sensical handling for flag type
		const bit_casting = (field, next) => {
			// handle only BIT(1)
			if (field.type === 'BIT' && field.length === 1) {
				const bit = field.string();
				return (null === bit) ? null : (1 === bit.charCodeAt(0) ? true : false);
			}
			// handle everything else as default
			return next();
		};

		let {text, values} = sql.toParam();
		return query_fn({sql: text, typeCast: bit_casting}, values).catch((error) => {
			// Generic error
			if (!error.cause) throw error;
			// MySQL error
			switch(error.cause.code) {
				case 'ER_NO_REFERENCED_ROW':
				case 'ER_NO_REFERENCED_ROW_':
				case 'ER_NO_REFERENCED_ROW_2':
					throw new jsonError({
						title: 'Schema exception',
						details: 'The entity you are adding/updating makes one or more foreign key fail or references an inexistent entity'
					});
				case 'ER_DUP_ENTRY':
					throw new jsonError({
						title: 'Schema exception',
						details: 'The entity you are adding/updating makes a unique key fail'
					});
				case 'ECONNREFUSED':
					throw new jsonError({
						title: 'Database exception',
						details: 'Can\'t connect to the database',
						status: 500
					});
				default:
					throw new jsonError({
						title: 'Schema exception',
						details: 'Your request isn\'t compatible with the current schema of data (error \'' + error.cause.code + '\')'
					});
			}
		});
	}
	// validates and then adds a new resource to the API
	declareResource(description) {
		this.resources[description.type] = normalizeSchema(description);
		return this;
	}
	exposeAPI() {
		if (typs(this.resources).notEmpty().andEachProp().satisfies((x) => validateSchema(x, this)).doesntCheck()) {
			throw new Error('resource description is not valid');
		}
		if (typs(query_fn).func().doesntCheck()) {
			throw new Error('carpenter needs a mysql query function to work, please provide one with setQuery()');
		}
		return exposeAPI(this);
	}
}

export {default as domains} from './domains.js';
export {default as jsonError} from './jsonError.js';
export const get = () => new Carpenter();
