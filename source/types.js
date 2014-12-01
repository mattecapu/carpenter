/*!
	Types
	collection of common types
*/

var typs = require('typs');

var types = {
	id: typs().integer().positive().notZero(),
	email: typs().string().regex(/[a-z0-9!#$%&'*+\/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+(?:[A-Z]{2}|com|org|net|edu|gov|mil|biz|info|mobi|name|aero|asia|jobs|museum)\b/i),
	flag: typs().matchAny([typs().equals(0), typs().equals(1), typs().bool()]),
	text: typs().string(),
	string: typs().string(),

	custom: typs()
};

module.exports = types;
