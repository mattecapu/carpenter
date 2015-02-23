/*!
	Domains
	collection of common attribute types
*/

var typs = require('typs');

var domains = {
	id: typs().integer().positive().notZero(),
	email: typs().string().regex(/[a-z0-9!#$%&'*+\/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+(?:[A-Z]{2}|com|org|net|edu|gov|mil|biz|info|mobi|name|aero|asia|jobs|museum)\b/i),
	flag: typs().matchesAny([typs().oneOf([0, 1]), typs().bool()]),
	text: typs().string(),
	string: typs().string(),
	timestamp: typs().matchesAny([typs().Null(), typs().positive()]),
	nil: typs().Null(),
	nullable: (type) => typs().matchesAny([typs().Null(), type]),

	custom: typs()
};

module.exports = domains;
