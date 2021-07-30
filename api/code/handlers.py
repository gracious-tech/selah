
import os
import json
from pathlib import Path
from numbers import Number
from datetime import datetime
from contextlib import contextmanager

import boto3
from boto3.dynamodb.conditions import Attr

from utils import add_support_for_floats_to_dynamodb
from handlers_aws import HandlersAWS
from handlers_room import HandlersRoom
from handlers_media import HandlersMedia
from handlers_client import HandlersClient
from handlers_payment import HandlersPayment


# Avoid having to convert floats to decimals when using dynamodb
# NOTE Must call before interacting with dynamodb, but don't want to import in entrypoint
# WARN Call this only once or will get recursion error (as lambda may execute multiple times)
add_support_for_floats_to_dynamodb()


NoneType = type(None)  # Not importable and not normally in global scope


class WebsocketHandlers(HandlersAWS, HandlersRoom, HandlersMedia, HandlersClient, HandlersPayment):


    def __init__(self, event, context):
        """Unpack event and context and extract useful elements"""
        # WARN `client_error` cannot be used within __init__

        # Load app config
        config_path = Path(__file__).parent / 'app_config.json'
        self.config = json.loads(config_path.read_text())

        # Useful data
        self.event = event
        self.context = context
        self.sender = event['requestContext']['connectionId']

        # Access to sockets
        # See https://docs.aws.amazon.com/apigateway/latest/developerguide/apigateway-how-to-call-websocket-api-connections.html
        domain = event['requestContext']['domainName']
        stage = event['requestContext']['stage']
        self.sockets = boto3.client('apigatewaymanagementapi', endpoint_url=f'https://{domain}/{stage}')

        # Access to db
        stack = os.environ['STACK']
        self.db = boto3.resource('dynamodb')
        self.db_rooms = self.db.Table(f'{stack}-rooms')
        self.db_clients = self.db.Table(f'{stack}-clients')


    def process_input(self):
        """Extract the message from the event body"""

        # If this is a connect/disconnect event, create a pseudo message
        if self.event['requestContext']['eventType'] == 'CONNECT':
            message = {'type': 'aws_connect', 'info': {'socket': self.sender}}
        elif self.event['requestContext']['eventType'] == 'DISCONNECT':
            message = {'type': 'aws_disconnect', 'info': {'socket': self.sender}}
        else:
            # Parse the body
            try:
                message = json.loads(self.event.get('body'))
            except (json.JSONDecodeError, TypeError):
                self.client_error("Message body is not valid JSON")

        # Validate and assign to properties
        if not isinstance(message, dict):
            self.client_error("Message body is not a JSON object")
        self.msg_type = message.get('type')
        if not self.msg_type:
            self.client_error("Message type not provided")
        self.msg_info = message.get('info')
        if not isinstance(self.msg_info, dict):
            self.client_error("Message info not provided")


    def handle(self):
        """Call an appropriate handler for the given message type"""
        handler = getattr(self, f'handle_{self.msg_type}', None)
        if handler:
            handler()
        else:
            self.client_error(f"Message type '{self.msg_type}' not valid")


    # ERROR HANDLING


    class ClientError(Exception):
        """Raised when an error has occured and only the client can resolve it"""


    @contextmanager
    def condition_to_client_error(self):
        """A context manager that turns DynamoDB condition failures into ClientError

        This is useful because most conditions are simple checks that an item exists before updating
        it, and if not then client has most likely disconnected before a previous handler finishes
        executing. But in case client hasn't disconnected yet, a ClientError is raised so user
        can at least be notified of the problem (and hopefully report to developers).

        """
        try:
            yield
        except self.db.meta.client.exceptions.ConditionalCheckFailedException as error:
            raise self.ClientError("Database condition failed (notify support)")


    def _generate_error_info(self, message):
        """Generate an info dict for reporting the given error message"""
        return {
            "message": message,
            "received": {
                "type": getattr(self, 'msg_type', None),
                "info": getattr(self, 'msg_info', None),
            },
        }


    def client_error(self, message):
        """Stop execution as client has given invalid input

        This should never happen, so tell client and raise exception

        """
        info = self._generate_error_info(message)
        self.reply('client_error', info)
        raise self.ClientError(info)


    def client_confused(self, message):
        """Stop execution as client expected different to server

        This is probably just due to lag, so tell client but not logging on server

        """
        info = self._generate_error_info(message)
        self.reply('client_confused', info)
        raise self.ClientError(info)


    # VALIDATION


    def expect_from(self, data, types, required=(), nullable=()):
        """Return data's values in order, checking with given types

        If multiple keys, a list is returned for easy unpacking
        If a single key, only that value is returned for easy variable assignment
        If no keys, an empty list is returned and client error still raised if extraneous fields

        """

        # Don't allow extraneous fields
        all_keys = (*required, *nullable)
        extraneous = set(data.keys()) - set(all_keys)
        if extraneous:
            self.client_error(f"Unknown fields given: {', '.join(extraneous)}")

        # Check each item
        validated = []
        for key in all_keys:

            # Ensure every key is provided
            if key not in data:
                self.client_error(f"Missing '{key}' field")
            val = data[key]

            # Ensure value is of correct type
            other_types = [NoneType] if key in nullable else []
            if not isinstance(val, (types[key], *other_types)):
                self.client_error(f"Invalid value for '{key}' field")

            # Strip strings
            if isinstance(val, str):
                val = val.strip()

            # Map empty strings to None for consistency (dynamodb also doesn't allow empty strings)
            if val == '':
                val = None

            # Add to output
            validated.append(val)

        # Return values in order requested
        # NOTE If single item, does not wrap in a list
        return validated[0] if len(validated) == 1 else validated


    def expect(self, required=(), nullable=()):
        """A shortcut for running `expect_from` on `msg_info`"""
        types = {
            'room_id': str,
            'room_id_copy': str,
            'room_name': str,
            'room_secret': str,
            'room_start': Number,
            'room_paused': Number,
            'room_loaded': int,
            'room_admins_only': bool,
            'room_message': str,
            'client_name': str,
            'client_synced': Number,
            'client_feedback': str,
            'client_email': str,
            'client_user_agent': str,
            'payment_amount': int,
            'payment_return_url': str,
            'media_id': str,
            'media_id_after': str,
            'media_name': str,
            'media_type': str,
            'media_content': dict,
        }
        return self.expect_from(self.msg_info, types, required, nullable)


    def check_permission(self, expected_room_id, specific=None, *, admins_only=False):
        """Check if sender can do something in a room"""

        # Can't do if not in that room
        # NOTE room_id always required in case lag and client meant that action for a different room
        if expected_room_id != self.client['room_id']:
            self.client_confused("Client in different room to what they expect")

        # Assume room exists
        # NOTE Very slight chance client in room when it expires, but so unlikely not worth checking
        #      As clients only last ~2 hours max anyway

        # If admin then can do anything
        if self.client['room_admin']:
            return

        # If action is admins only then can't do it
        # NOTE self.room will not be requested unless necessary
        if admins_only or (specific and self.room[f'admins_only_{specific}']):
            self.client_confused("Only admins can do that")


    # DATABASE


    # By caching and updating after updates, reads will be strongly consistant within the request
    # NOTE Change of missing another request's updates, but within own request is most important
    # WARN Values may be None (as with room) so False represents "not cached"
    # WARN If put/update outside of setters, getter may get old/missing value
    _cached_client = False
    _cached_room = {
        'id': False,  # Client may change room, so need to remember which room cached
        'value': False,
    }


    @property
    def client(self):
        """DB client record for the sender"""

        # Return cached data if available
        if self._cached_client is not False:
            return self._cached_client

        # Fetch fresh data
        resp = self.db_clients.get_item(Key={'socket': self.sender})
        record = resp['Item']  # NOTE Expected to always exist

        # Cache and return
        self._cached_client = record
        return self._cached_client


    @client.setter
    def client(self, update_kwargs):
        """Update the db client record of the sender"""

        # Ensure only ever update sender's record (and saves needing that kwarg)
        update_kwargs['Key'] = {'socket': self.sender}

        # Ensure only ever update (and not create)
        # WARN This avoids: start-handler/$disconnect/update&end-handler leaving behind a "new"
        #      partial item (which causes errors when broadcast tries to access missing props)
        # NOTE For docs on condition chaining, see:
        #      https://boto3.amazonaws.com/v1/documentation/api/latest/guide/dynamodb.html
        condition = Attr('socket').exists()
        if 'ConditionExpression' in update_kwargs:
            update_kwargs['ConditionExpression'] = condition & update_kwargs['ConditionExpression']
        else:
            update_kwargs['ConditionExpression'] = condition

        # Request result to be returned so can know latest values without costing another read
        # NOTE AWS does not charge this as a read, so only overhead is slight network usage
        # TODO Could make this a fraction more effecient by only returning updated keys and merging
        update_kwargs['ReturnValues'] = 'ALL_NEW'

        # Update the record and update the cache with the result
        with self.condition_to_client_error():
            resp = self.db_clients.update_item(**update_kwargs)
        self._cached_client = resp['Attributes']


    @property
    def room(self):
        """DB room record for the sender"""

        # If cached room is same as sender's current room, return that
        # NOTE This means `room` relies on `client` being requested/cached
        if self._cached_room['id'] == self.client['room_id']:
            return self._cached_room['value']

        # Fetch fresh data, cache, and return
        # NOTE Since room state is critical and infrequently accessed, strongly consistent read used
        self._cached_room['id'] = self.client['room_id']
        resp = self.db_rooms.get_item(Key={'id': self._cached_room['id']}, ConsistentRead=True)
        self._cached_room['value'] = resp.get('Item')
        return self._cached_room['value']


    @room.setter
    def room(self, update_kwargs):
        """Update the db room record for the sender"""

        # Ensure only ever update sender's room (and saves needing that kwarg)
        # NOTE In case room changed, reset _room_id
        self._cached_room['id'] = self.client['room_id']
        update_kwargs['Key'] = {'id': self._cached_room['id']}

        # Ensure only ever update (and not create)
        # WARN This avoids: start-handler/$disconnect/update&end-handler leaving behind a "new"
        #      partial item (which causes errors when broadcast tries to access missing props)
        # NOTE For docs on condition chaining, see:
        #      https://boto3.amazonaws.com/v1/documentation/api/latest/guide/dynamodb.html
        condition = Attr('id').exists()
        if 'ConditionExpression' in update_kwargs:
            update_kwargs['ConditionExpression'] = condition & update_kwargs['ConditionExpression']
        else:
            update_kwargs['ConditionExpression'] = condition

        # Request result to be returned so can know latest values without costing another read
        # NOTE AWS does not charge this as a read, so only overhead is slight network usage
        # TODO Could make this a fraction more effecient by only returning updated keys and merging
        update_kwargs['ReturnValues'] = 'ALL_NEW'

        # Update the record and update the cache with the result
        with self.condition_to_client_error():
            resp = self.db_rooms.update_item(**update_kwargs)
        self._cached_room['value'] = resp['Attributes']


    # STATE


    def room_state(self):
        """Return the current state of sender's room

        WARN Careful not to return the secret!

        """
        keys_to_add = ['id', 'name', 'media', 'loaded', 'start', 'paused', 'admins_only_dj',
            'admins_only_see_clients', 'admins_only_chat']
        state = {}
        for key in keys_to_add:
            state[key] = self.room[key]
        return state


    def room_clients(self, *, exclude_self=False):
        """Return all clients who are in the sender's room"""

        # Get room's clients
        # NOTE Mainly just for display so not strongly consistant
        resp = self.db_clients.query(
            IndexName='by_room',
            KeyConditionExpression='room_id=:room_id',
            ExpressionAttributeValues={':room_id': self.room['id']},
        )
        clients = resp.get('Items', [])  # NOTE This may be empty due to dynamo delay

        # Exclude self if desired (used when about to leave the room)
        if exclude_self:
            clients = [c for c in clients if c['socket'] != self.sender]

        # Prepare results
        display_limit = 100
        results = {
            'admins': [],
            'guests': [],
            'hidden': False,
            'limited': len(clients) > display_limit,
            'total': len(clients),  # NOTE Non-limited total
        }

        # Need unlimited list of sockets so can broadcast results to all clients
        sockets = {
            'admins': [],
            'guests': [],
        }

        # Add clients to results
        # NOTE Dynamo already sorts clients by join time by default
        for client in clients:

            # Return only relevant and non-sensitive data
            data = {
                'socket': client['socket'],
                'name': client['name'],
                'admin': client['room_admin'],
                'synced': client['room_synced'],
            }

            # Keep admins and guests separate (for easier display AND limiting)
            list_key = 'admins' if data['admin'] else 'guests'
            results[list_key].append(data)
            sockets[list_key].append(client['socket'])

        # Limit results, including admins before guests
        results['admins'] = results['admins'][:display_limit]
        guests_limit = max(0, display_limit - len(results['admins']))
        results['guests'] = results['guests'][:guests_limit]

        # Prepare version of results for guests
        guest_results = results
        if self.room['admins_only_see_clients']:
            guest_results = {
                'admins': [],
                'guests': [],
                'hidden': True,
                'limited': False,  # Don't need to reveal
                'total': results['total'],
            }

        return (results, guest_results, sockets)


    # MESSAGES


    def send(self, connections, msg_type, info):
        """Send info to a connection or multiple connections"""
        if isinstance(connections, str):
            connections = [connections]
        data = json.dumps({'type': msg_type, 'info': info}).encode('utf-8')
        exception = None
        for connection in connections:
            # Be sure to not fail on one and ignore the others
            try:
                self.sockets.post_to_connection(Data=data, ConnectionId=connection)
            except self.sockets.exceptions.GoneException:
                # The socket has disconnected already (Dynamo probably just returned stale data)
                # If client record wasn't deleted (as AWS doesn't guarantee it), will expire anyway
                pass
            except Exception as exc:
                # Something bad happened so record (but don't prevent sending to other clients)
                # NOTE Assuming if an exception than only reporting one is sufficient
                exception = exc
        if exception:
            self.client_error(exception)


    def reply(self, msg_type, info):
        """Send info to the connection that triggered this function"""
        self.send(self.sender, msg_type, info)


    def get_client_sockets(self, *, force_room_id=None):
        """Return tuple of client sockets for those in the sender's room"""

        # This method is required by `handle_room_delete` which may need to pass in room_id manually
        # WARN No other method should use force_room_id (could cause security issues)
        room_id = force_room_id if force_room_id else self.client['room_id']

        resp = self.db_clients.query(
            IndexName='by_room',
            KeyConditionExpression='room_id=:room_id',
            ExpressionAttributeValues={':room_id': room_id},
            ProjectionExpression='socket',  # Only need the socket in this case
        )
        return (client['socket'] for client in resp.get('Items', tuple()))


    def broadcast_room_state(self):
        """Send latest room state to all clients of the room"""
        self.send(self.get_client_sockets(), 'room_state', self.room_state())


    def broadcast_room_clients(self, *, exclude_self=False):
        """Broadcast who's in a room to all the participants

        This may get executed frequently (especially when starting play and all clients sync)
        However, trying to debounce would involve many more db queries and so sending many messages
        is favoured instead.

        """

        # Sender may not actually be in a room, so do nothing if so
        if not self.room:
            return

        # Broadcast clients data
        admin_clients, guest_clients, sockets = self.room_clients(exclude_self=exclude_self)
        for socket in sockets['admins']:
            self.send(socket, 'room_clients', {
                'room_id': self.room['id'],
                'clients': admin_clients,
            })
        for socket in sockets['guests']:
            self.send(socket, 'room_clients', {
                'room_id': self.room['id'],
                'clients': guest_clients,
            })
