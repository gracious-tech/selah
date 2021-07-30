
from datetime import datetime, timedelta


class HandlersAWS:
    """Handlers for AWS socket connect/disconnect events

    NOTE Unlike other handlers, input to these can be trusted since it doesn't come from clients

    """

    def handle_aws_connect(self):
        """Handle a new socket open event and create client record"""

        # Determine how long record should be kept for
        # NOTE AWS has a max socket connection duration of 2 hours
        #      See https://docs.aws.amazon.com/apigateway/latest/developerguide/limits.html
        now = datetime.now()
        expire = now + timedelta(days=1)

        self.db_clients.put_item(Item={
            'socket': self.sender,
            'expire': expire.timestamp(),
            'name': None,
            'room_id': '#',  # Dynamo can't index None so '#' represents None
            'room_joined': 0,  # Can't be None as used to sort clients (will set when join room)
            'room_admin': None,
            'room_synced': None,
        })


    def handle_aws_disconnect(self):
        """Handle a socket close event

        WARN AWS cannot guarantee this will actually be called, but records expire anyway
             See https://docs.aws.amazon.com/apigateway/latest/developerguide/apigateway-websocket-api-route-keys-connect-disconnect.html

        """

        # If in a room, let other clients know they're leaving
        self.broadcast_room_clients(exclude_self=True)

        # Remove the client's record
        self.db_clients.delete_item(Key={'socket': self.sender})
