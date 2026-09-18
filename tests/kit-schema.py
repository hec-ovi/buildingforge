"""Validate kit contract outputs with the installed JSON Schema validator."""
import json
import sys
from pathlib import Path

from jsonschema import Draft202012Validator
from referencing import Registry, Resource

root = Path(__file__).resolve().parents[1] / 'schemas'
schemas = {name: json.loads((root / f'{name}.schema.json').read_text())
           for name in ('kit', 'placement')}
registry = Registry().with_resources(
    (schema['$id'], Resource.from_contents(schema)) for schema in schemas.values()
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
