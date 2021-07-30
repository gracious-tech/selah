
from decimal import Decimal

from boto3.dynamodb.types import DYNAMODB_CONTEXT, TypeSerializer, TypeDeserializer


def add_support_for_floats_to_dynamodb():
    """Convert to/from Decimal when working with DynamoDB (which only accepts Decimals for numbers)

    WARN There may be a loss of precision but it is assumed to not affect our use-case

    """

    # Ignore loss of precision rather than raising exception
    DYNAMODB_CONTEXT.clear_traps()

    # Keep a reference to the original serialization methods
    boto3_serialize_orig = TypeSerializer.serialize
    boto3_deserialize_orig = TypeDeserializer.deserialize

    # Wrap serialization methods to support floats
    def boto3_serialize(self, value):
        if isinstance(value, float):
            value = Decimal(value)
        return boto3_serialize_orig(self, value)

    def boto3_deserialize(self, value):
        value = boto3_deserialize_orig(self, value)
        if isinstance(value, Decimal):
            value = float(value)
        return value

    # Replace the serialization methods with wrapped versions
    TypeSerializer.serialize = boto3_serialize
    TypeDeserializer.deserialize = boto3_deserialize
