"""Validate kit contract outputs with the installed JSON Schema validator."""
import json
import sys
from pathlib import Path

from jsonschema import Draft202012Validator
from referencing import Registry, Resource
from referencing.jsonschema import DRAFT202012

root = Path(__file__).resolve().parents[1]
paths = [*root.joinpath('schemas').glob('*.schema.json'),
         *root.joinpath('src/sections/schemas').glob('*.schema.json'),
         *root.joinpath('src/facade-services/schema').glob('*.schema.json')]
documents = {}
for path in paths:
    schema = json.loads(path.read_text())
    schema['$id'] = path.as_uri()
    documents[path] = schema
schemas = {name: documents[root / 'schemas' / f'{name}.schema.json']
           for name in ('kit', 'placement', 'blueprint', 'kit-request')}
registry = Registry().with_resources(
    (schema['$id'], Resource.from_contents(schema, default_specification=DRAFT202012))
    for schema in documents.values()
)
for schema in schemas.values():
    Draft202012Validator.check_schema(schema)

for case in json.load(sys.stdin):
    validator = Draft202012Validator(schemas[case['schema']], registry=registry)
    errors = list(validator.iter_errors(case['value']))
    if case.get('valid', True):
        assert not errors, '\n'.join(str(error) for error in errors)
    else:
        assert errors, 'invalid contract output passed validation'
