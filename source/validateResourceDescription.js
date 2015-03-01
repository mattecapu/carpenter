/*!
	Resource type validation
*/

var typs = require('typs');


var validateResourceDescription = function (resource, context) {

	var identifierType = typs().string().notEmpty();

	// is one of the attributes?
	var inAttributesType = identifierType.oneOf(Object.keys(resource.attributes));
	// is one of the resources?
	var inResourcesType = identifierType.oneOf(Object.keys(context.resources));
	// a set of attributes
	var attributeType = typs().matchesAny([
		typs().hollow(),
		typs().keyable().andEachMapEntry().matches({
			// reserved words
			key: identifierType.not(typs().oneOf(['include', 'fields', 'sort'])),
			value: {
				// type of the allowed values for this attribute
				domain: typs().type(),
				// column in the database
				sql_column: identifierType
			}
		})
	]);

	return typs(resource).object().is({
		// identifier of the resource
		type: identifierType,
		// identifier of the database table
		sql_table: identifierType,
		// attributes of the resource
		attributes: attributeType,
		// relationships to other resources
		relationships: typs().andEachMapEntry().matches({
			// relationship identifier
			key: identifierType,
			value: typs().matchesAny([
				// one-to-one relationship
				typs().matches({
					to: typs().equals('one'),
					// related resource
					type: inResourcesType,
					// optional additional attributes
					attributes: attributeType,
					sql_table: identifierType,
					sql_column: identifierType
				}),
				// one-to-many relationship
				typs().matches({
					to: typs().equals('many'),
					// related resource
					type: inResourcesType,
					// optional additional attributes
					attributes: attributeType,
					sql_table: identifierType,
					// keys on the relationship table
					first_key: identifierType,
					second_key: identifierType
				}),
			])
		}),
		methods: typs().array().notEmpty().andEach().oneOf(['GET', 'DELETE', 'POST', 'PUT'])
	});
};

module.exports = validateResourceDescription;
