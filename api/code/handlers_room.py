
from html import escape
from secrets import token_urlsafe
from datetime import datetime, timedelta

from bleach import linkify
from bleach.callbacks import nofollow, target_blank

from names import get_random_name


class HandlersRoom:
    """Handlers for modifying a room"""

    def handle_room_create(self):
        """Create a new room (optionally copying an existing room's media and name)"""

        # Accepts client_name since can't include in handle_aws_connect, and repeat sets harmless
        client_name, copy_id, room_name = self.expect(
            nullable=['client_name', 'room_id_copy', 'room_name'])

        # Get copy of existing room if copying
        # NOTE If room doesn't exist will create blank one, as if can't copy would still want a room
        copy = None
        if copy_id:
            copy = self.db_rooms.get_item(Key={'id': copy_id}, ConsistentRead=True).get('Item')

        # Generate id and admin secret
        # NOTE Room id should be safe enough, and yet not too difficult to type manually if needed
        #      Users may choose to manually type to copy from a phone to a laptop for example
        #      Bytes used should ideally be a multiple of 3 (token is base64 encoded)
        #      Brute force attacks would be significantly delayed by network, so not high risk
        #      Rooms are also highly likely to be very short lived
        # WARN Update client-side (e.g. join id validation) if room_id ever changes length/chars
        room_id = token_urlsafe(6)  # = 8 chars, and trillions of possibilities
        secret = token_urlsafe()  # Use recommended length as won't enter manually

        # Determine when record will expire (extended whenever used, so only inactive rooms deleted)
        now = datetime.now()
        expire = now + timedelta(days=30)

        # Determine room's name
        if copy:
            # Copies always expand on the original room's name
            room_name = f'{copy["name"]} (copy)'
        elif room_name == 'Room':
            # If client provided just "Room" append room id to make it distinguishable
            # NOTE Client-side code uses this to avoid the random name pool
            room_name = f"Room {room_id}"
        elif not room_name:
            # If no name given then generate a random one
            room_name = get_random_name()

        # Form new room's data
        room = {
            'id': room_id,
            'secret': secret,

            'created': now.timestamp(),
            'expire': expire.timestamp(),  # TODO Update when room modified (not when clients join as bots could keep open forever)

            'name': room_name,
            'media': copy['media'] if copy else [],
            'loaded': copy['loaded'] if copy else None,
            'start': copy['start'] if copy else None,
            'paused': copy['paused'] if copy else None,

            'admins_only_dj': True,
            'admins_only_see_clients': False,
            'admins_only_chat': False,
        }

        # Create the room
        # NOTE This will override existing, but id generated server-side and random enough
        self.db_rooms.put_item(Item=room)

        # Cache otherwise value may not be available when room_state() gets it
        self._cached_room['id'] = room_id
        self._cached_room['value'] = room

        # Assign creator to this room
        self.client_join_room(room_id, is_admin=True, client_name=client_name)

        # Send back secret and new room's state
        self.reply('room_created', {
            'room': self.room_state(),
            'secret': secret,
            'clients': {  # Will just be self, and dynamo may be delayed, so just hardcode
                'admins': [],
                'guests': [],
                'hidden': False,
                'limited': False,
                'total': 1,
            },
            'you': self.sender,
        })


    def handle_room_delete(self):
        """Delete a room and remove all clients from it"""
        room_id, secret = self.expect(['room_id', 'room_secret'])

        # Check room exists
        # NOTE Not using usual checks as client is not required to be in the room for this action
        resp = self.db_rooms.get_item(Key={'id': room_id})
        room = resp.get('Item')
        if not room:
            # Room already deleted, but client thinks it exists, so tell client to remove from state
            self.reply('room_invalid', {'room_id': room_id})
            return

        # Check sender is admin
        if secret != room['secret']:
            self.client_confused("Cannot delete room as you are not an admin")

        # Delete room first so that new clients can't join
        self.db_rooms.delete_item(Key={'id': room_id})

        # Boot all existing clients out of room
        for socket in self.get_client_sockets(force_room_id=room_id):
            self.send(socket, 'room_invalid', {'room_id': room_id})
            with self.condition_to_client_error():
                self.db_clients.update_item(**self.kwargs_client_leave(socket))

        # Finally, let sender know it was deleted (even if they weren't in room)
        self.reply('room_invalid', {'room_id': room_id})


    def handle_room_name(self):
        """Change the name of the room"""

        # Input
        # NOTE Unlike client, room name cannot be None
        room_id, name = self.expect(['room_id', 'room_name'])
        self.check_permission(room_id, admins_only=True)

        # Change the room name
        self.room = {
            'UpdateExpression': 'SET #_name=:name',
            'ExpressionAttributeNames': {
                '#_name': 'name',
            },
            'ExpressionAttributeValues': {
                ':name': name,
            },
        }

        # Update all room's clients
        self.broadcast_room_state()


    def handle_room_message(self):
        """Send a chat message to all clients of a room"""

        # Input
        room_id, message = self.expect(['room_id', 'room_message'])
        self.check_permission(room_id, 'chat')

        # Convert message to html but only allowing <br>
        html = '<br>'.join(escape(line) for line in message.split('\n'))

        # Create links for any URLs in the text
        # WARN linkify doesn't sanitize and accepts html, so escape first
        # NOTE links have rel=nofollow and target=_blank added
        html = linkify(html, [nofollow, target_blank])

        # Update all room's clients
        self.send(self.get_client_sockets(), 'room_message', {
            'id': token_urlsafe(6),
            'room_id': room_id,
            'sender': self.sender,
            'name': self.client['name'],  # Clients list may not be available so must include
            'html': html,
            'timestamp': datetime.now().timestamp(),  # NOTE Safer to not trust client with this
        })


    def _handle_room_admins_only(self, permission):
        """Base handler for changing the value of an admins_only permission"""

        # Input
        room_id, admins_only = self.expect(['room_id', 'room_admins_only'])
        self.check_permission(room_id, admins_only=True)

        # Change admins_only value
        self.room = {
            'UpdateExpression': f'SET admins_only_{permission}=:admins_only',
            'ExpressionAttributeValues': {
                ':admins_only': admins_only,
            }
        }

        # Update all room's clients
        self.broadcast_room_state()

        # If changing see_clients then will also need to rebroadcast clients
        if permission == 'see_clients':
            self.broadcast_room_clients()


    def handle_room_admins_only_dj(self):
        self._handle_room_admins_only('dj')


    def handle_room_admins_only_see_clients(self):
        self._handle_room_admins_only('see_clients')


    def handle_room_admins_only_chat(self):
        self._handle_room_admins_only('chat')
