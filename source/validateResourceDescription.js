/*!
	Resource type validation
*/

import typs from 'typs';

export default function (resource, context) {

	const identifierType = typs().string().notEmpty();

	// is one of the attributes?
	const inAttributesType = identifierType.oneOf(Object.keys(resource.attributes));
	// is one of the resources?
	const inResourcesType = identifierType.oneOf(Object.keys(context.resources));
	// a set of attributes
	const attributeType = typs().matchesAny([
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
			// properties
			value: typs().matches({
				to: typs().oneOf(['one', 'many']),
				// related resource
				type: inResourcesType,
				// optional additional attributes
				attributes: attributeType,
				sql_table: identifierType,
				from_key: identifierType,
				to_key: identifierType
			})
		}),
		methods: typs().array().notEmpty().andEach().oneOf(['GET', 'DELETE', 'POST', 'PUT'])
	});
}
